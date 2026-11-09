import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
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

import { ImageSourceSheet } from '@/components/image-source-sheet';
import { ApiError } from '@/lib/api';
import { reportOperatorNoShowWithEvidence } from '@/lib/no-show';
import { chooseProofFromGallery, takeProofPhoto, type PickedImage } from '@/lib/pick-image';
import { useAppTheme } from '@/lib/theme';
import { OPERATOR_NO_SHOW_REASONS, type OperatorNoShowReason } from '@/lib/types';

const BLUE = '#1A5AD7';
const RED = '#E25C5C';

export default function ReportOperatorNoShowScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const bookingId = Number(params.bookingId);
  const [reason, setReason] = useState<OperatorNoShowReason | null>('both_not_arrived');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleTakePhoto() {
    const picked = await takeProofPhoto();
    if (picked) {
      setPhoto(picked);
    }
  }

  async function handleChooseGallery() {
    const picked = await chooseProofFromGallery();
    if (picked) {
      setPhoto(picked);
    }
  }

  async function submit() {
    if (!bookingId) {
      return;
    }
    if (!reason) {
      Alert.alert('Choose a reason', 'Tell us what did not arrive before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      await reportOperatorNoShowWithEvidence(bookingId, {
        reason,
        note: note.trim() || undefined,
        uri: photo?.uri,
        mime: photo?.mime,
        name: photo?.name,
      });
      router.replace({
        pathname: '/no-show/submitted',
        params: { bookingId: String(bookingId) },
      });
    } catch (err) {
      Alert.alert(
        'Could not submit',
        err instanceof ApiError ? err.firstError() : 'Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.page }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.navy} />
        </Pressable>
        <Text style={[styles.title, { color: colors.navy }]}>Boat did not arrive</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.alert}>
          <Ionicons name="alert-circle" size={20} color={RED} />
          <Text style={styles.alertText}>
            Use this only if you waited and the assigned boat did not arrive. The barangay will verify your report
            first. Your booking is not cancelled automatically.
          </Text>
        </View>
        <Text style={[styles.label, { color: colors.muted }]}>What happened? *</Text>
        <View style={styles.reasons}>
          {OPERATOR_NO_SHOW_REASONS.map((option) => {
            const selected = reason === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setReason(option.value)}
                style={[
                  styles.reason,
                  { borderColor: selected ? BLUE : colors.border, backgroundColor: selected ? '#EAF2FF' : 'transparent' },
                ]}>
                <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? BLUE : colors.muted} />
                <Text style={[styles.reasonText, { color: selected ? BLUE : colors.navy }]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.label, { color: colors.muted }]}>Explanation (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="Describe what happened..."
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.navy }]}
        />
        <Text style={[styles.label, { color: colors.muted }]}>Proof photo (optional)</Text>
        {photo?.uri ? (
          <View style={[styles.previewWrap, { borderColor: colors.border }]}>
            <Image source={{ uri: photo.uri }} style={styles.preview} contentFit="cover" />
            <View style={styles.previewActions}>
              <Pressable onPress={() => setSourceOpen(true)} style={[styles.previewBtn, { borderColor: BLUE }]}>
                <Text style={{ color: BLUE, fontWeight: '700' }}>Change</Text>
              </Pressable>
              <Pressable onPress={() => setPhoto(null)} style={[styles.previewBtn, { borderColor: RED }]}>
                <Text style={{ color: RED, fontWeight: '700' }}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setSourceOpen(true)} style={[styles.upload, { borderColor: colors.border }]}>
            <Ionicons name="camera-outline" size={28} color={BLUE} />
            <Text style={{ color: colors.navy, fontWeight: '600' }}>Take photo or upload from gallery</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Max 5MB (JPG, PNG)</Text>
          </Pressable>
        )}
        <Pressable
          disabled={submitting || !reason}
          onPress={() => void submit()}
          style={[styles.primaryBtn, (submitting || !reason) && { opacity: 0.6 }]}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Submit Report</Text>}
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.secondaryBtn}>
          <Text style={[styles.secondaryText, { color: BLUE }]}>Cancel</Text>
        </Pressable>
      </ScrollView>

      <ImageSourceSheet
        visible={sourceOpen}
        onClose={() => setSourceOpen(false)}
        onTakePhoto={() => void handleTakePhoto()}
        onChooseGallery={() => void handleChooseGallery()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  body: { padding: 16, gap: 12 },
  alert: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FDECEC',
    borderRadius: 12,
    padding: 12,
  },
  alertText: { flex: 1, color: '#7A1E1E', fontSize: 13, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600' },
  reasons: { gap: 8 },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  reasonText: { flex: 1, fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  upload: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  previewWrap: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    gap: 0,
  },
  preview: { width: '100%', height: 180 },
  previewActions: { flexDirection: 'row', gap: 8, padding: 10 },
  previewBtn: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
  secondaryBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BLUE,
    borderRadius: 12,
  },
  secondaryText: { fontWeight: '700' },
});
