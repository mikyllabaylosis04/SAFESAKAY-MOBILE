import { api } from '@/lib/api';
import { fetchBoatAvailability } from '@/lib/boats';
import type { BoatAvailability, MobileBooking } from '@/lib/types';

export type WeatherTone = 'red' | 'yellow' | 'blue';

export type DayWeatherMark = {
  tone: WeatherTone;
  reason: string;
  canBook: boolean;
  kind?: 'weather' | 'booked';
};

export type SeaAlert = {
  date: string;
  dateLabel: string;
  reason: string;
  tone?: WeatherTone;
  canBook?: boolean;
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function toYmd(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dateLabel(ymd: string) {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function upcomingYmd(count = 7) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return toYmd(date);
  });
}

export function isWeatherHold(reason?: string | null) {
  const text = (reason ?? '').toLowerCase();
  return /weather|bad weather|rough sea|dagat|storm|typhoon|gale|no trip|no sail|advisory|hangin|alon|cannot sail|called off/.test(
    text,
  );
}

export function weatherCopy(ymd: string, reason?: string | null, tone: WeatherTone = 'red') {
  const today = toYmd(new Date());
  const label = dateLabel(ymd);
  const detail = reason?.trim();

  if (tone === 'yellow') {
    return {
      title: 'Weather Watch — Booking Temporarily Unavailable',
      body:
        'Due to uncertain weather conditions, boat rental bookings for the affected schedule are temporarily unavailable.\n\n' +
        'Please select another available schedule or check again once the barangay confirms that travel conditions are safe.',
    };
  }

  return {
    title: ymd === today ? 'No trips today' : `No trips on ${label}`,
    body: detail
      ? `${detail}. Boats are not sailing this day. Please pick another date.`
      : `There is no boat trip ${ymd === today ? 'today' : `on ${label}`} because of a weather hold. Please pick another day.`,
  };
}

function fromAvailability(row: BoatAvailability): SeaAlert | null {
  const date = (row.date ?? '').slice(0, 10);
  if (row.weather_tone === 'yellow') {
    return {
      date,
      dateLabel: dateLabel(date),
      reason: row.day_reason || 'Weather watch',
      tone: 'yellow',
      canBook: false,
    };
  }
  if (row.weather_tone === 'red') {
    return {
      date,
      dateLabel: dateLabel(date),
      reason: row.day_reason || 'Bad weather',
      tone: 'red',
      canBook: false,
    };
  }
  if (row.day_booked || (row.day_available === false && !isWeatherHold(row.day_reason))) {
    return {
      date,
      dateLabel: dateLabel(date),
      reason: row.day_reason || 'This boat is already booked that day.',
      tone: 'blue',
      canBook: false,
    };
  }
  if (row.day_available === false) {
    return {
      date,
      dateLabel: dateLabel(date),
      reason: row.day_reason || 'This boat is already booked that day.',
      tone: 'red',
      canBook: false,
    };
  }
  return null;
}

function isLiftedHold(row: {
  status?: string;
  lifted_at?: string | null;
  day_available?: boolean;
  category?: string;
  kind?: string;
  type?: string;
}) {
  const status = String(row.status ?? '').toLowerCase();
  const kind = String(row.category ?? row.kind ?? row.type ?? '').toLowerCase();
  if (row.lifted_at || row.day_available === true) {
    return true;
  }
  if (['lifted', 'inactive', 'cleared', 'cancelled', 'expired', 'open'].includes(status)) {
    return true;
  }
  if (['announcement', 'general', 'trip_delay', 'delay', 'notice', 'reminder'].includes(kind)) {
    return true;
  }
  return false;
}

function readAdvisoryList(payload: unknown): SeaAlert[] {
  const root = payload as { data?: unknown };
  const rows = Array.isArray(payload) ? payload : Array.isArray(root.data) ? root.data : [];

  return rows.flatMap((item) => {
    const row = item as {
      date?: string;
      day?: string;
      date_label?: string;
      affected_date?: string;
      affected_date_label?: string;
      reason?: string;
      reason_label?: string;
      title?: string;
      message?: string;
      headline?: string;
      day_available?: boolean;
      status?: string;
      tone?: WeatherTone;
      can_book?: boolean;
      lifted_at?: string | null;
      category?: string;
      kind?: string;
      type?: string;
    };
    const date = (row.date || row.day || row.affected_date || '').slice(0, 10);
    if (!date || isLiftedHold(row)) {
      return [];
    }

    const status = String(row.status ?? '').toLowerCase();
    const tone: WeatherTone | null =
      row.tone === 'yellow' || status === 'watch'
        ? 'yellow'
        : row.tone === 'red' || status === 'weather_hold' || status === 'no_sail'
          ? 'red'
          : null;
    if (!tone) {
      return [];
    }

    const reason = row.reason_label || row.reason || row.title || row.message || row.headline || 'Bad weather';
    return [
      {
        date,
        dateLabel: row.date_label || row.affected_date_label || dateLabel(date),
        reason,
        tone,
        canBook: false,
      },
    ];
  });
}

async function fetchFromWeatherApi(from: string, to: string): Promise<SeaAlert[]> {
  try {
    const payload = await api<unknown>(`/weather-advisories?from=${from}&to=${to}`);
    return readAdvisoryList(payload);
  } catch {
    return [];
  }
}

export async function fetchDayHolds(boatId: number, dates: string[]): Promise<Record<string, DayWeatherMark>> {
  const unique = [...new Set(dates.filter(Boolean))];
  const from = unique.slice().sort()[0];
  const to = unique.slice().sort()[unique.length - 1];
  const holds: Record<string, DayWeatherMark> = {};

  if (from && to) {
    (await fetchFromWeatherApi(from, to)).forEach((alert) => {
      holds[alert.date] = {
        tone: alert.tone ?? 'red',
        reason: alert.reason,
        canBook: false,
      };
    });
  }

  const rows = await Promise.all(
    unique.map(async (date) => {
      try {
        return await fetchBoatAvailability(boatId, date);
      } catch {
        return null;
      }
    }),
  );

  rows.forEach((row) => {
    const alert = row ? fromAvailability(row) : null;
    if (!alert) {
      return;
    }
    const current = holds[alert.date];
    if (current?.tone === 'red') {
      return;
    }
    holds[alert.date] = {
      tone: alert.tone ?? 'red',
      reason: alert.reason,
      canBook: false,
      kind: alert.tone === 'blue' ? 'booked' : 'weather',
    };
  });
  return holds;
}

/** Confirmed trips only — pending / awaiting payment stay off weather hold. */
export function isConfirmedScheduledTrip(booking: MobileBooking): boolean {
  return (
    booking.status === 'approved' ||
    booking.status === 'weather_hold' ||
    booking.status === 'reschedule_pending'
  );
}

export function alertsFromBookings(bookings: MobileBooking[]): SeaAlert[] {
  return bookings.flatMap((booking) => {
    if (!isConfirmedScheduledTrip(booking)) {
      return [];
    }
    if (!(booking.weather_hold || booking.status === 'weather_hold' || booking.status === 'reschedule_pending')) {
      return [];
    }
    const date = (booking.booking_date ?? '').slice(0, 10);
    if (!date) {
      return [];
    }
    return [
      {
        date,
        dateLabel: booking.booking_date_label || dateLabel(date),
        reason: booking.weather_reason_label || booking.weather_reason || 'Weather hold',
      },
    ];
  });
}

export function affectedBookingForAlert(bookings: MobileBooking[], date: string): MobileBooking | null {
  const key = date.slice(0, 10);
  return (
    bookings.find((booking) => {
      if ((booking.booking_date ?? '').slice(0, 10) !== key) {
        return false;
      }
      return isConfirmedScheduledTrip(booking);
    }) ?? null
  );
}

export async function fetchSeaAlerts(_boatId?: number, days = 7): Promise<SeaAlert[]> {
  const dates = upcomingYmd(days);
  const fromApi = await fetchFromWeatherApi(dates[0], dates[dates.length - 1]);
  return fromApi.sort((a, b) => a.date.localeCompare(b.date));
}
