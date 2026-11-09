import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLockup } from '@/components/brand-lockup';
import { NotificationBell } from '@/components/notification-bell';
import { PassengerTabs } from '@/components/passenger-tabs';
import { SideMenu } from '@/components/side-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { friendlyError, isOfflineError } from '@/lib/api';
import { fetchRentalBoats } from '@/lib/boats';
import { useRequireActiveOrganization } from '@/lib/organization-access';
import { resolveMediaUrl } from '@/lib/config';
import { useAppTheme } from '@/lib/theme';
import type { Boat } from '@/lib/types';

const GREEN = '#1FA971';
const ORANGE = '#E39B2B';
const STAR = '#F5C542';

const CAPACITY_FILTERS: { key: number; label: string }[] = [
  { key: 0, label: 'Any size' },
  { key: 5, label: '5+ pax' },
  { key: 10, label: '10+ pax' },
  { key: 15, label: '15+ pax' },
];

function destinationNames(boat: Boat): string[] {
  return (boat.rental_destinations ?? [])
    .map((item) => (item.destination || item.name || '').trim())
    .filter(Boolean);
}

function lowestPriceLabel(boat: Boat): string | null {
  const priced = (boat.rental_destinations ?? []).filter((item) => typeof item.rental_price === 'number');
  if (priced.length === 0) {
    return null;
  }
  const cheapest = priced.reduce((min, item) => ((item.rental_price ?? 0) < (min.rental_price ?? 0) ? item : min));
  return cheapest.rental_price_label ?? null;
}

function BoatRow({ boat, purpose }: { boat: Boat; purpose?: string }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const photo = resolveMediaUrl(boat.picture_url);
  const available = boat.status === 'available';
  const price = lowestPriceLabel(boat);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {photo ? (
        <Image source={{ uri: photo }} style={styles.boatImage} contentFit="cover" />
      ) : (
        <View style={[styles.boatImage, styles.boatImageEmpty, { backgroundColor: colors.iconBg }]}>
          <Ionicons name="boat-outline" size={34} color={colors.blue} />
        </View>
      )}
      <View style={styles.cardInfo}>
        <View style={styles.cardTop}>
          <Text style={[styles.boatName, { color: colors.navy }]} numberOfLines={1}>
            {boat.name}
          </Text>
          <Text style={available ? styles.available : styles.onTrip}>{boat.status_label}</Text>
        </View>
        <Text style={[styles.boatCode, { color: colors.muted }]}>{boat.code}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="star" size={13} color={STAR} />
          <Text style={[styles.metaText, { color: colors.muted }]}>
            {boat.rating_count
              ? `${(boat.rating_average ?? 0).toFixed(1)} (${boat.rating_count} review${boat.rating_count === 1 ? '' : 's'})`
              : 'No reviews yet'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="people-outline" size={13} color={colors.muted} />
          <Text style={[styles.metaText, { color: colors.muted }]}>{boat.capacity} passengers</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="shield-checkmark-outline" size={13} color={colors.muted} />
          <Text style={[styles.metaText, { color: colors.muted }]}>
            {boat.life_jacket_quantity ? `${boat.life_jacket_quantity} life jackets` : boat.home_port || 'Private rental'}
          </Text>
        </View>
        {price ? <Text style={[styles.price, { color: colors.blue }]}>From {price}</Text> : null}
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/rent-boat',
              params: purpose ? { id: String(boat.id), purpose } : { id: String(boat.id) },
            })
          }
          style={({ pressed }) => [
            styles.detailsBtn,
            { backgroundColor: colors.card, borderColor: colors.blue },
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.detailsText, { color: colors.blue }]}>View Details</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function BoatsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ purpose?: string; destination?: string }>();
  const { colors, isDark } = useAppTheme();
  const allowed = useRequireActiveOrganization('passenger-rental');
  const [menuOpen, setMenuOpen] = useState(false);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [query, setQuery] = useState('');
  const [minCapacity, setMinCapacity] = useState(0);
  const [destination, setDestination] = useState(params.destination ?? '');
  const [availableOnly, setAvailableOnly] = useState(false);
  const purpose = params.purpose?.trim() || undefined;

  const load = useCallback(() => {
    setError('');
    return fetchRentalBoats()
      .then((items) => {
        setBoats(items);
        setOffline(false);
      })
      .catch((err) => {
        setOffline(isOfflineError(err));
        setError(friendlyError(err, 'Could not load boats.'));
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const destinations = useMemo(() => {
    const names = new Set<string>();
    boats.forEach((boat) => destinationNames(boat).forEach((name) => names.add(name)));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [boats]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return boats.filter((boat) => {
      if (minCapacity > 0 && boat.capacity < minCapacity) {
        return false;
      }
      if (availableOnly && boat.status !== 'available') {
        return false;
      }
      if (destination && !destinationNames(boat).some((name) => name.toLowerCase() === destination.toLowerCase())) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return [boat.name, boat.code, boat.home_port ?? '', boat.operator_name ?? '', ...destinationNames(boat)].some((value) =>
        value.toLowerCase().includes(needle),
      );
    });
  }, [boats, query, minCapacity, availableOnly, destination]);

  const filtersActive = Boolean(query.trim() || minCapacity || destination || availableOnly);

  function clearFilters() {
    setQuery('');
    setMinCapacity(0);
    setDestination('');
    setAvailableOnly(false);
  }

  if (!allowed) {
    return <View style={[styles.screen, { backgroundColor: colors.page }]} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.blue}
              colors={[colors.blue]}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Pressable hitSlop={8} style={styles.headerBtn} onPress={() => setMenuOpen(true)}>
                <Ionicons name="menu-outline" size={26} color={colors.navy} />
              </Pressable>
              <BrandLockup color={colors.blue} />
            </View>
            <View style={styles.headerRight}>
              <ThemeToggle />
              <NotificationBell />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open profile"
                onPress={() => router.push('/profile')}
                style={[styles.avatar, { backgroundColor: colors.blue }]}>
                <Ionicons name="person" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          <Text style={[styles.title, { color: colors.navy }]}>Rent a Boat</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Choose a boat, then pick your date, time and route.</Text>

          {purpose ? (
            <View style={[styles.purposeBanner, { backgroundColor: colors.iconBg }]}>
              <Ionicons name="sparkles-outline" size={16} color={colors.blue} />
              <Text style={[styles.purposeText, { color: colors.navy }]}>
                Trip purpose: <Text style={{ fontWeight: '800' }}>{purpose}</Text>
              </Text>
              <Pressable hitSlop={8} onPress={() => router.setParams({ purpose: '' })}>
                <Ionicons name="close" size={16} color={colors.muted} />
              </Pressable>
            </View>
          ) : null}

          <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={18} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search boat, destination, or port"
              placeholderTextColor={colors.muted}
              style={[styles.searchInput, { color: colors.navy }]}
              autoCorrect={false}
              returnKeyType="search"
            />
            {query ? (
              <Pressable hitSlop={8} onPress={() => setQuery('')} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Pressable
              onPress={() => setAvailableOnly((value) => !value)}
              style={[
                styles.chip,
                { borderColor: availableOnly ? GREEN : colors.border, backgroundColor: availableOnly ? GREEN : colors.card },
              ]}>
              <Text style={[styles.chipText, { color: availableOnly ? '#FFFFFF' : colors.navy }]}>Available now</Text>
            </Pressable>
            {CAPACITY_FILTERS.map((item) => {
              const active = item.key === minCapacity;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setMinCapacity(item.key)}
                  style={[
                    styles.chip,
                    { borderColor: active ? colors.blue : colors.border, backgroundColor: active ? colors.blue : colors.card },
                  ]}>
                  <Text style={[styles.chipText, { color: active ? '#FFFFFF' : colors.navy }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {destinations.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {['', ...destinations].map((name) => {
                const active = destination.toLowerCase() === name.toLowerCase();
                return (
                  <Pressable
                    key={name || 'all'}
                    onPress={() => setDestination(name)}
                    style={[
                      styles.chip,
                      { borderColor: active ? colors.blue : colors.border, backgroundColor: active ? colors.blue : colors.card },
                    ]}>
                    <Ionicons name="location-outline" size={12} color={active ? '#FFFFFF' : colors.muted} />
                    <Text style={[styles.chipText, { color: active ? '#FFFFFF' : colors.navy }]}>{name || 'All destinations'}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {loading ? <ActivityIndicator color={colors.blue} style={styles.loader} /> : null}

          {!loading && error ? (
            <View style={[styles.stateCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'} size={28} color={colors.muted} />
              <Text style={[styles.stateTitle, { color: colors.navy }]}>{offline ? 'You are offline' : 'Something went wrong'}</Text>
              <Text style={[styles.stateText, { color: colors.muted }]}>{error}</Text>
              <Pressable onPress={() => { setLoading(true); void load(); }} style={[styles.retry, { borderColor: colors.blue }]}>
                <Text style={[styles.retryText, { color: colors.blue }]}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {!loading && !error && visible.length === 0 ? (
            <View style={[styles.stateCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="boat-outline" size={28} color={colors.muted} />
              <Text style={[styles.stateTitle, { color: colors.navy }]}>
                {boats.length === 0 ? 'No boats yet' : 'No matching boats'}
              </Text>
              <Text style={[styles.stateText, { color: colors.muted }]}>
                {boats.length === 0
                  ? 'No boats are open for rental in this service area yet. You can change the service area on Home.'
                  : 'Try another search or remove some filters.'}
              </Text>
              {filtersActive ? (
                <Pressable onPress={clearFilters} style={[styles.retry, { borderColor: colors.blue }]}>
                  <Text style={[styles.retryText, { color: colors.blue }]}>Clear filters</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {!loading && visible.length > 0 ? (
            <Text style={[styles.count, { color: colors.muted }]}>
              {visible.length} boat{visible.length === 1 ? '' : 's'} found
            </Text>
          ) : null}

          {visible.map((boat) => (
            <BoatRow key={boat.id} boat={boat} purpose={purpose} />
          ))}
        </ScrollView>
      </SafeAreaView>
      <PassengerTabs active="boats" />
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    marginBottom: 18,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { marginTop: 6, marginBottom: 14, fontSize: 14 },
  purposeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  purposeText: { flex: 1, fontSize: 13 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14 },
  chips: { gap: 8, paddingBottom: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  loader: { marginVertical: 28 },
  stateCard: { borderWidth: 1, borderRadius: 18, padding: 20, alignItems: 'center', gap: 6, marginTop: 4 },
  stateTitle: { fontSize: 16, fontWeight: '800' },
  stateText: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  retry: { marginTop: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  retryText: { fontWeight: '800', fontSize: 13 },
  count: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  card: { borderRadius: 22, borderWidth: 1, padding: 12, marginBottom: 12, flexDirection: 'row', gap: 12 },
  boatImage: { width: 92, minHeight: 160, borderRadius: 16 },
  boatImageEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  boatName: { flex: 1, fontSize: 15, fontWeight: '800' },
  available: { color: GREEN, fontSize: 11, fontWeight: '700' },
  onTrip: { color: ORANGE, fontSize: 11, fontWeight: '700' },
  boatCode: { fontSize: 12, marginBottom: 8, marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  metaText: { fontSize: 11 },
  price: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  detailsBtn: {
    marginTop: 10,
    height: 40,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsText: { fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});
