import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BoatPhotoCarousel } from '@/components/boat-photo-carousel';
import { fetchBooking } from '@/lib/bookings';
import { fetchBoatById } from '@/lib/boats';
import { resolveMediaUrl } from '@/lib/config';
import { useAppTheme } from '@/lib/theme';
import type { Boat, MobileBooking } from '@/lib/types';

const BLUE = '#1A5AD7';
const ICON_BG = '#E8F1FF';
const FALLBACK_BOAT =
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80';

function SpecItem({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.specItem}>
      <View style={[styles.iconBadge, { backgroundColor: colors.iconBg }]}>
        <Ionicons name={icon} size={16} color={colors.blue} />
      </View>
      <View style={styles.specCopy}>
        <Text style={[styles.specLabel, { color: colors.muted }]}>{label}</Text>
        <Text style={[styles.specValue, { color: colors.navy }]}>{value}</Text>
      </View>
    </View>
  );
}

export default function BoatInfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; bookingId?: string }>();
  const boatId = Number(params.id);
  const bookingId = Number(params.bookingId);
  const { colors, isDark } = useAppTheme();
  const { width } = useWindowDimensions();
  const carouselWidth = width - 32;
  const [boat, setBoat] = useState<Boat | null>(null);
  const [booking, setBooking] = useState<MobileBooking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    Promise.all([
      boatId ? fetchBoatById(boatId) : Promise.resolve(null),
      bookingId ? fetchBooking(bookingId).catch(() => null) : Promise.resolve(null),
    ])
      .then(([nextBoat, nextBooking]) => {
        if (!active) {
          return;
        }
        setBoat(nextBoat);
        setBooking(nextBooking);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [boatId, bookingId]);

  const photos = useMemo(() => {
    if (!boat) {
      return [FALLBACK_BOAT];
    }
    const urls = (boat.picture_urls?.length ? boat.picture_urls : [boat.picture_url])
      .map((url) => resolveMediaUrl(url))
      .filter((url): url is string => Boolean(url));
    return urls.length > 0 ? urls : [FALLBACK_BOAT];
  }, [boat]);

  const operator = booking?.operator;
  const operatorPhoto = resolveMediaUrl(operator?.picture_url);
  const phone = operator?.contact_number?.replace(/[^\d+]/g, '') ?? '';

  async function callOperator() {
    if (!phone) {
      Alert.alert('No contact number', 'This operator has no phone number on file yet.');
      return;
    }
    const url = `tel:${phone}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Cannot call', phone);
      return;
    }
    await Linking.openURL(url);
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: 40 }]}>
          <Pressable
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={26} color={colors.navy} />
          </Pressable>

          <Text style={[styles.title, { color: colors.navy }]}>Boat Details</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Information about this boat and its operator.
          </Text>

          {loading ? (
            <ActivityIndicator color={BLUE} style={styles.loader} />
          ) : !boat ? (
            <Text style={[styles.empty, { color: colors.muted }]}>This boat could not be found.</Text>
          ) : (
            <>
              <Text style={[styles.boatName, { color: colors.navy }]}>{boat.name}</Text>
              <Text style={[styles.boatCode, { color: colors.muted }]}>{boat.code}</Text>
              <BoatPhotoCarousel urls={photos} width={carouselWidth} />

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <SpecItem icon="boat-outline" label="Boat Type" value={boat.type || 'Pump Boat'} />
                <SpecItem icon="people-outline" label="Capacity" value={`${boat.capacity} passengers`} />
                <SpecItem icon="location-outline" label="Home Port" value={boat.home_port || 'Lakandula'} />
                <SpecItem icon="checkmark-circle-outline" label="License No." value={boat.license_no || '—'} />
                <SpecItem
                  icon="calendar-outline"
                  label="Registered Date"
                  value={boat.registration_date_label || '—'}
                />
              </View>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHead}>
                  <View style={[styles.iconBadge, { backgroundColor: isDark ? colors.iconBg : ICON_BG }]}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={colors.blue} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: colors.navy }]}>Safety Equipment</Text>
                </View>
                {(boat.safety_equipment?.length ?? 0) > 0 ? (
                  boat.safety_equipment?.map((item) => (
                    <View key={item} style={styles.safetyItem}>
                      <View style={styles.safetyCheck}>
                        <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.safetyText, { color: colors.navy }]}>{item}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.empty, { color: colors.muted }]}>
                    {boat.life_jacket_quantity
                      ? `Life jackets (${boat.life_jacket_quantity})`
                      : 'No safety equipment recorded.'}
                  </Text>
                )}
              </View>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHead}>
                  <View style={[styles.iconBadge, { backgroundColor: isDark ? colors.iconBg : ICON_BG }]}>
                    <Ionicons name="person-outline" size={16} color={colors.blue} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: colors.navy }]}>Boat Operator</Text>
                </View>
                {operator ? (
                  <>
                    <View style={styles.operatorTop}>
                      {operatorPhoto ? (
                        <Image source={{ uri: operatorPhoto }} style={styles.avatar} contentFit="cover" />
                      ) : (
                        <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.iconBg }]}>
                          <Ionicons name="person" size={28} color={colors.blue} />
                        </View>
                      )}
                      <View style={styles.operatorCopy}>
                        <Text style={[styles.operatorName, { color: colors.navy }]}>
                          {operator.full_name}
                        </Text>
                        <Text style={[styles.operatorRole, { color: colors.muted }]}>Boat Operator</Text>
                      </View>
                      <Pressable
                        onPress={() => void callOperator()}
                        style={({ pressed }) => [
                          styles.contactBtn,
                          { backgroundColor: colors.iconBg },
                          pressed && styles.pressed,
                        ]}>
                        <Ionicons name="call-outline" size={13} color={colors.blue} />
                        <Text style={styles.contactText}>Contact</Text>
                      </Pressable>
                    </View>
                    <View style={styles.metaRow}>
                      <Ionicons name="call-outline" size={14} color={colors.blue} />
                      <Text style={[styles.metaText, { color: colors.navy }]}>
                        {operator.contact_number || 'No contact number'}
                      </Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Ionicons name="location-outline" size={14} color={colors.blue} />
                      <Text style={[styles.metaText, { color: colors.navy }]}>
                        {operator.address || 'No address on file'}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={[styles.empty, { color: colors.muted }]}>
                    {boat.operator_name
                      ? `${boat.operator_name} is assigned to this boat.`
                      : 'Operator details appear after your rental is approved.'}
                  </Text>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginLeft: -8,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 14,
    fontSize: 13,
    lineHeight: 18,
  },
  loader: {
    marginTop: 28,
  },
  empty: {
    fontSize: 13,
    lineHeight: 18,
  },
  boatName: {
    fontSize: 22,
    fontWeight: '800',
  },
  boatCode: {
    marginTop: 2,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    marginTop: 12,
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  specItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    paddingRight: 8,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ICON_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specCopy: {
    flex: 1,
  },
  specLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  specValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '800',
  },
  sectionHead: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  safetyItem: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  safetyCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  operatorTop: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorCopy: {
    flex: 1,
  },
  operatorName: {
    fontSize: 16,
    fontWeight: '800',
  },
  operatorRole: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  contactText: {
    color: BLUE,
    fontSize: 11,
    fontWeight: '700',
  },
  metaRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  metaText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.82,
  },
});
