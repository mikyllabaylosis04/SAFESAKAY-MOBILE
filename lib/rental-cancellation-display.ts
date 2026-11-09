
import type {
  MobileBooking,
  RentalCancellationDisplay,
} from '@/lib/types';

export function isWeatherCancelledRental(
  booking: MobileBooking,
): boolean {
  // Passenger No-Show and pending reschedules are not
  // considered weather cancellations.
  if (
    booking.status === 'passenger_no_show' ||
    booking.status === 'reschedule_pending'
  ) {
    return false;
  }

  if (
    booking.status === 'pending' ||
    booking.status === 'awaiting_payment'
  ) {
    return false;
  }

  if (booking.status === 'weather_hold') {
    return true;
  }

  if (booking.cancellation_display?.use_weather_message) {
    return true;
  }

  // FIX: Removed the redundant passenger_no_show comparison.
  return Boolean(
    booking.weather_hold &&
    booking.status !== 'cancelled',
  );
}

export function isCancelledRentalTab(
  booking: MobileBooking,
): boolean {
  if (
    booking.status === 'pending' ||
    booking.status === 'awaiting_payment'
  ) {
    return false;
  }

  if (
    booking.status === 'cancelled' ||
    booking.status === 'weather_hold' ||
    booking.status === 'passenger_no_show' ||
    isWeatherCancelledRental(booking)
  ) {
    return true;
  }

  const label = (booking.status_label ?? '').toLowerCase();

  return /weather hold|called off|no trip/.test(label);
}

export type RentalCardBannerLine = {
  label: string;
  value: string;
};

export function rentalCardBanner(
  booking: MobileBooking,
): {
  bodyLines: string[];
  hint?: string;
  tone: 'weather' | 'default';
} | null {
  const display = booking.cancellation_display;

  if (
    display?.kind === 'passenger_no_show' ||
    booking.status === 'passenger_no_show'
  ) {
    const reason =
      display?.reason_label ?? 'Passenger No-Show';

    const verification = display?.verification_label;

    const payment =
      display?.payment_status_label ?? 'Non-refundable';

    return {
      tone: 'default',
      bodyLines: [
        `Cancellation reason: ${reason}`,
        ...(verification ? [verification] : []),
        `Payment status: ${payment}`,
      ],
      hint: 'View details →',
    };
  }

  if (isWeatherCancelledRental(booking)) {
    const message =
      display?.list_message ??
      booking.rental_card_message ??
      'Your trip is cancelled due to weather. Reschedule to another date.';

    return {
      tone: 'weather',
      bodyLines: [message],
    };
  }

  if (
    display &&
    !display.use_weather_message &&
    display.reason_label
  ) {
    return {
      tone: 'default',
      bodyLines: [
        `Cancellation reason: ${display.reason_label}`,
        ...(display.verification_label
          ? [display.verification_label]
          : []),
        ...(display.payment_status_label
          ? [
              `Payment status: ${display.payment_status_label}`,
            ]
          : []),
      ],
      hint: 'View details →',
    };
  }

  if (booking.rental_card_message) {
    return {
      tone: 'default',
      bodyLines: [booking.rental_card_message],
    };
  }

  return null;
}

export function passengerNoShowDetailCopy(
  display?: RentalCancellationDisplay | null,
): string[] {
  if (display?.kind === 'passenger_no_show') {
    return [
      `Cancellation reason: ${
        display.reason_label ?? 'Passenger No-Show'
      }`,
      ...(display.verification_label
        ? [display.verification_label]
        : []),
      `Payment status: ${
        display.payment_status_label ?? 'Non-refundable'
      }`,
    ];
  }

  return [
    'Cancellation reason: Passenger No-Show',
    'Payment status: Non-refundable',
  ];
}
