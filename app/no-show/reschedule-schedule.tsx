import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TripCalendarModal, formatTripDate, fromYmd, toYmd } from '@/components/trip-calendar-modal';
import { ApiError } from '@/lib/api';
import { fetchBoatAvailability } from '@/lib/boats';
import { resolveMediaUrl } from '@/lib/config';
import { submitNoShowRescheduleRequest } from '@/lib/no-show';
import { useAppTheme } from '@/lib/theme';
import type { BoatTimeSlot } from '@/lib/types';
import { fetchDayHolds, type DayWeatherMark } from '@/lib/weather';

const BLUE = '#1A5AD7';
const RED = '#E25C5C';

function upcomingDates(count = 7) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return dateChip(toYmd(date));
  });
}

function dateChip(value: string) {
  const date = fromYmd(value);
  return {
    value,
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
    day: String(date.getDate()),
    month: date.toLocaleDateString('en-US', { month: 'short' }),
  };
}

export default function RescheduleScheduleScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const params = useLocalSearchParams<{
    bookingId?: string;
    boatId?: string;
    boatName?: string;
    boatCode?: string;
    boatPicture?: string;
    priceLabel?: string;
    capacity?: string;
    date?: string;
    time?: string;
  }>();
  const bookingId = Number(params.bookingId);
  const boatId = Number(params.boatId);
  const dates = useMemo(() => upcomingDates(), []);
  const [selectedDate, setSelectedDate] = useState(params.date || dates[0]?.value || '');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [times, setTimes] = useState<BoatTimeSlot[]>([]);
  const [dayAvailable, setDayAvailable] = useState(true);
  const [dayReason, setDayReason] = useState<string | null>(null);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dayHolds, setDayHolds] = useState<Record<string, DayWeatherMark>>({});
  const holdDatesFetched = useRef<Set<string>>(new Set());

  const visibleDates = useMemo(() => {
    if (!dates.some((item) => item.value === selectedDate)) {
      return [...dates, dateChip(selectedDate)];
    }
    return dates;
  }, [dates, selectedDate]);

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
    if (!boatId || !selectedDate) {
      return;
    }
    let cancelled = false;
    setLoadingTimes(true);
    setSelectedTime(null);
    void fetchBoatAvailability(boatId, selectedDate)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setTimes(payload.times ?? []);
        const preferred = (payload.times ?? []).find(
          (slot) => selectedDate === params.date && slot.value === params.time && slot.available,
        );
        if (preferred) {
          setSelectedTime(preferred.value);
        }
        setDayAvailable(payload.day_available !== false && payload.weather_tone !== 'red');
        setDayReason(payload.day_reason);
        if (payload.weather_tone === 'red') {
          setDayHolds((current) => ({
            ...current,
            [selectedDate]: {
              tone: 'red',
              reason: payload.day_reason || 'Weather hold',
              canBook: false,
              kind: 'weather',
            },
          }));
        } else if (payload.day_booked || payload.day_available === false) {
          setDayHolds((current) => ({
            ...current,
            [selectedDate]: {
              tone: 'blue',
              reason: payload.day_reason || 'This boat is already booked that day.',
              canBook: false,
              kind: 'booked',
            },
          }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTimes([]);
          setDayAvailable(false);
          setDayReason('Could not check this date.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingTimes(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [boatId, selectedDate]);

  const dayMark = dayHolds[selectedDate];
  const weatherHold = dayMark?.tone === 'red';
  const dayBooked = Boolean(weatherHold || dayMark?.tone === 'blue' || !dayAvailable);
  const canSubmit = Boolean(selectedTime && !submitting && !dayBooked);

  async function submit() {
    if (!bookingId || !boatId || !selectedDate || !selectedTime || dayBooked) {
      return;
    }
    setSubmitting(true);
    try {
      await submitNoShowRescheduleRequest(bookingId, {
        boat_id: boatId,
        booking_date: selectedDate,
        start_time: selectedTime,
      });
      router.replace({
        pathname: '/no-show/reschedule-submitted',
        params: {
          bookingId: String(bookingId),
          boatName: params.boatName ?? '',
          boatCode: params.boatCode ?? '',
          date: selectedDate,
          time: selectedTime,
        },
      });
    } catch (err) {
      Alert.alert(
        'Could not submit',
        err instanceof ApiError ? err.firstError() : 'Please pick another schedule.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.page }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable hitSlop={8} onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.navy} />
        </Pressable>
        <Text style={[styles.title, { color: colors.navy }]}>Pick a new date</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.boatCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Image
            source={{ uri: resolveMediaUrl(params.boatPicture || null) }}
            style={styles.photo}
            contentFit="cover"
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.boatName, { color: colors.navy }]}>
              {params.boatName} ({params.boatCode})
            </Text>
            <Text style={{ color: colors.muted }}>
              {params.capacity} passengers · {params.priceLabel}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>
              Down payment stays. No extra pay.
            </Text>
          </View>
        </View>

        <Text style={[styles.section, { color: colors.navy }]}>Preferred date</Text>
        <Text style={[styles.selectedDate, { color: colors.blue }]}>
          {selectedDate ? formatTripDate(selectedDate) : 'Pick a date'}
        </Text>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          {visibleDates.map((item) => {
            const active = item.value === selectedDate;
            const booked =
              dayHolds[item.value]?.tone === 'blue' || dayHolds[item.value]?.tone === 'red';
            const watch = dayHolds[item.value]?.tone === 'yellow';
            return (
              <Pressable
                key={item.value}
                onPress={() => setSelectedDate(item.value)}
                style={[
                  styles.dateChip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  booked && styles.dateChipBooked,
                  watch && !booked && styles.dateChipWatch,
                  active && !booked && { backgroundColor: colors.blue, borderColor: colors.blue },
                  active && booked && styles.dateChipBookedActive,
                ]}>
                {booked ? <View style={styles.bookedDot} /> : null}
                <Text
                  style={[
                    styles.dateWeek,
                    { color: booked ? RED : watch ? '#B45309' : colors.muted },
                    active && !booked && styles.chipTextActive,
                  ]}>
                  {item.weekday}
                </Text>
                <Text
                  style={[
                    styles.dateDay,
                    { color: booked ? RED : watch ? '#B45309' : colors.navy },
                    active && !booked && styles.chipTextActive,
                  ]}>
                  {item.day}
                </Text>
                <Text
                  style={[
                    styles.dateMonth,
                    { color: booked ? RED : watch ? '#B45309' : colors.muted },
                    active && !booked && styles.chipTextActive,
                  ]}>
                  {item.month}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open calendar"
            onPress={() => setCalendarOpen(true)}
            style={[styles.dateChip, styles.calendarChip, { backgroundColor: colors.iconBg, borderColor: colors.blue }]}>
            <Ionicons name="calendar-outline" size={18} color={colors.blue} />
            <Text style={[styles.calendarChipText, { color: colors.blue }]}>Calendar</Text>
          </Pressable>
        </ScrollView>
        <Text style={[styles.hint, { color: colors.muted }]}>
          Red circle = this boat is already booked that day. Need a later date? Open Calendar.
        </Text>

        {dayBooked ? (
          <View style={[styles.holdBanner, { backgroundColor: isDark ? '#3A2224' : '#FDECEC' }]}>
            <Ionicons name="close-circle" size={18} color={RED} />
            <View style={{ flex: 1 }}>
              <Text style={styles.holdTitle}>This boat is booked on this day</Text>
              <Text style={[styles.holdBody, { color: isDark ? '#F8D0D0' : '#7A2E2E' }]}>
                {dayReason || dayMark?.reason || 'Pick another date. Your down payment stays.'}
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={[styles.section, { color: colors.navy }]}>Time</Text>
        {loadingTimes ? (
          <ActivityIndicator color={BLUE} />
        ) : dayBooked ? (
          <Text style={[styles.hint, { color: colors.muted }]}>No open times on this booked day.</Text>
        ) : (
          <View style={styles.timeGrid}>
            {times.map((slot) => {
              const active = selectedTime === slot.value;
              const disabled = !slot.available;
              return (
                <Pressable
                  key={slot.value}
                  disabled={disabled}
                  onPress={() => setSelectedTime(slot.value)}
                  style={[
                    styles.timeChip,
                    {
                      borderColor: disabled ? RED : active ? colors.blue : colors.border,
                      backgroundColor: disabled
                        ? isDark
                          ? '#3A2224'
                          : '#FDECEC'
                        : active
                          ? colors.blue
                          : colors.card,
                    },
                  ]}>
                  <Text
                    style={{
                      color: disabled ? RED : active ? '#FFFFFF' : colors.navy,
                      fontWeight: '700',
                      fontSize: 13,
                    }}>
                    {slot.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          disabled={!canSubmit}
          onPress={() => void submit()}
          style={[styles.primaryBtn, !canSubmit && { opacity: 0.55 }]}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>Ask for this new date</Text>
          )}
        </Pressable>
      </ScrollView>

      <TripCalendarModal
        open={calendarOpen}
        selected={selectedDate}
        weatherDates={dayHolds}
        onClose={() => setCalendarOpen(false)}
        onSelect={setSelectedDate}
        onVisibleDates={loadDayHolds}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 8 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', flex: 1 },
  body: { padding: 16, gap: 12, paddingBottom: 36 },
  boatCard: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 16, padding: 10, alignItems: 'center' },
  photo: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#E8F1FF' },
  boatName: { fontWeight: '800', fontSize: 16 },
  section: { fontWeight: '800', fontSize: 15, marginTop: 4 },
  selectedDate: { fontSize: 13, fontWeight: '700', marginTop: -6 },
  chipRow: { gap: 8, paddingBottom: 4 },
  dateChip: {
    width: 64,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  dateChipBooked: {
    backgroundColor: '#FDECEC',
    borderColor: RED,
  },
  dateChipBookedActive: {
    backgroundColor: '#C53030',
    borderColor: '#C53030',
  },
  dateChipWatch: {
    backgroundColor: '#FFF7E0',
    borderColor: '#F6C453',
  },
  bookedDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RED,
  },
  calendarChip: {
    justifyContent: 'center',
    gap: 4,
    minHeight: 72,
  },
  calendarChipText: { fontSize: 11, fontWeight: '800' },
  dateWeek: { fontSize: 11, fontWeight: '600' },
  dateDay: { fontSize: 18, fontWeight: '800' },
  dateMonth: { fontSize: 11 },
  chipTextActive: { color: '#FFFFFF' },
  hint: { fontSize: 12, lineHeight: 17 },
  holdBanner: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 14,
    padding: 12,
    alignItems: 'flex-start',
  },
  holdTitle: { color: '#C53030', fontWeight: '800', fontSize: 14 },
  holdBody: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minWidth: '30%',
    alignItems: 'center',
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: BLUE,
    borderRadius: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
