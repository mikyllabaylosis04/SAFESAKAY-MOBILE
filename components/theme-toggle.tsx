import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { useAppTheme } from '@/lib/theme';

export function ThemeToggle() {
  const { isDark, toggleTheme, colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      hitSlop={8}
      onPress={toggleTheme}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
      <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={22} color={colors.navy} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
