import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthWaves } from '@/components/auth-waves';
import { BrandLockup } from '@/components/brand-lockup';
import { fetchCurrentUser, getStoredUser } from '@/lib/auth';
import { homeHrefForUser } from '@/lib/roles';
import { getToken } from '@/lib/session';
import { useAppTheme } from '@/lib/theme';

export default function LoadingScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  useEffect(() => {
    let cancelled = false;

    async function proceed() {
      const started = Date.now();
      const token = await getToken();
      const stored = await getStoredUser();
      const user = token ? ((await fetchCurrentUser()) ?? stored) : stored;
      const wait = Math.max(0, 900 - (Date.now() - started));

      await new Promise((resolve) => setTimeout(resolve, wait));

      if (cancelled) {
        return;
      }

      if (token && user) {
        router.replace(homeHrefForUser(user));
        return;
      }

      router.replace('/login');
    }

    void proceed();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={[styles.screen, { backgroundColor: isDark ? colors.page : '#F7FBFE' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthWaves />

      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>
          <BrandLockup variant="about" />
          <ActivityIndicator color={colors.blue} style={styles.spinner} />
          <Text style={[styles.copy, { color: colors.muted }]}>Loading...</Text>
        </View>
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
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  spinner: {
    marginTop: 22,
  },
  copy: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
  },
});
