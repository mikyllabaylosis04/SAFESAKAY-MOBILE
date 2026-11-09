import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLockup } from '@/components/brand-lockup';
import { fetchCurrentUser, getStoredUser, logoutAccount } from '@/lib/auth';
import {
  organizationAllowsOperations,
  organizationDisplayName,
  organizationStatusLabel,
} from '@/lib/organization-access';
import { useAppTheme } from '@/lib/theme';
import type { AuthUser } from '@/lib/types';

export default function OrganizationInactiveScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [user, setUser] = useState<AuthUser | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        const latest = (await fetchCurrentUser()) ?? (await getStoredUser());
        if (!active) {
          return;
        }

        if (!latest) {
          router.replace('/login');
          return;
        }

        if (organizationAllowsOperations(latest)) {
          router.replace('/operator-home');
          return;
        }

        setUser(latest);
      })();

      return () => {
        active = false;
      };
    }, [router]),
  );

  async function handleLogout() {
    await logoutAccount();
    router.replace('/login');
  }

  const orgName = organizationDisplayName(user);
  const status = organizationStatusLabel(user);

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.brand}>
          <BrandLockup variant="compact" />
        </View>
        <View style={styles.body}>
          <View style={[styles.iconWrap, { backgroundColor: isDark ? colors.iconBg : '#E8F1FF' }]}>
            <Ionicons name="business" size={42} color="#1A5AD7" />
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
            </View>
          </View>
          <Text style={[styles.title, { color: colors.navy }]}>Organization No Longer Active</Text>
          <Text style={[styles.copy, { color: colors.muted }]}>
            {orgName} is no longer active on SafeSakay. Boat operations and rental services are currently
            unavailable. Please contact your Barangay Administrator for more information.
          </Text>
          <View style={[styles.badge, { backgroundColor: isDark ? '#3A2430' : '#FDECEC' }]}>
            <Text style={styles.badgeText}>{status}</Text>
          </View>
          <Pressable
            onPress={() => void handleLogout()}
            style={({ pressed }) => [styles.logout, pressed && styles.pressed]}>
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 24 },
  brand: { paddingTop: 8, alignItems: 'center' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 48 },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  lockBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1B2744',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  copy: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 18,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 28,
  },
  badgeText: {
    color: '#C53030',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  logout: {
    minHeight: 52,
    minWidth: 220,
    borderRadius: 16,
    backgroundColor: '#1A5AD7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: { opacity: 0.88 },
});
