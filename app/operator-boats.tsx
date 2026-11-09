import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BoatPhotoCarousel } from '@/components/boat-photo-carousel';
import { BoatStatusAlert } from '@/components/boat-status-alert';
import { BrandLockup } from '@/components/brand-lockup';
import { LoadError } from '@/components/load-error';
import { NotificationBell } from '@/components/notification-bell';
import { OperatorMetricCard } from '@/components/operator-metric-card';
import { OperatorTabs } from '@/components/operator-tabs';
import { SideMenu } from '@/components/side-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { friendlyError, isOfflineError } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { fetchBoats } from '@/lib/boats';
import { fetchBookings } from '@/lib/bookings';
import {
  fetchCommissions,
  isCommissionPaidOut,
  paidCommissions,
  unpaidCommissions,
  type OperatorCommission,
} from '@/lib/commissions';
import { resolveMediaUrl } from '@/lib/config';
import { boatHistory, boatRevenueTotal, boatsForOperator, passengerName } from '@/lib/operator';
import { useRequireActiveOrganization } from '@/lib/organization-access';
import { useAppTheme } from '@/lib/theme';
import type { AuthUser, Boat, MobileBooking } from '@/lib/types';

const GREEN = '#1FA971';
const ORANGE = '#E39B2B';
const RED = '#E25C5C';
const BLUE = '#1A5AD7';
const STAR = '#F5C542';
const PAST_LIMIT = 5;

type TabKey = 'trips' | 'details' | 'commission';

const UPCOMING_STATUSES: MobileBooking['status'][] = [
  'pending',
  'awaiting_payment',
  'approved',
  'weather_hold',
  'reschedule_pending',
];

function formatPeso(amount: number) {
  return `₱${amount.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

function tripLook(booking: MobileBooking, isDark: boolean) {
  const tone = (color: string, light: string, dark: string) => ({ color, bg: isDark ? dark : light });
  switch (booking.status) {
    case 'completed':
      return { label: 'Completed', ...tone(GREEN, '#DFF6EA', '#163528') };
    case 'approved':
      return { label: 'Confirmed', ...tone(BLUE, '#E8F1FF', '#1B2C4D') };
    case 'awaiting_payment':
      return { label: 'Awaiting payment', ...tone(ORANGE, '#FDE8DC', '#3D2A1C') };
    case 'weather_hold':
      return { label: 'Weather hold', ...tone(ORANGE, '#FDE8DC', '#3D2A1C') };
    case 'reschedule_pending':
      return { label: 'Reschedule', ...tone(ORANGE, '#FDE8DC', '#3D2A1C') };
    case 'passenger_no_show':
      return { label: 'No-show', ...tone(RED, '#FDECEC', '#3A2224') };
    case 'cancelled':
      return { label: 'Cancelled', ...tone(RED, '#FDECEC', '#3A2224') };
    default:
      return { label: 'New request', ...tone(ORANGE, '#FDE8DC', '#3D2A1C') };
  }
}

function dateParts(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return { day: '—', month: '' };
  }
  return {
    day: String(date.getDate()),
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  };
}

function SectionTitle({ icon, title, action }: { icon: keyof typeof Ionicons.glyphMap; title: string; action?: React.ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.sectionHead}>
      <View style={[styles.iconBadge, { backgroundColor: colors.iconBg }]}>
        <Ionicons name={icon} size={16} color={colors.blue} />
      </View>
      <Text style={[styles.sectionTitle, { color: colors.navy }]}>{title}</Text>
      {action}
    </View>
  );
}

function SpecItem({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.specItem}>
      <Ionicons name={icon} size={16} color={colors.blue} style={styles.specIcon} />
      <View style={styles.specCopy}>
        <Text style={[styles.specLabel, { color: colors.muted }]}>{label}</Text>
        <Text style={[styles.specValue, { color: colors.navy }]}>{value}</Text>
      </View>
    </View>
  );
}

function TripRow({ booking, first }: { booking: MobileBooking; first: boolean }) {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const look = tripLook(booking, isDark);
  const date = dateParts(booking.booking_date);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/booking-details', params: { id: String(booking.id) } })}
      style={({ pressed }) => [
        styles.tripRow,
        !first && { borderTopWidth: 1, borderTopColor: colors.border },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.dateBlock, { backgroundColor: colors.iconBg }]}>
        <Text style={[styles.dateDay, { color: colors.blue }]}>{date.day}</Text>
        <Text style={[styles.dateMonth, { color: colors.blue }]}>{date.month}</Text>
      </View>
      <View style={styles.tripCopy}>
        <View style={styles.tripTop}>
          <Text style={[styles.tripName, { color: colors.navy }]} numberOfLines={1}>
            {passengerName(booking)}
          </Text>
          <View style={[styles.pill, { backgroundColor: look.bg }]}>
            <Text style={[styles.pillText, { color: look.color }]}>{look.label}</Text>
          </View>
        </View>
        <Text style={[styles.tripMeta, { color: colors.muted }]} numberOfLines={1}>
          {booking.destination} · {booking.start_time_label || 'No set time'}
        </Text>
        <Text style={[styles.tripMeta, { color: colors.muted }]} numberOfLines={1}>
          #{booking.code}
          {booking.rental_price_label ? ` · ${booking.status === 'completed' ? booking.total_paid_label || booking.rental_price_label : booking.rental_price_label}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

function BoatPanel({
  boat,
  bookings,
  commissions,
  photoWidth,
  onStatusUpdated,
}: {
  boat: Boat;
  bookings: MobileBooking[];
  commissions: OperatorCommission[];
  photoWidth: number;
  onStatusUpdated: (boat: Boat) => void;
}) {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [tab, setTab] = useState<TabKey>('trips');
  const [showAllPast, setShowAllPast] = useState(false);

  const photos = (boat.picture_urls?.length ? boat.picture_urls : [boat.picture_url])
    .map((url) => resolveMediaUrl(url))
    .filter((url): url is string => Boolean(url));
  const history = boatHistory(bookings, boat.id);
  const upcoming = history
    .filter((item) => UPCOMING_STATUSES.includes(item.status))
    .sort((a, b) => `${a.booking_date} ${a.start_time}`.localeCompare(`${b.booking_date} ${b.start_time}`));
  const past = history
    .filter((item) => !UPCOMING_STATUSES.includes(item.status))
    .sort((a, b) => `${b.booking_date} ${b.start_time}`.localeCompare(`${a.booking_date} ${a.start_time}`));
  const completed = past.filter((item) => item.status === 'completed');
  const sales = boatRevenueTotal(history);
  const boatCommissions = commissions.filter(
    (item) => Number(item.boat_id) === Number(boat.id) || item.boat_name === boat.name,
  );
  const unpaid = unpaidCommissions(boatCommissions);
  const paid = paidCommissions(boatCommissions);
  const safety = boat.safety_equipment?.length
    ? boat.safety_equipment
    : boat.life_jacket_quantity
      ? [`Life Jackets (${boat.life_jacket_quantity})`]
      : [];
  const ready = boat.status === 'available';
  const statusTone = ready
    ? { color: GREEN, bg: isDark ? '#163528' : '#DFF6EA' }
    : boat.status === 'maintenance'
      ? { color: ORANGE, bg: isDark ? '#3D2A1C' : '#FDE8DC' }
      : { color: RED, bg: isDark ? '#3A2224' : '#FDECEC' };

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'trips', label: 'Trips', badge: upcoming.length },
    { key: 'details', label: 'Boat Details' },
    ...(boatCommissions.length > 0 ? [{ key: 'commission' as const, label: 'Commission', badge: unpaid.length }] : []),
  ];
  const visiblePast = showAllPast ? past : past.slice(0, PAST_LIMIT);

  return (
    <View>
      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {photos.length > 0 ? (
          <BoatPhotoCarousel urls={photos} width={photoWidth} />
        ) : (
          <View style={[styles.photoEmpty, { width: photoWidth, height: Math.round(photoWidth * 0.5), backgroundColor: colors.iconBg }]}>
            <Ionicons name="boat-outline" size={40} color={colors.blue} />
            <Text style={[styles.photoEmptyText, { color: colors.muted }]}>No boat photo yet. Ask the admin to add one.</Text>
          </View>
        )}
        <View style={styles.heroBody}>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text style={[styles.boatName, { color: colors.navy }]} numberOfLines={1}>
                {boat.name}
              </Text>
              <Text style={[styles.boatCode, { color: colors.muted }]}>
                {boat.code} · {boat.type || 'Boat'}
              </Text>
            </View>
            <View style={[styles.pill, styles.statusPill, { backgroundColor: statusTone.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusTone.color }]} />
              <Text style={[styles.pillText, { color: statusTone.color }]}>{boat.status_label}</Text>
            </View>
          </View>
          <View style={styles.heroMeta}>
            <View style={styles.heroMetaItem}>
              <Ionicons name="star" size={14} color={STAR} />
              <Text style={[styles.heroMetaText, { color: colors.navy }]}>
                {boat.rating_count
                  ? `${(boat.rating_average ?? 0).toFixed(1)} (${boat.rating_count} review${boat.rating_count === 1 ? '' : 's'})`
                  : 'No reviews yet'}
              </Text>
            </View>
            <View style={styles.heroMetaItem}>
              <Ionicons name="people-outline" size={14} color={colors.muted} />
              <Text style={[styles.heroMetaText, { color: colors.navy }]}>{boat.capacity} pax</Text>
            </View>
          </View>
        </View>
      </View>

      <BoatStatusAlert boats={[boat]} onUpdated={onStatusUpdated} />

      <View style={styles.statRow}>
        <OperatorMetricCard
          label="Upcoming"
          value={upcoming.length}
          icon="calendar-outline"
          color={colors.blue}
          softBg={isDark ? '#1B2C4D' : '#EEF4FF'}
          style={styles.statCard}
          onPress={() => setTab('trips')}
        />
        <OperatorMetricCard
          label="Completed"
          value={completed.length}
          icon="checkmark-circle-outline"
          color={GREEN}
          softBg={isDark ? '#163528' : '#DFF6EA'}
          style={styles.statCard}
          onPress={() => setTab('trips')}
        />
        <OperatorMetricCard
          label="Sales"
          value={formatPeso(sales)}
          icon="cash-outline"
          color={colors.navy}
          softBg={isDark ? '#243044' : '#EEF1F6'}
          style={styles.statCard}
          onPress={() => router.push('/operator-transactions')}
        />
      </View>
      <Text style={[styles.statHint, { color: colors.muted }]}>
        Rental sales are before barangay commission. Tap it to see your share in Earnings & Payouts.
      </Text>

      <View style={[styles.tabs, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {tabs.map((item) => {
          const active = item.key === tab;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              style={[styles.tab, active && { backgroundColor: colors.blue }]}>
              <Text style={[styles.tabText, { color: active ? '#FFFFFF' : colors.muted }]}>{item.label}</Text>
              {item.badge ? (
                <View style={[styles.tabBadge, { backgroundColor: active ? '#FFFFFF' : colors.blue }]}>
                  <Text style={[styles.tabBadgeText, { color: active ? colors.blue : '#FFFFFF' }]}>{item.badge}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {tab === 'trips' ? (
        <>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SectionTitle icon="calendar-outline" title={`Upcoming Trips (${upcoming.length})`} />
            {upcoming.length === 0 ? (
              <Text style={[styles.empty, { color: colors.muted }]}>No upcoming trips for this boat.</Text>
            ) : (
              upcoming.map((booking, index) => <TripRow key={booking.id} booking={booking} first={index === 0} />)
            )}
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SectionTitle icon="time-outline" title={`Past Trips (${past.length})`} />
            {past.length === 0 ? (
              <Text style={[styles.empty, { color: colors.muted }]}>No past trips yet.</Text>
            ) : (
              visiblePast.map((booking, index) => <TripRow key={booking.id} booking={booking} first={index === 0} />)
            )}
            {past.length > PAST_LIMIT ? (
              <Pressable
                onPress={() => setShowAllPast((value) => !value)}
                style={[styles.moreBtn, { borderColor: colors.border, backgroundColor: colors.iconBg }]}>
                <Text style={[styles.moreText, { color: colors.blue }]}>
                  {showAllPast ? 'Show less' : `Show all ${past.length} past trips`}
                </Text>
                <Ionicons name={showAllPast ? 'chevron-up' : 'chevron-down'} size={14} color={colors.blue} />
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}

      {tab === 'details' ? (
        <>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SectionTitle icon="boat-outline" title="Boat Information" />
            <View style={styles.specGrid}>
              <SpecItem icon="boat-outline" label="Boat Type" value={boat.type || '—'} />
              <SpecItem icon="people-outline" label="Capacity" value={`${boat.capacity} passengers`} />
              <SpecItem icon="location-outline" label="Home Port" value={boat.home_port || '—'} />
              <SpecItem icon="document-text-outline" label="License No." value={boat.license_no || '—'} />
              <SpecItem icon="calendar-outline" label="Registered" value={boat.registration_date_label || '—'} />
              <SpecItem icon="pricetag-outline" label="Boat Code" value={boat.code} />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SectionTitle icon="shield-checkmark-outline" title="Safety Equipment" />
            {safety.length > 0 ? (
              safety.map((item) => (
                <View key={item} style={styles.safetyItem}>
                  <Ionicons name="checkmark-circle" size={18} color={GREEN} />
                  <Text style={[styles.safetyText, { color: colors.navy }]}>{item}</Text>
                </View>
              ))
            ) : (
              <Text style={[styles.empty, { color: colors.muted }]}>No safety equipment recorded.</Text>
            )}
          </View>

          <View style={[styles.note, { backgroundColor: colors.iconBg }]}>
            <Ionicons name="information-circle-outline" size={18} color={colors.blue} />
            <Text style={[styles.noteText, { color: colors.navy }]}>
              Boat details, photos, and safety equipment are verified by the barangay. Ask the admin to update them.
            </Text>
          </View>
        </>
      ) : null}

      {tab === 'commission' ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SectionTitle
            icon="receipt-outline"
            title="Barangay Commission"
            action={
              <Pressable hitSlop={8} onPress={() => router.push('/operator-commissions')}>
                <Text style={[styles.link, { color: colors.blue }]}>Open</Text>
              </Pressable>
            }
          />
          <Text style={[styles.sectionHint, { color: colors.muted }]}>
            Older rentals where the passenger paid you directly. Send the barangay share after the trip.
          </Text>
          <View style={styles.commissionStats}>
            <OperatorMetricCard
              label="To settle"
              value={unpaid.length}
              icon="alert-circle-outline"
              color={ORANGE}
              softBg={isDark ? '#3D2A1C' : '#FDE8DC'}
              style={styles.commissionStat}
            />
            <OperatorMetricCard
              label="Settled"
              value={paid.length}
              icon="checkmark-circle-outline"
              color={GREEN}
              softBg={isDark ? '#163528' : '#DFF6EA'}
              style={styles.commissionStat}
            />
          </View>
          {boatCommissions.map((item, index) => {
            const settled = isCommissionPaidOut(item);
            return (
              <Pressable
                key={item.id}
                onPress={() => router.push({ pathname: '/commission-settle', params: { id: String(item.id) } })}
                style={[styles.commissionRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={styles.tripCopy}>
                  <Text style={[styles.tripName, { color: colors.navy }]} numberOfLines={1}>
                    {item.code || `COMM-${item.id}`}
                  </Text>
                  <Text style={[styles.tripMeta, { color: colors.muted }]} numberOfLines={1}>
                    {item.rental_date_label || item.rental_date || '—'}
                    {settled && item.paid_at_label ? ` · settled ${item.paid_at_label}` : ''}
                  </Text>
                </View>
                <View style={styles.commissionAmount}>
                  <Text style={[styles.tripName, { color: colors.navy }]}>{item.commission_amount_label}</Text>
                  <View
                    style={[
                      styles.pill,
                      { backgroundColor: settled ? (isDark ? '#163528' : '#DFF6EA') : isDark ? '#3D2A1C' : '#FDE8DC' },
                    ]}>
                    <Text style={[styles.pillText, { color: settled ? GREEN : ORANGE }]}>
                      {settled ? 'Settled' : item.status_label}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export default function OperatorBoatsScreen() {
  const allowed = useRequireActiveOrganization('operator');
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { width } = useWindowDimensions();
  const photoWidth = width - 32;
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [bookings, setBookings] = useState<MobileBooking[]>([]);
  const [commissions, setCommissions] = useState<OperatorCommission[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);

  const load = useCallback(() => {
    setError('');
    getStoredUser().then(setUser);
    return Promise.all([
      fetchBoats(),
      fetchBookings().catch(() => [] as MobileBooking[]),
      fetchCommissions().catch(() => [] as OperatorCommission[]),
    ])
      .then(([nextBoats, nextBookings, nextCommissions]) => {
        setBoats(nextBoats);
        setBookings(nextBookings);
        setCommissions(nextCommissions);
        setOffline(false);
      })
      .catch((err) => {
        setOffline(isOfflineError(err));
        setError(friendlyError(err, 'Could not load your boats.'));
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const myBoats = useMemo(() => boatsForOperator(boats, user), [boats, user]);
  const selected = myBoats.find((item) => item.id === selectedId) ?? myBoats[0] ?? null;

  if (!allowed) {
    return <View style={[styles.screen, { backgroundColor: colors.page }]} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
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

          <Text style={[styles.title, { color: colors.navy }]}>My Boats</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Check your boat status, upcoming trips, and boat details.
          </Text>

          {myBoats.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.boatChips}>
              {myBoats.map((boat) => {
                const active = boat.id === selected?.id;
                return (
                  <Pressable
                    key={boat.id}
                    onPress={() => setSelectedId(boat.id)}
                    style={[
                      styles.boatChip,
                      { borderColor: active ? colors.blue : colors.border, backgroundColor: active ? colors.blue : colors.card },
                    ]}>
                    <Ionicons name="boat" size={14} color={active ? '#FFFFFF' : colors.blue} />
                    <Text style={[styles.boatChipText, { color: active ? '#FFFFFF' : colors.navy }]}>{boat.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {loading ? <ActivityIndicator color={colors.blue} style={styles.loader} /> : null}

          {!loading && error && myBoats.length === 0 ? (
            <LoadError
              message={error}
              offline={offline}
              onRetry={() => {
                setLoading(true);
                void load();
              }}
            />
          ) : null}

          {!loading && !error && myBoats.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="boat-outline" size={30} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.navy }]}>No boat assigned yet</Text>
              <Text style={[styles.empty, { color: colors.muted, textAlign: 'center' }]}>
                The barangay admin registers your boat and links it to your account.
              </Text>
            </View>
          ) : null}

          {!loading && selected ? (
            <BoatPanel
              key={selected.id}
              boat={selected}
              bookings={bookings}
              commissions={commissions}
              photoWidth={photoWidth - 2}
              onStatusUpdated={(next) =>
                setBoats((current) => current.map((item) => (item.id === next.id ? next : item)))
              }
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>
      <OperatorTabs active="boats" />
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 96 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    marginBottom: 18,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { marginTop: 6, marginBottom: 14, fontSize: 14, lineHeight: 20 },
  loader: { marginTop: 24 },
  boatChips: { gap: 8, paddingBottom: 12 },
  boatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  boatChipText: { fontSize: 13, fontWeight: '800' },
  heroCard: { borderWidth: 1, borderRadius: 22, overflow: 'hidden' },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  photoEmptyText: { fontSize: 12, textAlign: 'center' },
  heroBody: { padding: 14 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  heroCopy: { flex: 1 },
  boatName: { fontSize: 22, fontWeight: '800' },
  boatCode: { marginTop: 2, fontSize: 13, fontWeight: '600' },
  heroMeta: { flexDirection: 'row', gap: 16, marginTop: 10 },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroMetaText: { fontSize: 13, fontWeight: '700' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statCard: { flex: 1 },
  statHint: { marginTop: 6, fontSize: 11, lineHeight: 15 },
  tabs: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 4, marginTop: 14 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 9,
  },
  tabText: { fontSize: 12, fontWeight: '800' },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  tabBadgeText: { fontSize: 10, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 20, padding: 14, marginTop: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '800' },
  sectionHint: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  iconBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  link: { fontSize: 13, fontWeight: '800' },
  empty: { fontSize: 13, lineHeight: 18 },
  emptyCard: { borderWidth: 1, borderRadius: 20, padding: 24, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  dateBlock: { width: 46, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 18, fontWeight: '900', lineHeight: 20 },
  dateMonth: { fontSize: 10, fontWeight: '800' },
  tripCopy: { flex: 1, minWidth: 0 },
  tripTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tripName: { flexShrink: 1, fontSize: 14, fontWeight: '800' },
  tripMeta: { marginTop: 2, fontSize: 12 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 10, fontWeight: '800' },
  moreBtn: {
    marginTop: 8,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  moreText: { fontSize: 13, fontWeight: '800' },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  specItem: { width: '50%', flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, paddingRight: 8 },
  specIcon: { marginTop: 2 },
  specCopy: { flex: 1 },
  specLabel: { fontSize: 11, fontWeight: '600' },
  specValue: { marginTop: 2, fontSize: 14, fontWeight: '800' },
  safetyItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  safetyText: { fontSize: 13, fontWeight: '600' },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 14, padding: 12, marginTop: 12 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  commissionStats: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  commissionStat: { flex: 1 },
  commissionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  commissionAmount: { alignItems: 'flex-end', gap: 4 },
  pressed: { opacity: 0.8 },
});
