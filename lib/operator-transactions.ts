import { api } from '@/lib/api';

export type TransactionPeriod = 'this_month' | 'last_month' | 'all';

export type TransactionPaymentType = 'full' | 'downpayment' | 'balance';

export type TransactionPaymentStatus = 'verified' | 'pending' | 'failed' | 'refunded' | 'awaiting';

export type TransactionPayoutStatus = 'on_hold' | 'ready_for_payout' | 'processing' | 'paid_out' | 'cancelled';

export type OperatorTransaction = {
  id: string;
  payment_type: TransactionPaymentType;
  payment_type_label: string;
  amount_paid: number;
  amount_paid_label: string;
  payment_method_label: string | null;
  received_by_label?: string | null;
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
  passenger_name: string;
  boat_name: string | null;
  rental_date: string | null;
  rental_date_label: string | null;
  rental_time_label: string | null;
  rental_total: number;
  rental_total_label: string;
  remaining_balance: number;
  remaining_balance_label: string;
  commission_rate: number;
  commission_rate_label: string;
  carries_commission: boolean;
  commission_deducted: number | null;
  commission_deducted_label: string | null;
  operator_share: number | null;
  operator_share_label: string | null;
  booking_commission: number;
  booking_operator_net: number;
  commission_reversed: boolean;
  earnings_basis: string | null;
  payout_status: TransactionPayoutStatus | null;
  payout_label: string | null;
  payout_at: string | null;
  payout_at_label: string | null;
};

export type EarningsSummary = {
  period: TransactionPeriod;
  period_label: string;
  verified_payments: number;
  verified_payments_label: string;
  commission_deducted: number;
  commission_deducted_label: string;
  net_earnings: number;
  net_earnings_label: string;
  payouts_received: number | null;
  payouts_received_label: string | null;
  payouts_received_count: number;
  awaiting_payout_count: number;
  processing_payout_count: number;
  on_hold_payout_count: number;
  failed_payout_count: number;
  formula: string;
};

export type OperatorTransactionsPayload = {
  period: TransactionPeriod;
  summary: EarningsSummary;
  transactions: OperatorTransaction[];
};

export type TransactionBooking = {
  id: number;
  reference: string | null;
  status: string | null;
  status_label: string;
  passenger_name: string;
  passenger_contact: string | null;
  boat_name: string | null;
  operator_name: string | null;
  rental_type: string | null;
  origin: string | null;
  destination: string | null;
  passenger_count: number | null;
  rental_date_label: string | null;
  departure_time_label: string | null;
  rental_price_label: string;
  approved_at_label: string | null;
};

export type TransactionEarnings = {
  rental_total: number;
  rental_total_label: string;
  verified_paid: number;
  verified_paid_label: string;
  remaining_balance: number;
  remaining_balance_label: string;
  commission_rate: number;
  commission_rate_label: string;
  commission_deducted: number;
  commission_deducted_label: string;
  operator_net: number;
  operator_net_label: string;
  recorded_operator_net_label: string;
  basis: string | null;
  reversed: boolean;
  payout_status: TransactionPayoutStatus | null;
  payout_label: string | null;
  payout_at_label: string | null;
  payout_reference: string | null;
};

export type TransactionTimelineStep = {
  label: string;
  at_label: string;
};

export type OperatorTransactionDetail = {
  booking: TransactionBooking;
  payments: OperatorTransaction[];
  earnings: TransactionEarnings;
  timeline: TransactionTimelineStep[];
  receipt_available: boolean;
  receipt_url: string | null;
};

export async function fetchOperatorTransactions(period: TransactionPeriod): Promise<OperatorTransactionsPayload> {
  const response = await api<{ data: OperatorTransactionsPayload }>(`/operator/transactions?period=${period}`);
  return response.data;
}

export async function fetchOperatorTransaction(bookingId: number): Promise<OperatorTransactionDetail> {
  const response = await api<{ data: OperatorTransactionDetail }>(`/operator/transactions/${bookingId}`);
  return response.data;
}

export function paymentStatusLook(status: TransactionPaymentStatus, isDark: boolean) {
  switch (status) {
    case 'verified':
      return { color: '#1FA971', bg: isDark ? '#163528' : '#DFF6EA' };
    case 'pending':
      return { color: '#F07A3A', bg: isDark ? '#3D2A1C' : '#FDE8DC' };
    case 'failed':
      return { color: '#E25C5C', bg: isDark ? '#3A2224' : '#FDECEC' };
    case 'refunded':
      return { color: '#7A5AF8', bg: isDark ? '#2B2448' : '#F0ECFF' };
    default:
      return { color: '#64748B', bg: isDark ? '#243044' : '#EEF1F6' };
  }
}

export function payoutStatusLook(status: TransactionPayoutStatus | null, isDark: boolean) {
  switch (status) {
    case 'paid_out':
      return { color: '#1FA971', bg: isDark ? '#163528' : '#DFF6EA' };
    case 'processing':
      return { color: '#1A5AD7', bg: isDark ? '#1B2C4D' : '#E8F1FF' };
    case 'ready_for_payout':
      return { color: '#F07A3A', bg: isDark ? '#3D2A1C' : '#FDE8DC' };
    case 'cancelled':
      return { color: '#E25C5C', bg: isDark ? '#3A2224' : '#FDECEC' };
    default:
      return { color: '#64748B', bg: isDark ? '#243044' : '#EEF1F6' };
  }
}
