import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/lib/api';
import { updateBoatStatus } from '@/lib/boats';
import { modal, MODAL_COLORS } from '@/lib/modal-theme';
import { useAppTheme } from '@/lib/theme';
import type { Boat } from '@/lib/types';

const AMBER = '#E39B2B';
const GREEN = '#1FA971';
const RED = '#E25C5C';

type StatusOption = 'available' | 'maintenance' | 'unavailable';

const OPTIONS: {
  value: StatusOption;
  label: string;
  color: string;
  colorDark: string;
  bg: string;
  bgDark: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'available', label: 'Available', color: GREEN, colorDark: '#4ED89A', bg: '#DFF6EA', bgDark: '#163528', icon: 'checkmark-circle' },
  { value: 'maintenance', label: 'Maintenance', color: AMBER, colorDark: '#FFB070', bg: '#FFF4E5', bgDark: '#3A2E1C', icon: 'construct' },
  { value: 'unavailable', label: 'Unavailable', color: RED, colorDark: '#FF8B8B', bg: '#FDECEC', bgDark: '#3A2224', icon: 'close-circle' },
];

function isDown(boat: Boat) {
  return boat.status === 'maintenance' || boat.status === 'unavailable';
}

type Props = {
  boats: Boat[];
  onUpdated: (boat: Boat) => void;
};

export function BoatStatusAlert({ boats, onUpdated }: Props) {
  const { colors, isDark } = useAppTheme();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pending, setPending] = useState<{ boat: Boat; status: StatusOption } | null>(null);
  const [result, setResult] = useState<{ title: string; body: string; ok: boolean } | null>(null);
  const downBoats = boats.filter(isDown);
  const alertBoat = boats.find((item) => item.id === selectedId) ?? downBoats[0] ?? boats[0];

  if (!alertBoat) {
    return null;
  }

  const down = isDown(alertBoat);
  const saving = savingId !== null;
  const pendingOption = pending ? OPTIONS.find((item) => item.value === pending.status) : null;

  function requestStatus(boat: Boat, status: StatusOption) {
    if (boat.status === status || saving) {
      return;
    }
    setPending({ boat, status });
  }

  async function confirmSend() {
    if (!pending) {
      return;
    }

    const { boat, status } = pending;
    setSavingId(`${boat.id}-${status}`);
    try {
      const next = await updateBoatStatus(boat.id, status);
      onUpdated(next);
      setPending(null);
      setResult({
        title: 'Sent to admin',
        body: `${next.name} is now ${next.status_label}.`,
        ok: true,
      });
    } catch (err) {
      setPending(null);
      setResult({
        title: 'Unable to send',
        body: err instanceof ApiError ? err.firstError() : 'Please try again.',
        ok: false,
      });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: down ? (isDark ? '#2A2418' : '#FFF8EE') : colors.card,
          borderColor: down ? (isDark ? '#8A6A32' : '#F0C48A') : colors.border,
        },
      ]}>
      <View style={styles.head}>
        <View style={[styles.headIcon, { backgroundColor: down ? (isDark ? '#3A2E1C' : '#FFF4E5') : colors.iconBg }]}>
          <Ionicons name={down ? 'warning' : 'pulse-outline'} size={16} color={down ? AMBER : colors.blue} />
        </View>
        <View style={styles.headCopy}>
          <Text style={[styles.title, { color: colors.navy }]}>Boat Status</Text>
          <Text style={[styles.body, { color: colors.muted }]}>
            {down
              ? 'Passengers cannot book this boat right now. Set it to Available when it is ready.'
              : 'Passengers can book this boat. Change it if the boat needs repair or cannot sail.'}
          </Text>
        </View>
      </View>

      {boats.length > 1 ? (
        <View style={styles.boatPicker}>
          {boats.map((boat) => {
            const selected = boat.id === alertBoat.id;
            return (
              <Pressable
                key={boat.id}
                onPress={() => setSelectedId(boat.id)}
                style={[
                  styles.boatChip,
                  {
                    borderColor: selected ? colors.blue : colors.border,
                    backgroundColor: selected ? colors.iconBg : colors.card,
                  },
                ]}>
                <Text style={[styles.boatChipText, { color: selected ? colors.blue : colors.navy }]}>
                  {boat.code}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.optionRow}>
        {OPTIONS.map((option) => {
          const active = alertBoat.status === option.value;
          const busy = savingId === `${alertBoat.id}-${option.value}`;
          const tone = isDark ? option.colorDark : option.color;
          const tint = isDark ? option.bgDark : option.bg;
          return (
            <Pressable
              key={option.value}
              disabled={saving || alertBoat.can_update_status === false}
              onPress={() => requestStatus(alertBoat, option.value)}
              style={[
                styles.option,
                {
                  borderColor: tone,
                  backgroundColor: active ? tone : tint,
                },
              ]}>
              {busy ? (
                <ActivityIndicator color={active ? '#FFFFFF' : tone} size="small" />
              ) : (
                <Text style={[styles.optionText, { color: active ? '#FFFFFF' : tone }]}>
                  {option.label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
      <Modal
        visible={pending !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPending(null)}>
        <Pressable style={styles.overlay} onPress={() => setPending(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Pressable onPress={() => setPending(null)} hitSlop={10} style={styles.modalClose}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </Pressable>
            <View
              style={[
                styles.modalIcon,
                { backgroundColor: pendingOption ? pendingOption.bg : '#E8F1FF' },
              ]}>
              <Ionicons
                name={pendingOption?.icon ?? 'send'}
                size={24}
                color={pendingOption?.color ?? colors.blue}
              />
            </View>
            <Text style={[styles.modalTitle, { color: colors.navy }]}>Send to admin?</Text>
            <Text style={[styles.modalBody, { color: colors.muted }]}>
              {pending
                ? `${pending.boat.name} (${pending.boat.code}) → ${pendingOption?.label}`
                : ''}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                disabled={saving}
                onPress={() => setPending(null)}
                style={({ pressed }) => [styles.keepBtn, pressed && styles.pressed]}>
                <Text style={styles.keepText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={saving}
                onPress={() => void confirmSend()}
                style={({ pressed }) => [
                  styles.sendBtn,
                  { backgroundColor: pendingOption?.color ?? colors.blue },
                  (pressed || saving) && styles.pressed,
                ]}>
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.sendText}>Send</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={result !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setResult(null)}>
        <Pressable style={styles.overlay} onPress={() => setResult(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Pressable onPress={() => setResult(null)} hitSlop={10} style={styles.modalClose}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </Pressable>
            <View
              style={[
                styles.modalIcon,
                { backgroundColor: result?.ok ? '#DFF6EA' : '#FDECEC' },
              ]}>
              <Ionicons
                name={result?.ok ? 'checkmark-circle' : 'alert-circle'}
                size={24}
                color={result?.ok ? GREEN : RED}
              />
            </View>
            <Text style={[styles.modalTitle, { color: colors.navy }]}>{result?.title}</Text>
            <Text style={[styles.modalBody, { color: colors.muted }]}>{result?.body}</Text>
            <Pressable
              onPress={() => setResult(null)}
              style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]}>
              <Text style={styles.sendText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginTop: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  headIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headCopy: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  body: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
  },
  boatPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  boatChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  boatChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  optionLabel: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: '700',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 10,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 12,
    fontWeight: '800',
  },
  hint: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 16,
  },
  overlay: modal.overlay,
  modalCard: modal.card,
  modalClose: modal.close,
  modalIcon: modal.icon,
  modalTitle: modal.title,
  modalBody: modal.body,
  modalActions: modal.actions,
  keepBtn: {
    ...modal.btn,
    ...modal.btnGhost,
  },
  keepText: modal.btnGhostText,
  sendBtn: modal.btn,
  sendText: modal.btnText,
  doneBtn: {
    ...modal.btnFull,
    backgroundColor: MODAL_COLORS.blue,
  },
  pressed: {
    opacity: 0.82,
  },
});
