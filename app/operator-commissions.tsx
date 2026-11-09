import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLockup } from '@/components/brand-lockup';
import { NotificationBell } from '@/components/notification-bell';
import { OperatorMetricCard } from '@/components/operator-metric-card';
import { OperatorTabs } from '@/components/operator-tabs';
import { SideMenu } from '@/components/side-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { ApiError } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { useRequireActiveOrganization } from '@/lib/organization-access';
import {
  fetchCommissions,
  isCommissionOverdue,
  unpaidCommissions,
  type CommissionStatus,
  type OperatorCommission,
} from '@/lib/commissions';
import { exportCommissionReport } from '@/lib/operator-export';
import { modal } from '@/lib/modal-theme';
import { useAppTheme } from '@/lib/theme';
import type { AuthUser } from '@/lib/types';

function statusLook(status: CommissionStatus, isDark: boolean) {
  if (status === 'paid' || status === 'collected_with_rental') {
    return { color: '#1FA971', bg: isDark ? '#163528' : '#DFF6EA' };
  }
  if (status === 'waived') {
    return { color: '#64748B', bg: isDark ? '#243044' : '#EEF1F6' };
  }
  if (status === 'awaiting_verification') {
    return { color: '#1A5AD7', bg: isDark ? '#1B2C4D' : '#E8F1FF' };
  }
  if (status === 'rejected') {
    return { color: '#E25C5C', bg: isDark ? '#3A2224' : '#FDECEC' };
  }
  return { color: '#F07A3A', bg: isDark ? '#3D2A1C' : '#FDE8DC' };
}

export default function OperatorCommissionsScreen() {
  const allowed = useRequireActiveOrganization('operator');
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState<OperatorCommission[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState('');

  const load = useCallback(() => {
    setError('');
    fetchCommissions()
      .then(setItems)
      .catch((err) => {
        setError(err instanceof ApiError ? err.firstError() : 'Could not load commission settlements.');
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      getStoredUser().then(setUser);
      load();
    }, [load]),
  );

  async function handleExport() {
    if (exporting) {
      return;
    }
    setExporting(true);
    try {
      const result = await exportCommissionReport(items, user);
      setExportNotice(
        result === 'saved'
          ? 'Commission PDF saved to the folder you selected.'
          : 'Commission PDF is ready. Use the share sheet to save or send it.',
      );
    } catch (err) {
      setExportNotice(err instanceof Error ? err.message : 'Could not export commissions.');
    } finally {
      setExporting(false);
    }
  }

  const dueItems = useMemo(() => unpaidCommissions(items), [items]);
  const pending = dueItems.length;
  const overdue = useMemo(() => dueItems.filter(isCommissionOverdue).length, [dueItems]);

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
            </View>
          </View>

          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.navy, flex: 1 }]}>Commission Settlement</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Export commissions"
              disabled={exporting || loading || items.length === 0}
              onPress={() => void handleExport()}
              style={({ pressed }) => [
                styles.exportBtn,
                { backgroundColor: colors.blue, opacity: exporting || items.length === 0 ? 0.5 : 1 },
                pressed && items.length > 0 && !exporting ? { opacity: 0.85 } : null,
              ]}>
              {exporting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.exportText}>Export</Text>
                </>
              )}
            </Pressable>
          </View>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Only for older rentals where the passenger paid you directly. Send the barangay share to the official
            GCash account after the trip. New rentals are paid to the barangay, and your share is released to you
            after the trip (see Earnings & Payouts). Overdue shares may limit new private rentals.
          </Text>

          <OperatorMetricCard
            label="Need settlement"
            value={pending}
            icon="alert-circle-outline"
            color="#F07A3A"
            softBg={isDark ? '#3D2A1C' : '#FDE8DC'}
            style={styles.stat}
          />

          {pending > 0 ? (
            <View
              style={[
                styles.warn,
                {
                  backgroundColor: isDark ? '#3D2A1C' : '#FFF4EA',
                  borderColor: isDark ? '#8A6A32' : '#F0C48A',
                },
              ]}>
              <Ionicons name="warning-outline" size={18} color="#F07A3A" />
              <Text style={[styles.warnText, { color: isDark ? '#F6E7C8' : '#5C4318' }]}>
                {overdue > 0
                  ? `${overdue} barangay share${overdue === 1 ? '' : 's'} overdue. Please pay today so verification is not delayed.`
                  : 'Please settle unpaid barangay shares today so they are not forgotten.'}
              </Text>
            </View>
          ) : null}

          {loading ? <ActivityIndicator color={colors.blue} style={styles.loader} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {!loading && items.length === 0 ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.empty, { color: colors.muted }]}>
                No exclusive-rental commissions yet. Records appear here after a rental is completed and fully paid.
              </Text>
            </View>
          ) : null}

          {items.map((item) => {
            const look = statusLook(item.status, isDark);
            return (
              <Pressable
                key={item.id}
                onPress={() => router.push({ pathname: '/commission-settle', params: { id: String(item.id) } })}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.rowTop}>
                  <Text style={[styles.code, { color: colors.blue }]}>{item.code || `COMM-${item.id}`}</Text>
                  <View style={[styles.badge, { backgroundColor: look.bg }]}>
                    <Text style={[styles.badgeText, { color: look.color }]}>{item.status_label}</Text>
                  </View>
                </View>
                <Text style={[styles.boat, { color: colors.navy }]}>{item.boat_name || 'Boat'}</Text>
                <Text style={[styles.meta, { color: colors.muted }]}>
                  {item.rental_date_label || item.rental_date} · {item.rental_amount_label}
                </Text>
                <Text style={[styles.amount, { color: colors.navy }]}>
                  Amount due {item.commission_amount_label} ({item.commission_percentage_label})
                </Text>
                {isCommissionOverdue(item) ? (
                  <Text style={styles.overdue}>Overdue — please settle today</Text>
                ) : null}
                {item.rejection_reason ? (
                  <Text style={styles.reject}>Rejected: {item.rejection_reason}</Text>
                ) : null}
                <Text style={[styles.action, { color: colors.blue }]}>
                  {item.can_submit ? 'Submit payment' : 'View details'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
      <OperatorTabs active="profile" />
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
      <Modal visible={Boolean(exportNotice)} transparent animationType="fade" onRequestClose={() => setExportNotice('')}>
        <View style={styles.noticeOverlay}>
          <View style={[styles.noticeCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.noticeTitle, { color: colors.navy }]}>Export</Text>
            <Text style={[styles.noticeBody, { color: colors.muted }]}>{exportNotice}</Text>
            <Pressable
              onPress={() => setExportNotice('')}
              style={({ pressed }) => [styles.noticeBtn, { backgroundColor: colors.blue }, pressed && { opacity: 0.85 }]}>
              <Text style={styles.exportText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 28, fontWeight: '800' },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 92,
    justifyContent: 'center',
  },
  exportText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  subtitle: { marginTop: 6, marginBottom: 16, fontSize: 14, lineHeight: 20 },
  noticeOverlay: modal.overlay,
  noticeCard: modal.card,
  noticeTitle: modal.title,
  noticeBody: modal.body,
  noticeBtn: modal.btnFull,
  stat: { marginBottom: 14 },
  loader: { marginVertical: 24 },
  error: { color: '#E25C5C', marginBottom: 12, fontWeight: '600' },
  empty: { fontSize: 14, lineHeight: 20 },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  code: { fontSize: 15, fontWeight: '800' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  boat: { marginTop: 8, fontSize: 16, fontWeight: '700' },
  meta: { marginTop: 4, fontSize: 13 },
  amount: { marginTop: 8, fontSize: 14, fontWeight: '700' },
  overdue: { marginTop: 8, color: '#F07A3A', fontSize: 13, fontWeight: '700' },
  reject: { marginTop: 8, color: '#E25C5C', fontSize: 13 },
  warn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  warnText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  action: { marginTop: 10, fontSize: 13, fontWeight: '700' },
});
