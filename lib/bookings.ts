
import { api, ApiError, apiUpload } from '@/lib/api';
import type { CreateBookingInput, MobileBooking } from '@/lib/types';

export function normalizeBooking(item: MobileBooking): MobileBooking {
  const status = String(item.status ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_') as MobileBooking['status'];
  return { ...item, status: status || item.status };
}

export async function fetchBookings(): Promise<MobileBooking[]> {
  const response = await api<{ data: MobileBooking[] }>('/bookings', { timeoutMs: 20000 });
  return (response.data ?? []).map(normalizeBooking);
}

export function isPassengerRentalAlert(item: MobileBooking): boolean {
  return (
    item.status === 'pending' ||
    item.status === 'awaiting_payment' ||
    item.payment_status === 'rejected' ||
    Boolean(item.can_choose_refund_or_reschedule) ||
    Boolean(item.can_report_operator_no_show) ||
    Boolean(item.operator_no_show_report_pending) ||
    Boolean(item.passenger_no_show_report?.can_dispute)
  );
}

export function passengerRentalAlertCount(bookings: MobileBooking[]): number {
  return bookings.filter(isPassengerRentalAlert).length;
}

export function passengerFilterAlertCount(
  bookings: MobileBooking[],
  filter: 'all' | 'pending' | 'approved' | 'awaiting_payment' | 'cancelled' | 'completed',
): number {
  const alerts = bookings.filter(isPassengerRentalAlert);
  if (filter === 'all') {
    return alerts.length;
  }
  if (filter === 'cancelled') {
    return alerts.filter(
      (item) =>
        item.status === 'cancelled' ||
        item.status === 'rejected' ||
        item.status === 'passenger_no_show' ||
        Boolean(item.can_choose_refund_or_reschedule),
    ).length;
  }
  if (filter === 'awaiting_payment') {
    return alerts.filter(
      (item) => item.status === 'awaiting_payment' || item.payment_status === 'rejected',
    ).length;
  }
  if (filter === 'approved') {
    return alerts.filter(
      (item) =>
        item.status === 'approved' &&
        (Boolean(item.can_report_operator_no_show) || Boolean(item.operator_no_show_report_pending)),
    ).length;
  }
  return alerts.filter((item) => item.status === filter).length;
}

export async function fetchBooking(id: number): Promise<MobileBooking> {
  const response = await api<{ data: MobileBooking }>(`/bookings/${id}`, { timeoutMs: 20000 });
  return normalizeBooking(response.data);
}

export async function createBooking(input: CreateBookingInput): Promise<MobileBooking> {
  const response = await api<{ data: MobileBooking }>('/bookings', {
    method: 'POST',
    body: input,
    timeoutMs: 20000,
  });

  return normalizeBooking(response.data);
}

export async function updateBookingStatus(
  id: number,
  status: 'approved' | 'cancelled' | 'completed',
): Promise<MobileBooking> {
  const action =
    status === 'approved' ? 'approve' : status === 'completed' ? 'complete' : 'cancel';

  try {
    const response = await api<{ data: MobileBooking }>(`/bookings/${id}/${action}`, {
      method: 'POST',
    });
    return response.data;
  } catch (err) {
    if (!(err instanceof ApiError) || (err.status !== 404 && err.status !== 405)) {
      throw err;
    }
    const response = await api<{ data: MobileBooking }>(`/bookings/${id}`, {
      method: 'PATCH',
      body: { status },
    });
    return response.data;
  }
}

export async function cancelBookingAsPassenger(id: number, reason: string): Promise<MobileBooking> {
  const response = await api<{ data: MobileBooking }>(`/bookings/${id}/cancel`, {
    method: 'POST',
    body: { cancellation_reason: reason },
  });
  return normalizeBooking(response.data);
}

/** Operator/admin cancelled a paid rental: take a full refund or pick a new date. */
export async function chooseRefundOrReschedule(
  id: number,
  choice: 'refund' | 'reschedule',
  bookingDate?: string,
): Promise<MobileBooking> {
  const response = await api<{ data: MobileBooking }>(`/bookings/${id}/refund-choice`, {
    method: 'POST',
    body: choice === 'reschedule' ? { choice, booking_date: bookingDate } : { choice },
    timeoutMs: 30000,
  });
  return response.data;
}

export async function submitPaymentProof(
  id: number,
  input: { gcash_reference: string; uri: string; mime?: string; name?: string },
): Promise<MobileBooking> {
  const response = await apiUpload<{ data: MobileBooking }>(`/bookings/${id}/payment-proof`, {
    fileUri: input.uri,
    fieldName: 'receipt',
    mime: input.mime,
    name: input.name,
    fields: {
      gcash_reference: input.gcash_reference,
    },
  });
  return response.data;
}

export async function verifyPayment(id: number): Promise<MobileBooking> {
  const response = await api<{ data: MobileBooking }>(`/bookings/${id}/verify-payment`, {
    method: 'POST',
  });
  return response.data;
}

export async function rejectPayment(id: number, reason: string): Promise<MobileBooking> {
  const response = await api<{ data: MobileBooking }>(`/bookings/${id}/reject-payment`, {
    method: 'POST',
    body: { reason },
  });
  return response.data;
}

export async function requestReschedule(id: number, bookingDate: string): Promise<MobileBooking> {
  const response = await api<{ data: MobileBooking }>(`/bookings/${id}/reschedule`, {
    method: 'POST',
    body: { booking_date: bookingDate },
  });
  return response.data;
}

export async function reviewReschedule(
  id: number,
  action: 'approve' | 'reject',
  options?: { reason?: string },
): Promise<MobileBooking> {
  const response = await api<{ data: MobileBooking }>(`/bookings/${id}/reschedule-review`, {
    method: 'POST',
    body: {
      action,
      rejection_reason: action === 'reject' ? options?.reason : undefined,
    },
    timeoutMs: 20000,
  });
  return normalizeBooking(response.data);
}

export async function reportOperatorNoShow(id: number, note?: string): Promise<MobileBooking> {
  const response = await api<{ data: MobileBooking }>(`/bookings/${id}/report-no-show`, {
    method: 'POST',
    body: note ? { note } : {},
  });
  return normalizeBooking(response.data);
}

export async function markPassengerNoShow(
  id: number,
  input?: { note?: string; uri?: string | null; mime?: string; name?: string },
): Promise<MobileBooking> {
  const fields: Record<string, string> = { declaration_confirmed: '1' };
  if (input?.note?.trim()) {
    fields.note = input.note.trim();
  }

  if (input?.uri) {
    const response = await apiUpload<{ data: MobileBooking }>(`/bookings/${id}/passenger-no-show`, {
      fileUri: input.uri,
      fieldName: 'evidence',
      mime: input.mime,
      name: input.name,
      fields,
    });
    return normalizeBooking(response.data);
  }

  const response = await api<{ data: MobileBooking }>(`/bookings/${id}/passenger-no-show`, {
    method: 'POST',
    body: {
      declaration_confirmed: true,
      note: input?.note?.trim() || undefined,
    },
  });
  return normalizeBooking(response.data);
}

export async function recordBalancePayment(
  id: number,
  input: { method: 'cash' | 'gcash'; reference?: string },
): Promise<MobileBooking> {
  const response = await api<{ data: MobileBooking }>(`/bookings/${id}/balance-payment`, {
    method: 'POST',
    body: {
      method: input.method,
      reference: input.reference,
      confirmed: true,
    },
  });
  return response.data;
}

// ONLINE CHECKOUT (Xendit — test mode)
export type OnlineCheckoutResponse = {
  checkout_url: string;
  checkout_session_id?: string;
  checkout_expires_at?: string;
  payment_type?: 'downpayment' | 'full_payment';
};

export async function createXenditCheckout(
  bookingId: number,
  paymentType: 'downpayment' | 'full_payment' | 'full_rental',
  policyVersion: string,
  appReturnUrl?: string,
): Promise<OnlineCheckoutResponse> {
  return api<OnlineCheckoutResponse>(`/bookings/${bookingId}/xendit/checkout`, {
    method: 'POST',
    body: {
      payment_type: paymentType,
      policy_version: policyVersion,
      policy_accepted: true,
      ...(appReturnUrl ? { app_return_url: appReturnUrl } : {}),
    },
    timeoutMs: 30000,
  });
}

export async function acceptCheckoutPolicy(bookingId: number, policyVersion: string): Promise<void> {
  await api(`/bookings/${bookingId}/checkout-policy/accept`, {
    method: 'POST',
    body: { policy_version: policyVersion },
  });
}
