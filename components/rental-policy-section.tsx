import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BRAND_BLUE } from '@/components/brand-lockup';
import { acceptCheckoutPolicy } from '@/lib/bookings';
import { useAppTheme } from '@/lib/theme';
import type { RentalCheckoutPolicyPayload } from '@/lib/types';

type Props = {
  bookingId: number;
  policy: RentalCheckoutPolicyPayload;
  agreed: boolean;
  onAgreedChange: (value: boolean) => void;
};

export function RentalPolicySection({ bookingId, policy, agreed, onAgreedChange }: Props) {
  const { isDark, colors } = useAppTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const canCheck = reachedEnd || policy.accepted;

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 24) {
      setReachedEnd(true);
    }
  }, []);

  async function toggleAgreement() {
    if (!canCheck || accepting) {
      return;
    }

    if (agreed) {
      onAgreedChange(false);
      return;
    }

    setAccepting(true);
    try {
      await acceptCheckoutPolicy(bookingId, policy.version);
      onAgreedChange(true);
    } finally {
      setAccepting(false);
    }
  }

  return (
    <View style={[styles.wrap, { backgroundColor: colors.card, borderColor: agreed ? '#1FA971' : colors.border }]}>
      <View style={styles.headRow}>
        <View style={[styles.headIcon, { backgroundColor: agreed ? (isDark ? '#163528' : '#DFF6EA') : colors.iconBg }]}>
          <Ionicons name={agreed ? 'checkmark-circle' : 'document-text-outline'} size={16} color={agreed ? '#1FA971' : BRAND_BLUE} />
        </View>
        <Text style={[styles.heading, { color: colors.navy }]}>{policy.title}</Text>
      </View>
      <Text style={[styles.summary, { color: colors.muted }]}>{policy.summary}</Text>
      <Pressable
        onPress={() => {
          setModalOpen(true);
          if (policy.accepted) {
            setReachedEnd(true);
          }
        }}
        style={[styles.linkBtn, { borderColor: BRAND_BLUE }]}>
        <Text style={[styles.linkText, { color: BRAND_BLUE }]}>Read Full Policy</Text>
        <Ionicons name="chevron-forward" size={16} color={BRAND_BLUE} />
      </Pressable>

      <Pressable
        disabled={!canCheck || accepting}
        onPress={() => void toggleAgreement()}
        style={styles.checkRow}>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: canCheck ? BRAND_BLUE : colors.border,
              backgroundColor: agreed ? BRAND_BLUE : 'transparent',
              opacity: canCheck ? 1 : 0.5,
            },
          ]}>
          {agreed ? <Ionicons name="checkmark" size={16} color="#FFF" /> : null}
        </View>
        <Text style={[styles.checkLabel, { color: colors.navy }]}>
          I have read and accept the Cancellation, Refund, and No-Show Policy.
        </Text>
      </Pressable>
      {!canCheck ? (
        <Text style={[styles.hint, { color: colors.muted }]}>Tap Read Full Policy and scroll to the end first.</Text>
      ) : null}

      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={[styles.modal, { backgroundColor: isDark ? '#0E1628' : '#F4F7FB' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.navy }]}>{policy.title}</Text>
            <Pressable onPress={() => setModalOpen(false)}>
              <Ionicons name="close" size={26} color={colors.navy} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll} onScroll={onScroll} scrollEventThrottle={16}>
            {policy.sections.map((section) => (
              <View key={section.heading} style={{ marginBottom: 16 }}>
                <Text style={[styles.sectionHeading, { color: colors.navy }]}>{section.heading}</Text>
                <Text style={[styles.sectionBody, { color: colors.muted }]}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>
          <Pressable
            disabled={!reachedEnd || accepting}
            onPress={() => {
              setModalOpen(false);
              if (!agreed) {
                void toggleAgreement();
              }
            }}
            style={[styles.modalDone, { backgroundColor: reachedEnd ? BRAND_BLUE : colors.border }]}>
            {reachedEnd ? <Ionicons name="checkmark-circle" size={18} color="#FFF" /> : (
              <Ionicons name="arrow-down" size={16} color={colors.muted} />
            )}
            <Text style={{ color: reachedEnd ? '#FFF' : colors.muted, fontWeight: '800', fontSize: 15 }}>
              {reachedEnd ? (agreed ? 'Close' : 'I agree to this policy') : 'Scroll to the end to continue'}
            </Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 14 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, fontSize: 15, fontWeight: '800' },
  summary: { marginTop: 8, fontSize: 13, lineHeight: 19 },
  linkBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  linkText: { fontWeight: '700', fontSize: 14 },
  checkRow: { flexDirection: 'row', gap: 10, marginTop: 14, alignItems: 'flex-start' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkLabel: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  hint: { marginTop: 8, fontSize: 11, lineHeight: 16 },
  modal: { flex: 1, paddingTop: 48 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', flex: 1, paddingRight: 12 },
  modalScroll: { padding: 16, paddingBottom: 32 },
  sectionHeading: { fontSize: 14, fontWeight: '800', marginBottom: 6 },
  sectionBody: { fontSize: 13, lineHeight: 20 },
  modalDone: {
    margin: 16,
    borderRadius: 12,
    minHeight: 48,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
