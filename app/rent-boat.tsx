import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoatPhotoCarousel } from '@/components/boat-photo-carousel';
import { WeatherAlert } from '@/components/weather-alert';
import { formatTripDate, fromYmd, TripCalendarModal, toYmd } from '@/components/trip-calendar-modal';
import { ApiError } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { createBooking } from '@/lib/bookings';
import { fetchBoatAvailability, fetchBoatById } from '@/lib/boats';
import { fetchDayHolds, isWeatherHold, weatherCopy, type DayWeatherMark } from '@/lib/weather';
import { useRequireActiveOrganization } from '@/lib/organization-access';
import { resolveMediaUrl } from '@/lib/config';
import { useAppTheme } from '@/lib/theme';
import type { Boat, BoatAvailability, BoatTimeSlot, RentalDestination } from '@/lib/types';

const BLUE = '#1A5AD7';
const NAVY = '#1B2744';
const MUTED = '#3F4A63';
const GREEN = '#1FA971';
const WARN = '#C05621';
const PLACEHOLDER = '#B8BDC8';
const INPUT_BORDER = '#C9D8F5';
const CARD = '#FFFFFF';
const PAGE = '#F3F6FB';
const BORDER = '#E8EEF6';

const FALLBACK_BOAT =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80';

function formatTimeLabel(hour: number, minute: number) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 || 12;
  return `${display}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/** Turns the typed hour, minute and AM/PM into "HH:MM" (24-hour), or '' when incomplete. */
function typedTimeValue(hourText: string, minuteText: string, meridiem: 'AM' | 'PM'): string {
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!hourText || !minuteText || !Number.isInteger(hour) || !Number.isInteger(minute)) {
    return '';
  }
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    return '';
  }
  const hour24 = (hour % 12) + (meridiem === 'PM' ? 12 : 0);
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function upcomingDates(count = 7) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      value: toYmd(date),
      weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
      day: String(date.getDate()),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
    };
  });
}


function formatFieldDate(value: string) {
  const date = fromYmd(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}

function boatPhotos(boat: Boat) {
  const urls = (boat.picture_urls?.length ? boat.picture_urls : [boat.picture_url])
    .map((url) => resolveMediaUrl(url))
    .filter((url): url is string => Boolean(url));

  return urls.length > 0 ? urls : [FALLBACK_BOAT];
}

const OTHER_PURPOSE = 'Other / Specify';

const TRIP_PURPOSES: Array<{
  value: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    value: 'Island hopping',
    hint: 'Visit multiple islands and beaches',
    icon: 'sunny',
  },
  {
    value: 'Mangaligo',
    hint: 'Swimming and beach activities',
    icon: 'triangle',
  },
  {
    value: 'Leisure',
    hint: 'Relaxation and recreation',
    icon: 'partly-sunny',
  },
  {
    value: 'Family outing',
    hint: 'Family trip and bonding',
    icon: 'people',
  },
  {
    value: 'Transport',
    hint: 'Direct transport to destination',
    icon: 'bus',
  },
  {
    value: OTHER_PURPOSE,
    hint: 'Type your own purpose',
    icon: 'create',
  },
];

function FieldLabel({
  icon,
  label,
  required = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  required?: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.fieldLabelRow}>
      <Ionicons name={icon} size={16} color={colors.blue} />
      <Text style={[styles.fieldLabelText, { color: colors.navy }]}>{label}</Text>
      {required ? <Text style={styles.requiredStar}>*</Text> : null}
    </View>
  );
}

function DestinationPriceCard({
  item,
  selected = false,
}: {
  item: RentalDestination;
  selected?: boolean;
}) {
  const { colors, isDark } = useAppTheme();

  return (
    <View
      style={[
        styles.destinationCard,
        { backgroundColor: isDark ? colors.iconBg : '#EAF2FF' },
        selected && [styles.destinationCardSelected, { backgroundColor: isDark ? '#243B63' : '#DCEBFF' }],
      ]}>
      <View style={styles.destinationCardCopy}>
        <Text style={[styles.destinationCardName, { color: colors.navy }]} numberOfLines={1}>
          {item.destination}
        </Text>
        <Text style={[styles.destinationPriceHint, { color: colors.muted }]}>
          Rental Price (Good for the whole boat)
        </Text>
      </View>
      <Text style={[styles.destinationPrice, { color: colors.blue }]}>{item.rental_price_label || '—'}</Text>
    </View>
  );
}

/** Short summary shown right above Confirm Rental; amounts come from the server. */
function PaymentSummary({ item }: { item: RentalDestination }) {
  const { colors, isDark } = useAppTheme();

  if (item.rental_price == null) {
    return null;
  }

  const rows = [
    { label: 'Total rental price', value: item.rental_price_label || '—' },
    {
      label: `Down payment${item.down_payment_percent_label ? ` (${item.down_payment_percent_label})` : ''}`,
      value: item.down_payment_amount_label || '₱0.00',
      highlight: true,
    },
    { label: 'Remaining balance', value: item.remaining_balance_label || '—' },
  ];

  return (
    <View
      style={[styles.summaryCard, { backgroundColor: isDark ? colors.iconBg : '#F4F8FF', borderColor: colors.border }]}
      pointerEvents="none">
      {rows.map((row) => (
        <View key={row.label} style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: row.highlight ? GREEN : colors.muted }]}>{row.label}</Text>
          <Text style={[styles.summaryValue, { color: row.highlight ? GREEN : colors.navy }]}>{row.value}</Text>
        </View>
      ))}
      <Text style={[styles.summaryNote, { color: colors.muted }]}>
        After the operator accepts, pay the down payment by GCash in the app to confirm. Pay the balance by GCash or
        cash on the trip day. The down payment is non-refundable if you cancel.
      </Text>
    </View>
  );
}

function SelectControl({
  icon,
  value,
  placeholder,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors, isDark } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.selectWrap,
        {
          backgroundColor: isDark ? colors.iconBg : '#FFFFFF',
          borderColor: isDark ? colors.border : INPUT_BORDER,
        },
        pressed && styles.pressed,
        disabled && styles.selectDisabled,
      ]}>
      <Ionicons name={icon} size={18} color={colors.blue} />
      <Text
        style={[styles.selectValue, { color: value ? colors.navy : colors.muted }, !value && styles.selectPlaceholder]}
        numberOfLines={1}>
        {value || placeholder}
      </Text>
      <Ionicons name="chevron-down" size={18} color={colors.blue} />
    </Pressable>
  );
}

function SpecItem({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { colors, isDark } = useAppTheme();

  return (
    <View style={styles.specItem}>
      <View style={[styles.specIcon, { backgroundColor: isDark ? colors.iconBg : '#E8F1FF' }]}>
        <Ionicons name={icon} size={16} color={colors.blue} />
      </View>
      <View style={styles.specCopy}>
        <Text style={[styles.specLabel, { color: colors.muted }]}>{label}</Text>
        <Text style={[styles.specValue, { color: colors.navy }]}>{value}</Text>
      </View>
    </View>
  );
}

type BookingField = 'destination' | 'contact' | 'pickup' | 'purpose' | 'notes';

export default function RentBoatScreen() {
  const router = useRouter();
  const allowed = useRequireActiveOrganization('passenger-rental');
  const params = useLocalSearchParams<{ id?: string; purpose?: string }>();
  const boatId = Number(params.id);
  const { colors, isDark } = useAppTheme();
  const fieldBg = isDark ? colors.iconBg : '#FFFFFF';
  const fieldBgFocus = isDark ? '#2A3F63' : '#EEF4FF';
  const typedColor = isDark ? '#F8FBFF' : NAVY;
  const placeholderColor = isDark ? '#A7B4C7' : PLACEHOLDER;
  const insets = useSafeAreaInsets();
  const dates = useMemo(() => upcomingDates(), []);
  const { width } = useWindowDimensions();
  const carouselWidth = width - 32;
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const keyboardHeightRef = useRef(0);
  const keyboardTopRef = useRef(0);
  const ignoreBlurRef = useRef(false);
  const focusedFieldRef = useRef<BookingField | null>(null);
  const fieldRefs = useRef<Partial<Record<BookingField, View | null>>>({});

  const [boat, setBoat] = useState<Boat | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [bookingDate, setBookingDate] = useState(dates[0]?.value ?? '');
  const [hourText, setHourText] = useState('8');
  const [minuteText, setMinuteText] = useState('00');
  const [meridiem, setMeridiem] = useState<'AM' | 'PM'>('AM');
  const startTime = typedTimeValue(hourText, minuteText, meridiem);
  const startTimeLabel = startTime
    ? formatTimeLabel(Number(startTime.slice(0, 2)), Number(startTime.slice(3, 5)))
    : '';
  const [destination, setDestination] = useState('');
  const [pickupPoint, setPickupPoint] = useState('');
  const [purpose, setPurpose] = useState(() =>
    TRIP_PURPOSES.some((option) => option.value === params.purpose) ? String(params.purpose) : '',
  );
  const [remarks, setRemarks] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [contactNumber, setContactNumber] = useState('');

  useEffect(() => {
    getStoredUser().then((user) => {
      if (user?.contact_number) {
        setContactNumber((current) => current || user.contact_number || '');
      }
    });
  }, []);
  const [availability, setAvailability] = useState<BoatAvailability | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [slotNotice, setSlotNotice] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [picker, setPicker] = useState<'purpose' | null>(null);
  const [customPurpose, setCustomPurpose] = useState('');
  const [focusedField, setFocusedField] = useState<BookingField | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [dayHolds, setDayHolds] = useState<Record<string, DayWeatherMark>>({});
  const holdDatesFetched = useRef<Set<string>>(new Set());

  function scrollFieldAboveKeyboard(field: BookingField) {
    const node = fieldRefs.current[field];
    const keyboardTop =
      keyboardTopRef.current || Dimensions.get('window').height - keyboardHeightRef.current;
    if (!node || keyboardHeightRef.current <= 0) {
      return;
    }

    ignoreBlurRef.current = true;
    node.measureInWindow((_x, y, _width, height) => {
      const overflow = y + height + 28 - keyboardTop;
      if (overflow > 0) {
        scrollRef.current?.scrollTo({
          y: Math.max(0, scrollY.current + overflow),
          animated: true,
        });
      }
      setTimeout(() => {
        ignoreBlurRef.current = false;
      }, 450);
    });
  }

  function handleFieldFocus(field: BookingField) {
    focusedFieldRef.current = field;
    setFocusedField(field);
    setTimeout(() => scrollFieldAboveKeyboard(field), 50);
  }

  function handleFieldBlur() {
    if (ignoreBlurRef.current) {
      return;
    }

    focusedFieldRef.current = null;
    setFocusedField(null);
  }

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
      ignoreBlurRef.current = true;
      keyboardHeightRef.current = event.endCoordinates.height;
      keyboardTopRef.current = event.endCoordinates.screenY;
      setKeyboardHeight(event.endCoordinates.height);
      const field = focusedFieldRef.current;
      if (field) {
        setTimeout(() => scrollFieldAboveKeyboard(field), 80);
      }
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      keyboardHeightRef.current = 0;
      keyboardTopRef.current = 0;
      setKeyboardHeight(0);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (!boatId) {
      setLoading(false);
      return;
    }

    fetchBoatById(boatId)
      .then((item) => {
        setBoat(item);
        if (item) {
          setPassengers(1);
          const destinations = item.rental_destinations ?? [];
          setDestination(
            destinations.length === 1 ? destinations[0].destination : '',
          );
          setPickupPoint('');
        }
      })
      .catch(() => setBoat(null))
      .finally(() => setLoading(false));
  }, [boatId]);

  const loadDayHolds = useCallback(
    (nextDates: string[]) => {
      if (!boatId) {
        return;
      }
      const missing = nextDates.filter((date) => date && !holdDatesFetched.current.has(date));
      if (missing.length === 0) {
        return;
      }
      missing.forEach((date) => holdDatesFetched.current.add(date));
      fetchDayHolds(boatId, missing)
        .then((holds) => {
          setDayHolds((current) => ({ ...current, ...holds }));
        })
        .catch(() => undefined);
    },
    [boatId],
  );

  useEffect(() => {
    holdDatesFetched.current = new Set();
    setDayHolds({});
    if (!boatId) {
      return;
    }
    loadDayHolds(dates.map((item) => item.value));
  }, [boatId, dates, loadDayHolds]);

  useEffect(() => {
    if (!boatId || !bookingDate) {
      return;
    }

    let cancelled = false;
    setAvailabilityLoading(true);
    setSlotNotice('');

    fetchBoatAvailability(boatId, bookingDate)
      .then((data) => {
        if (cancelled) {
          return;
        }

        setAvailability(data);
      })
      .catch(() => {
        if (!cancelled) {
          setAvailability(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAvailabilityLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [boatId, bookingDate]);

  function changePassengers(delta: number) {
    if (!boat) {
      return;
    }

    setPassengers((current) => Math.min(boat.capacity, Math.max(1, current + delta)));
  }

  const photos = boat ? boatPhotos(boat) : [FALLBACK_BOAT];
  const boatOffline = boat?.status === 'maintenance' || boat?.status === 'unavailable';
  const timeSlots: BoatTimeSlot[] = availability?.times ?? [];
  const selectedSlot = timeSlots.find((slot) => slot.value === startTime);
  const timeAvailable = Boolean(startTime) && selectedSlot?.available !== false;
  const timeInPast = (() => {
    if (!startTime || !bookingDate) {
      return false;
    }
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (bookingDate !== today) {
      return false;
    }
    const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return startTime <= current;
  })();
  const weatherMark =
    dayHolds[bookingDate] ??
    (availability?.weather_tone
      ? {
          tone: availability.weather_tone,
          reason: availability.day_reason || (availability.weather_tone === 'yellow' ? 'Weather watch' : 'Bad weather'),
          canBook: availability.weather_can_book ?? false,
          kind: availability.weather_tone === 'red' || availability.weather_tone === 'yellow' ? ('weather' as const) : undefined,
        }
      : availability?.day_booked
        ? {
            tone: 'blue' as const,
            reason: availability.day_reason || 'This boat is already booked that day.',
            canBook: false,
            kind: 'booked' as const,
          }
        : availability && !availability.day_available && isWeatherHold(availability.day_reason)
          ? { tone: 'red' as const, reason: availability.day_reason || 'Bad weather', canBook: false, kind: 'weather' as const }
          : availability && !availability.day_available
            ? {
                tone: 'blue' as const,
                reason: availability.day_reason || 'This boat is already booked that day.',
                canBook: false,
                kind: 'booked' as const,
              }
            : null);
  const weatherNotice =
    weatherMark && weatherMark.tone !== 'blue'
      ? weatherCopy(bookingDate, weatherMark.reason, weatherMark.tone === 'yellow' ? 'yellow' : 'red')
      : null;
  const weatherClosed = weatherMark?.tone === 'red' && weatherMark.canBook === false;
  const weatherWatch = !weatherClosed && weatherMark?.tone === 'yellow';
  const dayBooked = !weatherClosed && !weatherWatch && (weatherMark?.tone === 'blue' || availability?.day_booked === true);
  const formLocked = weatherClosed || weatherWatch || dayBooked;
  const scheduleNotice =
    slotNotice ||
    (dayBooked ? weatherMark?.reason || availability?.day_reason || 'This boat is already booked that day.' : null) ||
    (selectedSlot && !selectedSlot.available ? selectedSlot.reason : null) ||
    (timeInPast && !formLocked ? 'That time has already passed today. Type a later time.' : '');
  const rentalDestinations = boat?.rental_destinations ?? [];
  const selectedDestination = rentalDestinations.find((item) => item.destination === destination);
  const purposeLabel =
    purpose === OTHER_PURPOSE ? customPurpose.trim() || OTHER_PURPOSE : purpose;

  async function handleConfirm() {
    if (!boat) {
      return;
    }

    const rentalDestinations = boat.rental_destinations ?? [];
    const nextDestination = destination.trim();
    if (rentalDestinations.length > 0 && !rentalDestinations.some((item) => item.destination === nextDestination)) {
      setError('Please select a destination assigned to this boat.');
      return;
    }
    if (!nextDestination) {
      setError('Please select a destination.');
      return;
    }

    const nextPickup = pickupPoint.trim();
    if (!nextPickup) {
      setError('Please enter a pickup or meeting point.');
      return;
    }

    const nextPurpose =
      purpose === OTHER_PURPOSE ? customPurpose.trim() : purpose.trim();
    if (!purpose.trim()) {
      setError('Please select the purpose of the trip.');
      return;
    }
    if (!nextPurpose) {
      setError('Please specify the purpose of the trip.');
      return;
    }

    if (!bookingDate) {
      setError('Please choose an available date.');
      return;
    }
    if (!startTime) {
      setError('Please type a valid departure time (hour 1–12, minutes 00–59).');
      return;
    }
    if (timeInPast) {
      setError('That time has already passed today. Type a later time.');
      return;
    }

    const nextContact = contactNumber.trim();
    if (!nextContact) {
      setError('Please enter your contact number.');
      return;
    }

    const selectedSlot = timeSlots.find((slot) => slot.value === startTime);
    if (selectedSlot && !selectedSlot.available) {
      setError(selectedSlot.reason ?? 'This boat is unavailable at this time.');
      return;
    }

    if (weatherClosed) {
      setError(
        weatherMark?.reason ||
          'This date is closed because of a weather hold. Please pick another day.',
      );
      return;
    }
    if (weatherWatch) {
      setError('Booking is temporarily unavailable on this date because of a weather watch. Please pick another schedule.');
      return;
    }
    if (dayBooked) {
      setError(weatherMark?.reason || 'This boat is already booked that day. Please pick another date.');
      return;
    }
    if (
      availability &&
      !availability.day_available &&
      availability.weather_tone !== 'yellow' &&
      !isWeatherHold(availability.day_reason)
    ) {
      setError(availability.day_reason || 'This boat is unavailable on this date.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const booking = await createBooking({
        boat_id: boat.id,
        destination: nextDestination,
        pickup_point: nextPickup,
        purpose: nextPurpose,
        booking_date: bookingDate,
        start_time: startTime.slice(0, 5),
        passenger_count: passengers,
        remarks: remarks.trim() || undefined,
        contact_number: nextContact,
      });

      router.push({
        pathname: '/rental-result',
        params: { type: 'submitted', code: booking.code },
      });
    } catch (err) {
      if (err instanceof ApiError && err.isOrganizationInactive()) {
        router.replace('/organization-unavailable');
        return;
      }
      setError(err instanceof ApiError ? err.firstError() : 'Rental failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!allowed) {
    return <View style={[styles.screen, { backgroundColor: colors.page }]} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}>
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            onScroll={(event) => {
              scrollY.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: 48 + insets.bottom + keyboardHeight },
            ]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Ionicons name="chevron-back" size={28} color={colors.navy} />
            </Pressable>

            <Text style={[styles.title, { color: colors.navy }]}>Boat Details</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Review this boat, then choose your schedule.
            </Text>

            {loading ? (
              <ActivityIndicator color={BLUE} style={styles.loader} />
            ) : !boat ? (
              <Text style={[styles.empty, { color: colors.muted }]}>This boat could not be found.</Text>
            ) : boatOffline ? (
              <Text style={[styles.empty, { color: colors.muted }]}>This boat is currently unavailable.</Text>
            ) : (
              <>
                <View style={styles.headerBlock}>
                  <Text style={[styles.boatName, { color: colors.navy }]}>{boat.name}</Text>
                  <Text style={[styles.boatCode, { color: colors.muted }]}>{boat.code}</Text>
                  <Text style={styles.available}>{boat.status_label}</Text>
                </View>

                <BoatPhotoCarousel urls={photos} width={carouselWidth} />

                <View style={[styles.specsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <SpecItem icon="boat-outline" label="Boat Type" value={boat.type || 'Pump Boat'} />
                  <SpecItem
                    icon="people-outline"
                    label="Capacity"
                    value={`${boat.capacity} passengers`}
                  />
                  <SpecItem
                    icon="location-outline"
                    label="Home Port"
                    value={boat.home_port || 'Lakandula'}
                  />
                  <SpecItem icon="checkmark-circle-outline" label="License No." value={boat.license_no || '—'} />
                  <SpecItem
                    icon="calendar-outline"
                    label="Registered Date"
                    value={boat.registration_date_label || '—'}
                  />
                </View>

                <View style={[styles.safetyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.safetyTitleRow}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={colors.blue} />
                    <Text style={[styles.safetyTitle, { color: colors.navy }]}>Safety Equipment</Text>
                  </View>
                  {(boat.safety_equipment?.length ?? 0) > 0 ? (
                    boat.safety_equipment?.map((item) => (
                      <View key={item} style={styles.safetyItem}>
                        <View style={styles.safetyCheck}>
                          <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                        </View>
                        <Text style={[styles.safetyText, { color: colors.navy }]}>{item}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.empty}>No safety equipment recorded.</Text>
                  )}
                </View>

                <View
                  style={[
                    styles.formCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    weatherClosed && {
                      backgroundColor: isDark ? '#3A2224' : '#FDECEC',
                      borderColor: '#E25C5C',
                    },
                    dayBooked && {
                      backgroundColor: isDark ? '#1B2C4D' : '#E8F1FF',
                      borderColor: colors.blue,
                    },
                    weatherWatch && {
                      backgroundColor: isDark ? '#3A2E1C' : '#FFF7E0',
                      borderColor: '#F6C453',
                    },
                  ]}>
                  <Text style={[styles.sectionTitle, { color: colors.navy }]}>Choose your schedule</Text>
                  {weatherNotice && weatherWatch ? (
                    <WeatherAlert
                      title={weatherNotice.title}
                      body={`${formatTripDate(bookingDate)}\n\n${weatherNotice.body}`}
                      tone="yellow"
                    />
                  ) : null}
                  {weatherClosed ? (
                    <View
                      style={[
                        styles.holdBanner,
                        {
                          backgroundColor: isDark ? '#4A2A2C' : '#FDECEC',
                          borderColor: isDark ? '#7A3A3A' : '#F3B4B4',
                        },
                      ]}>
                      <Ionicons name="rainy-outline" size={18} color={isDark ? '#FF8B8B' : '#C53030'} />
                      <View style={styles.holdCopy}>
                        <Text style={[styles.holdTitle, { color: isDark ? '#FF8B8B' : '#C53030' }]}>
                          No trips available on this date.
                        </Text>
                        <Text style={[styles.holdBody, { color: isDark ? '#F8D0D0' : '#E25C5C' }]}>
                          {weatherMark?.reason ||
                            'This date is under weather hold due to bad weather conditions. The whole form is locked until you pick another day.'}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  {dayBooked ? (
                    <View
                      style={[
                        styles.bookedBanner,
                        {
                          backgroundColor: isDark ? '#243B63' : '#DCEBFF',
                          borderColor: isDark ? '#3A5A93' : '#9EC0F5',
                        },
                      ]}>
                      <Ionicons name="calendar" size={18} color={colors.blue} />
                      <View style={styles.holdCopy}>
                        <Text style={[styles.bookedTitle, { color: colors.blue }]}>
                          This boat is already booked that day
                        </Text>
                        <Text style={[styles.bookedBody, { color: isDark ? '#C5D8F6' : '#1B3A73' }]}>
                          {weatherMark?.reason ||
                            'This boat already has a rental on this date, so you cannot fill up this form. Please pick another day.'}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.field}>
                    <FieldLabel icon="calendar" label="Rental Date" required />
                    <SelectControl
                      icon="calendar-outline"
                      value={bookingDate ? formatFieldDate(bookingDate) : ''}
                      placeholder="Pick a date"
                      onPress={() => setCalendarOpen(true)}
                    />
                  </View>

                  <View style={styles.field}>
                    <FieldLabel icon="time" label="Preferred Departure Time" required />
                    {availabilityLoading ? (
                      <ActivityIndicator color={colors.blue} style={styles.timeLoader} />
                    ) : (
                      <View style={[styles.timeTypeRow, formLocked && { opacity: 0.5 }]}>
                        <TextInput
                          value={hourText}
                          editable={!formLocked}
                          onChangeText={(text) => {
                            setHourText(text.replace(/\D/g, '').slice(0, 2));
                            setError('');
                            setSlotNotice('');
                          }}
                          keyboardType="number-pad"
                          maxLength={2}
                          placeholder="8"
                          placeholderTextColor={PLACEHOLDER}
                          accessibilityLabel="Departure hour"
                          style={[styles.timeTypeInput, { borderColor: INPUT_BORDER, color: colors.navy, backgroundColor: colors.card }]}
                        />
                        <Text style={[styles.timeTypeColon, { color: colors.navy }]}>:</Text>
                        <TextInput
                          value={minuteText}
                          editable={!formLocked}
                          onChangeText={(text) => {
                            setMinuteText(text.replace(/\D/g, '').slice(0, 2));
                            setError('');
                            setSlotNotice('');
                          }}
                          onBlur={() => {
                            if (minuteText.length === 1) {
                              setMinuteText(`0${minuteText}`);
                            }
                          }}
                          keyboardType="number-pad"
                          maxLength={2}
                          placeholder="00"
                          placeholderTextColor={PLACEHOLDER}
                          accessibilityLabel="Departure minutes"
                          style={[styles.timeTypeInput, { borderColor: INPUT_BORDER, color: colors.navy, backgroundColor: colors.card }]}
                        />
                        <View style={[styles.meridiemWrap, { borderColor: INPUT_BORDER }]}>
                          {(['AM', 'PM'] as const).map((value) => (
                            <Pressable
                              key={value}
                              disabled={formLocked}
                              onPress={() => {
                                setMeridiem(value);
                                setError('');
                                setSlotNotice('');
                              }}
                              style={[styles.meridiemBtn, meridiem === value && { backgroundColor: colors.blue }]}>
                              <Text style={[styles.meridiemText, { color: meridiem === value ? '#FFFFFF' : colors.navy }]}>
                                {value}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    )}
                    {!formLocked && (hourText || minuteText) && !startTime ? (
                      <Text style={[styles.hintText, { color: WARN, marginBottom: 0 }]}>
                        Hour must be 1–12 and minutes 00–59.
                      </Text>
                    ) : null}
                  </View>

                  {bookingDate && timeAvailable && !timeInPast && !formLocked ? (
                    <View style={[styles.selectedSchedule, { backgroundColor: isDark ? '#101828' : NAVY }]}>
                      <Text style={styles.selectedScheduleLabel}>Selected Schedule</Text>
                      <View style={styles.selectedScheduleRow}>
                        <Ionicons name="checkmark-circle" size={16} color={GREEN} />
                        <Text style={styles.selectedScheduleValue}>
                          {bookingDate} · {startTimeLabel}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {scheduleNotice && !weatherClosed && !dayBooked ? (
                    <View style={styles.noticeCard}>
                      <Ionicons name="alert-circle-outline" size={16} color={WARN} />
                      <Text style={styles.noticeText}>{scheduleNotice}</Text>
                    </View>
                  ) : null}

                  <View style={[styles.field, formLocked && styles.formLocked]} pointerEvents={formLocked ? 'none' : 'auto'}>
                    <FieldLabel icon="location" label="Destination" required />
                    {rentalDestinations.length === 0 ? (
                      <View style={styles.noticeCard}>
                        <Ionicons name="alert-circle-outline" size={16} color={WARN} />
                        <Text style={styles.noticeText}>
                          This boat has no assigned rental destinations yet.
                        </Text>
                      </View>
                    ) : (
                      <>
                        {rentalDestinations.map((item) => {
                          const selected = destination === item.destination;
                          return (
                            <Pressable
                              key={item.id}
                              onPress={() => {
                                setDestination(item.destination);
                                setError('');
                              }}>
                              <DestinationPriceCard item={item} selected={selected} />
                            </Pressable>
                          );
                        })}
                      </>
                    )}
                  </View>

                  <View style={[styles.field, formLocked && styles.formLocked]} pointerEvents={formLocked ? 'none' : 'auto'}>
                    <FieldLabel icon="people" label="Number of Passengers" required />
                    <View style={[styles.stepper, { borderColor: colors.border, backgroundColor: colors.card }]}>
                      <Pressable
                        onPress={() => changePassengers(-1)}
                        style={({ pressed }) => [styles.stepBtn, { backgroundColor: colors.iconBg }, pressed && styles.pressed]}>
                        <Ionicons name="remove" size={18} color={colors.blue} />
                      </Pressable>
                      <Text style={[styles.stepValue, { color: colors.navy }]}>{passengers}</Text>
                      <Pressable
                        onPress={() => changePassengers(1)}
                        style={({ pressed }) => [styles.stepBtn, { backgroundColor: colors.iconBg }, pressed && styles.pressed]}>
                        <Ionicons name="add" size={18} color={colors.blue} />
                      </Pressable>
                      <Text style={[styles.stepHint, { color: colors.muted }]}>
                        Max {boat.capacity} passengers
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.field, formLocked && styles.formLocked]} pointerEvents={formLocked ? 'none' : 'auto'}>
                    <FieldLabel icon="call" label="Contact Number" required />
                    <View
                      collapsable={false}
                      ref={(node) => {
                        fieldRefs.current.contact = node;
                      }}
                      style={[
                        styles.inputWrap,
                        {
                          backgroundColor: focusedField === 'contact' ? fieldBgFocus : fieldBg,
                          borderColor: focusedField === 'contact' ? colors.blue : isDark ? colors.border : INPUT_BORDER,
                        },
                      ]}>
                      <Ionicons
                        name="call"
                        size={18}
                        color={colors.blue}
                      />
                      <TextInput
                        value={contactNumber}
                        onChangeText={setContactNumber}
                        editable={!formLocked}
                        onFocus={() => handleFieldFocus('contact')}
                        onBlur={handleFieldBlur}
                        placeholder="09XXXXXXXXX"
                        placeholderTextColor={placeholderColor}
                        keyboardType="phone-pad"
                        autoComplete="off"
                        importantForAutofill="no"
                        selectionColor={colors.blue}
                        cursorColor={colors.blue}
                        underlineColorAndroid="transparent"
                        style={[styles.input, { color: typedColor, backgroundColor: 'transparent' }]}
                      />
                    </View>
                  </View>

                  <View style={[styles.field, formLocked && styles.formLocked]} pointerEvents={formLocked ? 'none' : 'auto'}>
                    <FieldLabel icon="flag" label="Pickup / Meeting Point" required />
                    <View
                      collapsable={false}
                      ref={(node) => {
                        fieldRefs.current.pickup = node;
                      }}
                      style={[
                        styles.inputWrap,
                        {
                          backgroundColor: focusedField === 'pickup' ? fieldBgFocus : fieldBg,
                          borderColor: focusedField === 'pickup' ? colors.blue : isDark ? colors.border : INPUT_BORDER,
                        },
                      ]}>
                      <Ionicons name="flag" size={18} color={colors.blue} />
                      <TextInput
                        value={pickupPoint}
                        onChangeText={setPickupPoint}
                        editable={!formLocked}
                        onFocus={() => handleFieldFocus('pickup')}
                        onBlur={handleFieldBlur}
                        placeholder="Type pickup or meeting point"
                        placeholderTextColor={placeholderColor}
                        autoCapitalize="words"
                        importantForAutofill="no"
                        selectionColor={colors.blue}
                        cursorColor={colors.blue}
                        underlineColorAndroid="transparent"
                        style={[styles.input, { color: typedColor, backgroundColor: 'transparent' }]}
                      />
                    </View>
                  </View>

                  <View style={[styles.field, formLocked && styles.formLocked]} pointerEvents={formLocked ? 'none' : 'auto'}>
                    <FieldLabel icon="briefcase" label="Purpose of Trip" required />
                    <SelectControl
                      icon="briefcase"
                      value={purposeLabel}
                      placeholder="Select purpose"
                      disabled={formLocked}
                      onPress={() => setPicker('purpose')}
                    />
                    {purpose === OTHER_PURPOSE ? (
                      <View
                        collapsable={false}
                        ref={(node) => {
                          fieldRefs.current.purpose = node;
                        }}
                        style={[
                          styles.inputWrap,
                          styles.otherPurposeWrap,
                          {
                            backgroundColor: focusedField === 'purpose' ? fieldBgFocus : fieldBg,
                            borderColor: focusedField === 'purpose' ? colors.blue : isDark ? colors.border : INPUT_BORDER,
                          },
                        ]}>
                        <Ionicons name="create" size={18} color={colors.blue} />
                        <TextInput
                          value={customPurpose}
                          onChangeText={setCustomPurpose}
                          editable={!formLocked}
                          onFocus={() => handleFieldFocus('purpose')}
                          onBlur={handleFieldBlur}
                          placeholder="Specify purpose of trip"
                          placeholderTextColor={placeholderColor}
                          importantForAutofill="no"
                          selectionColor={colors.blue}
                          cursorColor={colors.blue}
                          underlineColorAndroid="transparent"
                          style={[styles.input, { color: typedColor, backgroundColor: 'transparent' }]}
                        />
                      </View>
                    ) : null}
                  </View>

                  <View style={[styles.field, styles.lastField, formLocked && styles.formLocked]} pointerEvents={formLocked ? 'none' : 'auto'}>
                    <FieldLabel icon="document-text" label="Additional Notes" />
                    <View
                      collapsable={false}
                      ref={(node) => {
                        fieldRefs.current.notes = node;
                      }}
                      style={[
                        styles.inputWrap,
                        styles.notesWrap,
                        {
                          backgroundColor: focusedField === 'notes' ? fieldBgFocus : fieldBg,
                          borderColor: focusedField === 'notes' ? colors.blue : isDark ? colors.border : INPUT_BORDER,
                        },
                      ]}>
                      <TextInput
                        value={remarks}
                        onChangeText={setRemarks}
                        editable={!formLocked}
                        onFocus={() => handleFieldFocus('notes')}
                        onBlur={handleFieldBlur}
                        placeholder="Enter additional notes (optional)"
                        placeholderTextColor={placeholderColor}
                        multiline
                        importantForAutofill="no"
                        selectionColor={colors.blue}
                        cursorColor={colors.blue}
                        underlineColorAndroid="transparent"
                        style={[styles.input, styles.notesInput, { color: typedColor, backgroundColor: 'transparent' }]}
                      />
                    </View>
                  </View>

                  {selectedDestination && !formLocked ? <PaymentSummary item={selectedDestination} /> : null}

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  <Pressable
                    disabled={
                      submitting ||
                      availabilityLoading ||
                      !startTime ||
                      formLocked ||
                      Boolean(availability && !availability.day_available && availability.weather_tone !== 'yellow')
                    }
                    onPress={handleConfirm}
                    style={({ pressed }) => [
                      styles.submitBtn,
                      { backgroundColor: colors.blue },
                      pressed && styles.pressed,
                      (submitting ||
                        availabilityLoading ||
                        !startTime ||
                        formLocked ||
                        Boolean(availability && !availability.day_available && availability.weather_tone !== 'yellow')) &&
                        styles.submitDisabled,
                    ]}>
                    {submitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitText}>Confirm Rental</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <TripCalendarModal
        open={calendarOpen}
        selected={bookingDate}
        weatherDates={dayHolds}
        onVisibleDates={loadDayHolds}
        onClose={() => setCalendarOpen(false)}
        onSelect={(value) => {
          setSlotNotice('');
          setError('');
          setBookingDate(value);
        }}
      />

      <Modal
        visible={picker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}>
        <View style={styles.pickerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPicker(null)} />
          <View
            style={[
              styles.pickerSheet,
              { backgroundColor: colors.card, paddingBottom: 16 + insets.bottom },
            ]}>
            <Text style={[styles.pickerTitle, { color: colors.navy }]}>
              Select Purpose of Trip
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {TRIP_PURPOSES.map((option) => {
                const selected = purpose === option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      setPurpose(option.value);
                      if (option.value !== OTHER_PURPOSE) {
                        setCustomPurpose('');
                      }
                      setError('');
                      setPicker(null);
                    }}
                    style={[
                      styles.purposeOption,
                      {
                        backgroundColor: isDark ? colors.iconBg : '#F3F7FF',
                        borderColor: selected ? colors.blue : 'transparent',
                      },
                      selected && { backgroundColor: isDark ? '#243B63' : '#E4EEFF' },
                    ]}>
                    <View style={[styles.purposeIconWrap, { backgroundColor: colors.card }]}>
                      <Ionicons name={option.icon} size={22} color={colors.blue} />
                    </View>
                    <View style={styles.purposeCopy}>
                      <Text style={[styles.purposeTitle, { color: colors.navy }]}>{option.value}</Text>
                      <Text style={[styles.purposeHint, { color: colors.muted }]}>{option.hint}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PAGE,
  },
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 36,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginTop: 4,
    marginLeft: -8,
  },
  title: {
    marginTop: 6,
    color: NAVY,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 16,
    color: MUTED,
    fontSize: 14,
  },
  loader: {
    marginTop: 24,
  },
  empty: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 18,
  },
  headerBlock: {
    marginBottom: 12,
  },
  boatName: {
    color: NAVY,
    fontSize: 22,
    fontWeight: '800',
  },
  boatCode: {
    color: MUTED,
    fontSize: 13,
    marginTop: 2,
  },
  available: {
    marginTop: 6,
    color: GREEN,
    fontSize: 12,
    fontWeight: '700',
  },
  specsCard: {
    marginTop: 12,
    backgroundColor: CARD,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  specIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  specItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    paddingRight: 8,
  },
  specCopy: {
    flex: 1,
  },
  specLabel: {
    color: MUTED,
    fontSize: 11,
  },
  specValue: {
    marginTop: 2,
    color: NAVY,
    fontSize: 13,
    fontWeight: '700',
  },
  safetyCard: {
    marginTop: 12,
    marginBottom: 18,
    backgroundColor: CARD,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  safetyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  safetyTitle: {
    color: NAVY,
    fontSize: 14,
    fontWeight: '800',
  },
  safetyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  safetyCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyText: {
    color: NAVY,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    color: NAVY,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  formCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginTop: 4,
  },
  bookedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#DCEBFF',
    borderWidth: 1,
    borderColor: '#9EC0F5',
  },
  bookedTitle: {
    color: BLUE,
    fontSize: 13,
    fontWeight: '800',
  },
  bookedBody: {
    marginTop: 2,
    color: '#1B3A73',
    fontSize: 12,
    lineHeight: 17,
  },
  selectedSchedule: {
    marginTop: 12,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectedScheduleLabel: {
    color: '#A7B4C7',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  selectedScheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedScheduleValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  field: {
    marginTop: 14,
  },
  lastField: {
    marginBottom: 4,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  fieldLabelText: {
    color: NAVY,
    fontSize: 15,
    fontWeight: '800',
  },
  requiredStar: {
    color: '#E11D48',
    fontSize: 15,
    fontWeight: '800',
  },
  selectWrap: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: INPUT_BORDER,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  selectDisabled: {
    opacity: 0.55,
  },
  selectValue: {
    flex: 1,
    color: NAVY,
    fontSize: 15,
    fontWeight: '600',
  },
  selectPlaceholder: {
    color: PLACEHOLDER,
    fontWeight: '500',
  },
  destinationCard: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: '#EAF2FF',
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  destinationCardSelected: {
    borderColor: BLUE,
    backgroundColor: '#DCEBFF',
  },
  destinationCardCopy: {
    flex: 1,
    minWidth: 0,
  },
  destinationCardName: {
    color: NAVY,
    fontSize: 15,
    fontWeight: '800',
  },
  destinationPrice: {
    color: BLUE,
    fontSize: 16,
    fontWeight: '800',
  },
  destinationPriceHint: {
    marginTop: 3,
    color: MUTED,
    fontSize: 11,
  },
  summaryCard: {
    marginTop: 4,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  summaryNote: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 15,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: '70%',
  },
  pickerSheetTall: {
    maxHeight: '82%',
  },
  pickerTitle: {
    color: NAVY,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  pickerOption: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerOptionActive: {
    backgroundColor: '#EEF4FF',
  },
  purposeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: '#F3F7FF',
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  purposeOptionActive: {
    backgroundColor: '#E4EEFF',
    borderColor: BLUE,
  },
  purposeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  purposeCopy: {
    flex: 1,
  },
  purposeTitle: {
    color: NAVY,
    fontSize: 15,
    fontWeight: '800',
  },
  purposeHint: {
    marginTop: 2,
    color: MUTED,
    fontSize: 12,
  },
  otherPurposeWrap: {
    marginTop: 10,
  },
  pickerOptionText: {
    color: NAVY,
    fontSize: 15,
    fontWeight: '600',
  },
  pickerOptionTextActive: {
    color: BLUE,
  },
  manifestCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
    marginBottom: 10,
  },
  manifestTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  manifestRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  ageWrap: {
    width: 72,
    paddingHorizontal: 10,
  },
  genderWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  genderChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  genderText: {
    fontSize: 12,
    fontWeight: '700',
  },
  label: {
    marginBottom: 6,
    color: NAVY,
    fontSize: 15,
    fontWeight: '700',
  },
  selectedDate: {
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '700',
  },
  chipRow: {
    gap: 8,
    paddingBottom: 8,
  },
  dateChip: {
    width: 64,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D5DDEA',
    backgroundColor: CARD,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dateChipWeather: {
    backgroundColor: '#FDECEC',
    borderColor: '#E25C5C',
  },
  dateChipWatch: {
    backgroundColor: '#FFF7E0',
    borderColor: '#F6C453',
  },
  dateChipWeatherActive: {
    backgroundColor: '#C53030',
    borderColor: '#C53030',
  },
  calendarChip: {
    width: 64,
    justifyContent: 'center',
    gap: 4,
  },
  calendarChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  dateWeek: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '600',
  },
  dateDay: {
    color: NAVY,
    fontSize: 18,
    fontWeight: '800',
  },
  dateMonth: {
    color: MUTED,
    fontSize: 11,
  },
  timeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeGroup: {
    marginBottom: 10,
  },
  timeGroupTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  timeLoader: {
    marginBottom: 14,
    alignSelf: 'flex-start',
  },
  timeTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeTypeInput: {
    width: 64,
    height: 50,
    borderWidth: 1.5,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
  },
  timeTypeColon: { fontSize: 22, fontWeight: '800' },
  meridiemWrap: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderRadius: 12,
    overflow: 'hidden',
    marginLeft: 4,
  },
  meridiemBtn: {
    height: 47,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meridiemText: { fontSize: 15, fontWeight: '800' },
  timeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D5DDEA',
    backgroundColor: CARD,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  timeChipUnavailable: {
    backgroundColor: '#F1F3F7',
    borderColor: '#E2E6EE',
  },
  timeChipWeatherHold: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F3B4B4',
  },
  timeTextWeatherHold: {
    color: '#E25C5C',
    textDecorationLine: 'none',
  },
  holdBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#FDECEC',
    borderWidth: 1,
    borderColor: '#F3B4B4',
  },
  holdCopy: {
    flex: 1,
  },
  holdTitle: {
    color: '#C53030',
    fontSize: 13,
    fontWeight: '800',
  },
  holdBody: {
    marginTop: 2,
    color: '#E25C5C',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  formLocked: {
    opacity: 0.45,
  },
  timeText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
  },
  timeTextUnavailable: {
    color: '#5B6578',
    textDecorationLine: 'line-through',
  },
  timeUnavailableLabel: {
    marginTop: 2,
    color: '#5B6578',
    fontSize: 10,
    fontWeight: '700',
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#FFF4F0',
    borderWidth: 1,
    borderColor: '#F5C7B8',
  },
  noticeText: {
    flex: 1,
    color: WARN,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  hintText: {
    marginBottom: 10,
    color: MUTED,
    fontSize: 12,
    lineHeight: 17,
  },
  chipActive: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  inputWrap: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: INPUT_BORDER,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  inputWrapFocused: {
    borderWidth: 2,
    borderColor: BLUE,
    backgroundColor: '#EEF4FF',
  },
  input: {
    flex: 1,
    height: 48,
    color: NAVY,
    fontSize: 15,
  },
  notesWrap: {
    minHeight: 88,
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  notesInput: {
    height: 72,
    textAlignVertical: 'top',
  },
  stepper: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: INPUT_BORDER,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#F3F7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    minWidth: 28,
    color: NAVY,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  stepHint: {
    marginLeft: 'auto',
    color: MUTED,
    fontSize: 12,
  },
  errorText: {
    marginBottom: 12,
    color: '#D64545',
    fontSize: 13,
    textAlign: 'center',
  },
  submitBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
