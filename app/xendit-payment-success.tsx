import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLockup, BRAND_BLUE } from '@/components/brand-lockup';
import { ApiError } from '@/lib/api';
import { downloadXenditPaymentReceipt } from '@/lib/booking-slip';
import { fetchBooking } from '@/lib/bookings';
import { useAppTheme } from '@/lib/theme';
import type { MobileBooking, XenditPaymentReceipt } from '@/lib/types';
import { onlinePaymentFor } from '@/lib/xendit-payment-flow';

const BLUE = BRAND_BLUE;
const GREEN = '#1FA971';

export default function XenditPaymentSuccessScreen() {
  const router = useRouter();
  const { isDark } = useAppTheme();
  const params = useLocalSearchParams<{ id?: string; plan?: string }>();
  const bookingId = Number(params.id);

  const [booking, setBooking] = useState<MobileBooking | null>(null);
  const [loading, setLoading] = useState(Boolean(bookingId));
  const [receiptBusy, setReceiptBusy] = useState(false);

  const colors = useMemo(
    () => ({
      navy: isDark ? '#E8F1FF' : '#163A5F',
      muted: isDark ? '#9BB0CC' : '#5A7088',
      border: isDark ? '#2A3F5C' : '#D7E4F5',
      card: isDark ? '#152238' : '#FFFFFF',
      bg: isDark ? '#0E1628' : '#F4F7FB',
    }),
    [isDark],
  );

  useEffect(() => {
    if (!bookingId) {
      return;
    }

    void fetchBooking(bookingId)
      .then(setBooking)
      .catch((err) => {
        Alert.alert(
          'Could not load rental',
          err instanceof ApiError ? err.firstError() : 'Please try again.',
        );
      })
      .finally(() => setLoading(false));
  }, [bookingId]);

  const receipt: XenditPaymentReceipt | null = onlinePaymentFor(booking)?.payment_receipt ?? null;

  function onBackToRental() {
    const id = booking?.id ?? bookingId;
    if (id) {
      router.replace({ pathname: '/booking-details', params: { id: String(id) } });
      return;
    }
    router.replace('/homepage');
  }

  async function onViewReceipt() {
    if (receiptBusy) {
      return;
    }

    setReceiptBusy(true);
    try {
      let current = booking;
      let currentReceipt = receipt;
      if ((!current || !currentReceipt) && bookingId) {
        current = await fetchBooking(bookingId);
        setBooking(current);
        currentReceipt = onlinePaymentFor(current)?.payment_receipt ?? null;
      }
      if (!current || !currentReceipt) {
        Alert.alert('Receipt unavailable', 'Payment details are still syncing. Try again shortly.');
        return;
      }
      await downloadXenditPaymentReceipt(current, currentReceipt);
    } catch (err) {
      Alert.alert(
        'Could not create receipt',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setReceiptBusy(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={BLUE} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <BrandLockup variant="compact" />
          <View style={styles.successIconWrap}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={36} color="#FFF" />
            </View>
          </View>
          <Text style={[styles.title, { color: colors.navy }]}>Payment successful</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            Your GCash payment is confirmed. Your rental has been updated.
          </Text>

          <View style={[styles.amountBox, { backgroundColor: isDark ? '#1B2C4D' : '#E8F4FC' }]}>
            <Text style={[styles.amountLabel, { color: colors.muted }]}>Amount paid</Text>
            <Text style={[styles.amountValue, { color: BLUE }]}>
              {receipt?.amount_label ?? booking?.total_paid_label ?? '—'}
            </Text>
            <Text style={[styles.amountLabel, { color: colors.muted, marginTop: 4 }]}>
              {paymentTypeLabel(receipt?.payment_type ?? params.plan)} · GCash
            </Text>
          </View>

          <View style={[styles.details, { borderColor: colors.border }]}>
            <ReceiptRow
              label="Paid to"
              value={booking?.checkout_context?.payment_receiver_name ?? 'SafeSakay'}
              colors={colors}
            />
            <ReceiptRow label="Booking reference" value={receipt?.booking_code ?? booking?.code ?? '—'} colors={colors} />
            <ReceiptRow label="Date & time" value={receipt?.paid_at_label ?? '—'} colors={colors} />
            {booking?.remaining_balance_label && (receipt?.payment_type ?? params.plan) === 'downpayment' ? (
              <ReceiptRow label="Pay on trip day" value={booking.remaining_balance_label} colors={colors} />
            ) : null}
            <ReceiptRow label="Transaction ID" value={receipt?.provider_payment_id ?? '—'} colors={colors} small last />
          </View>

          <Pressable
            disabled={receiptBusy}
            onPress={() => void onViewReceipt()}
            style={({ pressed }) => [
              styles.outlineBtn,
              { borderColor: BLUE, opacity: receiptBusy ? 0.6 : pressed ? 0.88 : 1 },
            ]}>
            <Ionicons name="document-text-outline" size={18} color={BLUE} />
            <Text style={[styles.outlineBtnText, { color: BLUE }]}>
              {receiptBusy ? 'Preparing receipt…' : 'View receipt'}
            </Text>
          </Pressable>

          <Pressable
            onPress={onBackToRental}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}>
            <Text style={styles.primaryBtnText}>Back to rental</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function paymentTypeLabel(raw?: string | string[] | null): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'full_rental') {
    return 'Full rental payment';
  }
  if (value === 'full_payment') {
    return 'Remaining balance';
  }
  if (value === 'downpayment') {
    return 'Down payment';
  }

  return value ?? 'GCash (Xendit)';
}

function ReceiptRow({
  label,
  value,
  colors,
  small,
  last,
}: {
  label: string;
  value: string;
  colors: { navy: string; muted: string; border: string };
  small?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={[styles.rowLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.rowValue, small && styles.rowValueSmall, { color: colors.navy }]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    gap: 10,
  },
  successIconWrap: { alignItems: 'center', marginVertical: 8 },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  sub: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 8 },
  amountBox: { borderRadius: 14, padding: 16, alignItems: 'center', marginVertical: 8 },
  amountLabel: { fontSize: 12, fontWeight: '600' },
  amountValue: { marginTop: 4, fontSize: 28, fontWeight: '900' },
  details: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingVertical: 11 },
  rowLabel: { fontSize: 13, fontWeight: '600' },
  rowValue: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '800' },
  rowValueSmall: { fontSize: 11, fontWeight: '700' },
  outlineBtn: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
  },
  outlineBtnText: { fontSize: 15, fontWeight: '700' },
  primaryBtn: {
    marginTop: 10,
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
