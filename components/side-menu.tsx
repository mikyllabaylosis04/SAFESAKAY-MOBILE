
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLockup } from '@/components/brand-lockup';
import { getStoredUser, logoutAccount } from '@/lib/auth';
import { resolveMediaUrl } from '@/lib/config';
import { isOperator } from '@/lib/roles';
import { useAppTheme } from '@/lib/theme';
import type { AuthUser } from '@/lib/types';

const BLUE = '#1A5AD7';
const NAVY = '#1B2744';
const TEXT = '#3D4660';
const RED = '#E25C5C';
const CARD = '#FFFFFF';
const PANEL_WIDTH = Math.min(Dimensions.get('window').width * 0.82, 340);

type SideMenuProps = {
  visible: boolean;
  onClose: () => void;
};

type MenuHref =
  | '/homepage'
  | '/operator-home'
  | '/boats'
  | '/booking'
  | '/payment-history'
  | '/emergency'
  | '/help'
  | '/operator-requests'
  | '/operator-boats'
  | '/operator-transactions'
  | '/operator-commissions'
  | '/gcash-settings'
  | '/notification'
  | '/settings'
  | '/about'
  | '/profile';

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  label: string;
  href: MenuHref;
  danger?: boolean;
};

const PASSENGER_ITEMS: MenuItem[] = [
  { icon: 'home-outline', activeIcon: 'home', label: 'Home', href: '/homepage' },
  { icon: 'boat-outline', activeIcon: 'boat', label: 'Rent a Boat', href: '/boats' },
  { icon: 'calendar-outline', activeIcon: 'calendar', label: 'My Rentals', href: '/booking' },
  { icon: 'receipt-outline', activeIcon: 'receipt', label: 'Payment History', href: '/payment-history' },
  { icon: 'notifications-outline', activeIcon: 'notifications', label: 'Notifications', href: '/notification' },
  { icon: 'medkit-outline', activeIcon: 'medkit', label: 'Emergency Hotlines', href: '/emergency' },
  { icon: 'help-circle-outline', activeIcon: 'help-circle', label: 'Help & Policies', href: '/help' },
  { icon: 'settings-outline', activeIcon: 'settings', label: 'Settings', href: '/settings' },
  { icon: 'information-circle-outline', activeIcon: 'information-circle', label: 'About SafeSakay', href: '/about' },
];

const OPERATOR_ITEMS: MenuItem[] = [
  { icon: 'home-outline', activeIcon: 'home', label: 'Home', href: '/operator-home' },
  { icon: 'calendar-outline', activeIcon: 'calendar', label: 'Requests', href: '/operator-requests' },
  { icon: 'boat-outline', activeIcon: 'boat', label: 'My Boats', href: '/operator-boats' },
  { icon: 'wallet-outline', activeIcon: 'wallet', label: 'Earnings & Payouts', href: '/operator-transactions' },
  { icon: 'card-outline', activeIcon: 'card', label: 'Payout Account (GCash)', href: '/gcash-settings' },
  { icon: 'receipt-outline', activeIcon: 'receipt', label: 'Barangay Commission', href: '/operator-commissions' },
  { icon: 'notifications-outline', activeIcon: 'notifications', label: 'Notifications', href: '/notification' },
  { icon: 'medkit-outline', activeIcon: 'medkit', label: 'Emergency Hotlines', href: '/emergency' },
  { icon: 'help-circle-outline', activeIcon: 'help-circle', label: 'Help & Policies', href: '/help' },
  { icon: 'settings-outline', activeIcon: 'settings', label: 'Settings', href: '/settings' },
  { icon: 'information-circle-outline', activeIcon: 'information-circle', label: 'About SafeSakay', href: '/about' },
];

export function SideMenu({ visible, onClose }: SideMenuProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { colors, isDark } = useAppTheme();
  const [shown, setShown] = useState(visible);
  const [user, setUser] = useState<AuthUser | null>(null);
  const slide = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const operator = isOperator(user);
  const items = operator ? OPERATOR_ITEMS : PASSENGER_ITEMS;
  const photo = resolveMediaUrl(user?.operator?.picture_url || user?.picture_url);
  const labelColor = isDark ? colors.navy : NAVY;
  const infoColor = isDark ? '#D5DCE8' : TEXT;

  useEffect(() => {
    if (visible) {
      getStoredUser().then(setUser);
      setShown(true);

      Animated.parallel([
        Animated.timing(slide, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      return;
    }

    Animated.parallel([
      Animated.timing(slide, {
        toValue: -PANEL_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setShown(false);
    });
  }, [visible, fade, slide]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),

        onPanResponderMove: (_event, gesture) => {
          slide.setValue(Math.min(0, gesture.dx));
          fade.setValue(Math.max(0.2, 1 + gesture.dx / PANEL_WIDTH));
        },

        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx < -72 || gesture.vx < -0.55) {
            onClose();
            return;
          }

          Animated.parallel([
            Animated.spring(slide, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 0,
              speed: 18,
            }),
            Animated.timing(fade, {
              toValue: 1,
              duration: 160,
              useNativeDriver: true,
            }),
          ]).start();
        },
      }),
    [fade, onClose, slide],
  );

  const go = (href: MenuHref) => {
    onClose();
    router.push(href);
  };

  const handleLogout = async () => {
    await logoutAccount();
    onClose();
    router.replace('/login');
  };

  return (
    <Modal
      visible={shown}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View
          style={[
            styles.overlay,
            { opacity: fade },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
          />
        </Animated.View>

        <Animated.View
          {...pan.panHandlers}
          style={[
            styles.panel,
            {
              backgroundColor: colors.card,
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + 12,
              transform: [{ translateX: slide }],
            },
          ]}
        >
          <View style={styles.brandHead}>
            <BrandLockup
              variant="menu"
              color={colors.blue}
              tagline="Safe Boats, Safe Trips, SafeSakay."
              taglineColor={infoColor}
            />

            <Pressable
              hitSlop={10}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Ionicons
                name="close"
                size={22}
                color={labelColor}
              />
            </Pressable>
          </View>

          <View
            style={[
              styles.profileCard,
              {
                backgroundColor: isDark
                  ? colors.iconBg
                  : '#EAF2FF',
              },
            ]}
          >
            {photo ? (
              <Image
                source={{ uri: photo }}
                style={styles.profileAvatar}
                contentFit="cover"
              />
            ) : (
              <View style={styles.profileAvatarFallback}>
                <Ionicons
                  name="person"
                  size={28}
                  color="#FFFFFF"
                />
              </View>
            )}

            <View style={styles.profileCopy}>
              <Text
                style={[
                  styles.profileName,
                  { color: colors.navy },
                ]}
                numberOfLines={1}
              >
                {user?.name ?? 'SafeSakay User'}
              </Text>

              <Text
                style={[
                  styles.profileEmail,
                  { color: infoColor },
                ]}
                numberOfLines={1}
              >
                {user?.email ?? 'Sign in to view your profile'}
              </Text>

              <Pressable
                hitSlop={8}
                style={styles.viewProfile}
                onPress={() => go('/profile')}
              >
                <Text style={styles.viewProfileText}>
                  View Profile
                </Text>

                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={BLUE}
                />
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={styles.menuList}
            contentContainerStyle={styles.menuListContent}
            showsVerticalScrollIndicator={false}>
            {items.map((item) => {
              const active = pathname === item.href;

              return (
                <Pressable
                  key={item.label}
                  onPress={() => go(item.href)}
                  style={({ pressed }) => [
                    styles.menuRow,
                    active && {
                      backgroundColor: isDark
                        ? colors.iconBg
                        : '#EAF2FF',
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.menuLeft}>
                    <Ionicons
                      name={active ? item.activeIcon : item.icon}
                      size={20}
                      color={active ? BLUE : labelColor}
                    />

                    <Text
                      style={[
                        styles.menuLabel,
                        {
                          color: active
                            ? BLUE
                            : labelColor,
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={active ? BLUE : labelColor}
                  />
                </Pressable>
              );
            })}

            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.menuRow,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.menuLeft}>
                <Ionicons
                  name="log-out-outline"
                  size={20}
                  color={RED}
                />

                <Text
                  style={[
                    styles.menuLabel,
                    { color: RED },
                  ]}
                >
                  Logout
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={16}
                color={RED}
              />
            </Pressable>
          </ScrollView>

          <View style={styles.footer}>
            <Text
              style={[
                styles.footerText,
                { color: infoColor },
              ]}
            >
              Version 1.0.0
            </Text>

            <Text
              style={[
                styles.footerText,
                { color: infoColor },
              ]}
            >
              © 2026 SafeSakay. All rights reserved.
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(27, 39, 68, 0.42)',
  },

  panel: {
    width: PANEL_WIDTH,
    height: '100%',
    backgroundColor: CARD,
    paddingHorizontal: 18,
    shadowColor: '#1B2744',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 8, height: 0 },
    elevation: 16,
  },

  brandHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 18,
  },

  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EAF2FF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 18,
  },

  profileAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: BLUE,
  },

  profileAvatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileCopy: {
    flex: 1,
    minWidth: 0,
  },

  profileName: {
    color: NAVY,
    fontSize: 16,
    fontWeight: '800',
  },

  profileEmail: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '500',
  },

  viewProfile: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  viewProfileText: {
    color: BLUE,
    fontSize: 13,
    fontWeight: '700',
  },

  menuList: {
    flex: 1,
  },

  menuListContent: {
    paddingBottom: 12,
  },

  menuRow: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  menuLabel: {
    fontSize: 15,
    fontWeight: '700',
  },

  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D7DEEA',
    paddingTop: 14,
    alignItems: 'center',
    gap: 2,
  },

  footerText: {
    fontSize: 11,
    fontWeight: '500',
  },

  pressed: {
    opacity: 0.75,
  },
});
