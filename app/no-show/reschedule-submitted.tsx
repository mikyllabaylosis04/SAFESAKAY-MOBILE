import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/lib/theme';

const BLUE = '#1A5AD7';
const GREEN = '#1FA971';
const ORANGE = '#F07A3A';

export default function RescheduleSubmittedScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{
    bookingId?: string;
    boatName?: string;
    boatCode?: string;
    date?: string;
    time?: string;
  }>();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.page }]}>
      <View style={styles.body}>
        <View style={[styles.icon, { backgroundColor: GREEN }]}>
          <Ionicons name="checkmark" size={34} color="#fff" />
        </View>
        <Text style={[styles.heading, { color: colors.navy }]}>Reschedule Request Submitted</Text>
        <Text style={[styles.copy, { color: colors.muted }]}>
          The boat operator will confirm availability. If there is no response within 30 minutes, you can pick another boat and schedule.
        </Text>
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={{ color: colors.muted }}>Boat</Text>
          <Text style={[styles.value, { color: colors.navy }]}>
            {params.boatName} ({params.boatCode})
          </Text>
          <Text style={{ color: colors.muted, marginTop: 8 }}>Date & Time</Text>
          <Text style={[styles.value, { color: colors.navy }]}>
            {params.date} · {params.time}
          </Text>
          <View style={[styles.badge, { backgroundColor: '#FFF1E6' }]}>
            <Text style={{ color: ORANGE, fontWeight: '700' }}>Waiting for Operator</Text>
          </View>
        </View>
        <Pressable onPress={() => router.replace('/booking')} style={[styles.primaryBtn, { backgroundColor: BLUE }]}>
          <Text style={styles.primaryText}>Back to My Bookings</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: 20, alignItems: 'center', gap: 12 },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  copy: { textAlign: 'center', lineHeight: 20 },
  card: { width: '100%', borderWidth: 1, borderRadius: 14, padding: 14, gap: 4, marginTop: 8 },
  value: { fontWeight: '700' },
  badge: { alignSelf: 'flex-start', marginTop: 10, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
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
