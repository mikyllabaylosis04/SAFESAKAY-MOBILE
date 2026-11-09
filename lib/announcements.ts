import type { MobileNotice } from '@/lib/types';
import { isWeatherHold } from '@/lib/weather';

/** Same colors as the admin web: weather = red (trip suspension), delay = yellow, general = violet, emergency = red. */
export type AnnouncementTone = 'red' | 'yellow' | 'blue' | 'violet';

const NON_WEATHER_EVENTS = ['delay', 'trip_delay', 'general', 'emergency'];

export type DashboardAnnouncement = {
  id: string;
  title: string;
  body: string;
  tone: AnnouncementTone;
  created_at: string;
};

function noticeText(item: { title?: string; body?: string; event?: string }) {
  return `${item.title ?? ''} ${item.body ?? ''} ${item.event ?? ''}`.toLowerCase();
}

export function isAnnouncementNotice(item: MobileNotice) {
  const kind = String(item.kind ?? '').toLowerCase();
  const event = String(item.event ?? '').toLowerCase();
  return (
    kind === 'announcement' ||
    event === 'announcement' ||
    event === 'weather' ||
    event === 'resume' ||
    event === 'lifted' ||
    event === 'general' ||
    event === 'trip_delay' ||
    event === 'delay'
  );
}

export function isClearedWeatherNotice(item: { title?: string; body?: string; event?: string }) {
  const event = String(item.event ?? '').toLowerCase();
  if (event === 'resume' || event === 'lifted') {
    return true;
  }
  return /lifted|cleared|may proceed|suspension is over|trips may proceed/.test(noticeText(item));
}

export function isWeatherDashboardNotice(item: { title?: string; body?: string; event?: string; tone?: AnnouncementTone }) {
  const event = String(item.event ?? '').toLowerCase();
  // The admin picked a category: a trip delay about "rough seas" is still a delay, not a weather hold.
  if (NON_WEATHER_EVENTS.includes(event)) {
    return false;
  }
  if (isClearedWeatherNotice(item)) {
    return true;
  }
  return event === 'weather' || item.tone === 'red' || isWeatherHold(noticeText(item));
}

export function announcementTone(item: { title?: string; body?: string; event?: string }): AnnouncementTone {
  const event = String(item.event ?? '').toLowerCase();
  if (event === 'delay' || event === 'trip_delay') {
    return 'yellow';
  }
  if (event === 'emergency') {
    return 'red';
  }
  if (event === 'general') {
    return 'violet';
  }
  if (isClearedWeatherNotice(item)) {
    return 'blue';
  }
  if (event === 'weather' || isWeatherHold(noticeText(item))) {
    return 'red';
  }
  if (/delay|watch|advisory/.test(noticeText(item))) {
    return 'yellow';
  }
  return 'blue';
}

export function uniqueDashboardAnnouncements(items: DashboardAnnouncement[]): DashboardAnnouncement[] {
  const seen = new Map<string, DashboardAnnouncement>();
  items.forEach((item) => {
    const key = `${item.title.trim().toLowerCase()}|${item.body.trim().toLowerCase()}`;
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  });
  return [...seen.values()];
}

export function noticeDedupeKey(item: { title?: string; body?: string }) {
  return `${(item.title ?? '').trim().toLowerCase()}|${(item.body ?? '').trim().toLowerCase()}`;
}

export function latestActiveWeatherNotice<
  T extends { title?: string; body?: string; event?: string; created_at?: string; tone?: AnnouncementTone },
>(items: T[]): T | null {
  const sorted = [...items].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const latest = sorted.find((item) => isWeatherDashboardNotice(item));
  if (!latest || isClearedWeatherNotice(latest)) {
    return null;
  }
  return latest;
}

export function collapseAnnouncementNotices(items: MobileNotice[]): MobileNotice[] {
  const sorted = [...items].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const weather = latestActiveWeatherNotice(sorted);
  const others = sorted.filter((item) => !isWeatherDashboardNotice(item) && !isClearedWeatherNotice(item));
  const uniqueOthers: MobileNotice[] = [];
  const seen = new Set<string>();
  others.forEach((item) => {
    const key = noticeDedupeKey(item);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    uniqueOthers.push(item);
  });
  return [...(weather ? [weather] : []), ...uniqueOthers];
}

export function dashboardReminderNotices(
  items: DashboardAnnouncement[],
  options: { hasActiveWeather: boolean },
): DashboardAnnouncement[] {
  const unique = uniqueDashboardAnnouncements(items);
  const weather = latestActiveWeatherNotice(unique);
  const rest = unique.filter(
    (item) =>
      !isWeatherDashboardNotice(item) &&
      !isClearedWeatherNotice(item) &&
      isFreshAnnouncement(item.created_at),
  );

  if (options.hasActiveWeather) {
    return rest;
  }

  return weather ? [weather, ...rest] : rest;
}

export function isFreshAnnouncement(createdAt?: string, hours = 36) {
  if (!createdAt) {
    return true;
  }
  const stamp = new Date(createdAt).getTime();
  if (Number.isNaN(stamp)) {
    return true;
  }
  return Date.now() - stamp < hours * 3600 * 1000;
}

export function toDashboardAnnouncement(item: MobileNotice): DashboardAnnouncement {
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    tone: announcementTone(item),
    created_at: item.created_at,
  };
}
