import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { MobileBooking } from '@/lib/types';

export type XenditPaymentPlan = 'downpayment' | 'full_rental';

type Props = {
  booking: MobileBooking;
  colors: {
    blue: string;
    navy: string;
    muted: string;
    border: string;
    card: string;
  };
  isDark: boolean;
  checkoutLoading: boolean;
  onlineMessage?: string | null;
  onPay: (plan: XenditPaymentPlan) => void;
};

function parseAmount(label?: string | null): number | null {
  if (!label) {
    return null;
  }
  const digits = label.replace(/[^\d.]/g, '');
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

export function RentalXenditPaymentPanel({
  booking,
  colors,
  isDark,
  checkoutLoading,
  onlineMessage,
  onPay,
}: Props) {
  const canFull = useMemo(() => {
    const rentalTotal = parseAmount(booking.rental_price_label);
    return Boolean(rentalTotal && rentalTotal > 0);
  }, [booking.rental_price_label]);

  const canDown = useMemo(() => {
    const downPayment = parseAmount(booking.down_payment_amount_label);
    return Boolean(downPayment && downPayment > 0);
  }, [booking.down_payment_amount_label]);

  const [plan, setPlan] = useState<XenditPaymentPlan>(canFull ? 'full_rental' : 'downpayment');
  const receiver = booking.checkout_context?.payment_receiver_name || 'your barangay';
  const tint = isDark ? '#1B2C4D' : '#E8F1FF';

  return (
    <View>
      <Text style={[styles.sectionLabel, { color: colors.navy }]}>1. How much will you pay now?</Text>
      <View style={styles.planList}>
        {canFull ? (
          <PlanOption
            title="Full payment"
            amount={booking.rental_price_label || '—'}
            hint="Pay everything now. Nothing to pay on trip day."
            selected={plan === 'full_rental'}
            colors={colors}
            tint={tint}
            onPress={() => setPlan('full_rental')}
          />
        ) : null}
        {canDown ? (
          <PlanOption
            title="Down payment"
            amount={booking.down_payment_amount_label || '—'}
            hint={`Pay the rest (${booking.remaining_balance_label || '—'}) to the operator on trip day.`}
            selected={plan === 'downpayment'}
            colors={colors}
            tint={tint}
            onPress={() => setPlan('downpayment')}
          />
        ) : null}
      </View>

      <Text style={[styles.sectionLabel, { color: colors.navy, marginTop: 16 }]}>2. Payment method</Text>
      <View style={[styles.methodCard, { borderColor: colors.blue, backgroundColor: tint }]}>
        <View style={[styles.methodIcon, { backgroundColor: colors.blue }]}>
          <Text style={styles.methodLetter}>G</Text>
        </View>
        <View style={styles.methodCopy}>
          <Text style={[styles.methodTitle, { color: colors.navy }]}>GCash</Text>
          <Text style={[styles.methodSub, { color: colors.muted }]}>Secured by Xendit</Text>
        </View>
        <Ionicons name="checkmark-circle" size={22} color={colors.blue} />
      </View>

      <View style={[styles.receiver, { borderColor: colors.border }]}>
        <Ionicons name="shield-checkmark" size={18} color="#1FA971" />
        <View style={styles.methodCopy}>
          <Text style={[styles.receiverLabel, { color: colors.muted }]}>Paid to</Text>
          <Text style={[styles.receiverName, { color: colors.navy }]}>{receiver}</Text>
        </View>
      </View>

      <View style={[styles.notice, { backgroundColor: tint }]}>
        <Ionicons name="information-circle-outline" size={18} color={colors.blue} />
        <Text style={[styles.noticeText, { color: colors.navy }]}>
          You will open GCash to approve the payment. Your rental updates automatically once GCash confirms it.
        </Text>
      </View>

      <Pressable
        disabled={checkoutLoading}
        onPress={() => onPay(plan)}
        style={({ pressed }) => [
          styles.payBtn,
          { backgroundColor: colors.blue, opacity: checkoutLoading ? 0.6 : 1 },
          pressed && !checkoutLoading && styles.pressed,
        ]}>
        {checkoutLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Text style={styles.payBtnText}>Continue to Checkout</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </>
        )}
      </Pressable>

      {onlineMessage ? <Text style={[styles.error, { color: colors.muted }]}>{onlineMessage}</Text> : null}
    </View>
  );
}

function PlanOption({
  title,
  amount,
  hint,
  selected,
  colors,
  tint,
  onPress,
}: {
  title: string;
  amount: string;
  hint: string;
  selected?: boolean;
  colors: Props['colors'];
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.planOption,
        {
          borderColor: selected ? colors.blue : colors.border,
          backgroundColor: selected ? tint : colors.card,
        },
      ]}>
      <View style={[styles.radio, { borderColor: selected ? colors.blue : colors.border }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: colors.blue }]} /> : null}
      </View>
      <View style={styles.methodCopy}>
        <View style={styles.planTop}>
          <Text style={[styles.planTitle, { color: colors.navy }]}>{title}</Text>
          <Text style={[styles.planAmount, { color: colors.blue }]}>{amount}</Text>
        </View>
        <Text style={[styles.planHint, { color: colors.muted }]}>{hint}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  planList: { gap: 10 },
  planOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  planTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  planTitle: { fontSize: 15, fontWeight: '800' },
  planAmount: { fontSize: 16, fontWeight: '900' },
  planHint: { marginTop: 4, fontSize: 12, lineHeight: 17 },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
  },
  methodIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodLetter: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  methodCopy: { flex: 1 },
  methodTitle: { fontSize: 15, fontWeight: '800' },
  methodSub: { fontSize: 12, marginTop: 2 },
  receiver: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  receiverLabel: { fontSize: 11, fontWeight: '700' },
  receiverName: { fontSize: 14, fontWeight: '800', marginTop: 1 },
  notice: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  payBtn: {
    marginTop: 14,
    borderRadius: 14,
    minHeight: 52,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  error: { marginTop: 10, fontSize: 12 },
  pressed: { opacity: 0.88 },
});
