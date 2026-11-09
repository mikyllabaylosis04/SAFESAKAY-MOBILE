import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLockup } from '@/components/brand-lockup';
import { LoadError } from '@/components/load-error';
import { friendlyError } from '@/lib/api';
import { PassengerTabs } from '@/components/passenger-tabs';
import { NotificationBell } from '@/components/notification-bell';
import { BoatWaveCarousel } from '@/components/rental-boat-card';
import { PickerSheet } from '@/components/picker-sheet';
import { ServiceAreaPicker } from '@/components/service-area-picker';
import { SideMenu } from '@/components/side-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { fetchCurrentUser, getStoredUser } from '@/lib/auth';
import { WeatherAlert } from '@/components/weather-alert';
import {
  dashboardReminderNotices,
  isAnnouncementNotice,
  isFreshAnnouncement,
  isWeatherDashboardNotice,
  latestActiveWeatherNotice,
  toDashboardAnnouncement,
  type DashboardAnnouncement,
} from '@/lib/announcements';
import { fetchRentalBoats } from '@/lib/boats';
import { fetchBookings } from '@/lib/bookings';
import { resolveMediaUrl } from '@/lib/config';
import { subscribeNotifications } from '@/lib/notification-watch';
import { getPinnedAnnouncements } from '@/lib/session';
import {
  organizationAllowsOperations,
  organizationDisplayName,
  organizationStatusLabel,
} from '@/lib/organization-access';
import { useAppTheme } from '@/lib/theme';
import type { AuthUser, Boat, MobileBooking, RentalDestination } from '@/lib/types';
import {
  affectedBookingForAlert,
  fetchSeaAlerts,
  toYmd,
  weatherCopy,
  type SeaAlert,
} from '@/lib/weather';

const BLUE = '#1A5AD7';
const NAVY = '#1B2744';
const MUTED = '#3F4A63';
const GREEN = '#1FA971';
const ORANGE = '#F07A3A';
const VIOLET = '#7A5AF8';
const CARD = '#FFFFFF';
const PAGE = '#F3F6FB';
const ICON_BG = '#D7E8FB';

const IMAGES = {
  hero: 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1200&q=80',
  trip: 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=800&q=80',
  boatA: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
  boatB: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80',
  recentA: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=800&q=80',
  recentB: 'https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?w=800&q=80',
};

const BEST_FOR = [
  { label: 'Island Hopping', purpose: 'Island hopping', render: (color: string) => <MaterialCommunityIcons name="island" size={24} color={color} /> },
  { label: 'Swimming', purpose: 'Mangaligo', render: (color: string) => <FontAwesome5 name="swimmer" size={20} color={color} /> },
  { label: 'Family Group', purpose: 'Family outing', render: (color: string) => <Ionicons name="people-outline" size={22} color={color} /> },
  { label: 'Special Events', purpose: 'Leisure', render: (color: string) => <Ionicons name="calendar-outline" size={22} color={color} /> },
  { label: 'Direct Travel', purpose: 'Transport', render: (color: string) => <Ionicons name="location-outline" size={22} color={color} /> },
];

const HOW_IT_WORKS = [
  {
    icon: 'boat-outline' as const,
    title: 'Choose Boat',
    text: 'Browse and select your preferred boat.',
  },
  {
    icon: 'calendar-outline' as const,
    title: 'Choose Schedule',
    text: 'Pick your date, time and route.',
  },
  {
    icon: 'document-text-outline' as const,
    title: 'Confirm Rental',
    text: 'Review your details and confirm.',
  },
  {
    icon: 'sunny-outline' as const,
    title: 'Enjoy Your Trip',
    text: 'Relax and enjoy your safe journey.',
  },
];

function SectionHeader({ title, onViewAll }: { title: string; onViewAll?: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.navy }]}>{title}</Text>
      <Pressable hitSlop={8} onPress={onViewAll}>
        <Text style={[styles.viewAll, { color: colors.blue }]}>View all</Text>
      </Pressable>
    </View>
  );
}

function WavingHand() {
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const swing = (toValue: number, duration: number) =>
      Animated.timing(rotate, {
        toValue,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      });

    const wave = Animated.loop(
      Animated.sequence([
        swing(1, 140),
        swing(-0.85, 140),
        swing(0.95, 130),
        swing(-0.55, 130),
        swing(0.7, 140),
        swing(0, 180),
        Animated.delay(1600),
      ]),
    );
    wave.start();
    return () => wave.stop();
  }, [rotate]);

  return (
    <Animated.Text
      style={[
        styles.waveHand,
        {
          transform: [
            {
              rotate: rotate.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: ['-22deg', '0deg', '26deg'],
              }),
            },
          ],
        },
      ]}>
      👋
    </Animated.Text>
  );
}

function formatPeso(value: number) {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const HOME_DESTINATION_LIMIT = 4;

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type AreaDestination = {
  name: string;
  origin?: string | null;
  priceLabel: string;
  boatIds: number[];
};

function destinationsForArea(boats: Boat[]): AreaDestination[] {
  const grouped = new Map<string, { name: string; origin?: string | null; prices: number[]; labels: string[]; boatIds: number[] }>();

  boats.forEach((boat) => {
    (boat.rental_destinations ?? []).forEach((item: RentalDestination) => {
      const name = item.destination?.trim();
      if (!name) {
        return;
      }

      const key = name.toLowerCase();
      const current = grouped.get(key) ?? { name, origin: item.origin, prices: [], labels: [], boatIds: [] };
      if (item.origin && !current.origin) {
        current.origin = item.origin;
      }
      if (typeof item.rental_price === 'number') {
        current.prices.push(item.rental_price);
      }
      if (item.rental_price_label) {
        current.labels.push(item.rental_price_label);
      }
      if (!current.boatIds.includes(boat.id)) {
        current.boatIds.push(boat.id);
      }
      grouped.set(key, current);
    });
  });

  return [...grouped.values()]
    .map((item) => {
      const min = item.prices.length ? Math.min(...item.prices) : null;
      const max = item.prices.length ? Math.max(...item.prices) : null;
      const priceLabel =
        min != null && max != null && min !== max
          ? `from ${formatPeso(min)}`
          : min != null
            ? formatPeso(min)
            : item.labels[0] || '—';

      return {
        name: item.name,
        origin: item.origin,
        priceLabel,
        boatIds: item.boatIds,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function rentalStatus(booking: MobileBooking) {
  if (booking.status === 'approved') {
    return { label: 'Approved', color: GREEN, bg: '#E7F8EF' };
  }
  if (booking.status === 'pending') {
    return { label: 'Pending', color: ORANGE, bg: '#FDE8DC' };
  }
  if (booking.status === 'cancelled') {
    return { label: 'Cancelled', color: '#E25C5C', bg: '#FDECEC' };
  }
  if (booking.status === 'weather_hold') {
    return { label: 'Weather hold', color: '#E25C5C', bg: '#FDECEC' };
  }
  if (booking.status === 'reschedule_pending') {
    return { label: 'Reschedule', color: VIOLET, bg: '#EEE8FF' };
  }
  return { label: 'Completed', color: GREEN, bg: '#E7F8EF' };
}

export default function HomePage() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [rentalBoats, setRentalBoats] = useState<Boat[]>([]);
  const [bookings, setBookings] = useState<MobileBooking[]>([]);
  const [seaAlerts, setSeaAlerts] = useState<SeaAlert[]>([]);
  const [dashboardNotices, setDashboardNotices] = useState<DashboardAnnouncement[]>([]);
  const orgActive = organizationAllowsOperations(user);

  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(() => {
    getStoredUser().then(setUser);
    fetchCurrentUser().then(setUser);
    fetchSeaAlerts()
      .then(setSeaAlerts)
      .catch(() => setSeaAlerts([]));
    getPinnedAnnouncements()
      .then((items) =>
        setDashboardNotices(
          items.filter(
            (item) => isWeatherDashboardNotice(item) || isFreshAnnouncement(item.created_at),
          ),
        ),
      )
      .catch(() => undefined);

    return Promise.allSettled([
      fetchRentalBoats().then(setRentalBoats),
      fetchBookings().then(setBookings),
    ]).then((results) => {
      const failed = results.find((result) => result.status === 'rejected');
      setLoadError(failed && failed.status === 'rejected' ? friendlyError(failed.reason) : '');
      setRefreshing(false);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    return subscribeNotifications((list) => {
      const incoming = list.data.filter(isAnnouncementNotice);
      const weatherActive = latestActiveWeatherNotice(incoming);
      const mapped = incoming
        .filter((item) => !weatherActive || !isWeatherDashboardNotice(item) || item.id === weatherActive.id)
        .filter((item) => weatherActive || !isWeatherDashboardNotice(item))
        .filter((item) => isWeatherDashboardNotice(item) || isFreshAnnouncement(item.created_at))
        .map(toDashboardAnnouncement);
      setDashboardNotices((current) => {
        const kept = weatherActive ? current : current.filter((item) => !isWeatherDashboardNotice(item));
        const unique = new Map([...mapped, ...kept].map((item) => [item.id, item]));
        return [...unique.values()].slice(0, 4);
      });
    });
  }, []);

  function openRental(
    target:
      | '/boats'
      | { pathname: '/boats'; params: { purpose?: string; destination?: string } }
      | { pathname: '/rent-boat'; params: { id: string } },
  ) {
    if (!organizationAllowsOperations(user)) {
      router.push('/organization-unavailable');
      return;
    }
    router.push(target);
  }

  const upcoming = useMemo(() => {
    return (
      bookings
        .filter(
          (item) =>
            item.status === 'pending' ||
            item.status === 'approved' ||
            item.status === 'weather_hold' ||
            item.status === 'reschedule_pending',
        )
        .slice()
        .sort(
          (a, b) =>
            a.booking_date.localeCompare(b.booking_date) || a.start_time.localeCompare(b.start_time),
        )[0] ?? null
    );
  }, [bookings]);
  const recentRentals = useMemo(
    () => bookings.filter((item) => item.id !== upcoming?.id).slice(0, 2),
    [bookings, upcoming],
  );
  const areaDestinations = useMemo(() => destinationsForArea(rentalBoats), [rentalBoats]);
  const [destinationsOpen, setDestinationsOpen] = useState(false);

  function openDestination(item: AreaDestination) {
    if (item.boatIds.length === 1) {
      openRental({ pathname: '/rent-boat', params: { id: String(item.boatIds[0]) } });
      return;
    }
    openRental({ pathname: '/boats', params: { destination: item.name } });
  }
  const weatherBanner = useMemo(() => {
    const today = toYmd(new Date());
    const todayAlerts = seaAlerts.filter((alert) => alert.date.slice(0, 10) === today);
    const notice =
      todayAlerts.find((alert) => (alert.tone ?? 'red') !== 'yellow') ?? todayAlerts[0] ?? null;
    if (!notice) {
      return null;
    }
    const affected =
      (notice.tone ?? 'red') !== 'yellow' ? affectedBookingForAlert(bookings, today) : null;
    if (affected) {
      return {
        title: 'Reschedule your trip',
        body: `Your rental on ${affected.booking_date_label || notice.dateLabel} cannot sail because of weather. Please reschedule to another date.`,
        tone: 'red' as const,
        actionLabel: 'Reschedule',
        bookingId: affected.id,
      };
    }
    const copy = weatherCopy(notice.date, notice.reason, notice.tone ?? 'red');
    return {
      title: copy.title,
      body: copy.body,
      tone: notice.tone ?? 'red',
      actionLabel: undefined,
      bookingId: null as number | null,
    };
  }, [bookings, seaAlerts]);
  const reminderBanners = useMemo(
    () =>
      dashboardReminderNotices(dashboardNotices, {
        hasActiveWeather: Boolean(weatherBanner),
      }),
    [dashboardNotices, weatherBanner],
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.blue}
              colors={[colors.blue]}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Pressable hitSlop={8} style={styles.headerBtn} onPress={() => setMenuOpen(true)}>
                <Ionicons name="menu-outline" size={26} color={colors.navy} />
              </Pressable>

              <BrandLockup color={colors.blue} />
            </View>

            <View style={styles.headerRight}>
              <ThemeToggle />
              <NotificationBell />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open profile"
                onPress={() => router.push('/profile')}
                style={[styles.avatar, { backgroundColor: colors.blue }]}>
                <Ionicons name="person" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          <View style={styles.welcomeRow}>
            <Text style={[styles.welcome, { color: colors.navy }]}>Welcome !</Text>
            <WavingHand />
          </View>
          <Text style={[styles.welcomeSub, { color: colors.muted }]}>Find and rent the perfect boat for your trip.</Text>

          {loadError ? (
            <LoadError compact offline message={loadError} onRetry={() => void load()} />
          ) : null}

          {orgActive && weatherBanner ? (
            <WeatherAlert
              title={weatherBanner.title}
              body={weatherBanner.body}
              tone={weatherBanner.tone ?? 'red'}
              actionLabel={weatherBanner.actionLabel}
              onAction={
                weatherBanner.bookingId
                  ? () =>
                      router.push({
                        pathname: '/booking-details',
                        params: { id: String(weatherBanner.bookingId) },
                      })
                  : undefined
              }
            />
          ) : null}
          {orgActive
            ? reminderBanners.map((item) => (
                <WeatherAlert key={item.id} title={item.title} body={item.body} tone={item.tone} />
              ))
            : null}

          <ServiceAreaPicker
            key={user?.organization?.id ?? 'none'}
            onChanged={(next) => {
              setUser(next);
              fetchRentalBoats()
                .then(setRentalBoats)
                .catch(() => setRentalBoats([]));
            }}
          />

          {!orgActive ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={[styles.bestTitle, { color: colors.navy }]}>Boat Rental Services Unavailable</Text>
              <Text style={[styles.emptyBoats, { color: colors.muted }]}>
                {organizationDisplayName(user)} is no longer active on SafeSakay. Boat rentals and trip
                services are currently unavailable. Thank you for using SafeSakay.
              </Text>
              <Text style={[styles.unavailableStatus, { color: '#C53030' }]}>
                Organization {organizationStatusLabel(user)}
              </Text>
              <Pressable
                onPress={() => router.push('/organization-unavailable')}
                style={({ pressed }) => [styles.heroButton, { marginTop: 12, alignSelf: 'flex-start' }, pressed && styles.pressed]}>
                <Text style={styles.heroButtonText}>View details</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.hero}>
            <Image source={{ uri: IMAGES.hero }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient
              colors={['rgba(14,84,102,0.92)', 'rgba(14,84,102,0.55)', 'rgba(14,84,102,0.08)']}
              locations={[0, 0.48, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{`Ready for your\nnext adventure ?`}</Text>
              <Text style={styles.heroText}>
                {`Safe , comfortable\nand reliable boat\nrental for your\ntravel.`}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}
                onPress={() => openRental('/boats')}>
                <Text style={styles.heroButtonText}>Rent a Boat Now  →</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.bestCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.bestTitle, { color: colors.navy }]}>Best for</Text>
            <View style={styles.bestRow}>
              {BEST_FOR.map((item) => (
                <Pressable
                  key={item.label}
                  onPress={() => openRental({ pathname: '/boats', params: { purpose: item.purpose } })}
                  style={({ pressed }) => [styles.bestItem, pressed && styles.pressed]}>
                  {item.render(colors.navy)}
                  <Text style={[styles.bestLabel, { color: colors.navy }]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <SectionHeader
              title="Available Destinations"
              onViewAll={() => (areaDestinations.length > 0 ? setDestinationsOpen(true) : openRental('/boats'))}
            />
            {!orgActive ? (
              <Text style={[styles.emptyBoats, { color: colors.muted }]}>
                Rental availability is hidden because this organization is no longer active.
              </Text>
            ) : areaDestinations.length === 0 ? (
              <Text style={[styles.emptyBoats, { color: colors.muted }]}>
                No destinations assigned to boats in this area yet.
              </Text>
            ) : (
              areaDestinations.slice(0, HOME_DESTINATION_LIMIT).map((item, index) => (
                <View key={item.name}>
                  {index > 0 ? <View style={[styles.destDivider, { backgroundColor: colors.border }]} /> : null}
                  <Pressable
                    onPress={() => openDestination(item)}
                    style={({ pressed }) => [styles.destRow, pressed && styles.pressed]}>
                    <View style={[styles.destIcon, { backgroundColor: isDark ? colors.iconBg : ICON_BG }]}>
                      <Ionicons name="location" size={16} color={colors.blue} />
                    </View>
                    <View style={styles.destCopy}>
                      <Text style={[styles.destName, { color: colors.navy }]} numberOfLines={1}>
                        {titleCase(item.name)}
                      </Text>
                      <Text style={[styles.destMeta, { color: colors.muted }]} numberOfLines={1}>
                        {item.origin ? `From ${titleCase(item.origin)}` : 'Whole-boat rental'}
                        {item.boatIds.length > 1 ? ` · ${item.boatIds.length} boats` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.destPrice, { color: colors.blue }]}>{item.priceLabel}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </Pressable>
                </View>
              ))
            )}
            {orgActive && areaDestinations.length > HOME_DESTINATION_LIMIT ? (
              <Pressable
                onPress={() => setDestinationsOpen(true)}
                style={({ pressed }) => [
                  styles.moreDestinations,
                  { borderColor: colors.border, backgroundColor: colors.iconBg },
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.moreDestinationsText, { color: colors.blue }]}>
                  See {areaDestinations.length - HOME_DESTINATION_LIMIT} more destination
                  {areaDestinations.length - HOME_DESTINATION_LIMIT === 1 ? '' : 's'}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.blue} />
              </Pressable>
            ) : null}
          </View>

          <PickerSheet
            visible={destinationsOpen}
            title="Available Destinations"
            subtitle={`${areaDestinations.length} destinations in ${user?.organization?.name ?? 'this service area'}`}
            searchPlaceholder="Search destination or pickup point"
            emptyText="No destination matches your search."
            items={areaDestinations.map((item) => ({
              key: item.name,
              title: titleCase(item.name),
              subtitle: [
                item.origin ? `From ${titleCase(item.origin)}` : 'Whole-boat rental',
                item.boatIds.length > 1 ? `${item.boatIds.length} boats` : '1 boat',
              ].join(' · '),
              trailing: item.priceLabel,
              icon: 'location' as const,
            }))}
            onClose={() => setDestinationsOpen(false)}
            onSelect={(entry) => {
              const destination = areaDestinations.find((item) => item.name === entry.key);
              setDestinationsOpen(false);
              if (destination) {
                openDestination(destination);
              }
            }}
          />

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <SectionHeader title="My upcoming Trip" onViewAll={() => router.push('/booking')} />
            {upcoming ? (
              <Pressable
                style={styles.tripRow}
                onPress={() =>
                  router.push({ pathname: '/booking-details', params: { id: String(upcoming.id) } })
                }>
                <Image
                  source={{ uri: resolveMediaUrl(upcoming.boat.picture_url) || IMAGES.trip }}
                  style={styles.tripImage}
                  contentFit="cover"
                />
                <View style={styles.tripBody}>
                  <View style={styles.tripTop}>
                    <View style={styles.confirmed}>
                      <Ionicons
                        name={upcoming.status === 'approved' ? 'checkmark-circle' : 'time'}
                        size={14}
                        color={upcoming.status === 'approved' ? GREEN : ORANGE}
                      />
                      <Text
                        style={[
                          styles.confirmedText,
                          upcoming.status !== 'approved' && { color: ORANGE },
                        ]}>
                        {upcoming.status === 'approved' ? 'Confirmed' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.tripRoute, { color: colors.navy }]}>{upcoming.destination}</Text>
                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={13} color={colors.muted} />
                    <Text style={[styles.metaText, { color: colors.muted }]}>{upcoming.booking_date_label}</Text>
                    <Ionicons name="time-outline" size={13} color={colors.muted} />
                    <Text style={[styles.metaText, { color: colors.muted }]}>{upcoming.start_time_label}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="boat-outline" size={13} color={colors.muted} />
                    <Text style={[styles.metaText, { color: colors.muted }]}>{upcoming.boat.name}</Text>
                    <Ionicons name="people-outline" size={13} color={colors.muted} />
                    <Text style={[styles.metaText, { color: colors.muted }]}>
                      {upcoming.passenger_count} passengers
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ) : (
              <Text style={[styles.emptyBoats, { color: colors.muted }]}>No upcoming trip yet. Rent a boat to get started.</Text>
            )}
          </View>

          <View style={[styles.card, styles.boatsCard, { backgroundColor: colors.card }]}>
            <SectionHeader title="Available Boats" onViewAll={() => openRental('/boats')} />
            {!orgActive ? (
              <Text style={[styles.emptyBoats, { color: colors.muted }]}>
                No active rental boats are listed for this organization.
              </Text>
            ) : rentalBoats.length === 0 ? (
              <Text style={[styles.emptyBoats, { color: colors.muted }]}>
                No boats in this service area yet. You can change the service area above if you want boats from another location.
              </Text>
            ) : (
              <BoatWaveCarousel
                boats={rentalBoats}
                fallbackImage={IMAGES.boatA}
                onPressBoat={(boat) =>
                  openRental({ pathname: '/rent-boat', params: { id: String(boat.id) } })
                }
              />
            )}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <SectionHeader title="Recent Rentals" onViewAll={() => router.push('/booking')} />
            {recentRentals.length === 0 ? (
              <Text style={[styles.emptyBoats, { color: colors.muted }]}>No recent rentals yet.</Text>
            ) : (
              recentRentals.map((booking, index) => {
                const status = rentalStatus(booking);
                return (
                  <View key={booking.id}>
                    {index > 0 ? <View style={styles.rentalDivider} /> : null}
                    <Pressable
                      style={styles.rentalRow}
                      onPress={() =>
                        router.push({
                          pathname: '/booking-details',
                          params: { id: String(booking.id) },
                        })
                      }>
                      <Image
                        source={{ uri: resolveMediaUrl(booking.boat.picture_url) || IMAGES.recentA }}
                        style={styles.rentalImage}
                        contentFit="cover"
                      />
                      <View style={styles.rentalBody}>
                        <Text style={[styles.tripRoute, { color: colors.navy }]}>{booking.destination}</Text>
                        <View style={styles.metaRow}>
                          <Ionicons name="calendar-outline" size={13} color={colors.muted} />
                          <Text style={[styles.metaText, { color: colors.muted }]}>{booking.booking_date_label}</Text>
                          <Ionicons name="time-outline" size={13} color={colors.muted} />
                          <Text style={[styles.metaText, { color: colors.muted }]}>{booking.start_time_label}</Text>
                        </View>
                      </View>
                      <View style={styles.rentalRight}>
                        <View style={[styles.completedPill, { backgroundColor: status.bg }]}>
                          <Text style={[styles.completedText, { color: status.color }]}>
                            {status.label}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={MUTED} />
                      </View>
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.howTitle, { color: colors.navy }]}>How It Works</Text>
            {HOW_IT_WORKS.map((step, index) => (
              <View key={step.title} style={styles.howStep}>
                <View style={styles.howRail}>
                  <View style={[styles.stepCircle, { backgroundColor: colors.iconBg }]}>
                    <Ionicons name={step.icon} size={18} color={colors.blue} />
                  </View>
                  {index < HOW_IT_WORKS.length - 1 ? (
                    <View style={[styles.howLine, { backgroundColor: colors.border }]} />
                  ) : null}
                </View>
                <View style={[styles.howCopy, index === HOW_IT_WORKS.length - 1 && styles.howCopyLast]}>
                  <Text style={[styles.stepTitle, { color: colors.navy }]}>
                    {index + 1}. {step.title}
                  </Text>
                  <Text style={[styles.stepText, { color: colors.muted }]}>{step.text}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
      <PassengerTabs active="home" />
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
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
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    marginBottom: 18,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    color: BLUE,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  welcome: {
    color: NAVY,
    fontSize: 28,
    fontWeight: '800',
  },
  waveHand: {
    fontSize: 28,
    transformOrigin: '70% 90%',
  },
  welcomeSub: {
    marginTop: 6,
    marginBottom: 16,
    color: MUTED,
    fontSize: 14,
  },
  hero: {
    height: 176,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 14,
    justifyContent: 'center',
  },
  heroCopy: {
    paddingHorizontal: 16,
    maxWidth: '62%',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  heroText: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    lineHeight: 16,
  },
  heroButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: BLUE,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 22,
    padding: 14,
    marginBottom: 14,
  },
  boatsCard: {
    overflow: 'visible',
  },
  bestCard: {
    backgroundColor: CARD,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E8EEF6',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    marginBottom: 14,
  },
  bestTitle: {
    color: NAVY,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  bestRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bestItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  bestLabel: {
    color: NAVY,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: NAVY,
    fontSize: 16,
    fontWeight: '800',
  },
  viewAll: {
    color: BLUE,
    fontSize: 13,
    fontWeight: '600',
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tripImage: {
    width: 74,
    height: 74,
    borderRadius: 14,
    backgroundColor: ICON_BG,
  },
  tripBody: {
    flex: 1,
  },
  tripTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 2,
  },
  confirmed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  confirmedText: {
    color: GREEN,
    fontSize: 12,
    fontWeight: '700',
  },
  tripRoute: {
    color: NAVY,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  tripArrow: {
    color: MUTED,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  metaText: {
    color: MUTED,
    fontSize: 11,
    marginRight: 6,
  },
  boatsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 2,
    paddingBottom: 2,
  },
  emptyBoats: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 18,
  },
  unavailableStatus: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  rentalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rentalImage: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: ICON_BG,
  },
  rentalBody: {
    flex: 1,
  },
  rentalRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  completedPill: {
    backgroundColor: '#E7F8EF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  completedText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '700',
  },
  rentalDivider: {
    height: 1,
    backgroundColor: '#EEF2F7',
    marginVertical: 12,
  },
  howTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
  },
  howStep: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  howRail: {
    width: 42,
    alignItems: 'center',
  },
  stepCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howLine: {
    width: 2,
    flex: 1,
    minHeight: 14,
    marginVertical: 4,
    borderRadius: 1,
  },
  howCopy: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 18,
  },
  howCopyLast: {
    paddingBottom: 2,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  stepText: {
    fontSize: 13,
    lineHeight: 18,
  },
  destRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  destIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destCopy: {
    flex: 1,
  },
  destName: {
    fontSize: 14,
    fontWeight: '800',
  },
  destMeta: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
  },
  moreDestinations: {
    marginTop: 10,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  moreDestinationsText: {
    fontSize: 13,
    fontWeight: '800',
  },
  destPrice: {
    fontSize: 14,
    fontWeight: '800',
  },
  destDivider: {
    height: 1,
  },
  pressed: {
    opacity: 0.85,
  },
});
