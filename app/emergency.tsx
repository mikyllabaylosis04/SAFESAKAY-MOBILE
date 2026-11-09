import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { friendlyError } from '@/lib/api';
import { fetchCurrentUser, fetchHelpContent, type HelpHotline } from '@/lib/auth';
import { useAppTheme } from '@/lib/theme';
import type { AuthUser } from '@/lib/types';

const RED = '#E25C5C';

const SAFETY_TIPS = [
  'Wear your life jacket for the whole trip.',
  'Stay seated and keep the weight balanced in the boat.',
  'Follow the boat operator and Coast Guard instructions.',
  'Do not travel when there is a weather hold or storm signal.',
  'Keep your phone charged and in a waterproof pouch.',
];

function call(number: string) {
  void Linking.openURL(`tel:${number.replace(/\s+/g, '')}`);
}

export default function EmergencyScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [hotlines, setHotlines] = useState<HelpHotline[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchHelpContent(), fetchCurrentUser()])
      .then(([content, me]) => {
        setHotlines(content.hotlines);
        setUser(me);
      })
      .catch((err) => {
        setError(friendlyError(err));
        setHotlines([
          { label: 'National Emergency Hotline', number: '911', description: 'Police, fire, and medical emergencies.' },
          { label: 'Philippine Coast Guard', number: '09177243682', description: 'Sea emergencies and maritime accidents.' },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable hitSlop={10} onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.navy} />
          </Pressable>
          <Text style={[styles.topTitle, { color: colors.navy }]}>Emergency Hotlines</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Pressable
            onPress={() => call('911')}
            style={({ pressed }) => [styles.sos, pressed && { opacity: 0.85 }]}
            accessibilityLabel="Call 911">
            <Ionicons name="call" size={28} color="#FFFFFF" />
            <View style={styles.sosCopy}>
              <Text style={styles.sosTitle}>Call 911</Text>
              <Text style={styles.sosSub}>Tap for immediate help in an emergency</Text>
            </View>
          </Pressable>

          {loading ? <ActivityIndicator color={colors.blue} style={styles.loader} /> : null}
          {error ? <Text style={[styles.offline, { color: colors.muted }]}>{error} Showing national hotlines.</Text> : null}

          {hotlines.map((line) => (
            <View key={`${line.label}-${line.number}`} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.icon, { backgroundColor: isDark ? '#3A2224' : '#FDECEC' }]}>
                <Ionicons name="medkit-outline" size={20} color={RED} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.label, { color: colors.navy }]}>{line.label}</Text>
                <Text style={[styles.desc, { color: colors.muted }]}>{line.description}</Text>
                <Text style={[styles.number, { color: colors.navy }]}>{line.number}</Text>
              </View>
              <Pressable onPress={() => call(line.number)} style={styles.callBtn} accessibilityLabel={`Call ${line.label}`}>
                <Ionicons name="call" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}

          <Text style={[styles.heading, { color: colors.navy }]}>Your Emergency Contact</Text>
          {user?.emergency_contact_name ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.icon, { backgroundColor: colors.iconBg }]}>
                <Ionicons name="people-outline" size={20} color={colors.blue} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.label, { color: colors.navy }]}>{user.emergency_contact_name}</Text>
                <Text style={[styles.number, { color: colors.navy }]}>{user.emergency_contact_number ?? 'No number'}</Text>
              </View>
              {user.emergency_contact_number ? (
                <Pressable onPress={() => call(user.emergency_contact_number!)} style={[styles.callBtn, { backgroundColor: colors.blue }]}>
                  <Ionicons name="call" size={18} color="#FFFFFF" />
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Pressable
              onPress={() => router.push('/edit-profile')}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.icon, { backgroundColor: colors.iconBg }]}>
                <Ionicons name="person-add-outline" size={20} color={colors.blue} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.label, { color: colors.navy }]}>Add an emergency contact</Text>
                <Text style={[styles.desc, { color: colors.muted }]}>So the barangay knows who to call if something happens.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          )}

          <Text style={[styles.heading, { color: colors.navy }]}>Safety Reminders</Text>
          <View style={[styles.tips, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {SAFETY_TIPS.map((tip) => (
              <View key={tip} style={styles.tip}>
                <Ionicons name="shield-checkmark" size={16} color="#1FA971" />
                <Text style={[styles.tipText, { color: colors.navy }]}>{tip}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 18, fontWeight: '800' },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  sos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: RED,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  sosCopy: { flex: 1 },
  sosTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  sosSub: { color: '#FFE4E4', fontSize: 13, fontWeight: '600', marginTop: 2 },
  loader: { marginVertical: 16 },
  offline: { fontSize: 12, marginBottom: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  label: { fontSize: 15, fontWeight: '800' },
  desc: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  number: { fontSize: 14, fontWeight: '800', marginTop: 4 },
  callBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1FA971',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { fontSize: 16, fontWeight: '800', marginTop: 12, marginBottom: 10 },
  tips: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
});
