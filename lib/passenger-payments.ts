import { api } from '@/lib/api';
import type { TransactionPaymentStatus, TransactionPaymentType } from '@/lib/operator-transactions';

export type PassengerPayment = {
  id: string;
  payment_type: TransactionPaymentType;
  payment_type_label: string;
  amount_paid: number;
  amount_paid_label: string;
  payment_method_label: string | null;
  payment_status: TransactionPaymentStatus;
  payment_status_label: string;
  paid_at: string | null;
  paid_at_label: string | null;
  transaction_id: string | null;
  provider: string | null;
  sort_at: string | null;
  booking_id: number;
  booking_reference: string | null;
  booking_status: string | null;
  booking_status_label: string;
  boat_name: string | null;
  destination: string | null;
  rental_date_label: string | null;
  rental_time_label: string | null;
  rental_total: number;
  rental_total_label: string;
  booking_balance_due: number;
  booking_balance_due_label: string | null;
};

export type PassengerPaymentSummary = {
  total_paid: number;
  total_paid_label: string;
  paid_count: number;
  balance_due: number;
  balance_due_label: string;
  balance_due_count: number;
  pending_count: number;
  refunded: number;
  refunded_label: string;
};

export type PassengerPaymentHistory = {
  summary: PassengerPaymentSummary;
  payments: PassengerPayment[];
};

export async function fetchPassengerPaymentHistory(): Promise<PassengerPaymentHistory> {
  const response = await api<{ data: PassengerPaymentHistory }>('/payments/history');
  return response.data;
}

export function paymentTypeIcon(type: TransactionPaymentType) {
  switch (type) {
    case 'full':
      return 'checkmark-done-circle-outline' as const;
    case 'balance':
      return 'wallet-outline' as const;
    default:
      return 'card-outline' as const;
  }
}

export function paymentStatusHint(status: TransactionPaymentStatus): string | null {
  switch (status) {
    case 'pending':
      return 'Waiting for the barangay to confirm this payment.';
    case 'failed':
      return 'This payment did not go through. Open the rental to pay again.';
    case 'refunded':
      return 'This amount was refunded to you.';
    default:
      return null;
  }
}
