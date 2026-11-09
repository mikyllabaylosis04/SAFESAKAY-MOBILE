import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, friendlyError } from '@/lib/api';
import { fetchCurrentUser, updateProfile, updateProfilePhoto } from '@/lib/auth';
import { resolveMediaUrl } from '@/lib/config';
import { isOperator } from '@/lib/roles';
import { useAppTheme } from '@/lib/theme';

type FormKey = 'name' | 'email' | 'contact_number' | 'address' | 'emergency_contact_name' | 'emergency_contact_number';

const FIELDS: {
  key: FormKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  keyboard?: 'email-address' | 'phone-pad';
  required?: boolean;
  section: 'personal' | 'emergency';
}[] = [
  { key: 'name', label: 'Full Name', icon: 'person-outline', placeholder: 'Juan Dela Cruz', required: true, section: 'personal' },
  { key: 'email', label: 'Email', icon: 'mail-outline', placeholder: 'you@example.com', keyboard: 'email-address', required: true, section: 'personal' },
  { key: 'contact_number', label: 'Mobile Number', icon: 'call-outline', placeholder: '09171234567', keyboard: 'phone-pad', section: 'personal' },
  { key: 'address', label: 'Address', icon: 'location-outline', placeholder: 'Purok, Barangay, Municipality', section: 'personal' },
  { key: 'emergency_contact_name', label: 'Contact Person', icon: 'people-outline', placeholder: 'Name of a family member or friend', section: 'emergency' },
  { key: 'emergency_contact_number', label: 'Contact Number', icon: 'call-outline', placeholder: '09171234567', keyboard: 'phone-pad', section: 'emergency' },
];

const EMPTY: Record<FormKey, string> = {
  name: '',
  email: '',
  contact_number: '',
  address: '',
  emergency_contact_name: '',
  emergency_contact_number: '',
};

export default function EditProfileScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [form, setForm] = useState<Record<FormKey, string>>(EMPTY);
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FormKey, string>>>({});
  const [operator, setOperator] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then((user) => {
        if (!user) {
          return;
        }
        setOperator(isOperator(user));
        setForm({
          name: user.name ?? '',
          email: user.email ?? '',
          contact_number: user.contact_number ?? '',
          address: user.address ?? '',
          emergency_contact_name: user.emergency_contact_name ?? '',
          emergency_contact_number: user.emergency_contact_number ?? '',
        });
        setPhoto(resolveMediaUrl(user.picture_url) || null);
      })
      .finally(() => setLoading(false));
  }, []);

  function setField(key: FormKey, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
  }

  async function pickPhoto() {
    const ImagePicker = await import('expo-image-picker');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to change your profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
      exif: false,
    });

    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.uri) {
      return;
    }

    setUploading(true);
    try {
      const user = await updateProfilePhoto(asset.uri, asset.mimeType);
      setPhoto(resolveMediaUrl(user.picture_url) || asset.uri);
    } catch (err) {
      Alert.alert('Could not update photo', friendlyError(err));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    const missing: Partial<Record<FormKey, string>> = {};
    if (!operator && !form.name.trim()) {
      missing.name = 'Enter your full name.';
    }
    if (!form.email.trim()) {
      missing.email = 'Enter your email.';
    }
    if (form.emergency_contact_number.trim() && !form.emergency_contact_name.trim()) {
      missing.emergency_contact_name = 'Enter the name of your emergency contact.';
    }
    if (Object.keys(missing).length > 0) {
      setErrors(missing);
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      await updateProfile({
        name: form.name.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        contact_number: form.contact_number.trim(),
        emergency_contact_name: form.emergency_contact_name.trim(),
        emergency_contact_number: form.emergency_contact_number.trim(),
      });
      Alert.alert('Profile updated', 'Your profile details were saved.');
      router.back();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const next: Partial<Record<FormKey, string>> = {};
        for (const [key, messages] of Object.entries(err.errors)) {
          next[key as FormKey] = messages[0];
        }
        setErrors(next);
      } else {
        Alert.alert('Could not save', friendlyError(err));
      }
    } finally {
      setSaving(false);
    }
  }

  function renderField(field: (typeof FIELDS)[number]) {
    const error = errors[field.key];
    if (field.key === 'name' && operator) {
      return (
        <View key={field.key} style={styles.field}>
          <Text style={[styles.label, { color: colors.navy }]}>{field.label}</Text>
          <View style={[styles.inputWrap, { backgroundColor: colors.page, borderColor: colors.border, opacity: 0.75 }]}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
            <Text style={[styles.input, { color: colors.navy }]}>{form.name}</Text>
          </View>
          <Text style={[styles.lockedHint, { color: colors.muted }]}>
            Your registered name is managed by the barangay. Ask the admin to correct it.
          </Text>
        </View>
      );
    }
    return (
      <View key={field.key} style={styles.field}>
        <Text style={[styles.label, { color: colors.navy }]}>
          {field.label}
          {field.required ? <Text style={styles.required}> *</Text> : null}
        </Text>
        <View
          style={[
            styles.inputWrap,
            { backgroundColor: colors.page, borderColor: error ? '#E25C5C' : colors.border },
          ]}>
          <Ionicons name={field.icon} size={18} color={colors.muted} />
          <TextInput
            value={form[field.key]}
            onChangeText={(value) => setField(field.key, value)}
            placeholder={field.placeholder}
            placeholderTextColor={colors.muted}
            keyboardType={field.keyboard ?? 'default'}
            autoCapitalize={field.keyboard === 'email-address' ? 'none' : 'words'}
            autoCorrect={false}
            style={[styles.input, { color: colors.navy }]}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable hitSlop={10} onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.navy} />
          </Pressable>
          <Text style={[styles.topTitle, { color: colors.navy }]}>Edit Profile</Text>
          <View style={styles.backBtn} />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.blue} style={styles.loader} />
        ) : (
          <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <View style={styles.photoWrap}>
                <Pressable onPress={pickPhoto} disabled={uploading} accessibilityLabel="Change profile photo">
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
                  ) : (
                    <View style={[styles.photo, styles.photoFallback, { backgroundColor: colors.blue }]}>
                      <Ionicons name="person" size={42} color="#FFFFFF" />
                    </View>
                  )}
                  <View style={[styles.cameraBadge, { backgroundColor: colors.blue, borderColor: colors.page }]}>
                    {uploading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="camera" size={16} color="#FFFFFF" />
                    )}
                  </View>
                </Pressable>
                <Text style={[styles.photoHint, { color: colors.muted }]}>Tap the photo to change it</Text>
              </View>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.navy }]}>Personal Information</Text>
                {FIELDS.filter((field) => field.section === 'personal').map(renderField)}
              </View>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.navy }]}>Emergency Contact</Text>
                <Text style={[styles.cardHint, { color: colors.muted }]}>
                  The barangay will call this person if something happens during your trip.
                </Text>
                {FIELDS.filter((field) => field.section === 'emergency').map(renderField)}
              </View>

              <Pressable
                onPress={save}
                disabled={saving}
                style={({ pressed }) => [
                  styles.saveBtn,
                  { backgroundColor: colors.blue },
                  (pressed || saving) && { opacity: 0.8 },
                ]}>
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save Changes</Text>}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
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
  loader: { marginTop: 48 },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  photoWrap: { alignItems: 'center', marginVertical: 12 },
  photo: { width: 104, height: 104, borderRadius: 52 },
  photoFallback: { alignItems: 'center', justifyContent: 'center' },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHint: { marginTop: 8, fontSize: 12, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  cardHint: { fontSize: 12, lineHeight: 17, marginBottom: 4 },
  field: { marginTop: 12 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  required: { color: '#E25C5C' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 11, fontSize: 14 },
  error: { color: '#E25C5C', fontSize: 12, fontWeight: '600', marginTop: 4 },
  lockedHint: { fontSize: 11, marginTop: 4, lineHeight: 15 },
  saveBtn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
