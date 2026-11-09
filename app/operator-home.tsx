
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BoatStatusAlert } from '@/components/boat-status-alert';
import { BrandLockup } from '@/components/brand-lockup';
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
import { subscribeNotifications } from '@/lib/notification-watch';
import { getPinnedAnnouncements } from '@/lib/session';
import {
  fetchSeaAlerts,
  toYmd,
  weatherCopy,
  type SeaAlert,
} from '@/lib/weather';
import { NotificationBell } from '@/components/notification-bell';
import { OperatorMetricCard } from '@/components/operator-metric-card';
import { OperatorTabs } from '@/components/operator-tabs';
import { SideMenu } from '@/components/side-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { ApiError } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { useRequireActiveOrganization } from '@/lib/organization-access';
import { fetchBoats } from '@/lib/boats';
import { fetchBookings, updateBookingStatus } from '@/lib/bookings';
import { resolveMediaUrl } from '@/lib/config';
import {
  approvedRentals,
  boatsForOperator,
  canOperatorMarkPassengerNoShowLocal,
  isPassengerNoShowWaiting,
  isTripDayOrAfter,
  passengerNoShowOpensAtLabel,
  nextOperatorTrip,
  paymentsToVerify,
  pendingRequests,
  rescheduleRequests,
  todaysTrips,
} from '@/lib/operator';
import { roleLabel } from '@/lib/roles';
import { modal } from '@/lib/modal-theme';
import { useAppTheme } from '@/lib/theme';
import type { AuthUser, Boat, MobileBooking } from '@/lib/types';

const BLUE = '#1A5AD7';
const GREEN = '#1FA971';
const RED = '#E25C5C';
const ORANGE = '#F07A3A';
const VIOLET = '#7A5AF8';
const SKY = '#4D8DFF';
const MUTED = '#3F4A63';
const FALLBACK_BOAT =
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80';

function isRegularTrip(booking: MobileBooking) {
  return booking.kind === 'regular_trip';
}

function statusLook(booking: MobileBooking) {
  if (isRegularTrip(booking)) {
    return {
      label: booking.status_label || (booking.role === 'returning' ? 'Return' : 'Scheduled'),
      color: '#1B7AD8',
      bg: '#E8F4FC',
    };
  }

  const status = booking.status;
  if (status === 'approved') {
    return { label: 'Confirmed', color: GREEN, bg: '#E7F8EF' };
  }
  if (status === 'awaiting_payment' && booking.payment_status === 'for_verification') {
    return { label: 'For Verification', color: BLUE, bg: '#E8F1FF' };
  }
  if (status === 'pending') {
    return { label: 'Pending', color: ORANGE, bg: '#FDE8DC' };
  }
  if (status === 'reschedule_pending' || booking.can_review_reschedule) {
    return { label: 'Reschedule', color: VIOLET, bg: '#EEE8FF' };
  }
  if (status === 'weather_hold') {
    return { label: 'Weather hold', color: '#E25C5C', bg: '#FDECEC' };
  }
  if (status === 'cancelled') {
    return { label: 'Cancelled', color: '#E25C5C', bg: '#FDECEC' };
  }
  if (status === 'passenger_no_show') {
    return { label: 'Passenger no-show', color: '#E25C5C', bg: '#FDECEC' };
  }
  return { label: 'Completed', color: GREEN, bg: '#E7F8EF' };
}

function leaveOrderLabel(booking: MobileBooking) {
  if (booking.leave_order_label) {
    return booking.leave_order_label;
  }

  const order = booking.rotation_order ?? 0;
  if (order < 1) {
    return booking.role === 'returning' ? 'Return trip' : 'Regular trip';
  }

  const suffix =
    order % 100 === 11 || order % 100 === 12 || order % 100 === 13
      ? 'th'
      : order % 10 === 1
        ? 'st'
        : order % 10 === 2
          ? 'nd'
          : order % 10 === 3
            ? 'rd'
            : 'th';

  return `${order}${suffix} to leave`;
}

function HomeBookingCard({
  booking,
  variant = 'request',
  onComplete,
  onPassengerNoShow,
  completing,
  completeReady,
  nowTick,
}: {
  booking: MobileBooking;
  variant?: 'request' | 'payment' | 'trip';
  onComplete?: () => void;
  onPassengerNoShow?: () => void;
  completing?: boolean;
  completeReady?: boolean;
  nowTick?: number;
}) {
  const paymentPending = Boolean(completeReady && booking.can_complete === false);
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const look = statusLook(booking);
  const photo = resolveMediaUrl(booking.boat.picture_url) || FALLBACK_BOAT;
  const regular = isRegularTrip(booking);

  return (
    <View>
      <Pressable
        onPress={() => {
          if (regular) {
            return;
          }
          router.push({ pathname: '/booking-details', params: { id: String(booking.id) } });
        }}
        style={styles.tripRow}>
        <Image source={{ uri: photo }} style={styles.tripImage} contentFit="cover" />
        <View style={styles.tripBody}>
          <View style={styles.tripHeadRow}>
            <Text style={[styles.tripTitle, { color: colors.navy }]} numberOfLines={1}>
              {regular ? booking.destination : `#${booking.code}`}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: isDark ? colors.iconBg : look.bg }]}>
              <Text style={[styles.statusText, { color: look.color }]}>{look.label}</Text>
            </View>
          </View>
          <Text style={[styles.tripMeta, { color: colors.muted }]} numberOfLines={1}>
            {regular ? leaveOrderLabel(booking) : booking.destination}
          </Text>
          {variant === 'payment' ? (
            <Text style={[styles.amountText, { color: colors.navy }]} numberOfLines={1}>
              {booking.down_payment_amount_label || 'Down Payment'}
            </Text>
          ) : null}
          <View style={styles.scheduleRow}>
            <View style={styles.scheduleItem}>
              <Ionicons name="calendar-outline" size={13} color={colors.muted} />
              <Text style={[styles.scheduleText, { color: colors.muted }]}>
                {booking.requested_booking_date
                  ? `New: ${booking.requested_booking_date}`
                  : booking.booking_date_label}
              </Text>
            </View>
            {variant === 'request' ? (
              <View style={styles.scheduleItem}>
                <Ionicons name="people-outline" size={13} color={colors.muted} />
                <Text style={[styles.scheduleText, { color: colors.muted }]}>
                  {booking.passenger_count} passengers
                </Text>
              </View>
            ) : variant === 'trip' ? (
              <View style={styles.scheduleItem}>
                <Ionicons name="time-outline" size={13} color={colors.muted} />
                <Text style={[styles.scheduleText, { color: colors.muted }]}>
                  {booking.start_time_label || 'No set time'}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
      {onComplete ? (
        <>
          <Pressable
            disabled={completing || !completeReady}
            onPress={onComplete}
            style={({ pressed }) => [
              styles.completeBtn,
              !completeReady && styles.completeBtnDisabled,
              (pressed || completing) && completeReady && styles.pressed,
            ]}>
            {completing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.completeBtnText, !completeReady && styles.completeBtnDisabledText]}>
                {paymentPending ? 'View Details' : 'Complete Trip'}
              </Text>
            )}
          </Pressable>
          {!completeReady ? (
            <Text style={[styles.completeHint, { color: colors.muted }]}>
              Available on the rental date or after the trip.
            </Text>
          ) : paymentPending ? (
            <Text style={[styles.completeHint, { color: colors.muted }]}>
              {booking.complete_blocked_reason || 'This rental cannot be completed yet.'}
            </Text>
          ) : null}
          {onPassengerNoShow && canOperatorMarkPassengerNoShowLocal(booking, nowTick) ? (
            <Pressable
              disabled={completing}
              onPress={onPassengerNoShow}
              style={({ pressed }) => [
                styles.noShowBtn,
                (pressed || completing) && styles.pressed,
              ]}>
              <Ionicons name="person-remove-outline" size={16} color={RED} />
              <Text style={styles.noShowBtnText}>Passenger Did Not Show</Text>
            </Pressable>
          ) : onPassengerNoShow && isPassengerNoShowWaiting(booking, nowTick) ? (
            <Text style={[styles.completeHint, { color: colors.muted }]}>
              Passenger Did Not Show opens at {passengerNoShowOpensAtLabel(booking) || 'the end of the waiting period'}.
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

export default function OperatorHomeScreen() {
  const router = useRouter();
  const allowed = useRequireActiveOrganization('operator');
  const { colors, isDark } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const homeStatWidth = Math.floor((screenWidth - 32 - 10) / 2);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bookings, setBookings] = useState<MobileBooking[]>([]);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [completeTarget, setCompleteTarget] = useState<number | null>(null);
  const [completeError, setCompleteError] = useState('');
  const [seaAlerts, setSeaAlerts] = useState<SeaAlert[]>([]);
  const [dashboardNotices, setDashboardNotices] = useState<DashboardAnnouncement[]>([]);
  const [nowTick, setNowTick] = useState(Date.now());

  useFocusEffect(
    useCallback(() => {
      getStoredUser().then(setUser);
      fetchBookings()
        .then(setBookings)
        .catch(() => setBookings([]));
      fetchBoats()
        .then(setBoats)
        .catch(() => setBoats([]));
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
    }, []),
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

  useEffect(() => {
    const tick = setInterval(() => setNowTick(Date.now()), 15000);
    return () => clearInterval(tick);
  }, []);

  const myBoats = useMemo(() => boatsForOperator(boats, user), [boats, user]);
  const pending = useMemo(() => pendingRequests(bookings), [bookings]);
  const reschedules = useMemo(() => rescheduleRequests(bookings), [bookings]);
  const toVerify = useMemo(() => paymentsToVerify(bookings), [bookings]);
  const approved = useMemo(() => approvedRentals(bookings), [bookings]);
  const today = useMemo(() => todaysTrips(bookings), [bookings]);
  const nextTrip = useMemo(() => nextOperatorTrip(bookings), [bookings]);
  const availableBoats = myBoats.filter((boat) => boat.status === 'available' || boat.open_for_booking);
  const weatherBanner = useMemo(() => {
    const todayYmd = toYmd(new Date());
    const todayAlerts = seaAlerts.filter((alert) => alert.date.slice(0, 10) === todayYmd);
    const notice =
      todayAlerts.find((alert) => (alert.tone ?? 'red') !== 'yellow') ?? todayAlerts[0] ?? null;
    if (!notice) {
      return null;
    }
    const copy = weatherCopy(notice.date, notice.reason, notice.tone ?? 'red');
    const holdCount = bookings.filter(
      (item) =>
        (item.weather_hold || item.status === 'weather_hold' || item.status === 'reschedule_pending') &&
        (item.booking_date || '').slice(0, 10) === todayYmd,
    ).length;
    return {
      title: copy.title,
      body:
        holdCount > 0
          ? `${copy.body} ${holdCount} rental${holdCount === 1 ? '' : 's'} on your boats ${holdCount === 1 ? 'is' : 'are'} on weather hold.`
          : copy.body,
      tone: notice.tone ?? ('red' as const),
    };
  }, [bookings, seaAlerts]);

  const reminderBanners = useMemo(
    () =>
      dashboardReminderNotices(dashboardNotices, {
        hasActiveWeather: Boolean(weatherBanner),
      }),
    [dashboardNotices, weatherBanner],
  );

  function openPassengerNoShow(bookingId: number) {
    router.push({
      pathname: '/booking-details',
      params: { id: String(bookingId), confirm: 'passenger_no_show' },
    });
  }

  function startComplete(booking: MobileBooking) {
    if (!isTripDayOrAfter(booking)) {
      return;
    }
    if (booking.can_complete === false) {
      router.push({ pathname: '/booking-details', params: { id: String(booking.id) } });
      return;
    }
    setCompleteTarget(booking.id);
  }

  async function completeRental(bookingId: number) {
    const booking = bookings.find((item) => item.id === bookingId);
    if (booking && !isTripDayOrAfter(booking)) {
      setCompleteError('Done is available on the rental date or after the trip.');
      return;
    }
    setCompletingId(bookingId);
    try {
      const updated = await updateBookingStatus(bookingId, 'completed');
      setBookings((current) =>
        current.map((item) => (item.id === bookingId ? updated : item)),
      );
    } catch (err) {
      setCompleteError(
        err instanceof ApiError ? err.firstError() : 'Please try again.',
      );
    } finally {
      setCompletingId(null);
    }
  }

  if (!allowed) {
    return <View style={[styles.screen, { backgroundColor: colors.page }]} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
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

          <Text style={[styles.welcome, { color: colors.navy }]}>
            Welcome, {user?.name?.split(' ')[0] ?? 'Operator'}!
          </Text>
          <Text style={[styles.welcomeSub, { color: colors.muted }]}>
            Review passenger requests, check today's trips, and keep your boats ready.
          </Text>

          {weatherBanner ? (
            <WeatherAlert title={weatherBanner.title} body={weatherBanner.body} tone={weatherBanner.tone} />
          ) : null}
          {reminderBanners.map((item) => (
            <WeatherAlert key={item.id} title={item.title} body={item.body} tone={item.tone} />
          ))}

          <View style={styles.pillRow}>
            <View style={[styles.rolePill, { backgroundColor: colors.iconBg }]}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.blue} />
              <Text style={[styles.rolePillText, { color: colors.blue }]}>{roleLabel(user?.role)}</Text>
            </View>
            {user?.organization?.name ? (
              <View style={[styles.rolePill, { backgroundColor: colors.iconBg }]}>
                <Ionicons name="location-outline" size={14} color={colors.blue} />
                <Text style={[styles.rolePillText, { color: colors.blue }]} numberOfLines={1}>
                  {user.organization.name}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.statsRow}>
            {[
              {
                key: 'today',
                value: today.length,
                label: 'Trips today',
                icon: 'calendar-outline' as const,
                color: isDark ? '#4ED89A' : GREEN,
                bg: isDark ? '#163528' : '#DFF6EA',
                badge: 0,
                onPress: () => router.push({ pathname: '/operator-requests', params: { filter: 'approved' } }),
              },
              {
                key: 'pending',
                value: pending.length,
                label: 'Pending',
                icon: 'document-text-outline' as const,
                color: isDark ? '#FFB070' : ORANGE,
                bg: isDark ? '#3D2A1C' : '#FDE8DC',
                badge: pending.length + reschedules.length,
                onPress: () => router.push({ pathname: '/operator-requests', params: { filter: 'pending' } }),
              },
              {
                key: 'payment',
                value: toVerify.length,
                label: 'Payment',
                icon: 'wallet-outline' as const,
                color: isDark ? '#B8A0FF' : VIOLET,
                bg: isDark ? '#2A2148' : '#EEE8FF',
                badge: toVerify.length,
                onPress: () =>
                  router.push({ pathname: '/operator-requests', params: { filter: 'awaiting_payment' } }),
              },
              {
                key: 'boats',
                value: availableBoats.length,
                label: 'My boat',
                icon: 'boat-outline' as const,
                color: isDark ? '#8CBCFF' : SKY,
                bg: isDark ? '#1B2C4D' : '#E4EEFF',
                badge: 0,
                onPress: () => router.push('/operator-boats'),
              },
            ].map((item) => (
              <OperatorMetricCard
                key={item.key}
                label={item.label}
                value={item.value}
                icon={item.icon}
                color={item.color}
                softBg={item.bg}
                badge={item.badge}
                width={homeStatWidth}
                onPress={item.onPress}
              />
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.navy }]}>Incoming Requests</Text>
              <Pressable
                hitSlop={8}
                onPress={() => router.push({ pathname: '/operator-requests', params: { filter: 'pending' } })}>
                <Text style={[styles.viewAll, { color: colors.blue }]}>View All</Text>
              </Pressable>
            </View>
            {pending.length === 0 ? (
              <Text style={[styles.empty, { color: colors.muted }]}>No pending requests.</Text>
            ) : (
              pending.slice(0, 3).map((booking, index) => (
                <View key={booking.id}>
                  {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                  <HomeBookingCard booking={booking} variant="request" />
                </View>
              ))
            )}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.navy }]}>Reschedule Requests</Text>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  router.push({ pathname: '/operator-requests', params: { filter: 'reschedule_pending' } })
                }>
                <Text style={[styles.viewAll, { color: colors.blue }]}>View All</Text>
              </Pressable>
            </View>
            {reschedules.length === 0 ? (
              <Text style={[styles.empty, { color: colors.muted }]}>No reschedule requests.</Text>
            ) : (
              reschedules.slice(0, 3).map((booking, index) => (
                <View key={booking.id}>
                  {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                  <HomeBookingCard booking={booking} variant="request" />
                </View>
              ))
            )}
          </View>

          {toVerify.length > 0 ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.navy }]}>Payments to Verify</Text>
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    router.push({ pathname: '/operator-requests', params: { filter: 'awaiting_payment' } })
                  }>
                  <Text style={[styles.viewAll, { color: colors.blue }]}>View All</Text>
                </Pressable>
              </View>
              {toVerify.slice(0, 3).map((booking, index) => (
                <View key={booking.id}>
                  {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                  <HomeBookingCard booking={booking} variant="payment" />
                </View>
              ))}
            </View>
          ) : null}

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.navy }]}>
                {today.length > 0 ? "Today's Trips" : 'Next Trip'}
              </Text>
              <Pressable hitSlop={8} onPress={() => router.push('/operator-requests')}>
                <Text style={[styles.viewAll, { color: colors.blue }]}>Schedule</Text>
              </Pressable>
            </View>
            {today.length > 0 ? (
              today.slice(0, 3).map((booking, index) => {
                const completable = !isRegularTrip(booking) && booking.status === 'approved';
                return (
                  <View key={booking.id}>
                    {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                    <HomeBookingCard
                      booking={booking}
                      variant="trip"
                      completing={completingId === booking.id}
                      completeReady={isTripDayOrAfter(booking)}
                      onComplete={completable ? () => startComplete(booking) : undefined}
                      onPassengerNoShow={completable ? () => openPassengerNoShow(booking.id) : undefined}
                      nowTick={nowTick}
                    />
                  </View>
                );
              })
            ) : nextTrip ? (
              <HomeBookingCard booking={nextTrip} variant="trip" />
            ) : (
              <Text style={[styles.empty, { color: colors.muted }]}>No upcoming trip.</Text>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.navy }]}>Accepted Rentals</Text>
              <Pressable
                hitSlop={8}
                onPress={() => router.push({ pathname: '/operator-requests', params: { filter: 'approved' } })}>
                <Text style={[styles.viewAll, { color: colors.blue }]}>View All</Text>
              </Pressable>
            </View>
            {approved.length === 0 ? (
              <Text style={[styles.empty, { color: colors.muted }]}>No accepted rentals.</Text>
            ) : (
              approved.slice(0, 3).map((booking, index) => (
                <View key={booking.id}>
                  {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                  <HomeBookingCard
                    booking={booking}
                    variant="trip"
                    completing={completingId === booking.id}
                    completeReady={isTripDayOrAfter(booking)}
                    onComplete={() => startComplete(booking)}
                    onPassengerNoShow={() => openPassengerNoShow(booking.id)}
                    nowTick={nowTick}
                  />
                </View>
              ))
            )}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.navy }]}>My Boats</Text>
              <Pressable hitSlop={8} onPress={() => router.push('/operator-boats')}>
                <Text style={[styles.viewAll, { color: colors.blue }]}>View All</Text>
              </Pressable>
            </View>
            {myBoats.length === 0 ? (
              <Text style={[styles.empty, { color: colors.muted }]}>No boats assigned.</Text>
            ) : (
              myBoats.slice(0, 3).map((boat) => {
                const photo = resolveMediaUrl(boat.picture_url) || FALLBACK_BOAT;
                const ready = boat.status === 'available' || boat.open_for_booking;
                return (
                  <Pressable
                    key={boat.id}
                    onPress={() => router.push('/operator-boats')}
                    style={styles.boatRow}>
                    <Image source={{ uri: photo }} style={styles.boatImage} contentFit="cover" />
                    <View style={styles.tripBody}>
                      <Text style={[styles.tripTitle, { color: colors.navy }]}>{boat.name}</Text>
                      <Text style={[styles.tripMeta, { color: colors.muted }]}>
                        {boat.code} · {boat.capacity} pax
                      </Text>
                    </View>
                    <Text style={{ color: ready ? GREEN : ORANGE, fontSize: 11, fontWeight: '700' }}>
                      {boat.status_label}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>

          <View style={styles.alertWrap}>
            <BoatStatusAlert
              boats={myBoats}
              onUpdated={(next) =>
                setBoats((current) => current.map((item) => (item.id === next.id ? next : item)))
              }
            />
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={completeTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => (completingId ? undefined : setCompleteTarget(null))}>
        <View style={styles.successOverlay}>
          <View style={[styles.successCard, { backgroundColor: colors.card }]}>
            <View style={[styles.successRing, { backgroundColor: isDark ? '#163528' : '#E7F8EE' }]}>
              <View style={styles.successCircle}>
                <Ionicons name="checkmark-done" size={24} color="#FFFFFF" />
              </View>
            </View>
            <Text style={[styles.successTitle, { color: colors.navy }]}>Done</Text>
            <Text style={[styles.successBody, { color: colors.muted }]}>
              {(() => {
                const target = bookings.find((item) => item.id === completeTarget);

                return target?.complete_settles_balance
                  ? `Trip finished? Balance ${target.remaining_balance_label || ''} will be recorded as paid in cash.`
                  : 'Trip finished? It will move to Completed.';
              })()}
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                disabled={Boolean(completingId)}
                onPress={() => setCompleteTarget(null)}
                style={({ pressed }) => [
                  styles.confirmGhost,
                  { borderColor: colors.border, backgroundColor: isDark ? colors.iconBg : '#F3F7FF' },
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.confirmGhostText, { color: colors.blue }]}>Not yet</Text>
              </Pressable>
              <Pressable
                disabled={Boolean(completingId)}
                onPress={() => {
                  const id = completeTarget;
                  setCompleteTarget(null);
                  if (id) {
                    void completeRental(id);
                  }
                }}
                style={({ pressed }) => [
                  styles.confirmFill,
                  (pressed || completingId !== null) ? styles.pressed : null,
                ]}>
                {completingId ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmFillText}>Done</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(completeError)}
        transparent
        animationType="fade"
        onRequestClose={() => setCompleteError('')}>
        <View style={styles.successOverlay}>
          <View style={[styles.successCard, { backgroundColor: colors.card }]}>
            <View style={[styles.successRing, { backgroundColor: isDark ? '#3D2A1C' : '#FDE8DC' }]}>
              <View style={[styles.successCircle, { backgroundColor: ORANGE }]}>
                <Ionicons name="wallet-outline" size={24} color="#FFFFFF" />
              </View>
            </View>
            <Text style={[styles.successTitle, { color: colors.navy }]}>Could not mark as done</Text>
            <Text style={[styles.successBody, { color: colors.muted }]}>
              {completeError || 'Please try again.'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setCompleteError('')}
              style={({ pressed }) => [
                styles.successBtn,
                { backgroundColor: colors.blue },
                pressed && styles.pressed,
              ]}>
              <Text style={styles.confirmFillText}>Got It</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <OperatorTabs active="home" />
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcome: {
    fontSize: 28,
    fontWeight: '800',
  },
  welcomeSub: {
    marginTop: 6,
    marginBottom: 14,
    fontSize: 14,
    lineHeight: 20,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  viewAll: {
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    fontSize: 13,
    lineHeight: 18,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  boatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  tripImage: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: '#D7E8FB',
  },
  boatImage: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: '#D7E8FB',
  },
  tripBody: {
    flex: 1,
  },
  tripTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 0,
  },
  tripHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  tripMeta: {
    fontSize: 12,
    marginBottom: 4,
  },
  amountText: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scheduleText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  completeBtn: {
    marginTop: 10,
    marginLeft: 68,
    borderRadius: 12,
    backgroundColor: GREEN,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  completeBtnDisabled: {
    backgroundColor: '#C5CDD8',
  },
  completeBtnDisabledText: {
    color: '#FFFFFF',
  },
  completeHint: {
    marginTop: 6,
    marginLeft: 68,
    fontSize: 11,
    fontWeight: '600',
  },
  noShowBtn: {
    marginTop: 8,
    marginLeft: 68,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: RED,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  noShowBtnText: {
    color: RED,
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.75,
  },
  successOverlay: modal.overlay,
  successCard: modal.card,
  successRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: modal.title,
  successBody: modal.body,
  confirmActions: modal.actions,
  confirmGhost: {
    ...modal.btn,
    borderWidth: 1.5,
  },
  confirmGhostText: modal.btnGhostText,
  confirmFill: {
    ...modal.btn,
    backgroundColor: GREEN,
  },
  confirmFillText: modal.btnText,
  successBtn: modal.btnFull,
  safetyCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: '#FFF8EE',
    padding: 14,
  },
  safetyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  safetyTitle: {
    color: '#E39B2B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  safetyText: {
    fontSize: 12,
    lineHeight: 18,
  },
  alertWrap: {
    marginTop: 14,
  },
});
