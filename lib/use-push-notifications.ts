import { usePathname, useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';

import { loadNotifications, syncPushTokenWithServer } from '@/lib/push-notifications';
import { getToken } from '@/lib/session';

const SIGNED_OUT_PATHS = new Set(['/', '/intro', '/loading', '/login', '/forgot-password', '/createacc']);

/** In-app path from a push payload's `data.url`; anything else is ignored. */
function notificationPath(data: unknown): Href | null {
  const url = (data as { url?: unknown } | null | undefined)?.url;

  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? (url as Href) : null;
}

/**
 * Registers the device for push once a passenger or operator is signed in,
 * and opens `data.url` when a notification is tapped.
 */
export function usePushNotifications(): void {
  const router = useRouter();
  const pathname = usePathname();
  const signedInScreen = !SIGNED_OUT_PATHS.has(pathname);

  useEffect(() => {
    if (!signedInScreen) {
      return;
    }

    let active = true;
    void getToken().then((token) => {
      if (active && token) {
        void syncPushTokenWithServer();
      }
    });

    return () => {
      active = false;
    };
  }, [signedInScreen]);

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;
    let active = true;

    void loadNotifications().then((Notifications) => {
      if (!Notifications || !active) {
        return;
      }

      const openFromNotification = (data: unknown) => {
        const path = notificationPath(data);
        if (path) {
          router.push(path);
        }
      };

      const launchResponse = Notifications.getLastNotificationResponse();
      if (launchResponse) {
        void getToken().then((token) => {
          if (active && token) {
            openFromNotification(launchResponse.notification.request.content.data);
          }
          Notifications.clearLastNotificationResponse();
        });
      }

      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        openFromNotification(response.notification.request.content.data);
      });
    });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [router]);
}
