import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchBookings } from '@/lib/bookings';
import { attentionRequestCount } from '@/lib/operator';
import { useAppTheme } from '@/lib/theme';

export type OperatorTabKey = 'home' | 'requests' | 'transactions' | 'boats' | 'profile';

type Props = {
  active?: OperatorTabKey;
};

const TABS: {
  key: OperatorTabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  href: '/operator-home' | '/operator-requests' | '/operator-transactions' | '/operator-boats' | '/profile';
}[] = [
  {
    key: 'home',
    label: 'Home',
    icon: 'home-outline',
    activeIcon: 'home',
    href: '/operator-home',
  },
  {
    key: 'requests',
    label: 'Requests',
    icon: 'calendar-outline',
    activeIcon: 'calendar',
    href: '/operator-requests',
  },
  {
    key: 'transactions',
    label: 'Transactions',
    icon: 'receipt-outline',
    activeIcon: 'receipt',
    href: '/operator-transactions',
  },
  {
    key: 'boats',
    label: 'My Boats',
    icon: 'boat-outline',
    activeIcon: 'boat',
    href: '/operator-boats',
  },
  {
    key: 'profile',
    label: 'Profile',
    icon: 'person-outline',
    activeIcon: 'person',
    href: '/profile',
  },
];

export function OperatorTabs({ active }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useAppTheme();
  const [requestAlerts, setRequestAlerts] = useState(0);

  useFocusEffect(
    useCallback(() => {
      fetchBookings()
        .then((bookings) => setRequestAlerts(attentionRequestCount(bookings)))
        .catch(() => setRequestAlerts(0));
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
                tab.key === 'requests' && requestAlerts > 0
                  ? `${tab.label}, ${requestAlerts} need attention`
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
                {tab.key === 'requests' && requestAlerts > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{requestAlerts > 9 ? '9+' : requestAlerts}</Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={1} style={[styles.label, { color }]}>
                {tab.label}
              </Text>
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
