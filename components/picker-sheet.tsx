import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/lib/theme';

export type PickerSheetItem = {
  key: string;
  title: string;
  subtitle?: string | null;
  trailing?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  selected?: boolean;
  badge?: string | null;
};

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  items: PickerSheetItem[];
  onSelect: (item: PickerSheetItem) => void;
  onClose: () => void;
};

export function PickerSheet({
  visible,
  title,
  subtitle,
  searchPlaceholder = 'Search',
  emptyText = 'No results found.',
  items,
  onSelect,
  onClose,
}: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setQuery('');
    }
  }, [visible]);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? items.filter((item) =>
          [item.title, item.subtitle ?? ''].some((value) => value.toLowerCase().includes(needle)),
        )
      : items;
    return [...filtered].sort((a, b) => Number(Boolean(b.selected)) - Number(Boolean(a.selected)));
  }, [items, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              maxHeight: height * 0.78,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.head}>
            <View style={styles.headCopy}>
              <Text style={[styles.title, { color: colors.navy }]}>{title}</Text>
              {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
            </View>
            <Pressable hitSlop={10} onPress={onClose} style={[styles.close, { backgroundColor: colors.iconBg }]}>
              <Ionicons name="close" size={18} color={colors.navy} />
            </Pressable>
          </View>

          <View style={[styles.search, { backgroundColor: colors.page, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={18} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              style={[styles.searchInput, { color: colors.navy }]}
            />
            {query ? (
              <Pressable hitSlop={8} onPress={() => setQuery('')} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          <Text style={[styles.count, { color: colors.muted }]}>
            {visibleItems.length} {visibleItems.length === 1 ? 'result' : 'results'}
          </Text>

          <FlatList
            data={visibleItems}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>{emptyText}</Text>}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onSelect(item)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderColor: item.selected ? colors.blue : colors.border,
                    backgroundColor: item.selected ? colors.iconBg : 'transparent',
                  },
                  pressed && styles.pressed,
                ]}>
                <View style={[styles.rowIcon, { backgroundColor: colors.iconBg }]}>
                  <Ionicons name={item.icon ?? 'location'} size={16} color={colors.blue} />
                </View>
                <View style={styles.rowCopy}>
                  <Text
                    style={[styles.rowTitle, { color: item.selected ? colors.blue : colors.navy }]}
                    numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.subtitle ? (
                    <Text style={[styles.rowSubtitle, { color: colors.muted }]} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
                {item.badge ? (
                  <View style={[styles.badge, { backgroundColor: colors.blue }]}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                ) : null}
                {item.trailing ? (
                  <Text style={[styles.trailing, { color: colors.blue }]}>{item.trailing}</Text>
                ) : null}
                {item.selected ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.blue} />
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                )}
              </Pressable>
            )}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15, 20, 30, 0.55)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  headCopy: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { marginTop: 3, fontSize: 12, lineHeight: 17 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14 },
  count: { fontSize: 11, fontWeight: '700', marginTop: 10, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  list: { paddingBottom: 8 },
  empty: { textAlign: 'center', paddingVertical: 24, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  rowIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSubtitle: { fontSize: 12, marginTop: 2 },
  trailing: { fontSize: 13, fontWeight: '800' },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  pressed: { opacity: 0.8 },
});
