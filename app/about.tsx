import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLockup } from '@/components/brand-lockup';
import { OperatorTabs } from '@/components/operator-tabs';
import { PassengerTabs } from '@/components/passenger-tabs';
import { getStoredUser } from '@/lib/auth';
import { isOperator } from '@/lib/roles';
import { useAppTheme } from '@/lib/theme';
import type { AuthUser } from '@/lib/types';

const OFFERS = [
  {
    icon: 'boat-outline' as const,
    title: 'Verified Boats & Operators',
    text: 'All boats and operators are verified to ensure your safety and peace of mind.',
  },
  {
    icon: 'calendar-outline' as const,
    title: 'Easy Rental',
    text: 'Book your trip in just a few taps anytime, anywhere.',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Safety First',
    text: 'We prioritize safety by promoting standard equipment and reliable operators.',
  },
  {
    icon: 'notifications-outline' as const,
    title: 'Real-Time Updates',
    text: 'Get important updates about your rental and trip status.',
  },
];

export default function AboutScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [user, setUser] = useState<AuthUser | null>(null);
  const operator = isOperator(user);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  useFocusEffect(
    useCallback(() => {
      getStoredUser().then(setUser);
    }, []),
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={24} color={colors.navy} />
          </Pressable>
          <Text style={[styles.topTitle, { color: colors.navy }]}>About SafeSakay</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <BrandLockup variant="about" />
            <Text style={[styles.brandName, { color: colors.blue }]}>SAFESAKAY</Text>
            <Text style={[styles.tagline, { color: colors.muted }]}>
              Safe Boats, Safe Trips, SafeSakay
            </Text>
            <Text style={[styles.intro, { color: colors.muted }]}>
              SafeSakay is a smart boat rental and booking system designed to make water travel
              safer, easier, and more reliable for everyone.
            </Text>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
            <View style={[styles.iconBadge, { backgroundColor: colors.iconBg }]}>
              <Ionicons name="locate-outline" size={18} color={colors.blue} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={[styles.cardTitle, { color: colors.navy }]}>Our Mission</Text>
              <Text style={[styles.cardText, { color: colors.muted }]}>
                To promote safe and efficient sea travel by connecting passengers with trusted boat
                operators through a secure and easy-to-use booking platform.
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
            <View style={[styles.iconBadge, { backgroundColor: colors.iconBg }]}>
              <Ionicons name="eye-outline" size={18} color={colors.blue} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={[styles.cardTitle, { color: colors.navy }]}>Our Vision</Text>
              <Text style={[styles.cardText, { color: colors.muted }]}>
                To be the leading digital platform for boat rentals in the Philippines, ensuring
                safety, trust, and convenience for all.
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.block,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
            <Text style={[styles.blockHeading, { color: colors.navy }]}>What We Offer</Text>
            {OFFERS.map((item, index) => (
              <View
                key={item.title}
                style={[styles.offerRow, index === OFFERS.length - 1 && styles.offerRowLast]}>
                <View style={[styles.iconBadge, { backgroundColor: colors.iconBg }]}>
                  <Ionicons name={item.icon} size={18} color={colors.blue} />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={[styles.offerTitle, { color: colors.navy }]}>{item.title}</Text>
                  <Text style={[styles.cardText, { color: colors.muted }]}>{item.text}</Text>
                </View>
              </View>
            ))}
          </View>

          <View
            style={[
              styles.block,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
            <View style={styles.infoHeader}>
              <View style={[styles.iconBadge, { backgroundColor: colors.iconBg }]}>
                <Ionicons name="information-circle-outline" size={18} color={colors.blue} />
              </View>
              <Text style={[styles.blockHeading, { color: colors.navy, marginBottom: 0 }]}>
                App Information
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>Version</Text>
              <Text style={[styles.infoValue, { color: colors.navy }]}>{version}</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <Text style={[styles.infoLabel, { color: colors.muted }]}>Developed by</Text>
              <Text style={[styles.infoValue, { color: colors.navy }]}>SafeSakay</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
      {operator ? <OperatorTabs active="profile" /> : <PassengerTabs active="profile" />}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 108,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 16,
  },
  brandName: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  tagline: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  intro: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardText: {
    fontSize: 12,
    lineHeight: 18,
  },
  block: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  blockHeading: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 14,
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  offerRowLast: {
    marginBottom: 0,
  },
  offerTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  infoRowLast: {
    marginBottom: 0,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
