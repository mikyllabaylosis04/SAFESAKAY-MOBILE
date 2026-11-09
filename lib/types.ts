
export type OrganizationStatus = 'active' | 'pending' | 'archived' | 'suspended' | 'inactive';

export type Organization = {
  id: number;
  name: string;
  status?: OrganizationStatus | string;
  status_label?: string;
  allows_operations?: boolean;
  address?: string | null;
  contact_number?: string | null;
};

export type OperatorProfile = {
  full_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  age?: number | null;
  gender?: string | null;
  contact_number?: string | null;
  address?: string | null;
  experience_years?: number | null;
  emergency_contact_name?: string | null;
  emergency_contact_number?: string | null;
  picture_url?: string | null;
  boat_id?: number | null;
  boat_name?: string | null;
  boat_code?: string | null;
};

export type AuthUser = {
  id: number;
  name: string;
  username: string | null;
  email: string;
  address?: string | null;
  contact_number?: string | null;
  picture_url?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_number?: string | null;
  role: string;
  organization: Organization | null;
  operator?: OperatorProfile | null;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type RentalDestination = {
  id: number;
  destination: string;
  origin: string;
  name: string;
  rental_price?: number | null;
  rental_price_label?: string | null;
  down_payment_percent?: number | null;
  down_payment_percent_label?: string | null;
  down_payment_amount?: number | null;
  down_payment_amount_label?: string | null;
  remaining_balance?: number | null;
  remaining_balance_label?: string | null;
  location?: string | null;
  picture_url?: string | null;
  commission_enabled?: boolean;
  commission_percentage?: number;
  commission_percentage_label?: string | null;
  commission_amount?: number;
  commission_amount_label?: string | null;
  operator_net_amount?: number;
  operator_net_amount_label?: string | null;
  commission_included_in_total?: boolean;
};

export type Boat = {
  id: number;
  name: string;
  code: string;
  capacity: number;
  type: string;
  status: string;
  status_label: string;
  life_jacket_quantity: number | null;
  license_no?: string | null;
  registration_date_label?: string | null;
  safety_equipment?: string[];
  picture_url: string | null;
  picture_urls?: string[];
  open_for_booking: boolean;
  operator_name?: string | null;
  operator_user_id?: number | null;
  home_port?: string;
  can_update_status?: boolean;
  rental_destinations?: RentalDestination[];
  rating_average?: number | null;
  rating_count?: number;
};

export type BoatTimeSlot = {
  value: string;
  label: string;
  available: boolean;
  reason: string | null;
};

export type BoatAvailability = {
  date: string;
  day_available: boolean;
  day_booked?: boolean;
  day_reason: string | null;
  weather_tone?: 'red' | 'yellow' | null;
  weather_can_book?: boolean;
  times: BoatTimeSlot[];
};

export type BookingPassenger = {
  id?: number;
  full_name: string;
  age: number | string;
  gender: string;
  contact_number?: string | null;
};

export type RentalCancellationDisplay = {
  kind?: 'passenger_no_show' | 'weather_hold' | 'cancelled' | string;
  reason_label?: string;
  verification_label?: string | null;
  payment_status_label?: string | null;
  card_message?: string;
  list_message?: string;
  detail_message?: string;
  use_weather_message?: boolean;
};

export type RentalRefundRequestPayload = {
  id: number;
  reference?: string | null;
  type: 'passenger_cancellation' | 'operator_cancelled' | 'admin_cancelled' | 'operator_no_show';
  type_label: string;
  status: 'pending_review' | 'rejected' | 'awaiting_choice' | 'rescheduled' | 'refunding' | 'refunded' | 'failed';
  status_label: string;
  reason_label?: string | null;
  refund_amount_label: string | null;
  requested_amount_label?: string | null;
  rejection_reason?: string | null;
  requested_at_label: string | null;
  refunded_at_label: string | null;
};

export type MobileBooking = {
  id: number;
  kind?: 'booking' | 'regular_trip';
  role?: 'going' | 'returning';
  has_departure_time?: boolean;
  regular_trip_id?: number;
  rotation_order?: number;
  leave_order_label?: string;
  code: string;
  status:
    | 'pending'
    | 'awaiting_payment'
    | 'approved'
    | 'cancelled'
    | 'completed'
    | 'weather_hold'
    | 'reschedule_pending'
    | 'passenger_no_show';
  status_label: string;
  destination: string;
  pickup_point?: string | null;
  purpose: string | null;
  booking_date: string;
  booking_date_label: string;
  original_booking_date?: string | null;
  original_booking_date_label?: string | null;
  weather_hold?: boolean;
  weather_reason?: string | null;
  weather_reason_label?: string | null;
  reschedule_status?: string | null;
  requested_booking_date?: string | null;
  requested_booking_date_label?: string | null;
  no_show_reschedule_boat_name?: string | null;
  no_show_reschedule_boat_code?: string | null;
  no_show_reschedule_date_label?: string | null;
  no_show_reschedule_time_label?: string | null;
  reschedule_rejection_reason?: string | null;
  can_reschedule?: boolean;
  can_review_reschedule?: boolean;
  can_operator_respond_reschedule?: boolean;
  start_time: string;
  start_time_label: string;
  passenger_count: string;
  remarks: string | null;
  feedback?: {
    id: number;
    rating: number;
    tags: string[];
    comment: string | null;
    submitted_at_label?: string | null;
  } | null;
  rental_price?: number | null;
  rental_price_label?: string | null;
  down_payment_percent?: number | null;
  down_payment_percent_label?: string | null;
  down_payment_amount?: number | null;
  down_payment_amount_label?: string | null;
  remaining_balance?: number | null;
  remaining_balance_label?: string | null;
  payment_required?: boolean;
  can_pay?: boolean;
  can_verify_payment?: boolean;
  verify_payment_blocked_reason?: string | null;
  can_record_balance?: boolean;
  can_complete?: boolean;
  complete_settles_balance?: boolean;
  complete_blocked_reason?: string | null;
  can_report_operator_no_show?: boolean;
  can_mark_passenger_no_show?: boolean;
  can_choose_operator_no_show_resolution?: boolean;
  operator_no_show_report_pending?: boolean;
  operator_no_show_incident?: OperatorNoShowIncident | null;
  operator_no_show_resolution?: string | null;
  operator_no_show_resolution_label?: string | null;
  operator_no_show_grace_minutes?: number;
  operator_no_show_report_opens_at_label?: string | null;
  passenger_no_show_grace_minutes?: number;
  passenger_no_show_opens_at_label?: string | null;
  passenger_no_show_report?: PassengerNoShowReport | null;
  no_show_replacement_request?: {
    boat_name: string | null;
    requested_at_label: string | null;
    message: string;
  } | null;
  payment_status?: 'unpaid' | 'for_verification' | 'verified' | 'rejected';
  payment_status_label?: string | null;
  payment_submitted?: boolean;
  payment_rejection_reason?: string | null;
  payment_submitted_at?: string | null;
  payment_submitted_at_label?: string | null;
  payment_verified_at_label?: string | null;
  payment_receipt_url?: string | null;
  gcash_reference?: string | null;
  balance_status?: 'unpaid' | 'paid';
  balance_status_label?: string | null;
  balance_method?: string | null;
  balance_method_label?: string | null;
  balance_reference?: string | null;
  balance_paid_at_label?: string | null;
  completed_at?: string | null;
  completed_at_label?: string | null;
  completed_at_date_label?: string | null;
  completed_at_time_label?: string | null;
  created_at?: string | null;
  created_at_label?: string | null;
  created_at_time_label?: string | null;
  down_payment_method_label?: string | null;
  down_payment_recorded_at_label?: string | null;
  down_payment_recorded_at_kind?: 'verified' | 'submitted' | 'recorded' | null;
  paid_as_full_rental?: boolean;
  initial_payment_title?: string | null;
  initial_payment_amount?: number | null;
  initial_payment_amount_label?: string | null;
  balance_paid_amount?: number | null;
  balance_paid_amount_label?: string | null;
  total_paid?: number | null;
  total_paid_label?: string | null;
  gcash_account_name?: string | null;
  gcash_qr_url?: string | null;
  gcash_mobile_number?: string | null;
  overall_payment_status?: string | null;
  overall_payment_status_label?: string | null;
  commission?: {
    enabled: boolean;
    included_in_total?: boolean;
    percentage?: number;
    percentage_label?: string;
    amount?: number;
    amount_label?: string;
    operator_net?: number;
    operator_net_label?: string;
    note?: string | null;
  } | null;
  passenger?: {
    name?: string | null;
    full_name?: string | null;
    contact_number?: string | null;
  } | null;
  passengers?: BookingPassenger[];
  operator: {
    full_name: string;
    contact_number: string | null;
    address: string | null;
    picture_url: string | null;
  } | null;
  boat: {
    id: number;
    name: string;
    code: string;
    capacity?: number;
    license_no?: string | null;
    operator_name?: string | null;
    picture_url: string | null;
  };
  cancellation_display?: RentalCancellationDisplay | null;
  rental_card_message?: string | null;
  xendit?: OnlinePaymentPayload | null;
  online_payment?: OnlinePaymentPayload | null;
  rental_ui?: RentalUiHints | null;
  checkout_context?: RentalCheckoutContext | null;
  checkout_policy?: RentalCheckoutPolicyPayload | null;
  is_paid_rental?: boolean;
  /** Part of the payment above the non-refundable downpayment that a passenger cancellation refunds. */
  cancel_refund_amount_label?: string | null;
  can_choose_refund_or_reschedule?: boolean;
  is_paid_in_full?: boolean;
  paid_online_label?: string | null;
  can_passenger_cancel?: boolean;
  refund_request?: RentalRefundRequestPayload | null;
};

export type RentalCheckoutContext = {
  payment_receiver_name?: string;
  payment_receiver_label?: string;
  online_collection_note?: string | null;
  operator_name?: string | null;
  billed_to?: string | null;
};

export type RentalCheckoutPolicyPayload = {
  version: string;
  title: string;
  summary: string;
  sections: Array<{ heading: string; body: string }>;
  accepted?: boolean;
  accepted_at_label?: string | null;
};

export type OnlinePaymentPayload = {
  enabled: boolean;
  can_checkout?: boolean;
  can_full_rental_checkout?: boolean;
  can_balance_checkout?: boolean;
  checkout_path?: string | null;
  checkout_pending?: boolean;
  checkout_url?: string | null;
  checkout_session_id?: string | null;
  checkout_expires_at?: string | null;
  checkout_payment_type?: 'downpayment' | 'full_rental' | 'full_payment' | null;
  success_return_url?: string | null;
  checkout_policy_version?: string | null;
  message?: string | null;
  ledger_status?: string | null;
  ledger_status_label?: string | null;
  requires_reconciliation?: boolean;
  downpayment_method_label?: string | null;
  checkout_plans?: Partial<Record<'downpayment' | 'full_rental' | 'full_payment', XenditCheckoutPlan | null>>;
  payment_receipt?: XenditPaymentReceipt | null;
};

export type XenditCheckoutPlan = {
  payment_type: 'downpayment' | 'full_rental' | 'full_payment';
  title: string;
  payment_type_label?: string;
  down_payment_percent_label?: string | null;
  passenger_pays_minor?: number;
  passenger_pays_label: string;
  amount_to_pay_now_label?: string;
  rental_price_label: string;
  total_rental_commission_label?: string;
  operator_share_on_rental_label?: string;
  commission_label: string;
  operator_share_label: string;
  remaining_balance_label?: string;
  commission_included?: boolean;
  commission_percentage_label?: string | null;
};

export type XenditPaymentReceipt = {
  payment_type?: string | null;
  amount_label: string;
  provider_payment_id?: string | null;
  paid_at_label?: string | null;
  booking_code?: string | null;
};

export type RentalUiHints = {
  xendit_enabled?: boolean;
  online_payment_enabled?: boolean;
  down_payment_instruction?: string | null;
  awaiting_payment_banner_title?: string | null;
  awaiting_payment_banner_message?: string | null;
};

export type OperatorNoShowIncident = {
  report_id: number;
  booking_code: string;
  /** pending | verified | dismissed | delayed */
  status?: string;
  passenger_status: string;
  passenger_status_label: string;
  passenger_message: string;
  passenger_status_tone?: 'orange' | 'green' | 'red' | 'blue';
  reported_at_label?: string | null;
  rejection_reason?: string | null;
  refundable_downpayment_label?: string | null;
  refund_amount_label?: string | null;
  commission_deduction_label?: string | null;
  refund_gcash_account_name?: string | null;
  refund_gcash_mobile?: string | null;
  refund_status_label?: string | null;
  refund_reference?: string | null;
  refund_requested_at_label?: string | null;
  refund_processed_at_label?: string | null;
  refund_receipt_url?: string | null;
  preferred_booking_date_label?: string | null;
  preferred_start_time_label?: string | null;
  reschedule_boat_name?: string | null;
  reschedule_status_label?: string | null;
  can_choose_resolution?: boolean;
  can_submit_refund_request?: boolean;
  can_submit_reschedule_request?: boolean;
  choose_resolution_message?: string | null;
  report_reason?: OperatorNoShowReason | null;
  report_reason_label?: string | null;
  replacement_offer_status?: string | null;
  replacement_offer_label?: string | null;
  replacement_offer?: {
    boat_name: string | null;
    boat_code: string | null;
    boat_capacity: number | null;
    operator_name: string | null;
    booking_date_label: string | null;
    start_time_label: string | null;
    destination: string | null;
    price_change_label: string;
  } | null;
  can_accept_replacement?: boolean;
  can_operator_respond_replacement?: boolean;
  refund_via_xendit?: boolean;
  xendit_refund_status_label?: string | null;
};

export type OperatorNoShowReason = 'boat_not_arrived' | 'operator_not_arrived' | 'both_not_arrived';

export const OPERATOR_NO_SHOW_REASONS: { value: OperatorNoShowReason; label: string }[] = [
  { value: 'both_not_arrived', label: 'Boat operator did not arrive' },
];

export type PassengerNoShowReport = {
  id: number;
  status: string;
  status_label: string;
  cancellation_reason_label: string;
  reported_by_label: string;
  operator_name: string | null;
  boat_name: string | null;
  scheduled_departure_label: string | null;
  reported_at_label: string | null;
  operator_remarks: string | null;
  evidence_photo_url?: string | null;
  amount_paid_label: string;
  refund_status_label: string;
  dispute_status: string;
  dispute_status_label: string;
  dispute_deadline_at?: string | null;
  dispute_deadline_label?: string | null;
  dispute_window_days?: number;
  dispute_reason: string | null;
  disputed_at_label: string | null;
  resolution_notes: string | null;
  resolved_at_label: string | null;
  can_dispute: boolean;
};

export type RescheduleBoatOption = {
  id: number;
  name: string;
  code: string;
  capacity: number;
  picture_url: string | null;
  rental_price_label: string;
};

export type CreateBookingInput = {
  boat_id: number;
  destination: string;
  pickup_point: string;
  purpose?: string;
  booking_date: string;
  start_time: string;
  passenger_count: number;
  remarks?: string;
  contact_number: string;
};

export type MobileNotice = {
  id: string;
  kind: 'booking' | 'system' | 'announcement' | 'emergency';
  event: string;
  booking_id: number | null;
  title: string;
  body: string;
  unread: boolean;
  created_at: string;
  group: string;
};

export const FALLBACK_BARANGAYS: Organization[] = [
  { id: 3, name: 'BARANGAY LAKANDULA' },
];

export function pickLakandula(areas: Organization[]): Organization | undefined {
  return areas.find((item) => /lakandula/i.test(item.name)) ?? areas[0];
}

export function availableServiceAreas(areas: Organization[]): Organization[] {
  const unique = [...new Map(
    areas
      .filter((item) => Number.isFinite(item.id) && item.name.trim() !== '')
      .map((item) => [item.id, item] as const),
  ).values()];

  unique.sort((a, b) => {
    const rank = (name: string) => (/lakandula/i.test(name) ? 0 : 1);

    return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name);
  });

  return unique.length > 0 ? unique : FALLBACK_BARANGAYS;
}

export function normalizeAreaName(name: string): string {
  return name.toLowerCase().replace(/^barangay\s+/, '').replace(/\s+/g, ' ').trim();
}

function compactAreaName(name: string): string {
  return normalizeAreaName(name).replace(/[^a-z0-9]/g, '');
}

export function matchOrganizationFromAddress(
  areas: Organization[],
  parts: { address?: string | null; barangay?: string | null },
): Organization | undefined {
  const named = areas.map((item) => ({ item, key: compactAreaName(item.name) })).filter(({ key }) => key.length > 0);
  const exact = (value: string) => named.find(({ key }) => key === compactAreaName(value))?.item;

  if (parts.barangay) {
    const match = exact(parts.barangay);
    if (match) {
      return match;
    }
  }

  const address = parts.address ?? '';
  if (!address.trim()) {
    return undefined;
  }

  for (const segment of address.split(',')) {
    const match = exact(segment);
    if (match) {
      return match;
    }
  }

  const compactAddress = compactAreaName(address);
  return named.find(({ key }) => key.length >= 4 && compactAddress.includes(key))?.item;
}
