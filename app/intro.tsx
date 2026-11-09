import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthWaves } from '@/components/auth-waves';
import { BrandLockup } from '@/components/brand-lockup';
import { useAppTheme } from '@/lib/theme';

export default function IntroScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/loading');
    }, 2200);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={[styles.screen, { backgroundColor: isDark ? colors.page : '#F7FBFE' }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthWaves height={180} />

      <SafeAreaView style={styles.safe}>
        <View style={styles.brand}>
          <BrandLockup variant="hero" />
          <Text style={[styles.title, { color: colors.blue }]}>SafeSakay</Text>
          <Text style={[styles.slogan, { color: colors.muted }]}>Safer Boats, Safe Trips, SafeSakay</Text>
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
    paddingHorizontal: 28,
  },
  brand: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  title: {
    marginTop: 12,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  slogan: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
