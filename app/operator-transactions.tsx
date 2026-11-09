import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { OperatorTabs } from '@/components/operator-tabs';
import { SideMenu } from '@/components/side-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { ApiError } from '@/lib/api';
import { useRequireActiveOrganization } from '@/lib/organization-access';
import {
  fetchOperatorTransactions,
  paymentStatusLook,
  payoutStatusLook,
  type EarningsSummary,
  type OperatorTransaction,
  type TransactionPaymentStatus,
  type TransactionPaymentType,
  type TransactionPeriod,
} from '@/lib/operator-transactions';
import { useAppTheme } from '@/lib/theme';

const PERIODS: { key: TransactionPeriod; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'all', label: 'All Time' },
];

const TYPE_FILTERS: { key: TransactionPaymentType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'full', label: 'Full' },
  { key: 'downpayment', label: 'Downpayment' },
  { key: 'balance', label: 'Balance' },
];

const STATUS_FILTERS: { key: TransactionPaymentStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Any status' },
  { key: 'verified', label: 'Verified' },
  { key: 'failed', label: 'Failed' },
  { key: 'refunded', label: 'Refunded' },
];

function payoutLine(summary: EarningsSummary): string | null {
  const parts: string[] = [];
  if (summary.payouts_received_count > 0 && summary.payouts_received_label) {
    parts.push(
      `Paid Out ${summary.payouts_received_label} (${summary.payouts_received_count} rental${summary.payouts_received_count === 1 ? '' : 's'})`,
    );
  }
  if (summary.processing_payout_count > 0) {
    parts.push(`${summary.processing_payout_count} Processing`);
  }
  if (summary.awaiting_payout_count > 0) {
    parts.push(`${summary.awaiting_payout_count} Awaiting Payout`);
  }
  if (summary.on_hold_payout_count > 0) {
    parts.push(`${summary.on_hold_payout_count} On Hold`);
  }
  if (summary.failed_payout_count > 0) {
    parts.push(`${summary.failed_payout_count} Failed`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

export default function OperatorTransactionsScreen() {
  const allowed = useRequireActiveOrganization('operator');
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [period, setPeriod] = useState<TransactionPeriod>('this_month');
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [rows, setRows] = useState<OperatorTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionPaymentType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TransactionPaymentStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const requestId = useRef(0);

  const load = useCallback((which: TransactionPeriod) => {
    const id = ++requestId.current;
    setError('');
    return fetchOperatorTransactions(which)
      .then((payload) => {
        if (id !== requestId.current) {
          return;
        }
        setSummary(payload.summary);
        setRows(payload.transactions);
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
            : 'Could not load your transactions.',
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
      if (allowed) {
        void load(period);
      }
    }, [allowed, load, period]),
  );

  function choosePeriod(next: TransactionPeriod) {
    if (next === period) {
      return;
    }
    setLoading(true);
    setSummary(null);
    setRows([]);
    setPeriod(next);
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (row.payment_status === 'pending') {
        return false;
      }
      if (typeFilter !== 'all' && row.payment_type !== typeFilter) {
        return false;
      }
      if (statusFilter !== 'all' && row.payment_status !== statusFilter) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return [row.booking_reference, row.passenger_name, row.boat_name].some((value) =>
        (value ?? '').toLowerCase().includes(needle),
      );
    });
  }, [rows, typeFilter, statusFilter, query]);

  if (!allowed) {
    return <View style={[styles.screen, { backgroundColor: colors.page }]} />;
  }

  const payout = summary ? payoutLine(summary) : null;

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
                void load(period);
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

          <Text style={[styles.title, { color: colors.navy }]}>Payment Transactions</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            View your confirmed rentals, passenger payments, and earnings.
          </Text>

          <View style={[styles.segment, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {PERIODS.map((item) => {
              const active = item.key === period;
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => choosePeriod(item.key)}
                  style={[styles.segmentItem, active && { backgroundColor: colors.blue }]}>
                  <Text style={[styles.segmentText, { color: active ? '#FFFFFF' : colors.muted }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.summary, { backgroundColor: colors.blue }]}>
            <Text style={styles.summaryTitle}>My Earnings — {summary?.period_label ?? PERIODS.find((p) => p.key === period)?.label}</Text>
            {loading && !summary ? (
              <ActivityIndicator color="#FFFFFF" style={styles.summaryLoader} />
            ) : summary ? (
              <>
                <Text style={styles.summaryNet}>{summary.net_earnings_label}</Text>
                <Text style={styles.summaryNetLabel}>Net earnings</Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryCell}>
                    <Text style={styles.summaryCellValue}>{summary.verified_payments_label}</Text>
                    <Text style={styles.summaryCellLabel}>Verified passenger payments</Text>
                  </View>
                  <View style={styles.summaryCell}>
                    <Text style={styles.summaryCellValue}>{summary.commission_deducted_label}</Text>
                    <Text style={styles.summaryCellLabel}>Commission deducted</Text>
                  </View>
                </View>
                <View style={styles.payoutBox}>
                  <Ionicons name="wallet-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.payoutText}>{payout ?? 'No payout activity for this period yet.'}</Text>
                </View>
                <Text style={styles.formula}>{summary.formula}</Text>
              </>
            ) : (
              <Text style={styles.summaryCellLabel}>Earnings are unavailable right now.</Text>
            )}
          </View>

          <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={18} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search reference, passenger, or boat"
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
            {TYPE_FILTERS.map((item) => {
              const active = item.key === typeFilter;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setTypeFilter(item.key)}
                  style={[
                    styles.chip,
                    { borderColor: active ? colors.blue : colors.border, backgroundColor: active ? colors.blue : colors.card },
                  ]}>
                  <Text style={[styles.chipText, { color: active ? '#FFFFFF' : colors.navy }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
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
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.empty, { color: colors.muted }]}>
                {rows.length === 0
                  ? 'No rental payments for this period yet. Payments appear here once a passenger pays for one of your rentals.'
                  : 'No transactions match your search or filters.'}
              </Text>
            </View>
          ) : null}

          {visible.map((row) => {
            const look = paymentStatusLook(row.payment_status, isDark);
            const payoutLook = payoutStatusLook(row.payout_status, isDark);
            const awaiting = row.payment_status === 'awaiting';
            return (
              <View key={row.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.rowTop}>
                  <Text style={[styles.code, { color: colors.blue }]} numberOfLines={1}>
                    {row.booking_reference || `Booking #${row.booking_id}`}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: look.bg }]}>
                    <Text style={[styles.badgeText, { color: look.color }]}>{row.payment_status_label}</Text>
                  </View>
                </View>
                <Text style={[styles.passenger, { color: colors.navy }]}>{row.passenger_name || 'Passenger'}</Text>
                <Text style={[styles.meta, { color: colors.muted }]}>
                  {[row.boat_name, row.rental_date_label, row.rental_time_label].filter(Boolean).join(' · ')}
                </Text>
                <View style={styles.tagRow}>
                  <View style={[styles.tag, { backgroundColor: colors.iconBg }]}>
                    <Text style={[styles.tagText, { color: colors.blue }]}>{row.payment_type_label}</Text>
                  </View>
                  <Text style={[styles.bookingStatus, { color: colors.muted }]}>Booking: {row.booking_status_label}</Text>
                </View>

                <View style={[styles.lines, { borderTopColor: colors.border }]}>
                  <View style={styles.line}>
                    <Text style={[styles.lineLabel, { color: colors.muted }]}>Amount paid</Text>
                    <Text style={[styles.lineValue, { color: colors.navy }]}>
                      {awaiting ? 'Not paid yet' : row.amount_paid_label}
                    </Text>
                  </View>
                  <View style={styles.line}>
                    <Text style={[styles.lineLabel, { color: colors.muted }]}>
                      Commission{row.commission_rate > 0 ? ` (${row.commission_rate_label})` : ''}
                    </Text>
                    <Text style={[styles.lineValue, { color: colors.navy }]}>{row.commission_deducted_label ?? '—'}</Text>
                  </View>
                  <View style={styles.line}>
                    <Text style={[styles.lineLabel, { color: colors.muted }]}>Operator share</Text>
                    <Text style={[styles.lineValue, styles.share, { color: row.operator_share === null ? colors.muted : '#1FA971' }]}>
                      {row.operator_share_label ?? '—'}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFoot}>
                  {row.payout_label ? (
                    <View style={[styles.badge, { backgroundColor: payoutLook.bg }]}>
                      <Text style={[styles.badgeText, { color: payoutLook.color }]}>Payout: {row.payout_label}</Text>
                    </View>
                  ) : (
                    <View />
                  )}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: '/operator-transaction-details',
                        params: { bookingId: String(row.booking_id) },
                      })
                    }
                    style={({ pressed }) => [styles.detailsBtn, { borderColor: colors.blue }, pressed && { opacity: 0.7 }]}>
                    <Text style={[styles.detailsText, { color: colors.blue }]}>View Details</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
      <OperatorTabs active="transactions" />
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
    marginBottom: 18,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { marginTop: 6, marginBottom: 16, fontSize: 14, lineHeight: 20 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 4, marginBottom: 14 },
  segmentItem: { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  segmentText: { fontSize: 13, fontWeight: '700' },
  summary: { borderRadius: 20, padding: 18, marginBottom: 16 },
  summaryTitle: { color: '#DCE8FF', fontSize: 13, fontWeight: '700' },
  summaryLoader: { marginVertical: 28 },
  summaryNet: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', marginTop: 8 },
  summaryNetLabel: { color: '#DCE8FF', fontSize: 12, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  summaryCell: { flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 14, padding: 12 },
  summaryCellValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  summaryCellLabel: { color: '#DCE8FF', fontSize: 11, fontWeight: '600', marginTop: 2 },
  payoutBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12,
    padding: 10,
  },
  payoutText: { flex: 1, color: '#FFFFFF', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  formula: { color: '#DCE8FF', fontSize: 11, marginTop: 10 },
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
  chips: { gap: 8, paddingBottom: 10 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { fontSize: 12, fontWeight: '700' },
  loader: { marginVertical: 24 },
  error: { color: '#E25C5C', marginBottom: 12, fontWeight: '600' },
  empty: { fontSize: 14, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  code: { flex: 1, fontSize: 15, fontWeight: '800' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  passenger: { marginTop: 8, fontSize: 16, fontWeight: '700' },
  meta: { marginTop: 2, fontSize: 13 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  tag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11, fontWeight: '800' },
  bookingStatus: { fontSize: 12, fontWeight: '600' },
  lines: { borderTopWidth: 1, marginTop: 12, paddingTop: 10, gap: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  lineLabel: { fontSize: 13 },
  lineValue: { fontSize: 13, fontWeight: '700' },
  share: { fontSize: 14 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 8 },
  detailsBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  detailsText: { fontSize: 12, fontWeight: '800' },
});
