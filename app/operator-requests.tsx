
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
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

import { BrandLockup } from '@/components/brand-lockup';
import { NotificationBell } from '@/components/notification-bell';
import { OperatorMetricCard } from '@/components/operator-metric-card';
import { OperatorTabs } from '@/components/operator-tabs';
import { SideMenu } from '@/components/side-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { getStoredUser } from '@/lib/auth';
import { fetchBoats } from '@/lib/boats';
import { fetchBookings } from '@/lib/bookings';
import { useRequireActiveOrganization } from '@/lib/organization-access';
import { resolveMediaUrl } from '@/lib/config';
import {
  attentionRequestCount,
  isRescheduleRequestItem,
  passengerName,
  paymentsToVerify,
  pendingRequests,
  privateBookings,
  rescheduleRequests,
} from '@/lib/operator';
import { exportRentalReport } from '@/lib/operator-export';
import { modal } from '@/lib/modal-theme';
import { useAppTheme } from '@/lib/theme';
import type { AuthUser, Boat, MobileBooking } from '@/lib/types';

const BLUE = '#1A5AD7';
const GREEN = '#1FA971';
const ORANGE = '#F07A3A';
const VIOLET = '#7A5AF8';
const CONTENT_PADDING = 16;
const FILTER_GAP = 8;
const RED = '#E25C5C';
const SKY = '#4D8DFF';

const FALLBACK_BOAT =
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80';

// FIX: Use only valid operator request filter keys.
type FilterKey =
  | 'all'
  | 'pending'
  | 'reschedule_pending'
  | 'awaiting_payment'
  | 'approved'
  | 'completed'
  | 'passenger_no_show'
  | 'cancelled';

function isFilterKey(value: unknown): value is FilterKey {
  return (
    value === 'all' ||
    value === 'pending' ||
    value === 'reschedule_pending' ||
    value === 'awaiting_payment' ||
    value === 'approved' ||
    value === 'completed' ||
    value === 'passenger_no_show' ||
    value === 'cancelled'
  );
}

function isPaymentRelated(item: MobileBooking) {
  return (
    item.status === 'awaiting_payment' ||
    item.payment_status === 'for_verification'
  );
}

/** New requests and reschedule requests both wait for the operator, so both count as Pending. */
function isPendingItem(item: MobileBooking) {
  return item.status === 'pending' || isRescheduleRequestItem(item);
}

function isConfirmedItem(item: MobileBooking) {
  return item.status === 'approved' && !isRescheduleRequestItem(item);
}

/** Confirmed on a new date after an approved reschedule. */
function wasRescheduled(item: MobileBooking) {
  if (item.reschedule_status === 'approved') {
    return true;
  }
  const original = (item.original_booking_date ?? '').slice(0, 10);
  return Boolean(original) && original !== (item.booking_date ?? '').slice(0, 10);
}

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
    colorDark: '#5FD3A0',
    bg: '#E3F6EE',
    bgDark: '#173A2E',
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
    color: RED,
    colorDark: '#FF8B8B',
    bg: '#FDECEC',
    bgDark: '#3A2224',
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: 'checkmark-done-circle-outline',
    color: SKY,
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
    color: RED,
    colorDark: '#FF8B8B',
    bg: '#FDECEC',
    bgDark: '#3A2224',
    icon: 'close-circle',
  },

  completed: {
    label: 'COMPLETED',
    color: SKY,
    colorDark: '#8CBCFF',
    bg: '#E4EEFF',
    bgDark: '#1B2C4D',
    icon: 'checkmark-done-circle',
  },

  passenger_no_show: {
    label: 'PASSENGER NO-SHOW',
    color: RED,
    colorDark: '#FF8B8B',
    bg: '#FDECEC',
    bgDark: '#3A2224',
    icon: 'person-remove',
  },

  awaiting_payment: {
    label: 'AWAITING PAYMENT',
    color: SKY,
    colorDark: '#8CBCFF',
    bg: '#E4EEFF',
    bgDark: '#1B2C4D',
    icon: 'wallet',
  },

  reschedule_pending: {
    label: 'PENDING RESCHEDULE',
    color: VIOLET,
    colorDark: '#C4B5FF',
    bg: '#EEE8FF',
    bgDark: '#2C2448',
    icon: 'calendar',
  },

  confirmed_reschedule: {
    label: 'CONFIRMED RESCHEDULE',
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
    color: RED,
    colorDark: '#FF8B8B',
    bg: '#FDECEC',
    bgDark: '#3A2224',
    icon: 'close-circle',
  },

  rejected: {
    label: 'REJECTED',
    color: RED,
    colorDark: '#FF8B8B',
    bg: '#FDECEC',
    bgDark: '#3A2224',
    icon: 'close-circle',
  },
};

function requestStatusUi(booking: MobileBooking) {
  if (isRescheduleRequestItem(booking)) {
    return STATUS_UI.reschedule_pending;
  }

  if (booking.status === 'approved' && wasRescheduled(booking)) {
    return STATUS_UI.confirmed_reschedule;
  }

  if (
    booking.status === 'awaiting_payment' &&
    booking.payment_status === 'for_verification'
  ) {
    return {
      label: 'FOR VERIFICATION',
      color: SKY,
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
    STATUS_UI[key] ?? {
      label: (booking.status_label || key || 'STATUS').toUpperCase(),
      color: ORANGE,
      colorDark: '#FFB070',
      bg: '#FDE8DC',
      bgDark: '#3D2A1C',
      icon: 'ellipse' as keyof typeof Ionicons.glyphMap,
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
          { color: isDark ? '#D5DCE8' : '#3D4660' },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function RequestCard({ booking }: { booking: MobileBooking }) {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  const status = requestStatusUi(booking);
  const statusColor = isDark ? status.colorDark : status.color;

  const photo =
    resolveMediaUrl(booking.boat.picture_url) || FALLBACK_BOAT;

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/booking-details',
          params: { id: String(booking.id) },
        })
      }
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
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
                { color: statusColor },
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
            { color: colors.navy },
          ]}
          numberOfLines={1}
        >
          {booking.can_operator_respond_reschedule &&
          booking.no_show_reschedule_boat_name
            ? booking.no_show_reschedule_boat_name
            : booking.boat.name}
        </Text>

        <Text
          style={[
            styles.boatNumber,
            { color: colors.muted },
          ]}
          numberOfLines={1}
        >
          {passengerName(booking)}
        </Text>

        <View style={styles.metaRow}>
          <MetaItem
            icon="location-outline"
            value={booking.destination}
          />
        </View>

        <View style={styles.metaRow}>
          <MetaItem
            icon="calendar-outline"
            value={
              booking.no_show_reschedule_date_label ||
              (isRescheduleRequestItem(booking) && booking.requested_booking_date
                ? `New: ${booking.requested_booking_date}`
                : booking.booking_date_label)
            }
          />

          <MetaItem
            icon="time-outline"
            value={
              booking.no_show_reschedule_time_label ||
              booking.start_time_label ||
              '—'
            }
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

export default function OperatorRequestsScreen() {
  const allowed = useRequireActiveOrganization('operator');
  const router = useRouter();

  const params = useLocalSearchParams<{
    filter?: string | string[];
  }>();

  const { colors, isDark } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const filterCardWidth = Math.floor((screenWidth - CONTENT_PADDING * 2 - FILTER_GAP * 2) / 3);

  const initialFilter = useMemo(() => {
    const raw = Array.isArray(params.filter)
      ? params.filter[0]
      : params.filter;

    if (raw === 'reschedule_pending') {
      return 'pending';
    }

    return isFilterKey(raw) ? raw : 'all';
  }, [params.filter]);

  const [filter, setFilter] = useState<FilterKey>(initialFilter);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookings, setBookings] = useState<MobileBooking[]>([]);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (isFilterKey(initialFilter)) {
        setFilter(initialFilter);
      }

      getStoredUser().then(setUser);

      setLoading(true);
      setLoadError('');

      Promise.all([
        fetchBookings(),
        fetchBoats().catch(() => [] as Boat[]),
      ])
        .then(([rows, assigned]) => {
          setBookings(rows);
          setBoats(assigned);
        })
        .catch((err) => {
          setBookings([]);
          setLoadError(
            err instanceof Error
              ? err.message
              : 'Could not load rental requests.',
          );
        })
        .finally(() => setLoading(false));
    }, [initialFilter]),
  );

  const assignedBoat = Boolean(
    user?.operator?.boat_id || boats.length > 0,
  );

  const requests = useMemo(
    () => privateBookings(bookings),
    [bookings],
  );

  const counts = useMemo(
    () => ({
      all: requests.length,

      pending: requests.filter(isPendingItem).length,

      reschedule_pending: requests.filter(
        isRescheduleRequestItem,
      ).length,

      awaiting_payment: requests.filter(
        isPaymentRelated,
      ).length,

      approved: requests.filter(isConfirmedItem).length,

      cancelled: requests.filter(
        (item) =>
          item.status === 'cancelled' ||
          item.status === 'passenger_no_show',
      ).length,

      // FIX: Keep the existing passenger_no_show filter supported.
      passenger_no_show: requests.filter(
        (item) => item.status === 'passenger_no_show',
      ).length,

      completed: requests.filter(
        (item) => item.status === 'completed',
      ).length,
    }),
    [requests],
  );

  const pendingAlert = useMemo(
    () => pendingRequests(bookings).length,
    [bookings],
  );

  const rescheduleAlert = useMemo(
    () => rescheduleRequests(bookings).length,
    [bookings],
  );

  const verifyAlert = useMemo(
    () => paymentsToVerify(bookings).length,
    [bookings],
  );

  const requestAlerts = useMemo(
    () => attentionRequestCount(bookings),
    [bookings],
  );

  const visible = useMemo(
    () =>
      filter === 'all'
        ? requests
        : requests.filter((item) =>
            filter === 'awaiting_payment'
              ? isPaymentRelated(item)
              : filter === 'pending'
                ? isPendingItem(item)
                : filter === 'approved'
                  ? isConfirmedItem(item)
                  : filter === 'reschedule_pending'
                    ? isRescheduleRequestItem(item)
                    : filter === 'cancelled'
                      ? item.status === 'cancelled' ||
                        item.status === 'passenger_no_show'
                      : item.status === filter,
          ),
    [filter, requests],
  );

  const filterLabel =
    FILTERS.find((item) => item.key === filter)?.label ?? 'All';

  async function handleExport() {
    if (exporting) {
      return;
    }

    setExporting(true);

    try {
      const result = await exportRentalReport(
        visible,
        user,
        filterLabel,
      );

      setExportNotice(
        result === 'saved'
          ? 'Rental PDF saved to the folder you selected.'
          : 'Rental PDF is ready. Use the share sheet to save or send it.',
      );
    } catch (err) {
      setExportNotice(
        err instanceof Error
          ? err.message
          : 'Could not export rentals.',
      );
    } finally {
      setExporting(false);
    }
  }

  if (!allowed) {
    return (
      <View
        style={[
          styles.screen,
          { backgroundColor: colors.page },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.page },
      ]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
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
                  { backgroundColor: colors.blue },
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

          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                {
                  color: colors.navy,
                  flex: 1,
                },
              ]}
            >
              Rental Requests
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Export rentals"
              disabled={
                exporting ||
                loading ||
                visible.length === 0
              }
              onPress={() => void handleExport()}
              style={({ pressed }) => [
                styles.exportBtn,
                {
                  opacity:
                    exporting || visible.length === 0
                      ? 0.5
                      : 1,
                },
                pressed && visible.length > 0 && !exporting
                  ? { opacity: 0.85 }
                  : null,
              ]}
            >
              {exporting ? (
                <ActivityIndicator
                  color="#FFFFFF"
                  size="small"
                />
              ) : (
                <>
                  <Ionicons
                    name="download-outline"
                    size={16}
                    color="#FFFFFF"
                  />

                  <Text style={styles.exportText}>
                    Export
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          {requestAlerts > 0 ? (
            <Pressable
              onPress={() =>
                setFilter(
                  pendingAlert > 0 || rescheduleAlert > 0
                    ? 'pending'
                    : 'awaiting_payment',
                )
              }
              style={({ pressed }) => [
                styles.alertBanner,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="alert-circle"
                size={18}
                color={RED}
              />

              <Text style={styles.alertText}>
                {pendingAlert + rescheduleAlert > 0 && verifyAlert > 0
                  ? `${pendingAlert + rescheduleAlert} pending · ${verifyAlert} payment${verifyAlert === 1 ? '' : 's'} to verify`
                  : pendingAlert + rescheduleAlert > 0
                    ? `${pendingAlert + rescheduleAlert} pending request${pendingAlert + rescheduleAlert === 1 ? '' : 's'} need review`
                    : `${verifyAlert} payment${verifyAlert === 1 ? '' : 's'} waiting for verification`}
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.filterGrid}>
            {FILTERS.map((item) => {
              const active = filter === item.key;
              const tone = isDark ? item.colorDark : item.color;
              const tint = isDark ? item.bgDark : item.bg;
              const alertCount =
                item.key === 'all'
                  ? pendingAlert + rescheduleAlert + verifyAlert
                  : item.key === 'pending'
                    ? pendingAlert + rescheduleAlert
                    : item.key === 'awaiting_payment'
                      ? verifyAlert
                      : 0;

              return (
                <OperatorMetricCard
                  key={item.key}
                  label={item.label}
                  value={counts[item.key]}
                  icon={item.icon}
                  color={tone}
                  softBg={tint}
                  active={active}
                  badge={alertCount}
                  width={filterCardWidth}
                  onPress={() => setFilter(item.key)}
                />
              );
            })}
          </View>

          <Text
            style={[
              styles.sectionTitle,
              { color: colors.navy },
            ]}
          >
            Passenger Requests
          </Text>

          {loading ? (
            <ActivityIndicator
              color={colors.blue}
              style={styles.loader}
            />
          ) : visible.length === 0 ? (
            <Text
              style={[
                styles.empty,
                { color: colors.muted },
              ]}
            >
              {loadError
                ? loadError
                : !assignedBoat
                  ? 'No boat assigned.'
                  : `No ${filterLabel.toLowerCase()} rentals.`}
            </Text>
          ) : (
            visible.map((booking) => (
              <RequestCard
                key={booking.id}
                booking={booking}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      <OperatorTabs active="requests" />

      <SideMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <Modal
        visible={Boolean(exportNotice)}
        transparent
        animationType="fade"
        onRequestClose={() => setExportNotice('')}
      >
        <View style={styles.noticeOverlay}>
          <View
            style={[
              styles.noticeCard,
              { backgroundColor: colors.card },
            ]}
          >
            <Text
              style={[
                styles.noticeTitle,
                { color: colors.navy },
              ]}
            >
              Export
            </Text>

            <Text
              style={[
                styles.noticeBody,
                { color: colors.muted },
              ]}
            >
              {exportNotice}
            </Text>

            <Pressable
              onPress={() => setExportNotice('')}
              style={({ pressed }) => [
                styles.noticeBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.exportText}>
                Got it
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: CONTENT_PADDING,
    paddingBottom: 96,
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

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
  },

  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: BLUE,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 92,
    justifyContent: 'center',
  },

  exportText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  noticeOverlay: modal.overlay,

  noticeCard: modal.card,

  noticeTitle: modal.title,

  noticeBody: modal.body,

  noticeBtn: {
    ...modal.btnFull,
    backgroundColor: BLUE,
  },

  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FILTER_GAP,
    marginTop: 4,
    marginBottom: 12,
    overflow: 'visible',
  },

  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDECEC',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },

  alertText: {
    flex: 1,
    color: RED,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
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
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
  },

  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  boatImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#D7E8FB',
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
    fontWeight: '600',
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },

  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },

  metaText: {
    flex: 1,
    fontSize: 11,
  },

  pressed: {
    opacity: 0.82,
  },
});
