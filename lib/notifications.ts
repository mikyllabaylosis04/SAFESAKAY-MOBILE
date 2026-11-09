import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { fetchBookings } from '@/lib/bookings';
import { passengerName } from '@/lib/operator';
import { isOperator } from '@/lib/roles';
import type { MobileBooking, MobileNotice } from '@/lib/types';

export type NotificationList = {
  data: MobileNotice[];
  unread_count: number;
};

export type NoticeBucket = 'booking' | 'alert' | 'maintenance';

export function noticeBucket(notice: MobileNotice): NoticeBucket {
  if (notice.kind === 'booking') {
    return 'booking';
  }

  if (notice.kind === 'emergency') {
    return 'alert';
  }

  const event = notice.event.toLowerCase();
  const text = `${notice.title} ${notice.body}`.toLowerCase();

  if (event === 'maintenance' || text.includes('maintenance')) {
    return 'maintenance';
  }

  return 'alert';
}

export function noticeCounts(notices: MobileNotice[]) {
  return {
    total: notices.length,
    unread: notices.filter((item) => item.unread).length,
    bookings: notices.filter((item) => noticeBucket(item) === 'booking').length,
    alerts: notices.filter((item) => noticeBucket(item) === 'alert').length,
    maintenance: notices.filter((item) => noticeBucket(item) === 'maintenance').length,
  };
}

function groupLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Earlier';
  }

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (startToday.getTime() - startDate.getTime()) / 86400000;

  if (diff === 0) {
    return 'Today';
  }
  if (diff === 1) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function noticeFromBooking(booking: MobileBooking, operator: boolean): MobileNotice {
  const boatLabel = `${booking.boat.name} (${booking.boat.code})`;
  const copy = operator
    ? booking.status === 'approved'
      ? {
          title: 'Trip confirmed',
          body: `${passengerName(booking)} is booked on ${boatLabel} to ${booking.destination} on ${booking.booking_date_label}.`,
        }
      : booking.status === 'cancelled'
        ? {
            title: 'Request cancelled',
            body: `The rental for ${boatLabel} on ${booking.booking_date_label} was cancelled.`,
          }
        : booking.status === 'completed'
          ? {
              title: 'Trip completed',
              body: `${boatLabel} finished the trip to ${booking.destination} on ${booking.booking_date_label}.`,
            }
          : booking.status === 'passenger_no_show'
            ? {
                title: 'Passenger did not show',
                body: `${passengerName(booking)} did not appear for ${boatLabel} on ${booking.booking_date_label}. Down payment is not refunded.`,
              }
          : {
              title: 'New rental request',
              body: `${passengerName(booking)} requested ${boatLabel} to ${booking.destination} on ${booking.booking_date_label}.`,
            }
    : booking.status === 'approved'
      ? {
          title: 'Your rental has been approved!',
          body: `Don't forget! your trip to ${boatLabel} on ${booking.booking_date_label} has been approved.`,
        }
      : booking.status === 'cancelled'
        ? {
            title: 'Your rental was cancelled',
            body: `Your rental request for ${booking.boat.name} on ${booking.booking_date_label} was not approved.`,
          }
        : booking.status === 'completed'
          ? {
              title: 'Your trip has been completed',
              body: `Thank you for riding ${booking.boat.name} to ${booking.destination} on ${booking.booking_date_label}.`,
            }
          : booking.status === 'passenger_no_show'
            ? {
                title: 'Marked as passenger no-show',
                body: `The operator marked that you did not arrive for ${booking.boat.name} on ${booking.booking_date_label}. Your down payment is not refunded.`,
              }
          : {
              title: 'Your rental is waiting for the boat operator',
              body: `Your rental request for ${boatLabel} on ${booking.booking_date_label} is waiting for the boat operator to accept it.`,
            };

  return {
    id: `booking-${booking.id}-${booking.status}`,
    kind: 'booking',
    event: booking.status,
    booking_id: booking.id,
    unread:
      booking.status === 'pending' ||
      booking.status === 'approved' ||
      booking.status === 'awaiting_payment',
    created_at: booking.booking_date,
    group: groupLabel(booking.booking_date),
    ...copy,
  };
}

function noticeIsUnread(raw: {
  unread?: boolean | number | string | null;
  is_read?: boolean | number | string | null;
  read?: boolean | number | string | null;
  read_at?: string | null;
}): boolean {
  if (typeof raw.unread === 'boolean') {
    return raw.unread;
  }
  if (raw.unread === 1 || raw.unread === '1') {
    return true;
  }
  if (raw.unread === 0 || raw.unread === '0') {
    return false;
  }
  if (typeof raw.is_read === 'boolean') {
    return !raw.is_read;
  }
  if (raw.is_read === 1 || raw.is_read === '1') {
    return false;
  }
  if (raw.is_read === 0 || raw.is_read === '0') {
    return true;
  }
  if (typeof raw.read === 'boolean') {
    return !raw.read;
  }
  if (raw.read_at) {
    return false;
  }
  if (raw.read_at === null) {
    return true;
  }
  return false;
}

function normalizeNotice(raw: Partial<MobileNotice> & Record<string, unknown>): MobileNotice {
  return {
    id: String(raw.id ?? ''),
    kind: (raw.kind as MobileNotice['kind']) || 'booking',
    event: String(raw.event ?? ''),
    booking_id: typeof raw.booking_id === 'number' ? raw.booking_id : null,
    title: String(raw.title ?? ''),
    body: String(raw.body ?? ''),
    unread: noticeIsUnread(raw),
    created_at: String(raw.created_at ?? ''),
    group: String(raw.group || groupLabel(String(raw.created_at ?? ''))),
  };
}

function fromBookings(bookings: MobileBooking[], operator: boolean): NotificationList {
  const data = bookings.map((booking) => noticeFromBooking(booking, operator));
  return {
    data,
    unread_count: data.filter((item) => item.unread).length,
  };
}

export async function fetchNotifications(options?: { localFallback?: boolean }): Promise<NotificationList> {
  try {
    const result = await api<NotificationList>('/notifications', { timeoutMs: 20000 });
    const data = (result.data ?? []).map((item) => normalizeNotice(item));
    const flagged = data.filter((item) => item.unread).length;
    if (flagged === 0 && result.unread_count > 0) {
      data.slice(0, result.unread_count).forEach((item) => {
        item.unread = true;
      });
    }
    return {
      data,
      unread_count: data.filter((item) => item.unread).length,
    };
  } catch (err) {
    if (options?.localFallback === false) {
      throw err;
    }
    const [bookings, user] = await Promise.all([fetchBookings(), getStoredUser()]);
    return fromBookings(bookings, isOperator(user));
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  if (id.startsWith('booking-')) {
    return;
  }

  try {
    await api('/notifications/' + encodeURIComponent(id) + '/read', { method: 'POST' });
  } catch {
    // Opening the booking slip still works if mark-read fails.
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  await api('/notifications/read-all', { method: 'POST' });
}
