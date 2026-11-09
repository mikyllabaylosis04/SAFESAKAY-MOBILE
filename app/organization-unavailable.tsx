import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLockup } from '@/components/brand-lockup';
import { ServiceAreaPicker } from '@/components/service-area-picker';
import { fetchCurrentUser, getStoredUser, logoutAccount } from '@/lib/auth';
import {
  organizationAllowsOperations,
  organizationDisplayName,
  organizationStatusLabel,
} from '@/lib/organization-access';
import { useAppTheme } from '@/lib/theme';
import type { AuthUser } from '@/lib/types';

export default function OrganizationUnavailableScreen() {
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
          router.replace('/homepage');
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
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <BrandLockup variant="compact" />
          <View style={[styles.iconWrap, { backgroundColor: isDark ? colors.iconBg : '#FFF4E5' }]}>
            <Ionicons name="boat" size={42} color="#C05621" />
            <View style={styles.warnBadge}>
              <Ionicons name="warning" size={16} color="#FFFFFF" />
            </View>
          </View>
          <Text style={[styles.title, { color: colors.navy }]}>Boat Rental Services Unavailable</Text>
          <Text style={[styles.copy, { color: colors.muted }]}>
            {orgName} is no longer active on SafeSakay. Boat rentals and trip services are currently
            unavailable. Thank you for using SafeSakay.
          </Text>
          <View style={[styles.badge, { backgroundColor: isDark ? '#3A2430' : '#FDECEC' }]}>
            <Text style={styles.badgeText}>Organization {status}</Text>
          </View>
          <View style={styles.picker}>
            <ServiceAreaPicker
              onChanged={(next) => {
                setUser(next);
                if (organizationAllowsOperations(next)) {
                  router.replace('/homepage');
                }
              }}
            />
          </View>
          <Pressable
            onPress={() => router.replace('/homepage')}
            style={({ pressed }) => [
              styles.back,
              { borderColor: colors.blue, backgroundColor: colors.card },
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.backText, { color: colors.blue }]}>Back</Text>
          </Pressable>
          <Pressable
            onPress={() => void handleLogout()}
            style={({ pressed }) => [styles.logout, pressed && styles.pressed]}>
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    alignItems: 'center',
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    marginBottom: 22,
  },
  warnBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#C05621',
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
    marginBottom: 18,
  },
  badgeText: {
    color: '#C53030',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  picker: { width: '100%' },
  back: {
    marginTop: 8,
    minHeight: 52,
    width: '100%',
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 16, fontWeight: '800' },
  logout: {
    marginTop: 12,
    minHeight: 52,
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#1A5AD7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.88 },
});
