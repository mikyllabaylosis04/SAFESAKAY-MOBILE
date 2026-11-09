import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { friendlyError } from '@/lib/api';
import { fetchHelpContent, type HelpContent, type HelpPolicy } from '@/lib/auth';
import { useAppTheme } from '@/lib/theme';

type TabKey = 'faq' | HelpPolicy['key'];

const TABS: { key: TabKey; label: string }[] = [
  { key: 'faq', label: 'FAQ' },
  { key: 'rental', label: 'Cancellation' },
  { key: 'terms', label: 'Terms' },
  { key: 'privacy', label: 'Privacy' },
];

export default function HelpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string; organization_id?: string }>();
  const { colors, isDark } = useAppTheme();
  const initial = TABS.some((tab) => tab.key === params.section) ? (params.section as TabKey) : 'faq';
  const [tab, setTab] = useState<TabKey>(initial);
  const [content, setContent] = useState<HelpContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const load = useCallback(() => {
    setError('');
    return fetchHelpContent(params.organization_id ? Number(params.organization_id) : null)
      .then(setContent)
      .catch((err) => setError(friendlyError(err, 'Could not load help content.')))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [params.organization_id]);

  useEffect(() => {
    void load();
  }, [load]);

  const policy = content?.policies.find((item) => item.key === tab) ?? null;
  const barangay = content?.barangay;

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable hitSlop={10} onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.navy} />
          </Pressable>
          <Text style={[styles.topTitle, { color: colors.navy }]}>Help & Policies</Text>
          <View style={styles.backBtn} />
        </View>

        <View style={[styles.tabs, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {TABS.map((item) => {
            const active = item.key === tab;
            return (
              <Pressable
                key={item.key}
                onPress={() => setTab(item.key)}
                style={[styles.tab, active && { backgroundColor: colors.blue }]}>
                <Text style={[styles.tabText, { color: active ? '#FFFFFF' : colors.muted }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.blue}
              colors={[colors.blue]}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }>
          {loading ? <ActivityIndicator color={colors.blue} style={styles.loader} /> : null}
          {error ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={() => { setLoading(true); void load(); }} style={[styles.retry, { borderColor: colors.blue }]}>
                <Text style={[styles.retryText, { color: colors.blue }]}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {content && tab === 'faq'
            ? content.faq.map((item, index) => {
                const open = openFaq === index;
                return (
                  <Pressable
                    key={item.question}
                    onPress={() => setOpenFaq(open ? null : index)}
                    style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.faqHead}>
                      <Text style={[styles.faqQuestion, { color: colors.navy }]}>{item.question}</Text>
                      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
                    </View>
                    {open ? <Text style={[styles.body, { color: colors.muted }]}>{item.answer}</Text> : null}
                  </Pressable>
                );
              })
            : null}

          {content && policy ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.policyTitle, { color: colors.navy }]}>{policy.title}</Text>
              <Text style={[styles.policySummary, { color: colors.muted }]}>{policy.summary}</Text>
              {policy.sections.map((section) => (
                <View key={section.heading} style={styles.section}>
                  <Text style={[styles.sectionHeading, { color: colors.navy }]}>{section.heading}</Text>
                  <Text style={[styles.body, { color: colors.muted }]}>{section.body}</Text>
                </View>
              ))}
              <Text style={[styles.version, { color: colors.muted }]}>Version {policy.version}</Text>
            </View>
          ) : null}

          {content ? (
            <View style={[styles.card, styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.contactIcon, { backgroundColor: colors.iconBg }]}>
                <Ionicons name="business-outline" size={20} color={colors.blue} />
              </View>
              <View style={styles.contactCopy}>
                <Text style={[styles.contactTitle, { color: colors.navy }]}>Still need help?</Text>
                <Text style={[styles.body, { color: colors.muted }]}>
                  Contact {barangay?.name ?? 'your barangay office'}
                  {barangay?.address ? ` · ${barangay.address}` : ''}
                </Text>
                {barangay?.contact_number ? (
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${barangay.contact_number}`)}
                    style={[styles.callBtn, { backgroundColor: colors.blue }]}>
                    <Ionicons name="call" size={14} color="#FFFFFF" />
                    <Text style={styles.callText}>Call {barangay.contact_number}</Text>
                  </Pressable>
                ) : (
                  <Text style={[styles.body, { color: colors.muted }]}>The barangay has not added a contact number yet.</Text>
                )}
              </View>
            </View>
          ) : null}
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
  tabs: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 4, marginHorizontal: 16, marginBottom: 12 },
  tab: { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  tabText: { fontSize: 12, fontWeight: '700' },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  loader: { marginTop: 32 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  faqQuestion: { flex: 1, fontSize: 15, fontWeight: '800' },
  body: { marginTop: 8, fontSize: 13, lineHeight: 20 },
  policyTitle: { fontSize: 18, fontWeight: '800' },
  policySummary: { marginTop: 6, fontSize: 13, lineHeight: 19 },
  section: { marginTop: 14 },
  sectionHeading: { fontSize: 14, fontWeight: '800' },
  version: { marginTop: 16, fontSize: 11, fontWeight: '600' },
  contactCard: { flexDirection: 'row', gap: 12 },
  contactIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  contactCopy: { flex: 1 },
  contactTitle: { fontSize: 15, fontWeight: '800' },
  callBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  callText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  errorText: { color: '#E25C5C', fontWeight: '700' },
  retry: { marginTop: 10, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  retryText: { fontWeight: '800', fontSize: 12 },
});
