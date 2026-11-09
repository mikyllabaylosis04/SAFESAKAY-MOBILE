import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { PickerSheet } from '@/components/picker-sheet';
import { fetchOrganizations, getStoredUser, setServiceArea } from '@/lib/auth';
import { useAppTheme } from '@/lib/theme';
import type { AuthUser, Organization } from '@/lib/types';
import { availableServiceAreas, FALLBACK_BARANGAYS, matchOrganizationFromAddress } from '@/lib/types';

type Props = {
  onChanged?: (user: AuthUser) => void;
};

export function ServiceAreaPicker({ onChanged }: Props) {
  const { colors } = useAppTheme();
  const [areas, setAreas] = useState<Organization[]>(FALLBACK_BARANGAYS);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [addressLabel, setAddressLabel] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    Promise.all([fetchOrganizations().catch(() => FALLBACK_BARANGAYS), getStoredUser()])
      .then(async ([items, user]) => {
        if (!active) {
          return;
        }
        const areas = availableServiceAreas(items.length > 0 ? items : FALLBACK_BARANGAYS);
        setAreas(areas);
        setAddressLabel(user?.address?.trim() ?? '');

        const currentId = user?.organization?.id ?? null;
        setCurrentOrg(user?.organization ?? null);
        setSelectedId(currentId);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const selected =
    areas.find((item) => item.id === selectedId) ??
    (currentOrg && currentOrg.id === selectedId ? currentOrg : undefined);
  const suggestedId = useMemo(
    () => (addressLabel ? matchOrganizationFromAddress(areas, { address: addressLabel })?.id ?? null : null),
    [areas, addressLabel],
  );

  async function choose(item: Organization) {
    setOpen(false);
    if (item.id === selectedId) {
      return;
    }

    setSaving(true);
    try {
      const user = await setServiceArea(item.id);
      setSelectedId(user.organization?.id ?? item.id);
      setCurrentOrg(user.organization ?? item);
      onChanged?.(user);
    } catch {
      // Keep the current area if the update fails.
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.muted }]}>Service Area</Text>
      {addressLabel ? (
        <Text style={[styles.addressHint, { color: colors.muted }]} numberOfLines={2}>
          From your address: {addressLabel}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change service area"
        disabled={loading || saving}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.select,
          { borderColor: colors.border, backgroundColor: colors.iconBg },
          pressed && styles.pressed,
        ]}>
        <Ionicons name="location" size={16} color={colors.blue} />
        <Text style={[styles.value, { color: selected ? colors.navy : colors.muted }]} numberOfLines={1}>
          {selected?.name ?? 'Select service area'}
        </Text>
        {loading || saving ? (
          <ActivityIndicator color={colors.blue} />
        ) : (
          <Text style={[styles.change, { color: colors.blue }]}>Change</Text>
        )}
      </Pressable>

      <PickerSheet
        visible={open}
        title="Choose Service Area"
        subtitle={`${areas.length} barangays available. Boats and destinations will follow the area you pick.`}
        searchPlaceholder="Search barangay or municipality"
        emptyText="No barangay matches your search."
        items={areas.map((item) => ({
          key: String(item.id),
          title: item.name,
          icon: 'location' as const,
          selected: item.id === selectedId,
          badge: suggestedId === item.id && item.id !== selectedId ? 'Near you' : null,
        }))}
        onClose={() => setOpen(false)}
        onSelect={(entry) => {
          const area = areas.find((item) => String(item.id) === entry.key);
          if (area) {
            void choose(area);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  addressHint: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  select: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  value: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  change: {
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.8,
  },
});
