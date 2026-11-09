import { api, apiUpload } from '@/lib/api';

export type OperatorGcashStatus =
  | 'not_registered'
  | 'pending_approval'
  | 'approved'
  | 'rejected';

export type OperatorGcashRecord = {
  id: number;
  account_name: string;
  mobile_number: string;
  qr_url: string | null;
  status: Exclude<OperatorGcashStatus, 'not_registered'>;
  status_label: string;
  submitted_at?: string | null;
  submitted_at_label?: string | null;
  updated_at?: string | null;
};

export type OperatorGcashPayload = {
  status: OperatorGcashStatus;
  status_label: string;
  can_approve: boolean;
  form: OperatorGcashRecord | null;
  pending: OperatorGcashRecord | null;
  approved: OperatorGcashRecord | null;
  rejected: OperatorGcashRecord | null;
};

export async function fetchOperatorGcash(): Promise<OperatorGcashPayload> {
  const response = await api<{ data: OperatorGcashPayload }>('/operator/gcash');
  return response.data;
}

export async function saveOperatorGcash(input: {
  account_name: string;
  mobile_number: string;
  uri?: string | null;
  mime?: string;
  name?: string;
}): Promise<{ message: string; data: OperatorGcashPayload }> {
  return apiUpload<{ message: string; data: OperatorGcashPayload }>('/operator/gcash', {
    fileUri: input.uri,
    fieldName: 'qr',
    mime: input.mime,
    name: input.name,
    fields: {
      account_name: input.account_name,
      mobile_number: input.mobile_number,
    },
  });
}
