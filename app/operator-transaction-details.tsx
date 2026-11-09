import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/lib/api';
import { getApiBaseUrl } from '@/lib/config';
import { useRequireActiveOrganization } from '@/lib/organization-access';
import {
  fetchOperatorTransaction,
  paymentStatusLook,
  payoutStatusLook,
  type OperatorTransaction,
  type OperatorTransactionDetail,
} from '@/lib/operator-transactions';
import { getToken } from '@/lib/session';
import { useAppTheme } from '@/lib/theme';

type Colors = ReturnType<typeof useAppTheme>['colors'];

function Row({ label, value, colors, strong }: { label: string; value: ReactNode; colors: Colors; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.muted }]}>{label}</Text>
      {typeof value === 'string' ? (
        <Text style={[styles.rowValue, { color: colors.navy }, strong && styles.rowStrong]}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

function Section({ title, colors, children }: { title: string; colors: Colors; children: ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.navy }]}>{title}</Text>
      {children}
    </View>
  );
}

function payoutReference(reference: string | null): string | null {
  if (!reference) {
    return null;
  }
  return reference.startsWith('xendit:') ? reference.slice('xendit:'.length) : reference;
}

export default function OperatorTransactionDetailsScreen() {
  const allowed = useRequireActiveOrganization('operator');
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const bookingId = Number(params.bookingId);
  const [detail, setDetail] = useState<OperatorTransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) {
        return;
      }
      if (!Number.isInteger(bookingId) || bookingId <= 0) {
        setError('This transaction could not be found.');
        setLoading(false);
        return;
      }
      setError('');
      getToken().then(setToken);
      fetchOperatorTransaction(bookingId)
        .then(setDetail)
        .catch((err) => {
          setError(
            err instanceof ApiError
              ? err.status === 404
                ? 'This transaction is not available to your account.'
                : err.status === 0
                  ? 'No connection. Check your internet and try again.'
                  : err.firstError()
              : 'Could not load this transaction.',
          );
        })
        .finally(() => setLoading(false));
    }, [allowed, bookingId]),
  );

  if (!allowed) {
    return <View style={[styles.screen, { backgroundColor: colors.page }]} />;
  }

  const booking = detail?.booking;
  const earnings = detail?.earnings;
  const initialPayments = detail?.payments.filter((p) => p.payment_type !== 'balance') ?? [];
  const balancePayments = detail?.payments.filter((p) => p.payment_type === 'balance') ?? [];
  const receiptSource =
    detail?.receipt_url && token
      ? { uri: `${getApiBaseUrl()}${detail.receipt_url}`, headers: { Authorization: `Bearer ${token}` } }
      : null;
  const payoutLook = payoutStatusLook(earnings?.payout_status ?? null, isDark);
  const reference = earnings?.payout_status === 'paid_out' ? payoutReference(earnings.payout_reference) : null;

  function renderPayment(payment: OperatorTransaction) {
    const look = paymentStatusLook(payment.payment_status, isDark);
    const awaiting = payment.payment_status === 'awaiting';
    const settled = payment.payment_status === 'verified' || payment.payment_status === 'refunded';
    return (
      <View key={payment.id} style={[styles.payment, { borderColor: colors.border }]}>
        <View style={styles.paymentTop}>
          <Text style={[styles.paymentType, { color: colors.navy }]}>{payment.payment_type_label}</Text>
          <View style={[styles.badge, { backgroundColor: look.bg }]}>
            <Text style={[styles.badgeText, { color: look.color }]}>{payment.payment_status_label}</Text>
          </View>
        </View>
        <Row label="Amount" value={awaiting ? 'Not paid yet' : payment.amount_paid_label} colors={colors} strong />
        {payment.payment_method_label ? <Row label="Method" value={payment.payment_method_label} colors={colors} /> : null}
        {payment.received_by_label && !awaiting ? <Row label="Sent to" value={payment.received_by_label} colors={colors} /> : null}
        {payment.paid_at_label && !awaiting ? (
          <Row label={settled ? 'Paid on' : 'Submitted on'} value={payment.paid_at_label} colors={colors} />
        ) : null}
        {payment.transaction_id ? <Row label="Transaction ID" value={payment.transaction_id} colors={colors} /> : null}
        {payment.commission_deducted_label ? (
          <Row label="Commission" value={payment.commission_deducted_label} colors={colors} />
        ) : null}
        {payment.operator_share_label ? (
          <Row
            label="Your share"
            value={<Text style={[styles.rowValue, styles.rowStrong, { color: '#1FA971' }]}>{payment.operator_share_label}</Text>}
            colors={colors}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.headerBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/operator-transactions'))}>
            <Ionicons name="chevron-back" size={26} color={colors.navy} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.navy }]}>Rental Transaction Details</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {loading && !detail ? <ActivityIndicator color={colors.blue} style={styles.loader} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {booking && earnings && detail ? (
            <>
              <Section title="Booking Information" colors={colors}>
                <Row label="Reference" value={booking.reference || `Booking #${booking.id}`} colors={colors} strong />
                <Row label="Booking status" value={booking.status_label} colors={colors} />
                <Row label="Passenger" value={booking.passenger_name || 'Passenger'} colors={colors} />
                {booking.passenger_contact ? <Row label="Contact" value={booking.passenger_contact} colors={colors} /> : null}
                {booking.boat_name ? <Row label="Boat" value={booking.boat_name} colors={colors} /> : null}
                {booking.rental_type ? <Row label="Rental type" value={booking.rental_type} colors={colors} /> : null}
                {booking.origin ? <Row label="Pickup" value={booking.origin} colors={colors} /> : null}
                {booking.destination ? <Row label="Destination" value={booking.destination} colors={colors} /> : null}
                {booking.passenger_count ? (
                  <Row label="Passengers" value={String(booking.passenger_count)} colors={colors} />
                ) : null}
                {booking.rental_date_label ? <Row label="Rental date" value={booking.rental_date_label} colors={colors} /> : null}
                {booking.departure_time_label ? (
                  <Row label="Departure" value={booking.departure_time_label} colors={colors} />
                ) : null}
                <Row label="Rental price" value={booking.rental_price_label} colors={colors} />
                {booking.approved_at_label ? <Row label="Approved on" value={booking.approved_at_label} colors={colors} /> : null}
                <Text style={[styles.note, { color: colors.muted }]}>
                  Booking status shows the rental&apos;s progress. Payment status is listed separately below.
                </Text>
              </Section>

              <Section title="Payment Details" colors={colors}>
                <Text style={[styles.groupTitle, { color: colors.muted }]}>Downpayment / Full Payment</Text>
                {initialPayments.length > 0 ? (
                  initialPayments.map(renderPayment)
                ) : (
                  <Text style={[styles.note, { color: colors.muted }]}>No downpayment recorded yet.</Text>
                )}
                <Text style={[styles.groupTitle, { color: colors.muted }]}>Balance Payment</Text>
                {balancePayments.length > 0 ? (
                  balancePayments.map(renderPayment)
                ) : (
                  <Text style={[styles.note, { color: colors.muted }]}>
                    {earnings.remaining_balance > 0
                      ? `Remaining balance of ${earnings.remaining_balance_label} not yet paid.`
                      : 'No separate balance payment for this rental.'}
                  </Text>
                )}
              </Section>

              <Section title="Earnings Breakdown" colors={colors}>
                <Row label="Rental total" value={earnings.rental_total_label} colors={colors} />
                <Row label="Verified passenger payments" value={earnings.verified_paid_label} colors={colors} />
                <Row label="Remaining balance" value={earnings.remaining_balance_label} colors={colors} />
                <Row label={`Commission (${earnings.commission_rate_label})`} value={earnings.commission_deducted_label} colors={colors} />
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Row
                  label="Your net earnings"
                  value={<Text style={[styles.net, { color: '#1FA971' }]}>{earnings.operator_net_label}</Text>}
                  colors={colors}
                />
                {earnings.basis ? <Text style={[styles.note, { color: colors.muted }]}>{earnings.basis}</Text> : null}
                {earnings.reversed ? (
                  <Text style={[styles.note, { color: '#E25C5C' }]}>
                    This rental was refunded, so no commission or earnings are counted.
                  </Text>
                ) : null}
                {earnings.payout_label ? (
                  <>
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <Row
                      label="Payout status"
                      value={
                        <View style={[styles.badge, { backgroundColor: payoutLook.bg }]}>
                          <Text style={[styles.badgeText, { color: payoutLook.color }]}>{earnings.payout_label}</Text>
                        </View>
                      }
                      colors={colors}
                    />
                    {earnings.payout_at_label ? <Row label="Paid out on" value={earnings.payout_at_label} colors={colors} /> : null}
                    {reference ? <Row label="Payout reference" value={reference} colors={colors} /> : null}
                  </>
                ) : null}
              </Section>

              <Section title="Timeline" colors={colors}>
                {detail.timeline.length === 0 ? (
                  <Text style={[styles.note, { color: colors.muted }]}>No recorded events yet.</Text>
                ) : (
                  detail.timeline.map((step, index) => (
                    <View key={`${step.label}-${index}`} style={styles.step}>
                      <View style={styles.stepRail}>
                        <View style={[styles.stepDot, { backgroundColor: colors.blue }]} />
                        {index < detail.timeline.length - 1 ? (
                          <View style={[styles.stepLine, { backgroundColor: colors.border }]} />
                        ) : null}
                      </View>
                      <View style={styles.stepBody}>
                        <Text style={[styles.stepLabel, { color: colors.navy }]}>{step.label}</Text>
                        <Text style={[styles.stepAt, { color: colors.muted }]}>{step.at_label}</Text>
                      </View>
                    </View>
                  ))
                )}
              </Section>

              {receiptSource ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setReceiptOpen(true)}
                  style={({ pressed }) => [styles.receiptBtn, { backgroundColor: colors.blue }, pressed && { opacity: 0.85 }]}>
                  <Ionicons name="receipt-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.receiptText}>View Payment Receipt</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={receiptOpen} transparent animationType="fade" onRequestClose={() => setReceiptOpen(false)}>
        <View style={styles.viewer}>
          <Pressable
            hitSlop={12}
            accessibilityLabel="Close receipt"
            style={styles.viewerClose}
            onPress={() => setReceiptOpen(false)}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
          {receiptSource ? <Image source={receiptSource} style={styles.viewerImage} contentFit="contain" /> : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800' },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  loader: { marginVertical: 32 },
  error: { color: '#E25C5C', marginVertical: 12, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 4 },
  rowLabel: { fontSize: 13, flexShrink: 0 },
  rowValue: { fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  rowStrong: { fontWeight: '800' },
  note: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  groupTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginTop: 6, marginBottom: 6 },
  payment: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  paymentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  paymentType: { fontSize: 14, fontWeight: '800' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  divider: { height: 1, marginVertical: 8 },
  net: { fontSize: 18, fontWeight: '800' },
  step: { flexDirection: 'row', gap: 12 },
  stepRail: { alignItems: 'center', width: 12 },
  stepDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  stepLine: { width: 2, flex: 1, marginVertical: 2 },
  stepBody: { flex: 1, paddingBottom: 14 },
  stepLabel: { fontSize: 14, fontWeight: '700' },
  stepAt: { fontSize: 12, marginTop: 2 },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
  },
  receiptText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
  viewerClose: { position: 'absolute', top: 48, right: 20, zIndex: 2 },
  viewerImage: { width: '100%', height: '80%' },
});
