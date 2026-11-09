import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/lib/theme';

type Props = {
  message: string;
  offline?: boolean;
  onRetry?: () => void;
  compact?: boolean;
};

export function LoadError({ message, offline = false, onRetry, compact = false }: Props) {
  const { colors } = useAppTheme();

  if (compact) {
    return (
      <View style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'} size={18} color="#E25C5C" />
        <Text style={[styles.bannerText, { color: colors.navy }]}>{message}</Text>
        {onRetry ? (
          <Pressable hitSlop={8} onPress={onRetry}>
            <Text style={[styles.bannerRetry, { color: colors.blue }]}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Ionicons name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'} size={28} color={colors.muted} />
      <Text style={[styles.title, { color: colors.navy }]}>{offline ? 'You are offline' : 'Something went wrong'}</Text>
      <Text style={[styles.text, { color: colors.muted }]}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={[styles.retry, { borderColor: colors.blue }]}>
          <Text style={[styles.retryText, { color: colors.blue }]}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 20, alignItems: 'center', gap: 6, marginVertical: 8 },
  title: { fontSize: 16, fontWeight: '800' },
  text: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  retry: { marginTop: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  retryText: { fontWeight: '800', fontSize: 13 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  bannerText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  bannerRetry: { fontSize: 13, fontWeight: '800' },
});
