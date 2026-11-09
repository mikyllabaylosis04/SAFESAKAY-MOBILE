import { StyleSheet, Text, View } from 'react-native';

import { BRAND_BLUE } from '@/components/brand-lockup';
import { useAppTheme } from '@/lib/theme';

const STEPS = ['Trip', 'Payment', 'Checkout', 'Result'] as const;

export type RentalCheckoutStep = 1 | 2 | 3 | 4;

export function RentalCheckoutProgress({ step }: { step: RentalCheckoutStep }) {
  const { isDark, colors } = useAppTheme();
  const idle = isDark ? '#2A3548' : '#D7E4F5';

  return (
    <View style={styles.wrap}>
      {STEPS.map((label, index) => {
        const number = (index + 1) as RentalCheckoutStep;
        const active = step === number;
        const done = step > number;

        return (
          <View key={label} style={styles.step}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: done || active ? BRAND_BLUE : idle,
                  borderColor: active ? '#FFFFFF' : 'transparent',
                },
              ]}>
              <Text style={[styles.dotText, { color: done || active ? '#FFF' : colors.muted }]}>
                {number}
              </Text>
            </View>
            <Text style={[styles.label, { color: active ? colors.navy : colors.muted }]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  dotText: { fontSize: 12, fontWeight: '800' },
  label: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
});
