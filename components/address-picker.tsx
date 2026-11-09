import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchLocations, type GeoItem, type PickedAddress } from '@/lib/psgc';
import { useAppTheme } from '@/lib/theme';

const BLUE = '#1A5AD7';
const NAVY = '#1B2744';
const MUTED = '#3F4A63';

type Step = 'region' | 'province' | 'city' | 'barangay';

const STEP_META: Record<Step, { current: string; list: string; parent: Step | null }> = {
  region: { current: 'Select Region', list: 'Region', parent: null },
  province: { current: 'Select Province', list: 'Province', parent: 'region' },
  city: { current: 'Select City / Municipality', list: 'City / Municipality', parent: 'province' },
  barangay: { current: 'Select Barangay', list: 'Barangay', parent: 'city' },
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (value: PickedAddress) => void;
};

export function AddressPicker({ open, onClose, onSelect }: Props) {
  const { colors, isDark } = useAppTheme();
  const [step, setStep] = useState<Step>('region');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [region, setRegion] = useState<GeoItem | null>(null);
  const [province, setProvince] = useState<GeoItem | null>(null);
  const [city, setCity] = useState<GeoItem | null>(null);
  const [regions, setRegions] = useState<GeoItem[]>([]);
  const [provinces, setProvinces] = useState<GeoItem[]>([]);
  const [cities, setCities] = useState<GeoItem[]>([]);
  const [barangays, setBarangays] = useState<GeoItem[]>([]);

  async function load(type: string, code = '') {
    setLoading(true);
    setError('');

    try {
      const items = await fetchLocations(type, code);
      if (items.length === 0) {
        setError('No locations found. Try again.');
      }
      return items;
    } catch {
      setError('Unable to load locations. Check your internet connection.');
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery('');
    setError('');

    if (regions.length === 0) {
      load('island-groups').then(setRegions);
    }

    if (!region) {
      setStep('region');
    }
  }, [open]);

  const source =
    step === 'region' ? regions : step === 'province' ? provinces : step === 'city' ? cities : barangays;

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return source;
    }
    return source.filter((item) => item.name.toLowerCase().includes(needle));
  }, [query, source]);

  function resetSelection() {
    setStep('region');
    setQuery('');
    setRegion(null);
    setProvince(null);
    setCity(null);
    setProvinces([]);
    setCities([]);
    setBarangays([]);
    setError('');
  }

  async function choose(item: GeoItem) {
    setQuery('');

    if (step === 'region') {
      setRegion(item);
      setProvince(null);
      setCity(null);
      setCities([]);
      setBarangays([]);
      setProvinces(await load('island-provinces', item.code.toLowerCase()));
      setStep('province');
      return;
    }

    if (step === 'province') {
      setProvince(item);
      setCity(null);
      setBarangays([]);
      setCities(await load('cities', item.code));
      setStep('city');
      return;
    }

    if (step === 'city') {
      setCity(item);
      setBarangays(await load('barangays', item.code));
      setStep('barangay');
      return;
    }

    onSelect({
      address: [item.name, city?.name, province?.name].filter(Boolean).join(', '),
      region: region?.name ?? '',
      province: province?.name ?? '',
      city: city?.name ?? '',
      barangay: item.name,
    });
    onClose();
  }

  function jumpTo(target: Step) {
    setQuery('');
    setError('');
    setStep(target);

    if (target === 'region') {
      setProvince(null);
      setCity(null);
      setCities([]);
      setBarangays([]);
      return;
    }

    if (target === 'province') {
      setCity(null);
      setBarangays([]);
    }
  }

  function goBack() {
    const parent = STEP_META[step].parent;
    if (!parent) {
      onClose();
      return;
    }
    jumpTo(parent);
  }

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: isDark ? colors.page : '#FFFFFF' }]} edges={['top', 'bottom']}>
        <View style={styles.searchRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            onPress={goBack}
            style={styles.iconButton}>
            <Ionicons name="arrow-back" size={22} color={colors.navy} />
          </Pressable>
          <View style={[styles.searchWrap, { backgroundColor: isDark ? colors.iconBg : '#F4F6F8' }]}>
            <Ionicons name="search" size={16} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search City, District or Postal Code"
              placeholderTextColor={colors.muted}
              style={[styles.searchInput, { color: colors.navy }]}
            />
          </View>
        </View>

        <View style={styles.regionHeader}>
          <Text style={[styles.regionLabel, { color: colors.muted }]}>Region Selected</Text>
          <Pressable onPress={resetSelection} hitSlop={8}>
            <Text style={[styles.resetText, { color: colors.blue }]}>Reset</Text>
          </Pressable>
        </View>

        <View style={styles.trail}>
          {region ? (
            <Pressable onPress={() => jumpTo('region')} style={styles.trailItem}>
              <View style={styles.trailDot} />
              <Text style={[styles.trailText, { color: colors.muted }]}>{region.name}</Text>
            </Pressable>
          ) : null}
          {province ? (
            <Pressable onPress={() => jumpTo('province')} style={styles.trailItem}>
              <View style={styles.trailDot} />
              <Text style={[styles.trailText, { color: colors.muted }]}>{province.name}</Text>
            </Pressable>
          ) : null}
          {city ? (
            <Pressable onPress={() => jumpTo('city')} style={styles.trailItem}>
              <View style={styles.trailDot} />
              <Text style={[styles.trailText, { color: colors.muted }]}>{city.name}</Text>
            </Pressable>
          ) : null}

          <View style={styles.currentStep}>
            <View style={styles.currentDot} />
            <Text style={[styles.currentText, { color: colors.blue }]}>{STEP_META[step].current}</Text>
          </View>
        </View>

        <View style={[styles.listHeader, { backgroundColor: isDark ? colors.iconBg : '#F3F5F7' }]}>
          <Text style={[styles.listHeaderText, { color: colors.muted }]}>{STEP_META[step].list}</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.blue} />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.muted }]}>No matching places.</Text>}
            renderItem={({ item }) => (
              <Pressable onPress={() => choose(item)} style={[styles.row, { borderBottomColor: colors.border }]}>
                <Text style={[styles.rowLetter, { color: colors.muted }]}>{item.name.charAt(0).toUpperCase()}</Text>
                <Text style={[styles.rowName, { color: colors.navy }]}>{item.name}</Text>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: '#F4F6F8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 42,
    color: NAVY,
    fontSize: 14,
  },
  regionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  regionLabel: {
    color: MUTED,
    fontSize: 13,
  },
  resetText: {
    color: BLUE,
    fontSize: 13,
    fontWeight: '700',
  },
  trail: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  trailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  trailDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D9E2EA',
  },
  trailText: {
    color: MUTED,
    fontSize: 15,
  },
  currentStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: BLUE,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  currentDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 5,
    borderColor: BLUE,
  },
  currentText: {
    color: BLUE,
    fontSize: 15,
    fontWeight: '600',
  },
  listHeader: {
    backgroundColor: '#F3F5F7',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  listHeaderText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    paddingBottom: 24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    paddingHorizontal: 20,
    paddingVertical: 28,
    color: '#D64545',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyText: {
    paddingHorizontal: 20,
    paddingVertical: 28,
    color: MUTED,
    fontSize: 14,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingRight: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F5',
  },
  rowLetter: {
    width: 40,
    textAlign: 'center',
    color: '#3F4A63',
    fontSize: 13,
    fontWeight: '700',
  },
  rowName: {
    flex: 1,
    color: '#2B3A4A',
    fontSize: 15,
  },
});
