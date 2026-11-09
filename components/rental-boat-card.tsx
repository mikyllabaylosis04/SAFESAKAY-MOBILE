import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { resolveMediaUrl } from '@/lib/config';
import { useAppTheme } from '@/lib/theme';
import type { Boat } from '@/lib/types';

const ICON_BG = '#D7E8FB';
export const RENTAL_BOAT_CARD_WIDTH = 176;
const BOAT_GAP = 12;
export const RENTAL_BOAT_SNAP = RENTAL_BOAT_CARD_WIDTH + BOAT_GAP;

type Props = {
  boat: Boat;
  fallbackImage: string;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
};

export function RentalBoatCard({ boat, fallbackImage, onPress, onPressIn, onPressOut }: Props) {
  const { colors } = useAppTheme();
  const photo = resolveMediaUrl(boat.picture_url) || fallbackImage;
  const open = boat.status === 'available' || boat.status === 'on_duty';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View details for ${boat.name}`}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.boatCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: photo }} style={styles.boatImage} contentFit="cover" />
        <View style={[styles.statusBadge, open ? styles.statusOpen : styles.statusBusy]}>
          <Text style={[styles.statusText, open ? styles.statusOpenText : styles.statusBusyText]}>
            {boat.status_label}
          </Text>
        </View>
      </View>

      <View style={styles.boatInfo}>
        <Text style={[styles.boatName, { color: colors.navy }]} numberOfLines={1}>
          {boat.name}
        </Text>
        <View style={styles.metaRow}>
          <Ionicons name="people-outline" size={13} color={colors.muted} />
          <Text style={[styles.boatMeta, { color: colors.muted }]}>{boat.capacity} passengers</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="shield-checkmark-outline" size={13} color={colors.muted} />
          <Text style={[styles.boatMeta, { color: colors.muted }]} numberOfLines={1}>
            {boat.life_jacket_quantity
              ? `${boat.life_jacket_quantity} life jackets`
              : boat.code}
          </Text>
        </View>

        <View style={[styles.detailsBtn, { backgroundColor: colors.card, borderColor: colors.blue }]}>
          <Text style={[styles.detailsText, { color: colors.blue }]}>View Details</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boatCard: {
    width: 176,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
  },
  imageWrap: {
    position: 'relative',
  },
  boatImage: {
    width: '100%',
    height: 108,
    backgroundColor: ICON_BG,
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusOpen: {
    backgroundColor: 'rgba(31, 169, 113, 0.92)',
  },
  statusBusy: {
    backgroundColor: 'rgba(227, 155, 43, 0.94)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusOpenText: {
    color: '#FFFFFF',
  },
  statusBusyText: {
    color: '#FFFFFF',
  },
  boatInfo: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  boatName: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  boatMeta: {
    flex: 1,
    fontSize: 12,
  },
  detailsBtn: {
    marginTop: 12,
    height: 42,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

type LiftProps = {
  boat: Boat;
  fallbackImage: string;
  onPressBoat: (boat: Boat) => void;
};

function HoverLiftBoatCard({ boat, fallbackImage, onPressBoat }: LiftProps) {
  const hover = useRef(new Animated.Value(0)).current;
  const translateY = hover.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });
  const scale = hover.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.03],
  });

  const liftIn = () => {
    Animated.spring(hover, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }).start();
  };
  const liftOut = () => {
    Animated.spring(hover, { toValue: 0, friction: 7, tension: 80, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={[carouselStyles.item, { transform: [{ translateY }, { scale }] }]}>
      <RentalBoatCard
        boat={boat}
        fallbackImage={fallbackImage}
        onPress={() => onPressBoat(boat)}
        onPressIn={liftIn}
        onPressOut={liftOut}
      />
    </Animated.View>
  );
}

type CarouselProps = {
  boats: Boat[];
  fallbackImage: string;
  onPressBoat: (boat: Boat) => void;
};

export function BoatWaveCarousel({ boats, fallbackImage, onPressBoat }: CarouselProps) {
  return (
    <Animated.ScrollView
      horizontal
      nestedScrollEnabled
      directionalLockEnabled
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={RENTAL_BOAT_SNAP}
      snapToAlignment="start"
      disableIntervalMomentum
      bounces
      alwaysBounceHorizontal
      contentContainerStyle={carouselStyles.row}>
      {boats.map((boat) => (
        <HoverLiftBoatCard
          key={boat.id}
          boat={boat}
          fallbackImage={fallbackImage}
          onPressBoat={onPressBoat}
        />
      ))}
    </Animated.ScrollView>
  );
}

const carouselStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 12,
    paddingBottom: 4,
    paddingRight: 8,
  },
  item: {
    marginRight: BOAT_GAP,
  },
});
