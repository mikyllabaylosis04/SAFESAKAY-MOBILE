import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/lib/api';
import { chooseNoShowResolution } from '@/lib/no-show';
import { useAppTheme } from '@/lib/theme';

const BLUE = '#1A5AD7';
const GREEN = '#1FA971';
const ORANGE = '#F07A3A';

export default function ChooseNoShowResolutionScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const params = useLocalSearchParams<{
    bookingId?: string;
    message?: string;
    refundViaXendit?: string;
    replacementBoat?: string;
    replacementDetail?: string;
    tripDate?: string;
    tripTime?: string;
    canPickBoat?: string;
  }>();
  const bookingId = Number(params.bookingId);
  const refundViaXendit = params.refundViaXendit === '1';
  const replacementBoat = params.replacementBoat?.trim() || '';
  const canPickBoat = params.canPickBoat !== '0';
  const todayYmd = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();
  const sameDayDate = params.tripDate && params.tripDate >= todayYmd ? params.tripDate : todayYmd;
  const [busy, setBusy] = useState<'refund' | 'replacement' | null>(null);
  const message =
    params.message?.trim() ||
    'Barangay confirmed the boat did not arrive. Choose one help. Your down payment is safe.';

  async function choose(choice: 'refund' | 'replacement') {
    if (!bookingId) {
      return;
    }
    setBusy(choice);
    try {
      await chooseNoShowResolution(bookingId, choice);
      Alert.alert(
        choice === 'replacement' ? 'Replacement confirmed' : 'Refund requested',
        choice === 'replacement'
          ? 'Your replacement boat is confirmed. Check your updated booking details.'
          : 'Barangay will approve your refund. It goes back to your original payment method.',
      );
      router.back();
    } catch (err) {
      Alert.alert('Could not save your choice', err instanceof ApiError ? err.firstError() : 'Please try again.');
    } finally {
      setBusy(null);
    }
  }

  function confirmRefund() {
    Alert.alert(
      'Request a refund?',
      'Your payment will be returned through the same payment method once the barangay approves it.',
      [
        { text: 'Go Back', style: 'cancel' },
        { text: 'Request Refund', onPress: () => void choose('refund') },
      ],
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.page }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable hitSlop={8} onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.navy} />
        </Pressable>
        <Text style={[styles.title, { color: colors.navy }]}>Boat did not arrive</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.icon, { backgroundColor: isDark ? '#3A2A18' : '#FFF1E6' }]}>
          <Ionicons name="alert-circle" size={36} color={ORANGE} />
        </View>
        <Text style={[styles.heading, { color: colors.navy }]}>Choose one help</Text>
        <Text style={[styles.copy, { color: colors.muted }]}>{message}</Text>

        {replacementBoat ? (
          <Pressable
            disabled={busy !== null}
            onPress={() => void choose('replacement')}
            style={({ pressed }) => [
              styles.option,
              { borderColor: isDark ? '#2A4A7A' : '#C5DEF5', backgroundColor: colors.card },
              pressed && { opacity: 0.88 },
            ]}>
            <View style={[styles.optionIcon, { backgroundColor: isDark ? '#1B2C4D' : '#EEF4FF' }]}>
              <Ionicons name="boat-outline" size={22} color={BLUE} />
            </View>
            <View style={styles.optionCopy}>
              <Text style={[styles.optionTitle, { color: colors.navy }]}>Accept replacement boat</Text>
              <Text style={[styles.optionBody, { color: colors.muted }]}>
                {replacementBoat}
                {params.replacementDetail ? ` · ${params.replacementDetail}` : ''}. Same date and time, no extra charge.
              </Text>
            </View>
            {busy === 'replacement' ? (
              <ActivityIndicator color={BLUE} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={BLUE} />
            )}
          </Pressable>
        ) : null}

        {canPickBoat ? (
          <Pressable
            disabled={busy !== null}
            onPress={() =>
              router.push({
                pathname: '/no-show/reschedule-boats',
                params: { bookingId: String(bookingId), date: sameDayDate, time: params.tripTime ?? '' },
              })
            }
            style={({ pressed }) => [
              styles.option,
              { borderColor: isDark ? '#2A4A7A' : '#C5DEF5', backgroundColor: colors.card },
              pressed && { opacity: 0.88 },
            ]}>
            <View style={[styles.optionIcon, { backgroundColor: isDark ? '#1B2C4D' : '#EEF4FF' }]}>
              <Ionicons name="swap-horizontal-outline" size={22} color={BLUE} />
            </View>
            <View style={styles.optionCopy}>
              <Text style={[styles.optionTitle, { color: colors.navy }]}>Another boat today</Text>
              <Text style={[styles.optionBody, { color: colors.muted }]}>
                Pick a boat that is free on the same day. Its operator confirms, then your trip continues. No extra pay.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={BLUE} />
          </Pressable>
        ) : null}

        <Pressable
          disabled={busy !== null || !canPickBoat}
          onPress={() =>
            router.push({
              pathname: '/no-show/reschedule-boats',
              params: { bookingId: String(bookingId) },
            })
          }
          style={({ pressed }) => [
            styles.option,
            { borderColor: isDark ? '#2A4A7A' : '#C5DEF5', backgroundColor: colors.card },
            pressed && { opacity: 0.88 },
          ]}>
          <View style={[styles.optionIcon, { backgroundColor: isDark ? '#1B2C4D' : '#EEF4FF' }]}>
            <Ionicons name="calendar-outline" size={22} color={BLUE} />
          </View>
          <View style={styles.optionCopy}>
            <Text style={[styles.optionTitle, { color: colors.navy }]}>New date</Text>
            <Text style={[styles.optionBody, { color: colors.muted }]}>
              Down payment stays. Pick a boat and a new trip date. No extra pay.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={BLUE} />
        </Pressable>

        <Pressable
          disabled={busy !== null}
          onPress={() =>
            refundViaXendit
              ? confirmRefund()
              : router.push({
                  pathname: '/no-show/refund-request',
                  params: { bookingId: String(bookingId) },
                })
          }
          style={({ pressed }) => [
            styles.option,
            { borderColor: isDark ? '#1F5E42' : '#B7E4CC', backgroundColor: colors.card },
            pressed && { opacity: 0.88 },
          ]}>
          <View style={[styles.optionIcon, { backgroundColor: isDark ? '#163528' : '#DFF6EA' }]}>
            <Ionicons name="wallet-outline" size={22} color={GREEN} />
          </View>
          <View style={styles.optionCopy}>
            <Text style={[styles.optionTitle, { color: colors.navy }]}>Full refund</Text>
            <Text style={[styles.optionBody, { color: colors.muted }]}>
              {refundViaXendit
                ? 'Your payment goes back through the same online payment method after barangay approval.'
                : 'Barangay sends your verified down payment back on GCash.'}
            </Text>
          </View>
          {busy === 'refund' ? (
            <ActivityIndicator color={GREEN} />
          ) : (
            <Ionicons name="chevron-forward" size={18} color={BLUE} />
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '800' },
  body: { padding: 20, gap: 12, paddingBottom: 36 },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 8,
  },
  heading: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  copy: { textAlign: 'center', lineHeight: 22, fontSize: 14, marginBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCopy: { flex: 1, gap: 4 },
  optionTitle: { fontWeight: '800', fontSize: 16 },
  optionBody: { fontSize: 13, lineHeight: 18 },
});
