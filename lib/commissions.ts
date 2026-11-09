import { api, apiUpload } from '@/lib/api';

export type CommissionStatus =
  | 'pending_settlement'
  | 'awaiting_verification'
  | 'paid'
  | 'rejected'
  | 'overdue'
  | 'waived'
  | 'collected_with_rental';

export type OperatorCommission = {
  id: number;
  code: string | null;
  boat_id?: number | null;
  boat_name: string | null;
  rental_date: string | null;
  rental_date_label: string | null;
  rental_amount: number;
  rental_amount_label: string;
  commission_percentage: number;
  commission_percentage_label: string;
  commission_amount: number;
  commission_amount_label: string;
  operator_net_amount: number;
  operator_net_amount_label?: string | null;
  status: CommissionStatus;
  status_label: string;
  paid_out?: boolean;
  paid_at_label?: string | null;
  gcash_reference: string | null;
  rejection_reason: string | null;
  can_submit: boolean;
  barangay_gcash_account_name: string | null;
  barangay_gcash_qr_url: string | null;
  proof_url: string | null;
};

export function needsCommissionSettlement(item: OperatorCommission): boolean {
  return item.status === 'pending_settlement' || item.status === 'rejected';
}

export function commissionAgeDays(item: OperatorCommission, now = new Date()): number {
  const value = (item.rental_date ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return 0;
  }

  const [year, month, day] = value.split('-').map(Number);
  const start = new Date(year, month - 1, day).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.round((today - start) / 86400000));
}

export function isCommissionOverdue(item: OperatorCommission): boolean {
  return needsCommissionSettlement(item) && commissionAgeDays(item) >= 1;
}

export function unpaidCommissions(items: OperatorCommission[]): OperatorCommission[] {
  return items.filter(needsCommissionSettlement);
}

export function isCommissionPaidOut(item: OperatorCommission): boolean {
  return Boolean(item.paid_out) || item.status === 'paid' || item.status === 'collected_with_rental';
}

export function paidCommissions(items: OperatorCommission[]): OperatorCommission[] {
  return items.filter(isCommissionPaidOut);
}

export async function fetchCommissions(): Promise<OperatorCommission[]> {
  const response = await api<{ data: OperatorCommission[] }>('/commissions');
  return response.data;
}

export async function submitCommissionSettlement(
  id: number,
  input: { gcash_reference: string; uri: string; mime?: string; name?: string },
): Promise<OperatorCommission> {
  const response = await apiUpload<{ data: OperatorCommission }>(`/commissions/${id}/settle`, {
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
