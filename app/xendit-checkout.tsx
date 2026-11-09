import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND_BLUE } from '@/components/brand-lockup';
import { RentalPolicySection } from '@/components/rental-policy-section';
import { ApiError } from '@/lib/api';
import { fetchBooking } from '@/lib/bookings';
import { passengerName } from '@/lib/operator';
import { modal } from '@/lib/modal-theme';
import { useAppTheme } from '@/lib/theme';
import type { MobileBooking } from '@/lib/types';
import {
  checkoutPlanFor,
  isCancelledXenditReturn,
  isXenditPaymentConfirmed,
  onlinePaymentFor,
  openXenditGcashBrowser,
  pollUntilXenditConfirmed,
  resolveCheckoutUrl,
  xenditAppReturnUrl,
  type XenditPaymentPlan,
} from '@/lib/xendit-payment-flow';

function normalizePlan(raw?: string): XenditPaymentPlan {
  if (raw === 'full_rental' || raw === 'full_payment') {
    return raw;
  }

  return 'downpayment';
}

function planLabel(plan: XenditPaymentPlan): string {
  if (plan === 'full_rental') {
    return 'Full rental payment';
  }
  if (plan === 'full_payment') {
    return 'Remaining balance';
  }
  return 'Down payment';
}

export default function XenditCheckoutScreen() {
  const router = useRouter();
  const { isDark, colors } = useAppTheme();
  const params = useLocalSearchParams<{ id?: string; plan?: string; verify?: string }>();
  const bookingId = Number(params.id);
  const shouldVerifyOnLoad = params.verify === '1';

  const [booking, setBooking] = useState<MobileBooking | null>(null);
  const [loading, setLoading] = useState(Boolean(bookingId));
  const [continuing, setContinuing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [policyAgreed, setPolicyAgreed] = useState(false);
  const verifyStarted = useRef(false);

  const requestedPlan = typeof params.plan === 'string' ? params.plan : undefined;
  const pendingPlan = onlinePaymentFor(booking)?.checkout_pending
    ? onlinePaymentFor(booking)?.checkout_payment_type
    : undefined;
  const plan = normalizePlan(requestedPlan ?? pendingPlan ?? undefined);
  const breakdown = booking ? checkoutPlanFor(booking, plan) : null;
  const policy = booking?.checkout_policy;

  useEffect(() => {
    if (!bookingId) {
      return;
    }

    fetchBooking(bookingId)
      .then((data) => {
        setBooking(data);
        setPolicyAgreed(Boolean(data.checkout_policy?.accepted));
      })
      .catch((err) => Alert.alert('Could not load rental', err instanceof ApiError ? err.firstError() : 'Try again.'))
      .finally(() => setLoading(false));
  }, [bookingId]);

  const goToSuccess = useCallback(
    (updated: MobileBooking) => {
      router.replace({
        pathname: '/xendit-payment-success',
        params: { id: String(updated.id), plan },
      });
    },
    [plan, router],
  );

  const runVerificationPoll = useCallback(async () => {
    if (!bookingId) {
      return;
    }

    setVerifying(true);
    try {
      const result = await pollUntilXenditConfirmed(bookingId, plan);
      if (result.status === 'confirmed') {
        goToSuccess(result.booking);
        return;
      }
      setBooking(result.booking);
      Alert.alert(
        'Still confirming',
        'GCash has not confirmed your payment yet. Check your rental again in a minute. You will not be charged twice.',
      );
    } catch (err) {
      Alert.alert('Could not verify payment', err instanceof ApiError ? err.firstError() : 'Check your connection and try again.');
    } finally {
      setVerifying(false);
    }
  }, [bookingId, goToSuccess, plan]);

  useEffect(() => {
    if (!shouldVerifyOnLoad || !booking || verifyStarted.current) {
      return;
    }

    if (isXenditPaymentConfirmed(booking, plan)) {
      verifyStarted.current = true;
      goToSuccess(booking);
      return;
    }

    const timer = setTimeout(() => {
      verifyStarted.current = true;
      void runVerificationPoll();
    }, 0);
    return () => clearTimeout(timer);
  }, [booking, goToSuccess, plan, runVerificationPoll, shouldVerifyOnLoad]);

  async function onContinue() {
    if (!booking || !bookingId || continuing || verifying) {
      return;
    }

    if (policy && !policyAgreed) {
      Alert.alert('Accept the policy', 'Read and accept the Cancellation, Refund & No-Show Policy before paying.');
      return;
    }

    const pay = onlinePaymentFor(booking);
    const successReturn = pay?.success_return_url?.trim();
    const policyVersion = policy?.version ?? pay?.checkout_policy_version ?? '';

    if (!successReturn) {
      Alert.alert('Cannot start GCash', 'Server return URL is not configured (XENDIT_SUCCESS_REDIRECT_URL).');
      return;
    }

    setContinuing(true);
    try {
      const appReturn = xenditAppReturnUrl();
      const checkoutUrl = await resolveCheckoutUrl(bookingId, plan, pay, policyVersion, appReturn);
      const result = await openXenditGcashBrowser(checkoutUrl, appReturn);
      if (isCancelledXenditReturn(result)) {
        Alert.alert('Payment not completed', 'GCash checkout was cancelled. You can try again when ready.');
        return;
      }
      await runVerificationPoll();
    } catch (err) {
      Alert.alert(
        'Could not start checkout',
        err instanceof ApiError ? err.firstError() : err instanceof Error ? err.message : 'Try again.',
      );
    } finally {
      setContinuing(false);
    }
  }

  const bg = isDark ? '#0E1628' : '#F4F7FB';

  if (loading || !booking) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
        {loading ? (
          <ActivityIndicator size="large" color={BRAND_BLUE} style={{ marginTop: 48 }} />
        ) : (
          <Text style={[styles.empty, { color: colors.muted }]}>This rental could not be loaded.</Text>
        )}
      </SafeAreaView>
    );
  }

  const busy = continuing || verifying;
  const youPay = breakdown?.amount_to_pay_now_label || breakdown?.passenger_pays_label || '—';
  const receiver = booking.checkout_context?.payment_receiver_name || 'your barangay';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.header}>
        <Pressable hitSlop={12} style={styles.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={colors.navy} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Checkout</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.totalCard, { backgroundColor: BRAND_BLUE }]}>
          <Text style={styles.totalCardLabel}>You pay now · {planLabel(plan)}</Text>
          <Text style={styles.totalCardValue}>{youPay}</Text>
          <View style={styles.totalCardRow}>
            <Ionicons name="shield-checkmark" size={14} color="#DCE8FF" />
            <Text style={styles.totalCardHint}>Paid to {receiver}</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SectionTitle icon="boat-outline" title="Rental" colors={colors} />
          <Row label="Reference" value={booking.code} colors={colors} accent />
          <Row label="Passenger" value={passengerName(booking)} colors={colors} />
          <Row label="Boat" value={booking.boat.name} colors={colors} />
          <Row label="Trip" value={`${booking.booking_date_label} · ${booking.start_time_label || '—'}`} colors={colors} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SectionTitle icon="receipt-outline" title="Payment Summary" colors={colors} />
          {breakdown ? (
            <>
              <Row label="Total rental price" value={breakdown.rental_price_label} colors={colors} />
              {plan === 'downpayment' ? (
                <Row label="Down payment (now)" value={youPay} colors={colors} />
              ) : null}
              {plan === 'downpayment' && breakdown.remaining_balance_label ? (
                <Row label="Pay on trip day" value={breakdown.remaining_balance_label} colors={colors} />
              ) : null}
            </>
          ) : null}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.navy }]}>You pay now</Text>
            <Text style={styles.totalValue}>{youPay}</Text>
          </View>
          {breakdown && (breakdown.total_rental_commission_label || breakdown.commission_label) ? (
            <Text style={[styles.note, { color: colors.muted }]}>
              The rental price already includes the barangay fee of{' '}
              {breakdown.total_rental_commission_label || breakdown.commission_label}.
            </Text>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SectionTitle icon="wallet-outline" title="Payment Method" colors={colors} />
          <View style={[styles.method, { borderColor: BRAND_BLUE, backgroundColor: isDark ? '#1B2C4D' : '#E8F1FF' }]}>
            <View style={styles.methodIcon}>
              <Text style={styles.methodLetter}>G</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.methodTitle, { color: colors.navy }]}>GCash</Text>
              <Text style={[styles.methodSub, { color: colors.muted }]}>Secured by Xendit</Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color={BRAND_BLUE} />
          </View>
          <Row label="Paid to" value={receiver} colors={colors} />

          <Text style={[styles.stepsTitle, { color: colors.navy }]}>How it works</Text>
          {[
            'Tap Continue to GCash below.',
            'Log in to GCash and approve the payment.',
            'Return to SafeSakay. Your rental updates automatically.',
          ].map((step, index) => (
            <View key={step} style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: isDark ? '#1B2C4D' : '#E8F1FF' }]}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.navy }]}>{step}</Text>
            </View>
          ))}
        </View>

        {policy ? (
          <RentalPolicySection
            bookingId={bookingId}
            policy={policy}
            agreed={policyAgreed}
            onAgreedChange={setPolicyAgreed}
          />
        ) : null}

        {policy && !policyAgreed ? (
          <Text style={[styles.payHint, { color: colors.muted }]}>
            Read and accept the policy above to continue.
          </Text>
        ) : null}
        <Pressable
          disabled={busy}
          onPress={() => void onContinue()}
          style={({ pressed }) => [
            styles.payBtn,
            { opacity: busy || (policy && !policyAgreed) ? 0.55 : pressed ? 0.9 : 1 },
          ]}>
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.payText}>Continue to GCash · {youPay}</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </>
          )}
        </Pressable>
        <Text style={[styles.secureNote, { color: colors.muted }]}>
          <Ionicons name="lock-closed" size={11} color={colors.muted} /> Payments are processed securely by Xendit, a
          licensed payment provider.
        </Text>
      </ScrollView>

      <Modal visible={verifying} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.verifyCard, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="large" color={BRAND_BLUE} />
            <Text style={[styles.verifyTitle, { color: colors.navy }]}>Verifying your payment</Text>
            <Text style={[styles.verifyBody, { color: colors.muted }]}>
              Please don&apos;t close the app.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SectionTitle({
  icon,
  title,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  colors: { navy: string; iconBg: string; blue: string };
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={[styles.sectionIcon, { backgroundColor: colors.iconBg }]}>
        <Ionicons name={icon} size={16} color={colors.blue} />
      </View>
      <Text style={[styles.cardTitle, { color: colors.navy }]}>{title}</Text>
    </View>
  );
}

function Row({
  label,
  value,
  colors,
  accent,
}: {
  label: string;
  value: string;
  colors: { navy: string; muted: string };
  accent?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: accent ? BRAND_BLUE : colors.navy }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  empty: { marginTop: 48, textAlign: 'center', fontSize: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  back: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  scroll: { padding: 16, paddingBottom: 32 },
  card: { borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 14 },
  totalCard: { borderRadius: 20, padding: 18, marginBottom: 14 },
  totalCardLabel: { color: '#DCE8FF', fontSize: 13, fontWeight: '700' },
  totalCardValue: { color: '#FFFFFF', fontSize: 32, fontWeight: '900', marginTop: 4 },
  totalCardRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  totalCardHint: { color: '#DCE8FF', fontSize: 12, fontWeight: '700' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  stepsTitle: { fontSize: 14, fontWeight: '800', marginTop: 12, marginBottom: 6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  stepNumber: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: BRAND_BLUE, fontSize: 12, fontWeight: '900' },
  stepText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  methodLetter: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  payHint: { textAlign: 'center', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  secureNote: { textAlign: 'center', fontSize: 11, lineHeight: 16, marginTop: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 9 },
  rowLabel: { flex: 1, fontSize: 14 },
  rowValue: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '800' },
  divider: { height: 1, marginVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  totalLabel: { fontSize: 16, fontWeight: '800' },
  totalValue: { fontSize: 26, fontWeight: '900', color: BRAND_BLUE },
  method: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 14 },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: BRAND_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodTitle: { fontSize: 16, fontWeight: '800' },
  methodSub: { marginTop: 2, fontSize: 13 },
  note: { marginTop: 12, fontSize: 13, lineHeight: 19 },
  payBtn: {
    backgroundColor: BRAND_BLUE,
    borderRadius: 16,
    minHeight: 56,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  payText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  overlay: modal.overlay,
  verifyCard: { ...modal.card, gap: 10 },
  verifyTitle: modal.title,
  verifyBody: { ...modal.body, marginTop: 0 },
});
