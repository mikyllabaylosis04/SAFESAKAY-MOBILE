import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { subscribeNotifications } from '@/lib/notification-watch';
import { useAppTheme } from '@/lib/theme';

export function NotificationBell() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    return subscribeNotifications((result) => setUnread(result.unread_count));
  }, []);

  return (
    <Pressable hitSlop={8} style={styles.btn} onPress={() => router.push('/notification')}>
      <Ionicons name="notifications-outline" size={22} color={colors.navy} />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
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
