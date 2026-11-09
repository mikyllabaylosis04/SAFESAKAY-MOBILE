import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/lib/api';
import { fetchBooking } from '@/lib/bookings';
import { submitNoShowRefundRequest } from '@/lib/no-show';
import type { MobileBooking } from '@/lib/types';
import { useAppTheme } from '@/lib/theme';

const BLUE = '#1A5AD7';
const GREEN = '#1FA971';

export default function RefundRequestScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const bookingId = Number(params.bookingId);
  const [booking, setBooking] = useState<MobileBooking | null>(null);
  const [accountName, setAccountName] = useState('');
  const [mobile, setMobile] = useState('');
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!bookingId) {
      return;
    }
    void fetchBooking(bookingId).then(setBooking);
  }, [bookingId]);

  async function pickQr() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setQrUri(result.assets[0].uri);
    }
  }

  function confirmSubmit() {
    Alert.alert(
      'Submit refund request?',
      'Barangay will check your GCash details and send your down payment back.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: () => void submit() },
      ],
    );
  }

  async function submit() {
    if (!bookingId || accountName.trim().length < 2 || !/^09\d{9}$/.test(mobile.trim())) {
      Alert.alert('Check your details', 'Enter a valid GCash account name and mobile number (09XXXXXXXXX).');
      return;
    }
    setSubmitting(true);
    try {
      await submitNoShowRefundRequest(bookingId, {
        gcash_account_name: accountName.trim(),
        gcash_mobile: mobile.trim(),
        qrUri,
      });
      router.replace({
        pathname: '/no-show/refund-submitted',
        params: {
          bookingId: String(bookingId),
          amount: booking?.down_payment_amount_label ?? booking?.operator_no_show_incident?.refundable_downpayment_label ?? '',
          accountName: accountName.trim(),
          mobile: mobile.trim(),
        },
      });
    } catch (err) {
      Alert.alert('Could not submit', err instanceof ApiError ? err.firstError() : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const down = booking?.down_payment_amount_label ?? booking?.operator_no_show_incident?.refundable_downpayment_label ?? '—';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.page }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.navy} />
        </Pressable>
        <Text style={[styles.title, { color: colors.navy }]}>Return down payment</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={[styles.banner, { backgroundColor: isDark ? '#163528' : '#EAF9F1' }]}>
          <Text style={{ color: GREEN, fontWeight: '800' }}>Down payment goes back to you</Text>
          <Text style={{ color: isDark ? '#DFF6EA' : '#1F5E42', fontSize: 13, lineHeight: 20 }}>
            Barangay will send {down} on GCash. No commission is taken from this return.
          </Text>
        </View>
        <Info label="Booking" value={booking?.code ?? '—'} dark={isDark} navy={colors.navy} />
        <Info label="Down payment" value={down} dark={isDark} navy={colors.navy} />
        <Info label="You get back" value={down} dark={isDark} navy={colors.navy} />
        <Info label="Why" value="Boat did not arrive" dark={isDark} navy={colors.navy} />

        <Text style={[styles.label, { color: colors.muted }]}>GCash Account Name</Text>
        <TextInput
          value={accountName}
          onChangeText={setAccountName}
          placeholder="Enter GCash account name"
          style={[styles.input, { borderColor: colors.border, color: colors.navy }]}
        />
        <Text style={[styles.label, { color: colors.muted }]}>GCash Mobile Number</Text>
        <TextInput
          value={mobile}
          onChangeText={setMobile}
          keyboardType="phone-pad"
          placeholder="09XXXXXXXXX"
          maxLength={11}
          style={[styles.input, { borderColor: colors.border, color: colors.navy }]}
        />
        <Pressable onPress={() => void pickQr()} style={[styles.upload, { borderColor: colors.border }]}>
          <Ionicons name="qr-code-outline" size={24} color={BLUE} />
          <Text style={{ color: colors.navy, fontWeight: '600' }}>
            {qrUri ? 'QR selected — tap to change' : 'Upload GCash QR (optional)'}
          </Text>
        </Pressable>
        <Pressable
          disabled={submitting}
          onPress={confirmSubmit}
          style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Request Full Refund</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({
  label,
  value,
  dark,
  navy,
}: {
  label: string;
  value: string;
  dark: boolean;
  navy: string;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ color: dark ? '#9AA8B8' : '#7A8699' }}>{label}</Text>
      <Text style={{ color: navy, fontWeight: '700', flex: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  title: { fontSize: 18, fontWeight: '700', flex: 1 },
  banner: { borderRadius: 12, padding: 12, gap: 4 },
  label: { fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  upload: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: BLUE,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
