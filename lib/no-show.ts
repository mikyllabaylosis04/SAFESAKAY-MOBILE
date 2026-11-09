import { api, apiUpload } from '@/lib/api';
import type { MobileBooking, OperatorNoShowIncident, OperatorNoShowReason, RescheduleBoatOption } from '@/lib/types';

export async function fetchNoShowIncident(bookingId: number): Promise<OperatorNoShowIncident | null> {
  const response = await api<{ data: OperatorNoShowIncident | null }>(`/bookings/${bookingId}/no-show`);
  return response.data ?? null;
}

export async function reportOperatorNoShowWithEvidence(
  bookingId: number,
  input: { reason: OperatorNoShowReason; note?: string; uri?: string | null; mime?: string; name?: string },
): Promise<MobileBooking> {
  const fields: Record<string, string> = { reason: input.reason };
  if (input.note) {
    fields.note = input.note;
  }

  if (input.uri) {
    const response = await apiUpload<{ data: MobileBooking }>(`/bookings/${bookingId}/report-no-show`, {
      fileUri: input.uri,
      fieldName: 'evidence',
      mime: input.mime,
      name: input.name,
      fields,
    });
    return response.data;
  }

  const response = await api<{ data: MobileBooking }>(`/bookings/${bookingId}/report-no-show`, {
    method: 'POST',
    body: fields,
  });
  return response.data;
}

export async function chooseNoShowResolution(
  bookingId: number,
  choice: 'refund' | 'replacement',
): Promise<MobileBooking> {
  const response = await api<{ data: MobileBooking }>(`/bookings/${bookingId}/no-show/choose-resolution`, {
    method: 'POST',
    body: { choice },
  });
  return response.data;
}

export async function respondNoShowReplacement(
  bookingId: number,
  accept: boolean,
  reason?: string,
): Promise<MobileBooking> {
  const response = await api<{ data: MobileBooking }>(`/bookings/${bookingId}/no-show/replacement/respond`, {
    method: 'POST',
    body: { accept, reason: reason?.trim() || undefined },
  });
  return response.data;
}

export async function disputePassengerNoShow(bookingId: number, reason: string): Promise<MobileBooking> {
  const response = await api<{ data: MobileBooking }>(`/bookings/${bookingId}/passenger-no-show/dispute`, {
    method: 'POST',
    body: { reason: reason.trim() },
  });
  return response.data;
}

export async function fetchRescheduleBoats(bookingId: number, date?: string): Promise<RescheduleBoatOption[]> {
  const response = await api<{ data: RescheduleBoatOption[] }>(
    `/bookings/${bookingId}/no-show/reschedule-boats${date ? `?date=${encodeURIComponent(date)}` : ''}`,
  );
  return response.data ?? [];
}

export async function submitNoShowRefundRequest(
  bookingId: number,
  input: {
    gcash_account_name: string;
    gcash_mobile: string;
    qrUri?: string | null;
    qrMime?: string;
    qrName?: string;
  },
): Promise<OperatorNoShowIncident | null> {
  if (input.qrUri) {
    const response = await apiUpload<{ data: OperatorNoShowIncident | null }>(
      `/bookings/${bookingId}/no-show/refund-request`,
      {
        fileUri: input.qrUri,
        fieldName: 'qr',
        mime: input.qrMime,
        name: input.qrName,
        fields: {
          gcash_account_name: input.gcash_account_name,
          gcash_mobile: input.gcash_mobile,
          confirmed: '1',
        },
      },
    );
    return response.data ?? null;
  }

  const response = await api<{ data: OperatorNoShowIncident | null }>(
    `/bookings/${bookingId}/no-show/refund-request`,
    {
      method: 'POST',
      body: {
        gcash_account_name: input.gcash_account_name,
        gcash_mobile: input.gcash_mobile,
        confirmed: true,
      },
    },
  );
  return response.data ?? null;
}

export async function submitNoShowRescheduleRequest(
  bookingId: number,
  input: { boat_id: number; booking_date: string; start_time: string },
): Promise<OperatorNoShowIncident | null> {
  const response = await api<{ data: OperatorNoShowIncident | null }>(
    `/bookings/${bookingId}/no-show/reschedule-request`,
    {
      method: 'POST',
      body: input,
    },
  );
  return response.data ?? null;
}
