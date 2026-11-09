import type { AuthUser, Boat, MobileBooking } from '@/lib/types';

export function passengerName(booking: MobileBooking): string {
  return booking.passenger?.full_name?.trim() || booking.passenger?.name?.trim() || 'Passenger';
}

export function passengerPhone(booking: MobileBooking): string | null {
  const phone = booking.passenger?.contact_number?.trim();
  return phone || null;
}

export function boatsForOperator(boats: Boat[], user: AuthUser | null): Boat[] {
  if (!user) {
    return [];
  }

  const byAccount = boats.filter((boat) => boat.operator_user_id === user.id);
  if (byAccount.length > 0) {
    return byAccount;
  }

  const name = user.name.trim().toLowerCase();
  const assigned = boats.filter((boat) => {
    const operatorName = boat.operator_name?.trim().toLowerCase();
    return Boolean(operatorName && operatorName === name);
  });

  if (assigned.length > 0 || boats.some((boat) => boat.operator_name?.trim())) {
    return assigned;
  }

  return boats;
}

export function sortTrips(a: MobileBooking, b: MobileBooking): number {
  const dateCompare = (a.booking_date ?? '').localeCompare(b.booking_date ?? '');

  if (dateCompare !== 0) {
    return dateCompare;
  }

  return (a.start_time ?? '').localeCompare(b.start_time ?? '');
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isBookingOnDate(booking: MobileBooking, date = new Date()): boolean {
  const value = (booking.booking_date ?? '').slice(0, 10);
  return value === localDateKey(date);
}

export function minutesSinceDeparture(booking: MobileBooking, now = Date.now()): number | null {
  const date = (booking.booking_date ?? '').slice(0, 10);
  const time = (booking.start_time ?? '').slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }
  const start = Date.parse(`${date}T${time}:00+08:00`);
  if (Number.isNaN(start)) {
    return null;
  }
  return Math.floor((now - start) / 60000);
}

export function canPassengerReportOperatorNoShow(booking: MobileBooking, now = Date.now()): boolean {
  if (booking.operator_no_show_report_pending) {
    return false;
  }
  if (booking.status !== 'approved') {
    return false;
  }
  if (booking.can_report_operator_no_show !== undefined) {
    return booking.can_report_operator_no_show;
  }
  const minutes = minutesSinceDeparture(booking, now);
  return minutes !== null && minutes >= (booking.operator_no_show_grace_minutes ?? DEFAULT_NO_SHOW_GRACE_MINUTES);
}

function manilaDateKey(now = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now));
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
}

export const DEFAULT_NO_SHOW_GRACE_MINUTES = 15;

function passengerGraceMinutes(booking: MobileBooking): number {
  return booking.passenger_no_show_grace_minutes ?? DEFAULT_NO_SHOW_GRACE_MINUTES;
}

export function passengerNoShowOpensAtLabel(booking: MobileBooking): string | null {
  if (booking.passenger_no_show_opens_at_label) {
    return booking.passenger_no_show_opens_at_label;
  }
  const date = (booking.booking_date ?? '').slice(0, 10);
  const time = (booking.start_time ?? '').slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }
  const start = Date.parse(`${date}T${time}:00+08:00`);
  if (Number.isNaN(start)) {
    return null;
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(start + passengerGraceMinutes(booking) * 60000));
}

export function isPassengerNoShowWaiting(booking: MobileBooking, now = Date.now()): boolean {
  if (booking.status !== 'approved') {
    return false;
  }
  const date = (booking.booking_date ?? '').slice(0, 10);
  if (!date || manilaDateKey(now) !== date) {
    return false;
  }
  const minutes = minutesSinceDeparture(booking, now);
  return minutes !== null && minutes < passengerGraceMinutes(booking);
}

export function canOperatorMarkPassengerNoShowLocal(booking: MobileBooking, now = Date.now()): boolean {
  if (booking.status !== 'approved') {
    return false;
  }
  const date = (booking.booking_date ?? '').slice(0, 10);
  if (!date || manilaDateKey(now) !== date) {
    return false;
  }
  const minutes = minutesSinceDeparture(booking, now);
  return minutes !== null && minutes >= passengerGraceMinutes(booking);
}

/** Operators can mark a rental completed only on the trip date or later. */
export function isTripDayOrAfter(booking: MobileBooking, date = new Date()): boolean {
  const value = (booking.booking_date ?? '').slice(0, 10);
  if (!value) {
    return true;
  }
  return localDateKey(date) >= value;
}

export function isRegularTrip(booking: MobileBooking) {
  return booking.kind === 'regular_trip';
}

export function privateBookings(bookings: MobileBooking[]): MobileBooking[] {
  return bookings.filter((item) => !isRegularTrip(item));
}

export function pendingRequests(bookings: MobileBooking[]): MobileBooking[] {
  return privateBookings(bookings)
    .filter((item) => item.status === 'pending')
    .sort(sortTrips);
}

export function paymentsToVerify(bookings: MobileBooking[]): MobileBooking[] {
  return privateBookings(bookings)
    .filter((item) => item.status === 'awaiting_payment' && item.payment_status === 'for_verification')
    .sort(sortTrips);
}

function isOperatorNoShowRescheduleRequest(booking: MobileBooking): boolean {
  return Boolean(booking.can_operator_respond_reschedule || booking.no_show_reschedule_boat_name);
}

export function isRescheduleRequestItem(item: MobileBooking): boolean {
  if (Boolean(item.can_operator_respond_reschedule)) {
    return true;
  }
  if (isOperatorNoShowRescheduleRequest(item)) {
    return false;
  }

  return Boolean(item.can_review_reschedule);
}

export function rescheduleRequests(bookings: MobileBooking[]): MobileBooking[] {
  return privateBookings(bookings).filter(isRescheduleRequestItem).sort(sortTrips);
}

export function attentionRequestCount(bookings: MobileBooking[]): number {
  return pendingRequests(bookings).length + paymentsToVerify(bookings).length + rescheduleRequests(bookings).length;
}

export function bookingsForBoat(bookings: MobileBooking[], boatId: number): MobileBooking[] {
  return privateBookings(bookings)
    .filter((item) => Number(item.boat?.id) === Number(boatId))
    .sort((a, b) => {
      const dateCompare = (b.booking_date ?? '').localeCompare(a.booking_date ?? '');
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return (b.start_time ?? '').localeCompare(a.start_time ?? '');
    });
}

export function boatHistory(bookings: MobileBooking[], boatId: number): MobileBooking[] {
  const rank = (status: MobileBooking['status']) => {
    if (status === 'completed') {
      return 0;
    }
    if (status === 'approved' || status === 'reschedule_pending' || status === 'awaiting_payment') {
      return 1;
    }
    return 2;
  };

  return bookingsForBoat(bookings, boatId).sort((a, b) => {
    const byStatus = rank(a.status) - rank(b.status);
    if (byStatus !== 0) {
      return byStatus;
    }
    const dateCompare = (b.booking_date ?? '').localeCompare(a.booking_date ?? '');
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return (b.start_time ?? '').localeCompare(a.start_time ?? '');
  });
}

export function boatRevenueTotal(bookings: MobileBooking[]): number {
  return bookings.reduce((sum, item) => {
    if (item.status !== 'completed') {
      return sum;
    }
    return sum + (item.total_paid ?? item.rental_price ?? item.down_payment_amount ?? 0);
  }, 0);
}

export function approvedRentals(bookings: MobileBooking[]): MobileBooking[] {
  return privateBookings(bookings)
    .filter((item) => item.status === 'approved')
    .sort(sortTrips);
}

export function todaysTrips(bookings: MobileBooking[]): MobileBooking[] {
  return bookings
    .filter((item) => item.status === 'approved' && isBookingOnDate(item))
    .sort(sortTrips);
}

export function upcomingTrips(bookings: MobileBooking[]): MobileBooking[] {
  return bookings.filter((item) => item.status === 'approved').sort(sortTrips);
}

/** Prefer accepted passenger rentals over regular rotation legs on the home screen. */
export function nextOperatorTrip(bookings: MobileBooking[]): MobileBooking | null {
  const approvedPrivate = approvedRentals(bookings);
  if (approvedPrivate.length > 0) {
    const todayPrivate = approvedPrivate.filter((item) => isBookingOnDate(item));
    return todayPrivate[0] ?? approvedPrivate[0] ?? null;
  }

  return todaysTrips(bookings)[0] ?? upcomingTrips(bookings)[0] ?? null;
}
