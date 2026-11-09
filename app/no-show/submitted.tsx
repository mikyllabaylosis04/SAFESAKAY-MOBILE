import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchNoShowIncident } from '@/lib/no-show';
import type { OperatorNoShowIncident } from '@/lib/types';
import { useAppTheme } from '@/lib/theme';

const BLUE = '#1A5AD7';
const GREEN = '#1FA971';
const ORANGE = '#F07A3A';

export default function NoShowSubmittedScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const bookingId = Number(params.bookingId);
  const [incident, setIncident] = useState<OperatorNoShowIncident | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }
    void fetchNoShowIncident(bookingId)
      .then(setIncident)
      .finally(() => setLoading(false));
  }, [bookingId]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.page }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/booking')}>
          <Ionicons name="arrow-back" size={22} color={colors.navy} />
        </Pressable>
        <Text style={[styles.title, { color: colors.navy }]}>Report Submitted</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={BLUE} />
      ) : (
        <View style={styles.body}>
          <View style={[styles.icon, { backgroundColor: GREEN }]}>
            <Ionicons name="checkmark" size={36} color="#fff" />
          </View>
          <Text style={[styles.heading, { color: colors.navy }]}>No-Show Report Submitted</Text>
          <Text style={[styles.copy, { color: colors.muted }]}>
            Your report has been sent to the Barangay Admin for verification. You will be notified once
            it has been reviewed.
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Row label="Booking Reference" value={incident?.booking_code ?? '—'} />
            <Row label="Date Reported" value={incident?.reported_at_label ?? '—'} />
            <Row
              label="Status"
              value={incident?.passenger_status_label ?? 'Pending Verification'}
              badge
            />
          </View>
          <Pressable
            onPress={() => router.replace('/booking')}
            style={[styles.primaryBtn, { backgroundColor: BLUE }]}>
            <Text style={styles.primaryText}>Back to My Bookings</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value, badge }: { label: string; value: string; badge?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: '#FFF1E6' }]}>
          <Text style={{ color: ORANGE, fontWeight: '700', fontSize: 12 }}>{value}</Text>
        </View>
      ) : (
        <Text style={styles.rowValue}>{value}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  body: { padding: 20, alignItems: 'center', gap: 12 },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  copy: { textAlign: 'center', lineHeight: 20, fontSize: 14 },
  card: { width: '100%', borderWidth: 1, borderRadius: 14, padding: 14, gap: 10, marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  rowLabel: { color: '#7A8699', fontSize: 13 },
  rowValue: { color: '#163A5F', fontWeight: '700', fontSize: 13, textAlign: 'right', flex: 1 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
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
