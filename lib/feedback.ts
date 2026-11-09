import { api } from '@/lib/api';

export type TripFeedback = {
  bookingId: number;
  rating: number;
  tags: string[];
  comment: string;
  submittedAt: string;
};

type FeedbackPayload = {
  id: number;
  booking_id: number;
  rating: number;
  tags: string[];
  comment: string | null;
  submitted_at: string | null;
};

function fromPayload(payload: FeedbackPayload): TripFeedback {
  return {
    bookingId: payload.booking_id,
    rating: payload.rating,
    tags: payload.tags ?? [],
    comment: payload.comment ?? '',
    submittedAt: payload.submitted_at ?? new Date().toISOString(),
  };
}

export async function getFeedback(bookingId: number): Promise<TripFeedback | null> {
  const response = await api<{ data: FeedbackPayload | null }>(`/bookings/${bookingId}/feedback`);
  return response.data ? fromPayload(response.data) : null;
}

export async function hasFeedback(bookingId: number): Promise<boolean> {
  try {
    return Boolean(await getFeedback(bookingId));
  } catch {
    return false;
  }
}

export async function saveFeedback(input: Omit<TripFeedback, 'submittedAt'>): Promise<TripFeedback> {
  const response = await api<{ data: FeedbackPayload }>(`/bookings/${input.bookingId}/feedback`, {
    method: 'POST',
    body: {
      rating: input.rating,
      tags: input.tags,
      comment: input.comment,
    },
  });

  return fromPayload(response.data);
}
