import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLockup } from '@/components/brand-lockup';
import { LoadError } from '@/components/load-error';
import { NotificationBell } from '@/components/notification-bell';
import { OperatorTabs } from '@/components/operator-tabs';
import { PassengerTabs } from '@/components/passenger-tabs';
import { SideMenu } from '@/components/side-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { friendlyError } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/notifications';
import { isOperator } from '@/lib/roles';
import { useAppTheme } from '@/lib/theme';
import type { AuthUser, MobileNotice } from '@/lib/types';

const BLUE = '#1A5AD7';
const NAVY = '#1B2744';
const TEXT = '#3D4660';
const GREEN = '#1FA971';
const ORANGE = '#E39B2B';
const PURPLE = '#7B61FF';
const PAGE = '#F7F9FC';

type FilterKey = 'all' | 'unread' | 'bookings' | 'announcements';

const FILTERS: {
  key: FilterKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  colorDark: string;
  bg: string;
  bgDark: string;
}[] = [
  { key: 'all', label: 'All', icon: 'albums-outline', color: BLUE, colorDark: '#7EB0FF', bg: '#EEF4FF', bgDark: '#1B2C4D' },
  { key: 'unread', label: 'Unread', icon: 'mail-unread-outline', color: ORANGE, colorDark: '#FFB070', bg: '#FDE8DC', bgDark: '#3D2A1C' },
  { key: 'bookings', label: 'Rentals', icon: 'calendar-outline', color: GREEN, colorDark: '#4ED89A', bg: '#DFF6EA', bgDark: '#163528' },
  { key: 'announcements', label: 'Announcements', icon: 'megaphone-outline', color: PURPLE, colorDark: '#B9A8FF', bg: '#EEE8FF', bgDark: '#2C2448' },
];

function noticeStyle(notice: MobileNotice) {
  if (notice.event === 'approved') {
    return { icon: 'checkmark-circle' as const, color: GREEN };
  }
  if (notice.event === 'pending') {
    return { icon: 'time' as const, color: ORANGE };
  }
  if (notice.event === 'cancelled') {
    return { icon: 'close-circle' as const, color: '#E25C5C' };
  }
  if (notice.event === 'completed') {
    return { icon: 'checkmark-done-circle' as const, color: GREEN };
  }
  if (notice.event === 'operator_no_show_reschedule_needs_confirmation') {
    return { icon: 'calendar' as const, color: PURPLE };
  }
  if (notice.event === 'passenger_no_show' || notice.event === 'operator_no_show_reported') {
    return { icon: 'alert-circle' as const, color: '#E25C5C' };
  }
  if (notice.kind === 'announcement') {
    return { icon: 'megaphone' as const, color: PURPLE };
  }
  if (notice.kind === 'emergency') {
    return { icon: 'warning' as const, color: '#DC2626' };
  }
  if (notice.kind === 'system') {
    return { icon: 'information-circle' as const, color: BLUE };
  }
  return { icon: 'calendar' as const, color: BLUE };
}

function noticeTag(notice: MobileNotice) {
  if (notice.kind === 'announcement') {
    return { label: 'Announcement', color: PURPLE, bg: '#EEE8FF' };
  }
  if (notice.kind === 'emergency') {
    return { label: 'Alert', color: '#DC2626', bg: '#FEE2E2' };
  }
  if (notice.kind === 'system') {
    return { label: 'Alert', color: ORANGE, bg: '#FFF4E5' };
  }
  if (notice.event === 'completed') {
    return { label: 'Trip', color: BLUE, bg: '#E8F1FF' };
  }
  return { label: 'Rental', color: GREEN, bg: '#E7F8EF' };
}

function noticeTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function matchesFilter(notice: MobileNotice, filter: FilterKey) {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'unread') {
    return notice.unread;
  }
  if (filter === 'bookings') {
    return notice.kind === 'booking';
  }
  return notice.kind === 'announcement';
}

function NoticeCard({
  notice,
  onPress,
}: {
  notice: MobileNotice;
  onPress: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  const look = noticeStyle(notice);
  const tag = noticeTag(notice);
  const unread = notice.unread;
  const bodyColor = isDark ? '#D5DCE8' : TEXT;
  const time = noticeTime(notice.created_at);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.noticeCard,
        {
          backgroundColor: unread ? (isDark ? '#1B2C4D' : '#EEF4FF') : colors.card,
          borderColor: unread ? (isDark ? colors.blue : '#BFD2F7') : colors.border,
        },
        unread && styles.noticeUnread,
        pressed && styles.pressed,
      ]}>
      {unread ? <View style={styles.unreadDot} /> : <View style={styles.unreadSpacer} />}
      <View style={[styles.noticeIconWrap, { backgroundColor: isDark ? colors.iconBg : tag.bg }]}>
        <Ionicons name={look.icon} size={16} color={look.color} />
      </View>
      <View style={styles.noticeCopy}>
        <Text style={[styles.noticeTitle, { color: colors.navy }]}>{notice.title}</Text>
        <Text style={[styles.noticeBody, { color: bodyColor }]}>{notice.body}</Text>
        <View style={[styles.tag, { backgroundColor: isDark ? colors.iconBg : tag.bg }]}>
          <Text style={[styles.tagText, { color: tag.color }]}>{tag.label}</Text>
        </View>
      </View>
      <View style={styles.noticeMeta}>
        {time ? <Text style={[styles.noticeTime, { color: bodyColor }]}>{time}</Text> : null}
        <Ionicons name="chevron-forward" size={16} color={bodyColor} />
      </View>
    </Pressable>
  );
}

export default function NotificationScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [notices, setNotices] = useState<MobileNotice[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const operator = isOperator(user);
  const unreadCount = notices.filter((item) => item.unread).length;

  const load = useCallback(() => {
    setLoadError('');
    return fetchNotifications()
      .then((result) => setNotices(result.data))
      .catch((err) => setLoadError(friendlyError(err, 'Could not load notifications.')))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      getStoredUser().then(setUser);
      void load();
    }, [load]),
  );

  const counts = useMemo(
    () => ({
      all: notices.length,
      unread: notices.filter((item) => item.unread).length,
      bookings: notices.filter((item) => item.kind === 'booking').length,
      announcements: notices.filter((item) => item.kind === 'announcement').length,
    }),
    [notices],
  );

  const grouped = useMemo(() => {
    const visible = notices.filter((item) => matchesFilter(item, filter));
    const sections: { title: string; items: MobileNotice[] }[] = [];

    visible.forEach((item) => {
      const last = sections[sections.length - 1];
      if (last && last.title === item.group) {
        last.items.push(item);
        return;
      }
      sections.push({ title: item.group, items: [item] });
    });

    return sections;
  }, [filter, notices]);

  async function openNotice(notice: MobileNotice) {
    if (notice.unread) {
      await markNotificationRead(notice.id);
      setNotices((current) =>
        current.map((item) => (item.id === notice.id ? { ...item, unread: false } : item)),
      );
    }

    if (notice.booking_id) {
      router.push({
        pathname: notice.event === 'completed' ? '/feedback' : '/booking-details',
        params: { id: String(notice.booking_id) },
      });
    }
  }

  async function markAllRead() {
    setNotices((current) => current.map((item) => ({ ...item, unread: false })));
    try {
      await markAllNotificationsRead();
    } catch {
      void load();
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.blue}
              colors={[colors.blue]}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }>
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open profile"
                onPress={() => router.push('/profile')}
                style={[styles.avatar, { backgroundColor: colors.blue }]}>
                <Ionicons name="person" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          <View style={styles.titleRow}>
            <View style={styles.titleCopy}>
              <Text style={[styles.title, { color: colors.navy }]}>Notifications</Text>
              <Text style={[styles.subtitle, { color: isDark ? '#C5CDD8' : TEXT }]}>
                Stay updated on your rentals and important announcements.
              </Text>
            </View>
            {unreadCount > 0 ? (
              <Pressable onPress={() => void markAllRead()} hitSlop={8} style={styles.markAll}>
                <Ionicons name="checkmark" size={14} color={colors.blue} />
                <Text style={[styles.markAllText, { color: colors.blue }]}>Mark all as read</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.filterGrid}>
            {FILTERS.map((item) => {
              const active = filter === item.key;
              const tone = isDark ? item.colorDark : item.color;
              const tint = isDark ? item.bgDark : item.bg;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setFilter(item.key)}
                  style={({ pressed }) => [
                    styles.filterCard,
                    {
                      borderColor: active ? tone : colors.border,
                      backgroundColor: active ? tone : tint,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <Ionicons name={item.icon} size={16} color={active ? '#FFFFFF' : tone} />
                  <Text
                    style={[styles.filterLabel, { color: active ? '#FFFFFF' : colors.navy }]}
                    numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text style={[styles.filterCount, { color: active ? '#FFFFFF' : tone }]}>
                    {counts[item.key]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.blue} style={styles.loader} />
          ) : loadError && notices.length === 0 ? (
            <LoadError
              message={loadError}
              offline
              onRetry={() => {
                setLoading(true);
                void load();
              }}
            />
          ) : grouped.length === 0 ? (
            <Text style={[styles.empty, { color: isDark ? '#C5CDD8' : TEXT }]}>
              {operator
                ? 'No notifications yet. New rental requests for your boats will appear here.'
                : 'No notifications yet. Approved rentals will appear here so you can open the trip slip.'}
            </Text>
          ) : (
            grouped.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.navy }]}>{section.title}</Text>
                {section.items.map((notice) => (
                  <NoticeCard key={notice.id} notice={notice} onPress={() => openNotice(notice)} />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
      {operator ? <OperatorTabs /> : <PassengerTabs />}
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PAGE,
  },
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  titleCopy: {
    flex: 1,
  },
  title: {
    color: NAVY,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 6,
  },
  markAllText: {
    fontSize: 11,
    fontWeight: '700',
  },
  filterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  filterCard: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 78,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  filterCount: {
    fontSize: 16,
    fontWeight: '800',
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  loader: {
    marginTop: 24,
  },
  empty: {
    marginTop: 20,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  section: {
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
    marginBottom: 10,
  },
  noticeUnread: {
    borderLeftWidth: 4,
    borderLeftColor: BLUE,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BLUE,
    marginTop: 8,
    marginRight: 8,
  },
  unreadSpacer: {
    width: 8,
    marginRight: 8,
  },
  noticeIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 1,
  },
  noticeCopy: {
    flex: 1,
    minWidth: 0,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  tag: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  noticeMeta: {
    alignItems: 'flex-end',
    gap: 8,
    marginLeft: 6,
  },
  noticeTime: {
    fontSize: 11,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.82,
  },
});
