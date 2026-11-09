import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/lib/api';
import { useRequireActiveOrganization } from '@/lib/organization-access';
import {
  fetchCommissions,
  submitCommissionSettlement,
  type OperatorCommission,
} from '@/lib/commissions';
import { resolveMediaUrl } from '@/lib/config';
import { modal, MODAL_COLORS } from '@/lib/modal-theme';
import { useAppTheme } from '@/lib/theme';

export default function CommissionSettleScreen() {
  const allowed = useRequireActiveOrganization('operator');
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Number(params.id);
  const [item, setItem] = useState<OperatorCommission | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [receiptMime, setReceiptMime] = useState('image/jpeg');
  const [receiptName, setReceiptName] = useState('settlement.jpg');
  const [submittedOpen, setSubmittedOpen] = useState(false);

  useEffect(() => {
    fetchCommissions()
      .then((rows) => setItem(rows.find((row) => row.id === id) ?? null))
      .catch((err) => {
        setError(err instanceof ApiError ? err.firstError() : 'Could not load this commission.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function pickReceipt() {
    const ImagePicker = await import('expo-image-picker');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to upload the GCash receipt.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.45,
      allowsEditing: false,
      exif: false,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      const asset = result.assets[0];
      setReceiptUri(asset.uri);
      setReceiptMime(asset.mimeType || 'image/jpeg');
      setReceiptName(asset.fileName || 'settlement.jpg');
      setError('');
    }
  }

  async function submit() {
    if (!item) {
      return;
    }
    if (reference.trim().length < 6) {
      setError('Enter the GCash reference number.');
      return;
    }
    if (!receiptUri) {
      setError('Upload a photo of the settlement receipt.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const updated = await submitCommissionSettlement(item.id, {
        gcash_reference: reference.trim(),
        uri: receiptUri,
        mime: receiptMime,
        name: receiptName,
      });
      setItem(updated);
      setReceiptUri(null);
      setSubmittedOpen(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'Could not submit settlement.');
    } finally {
      setSaving(false);
    }
  }

  const qr = resolveMediaUrl(item?.barangay_gcash_qr_url) || item?.barangay_gcash_qr_url;

  if (!allowed) {
    return <View style={[styles.screen, { backgroundColor: colors.page }]} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Pressable hitSlop={8} style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color={colors.navy} />
          </Pressable>
          <Text style={[styles.title, { color: colors.navy }]}>Settle commission</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Send the commission from your GCash to the barangay GCash. The app does not deduct money automatically.
          </Text>

          {loading ? <ActivityIndicator color={colors.blue} style={styles.loader} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {item ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.code, { color: colors.blue }]}>{item.code}</Text>
              <Text style={[styles.boat, { color: colors.navy }]}>{item.boat_name}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>{item.rental_date_label}</Text>
              <View style={styles.payRow}>
                <Text style={[styles.label, { color: colors.muted }]}>Rental price</Text>
                <Text style={[styles.value, { color: colors.navy }]}>{item.rental_amount_label}</Text>
              </View>
              <View style={styles.payRow}>
                <Text style={[styles.label, { color: colors.muted }]}>Commission</Text>
                <Text style={[styles.value, { color: colors.navy }]}>
                  {item.commission_percentage_label}
                </Text>
              </View>
              <View style={styles.payRow}>
                <Text style={[styles.label, { color: colors.muted }]}>Amount due</Text>
                <Text style={[styles.value, { color: colors.navy }]}>{item.commission_amount_label}</Text>
              </View>
              <View style={styles.payRow}>
                <Text style={[styles.label, { color: colors.muted }]}>Status</Text>
                <Text style={[styles.value, { color: colors.navy }]}>{item.status_label}</Text>
              </View>
              {item.rejection_reason ? (
                <Text style={styles.reject}>Rejected: {item.rejection_reason}</Text>
              ) : null}

              <Text style={[styles.section, { color: colors.navy }]}>Barangay GCash</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>
                {item.barangay_gcash_account_name || 'Barangay GCash is not set yet.'}
              </Text>
              {qr ? (
                <Image source={{ uri: qr }} style={styles.qr} contentFit="contain" />
              ) : (
                <Text style={[styles.meta, { color: colors.muted }]}>QR code is not available yet.</Text>
              )}

              {item.can_submit ? (
                <>
                  <TextInput
                    value={reference}
                    onChangeText={setReference}
                    placeholder="GCash reference number"
                    placeholderTextColor="#B8BDC8"
                    style={[
                      styles.input,
                      { color: colors.navy, borderColor: colors.border, backgroundColor: colors.page },
                    ]}
                  />
                  <Pressable onPress={() => void pickReceipt()} style={[styles.outline, { borderColor: colors.blue }]}>
                    <Text style={[styles.outlineText, { color: colors.blue }]}>
                      {receiptUri ? 'Change receipt' : 'Upload settlement receipt'}
                    </Text>
                  </Pressable>
                  {receiptUri ? <Image source={{ uri: receiptUri }} style={styles.preview} contentFit="cover" /> : null}
                  <Pressable
                    disabled={saving}
                    onPress={() => void submit()}
                    style={[styles.filled, saving && styles.pressed]}>
                    {saving ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.filledText}>Submit Commission Payment</Text>
                    )}
                  </Pressable>
                </>
              ) : (
                <Text style={[styles.meta, { color: colors.muted, marginTop: 12 }]}>
                  {item.status === 'awaiting_verification'
                    ? 'Waiting for barangay verification.'
                    : item.status === 'paid'
                      ? 'This commission is already paid.'
                      : 'This record cannot be submitted right now.'}
                </Text>
              )}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
      <Modal
        visible={submittedOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSubmittedOpen(false);
          router.back();
        }}>
        <View style={styles.successOverlay}>
          <View style={[styles.successCard, { backgroundColor: colors.card }]}>
            <View style={[styles.successRing, { backgroundColor: isDark ? '#163528' : '#E7F8EE' }]}>
              <View style={styles.successCircle}>
                <Ionicons name="checkmark" size={24} color="#FFFFFF" />
              </View>
            </View>
            <Text style={[styles.successTitle, { color: colors.navy }]}>Submitted</Text>
            <Text style={[styles.successBody, { color: colors.muted }]}>
              Waiting for barangay verification.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setSubmittedOpen(false);
                router.back();
              }}
              style={({ pressed }) => [
                styles.successBtn,
                { backgroundColor: colors.blue },
                pressed && styles.pressed,
              ]}>
              <Text style={styles.successBtnText}>Got It</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { marginTop: 6, marginBottom: 16, fontSize: 14, lineHeight: 20 },
  loader: { marginVertical: 24 },
  error: { color: '#E25C5C', marginBottom: 12, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 18, padding: 16 },
  code: { fontSize: 15, fontWeight: '800' },
  boat: { marginTop: 6, fontSize: 18, fontWeight: '800' },
  meta: { marginTop: 4, fontSize: 13 },
  payRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 13 },
  value: { fontSize: 14, fontWeight: '700' },
  reject: { marginTop: 10, color: '#E25C5C', fontSize: 13 },
  section: { marginTop: 18, fontSize: 16, fontWeight: '800' },
  qr: { marginTop: 12, height: 220, width: '100%', backgroundColor: '#F3F6FB', borderRadius: 16 },
  input: {
    marginTop: 16,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  outline: {
    marginTop: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: { fontWeight: '700' },
  preview: { marginTop: 12, height: 160, borderRadius: 14 },
  filled: {
    marginTop: 16,
    backgroundColor: '#1A5AD7',
    borderRadius: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filledText: { color: '#FFFFFF', fontWeight: '800' },
  pressed: { opacity: 0.7 },
  successOverlay: modal.overlay,
  successCard: modal.card,
  successRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: MODAL_COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: modal.title,
  successBody: modal.body,
  successBtn: modal.btnFull,
  successBtnText: modal.btnText,
});
