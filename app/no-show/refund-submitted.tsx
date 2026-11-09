import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/lib/theme';

const BLUE = '#1A5AD7';
const GREEN = '#1FA971';
const ORANGE = '#F07A3A';

export default function RefundSubmittedScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{
    amount?: string;
    accountName?: string;
    mobile?: string;
  }>();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.page }]}>
      <View style={styles.body}>
        <View style={[styles.icon, { backgroundColor: GREEN }]}>
          <Ionicons name="checkmark" size={34} color="#fff" />
        </View>
        <Text style={[styles.heading, { color: colors.navy }]}>Refund Request Submitted</Text>
        <Text style={[styles.copy, { color: colors.muted }]}>
          Your refund request has been submitted. Barangay Admin will review your GCash details and process your
          refund manually.
        </Text>
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Row label="Refund Amount" value={params.amount ?? '—'} />
          <Row label="GCash Name" value={params.accountName ?? '—'} />
          <Row label="GCash Number" value={params.mobile ?? '—'} />
          <View style={[styles.badge, { backgroundColor: '#FFF1E6' }]}>
            <Text style={{ color: ORANGE, fontWeight: '700' }}>For Admin Verification</Text>
          </View>
        </View>
        <Pressable onPress={() => router.replace('/booking')} style={[styles.primaryBtn, { backgroundColor: BLUE }]}>
          <Text style={styles.primaryText}>Back to My Bookings</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2, marginBottom: 8 }}>
      <Text style={{ color: '#7A8699', fontSize: 13 }}>{label}</Text>
      <Text style={{ color: '#163A5F', fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: 20, alignItems: 'center', gap: 12 },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  copy: { textAlign: 'center', lineHeight: 20 },
  card: { width: '100%', borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 8 },
  badge: { alignSelf: 'flex-start', marginTop: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  primaryBtn: {
    marginTop: 12,
    width: '100%',
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
});
