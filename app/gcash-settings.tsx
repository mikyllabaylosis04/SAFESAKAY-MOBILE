import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
import { useRequireActiveOrganization } from '@/lib/organization-access';
import { resolveMediaUrl } from '@/lib/config';
import {
  fetchOperatorGcash,
  saveOperatorGcash,
  type OperatorGcashPayload,
  type OperatorGcashStatus,
} from '@/lib/gcash';
import { useAppTheme } from '@/lib/theme';

const PLACEHOLDER = '#B8BDC8';
const MOBILE_REGEX = /^09\d{9}$/;

function badgeColors(status: OperatorGcashStatus) {
  if (status === 'approved') {
    return { color: '#1FA971', bg: '#DFF6EA' };
  }
  if (status === 'pending_approval') {
    return { color: '#1A5AD7', bg: '#E8F1FF' };
  }
  if (status === 'rejected') {
    return { color: '#E25C5C', bg: '#FDECEC' };
  }
  return { color: '#6B7280', bg: '#EEF2F6' };
}

export default function GcashSettingsScreen() {
  const allowed = useRequireActiveOrganization('operator');
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState<OperatorGcashPayload | null>(null);
  const [accountName, setAccountName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [qrMime, setQrMime] = useState('image/jpeg');
  const [qrName, setQrName] = useState('gcash-qr.jpg');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [focused, setFocused] = useState<'name' | 'mobile' | null>(null);

  useEffect(() => {
    fetchOperatorGcash()
      .then((data) => {
        setPayload(data);
        setAccountName(data.form?.account_name ?? '');
        setMobileNumber(data.form?.mobile_number ?? '');
      })
      .catch((err) => {
        setError(
          err instanceof ApiError ? err.firstError() : 'Could not load GCash payment settings.',
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const status = payload?.status ?? 'not_registered';
  const badge = badgeColors(status);
  const preview = qrUri || resolveMediaUrl(payload?.form?.qr_url) || payload?.form?.qr_url || null;

  function inputWrap(field: 'name' | 'mobile') {
    const active = focused === field;
    return [
      styles.inputWrap,
      {
        borderColor: active ? colors.blue : colors.border,
        backgroundColor: active ? (isDark ? colors.iconBg : '#EEF4FF') : colors.card,
        borderWidth: active ? 2 : 1.5,
      },
    ];
  }

  async function pickQr() {
    const ImagePicker = await import('expo-image-picker');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to upload your GCash QR code.');
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
      setQrUri(asset.uri);
      setQrMime(asset.mimeType || 'image/jpeg');
      setQrName(asset.fileName || (asset.mimeType?.includes('png') ? 'gcash-qr.png' : 'gcash-qr.jpg'));
      setError('');
    }
  }

  async function handleSave() {
    const name = accountName.trim();
    const mobile = mobileNumber.replace(/\D+/g, '');

    if (name.length < 2) {
      setError('Enter the GCash account name.');
      setMessage('');
      return;
    }
    if (!MOBILE_REGEX.test(mobile)) {
      setError('Enter an 11-digit GCash mobile number starting with 09.');
      setMessage('');
      return;
    }
    if (!qrUri && !payload?.form?.qr_url) {
      setError('Upload a GCash QR code.');
      setMessage('');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await saveOperatorGcash({
        account_name: name,
        mobile_number: mobile,
        uri: qrUri,
        mime: qrMime,
        name: qrName,
      });
      setPayload(response.data);
      setAccountName(response.data.form?.account_name ?? name);
      setMobileNumber(response.data.form?.mobile_number ?? mobile);
      setQrUri(null);
      setMessage(response.message);
      router.push({ pathname: '/rental-result', params: { type: 'gcash' } });
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'Could not save GCash details.');
    } finally {
      setSaving(false);
    }
  }

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
          <Text style={[styles.title, { color: colors.navy }]}>Payout Account (GCash)</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Passengers pay the barangay. After a trip is completed, the barangay sends your operator share to this
            GCash account.
          </Text>
          <View style={[styles.optionalNote, { backgroundColor: colors.iconBg }]}>
            <Ionicons name="information-circle-outline" size={18} color={colors.blue} />
            <Text style={[styles.optionalText, { color: colors.navy }]}>
              Optional. No GCash? You can claim your share in cash at the barangay office. The admin records it in
              SafeSakay.
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.blue} style={styles.loader} />
          ) : (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.statusRow}>
                <Text style={[styles.sectionTitle, { color: colors.navy, marginBottom: 0 }]}>
                  Account Status
                </Text>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.color }]}>
                    {payload?.status_label ?? 'Not Registered'}
                  </Text>
                </View>
              </View>

              {status === 'pending_approval' ? (
                <Text style={[styles.hint, { color: colors.muted }]}>
                  After submit, wait for admin approval. Payouts are sent to this GCash only after it is
                  approved.
                </Text>
              ) : null}

              {payload?.approved && payload.pending ? (
                <Text style={[styles.hint, { color: colors.muted }]}>
                  Your previously approved account stays active for payouts while this update is pending
                  approval.
                </Text>
              ) : null}

              <Text style={[styles.label, { color: colors.navy }]}>GCash Account Name</Text>
              <View style={inputWrap('name')}>
                <TextInput
                  value={accountName}
                  onChangeText={setAccountName}
                  onFocus={() => setFocused('name')}
                  onBlur={() => setFocused(null)}
                  placeholder="Account name on GCash"
                  placeholderTextColor={PLACEHOLDER}
                  style={[styles.input, { color: colors.navy }]}
                />
              </View>

              <Text style={[styles.label, { color: colors.navy }]}>GCash Mobile Number</Text>
              <View style={inputWrap('mobile')}>
                <TextInput
                  value={mobileNumber}
                  onChangeText={setMobileNumber}
                  onFocus={() => setFocused('mobile')}
                  onBlur={() => setFocused(null)}
                  placeholder="09XXXXXXXXX"
                  placeholderTextColor={PLACEHOLDER}
                  keyboardType="phone-pad"
                  maxLength={11}
                  style={[styles.input, { color: colors.navy }]}
                />
              </View>

              <Text style={[styles.label, { color: colors.navy }]}>Upload GCash QR Code</Text>
              <Pressable
                onPress={() => void pickQr()}
                style={({ pressed }) => [
                  styles.uploadBtn,
                  { borderColor: colors.blue, backgroundColor: isDark ? colors.iconBg : '#EEF4FF' },
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="qr-code-outline" size={18} color={colors.blue} />
                <Text style={[styles.uploadText, { color: colors.blue }]}>
                  {preview ? 'Change QR Code' : 'Upload QR Code'}
                </Text>
              </Pressable>

              {preview ? (
                <Image source={{ uri: preview }} style={styles.qrPreview} contentFit="contain" />
              ) : (
                <Text style={[styles.hint, { color: colors.muted }]}>
                  Use a clear photo of your GCash QR code.
                </Text>
              )}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {message ? <Text style={styles.successText}>{message}</Text> : null}

              <Pressable
                disabled={saving}
                onPress={() => void handleSave()}
                style={({ pressed }) => [
                  styles.saveBtn,
                  { backgroundColor: colors.blue },
                  (pressed || saving) && styles.pressed,
                ]}>
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>
                    {status === 'pending_approval' ? 'Update Details' : 'Save Changes'}
                  </Text>
                )}
              </Pressable>

              {status === 'pending_approval' || status === 'approved' ? (
                <Pressable
                  onPress={() => router.replace('/operator-home')}
                  style={({ pressed }) => [
                    styles.homeBtn,
                    { borderColor: colors.border, backgroundColor: colors.card },
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.homeText, { color: colors.navy }]}>Back to Home</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginLeft: -8,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  optionalNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  optionalText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  loader: {
    marginTop: 32,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  label: {
    marginBottom: 6,
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
  },
  inputWrap: {
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
  },
  uploadBtn: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '700',
  },
  qrPreview: {
    marginTop: 12,
    height: 180,
    borderRadius: 16,
    backgroundColor: '#F4F7FB',
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
  },
  errorText: {
    marginTop: 10,
    color: '#D64545',
    fontSize: 13,
  },
  successText: {
    marginTop: 10,
    color: '#1FA971',
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  homeBtn: {
    marginTop: 10,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeText: {
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.82,
  },
});
