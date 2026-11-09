import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLockup } from '@/components/brand-lockup';
import { NotificationBell } from '@/components/notification-bell';
import { OperatorTabs } from '@/components/operator-tabs';
import { PassengerTabs } from '@/components/passenger-tabs';
import { SideMenu } from '@/components/side-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { fetchCurrentUser, logoutAccount } from '@/lib/auth';
import { organizationAllowsOperations } from '@/lib/organization-access';
import { resolveMediaUrl } from '@/lib/config';
import { isOperator, roleLabel } from '@/lib/roles';
import { useAppTheme } from '@/lib/theme';
import type { AuthUser } from '@/lib/types';

function displayValue(value?: string | number | null) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return 'Not set';
  }
  return String(value);
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: colors.iconBg }]}>
        <Ionicons name={icon} size={16} color={colors.blue} />
      </View>
      <Text style={[styles.infoLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.navy }]}>{value}</Text>
    </View>
  );
}

const PASSENGER_LINKS: {
  href: '/payment-history' | '/emergency' | '/help' | '/settings';
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  danger?: boolean;
}[] = [
  { href: '/payment-history', icon: 'receipt-outline', label: 'Payment History', hint: 'Downpayments, balance, and refunds' },
  { href: '/emergency', icon: 'medkit-outline', label: 'Emergency Hotlines', hint: 'Coast Guard, 911, and your barangay', danger: true },
  { href: '/help', icon: 'help-circle-outline', label: 'Help & Policies', hint: 'FAQ, cancellation policy, terms, and privacy' },
  { href: '/settings', icon: 'lock-closed-outline', label: 'Change Password', hint: 'Update your password in Settings' },
];

const OPERATOR_LINKS: {
  href: '/operator-transactions' | '/gcash-settings' | '/operator-commissions' | '/emergency' | '/help' | '/settings';
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  danger?: boolean;
}[] = [
  { href: '/operator-transactions', icon: 'wallet-outline', label: 'Earnings & Payouts', hint: 'Passenger payments, your share, and payout status' },
  { href: '/gcash-settings', icon: 'card-outline', label: 'Payout Account (GCash)', hint: 'Where the barangay sends your share (optional)' },
  { href: '/operator-commissions', icon: 'receipt-outline', label: 'Barangay Commission', hint: 'Older rentals paid directly to you' },
  { href: '/emergency', icon: 'medkit-outline', label: 'Emergency Hotlines', hint: 'Coast Guard, 911, and your barangay', danger: true },
  { href: '/help', icon: 'help-circle-outline', label: 'Help & Policies', hint: 'Cancellation policy, terms, and privacy' },
  { href: '/settings', icon: 'lock-closed-outline', label: 'Change Password', hint: 'Update your password in Settings' },
];

function boatLabel(user: AuthUser | null) {
  const boatName = user?.operator?.boat_name?.trim();
  const boatCode = user?.operator?.boat_code?.trim();
  if (boatName && boatCode) {
    return `${boatName} (${boatCode})`;
  }
  return boatName || boatCode || 'Not linked yet';
}

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const operator = isOperator(user);
  const operatorProfile = user?.operator;
  const photo = resolveMediaUrl(operatorProfile?.picture_url || user?.picture_url);

  useFocusEffect(
    useCallback(() => {
      fetchCurrentUser().then((next) => {
        setUser(next);
        if (next && isOperator(next) && !organizationAllowsOperations(next)) {
          router.replace('/organization-inactive');
        }
      });
    }, [router]),
  );

  async function handleLogout() {
    await logoutAccount();
    router.replace('/login');
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Pressable hitSlop={8} style={styles.headerBtn} onPress={() => setMenuOpen(true)}>
                <Ionicons name="menu-outline" size={26} color={colors.navy} />
              </Pressable>
              <BrandLockup color={colors.blue} />
            </View>

            <View style={styles.headerRight}>
              <ThemeToggle />
              <NotificationBell />
              <View style={[styles.avatar, { backgroundColor: colors.blue }]}>
                <Ionicons name="person" size={16} color="#FFFFFF" />
              </View>
            </View>
          </View>

          <Text style={[styles.title, { color: colors.navy }]}>Profile</Text>

          {!operator ? (
            <>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.profileTop}>
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.profileAvatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.profileAvatar, { backgroundColor: colors.blue }]}>
                      <Ionicons name="person" size={32} color="#FFFFFF" />
                    </View>
                  )}
                  <View style={styles.profileCopy}>
                    <Text style={[styles.passengerName, { color: colors.navy }]}>
                      {user?.name ?? 'SafeSakay User'}
                    </Text>
                    <Text style={[styles.profileMeta, { color: colors.muted }]}>
                      {user?.username ? `@${user.username}` : 'No username'}
                    </Text>
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/edit-profile')}
                  style={({ pressed }) => [styles.editBtn, { backgroundColor: colors.blue }, pressed && styles.pressed]}>
                  <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.editText}>Edit Profile</Text>
                </Pressable>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <InfoRow icon="mail-outline" label="Email" value={user?.email ?? 'Not signed in'} />
                <InfoRow icon="call-outline" label="Mobile No." value={displayValue(user?.contact_number)} />
                <InfoRow icon="location-outline" label="Address" value={displayValue(user?.address)} />
                <InfoRow
                  icon="book-outline"
                  label="Service Area"
                  value={user?.organization?.name ?? 'Select on Home'}
                />
                <InfoRow
                  icon="people-outline"
                  label="Emergency"
                  value={
                    user?.emergency_contact_name
                      ? `${user.emergency_contact_name}${user.emergency_contact_number ? ` · ${user.emergency_contact_number}` : ''}`
                      : 'Not set'
                  }
                />
                <InfoRow icon="person-outline" label="Role" value={roleLabel(user?.role)} />
              </View>

              {!user?.contact_number || !user?.emergency_contact_name ? (
                <Pressable
                  onPress={() => router.push('/edit-profile')}
                  style={[styles.notice, { backgroundColor: isDark ? '#3D2A1C' : '#FFF4EC' }]}>
                  <Ionicons name="alert-circle-outline" size={18} color="#F07A3A" />
                  <Text style={[styles.noticeText, { color: isDark ? '#F9C9A8' : '#9A4A16' }]}>
                    Add your mobile number and an emergency contact so the operator and barangay can reach you during your trip.
                  </Text>
                </Pressable>
              ) : null}

              {PASSENGER_LINKS.map((item) => (
                <Pressable
                  key={item.href}
                  onPress={() => router.push(item.href)}
                  style={({ pressed }) => [
                    styles.menuItem,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}>
                  <View style={[styles.menuIcon, { backgroundColor: item.danger ? '#FDECEC' : colors.iconBg }]}>
                    <Ionicons name={item.icon} size={18} color={item.danger ? '#E25C5C' : colors.blue} />
                  </View>
                  <View style={styles.menuCopy}>
                    <Text style={[styles.menuLabel, { color: colors.navy }]}>{item.label}</Text>
                    <Text style={[styles.menuHint, { color: colors.muted }]}>{item.hint}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </Pressable>
              ))}
            </>
          ) : null}

          {operator ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHead}>
                <Ionicons name="person-circle-outline" size={22} color={colors.blue} />
                <View style={styles.sectionCopy}>
                  <Text style={[styles.sectionTitle, { color: colors.navy }]}>Operator Information</Text>
                </View>
              </View>

              <View style={styles.operatorHero} pointerEvents="none">
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.profilePhoto} contentFit="cover" />
                ) : (
                  <View style={[styles.profilePhotoFallback, { backgroundColor: colors.blue }]}>
                    <Ionicons name="person" size={36} color="#FFFFFF" />
                  </View>
                )}
                <Text style={[styles.profileName, { color: colors.navy }]}>
                  {displayValue(operatorProfile?.full_name)}
                </Text>
                <Text style={[styles.profileRole, { color: colors.muted }]}>Boat Operator</Text>
                <View style={[styles.boatChip, { backgroundColor: isDark ? colors.iconBg : '#E8F1FF' }]}>
                  <Ionicons name="boat" size={12} color={colors.blue} />
                  <Text style={[styles.boatChipText, { color: colors.blue }]}>{boatLabel(user)}</Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/edit-profile')}
                style={({ pressed }) => [styles.editBtn, { backgroundColor: colors.blue, marginTop: 0, marginBottom: 16 }, pressed && styles.pressed]}>
                <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                <Text style={styles.editText}>Edit Contact & Photo</Text>
              </Pressable>

              <InfoRow icon="mail-outline" label="Email" value={user?.email ?? 'Not signed in'} />
              <InfoRow icon="location-outline" label="Service Area" value={user?.organization?.name ?? 'Not set'} />
              <InfoRow icon="person-outline" label="First Name" value={displayValue(operatorProfile?.first_name)} />
              <InfoRow icon="person-outline" label="Middle Name" value={displayValue(operatorProfile?.middle_name)} />
              <InfoRow icon="person-outline" label="Last Name" value={displayValue(operatorProfile?.last_name)} />
              <InfoRow icon="calendar-outline" label="Age" value={displayValue(operatorProfile?.age)} />
              <InfoRow icon="male-female-outline" label="Gender" value={displayValue(operatorProfile?.gender)} />
              <InfoRow icon="call-outline" label="Contact Number" value={displayValue(operatorProfile?.contact_number)} />
              <InfoRow icon="map-outline" label="Complete Address" value={displayValue(operatorProfile?.address)} />
              <InfoRow
                icon="briefcase-outline"
                label="Experience"
                value={
                  operatorProfile?.experience_years != null
                    ? `${operatorProfile.experience_years} ${operatorProfile.experience_years === 1 ? 'year' : 'years'}`
                    : 'Not set'
                }
              />
              <InfoRow
                icon="people-outline"
                label="Emergency Contact"
                value={displayValue(operatorProfile?.emergency_contact_name)}
              />
              <InfoRow
                icon="call-outline"
                label="Emergency Number"
                value={displayValue(operatorProfile?.emergency_contact_number)}
              />
            </View>
          ) : null}

          {operator
            ? OPERATOR_LINKS.map((item) => (
                <Pressable
                  key={item.href}
                  onPress={() => router.push(item.href)}
                  style={({ pressed }) => [
                    styles.menuItem,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}>
                  <View style={[styles.menuIcon, { backgroundColor: item.danger ? '#FDECEC' : colors.iconBg }]}>
                    <Ionicons name={item.icon} size={18} color={item.danger ? '#E25C5C' : colors.blue} />
                  </View>
                  <View style={styles.menuCopy}>
                    <Text style={[styles.menuLabel, { color: colors.navy }]}>{item.label}</Text>
                    <Text style={[styles.menuHint, { color: colors.muted }]}>{item.hint}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </Pressable>
              ))
            : null}

          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutBtn,
              { borderColor: colors.border, backgroundColor: colors.card },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="log-out-outline" size={18} color="#E25C5C" />
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
      {operator ? <OperatorTabs active="profile" /> : <PassengerTabs active="profile" />}
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
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
  content: {
    paddingHorizontal: 16,
    paddingBottom: 96,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    marginBottom: 18,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 16,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 16,
    fontSize: 14,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePhoto: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#D7E8FB',
  },
  profilePhotoFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 16,
  },
  sectionCopy: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  sectionHint: {
    marginTop: 2,
    fontSize: 12,
  },
  operatorHero: {
    alignItems: 'center',
    marginBottom: 18,
  },
  profileCopy: {
    flex: 1,
  },
  passengerName: {
    fontSize: 20,
    fontWeight: '800',
  },
  profileName: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  profileRole: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
  },
  profileMeta: {
    marginTop: 2,
    fontSize: 13,
  },
  boatChip: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  boatChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    width: 102,
    fontSize: 13,
    fontWeight: '600',
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  menuItem: {
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCopy: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  menuHint: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
  },
  editBtn: {
    marginTop: 14,
    height: 42,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  logoutBtn: {
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: {
    color: '#E25C5C',
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
});
