
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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

import { BrandLockup } from '@/components/brand-lockup';
import { LoadError } from '@/components/load-error';
import { NotificationBell } from '@/components/notification-bell';
import { OperatorMetricCard } from '@/components/operator-metric-card';
import { PassengerTabs } from '@/components/passenger-tabs';
import { SideMenu } from '@/components/side-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { friendlyError, isOfflineError } from '@/lib/api';
import { fetchBookings, passengerFilterAlertCount } from '@/lib/bookings';
import { resolveMediaUrl } from '@/lib/config';
import {
  isCancelledRentalTab,
  isWeatherCancelledRental,
  rentalCardBanner,
} from '@/lib/rental-cancellation-display';
import { useAppTheme } from '@/lib/theme';
import type { MobileBooking } from '@/lib/types';

const BLUE = '#1A5AD7';
const NAVY = '#1B2744';
const MUTED = '#3F4A63';
const GREEN = '#1FA971';
const ORANGE = '#F07A3A';
const VIOLET = '#7A5AF8';
const CARD = '#FFFFFF';
const PAGE = '#F7F9FC';
const ICON_BG = '#D7E8FB';
const CONTENT_PADDING = 16;
const FILTER_GAP = 8;

const FALLBACK_BOAT =
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80';

type BookingStatus = MobileBooking['status'];

// FIX: Only allow filter keys that exist in the counts object.
type FilterKey =
  | 'all'
  | 'pending'
  | 'approved'
  | 'awaiting_payment'
  | 'cancelled'
  | 'completed';

const FILTERS: {
  key: FilterKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  colorDark: string;
  bg: string;
  bgDark: string;
}[] = [
  {
    key: 'all',
    label: 'All',
    icon: 'albums-outline',
    color: BLUE,
    colorDark: '#7EB0FF',
    bg: '#EEF4FF',
    bgDark: '#1B2C4D',
  },
  {
    key: 'pending',
    label: 'Pending',
    icon: 'time-outline',
    color: ORANGE,
    colorDark: '#FFB070',
    bg: '#FDE8DC',
    bgDark: '#3D2A1C',
  },
  {
    key: 'approved',
    label: 'Confirmed',
    icon: 'checkmark-circle-outline',
    color: GREEN,
    colorDark: '#4ED89A',
    bg: '#DFF6EA',
    bgDark: '#163528',
  },
  {
    key: 'awaiting_payment',
    label: 'Payment',
    icon: 'wallet-outline',
    color: VIOLET,
    colorDark: '#B8A0FF',
    bg: '#EEE8FF',
    bgDark: '#2A2148',
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    icon: 'close-circle-outline',
    color: '#E25C5C',
    colorDark: '#FF8B8B',
    bg: '#FDECEC',
    bgDark: '#3A2224',
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: 'checkmark-done-circle-outline',
    color: '#4D8DFF',
    colorDark: '#8CBCFF',
    bg: '#E4EEFF',
    bgDark: '#1B2C4D',
  },
];

const STATUS_UI: Record<
  string,
  {
    label: string;
    color: string;
    colorDark: string;
    bg: string;
    bgDark: string;
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  pending: {
    label: 'PENDING',
    color: ORANGE,
    colorDark: '#FFB070',
    bg: '#FDE8DC',
    bgDark: '#3D2A1C',
    icon: 'time',
  },

  approved: {
    label: 'CONFIRMED',
    color: GREEN,
    colorDark: '#4ED89A',
    bg: '#DFF6EA',
    bgDark: '#163528',
    icon: 'checkmark-circle',
  },

  cancelled: {
    label: 'CANCELLED',
    color: '#E25C5C',
    colorDark: '#FF8B8B',
    bg: '#FDECEC',
    bgDark: '#3A2224',
    icon: 'close-circle',
  },

  completed: {
    label: 'COMPLETED',
    color: BLUE,
    colorDark: '#8CBCFF',
    bg: '#E4EEFF',
    bgDark: '#1B2C4D',
    icon: 'checkmark-done-circle',
  },

  passenger_no_show: {
    label: 'PASSENGER NO-SHOW',
    color: '#E25C5C',
    colorDark: '#FF8B8B',
    bg: '#FDECEC',
    bgDark: '#3A2224',
    icon: 'person-remove',
  },

  awaiting_payment: {
    label: 'AWAITING PAYMENT',
    color: BLUE,
    colorDark: '#8CBCFF',
    bg: '#E4EEFF',
    bgDark: '#1B2C4D',
    icon: 'wallet',
  },

  weather_hold: {
    label: 'CANCELLED · WEATHER',
    color: '#E25C5C',
    colorDark: '#FF8B8B',
    bg: '#FDECEC',
    bgDark: '#3A2224',
    icon: 'rainy',
  },

  reschedule_pending: {
    label: 'RESCHEDULE PENDING',
    color: VIOLET,
    colorDark: '#C4B5FF',
    bg: '#EEE8FF',
    bgDark: '#2C2448',
    icon: 'calendar',
  },

  confirmed: {
    label: 'CONFIRMED',
    color: GREEN,
    colorDark: '#4ED89A',
    bg: '#DFF6EA',
    bgDark: '#163528',
    icon: 'checkmark-circle',
  },

  declined: {
    label: 'CANCELLED',
    color: '#E25C5C',
    colorDark: '#FF8B8B',
    bg: '#FDECEC',
    bgDark: '#3A2224',
    icon: 'close-circle',
  },

  rejected: {
    label: 'REJECTED',
    color: '#E25C5C',
    colorDark: '#FF8B8B',
    bg: '#FDECEC',
    bgDark: '#3A2224',
    icon: 'close-circle',
  },
};

const FALLBACK_STATUS = {
  label: 'STATUS',
  color: MUTED,
  colorDark: '#C5CDD8',
  bg: '#EEF1F6',
  bgDark: '#243044',
  icon: 'ellipse' as keyof typeof Ionicons.glyphMap,
};

function isCalledRental(booking: MobileBooking) {
  return isCancelledRentalTab(booking);
}

function bookingStatusUi(booking: MobileBooking) {
  if (booking.status === 'passenger_no_show') {
    return STATUS_UI.passenger_no_show;
  }

  if (isWeatherCancelledRental(booking)) {
    return STATUS_UI.weather_hold;
  }

  if (booking.status === 'cancelled') {
    return STATUS_UI.cancelled;
  }

  if (isCalledRental(booking)) {
    return STATUS_UI.cancelled;
  }

  if (
    booking.status === 'awaiting_payment' &&
    booking.payment_status === 'for_verification'
  ) {
    return {
      label: 'FOR VERIFICATION',
      color: BLUE,
      colorDark: '#8CBCFF',
      bg: '#E4EEFF',
      bgDark: '#1B2C4D',
      icon: 'receipt' as keyof typeof Ionicons.glyphMap,
    };
  }

  const key = String(booking.status ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  return (
    STATUS_UI[key as BookingStatus] ?? {
      ...FALLBACK_STATUS,
      label: (booking.status_label || key || 'STATUS').toUpperCase(),
    }
  );
}

function MetaItem({
  icon,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
}) {
  const { colors, isDark } = useAppTheme();

  return (
    <View style={styles.metaItem}>
      <Ionicons
        name={icon}
        size={12}
        color={isDark ? colors.muted : '#3D4660'}
      />

      <Text
        style={[
          styles.metaText,
          {
            color: isDark ? '#D5DCE8' : '#3D4660',
          },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function BookingCard({ booking }: { booking: MobileBooking }) {
  const router = useRouter();

  const { colors, isDark } = useAppTheme();

  const status = bookingStatusUi(booking);

  const statusColor = isDark
    ? status.colorDark
    : status.color;

  const photo =
    resolveMediaUrl(booking.boat.picture_url) || FALLBACK_BOAT;

  const called = isCalledRental(booking);

  const banner = rentalCardBanner(booking);

  const bannerColor =
    banner?.tone === 'weather'
      ? '#E25C5C'
      : isDark
        ? '#FFB070'
        : '#9B2C2C';

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/booking-details',
          params: {
            id: String(booking.id),
          },
        })
      }
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: called
            ? isDark
              ? '#3A2224'
              : '#FDECEC'
            : colors.card,

          borderColor: called
            ? '#E25C5C'
            : colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <Image
        source={{ uri: photo }}
        style={styles.boatImage}
        contentFit="cover"
      />

      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isDark
                  ? status.bgDark
                  : status.bg,
              },
            ]}
          >
            <Ionicons
              name={status.icon}
              size={11}
              color={statusColor}
            />

            <Text
              style={[
                styles.statusText,
                {
                  color: statusColor,
                },
              ]}
            >
              {status.label}
            </Text>
          </View>

          <Text
            style={[
              styles.requestId,
              {
                color: isDark
                  ? '#D5DCE8'
                  : '#3D4660',
              },
            ]}
            numberOfLines={1}
          >
            #{booking.code}
          </Text>
        </View>

        <Text
          style={[
            styles.boatName,
            {
              color: colors.navy,
            },
          ]}
          numberOfLines={1}
        >
          {booking.boat.name}
        </Text>

        <Text
          style={[
            styles.boatNumber,
            {
              color: isDark
                ? '#D5DCE8'
                : '#3D4660',
            },
          ]}
        >
          {booking.boat.code}
        </Text>

        {banner ? (
          <View
            style={{
              marginTop: 6,
              gap: 2,
            }}
          >
            {banner.bodyLines.map((line) => (
              <Text
                key={line}
                style={{
                  color: bannerColor,
                  fontSize: 12,
                  fontWeight: '600',
                  lineHeight: 16,
                }}
              >
                {line}
              </Text>
            ))}

            {banner.hint ? (
              <Text
                style={{
                  color: bannerColor,
                  fontSize: 12,
                  fontWeight: '800',
                  marginTop: 2,
                }}
              >
                {banner.hint}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.metaGrid}>
          <MetaItem
            icon="calendar-outline"
            value={booking.booking_date_label}
          />

          <MetaItem
            icon="time-outline"
            value={
              booking.start_time_label || 'No set time'
            }
          />

          <MetaItem
            icon="location-outline"
            value={booking.destination}
          />

          <MetaItem
            icon="flag-outline"
            value={booking.pickup_point || '—'}
          />

          <MetaItem
            icon="people-outline"
            value={`${booking.passenger_count} passengers`}
          />

          <MetaItem
            icon="briefcase-outline"
            value={booking.purpose || '—'}
          />
        </View>
      </View>

      <Ionicons
        name="chevron-forward"
        size={16}
        color={colors.muted}
      />
    </Pressable>
  );
}

export default function BookingScreen() {
  const router = useRouter();

  const { colors, isDark } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const filterCardWidth = Math.floor((screenWidth - CONTENT_PADDING * 2 - FILTER_GAP * 2) / 3);

  const [filter, setFilter] = useState<FilterKey>('all');

  const [menuOpen, setMenuOpen] = useState(false);

  const [bookings, setBookings] = useState<MobileBooking[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [loadError, setLoadError] = useState('');

  const [offline, setOffline] = useState(false);

  const load = useCallback(() => {
    setLoadError('');

    return fetchBookings()
      .then((items) => {
        setBookings(items);
        setOffline(false);
      })
      .catch((err) => {
        setOffline(isOfflineError(err));
        setLoadError(friendlyError(err, 'Could not load your rentals.'));
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

  const counts = useMemo(
    () => ({
      all: bookings.length,

      pending: bookings.filter(
        (item) => item.status === 'pending',
      ).length,

      awaiting_payment: bookings.filter(
        (item) => item.status === 'awaiting_payment',
      ).length,

      approved: bookings.filter(
        (item) => item.status === 'approved',
      ).length,

      cancelled: bookings.filter(
        isCalledRental,
      ).length,

      completed: bookings.filter(
        (item) => item.status === 'completed',
      ).length,
    }),
    [bookings],
  );

  const visibleBookings = useMemo(
    () =>
      filter === 'all'
        ? bookings
        : filter === 'cancelled'
          ? bookings.filter(isCalledRental)
          : bookings.filter(
              (item) => item.status === filter,
            ),
    [bookings, filter],
  );

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.page,
        },
      ]}
    >
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
          }
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Pressable
                hitSlop={8}
                style={styles.headerBtn}
                onPress={() => setMenuOpen(true)}
              >
                <Ionicons
                  name="menu-outline"
                  size={26}
                  color={colors.navy}
                />
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
                style={[
                  styles.avatar,
                  {
                    backgroundColor: colors.blue,
                  },
                ]}
              >
                <Ionicons
                  name="person"
                  size={16}
                  color="#FFFFFF"
                />
              </Pressable>
            </View>
          </View>

          <Text
            style={[
              styles.title,
              {
                color: colors.navy,
              },
            ]}
          >
            My Rentals
          </Text>

          <Text
            style={[
              styles.subtitle,
              {
                color: colors.muted,
              },
            ]}
          >
            View and manage all your boat rental requests.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/payment-history')}
            style={({ pressed }) => [
              styles.historyLink,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <View
              style={[
                styles.historyIcon,
                { backgroundColor: colors.iconBg },
              ]}
            >
              <Ionicons
                name="receipt-outline"
                size={18}
                color={colors.blue}
              />
            </View>

            <View style={styles.historyCopy}>
              <Text
                style={[
                  styles.historyTitle,
                  { color: colors.navy },
                ]}
              >
                Payment History
              </Text>

              <Text
                style={[
                  styles.historySub,
                  { color: colors.muted },
                ]}
              >
                See your downpayments, balance, and refunds
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.muted}
            />
          </Pressable>

          <View style={styles.filterGrid}>
            {FILTERS.map((item) => {
              const active = filter === item.key;
              const tone = isDark ? item.colorDark : item.color;
              const tint = isDark ? item.bgDark : item.bg;

              return (
                <OperatorMetricCard
                  key={item.key}
                  label={item.label}
                  value={counts[item.key]}
                  icon={item.icon}
                  color={tone}
                  softBg={tint}
                  active={active}
                  badge={passengerFilterAlertCount(bookings, item.key)}
                  width={filterCardWidth}
                  onPress={() => setFilter(item.key)}
                />
              );
            })}
          </View>

          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.navy,
              },
            ]}
          >
            Rental Requests
          </Text>

          {loading ? (
            <ActivityIndicator
              color={BLUE}
              style={styles.loader}
            />
          ) : loadError && bookings.length === 0 ? (
            <LoadError
              message={loadError}
              offline={offline}
              onRetry={() => {
                setLoading(true);
                void load();
              }}
            />
          ) : visibleBookings.length === 0 ? (
            <Text
              style={[
                styles.empty,
                {
                  color: colors.muted,
                },
              ]}
            >
              {bookings.length === 0
                ? 'No rental requests yet. Rent a boat to see them here.'
                : `No ${FILTERS.find(
                    (item) => item.key === filter,
                  )?.label.toLowerCase()} rentals.`}
            </Text>
          ) : (
            visibleBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      <PassengerTabs active="booking" />

      <SideMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
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

  title: {
    color: NAVY,
    fontSize: 28,
    fontWeight: '800',
  },

  subtitle: {
    marginTop: 6,
    marginBottom: 16,
    color: MUTED,
    fontSize: 14,
  },

  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },

  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  historyCopy: {
    flex: 1,
    minWidth: 0,
  },

  historyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },

  historySub: {
    marginTop: 2,
    fontSize: 12,
  },

  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FILTER_GAP,
    marginTop: 4,
    marginBottom: 12,
    overflow: 'visible',
  },

  sectionTitle: {
    marginTop: 10,
    marginBottom: 12,
    fontSize: 16,
    fontWeight: '800',
  },

  loader: {
    marginTop: 24,
  },

  empty: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 18,
  },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  boatImage: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: ICON_BG,
  },

  cardBody: {
    flex: 1,
    minWidth: 0,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  statusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  requestId: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '600',
  },

  boatName: {
    fontSize: 15,
    fontWeight: '800',
  },

  boatNumber: {
    marginTop: 1,
    marginBottom: 6,
    fontSize: 12,
  },

  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },

  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '48%',
  },

  metaText: {
    flex: 1,
    fontSize: 11,
  },

  pressed: {
    opacity: 0.82,
  },
});
