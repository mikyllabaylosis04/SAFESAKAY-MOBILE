import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/lib/theme';

type Tone = 'red' | 'yellow' | 'blue' | 'violet';

type Props = {
  title: string;
  body: string;
  tone?: Tone;
  actionLabel?: string;
  onAction?: () => void;
};

type Palette = {
  bg: [string, string];
  border: [string, string];
  title: [string, string];
  body: [string, string];
  action: string;
  icon: keyof typeof Ionicons.glyphMap;
};

/** [light, dark] colors, matching the announcement categories on the admin web. */
const PALETTES: Record<Tone, Palette> = {
  red: {
    bg: ['#FDECEC', '#3A2224'],
    border: ['#F3B4B4', '#6B3034'],
    title: ['#C53030', '#FFB4B4'],
    body: ['#9B2C2C', '#F6D5D5'],
    action: '#C53030',
    icon: 'warning',
  },
  yellow: {
    bg: ['#FFF7E0', '#3A2F14'],
    border: ['#F6C453', '#8A6A1A'],
    title: ['#B45309', '#FFD978'],
    body: ['#92400E', '#F6E2B0'],
    action: '#D97706',
    icon: 'warning',
  },
  blue: {
    bg: ['#EEF4FF', '#1B2C4D'],
    border: ['#C5D8F7', '#2E4A78'],
    title: ['#1A5AD7', '#8CBCFF'],
    body: ['#3F4A63', '#C5CDD8'],
    action: '#1A5AD7',
    icon: 'megaphone',
  },
  violet: {
    bg: ['#F3EEFF', '#2C2448'],
    border: ['#D5C8FB', '#4A3C7A'],
    title: ['#6D4AE0', '#C4B5FF'],
    body: ['#4C3A8A', '#DCD3FA'],
    action: '#7A5AF8',
    icon: 'megaphone',
  },
};

export function WeatherAlert({ title, body, tone = 'red', actionLabel, onAction }: Props) {
  const { isDark } = useAppTheme();
  const palette = PALETTES[tone] ?? PALETTES.red;
  const pick = (pair: [string, string]) => (isDark ? pair[1] : pair[0]);
  const titleColor = pick(palette.title);

  return (
    <View style={[styles.card, { backgroundColor: pick(palette.bg), borderColor: pick(palette.border) }]}>
      <View style={styles.head}>
        <Ionicons name={palette.icon} size={16} color={titleColor} />
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
      </View>
      <Text style={[styles.body, { color: pick(palette.body) }]}>{body}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.action, { backgroundColor: palette.action }, pressed && styles.pressed]}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  action: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.82,
  },
});
