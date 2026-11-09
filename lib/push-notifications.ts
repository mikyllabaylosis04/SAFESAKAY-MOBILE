import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from '@/lib/api';
import { getToken } from '@/lib/session';

export const DEFAULT_NOTIFICATION_CHANNEL_ID = 'default';

type Notifications = typeof NotificationsModule;

export type PushRegistrationResult =
  | { status: 'registered'; token: string }
  | { status: 'unsupported'; reason: string }
  | { status: 'denied' }
  | { status: 'error'; reason: string };

let notificationsPromise: Promise<Notifications | null> | null = null;
let registrationPromise: Promise<PushRegistrationResult> | null = null;
let currentPushToken: string | null = null;
/** `${sessionToken}:${pushToken}` last saved on the server, so each sign-in links the device once. */
let savedForSession: string | null = null;

/** Remote push is unavailable in Expo Go on Android (SDK 53+); importing the module there only emits warnings. */
export function pushNotificationsSupported(): boolean {
  return Platform.OS !== 'web' && !isRunningInExpoGo();
}

export function loadNotifications(): Promise<Notifications | null> {
  if (!pushNotificationsSupported()) {
    return Promise.resolve(null);
  }

  notificationsPromise ??= import('expo-notifications')
    .then((Notifications) => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      return Notifications;
    })
    .catch((err) => {
      console.warn('[push] expo-notifications could not be loaded', err);
      return null;
    });

  return notificationsPromise;
}

export function getCurrentPushToken(): string | null {
  return currentPushToken;
}

function easProjectId(): string | null {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  return typeof projectId === 'string' && projectId.trim() !== '' ? projectId : null;
}

async function ensureAndroidChannel(Notifications: Notifications): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(DEFAULT_NOTIFICATION_CHANNEL_ID, {
    name: 'SafeSakay alerts',
    description: 'Rental requests, payments, trip updates, and safety announcements.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1A5AD7',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

async function register(): Promise<PushRegistrationResult> {
  const Notifications = await loadNotifications();
  if (!Notifications) {
    return { status: 'unsupported', reason: 'Push notifications need a development or preview build (not Expo Go).' };
  }

  const projectId = easProjectId();
  if (!projectId) {
    return { status: 'error', reason: 'EAS projectId is missing from app config (extra.eas.projectId).' };
  }

  try {
    // Android 13+ only shows the permission prompt after at least one channel exists.
    await ensureAndroidChannel(Notifications);

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }

    if (!granted) {
      return { status: 'denied' };
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    currentPushToken = token;

    return { status: 'registered', token };
  } catch (err) {
    return { status: 'error', reason: err instanceof Error ? err.message : String(err) };
  }
}

/** Registers once per app launch; safe to call repeatedly. */
export function registerForPushNotifications(): Promise<PushRegistrationResult> {
  registrationPromise ??= register().then((result) => {
    if (__DEV__) {
      console.log('[push] registration', result);
    }

    if (result.status === 'error') {
      // Allow a later retry (e.g. network was offline when fetching the token).
      registrationPromise = null;
    }

    return result;
  });

  return registrationPromise;
}

/** Registers the device and links its push token to the signed-in SafeSakay account. */
export async function syncPushTokenWithServer(): Promise<void> {
  const result = await registerForPushNotifications();
  if (result.status !== 'registered') {
    return;
  }

  const session = await getToken();
  const key = session ? `${session}:${result.token}` : null;
  if (!key || key === savedForSession) {
    return;
  }

  try {
    await api('/push-tokens', {
      method: 'POST',
      body: { token: result.token, platform: Platform.OS },
    });
    savedForSession = key;
  } catch (err) {
    if (__DEV__) {
      console.log('[push] could not save token on the server', err);
    }
  }
}

/** Stops pushes to this phone for the account that is signing out. Must run before the session is cleared. */
export async function removePushTokenFromServer(): Promise<void> {
  const token = currentPushToken;
  savedForSession = null;
  if (!token) {
    return;
  }

  try {
    await api('/push-tokens', { method: 'DELETE', body: { token }, timeoutMs: 5000 });
  } catch {
    // Best effort: the server also drops tokens Expo reports as unregistered.
  }
}
