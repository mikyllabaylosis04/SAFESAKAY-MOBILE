import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { BackHandler, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { MODAL_COLORS } from '@/lib/modal-theme';
import { useAppTheme } from '@/lib/theme';

const BLUE = '#1A5AD7';
const GREEN = '#1FA971';
const RED = '#E25C5C';

export default function RentalResultScreen() {
  const router = useRouter();
  const { isDark, colors } = useAppTheme();
  const params = useLocalSearchParams<{ type?: string; code?: string }>();
  const cancelled = params.type === 'cancelled';
  const gcash = params.type === 'gcash';
  const code = params.code?.trim() || 'your request';

  const accent = cancelled ? RED : GREEN;
  const iconName = cancelled ? 'close' : 'checkmark';
  const title = cancelled
    ? 'Rental cancelled!'
    : gcash
      ? 'Wait for admin approval'
      : 'Rental submitted!';
  const message = cancelled
    ? `Request ${code} has been cancelled.`
    : gcash
      ? 'Your GCash is pending admin approval.'
      : `Request ${code} is waiting for the boat operator.`;
  const nextTitle = cancelled ? 'Need a boat?' : "What's next?";
  const nextBody = cancelled
    ? 'Book another boat anytime.'
    : gcash
      ? "We'll notify you once admin reviews it."
      : "We'll notify you once the operator accepts.";
  const nextIcon = cancelled ? 'boat-outline' : 'time-outline';
  const buttonLabel = cancelled ? 'Back to My Rentals' : gcash ? 'Back to Home' : 'View My Rentals';
  const nextHref = cancelled ? '/booking' : gcash ? '/operator-home' : '/booking';
  const statusLabel = cancelled ? 'Cancelled' : gcash ? 'Pending approval' : 'Waiting for operator';

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Modal visible transparent animationType="fade" statusBarTranslucent>
        <View
          style={[
            styles.overlay,
            { backgroundColor: isDark ? 'rgba(8, 12, 20, 0.58)' : MODAL_COLORS.backdrop },
          ]}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.profileTop}>
              <View style={[styles.profileAvatar, { backgroundColor: accent }]}>
                <Ionicons name={iconName} size={24} color="#FFFFFF" />
              </View>
              <View style={styles.profileCopy}>
                <Text style={[styles.passengerName, { color: colors.navy }]}>{title}</Text>
                <Text style={[styles.profileMeta, { color: colors.muted }]}>{message}</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: colors.iconBg }]}>
                <Ionicons name="document-text-outline" size={16} color={colors.blue} />
              </View>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>Request</Text>
              <Text style={[styles.infoValue, { color: colors.navy }]}>{code}</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: colors.iconBg }]}>
                <Ionicons name="ellipse" size={16} color={accent} />
              </View>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>Status</Text>
              <Text style={[styles.infoValue, { color: colors.navy }]}>{statusLabel}</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: colors.iconBg }]}>
                <Ionicons name={nextIcon} size={16} color={colors.blue} />
              </View>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>{nextTitle}</Text>
              <Text style={[styles.infoValue, { color: colors.navy }]}>{nextBody}</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace(nextHref)}
              style={({ pressed }) => [styles.button, { backgroundColor: BLUE }, pressed && styles.pressed]}>
              <Text style={styles.buttonText}>{buttonLabel}</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCopy: {
    flex: 1,
  },
  passengerName: {
    fontSize: 18,
    fontWeight: '800',
  },
  profileMeta: {
    marginTop: 2,
    fontSize: 13,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    width: 102,
    fontSize: 13,
    fontWeight: '600',
    paddingTop: 7,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    paddingTop: 7,
  },
  button: {
    marginTop: 4,
    width: '100%',
    minHeight: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.86,
  },
});
