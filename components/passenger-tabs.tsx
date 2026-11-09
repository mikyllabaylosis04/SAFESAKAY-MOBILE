import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchBookings, passengerRentalAlertCount } from '@/lib/bookings';
import { useAppTheme } from '@/lib/theme';

export type PassengerTabKey = 'home' | 'boats' | 'booking' | 'profile';

type Props = {
  active?: PassengerTabKey;
};

const TABS: {
  key: PassengerTabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  href: '/homepage' | '/boats' | '/booking' | '/profile';
}[] = [
  {
    key: 'home',
    label: 'Home',
    icon: 'home-outline',
    activeIcon: 'home',
    href: '/homepage',
  },
  {
    key: 'boats',
    label: 'Rent a Boat',
    icon: 'boat-outline',
    activeIcon: 'boat',
    href: '/boats',
  },
  {
    key: 'booking',
    label: 'My Rentals',
    icon: 'calendar-outline',
    activeIcon: 'calendar',
    href: '/booking',
  },
  {
    key: 'profile',
    label: 'Profile',
    icon: 'person-outline',
    activeIcon: 'person',
    href: '/profile',
  },
];

export function PassengerTabs({ active }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useAppTheme();
  const [rentalAlerts, setRentalAlerts] = useState(0);

  useFocusEffect(
    useCallback(() => {
      fetchBookings()
        .then((bookings) => setRentalAlerts(passengerRentalAlertCount(bookings)))
        .catch(() => setRentalAlerts(0));
    }, []),
  );

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.tabBar,
          paddingBottom: insets.bottom,
        },
      ]}>
      <View style={styles.bar}>
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          const color = isActive ? colors.blue : colors.muted;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityLabel={
                tab.key === 'booking' && rentalAlerts > 0
                  ? `${tab.label}, ${rentalAlerts} updates`
                  : tab.label
              }
              accessibilityState={{ selected: isActive }}
              style={styles.item}
              onPress={() => {
                if (isActive) {
                  return;
                }
                if (tab.key === 'home' || tab.key === 'profile') {
                  router.replace(tab.href);
                  return;
                }
                router.push(tab.href);
              }}>
              <View>
                <Ionicons name={isActive ? tab.activeIcon : tab.icon} size={22} color={color} />
                {tab.key === 'booking' && rentalAlerts > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{rentalAlerts > 9 ? '9+' : rentalAlerts}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.label, { color }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: '#1B2744',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  bar: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    paddingTop: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: '#E25C5C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
