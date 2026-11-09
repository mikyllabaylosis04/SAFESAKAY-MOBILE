import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'safesakay_token';
const USER_KEY = 'safesakay_user';
const THEME_KEY = 'safesakay_theme';
const API_BASE_KEY = 'safesakay_api_base';
const SEEN_ANNOUNCEMENTS_KEY = 'safesakay_seen_announcements';
const PINNED_ANNOUNCEMENTS_KEY = 'safesakay_pinned_announcements';

async function setValue(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function getValue(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

async function deleteValue(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

export async function saveToken(token: string): Promise<void> {
  await setValue(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return getValue(TOKEN_KEY);
}

export async function saveUser(userJson: string): Promise<void> {
  await setValue(USER_KEY, userJson);
}

export async function getUserJson(): Promise<string | null> {
  return getValue(USER_KEY);
}

export async function saveTheme(theme: 'light' | 'dark'): Promise<void> {
  await setValue(THEME_KEY, theme);
}

export async function getTheme(): Promise<string | null> {
  return getValue(THEME_KEY);
}

export async function saveApiBase(base: string): Promise<void> {
  await setValue(API_BASE_KEY, base);
}

export async function getApiBase(): Promise<string | null> {
  return getValue(API_BASE_KEY);
}

export async function getSeenAnnouncements(): Promise<string[]> {
  const raw = await getValue(SEEN_ANNOUNCEMENTS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export async function rememberSeenAnnouncement(id: string): Promise<void> {
  await rememberSeenAnnouncements([id]);
}

export async function rememberSeenAnnouncements(ids: string[]): Promise<void> {
  const extra = ids.filter(Boolean);
  if (extra.length === 0) {
    return;
  }
  const current = await getSeenAnnouncements();
  const next = [...current];
  extra.forEach((id) => {
    if (!next.includes(id)) {
      next.push(id);
    }
  });
  await setValue(SEEN_ANNOUNCEMENTS_KEY, JSON.stringify(next.slice(-80)));
}

export type PinnedAnnouncement = {
  id: string;
  title: string;
  body: string;
  tone: 'red' | 'yellow' | 'blue';
  created_at: string;
};

export async function getPinnedAnnouncements(): Promise<PinnedAnnouncement[]> {
  const raw = await getValue(PINNED_ANNOUNCEMENTS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is PinnedAnnouncement => {
      return (
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as PinnedAnnouncement).id === 'string' &&
        typeof (item as PinnedAnnouncement).title === 'string'
      );
    });
  } catch {
    return [];
  }
}

export async function pinAnnouncement(item: PinnedAnnouncement): Promise<void> {
  const current = await getPinnedAnnouncements();
  const next = [item, ...current.filter((row) => row.id !== item.id)].slice(0, 8);
  await setValue(PINNED_ANNOUNCEMENTS_KEY, JSON.stringify(next));
}

export async function replacePinnedAnnouncements(items: PinnedAnnouncement[]): Promise<void> {
  await setValue(PINNED_ANNOUNCEMENTS_KEY, JSON.stringify(items.slice(0, 8)));
}

export async function clearSession(): Promise<void> {
  await deleteValue(TOKEN_KEY);
  await deleteValue(USER_KEY);
}
