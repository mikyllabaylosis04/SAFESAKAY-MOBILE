import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/config';
import { fetchRescheduleBoats } from '@/lib/no-show';
import type { RescheduleBoatOption } from '@/lib/types';
import { useAppTheme } from '@/lib/theme';

const BLUE = '#1A5AD7';

export default function RescheduleBoatsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ bookingId?: string; date?: string; time?: string }>();
  const bookingId = Number(params.bookingId);
  const sameDay = Boolean(params.date);
  const [boats, setBoats] = useState<RescheduleBoatOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }
    void fetchRescheduleBoats(bookingId, params.date || undefined)
      .then(setBoats)
      .catch((err) => {
        Alert.alert('Unavailable', err instanceof ApiError ? err.firstError() : 'Could not load boats.');
      })
      .finally(() => setLoading(false));
  }, [bookingId, params.date]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.page }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.navy} />
        </Pressable>
        <Text style={[styles.title, { color: colors.navy }]}>{sameDay ? 'Another boat today' : 'Pick a boat'}</Text>
      </View>
      <Text style={[styles.sub, { color: colors.muted }]}>
        {sameDay
          ? 'Your payment stays. These boats are free on the same day. Choose one, then confirm the time.'
          : 'Down payment stays. Choose a boat, then a new date.'}
      </Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={BLUE} />
      ) : (
        <FlatList
          data={boats}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: colors.muted, marginTop: 24 }}>
              {sameDay ? 'No other boat is free that day. Go back to pick a new date or a refund.' : 'No matching boats are available right now.'}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/no-show/reschedule-schedule',
                  params: {
                    bookingId: String(bookingId),
                    boatId: String(item.id),
                    boatName: item.name,
                    boatCode: item.code,
                    boatPicture: item.picture_url ?? '',
                    priceLabel: item.rental_price_label,
                    capacity: String(item.capacity),
                    date: params.date ?? '',
                    time: params.time ?? '',
                  },
                })
              }
              style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Image
                source={{ uri: resolveMediaUrl(item.picture_url) }}
                style={styles.photo}
                contentFit="cover"
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.name, { color: colors.navy }]}>
                  {item.name} ({item.code})
                </Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>{item.capacity} passengers</Text>
                <Text style={{ color: BLUE, fontWeight: '700' }}>{item.rental_price_label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={BLUE} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  sub: { paddingHorizontal: 16, marginBottom: 4 },
  card: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 14, padding: 10, alignItems: 'center' },
  photo: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#E8F1FF' },
  name: { fontWeight: '700', fontSize: 15 },
});
