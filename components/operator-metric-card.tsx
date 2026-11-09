import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/lib/theme';

type Props = {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  softBg: string;
  active?: boolean;
  badge?: number;
  width?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
};

export function OperatorMetricCard({
  label,
  value,
  icon,
  color,
  softBg,
  active = false,
  badge = 0,
  width,
  style,
  onPress,
}: Props) {
  const { colors, isDark } = useAppTheme();
  const cardBg = active ? softBg : colors.card;
  const valueColor = active ? color : colors.navy;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        {
          width,
          backgroundColor: cardBg,
          borderLeftColor: color,
          borderColor: isDark ? colors.border : 'transparent',
          borderWidth: isDark ? 1 : 0,
          borderLeftWidth: 4,
          shadowColor: '#0F172A',
        },
        pressed && onPress ? styles.pressed : null,
        style,
      ]}>
      {badge > 0 ? (
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}

      <View style={[styles.iconCircle, { backgroundColor: softBg }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>

      <Text style={[styles.value, { color: valueColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>

      <Text style={[styles.label, { color: colors.muted }]} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    paddingHorizontal: 6,
    paddingVertical: 10,
    minHeight: 86,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    overflow: 'visible',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  label: {
    width: '100%',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 11,
  },
  badge: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: '#E25C5C',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
    elevation: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
