import { AppState } from 'react-native';

import { fetchNotifications, type NotificationList } from '@/lib/notifications';
import { getToken } from '@/lib/session';

const INTERVAL_MS = 8000;

const listeners = new Set<(list: NotificationList) => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let appSub: { remove: () => void } | null = null;
let inFlight = false;
let started = false;

async function tick() {
  if (inFlight) {
    return;
  }

  inFlight = true;
  try {
    const token = await getToken();
    if (!token) {
      return;
    }

    const list = await fetchNotifications({ localFallback: false });
    listeners.forEach((listener) => listener(list));
  } catch {
    // Keep the last successful list on the screen.
  } finally {
    inFlight = false;
  }
}

function start() {
  if (started) {
    return;
  }

  started = true;
  void tick();
  timer = setInterval(() => {
    void tick();
  }, INTERVAL_MS);
  appSub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void tick();
    }
  });
}

function stop() {
  started = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  appSub?.remove();
  appSub = null;
}

export function subscribeNotifications(listener: (list: NotificationList) => void) {
  listeners.add(listener);
  start();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stop();
    }
  };
}
