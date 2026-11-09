import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLockup } from '@/components/brand-lockup';
import { NotificationBell } from '@/components/notification-bell';
import { PassengerTabs } from '@/components/passenger-tabs';
import { SideMenu } from '@/components/side-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { ApiError } from '@/lib/api';
import { paymentStatusLook, type TransactionPaymentStatus } from '@/lib/operator-transactions';
import {
  fetchPassengerPaymentHistory,
  paymentStatusHint,
  paymentTypeIcon,
  type PassengerPayment,
  type PassengerPaymentSummary,
} from '@/lib/passenger-payments';
import { useAppTheme } from '@/lib/theme';

const STATUS_FILTERS: { key: TransactionPaymentStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'verified', label: 'Verified' },
  { key: 'failed', label: 'Failed' },
  { key: 'refunded', label: 'Refunded' },
];

function monthLabel(iso: string | null): string {
  if (!iso) {
    return 'Undated';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Undated';
  }
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Manila' });
}

export default function PaymentHistoryScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [summary, setSummary] = useState<PassengerPaymentSummary | null>(null);
  const [rows, setRows] = useState<PassengerPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<TransactionPaymentStatus | 'all'>('all');
  /** Opened from a rental: show only that booking's payments (the passenger can clear the search to see all). */
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [query, setQuery] = useState(typeof code === 'string' ? code : '');
  const requestId = useRef(0);

  const load = useCallback(() => {
    const id = ++requestId.current;
    setError('');
    return fetchPassengerPaymentHistory()
      .then((payload) => {
        if (id !== requestId.current) {
          return;
        }
        setSummary(payload.summary);
        setRows(payload.payments);
      })
      .catch((err) => {
        if (id !== requestId.current) {
          return;
        }
        setError(
          err instanceof ApiError
            ? err.status === 0
              ? 'No connection. Check your internet and pull down to retry.'
              : err.firstError()
            : 'Could not load your payment history.',
        );
      })
      .finally(() => {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (row.payment_status === 'pending') {
        return false;
      }
      if (statusFilter !== 'all' && row.payment_status !== statusFilter) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return [row.booking_reference, row.boat_name, row.destination].some((value) =>
        (value ?? '').toLowerCase().includes(needle),
      );
    });
  }, [rows, statusFilter, query]);

  const sections = useMemo(() => {
    const groups: { title: string; items: PassengerPayment[] }[] = [];
    for (const row of visible) {
      const title = monthLabel(row.paid_at ?? row.sort_at);
      const last = groups[groups.length - 1];
      if (last && last.title === title) {
        last.items.push(row);
      } else {
        groups.push({ title, items: [row] });
      }
    }
    return groups;
  }, [visible]);

  function openRental(bookingId: number) {
    router.push({ pathname: '/booking-details', params: { id: String(bookingId) } });
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
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
            </View>
          </View>

          <Pressable hitSlop={8} style={styles.back} onPress={() => router.push('/booking')}>
            <Ionicons name="chevron-back" size={16} color={colors.blue} />
            <Text style={[styles.backText, { color: colors.blue }]}>My Rentals</Text>
          </Pressable>

          <Text style={[styles.title, { color: colors.navy }]}>Payment History</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            See every payment you made for your boat rentals.
          </Text>

          <View style={[styles.summary, { backgroundColor: colors.blue }]}>
            <Text style={styles.summaryTitle}>Total Paid</Text>
            {loading && !summary ? (
              <ActivityIndicator color="#FFFFFF" style={styles.summaryLoader} />
            ) : summary ? (
              <>
                <Text style={styles.summaryNet}>{summary.total_paid_label}</Text>
                <Text style={styles.summaryNetLabel}>
                  {summary.paid_count} verified payment{summary.paid_count === 1 ? '' : 's'}
                </Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryCell}>
                    <Text style={styles.summaryCellValue}>{summary.balance_due_label}</Text>
                    <Text style={styles.summaryCellLabel}>
                      Balance due{summary.balance_due_count > 0 ? ` (${summary.balance_due_count} rental${summary.balance_due_count === 1 ? '' : 's'})` : ''}
                    </Text>
                  </View>
                  <View style={styles.summaryCell}>
                    <Text style={styles.summaryCellValue}>{summary.refunded_label}</Text>
                    <Text style={styles.summaryCellLabel}>Refunded</Text>
                  </View>
                </View>
                {summary.balance_due > 0 ? (
                  <View style={styles.noteBox}>
                    <Ionicons name="information-circle-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.noteText}>
                      Pay the remaining balance to the boat operator (GCash or cash) on or before your trip.
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={styles.summaryCellLabel}>Payment summary is unavailable right now.</Text>
            )}
          </View>

          <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={18} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search reference, boat, or destination"
              placeholderTextColor={colors.muted}
              style={[styles.searchInput, { color: colors.navy }]}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query ? (
              <Pressable hitSlop={8} onPress={() => setQuery('')} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {STATUS_FILTERS.map((item) => {
              const active = item.key === statusFilter;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setStatusFilter(item.key)}
                  style={[
                    styles.chip,
                    { borderColor: active ? colors.blue : colors.border, backgroundColor: active ? colors.blue : colors.card },
                  ]}>
                  <Text style={[styles.chipText, { color: active ? '#FFFFFF' : colors.navy }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {loading && rows.length === 0 ? <ActivityIndicator color={colors.blue} style={styles.loader} /> : null}

          {!loading && !error && visible.length === 0 ? (
            <View style={[styles.card, styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.iconBg }]}>
                <Ionicons name="receipt-outline" size={26} color={colors.blue} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.navy }]}>
                {rows.length === 0 ? 'No payments yet' : 'No matching payments'}
              </Text>
              <Text style={[styles.empty, { color: colors.muted }]}>
                {rows.length === 0
                  ? 'Your payments will appear here after you pay the downpayment or full amount for a rental.'
                  : 'Try a different search or status filter.'}
              </Text>
              {rows.length === 0 ? (
                <Pressable
                  onPress={() => router.push('/boats')}
                  style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.blue }, pressed && { opacity: 0.8 }]}>
                  <Text style={styles.primaryText}>Rent a Boat</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {sections.map((section) => (
            <View key={section.title}>
              <Text style={[styles.sectionTitle, { color: colors.muted }]}>{section.title}</Text>
              {section.items.map((row) => {
                const look = paymentStatusLook(row.payment_status, isDark);
                const hint = paymentStatusHint(row.payment_status);
                return (
                  <View key={row.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.rowTop}>
                      <View style={styles.typeWrap}>
                        <View style={[styles.typeIcon, { backgroundColor: colors.iconBg }]}>
                          <Ionicons name={paymentTypeIcon(row.payment_type)} size={18} color={colors.blue} />
                        </View>
                        <Text style={[styles.typeLabel, { color: colors.navy }]}>{row.payment_type_label}</Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: look.bg }]}>
                        <Text style={[styles.badgeText, { color: look.color }]}>{row.payment_status_label}</Text>
                      </View>
                    </View>

                    <Text style={[styles.amount, { color: colors.navy }]}>{row.amount_paid_label}</Text>
                    <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
                      {[row.boat_name, row.destination].filter(Boolean).join(' · ') || 'Boat rental'}
                    </Text>
                    <Text style={[styles.code, { color: colors.blue }]}>{row.booking_reference || `Rental #${row.booking_id}`}</Text>

                    <View style={[styles.lines, { borderTopColor: colors.border }]}>
                      <View style={styles.line}>
                        <Text style={[styles.lineLabel, { color: colors.muted }]}>
                          {row.payment_status === 'verified' || row.payment_status === 'refunded' ? 'Paid on' : 'Submitted'}
                        </Text>
                        <Text style={[styles.lineValue, { color: colors.navy }]}>{row.paid_at_label ?? '—'}</Text>
                      </View>
                      <View style={styles.line}>
                        <Text style={[styles.lineLabel, { color: colors.muted }]}>Method</Text>
                        <Text style={[styles.lineValue, { color: colors.navy }]}>{row.payment_method_label ?? '—'}</Text>
                      </View>
                      {row.transaction_id ? (
                        <View style={styles.line}>
                          <Text style={[styles.lineLabel, { color: colors.muted }]}>Reference no.</Text>
                          <Text style={[styles.lineValue, styles.ref, { color: colors.navy }]} numberOfLines={1}>
                            {row.transaction_id}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.line}>
                        <Text style={[styles.lineLabel, { color: colors.muted }]}>Trip date</Text>
                        <Text style={[styles.lineValue, { color: colors.navy }]}>
                          {[row.rental_date_label, row.rental_time_label].filter(Boolean).join(' · ') || '—'}
                        </Text>
                      </View>
                      <View style={styles.line}>
                        <Text style={[styles.lineLabel, { color: colors.muted }]}>Rental total</Text>
                        <Text style={[styles.lineValue, { color: colors.navy }]}>{row.rental_total_label}</Text>
                      </View>
                    </View>

                    {row.booking_balance_due_label && row.payment_type !== 'balance' && row.payment_status === 'verified' ? (
                      <View style={[styles.balanceBox, { backgroundColor: isDark ? '#3D2A1C' : '#FFF4EC' }]}>
                        <Ionicons name="wallet-outline" size={15} color="#F07A3A" />
                        <Text style={[styles.balanceText, { color: isDark ? '#F9C9A8' : '#9A4A16' }]}>
                          Remaining balance {row.booking_balance_due_label} — pay the boat operator on your trip day.
                        </Text>
                      </View>
                    ) : null}

                    {hint ? <Text style={[styles.hint, { color: look.color }]}>{hint}</Text> : null}

                    <View style={styles.cardFoot}>
                      <Text style={[styles.bookingStatus, { color: colors.muted }]}>Rental: {row.booking_status_label}</Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => openRental(row.booking_id)}
                        style={({ pressed }) => [styles.detailsBtn, { borderColor: colors.blue }, pressed && { opacity: 0.7 }]}>
                        <Text style={[styles.detailsText, { color: colors.blue }]}>View Rental</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
      <PassengerTabs active="booking" />
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    marginBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginBottom: 6 },
  backText: { fontSize: 13, fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { marginTop: 6, marginBottom: 16, fontSize: 14, lineHeight: 20 },
  summary: { borderRadius: 20, padding: 18, marginBottom: 16 },
  summaryTitle: { color: '#DCE8FF', fontSize: 13, fontWeight: '700' },
  summaryLoader: { marginVertical: 28 },
  summaryNet: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', marginTop: 8 },
  summaryNetLabel: { color: '#DCE8FF', fontSize: 12, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  summaryCell: { flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 14, padding: 12 },
  summaryCellValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  summaryCellLabel: { color: '#DCE8FF', fontSize: 11, fontWeight: '600', marginTop: 2 },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12,
    padding: 10,
  },
  noteText: { flex: 1, color: '#FFFFFF', fontSize: 12, fontWeight: '600', lineHeight: 17 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14 },
  chips: { gap: 8, paddingBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { fontSize: 12, fontWeight: '700' },
  loader: { marginVertical: 24 },
  error: { color: '#E25C5C', marginBottom: 12, fontWeight: '600' },
  sectionTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4, marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  emptyCard: { alignItems: 'center', paddingVertical: 28 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  empty: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  primaryBtn: { marginTop: 14, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11 },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  typeWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  typeIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  typeLabel: { fontSize: 15, fontWeight: '800' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  amount: { marginTop: 12, fontSize: 24, fontWeight: '800' },
  meta: { marginTop: 2, fontSize: 13 },
  code: { marginTop: 2, fontSize: 13, fontWeight: '800' },
  lines: { borderTopWidth: 1, marginTop: 12, paddingTop: 10, gap: 7 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  lineLabel: { fontSize: 13 },
  lineValue: { fontSize: 13, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  ref: { maxWidth: '60%' },
  balanceBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, padding: 10, marginTop: 12 },
  balanceText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  hint: { marginTop: 10, fontSize: 12, fontWeight: '700' },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 8 },
  bookingStatus: { flex: 1, fontSize: 12, fontWeight: '600' },
  detailsBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  detailsText: { fontSize: 12, fontWeight: '800' },
});
