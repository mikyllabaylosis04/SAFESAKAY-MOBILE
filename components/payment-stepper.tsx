import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/lib/theme';
import type { MobileBooking } from '@/lib/types';

const BLUE = '#1A5AD7';
const ORANGE = '#F07A3A';

const STEPS = [
  { key: 1, label: 'Pending Operator Approval' },
  { key: 2, label: 'Awaiting Payment' },
  { key: 3, label: 'For Verification' },
  { key: 4, label: 'Confirmed' },
  { key: 5, label: 'Completed' },
] as const;

export function paymentStepFor(booking: MobileBooking): number {
  if (booking.status === 'cancelled') {
    return 0;
  }
  if (booking.status === 'completed') {
    return 5;
  }
  if (booking.status === 'approved') {
    return 4;
  }
  if (booking.status === 'awaiting_payment' && booking.payment_status === 'for_verification') {
    return 3;
  }
  if (booking.status === 'awaiting_payment') {
    return 2;
  }
  return 1;
}

function subtitleFor(step: number, cancelled: boolean) {
  if (cancelled) {
    return 'This rental request was cancelled.';
  }
  if (step === 2) {
    return 'Complete the down payment to confirm your rental.';
  }
  if (step === 3) {
    return 'The operator is checking your payment proof.';
  }
  if (step === 4) {
    return 'Your rental is confirmed.';
  }
  if (step === 5) {
    return 'This trip has been completed.';
  }
  return 'Waiting for the boat operator to accept this request.';
}

export function PaymentStepper({
  booking,
  showPayHint = false,
}: {
  booking: MobileBooking;
  showPayHint?: boolean;
}) {
  const { colors, isDark } = useAppTheme();
  const cancelled = booking.status === 'cancelled';
  const step = paymentStepFor(booking);
  const idle = isDark ? '#2A3548' : '#E6EAF2';

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.navy }]}>Payment Status</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitleFor(step, cancelled)}</Text>

      <View style={styles.track}>
        {STEPS.map((item, index) => {
          const done = !cancelled && step > item.key;
          const active = !cancelled && step === item.key;
          const circleBg = done || active ? BLUE : idle;
          const leftOn = !cancelled && step >= item.key;
          const rightOn = !cancelled && step > item.key;
          return (
            <View key={item.key} style={styles.step}>
              <View style={styles.row}>
                <View style={[styles.connector, { backgroundColor: index === 0 ? 'transparent' : leftOn ? BLUE : idle }]} />
                <View style={[styles.circle, { backgroundColor: circleBg }]}>
                  {done ? (
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.circleText, { color: done || active ? '#FFFFFF' : colors.muted }]}>
                      {item.key}
                    </Text>
                  )}
                </View>
                <View
                  style={[
                    styles.connector,
                    { backgroundColor: index === STEPS.length - 1 ? 'transparent' : rightOn ? BLUE : idle },
                  ]}
                />
              </View>
              <Text style={[styles.stepLabel, { color: active ? colors.blue : done ? colors.navy : colors.muted }]}>
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>

      {showPayHint && step === 2 && !cancelled ? (
        <View style={[styles.hint, { backgroundColor: isDark ? '#3A2E1C' : '#FFF4E5' }]}>
          <View style={[styles.hintIcon, { backgroundColor: isDark ? '#4A3A20' : '#FFE4C2' }]}>
            <Ionicons name="alert" size={16} color={ORANGE} />
          </View>
          <View style={styles.hintCopy}>
            <Text style={[styles.hintTitle, { color: colors.navy }]}>Waiting for Your Payment</Text>
            <Text style={[styles.hintBody, { color: colors.muted }]}>
              {booking.rental_ui?.down_payment_instruction ||
                (booking.rental_ui?.xendit_enabled || booking.xendit?.enabled
                  ? 'Pay the down payment with GCash online in SafeSakay. Down payment is non-refundable.'
                  : "The operator has accepted your rental request. Please send the down payment to the operator's GCash account and upload your payment receipt. Down payment is non-refundable.")}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 14,
    fontSize: 13,
    lineHeight: 18,
  },
  track: {
    flexDirection: 'row',
  },
  step: {
    flex: 1,
    alignItems: 'center',
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  connector: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleText: {
    fontSize: 11,
    fontWeight: '800',
  },
  stepLabel: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  hint: {
    marginTop: 14,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  hintIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintCopy: {
    flex: 1,
  },
  hintTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  hintBody: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
  },
});
