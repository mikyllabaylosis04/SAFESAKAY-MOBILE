import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ImageSourceSheet } from '@/components/image-source-sheet';
import { formatTripDate, TripCalendarModal } from '@/components/trip-calendar-modal';
import { ApiError, friendlyError } from '@/lib/api';
import { chooseProofFromGallery, takeProofPhoto, type PickedImage } from '@/lib/pick-image';
import { fetchDayHolds, type DayWeatherMark } from '@/lib/weather';
import { fetchCurrentUser, getStoredUser } from '@/lib/auth';
import { organizationAllowsOperations } from '@/lib/organization-access';
import { downloadBookingSlip } from '@/lib/booking-slip';
import {
  fetchBooking,
  markPassengerNoShow,
  rejectPayment,
  requestReschedule,
  reviewReschedule,
  submitPaymentProof,
  updateBookingStatus,
  cancelBookingAsPassenger,
  chooseRefundOrReschedule,
  normalizeBooking,
  verifyPayment,
} from '@/lib/bookings';
import { disputePassengerNoShow, respondNoShowReplacement } from '@/lib/no-show';
import { getApiBaseUrl, resolveMediaUrl } from '@/lib/config';
import {
  canOperatorMarkPassengerNoShowLocal,
  canPassengerReportOperatorNoShow,
  isPassengerNoShowWaiting,
  isTripDayOrAfter,
  passengerName,
  passengerNoShowOpensAtLabel,
  passengerPhone,
} from '@/lib/operator';
import { isOperator } from '@/lib/roles';
import { PaymentStepper } from '@/components/payment-stepper';
import {
  RentalXenditPaymentPanel,
  type XenditPaymentPlan,
} from '@/components/rental-xendit-payment-panel';
import { hasFeedback } from '@/lib/feedback';
import { getToken } from '@/lib/session';
import { useAppTheme } from '@/lib/theme';
import { modal, MODAL_COLORS } from '@/lib/modal-theme';
import { isWeatherCancelledRental, passengerNoShowDetailCopy } from '@/lib/rental-cancellation-display';
import type { AuthUser, MobileBooking, OnlinePaymentPayload } from '@/lib/types';

const BLUE = '#1A5AD7';
const GREEN = '#1FA971';
const ORANGE = '#F07A3A';
const VIOLET = '#7A5AF8';
const RED = '#E25C5C';
const ICON_BG = '#E8F1FF';
const CANCEL_REASONS = [
  'Family or Personal Emergency',
  'Illness or Medical Reason',
  'Weather or Safety Concern',
  'Schedule Conflict',
  'Change of Plans',
  'Operator Unavailability',
  'Boat or Mechanical Issue',
];
const FALLBACK_BOAT =
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80';

function onlinePaymentFor(booking: MobileBooking | null): OnlinePaymentPayload | null {
  if (!booking) {
    return null;
  }

  return booking.xendit ?? booking.online_payment ?? null;
}

const REJECT_REASONS = [
  'Invalid or fake receipt',
  'Incorrect amount',
  'No matching transaction',
  'Payment to wrong account',
  'Unclear receipt',
  'Other',
];

function needsPassengerNoShowChoice(booking: MobileBooking) {
  return Boolean(booking.can_choose_operator_no_show_resolution);
}

function hasOpenOperatorNoShow(booking: MobileBooking) {
  return Boolean(
    booking.operator_no_show_report_pending ||
      booking.can_choose_operator_no_show_resolution ||
      booking.operator_no_show_incident,
  );
}

function statusLook(booking: MobileBooking) {
  if (needsPassengerNoShowChoice(booking)) {
    return { label: 'Choose help', color: ORANGE, bg: '#FDE8DC' };
  }
  if (booking.operator_no_show_report_pending) {
    return { label: 'Checking report', color: ORANGE, bg: '#FDE8DC' };
  }
  if (booking.status === 'passenger_no_show') {
    return { label: 'Passenger No-Show', color: RED, bg: '#FDECEC' };
  }
  if (booking.status === 'reschedule_pending' || booking.can_review_reschedule) {
    return { label: 'Reschedule', color: VIOLET, bg: '#EEE8FF' };
  }
  if (booking.status === 'weather_hold' || isWeatherCancelledRental(booking)) {
    return { label: 'Cancelled · Weather', color: RED, bg: '#FDECEC' };
  }
  if (booking.status === 'awaiting_payment' && booking.payment_status === 'for_verification') {
    return { label: 'For Verification', color: BLUE, bg: '#E8F1FF' };
  }
  if (booking.status === 'approved') {
    return { label: 'Confirmed', color: GREEN, bg: '#DFF6EA' };
  }
  if (booking.status === 'awaiting_payment') {
    return { label: 'Awaiting Payment', color: BLUE, bg: '#E8F1FF' };
  }
  if (booking.status === 'completed') {
    return { label: 'Completed', color: GREEN, bg: '#DFF6EA' };
  }
  if (booking.status === 'cancelled') {
    return { label: 'Cancelled', color: RED, bg: '#FDECEC' };
  }
  return { label: 'Pending', color: ORANGE, bg: '#FDE8DC' };
}

function manilaYmd(daysFromToday = 0) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  const date = new Date(Date.UTC(year, month - 1, day + daysFromToday));
  return date.toISOString().slice(0, 10);
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { colors, isDark } = useAppTheme();

  return (
    <View style={styles.infoTile}>
      <View style={[styles.iconBadge, { backgroundColor: isDark ? colors.iconBg : ICON_BG }]}>
        <Ionicons name={icon} size={16} color={colors.blue} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={[styles.infoLabel, { color: colors.muted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.navy }]}>{value}</Text>
      </View>
    </View>
  );
}

function bookingSubmittedLabel(booking: MobileBooking) {
  if (booking.created_at_label && booking.created_at_time_label) {
    return `${booking.created_at_label} · ${booking.created_at_time_label}`;
  }
  return booking.created_at_label || '—';
}

function downPaymentWhenCaption(booking: MobileBooking) {
  if (booking.down_payment_recorded_at_kind === 'verified') {
    return 'Verified on';
  }
  if (booking.down_payment_recorded_at_kind === 'submitted') {
    return 'Submitted on';
  }
  if (booking.down_payment_recorded_at_kind === 'recorded') {
    return 'Recorded on';
  }
  return 'Payment date & time';
}

function PayStatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={[styles.payChip, { backgroundColor: ok ? '#DFF6EA' : '#F3F7FF' }]}>
      <Text style={[styles.payChipText, { color: ok ? GREEN : BLUE }]}>{label}</Text>
    </View>
  );
}

export default function BookingDetailsScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const focusedInputRef = useRef<View | null>(null);
  const payRefWrapRef = useRef<View>(null);
  const rescheduleWrapRef = useRef<View>(null);
  const scrollY = useRef(0);
  const keyboardHeightRef = useRef(0);
  const keyboardTopRef = useRef(0);
  const params = useLocalSearchParams<{
    id?: string;
    bookingId?: string;
    xenditReturn?: string;
    confirm?: string;
  }>();
  const bookingId = Number(params.id || params.bookingId);
  const [booking, setBooking] = useState<MobileBooking | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeText, setDisputeText] = useState('');
  const [disputing, setDisputing] = useState(false);
  const [passengerNoShowRemarks, setPassengerNoShowRemarks] = useState('');
  const [passengerNoShowDeclared, setPassengerNoShowDeclared] = useState(false);
  const [passengerNoShowPhoto, setPassengerNoShowPhoto] = useState<PickedImage | null>(null);
  const [passengerNoShowSourceOpen, setPassengerNoShowSourceOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [gcashReference, setGcashReference] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejectPickerOpen, setRejectPickerOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduleCalendarOpen, setRescheduleCalendarOpen] = useState(false);
  const [choiceCalendarOpen, setChoiceCalendarOpen] = useState(false);
  const [rescheduleHolds, setRescheduleHolds] = useState<Record<string, DayWeatherMark>>({});
  const rescheduleHoldsFetched = useRef<Set<string>>(new Set());
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState('');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [previewImage, setPreviewImage] = useState<{
    uri: string;
    headers?: Record<string, string>;
  } | null>(null);
  const [paymentSubmittedOpen, setPaymentSubmittedOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<
    'verify' | 'complete' | 'passenger_no_show' | 'operator_no_show' | null
  >(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [completeNotice, setCompleteNotice] = useState('');
  const [rated, setRated] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(manilaYmd(1));
  const [rescheduleReview, setRescheduleReview] = useState<'approve' | 'reject' | null>(null);
  const [rescheduleRejectReason, setRescheduleRejectReason] = useState('');
  const operatorView = isOperator(user);

  function scrollFocusedAboveKeyboard() {
    const node = focusedInputRef.current;
    const keyboardTop =
      keyboardTopRef.current || Dimensions.get('window').height - keyboardHeightRef.current;
    if (!node || keyboardHeightRef.current <= 0) {
      return;
    }

    node.measureInWindow((_x, y, _width, height) => {
      const overflow = y + height + 28 - keyboardTop;
      if (overflow > 0) {
        scrollRef.current?.scrollTo({
          y: Math.max(0, scrollY.current + overflow),
          animated: true,
        });
      }
    });
  }

  function handleInputFocus(node: View | null) {
    focusedInputRef.current = node;
    setTimeout(() => scrollFocusedAboveKeyboard(), 50);
    setTimeout(() => scrollFocusedAboveKeyboard(), 180);
  }

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
      keyboardHeightRef.current = event.endCoordinates.height;
      keyboardTopRef.current = event.endCoordinates.screenY;
      setKeyboardHeight(event.endCoordinates.height);
      setTimeout(() => scrollFocusedAboveKeyboard(), 80);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      keyboardHeightRef.current = 0;
      keyboardTopRef.current = 0;
      setKeyboardHeight(0);
    });
    const tick = setInterval(() => setNowTick(Date.now()), 15000);
    return () => {
      show.remove();
      hide.remove();
      clearInterval(tick);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!bookingId) {
        return;
      }
      hasFeedback(bookingId).then(setRated);
      fetchBooking(bookingId)
        .then(setBooking)
        .catch(() => undefined);
    }, [bookingId]),
  );

  useEffect(() => {
    getStoredUser().then(setUser);
    fetchCurrentUser().then((next) => {
      if (!next) {
        return;
      }
      setUser(next);
      if (isOperator(next) && !organizationAllowsOperations(next)) {
        router.replace('/organization-inactive');
      }
    });
    getToken().then(setAuthToken);

    if (!bookingId) {
      setLoading(false);
      return;
    }

    fetchBooking(bookingId)
      .then(setBooking)
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  }, [bookingId]);

  useEffect(() => {
    if (params.xenditReturn !== 'verify' || !bookingId) {
      return;
    }

    void fetchBooking(bookingId).then((loaded) => {
      const plan = onlinePaymentFor(loaded)?.checkout_payment_type ?? 'downpayment';
      router.replace({ pathname: '/xendit-checkout', params: { id: String(bookingId), verify: '1', plan } });
    });
  }, [bookingId, params.xenditReturn, router]);

  useEffect(() => {
    if (params.confirm !== 'passenger_no_show' || !booking) {
      return;
    }
    if (!canOperatorMarkPassengerNoShowLocal(booking, nowTick)) {
      return;
    }
    setConfirmKind('passenger_no_show');
    router.setParams({ confirm: undefined });
  }, [booking, nowTick, params.confirm, router]);

  const tripReady = Boolean(booking && isTripDayOrAfter(booking));
  const approved = booking?.status === 'approved';
  const awaitingPayment = booking?.status === 'awaiting_payment';
  const completed = booking?.status === 'completed';
  const passengerNoShow = booking?.status === 'passenger_no_show';
  const cancelled = booking?.status === 'cancelled';
  const weatherHold = Boolean(
    booking &&
      booking.status !== 'passenger_no_show' &&
      (booking.status === 'weather_hold' || isWeatherCancelledRental(booking)),
  );
  const reschedulePending = booking?.status === 'reschedule_pending';
  const operatorNoShowReschedulePending = Boolean(
    booking?.no_show_reschedule_boat_name &&
      (reschedulePending || booking?.can_operator_respond_reschedule),
  );
  const canReschedule = Boolean(!operatorView && booking?.can_reschedule);
  const canReviewReschedule = Boolean(
    operatorView &&
      (booking?.can_operator_respond_reschedule ||
        (booking?.can_review_reschedule && !booking?.no_show_reschedule_boat_name)),
  );
  const pending = booking?.status === 'pending';
  const confirmed = approved || completed;
  const canPay = Boolean(!operatorView && booking?.can_pay && awaitingPayment && booking.payment_required);
  const onlinePay = onlinePaymentFor(booking);
  const xenditCheckoutOpen = Boolean(
    onlinePay?.enabled && onlinePay.checkout_pending && onlinePay.checkout_url,
  );
  const canXenditDownpayment = Boolean(
    !operatorView &&
      awaitingPayment &&
      onlinePay?.enabled &&
      (onlinePay.can_checkout || xenditCheckoutOpen),
  );
  /** Server has Xendit on — down payment uses hosted GCash only (no barangay QR / receipt upload). */
  const onlineDownPaymentOnly = Boolean(!operatorView && awaitingPayment && onlinePay?.enabled);
  const awaitingOperatorVerification = Boolean(
    booking?.payment_status === 'for_verification' && awaitingPayment,
  );
  const paymentRejected = booking?.payment_status === 'rejected';
  const paidVerified = booking?.payment_status === 'verified';
  const paidInFull = Boolean(
    booking?.is_paid_in_full ??
      (paidVerified && (booking?.balance_status === 'paid' || Number(booking?.remaining_balance ?? 1) <= 0)),
  );
  /** Cancel only before trip day; on trip day the Cancel button is hidden. */
  const canPassengerCancelBeforeTrip = Boolean(
    !operatorView &&
      booking &&
      booking.can_passenger_cancel !== false &&
      !isTripDayOrAfter(booking) &&
      !hasOpenOperatorNoShow(booking),
  );
  const canCancelAwaiting = Boolean(
    awaitingPayment && booking?.payment_status !== 'verified' && canPassengerCancelBeforeTrip,
  );
  const canCancelPending = Boolean(pending && canPassengerCancelBeforeTrip);
  const canCancelConfirmed = Boolean(approved && canPassengerCancelBeforeTrip);
  const refundRequest = !operatorView ? booking?.refund_request ?? null : null;
  const canChooseRefund = !operatorView && Boolean(booking?.can_choose_refund_or_reschedule);
  const rentalConfirmedNotice = Boolean(
    !operatorView &&
      approved &&
      booking?.payment_status === 'verified' &&
      booking &&
      !hasOpenOperatorNoShow(booking),
  );
  const completedRecord = Boolean(completed);
  const hideTripReminders = Boolean(
    booking &&
      (needsPassengerNoShowChoice(booking) ||
        booking.operator_no_show_report_pending ||
        completedRecord),
  );
  const photo = resolveMediaUrl(booking?.boat.picture_url) || FALLBACK_BOAT;
  const operatorPhoto = resolveMediaUrl(booking?.operator?.picture_url);
  const phone = booking?.operator?.contact_number?.replace(/[^\d+]/g, '') ?? '';
  const riderPhone = booking ? passengerPhone(booking)?.replace(/[^\d+]/g, '') ?? '' : '';
  const look = booking ? statusLook(booking) : null;
  const receiptSource =
    booking?.payment_receipt_url && authToken
      ? {
          uri: `${getApiBaseUrl()}${booking.payment_receipt_url}`,
          headers: { Authorization: `Bearer ${authToken}` },
        }
      : null;

  function openBoatInfo() {
    if (!booking) {
      return;
    }
    router.push({
      pathname: '/boat-info',
      params: { id: String(booking.boat.id), bookingId: String(booking.id) },
    });
  }

  async function contactNumber(raw: string, missingTitle: string, missingBody: string) {
    if (!raw) {
      Alert.alert(missingTitle, missingBody);
      return;
    }

    const url = `tel:${raw}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Cannot call', raw);
      return;
    }
    await Linking.openURL(url);
  }

  async function contactOperator() {
    await contactNumber(phone, 'No contact number', 'The operator has no phone number on file yet.');
  }

  async function contactPassenger() {
    await contactNumber(
      riderPhone,
      'No contact number',
      'The passenger has no phone number on file yet.',
    );
  }

  const loadRescheduleHolds = useCallback(
    (dates: string[]) => {
      const boatId = booking?.boat.id;
      if (!boatId) {
        return;
      }
      const missing = dates.filter((date) => date && !rescheduleHoldsFetched.current.has(date));
      if (missing.length === 0) {
        return;
      }
      missing.forEach((date) => rescheduleHoldsFetched.current.add(date));
      fetchDayHolds(boatId, missing)
        .then((holds) => setRescheduleHolds((current) => ({ ...current, ...holds })))
        .catch(() => undefined);
    },
    [booking?.boat.id],
  );

  function confirmCancelRental() {
    setCancelReason('');
    setCancelReasonError('');
    setCancelOpen(true);
  }

  async function confirmCancelAndClose() {
    if (operatorView) {
      setCancelOpen(false);
      await changeStatus('cancelled');
      return;
    }

    if (!booking) {
      return;
    }

    const reason = cancelReason.trim();
    if (reason.length < 3) {
      setCancelReasonError('Please choose or type a reason.');
      return;
    }

    setUpdating(true);
    try {
      const updated = await cancelBookingAsPassenger(booking.id, reason);
      setCancelOpen(false);
      router.push({
        pathname: '/rental-result',
        params: { type: 'cancelled', code: updated.code },
      });
    } catch (err) {
      setCancelReasonError(friendlyError(err, 'Could not cancel this rental. Please try again.'));
    } finally {
      setUpdating(false);
    }
  }

  function submitRefundChoice(choice: 'refund' | 'reschedule', bookingDate?: string) {
    if (!booking) {
      return;
    }
    setUpdating(true);
    chooseRefundOrReschedule(booking.id, choice, bookingDate)
      .then((updated) => {
        setBooking(updated);
        Alert.alert(
          choice === 'refund' ? 'Refund requested' : 'New date requested',
          choice === 'refund'
            ? updated.refund_request?.status === 'refunded'
              ? 'Your payment was refunded to your GCash.'
              : 'Your refund is being sent to your GCash. You will be notified once it is done.'
            : 'Your new date is waiting for approval. You will be notified once it is confirmed.',
        );
      })
      .catch((err) => Alert.alert('Could not continue', friendlyError(err, 'Please try again.')))
      .finally(() => setUpdating(false));
  }

  function confirmFullRefund() {
    Alert.alert(
      'Get a full refund?',
      `${booking?.refund_request?.refund_amount_label ?? 'Your payment'} will be sent back to the GCash account you paid with.`,
      [
        { text: 'Back', style: 'cancel' },
        { text: 'Refund me', onPress: () => submitRefundChoice('refund') },
      ],
    );
  }

  async function submitReschedule() {
    if (!booking) {
      return;
    }

    setUpdating(true);
    try {
      const updated = await requestReschedule(booking.id, rescheduleDate);
      setBooking(updated);
      Alert.alert(
        'Reschedule requested',
        'Your new date was sent to the boat operator. Your down payment stays with this rental.',
      );
    } catch (err) {
      Alert.alert(
        'Could not reschedule',
        err instanceof ApiError
          ? err.firstError()
          : 'Pick a future date that is not under a weather advisory.',
      );
    } finally {
      setUpdating(false);
    }
  }

  async function submitRescheduleReview(action: 'approve' | 'reject') {
    if (!booking) {
      return;
    }
    const reason = rescheduleRejectReason.trim();
    if (action === 'reject' && reason.length < 5) {
      return;
    }
    setUpdating(true);
    try {
      const updated = await reviewReschedule(booking.id, action, {
        reason,
      });
      setBooking(updated);
      setRescheduleReview(null);
      setRescheduleRejectReason('');
    } catch (err) {
      Alert.alert(
        action === 'approve' ? 'Could not approve date' : 'Could not decline date',
        err instanceof ApiError ? err.firstError() : 'Please try again.',
      );
    } finally {
      setUpdating(false);
    }
  }

  async function changeStatus(status: 'approved' | 'cancelled' | 'completed') {
    if (!booking) {
      return;
    }
    if (status === 'completed' && !isTripDayOrAfter(booking)) {
      setCompleteNotice('Done is available on the rental date or after the trip.');
      return;
    }

    setUpdating(true);
    try {
      const updated = await updateBookingStatus(booking.id, status);
      if (!operatorView && status === 'cancelled') {
        router.push({
          pathname: '/rental-result',
          params: { type: 'cancelled', code: updated.code },
        });
        return;
      }
      setBooking(updated);
      if (status === 'approved') {
        setJustConfirmed(true);
      }
    } catch (err) {
      Alert.alert(
        'Could not update request',
        err instanceof ApiError
          ? err.firstError()
          : 'Could not update this rental. Please try again.',
      );
    } finally {
      setUpdating(false);
    }
  }

  async function runPassengerNoShow() {
    if (!booking) {
      return;
    }
    setUpdating(true);
    try {
      const updated = await markPassengerNoShow(booking.id, {
        note: passengerNoShowRemarks,
        uri: passengerNoShowPhoto?.uri,
        mime: passengerNoShowPhoto?.mime,
        name: passengerNoShowPhoto?.name,
      });
      setBooking(updated);
      setPassengerNoShowRemarks('');
      setPassengerNoShowDeclared(false);
      setPassengerNoShowPhoto(null);
    } catch (err) {
      setCompleteNotice(err instanceof ApiError ? err.firstError() : 'Could not mark passenger no-show.');
    } finally {
      setUpdating(false);
    }
  }

  async function submitDispute() {
    if (!booking || disputeText.trim().length < 10) {
      return;
    }
    setDisputing(true);
    try {
      const updated = await disputePassengerNoShow(booking.id, disputeText);
      setBooking(normalizeBooking(updated));
      setDisputeOpen(false);
      setDisputeText('');
      Alert.alert('Dispute sent', 'The barangay will review your dispute and notify you of the decision.');
    } catch (err) {
      Alert.alert('Could not send dispute', err instanceof ApiError ? err.firstError() : 'Please try again.');
    } finally {
      setDisputing(false);
    }
  }

  function respondReplacement(accept: boolean) {
    if (!booking) {
      return;
    }
    const run = async (reason?: string) => {
      setUpdating(true);
      try {
        const updated = await respondNoShowReplacement(booking.id, accept, reason);
        setBooking(normalizeBooking(updated));
        Alert.alert(
          accept ? 'Replacement accepted' : 'Request declined',
          accept
            ? 'The passenger will be asked to confirm the replacement. You will be notified.'
            : 'The barangay was notified so they can find another boat.',
        );
        if (!accept) {
          goBackToRentals();
        }
      } catch (err) {
        Alert.alert('Could not respond', err instanceof ApiError ? err.firstError() : 'Please try again.');
      } finally {
        setUpdating(false);
      }
    };

    Alert.alert(
      accept ? 'Accept this replacement trip?' : 'Decline this replacement trip?',
      accept
        ? 'You agree to operate this rental at the same date, time, and destination.'
        : 'The barangay will look for another boat.',
      [
        { text: 'Go Back', style: 'cancel' },
        { text: accept ? 'Accept' : 'Decline', style: accept ? 'default' : 'destructive', onPress: () => void run() },
      ],
    );
  }

  function openNoShowReport() {
    if (!booking) {
      return;
    }
    router.push({ pathname: '/no-show/report', params: { bookingId: String(booking.id) } });
  }

  async function pickReceipt() {
    const ImagePicker = await import('expo-image-picker');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to upload your payment receipt.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setReceiptUri(result.assets[0].uri);
    }
  }

  async function sendPaymentProof() {
    if (!booking) {
      return;
    }

    const reference = gcashReference.trim();
    if (reference.length < 6) {
      Alert.alert('Transaction reference required', 'Enter the GCash transaction reference number.');
      return;
    }
    if (!receiptUri) {
      Alert.alert('Receipt required', 'Upload a photo of your payment receipt.');
      return;
    }

    setSubmittingPayment(true);
    try {
      const updated = await submitPaymentProof(booking.id, {
        gcash_reference: reference,
        uri: receiptUri,
      });
      setBooking(updated);
      setShowPayForm(false);
      setGcashReference('');
      setReceiptUri(null);
      setPaymentSubmittedOpen(true);
    } catch (err) {
      if (err instanceof ApiError && err.isOrganizationInactive()) {
        router.replace('/organization-unavailable');
        return;
      }
      Alert.alert(
        'Could not submit payment',
        err instanceof ApiError ? err.firstError() : 'Please try again.',
      );
    } finally {
      setSubmittingPayment(false);
    }
  }

  async function startXenditCheckout(paymentType: XenditPaymentPlan | 'full_payment' = 'downpayment') {
    if (!booking) {
      return;
    }

    const plan =
      paymentType === 'full_payment' ? 'full_payment' : paymentType === 'full_rental' ? 'full_rental' : 'downpayment';

    router.push({ pathname: '/xendit-checkout', params: { id: String(booking.id), plan } });
  }

  function confirmVerifyPayment() {
    if (!booking) {
      return;
    }

    setConfirmKind('verify');
  }

  async function runVerifyPayment() {
    if (!booking) {
      return;
    }

    setUpdating(true);
    try {
      setBooking(await verifyPayment(booking.id));
      setJustConfirmed(true);
    } catch (err) {
      if (err instanceof ApiError && err.isOrganizationInactive()) {
        router.replace('/organization-inactive');
        return;
      }
      Alert.alert(
        'Could not verify payment',
        err instanceof ApiError ? err.firstError() : 'Please try again.',
      );
    } finally {
      setUpdating(false);
    }
  }

  function closeRejectModal() {
    setRejectOpen(false);
    setRejectPickerOpen(false);
    setRejectReason('');
    setRejectNotes('');
  }

  async function sendRejection() {
    if (!booking) {
      return;
    }

    if (!rejectReason) {
      Alert.alert('Reason required', 'Select a reason for rejection.');
      return;
    }

    const notes = rejectNotes.trim();
    if (rejectReason === 'Other' && notes.length < 4) {
      Alert.alert('Additional notes required', 'Please specify why you are rejecting this payment.');
      return;
    }

    const reason = notes ? `${rejectReason}. ${notes}` : rejectReason;

    setUpdating(true);
    try {
      setBooking(await rejectPayment(booking.id, reason));
      closeRejectModal();
    } catch (err) {
      Alert.alert(
        'Could not reject payment',
        err instanceof ApiError ? err.firstError() : 'Please try again.',
      );
    } finally {
      setUpdating(false);
    }
  }

  async function shareSlip() {
    if (!booking || downloading) {
      return;
    }

    setDownloading(true);
    try {
      await downloadBookingSlip(booking);
    } catch (err) {
      Alert.alert(
        'Could not download slip',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setDownloading(false);
    }
  }

  function renderNoShowIncident(booking: MobileBooking) {
    if (!booking.operator_no_show_incident) {
      return null;
    }

    return (
    <View
      style={[
        styles.noShowCard,
        {
          backgroundColor:
            booking.operator_no_show_incident.passenger_status_tone === 'green'
              ? isDark
                ? '#163528'
                : '#DFF6EA'
              : booking.operator_no_show_incident.passenger_status_tone === 'red'
                ? isDark
                  ? '#3A2224'
                  : '#FDECEC'
                : isDark
                  ? '#3A2E1C'
                  : '#FFF6E8',
          borderColor:
            booking.operator_no_show_incident.passenger_status_tone === 'green'
              ? isDark
                ? '#1F5E42'
                : '#B7E4CC'
              : booking.operator_no_show_incident.passenger_status_tone === 'red'
                ? isDark
                  ? '#8B3A3A'
                  : '#F3B4B4'
                : isDark
                  ? '#8A6A32'
                  : '#F0C48A',
        },
      ]}>
      <Text
        style={[
          styles.noShowTitle,
          {
            color:
              booking.operator_no_show_incident.passenger_status_tone === 'green'
                ? GREEN
                : booking.operator_no_show_incident.passenger_status_tone === 'red'
                  ? RED
                  : ORANGE,
          },
        ]}>
        {booking.operator_no_show_incident.passenger_status_label}
      </Text>
      <Text style={[styles.noShowBody, { color: isDark ? '#F6E7C8' : '#5C4318' }]}>
        {booking.operator_no_show_incident.passenger_message}
      </Text>
      {booking.operator_no_show_incident.report_reason_label ? (
        <Text style={[styles.noShowBody, { color: isDark ? '#F6E7C8' : '#5C4318' }]}>
          Reported: {booking.operator_no_show_incident.report_reason_label}
        </Text>
      ) : null}
      {booking.operator_no_show_incident.status === 'verified' &&
      booking.operator_no_show_incident.refund_amount_label ? (
        <Text style={[styles.noShowBody, { color: isDark ? '#F6E7C8' : '#5C4318', fontWeight: '700' }]}>
          Full refund: {booking.operator_no_show_incident.refund_amount_label}
          {booking.operator_no_show_incident.refund_status_label
            ? ` · ${booking.operator_no_show_incident.refund_status_label}`
            : ''}
        </Text>
      ) : null}
      {booking.operator_no_show_incident.rejection_reason ? (
        <Text style={[styles.noShowBody, { color: isDark ? '#F6E7C8' : '#5C4318' }]}>
          Reason: {booking.operator_no_show_incident.rejection_reason}
        </Text>
      ) : null}
      {booking.operator_no_show_incident?.passenger_status === 'refunded' ? (
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/no-show/refund-processed',
              params: { bookingId: String(booking.id) },
            })
          }
          style={({ pressed }) => [
            styles.filledBtn,
            { backgroundColor: GREEN, marginTop: 4 },
            pressed && styles.pressed,
          ]}>
          <Text style={styles.filledText}>View refund confirmation</Text>
        </Pressable>
      ) : null}
    </View>
    );
  }

  function goBackToRentals() {
    router.replace(operatorView ? '/operator-requests' : '/booking');
  }

  function finishAfterAccept() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/operator-home');
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.page }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          nestedScrollEnabled
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          onScroll={(event) => {
            scrollY.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom: 36 + keyboardHeight,
              flexGrow: 1,
            },
          ]}>
          <Pressable onPress={Keyboard.dismiss} accessible={false}>
          <Pressable
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={26} color={colors.navy} />
          </Pressable>

          {loading ? (
            <ActivityIndicator color={colors.blue} style={styles.loader} />
          ) : !booking || !look ? (
            <Text style={[styles.empty, { color: colors.muted }]}>Rental not found.</Text>
          ) : (
            <>
              <View style={styles.titleRow}>
                <View style={styles.titleCopy}>
                  <View style={styles.titleIconRow}>
                    <View style={[styles.iconBadge, { backgroundColor: isDark ? colors.iconBg : ICON_BG }]}>
                      <Ionicons name="boat-outline" size={16} color={colors.blue} />
                    </View>
                    <Text style={[styles.pageTitle, { color: colors.navy }]}>Boat and Trip Information</Text>
                  </View>
                </View>
                <View style={[styles.statusPill, { backgroundColor: isDark ? colors.iconBg : look.bg }]}>
                  <Text style={[styles.statusText, { color: look.color }]}>{look.label}</Text>
                </View>
              </View>

              {operatorNoShowReschedulePending ? (
              <View
                style={[
                    styles.card,
                    { backgroundColor: '#F3EEFF', borderColor: '#C4B5FD', marginBottom: 14 },
                  ]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Ionicons name="calendar" size={18} color={VIOLET} />
                    <Text style={{ color: VIOLET, fontSize: 13, fontWeight: '800' }}>
                      {operatorView && booking.can_operator_respond_reschedule
                        ? 'APPROVE NO-SHOW RESCHEDULE'
                        : 'WAITING FOR REPLACEMENT OPERATOR'}
                    </Text>
                  </View>
                  <Text style={{ color: '#5B21B6', fontSize: 13, fontWeight: '600', lineHeight: 18 }}>
                    {[
                      booking.no_show_reschedule_date_label || booking.requested_booking_date,
                      booking.no_show_reschedule_time_label || booking.start_time_label,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    {booking.no_show_reschedule_boat_name
                      ? ` on ${booking.no_show_reschedule_boat_name}`
                      : ''}
                    . Down payment stays on booking #{booking.code}.
                    {operatorView && booking.can_operator_respond_reschedule
                      ? ' Approve or decline below within 30 minutes.'
                      : ` Only the ${booking.no_show_reschedule_boat_name ?? 'replacement'} operator can confirm in the app.`}
                  </Text>
                </View>
              ) : null}

              {weatherHold || (reschedulePending && !operatorNoShowReschedulePending) ? (
                <View
                  style={[
                    styles.card,
                    { backgroundColor: '#FDECEC', borderColor: '#F3B4B4', marginBottom: 14 },
                  ]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Ionicons name="rainy" size={18} color={RED} />
                    <Text style={{ color: RED, fontSize: 13, fontWeight: '800' }}>
                      {operatorView && (reschedulePending || canReviewReschedule)
                        ? 'PASSENGER REQUESTED A NEW DATE'
                        : 'YOUR TRIP IS CANCELLED DUE TO WEATHER'}
                    </Text>
                  </View>
                  <Text style={{ color: '#9B2C2C', fontSize: 13, fontWeight: '600', lineHeight: 18 }}>
                    {booking.weather_reason_label ? `${booking.weather_reason_label}. ` : ''}
                    {booking.booking_date_label
                      ? `Your rental on ${booking.booking_date_label} cannot sail.`
                      : 'Your rental today cannot sail.'}{' '}
                    {reschedulePending || canReviewReschedule
                      ? operatorView
                        ? `Passenger requested ${booking.requested_booking_date_label || booking.requested_booking_date || 'a new date'}. Down payment stays. Approve or decline below.`
                        : `Waiting for the boat operator to approve ${booking.requested_booking_date_label || booking.requested_booking_date || 'your new date'}. Down payment stays with this rental.`
                      : 'Please reschedule to another date. Your verified down payment stays with this booking.'}
                  </Text>
                </View>
              ) : booking.kind === 'regular_trip' || completedRecord ? null : (
                <PaymentStepper booking={booking} showPayHint={!operatorView && canPay} />
              )}

              {completedRecord && booking ? (
                <>
                  <View style={[styles.completeHero, { backgroundColor: isDark ? '#163528' : '#E7F8EE' }]}>
                    <View style={styles.completeHeroIcon}>
                      <Ionicons name="checkmark-circle" size={28} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.completeHeroTitle, { color: isDark ? '#DFF6EA' : '#146C43' }]}>
                      Trip Completed Successfully!
                    </Text>
                    <Text style={[styles.completeHeroBody, { color: isDark ? '#B7E0C9' : '#2F7A56' }]}>
                      This trip has been fully recorded.
                    </Text>
                  </View>

                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.sectionHead}>
                      <View style={[styles.iconBadge, { backgroundColor: isDark ? colors.iconBg : ICON_BG }]}>
                        <Ionicons name="document-text-outline" size={16} color={colors.blue} />
                      </View>
                      <Text style={[styles.sectionTitle, { color: colors.navy }]}>Booking Information</Text>
                    </View>
                    <View style={styles.infoGrid}>
                      <InfoTile icon="pricetag-outline" label="Booking Reference" value={booking.code} />
                      <InfoTile
                        icon="create-outline"
                        label="Booking Date & Time"
                        value={bookingSubmittedLabel(booking)}
                      />
                      <InfoTile icon="calendar-outline" label="Rental Date" value={booking.booking_date_label} />
                      <InfoTile icon="time-outline" label="Departure Time" value={booking.start_time_label || '—'} />
                      <InfoTile icon="location-outline" label="Destination" value={booking.destination} />
                      <InfoTile icon="flag-outline" label="Pickup Point" value={booking.pickup_point || '—'} />
                      {operatorView ? (
                        <>
                          <InfoTile icon="person-outline" label="Passenger" value={passengerName(booking)} />
                          <InfoTile
                            icon="call-outline"
                            label="Passenger Contact"
                            value={passengerPhone(booking) || '—'}
                          />
                        </>
                      ) : (
                        <InfoTile
                          icon="person-outline"
                          label="Assigned Operator"
                          value={booking.operator?.full_name || booking.boat.operator_name || '—'}
                        />
                      )}
                    </View>
                  </View>

                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.sectionHead}>
                      <View style={[styles.iconBadge, { backgroundColor: isDark ? colors.iconBg : ICON_BG }]}>
                        <Ionicons name="boat-outline" size={16} color={colors.blue} />
                      </View>
                      <Text style={[styles.sectionTitle, { color: colors.navy }]}>Boat Details</Text>
                    </View>
                    <View style={styles.boatInfoRow}>
                      <Image source={{ uri: photo }} style={styles.boatThumb} contentFit="cover" />
                      <View style={styles.boatInfoCopy}>
                        <Text style={[styles.boatName, { color: colors.navy }]}>{booking.boat.name}</Text>
                        <Text style={[styles.metaText, { color: colors.navy }]}>Boat ID: {booking.boat.code}</Text>
                        <Text style={[styles.metaText, { color: colors.navy }]}>
                          Assigned Operator:{' '}
                          {booking.operator?.full_name || booking.boat.operator_name || '—'}
                        </Text>
                        <Text style={[styles.metaText, { color: colors.navy }]}>
                          Passengers: {String(booking.passenger_count)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.sectionHead}>
                      <View style={[styles.iconBadge, { backgroundColor: isDark ? colors.iconBg : ICON_BG }]}>
                        <Ionicons name="checkmark-done-outline" size={16} color={GREEN} />
                      </View>
                      <Text style={[styles.sectionTitle, { color: colors.navy }]}>Trip Completion</Text>
                    </View>
                    <View style={styles.infoGrid}>
                      <InfoTile
                        icon="calendar"
                        label="Completed Date"
                        value={booking.completed_at_date_label || '—'}
                      />
                      <InfoTile
                        icon="time"
                        label="Completed Time"
                        value={booking.completed_at_time_label || '—'}
                      />
                    </View>
                  </View>

                  <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.sectionHead}>
                      <View style={[styles.iconBadge, { backgroundColor: isDark ? colors.iconBg : ICON_BG }]}>
                        <Ionicons name="wallet-outline" size={16} color={colors.blue} />
                      </View>
                      <Text style={[styles.sectionTitle, { color: colors.navy }]}>Transaction History</Text>
                    </View>

                    <View style={[styles.historyBlock, { borderColor: '#B7E0C9', backgroundColor: isDark ? '#163528' : '#F3FBF6' }]}>
                      <View style={styles.historyHead}>
                        <Text style={[styles.historyTitle, { color: colors.navy }]}>
                          {booking.initial_payment_title || (booking.paid_as_full_rental ? 'Full Payment' : 'Down Payment')}
                        </Text>
                        <PayStatusChip
                          ok={booking.payment_status === 'verified' && booking.refund_request?.status !== 'refunded'}
                          label={
                            booking.refund_request?.status === 'refunded'
                              ? 'Refunded'
                              : booking.payment_status === 'verified'
                                ? 'Paid'
                                : booking.payment_status_label || 'Unpaid'
                          }
                        />
                      </View>
                      {booking.refund_request?.status === 'refunded' && booking.refund_request.refund_amount_label ? (
                        <View style={styles.payRow}>
                          <Text style={[styles.infoLabel, { color: colors.muted }]}>Refunded</Text>
                          <Text style={[styles.infoValue, { color: GREEN }]}>
                            {booking.refund_request.refund_amount_label}
                            {booking.refund_request.refunded_at_label ? ` · ${booking.refund_request.refunded_at_label}` : ''}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.payRow}>
                        <Text style={[styles.infoLabel, { color: colors.muted }]}>Amount</Text>
                        <Text style={[styles.infoValue, { color: colors.navy }]}>
                          {booking.initial_payment_amount_label ||
                            (booking.paid_as_full_rental
                              ? booking.total_paid_label || booking.rental_price_label
                              : booking.down_payment_amount_label) ||
                            '—'}
                        </Text>
                      </View>
                      <View style={styles.payRow}>
                        <Text style={[styles.infoLabel, { color: colors.muted }]}>Payment Method</Text>
                        <Text style={[styles.infoValue, { color: colors.navy }]}>
                          {booking.down_payment_method_label || 'GCash'}
                        </Text>
                      </View>
                      <View style={styles.payRow}>
                        <Text style={[styles.infoLabel, { color: colors.muted }]}>
                          {downPaymentWhenCaption(booking)}
                        </Text>
                        <Text style={[styles.infoValue, { color: colors.navy }]}>
                          {booking.down_payment_recorded_at_label || '—'}
                        </Text>
                      </View>
                    </View>

                    {booking.paid_as_full_rental ? null : (
                    <View
                    style={[
                        styles.historyBlock,
                        {
                          borderColor: booking.balance_status === 'paid' ? '#B7E0C9' : '#F3B4B4',
                          backgroundColor:
                            booking.balance_status === 'paid'
                              ? isDark
                                ? '#163528'
                                : '#F3FBF6'
                              : isDark
                                ? '#3A1F1F'
                                : '#FFF7F7',
                      },
                    ]}>
                      <View style={styles.historyHead}>
                        <Text style={[styles.historyTitle, { color: colors.navy }]}>Remaining Balance</Text>
                        <PayStatusChip
                          ok={booking.balance_status === 'paid'}
                          label={
                            booking.balance_status === 'paid'
                              ? 'Paid'
                              : booking.balance_status_label || 'Unpaid'
                          }
                        />
                      </View>
                      <View style={styles.payRow}>
                        <Text style={[styles.infoLabel, { color: colors.muted }]}>Amount</Text>
                        <Text style={[styles.infoValue, { color: colors.navy }]}>
                          {booking.balance_paid_amount_label || booking.remaining_balance_label || '—'}
                  </Text>
                      </View>
                      <View style={styles.payRow}>
                        <Text style={[styles.infoLabel, { color: colors.muted }]}>Payment Method</Text>
                        <Text style={[styles.infoValue, { color: colors.navy }]}>
                          {booking.balance_method_label || booking.balance_method || '—'}
                        </Text>
                      </View>
                      <View style={styles.payRow}>
                        <Text style={[styles.infoLabel, { color: colors.muted }]}>Recorded on</Text>
                        <Text style={[styles.infoValue, { color: colors.navy }]}>
                          {booking.balance_status === 'paid' ? booking.balance_paid_at_label || '—' : '—'}
                  </Text>
                </View>
              </View>
                    )}

                    <View style={[styles.totalPaidRow, { borderTopColor: colors.border }]}>
                      <Text style={[styles.totalPaidLabel, { color: colors.navy }]}>Total Paid</Text>
                      <Text style={[styles.totalPaidValue, { color: GREEN }]}>
                        {booking.total_paid_label || '—'}
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
              <>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.tripTop}>
                  <Image source={{ uri: photo }} style={styles.boatImage} contentFit="cover" />
                  <View style={styles.tripHead}>
                    <Text style={[styles.boatName, { color: colors.navy }]} numberOfLines={1}>
                      {booking.boat.name}
                    </Text>
                    <Text style={[styles.boatCode, { color: colors.muted }]}>{booking.boat.code}</Text>
                    <Text style={[styles.requestId, { color: colors.muted }]} numberOfLines={1}>
                      Request ID: #{booking.code}
                    </Text>
                  </View>
                </View>
                <View style={styles.infoGrid}>
                  <InfoTile icon="calendar-outline" label="Rental Date" value={booking.booking_date_label} />
                  {booking.requested_booking_date || booking.requested_booking_date_label ? (
                    <InfoTile
                      icon="calendar"
                      label="Requested Date"
                      value={booking.requested_booking_date_label || booking.requested_booking_date || '—'}
                    />
                  ) : null}
                  <InfoTile icon="location-outline" label="Destination" value={booking.destination} />
                  <InfoTile icon="time-outline" label="Departure Time" value={booking.start_time_label || '—'} />
                  <InfoTile icon="flag-outline" label="Pickup Point" value={booking.pickup_point || '—'} />
                  <InfoTile icon="people-outline" label="Passengers" value={String(booking.passenger_count)} />
                  <InfoTile icon="briefcase-outline" label="Purpose" value={booking.purpose || '—'} />
                  <InfoTile icon="document-text-outline" label="Notes" value={booking.remarks || '—'} />
                </View>
              </View>

              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHead}>
                  <View style={[styles.iconBadge, { backgroundColor: isDark ? colors.iconBg : ICON_BG }]}>
                <Ionicons name="person-outline" size={16} color={colors.blue} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: colors.navy }]}>
                    {operatorView ? 'Passenger' : 'Boat Operator'}
                </Text>
              </View>

                {operatorView ? (
                  <>
                    <View style={styles.operatorTop}>
                      <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.iconBg }]}>
                        <Ionicons name="person" size={28} color={colors.blue} />
                      </View>
                      <View style={styles.operatorCopy}>
                        <Text style={[styles.operatorName, { color: colors.navy }]}>
                          {passengerName(booking)}
                        </Text>
                        <Text style={[styles.operatorRole, { color: colors.muted }]}>Passenger</Text>
                      </View>
                      <Pressable
                        onPress={() => void contactPassenger()}
                        style={({ pressed }) => [
                          styles.contactBtn,
                          { backgroundColor: colors.iconBg },
                          pressed && styles.pressed,
                        ]}>
                        <Ionicons name="call-outline" size={13} color={colors.blue} />
                        <Text style={[styles.contactText, { color: colors.blue }]}>Contact</Text>
                      </Pressable>
                    </View>
                    <View style={styles.metaRow}>
                      <Ionicons name="call-outline" size={14} color={colors.blue} />
                      <Text style={[styles.metaText, { color: colors.navy }]}>
                        {passengerPhone(booking) || 'No contact number'}
                      </Text>
                    </View>
                  </>
                ) : confirmed && booking.operator ? (
                  <>
                    <Pressable onPress={openBoatInfo} style={styles.operatorTop}>
                      {operatorPhoto ? (
                        <Image source={{ uri: operatorPhoto }} style={styles.avatar} contentFit="cover" />
                      ) : (
                        <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.iconBg }]}>
                          <Ionicons name="person" size={28} color={colors.blue} />
                        </View>
                      )}
                      <View style={styles.operatorCopy}>
                        <Text style={[styles.operatorName, { color: colors.navy }]}>
                          {booking.operator.full_name}
                        </Text>
                        <Text style={[styles.operatorRole, { color: colors.muted }]}>Boat Operator</Text>
                        <Text style={[styles.metaText, { color: colors.navy, marginTop: 4 }]}>
                          {booking.operator.contact_number || 'No contact number'}
                        </Text>
                        <Text style={[styles.metaText, { color: colors.navy }]} numberOfLines={2}>
                          {booking.operator.address || 'No address on file'}
                        </Text>
                      </View>
                    </Pressable>
                      <Pressable
                      onPress={() => void contactOperator()}
                        style={({ pressed }) => [
                          styles.contactBtn,
                        styles.contactWide,
                          { backgroundColor: colors.iconBg },
                          pressed && styles.pressed,
                        ]}>
                      <Ionicons name="call-outline" size={14} color={colors.blue} />
                        <Text style={[styles.contactText, { color: colors.blue }]}>Contact Operator</Text>
                      </Pressable>
                  </>
                ) : (
                  <Text style={[styles.empty, { color: colors.muted }]}>
                    {confirmed
                      ? 'No operator is assigned to this boat yet.'
                      : 'Operator contact appears after this rental is confirmed.'}
                  </Text>
                )}
              </View>

              <View style={[styles.card, styles.boatInfoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sectionHead}>
                  <View style={[styles.iconBadge, { backgroundColor: isDark ? colors.iconBg : ICON_BG }]}>
                <Ionicons name="boat-outline" size={16} color={colors.blue} />
              </View>
                  <Text style={[styles.sectionTitle, { color: colors.navy }]}>Boat Details</Text>
                </View>
                <View style={styles.boatInfoRow}>
                <Image source={{ uri: photo }} style={styles.boatThumb} contentFit="cover" />
                <View style={styles.boatInfoCopy}>
                  <Text style={[styles.boatName, { color: colors.navy }]}>{booking.boat.name}</Text>
                    <Text style={[styles.metaText, { color: colors.navy }]}>
                      {booking.boat.capacity ?? '—'} PAX Capacity
                    </Text>
                    <Text style={[styles.metaText, { color: colors.navy }]}>
                      Registration No.: {booking.boat.license_no || '—'}
                    </Text>
                  </View>
                </View>
                  <Pressable
                  onPress={openBoatInfo}
                    style={({ pressed }) => [
                    styles.contactBtn,
                    styles.contactWide,
                    { backgroundColor: colors.iconBg, marginTop: 12 },
                      pressed && styles.pressed,
                    ]}>
                  <Ionicons name="eye-outline" size={14} color={colors.blue} />
                  <Text style={[styles.contactText, { color: colors.blue }]}>View Boat Details</Text>
                  </Pressable>
              </View>

              {!hideTripReminders ? (
              <View
                style={[
                  styles.reminders,
                  {
                    backgroundColor: isDark ? '#3A2E1C' : '#FFF8EE',
                    borderColor: isDark ? '#8A6A32' : '#F0C48A',
                  },
                ]}>
                <View style={styles.remindersHead}>
                  <Ionicons name="warning" size={16} color="#E39B2B" />
                  <Text style={styles.remindersTitle}>Important Reminders</Text>
                </View>
                <View style={styles.reminderGrid}>
                  <View style={styles.reminderItem}>
                    <View style={[styles.reminderBadge, { backgroundColor: isDark ? '#4A3A20' : '#FFF1D6' }]}>
                      <Ionicons name="time-outline" size={16} color="#E39B2B" />
                    </View>
                    <Text style={[styles.reminderText, { color: colors.navy }]}>
                      Arrive 30 minutes before departure.
                    </Text>
                  </View>
                  <View style={styles.reminderItem}>
                    <View style={[styles.reminderBadge, { backgroundColor: isDark ? '#4A3A20' : '#FFF1D6' }]}>
                      <Ionicons name="shield-checkmark-outline" size={16} color="#E39B2B" />
                    </View>
                    <Text style={[styles.reminderText, { color: colors.navy }]}>
                      Wear life jackets at all times.
                    </Text>
                  </View>
                  <View style={styles.reminderItem}>
                    <View style={[styles.reminderBadge, { backgroundColor: isDark ? '#4A3A20' : '#FFF1D6' }]}>
                      <Ionicons name="people-outline" size={16} color="#E39B2B" />
                    </View>
                    <Text style={[styles.reminderText, { color: colors.navy }]}>
                      Follow the instructions of the boat operator.
                    </Text>
                  </View>
                </View>
              </View>
              ) : null}
              </>
              )}

              {!operatorView && awaitingOperatorVerification ? (
                <View style={[styles.payNotice, { backgroundColor: isDark ? '#1B2A44' : '#E8F1FF' }]}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.blue} />
                  <Text style={[styles.payNoticeText, { color: colors.blue }]}>
                    Payment Submitted — Awaiting Operator Verification
                    </Text>
                </View>
              ) : null}

              {rentalConfirmedNotice ? (
                <View
                  style={[
                    styles.confirmedNotice,
                    { backgroundColor: isDark ? '#163528' : '#DFF6EA', borderColor: isDark ? '#1F5E42' : '#B7E4CC' },
                  ]}>
                  <View style={styles.confirmedIcon}>
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  </View>
                  <View style={[styles.confirmedDivider, { backgroundColor: isDark ? '#1F5E42' : '#B7E4CC' }]} />
                  <View style={styles.confirmedCopy}>
                    <Text style={[styles.confirmedTitle, { color: isDark ? '#7EE2AE' : '#166534' }]}>Rental Confirmed</Text>
                    <Text style={[styles.confirmedBody, { color: isDark ? '#C9EBD7' : '#1F3B2C' }]}>
                      Your{' '}
                      <Text style={styles.confirmedStrong}>{paidInFull ? 'full payment' : 'down payment'}</Text>{' '}
                      has been verified.
                    </Text>
                  </View>
                </View>
              ) : null}

              {refundRequest ? (
                <View
                  style={[
                    styles.card,
                    {
                      gap: 6,
                      borderColor:
                        refundRequest.status === 'refunded'
                          ? '#B7E4CC'
                          : refundRequest.status === 'failed' || refundRequest.status === 'rejected'
                            ? '#F3B4B4'
                            : '#F0C48A',
                      backgroundColor:
                        refundRequest.status === 'refunded'
                          ? isDark ? '#163528' : '#F3FBF6'
                          : refundRequest.status === 'failed' || refundRequest.status === 'rejected'
                            ? isDark ? '#3A2224' : '#FFF7F7'
                            : isDark ? '#3A2E1C' : '#FFF9F0',
                    },
                  ]}>
                  <View style={styles.historyHead}>
                    <Text style={[styles.historyTitle, { color: colors.navy }]}>
                      Refund {refundRequest.reference ? `· ${refundRequest.reference}` : ''}
                    </Text>
                    <PayStatusChip ok={refundRequest.status === 'refunded'} label={refundRequest.status_label} />
                  </View>
                  {refundRequest.reason_label ? (
                    <View style={styles.payRow}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>Reason</Text>
                      <Text style={[styles.infoValue, { color: colors.navy }]}>{refundRequest.reason_label}</Text>
                    </View>
                  ) : null}
                  {refundRequest.requested_amount_label ? (
                    <View style={styles.payRow}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>Requested</Text>
                      <Text style={[styles.infoValue, { color: colors.navy }]}>{refundRequest.requested_amount_label}</Text>
                    </View>
                  ) : null}
                  {refundRequest.refund_amount_label && refundRequest.status !== 'pending_review' ? (
                    <View style={styles.payRow}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>
                        {refundRequest.status === 'refunded' ? 'Refunded' : 'Approved'}
                    </Text>
                      <Text style={[styles.infoValue, { color: refundRequest.status === 'refunded' ? GREEN : colors.navy }]}>
                        {refundRequest.refund_amount_label}
                      </Text>
                    </View>
                  ) : null}
                  {refundRequest.refunded_at_label ? (
                    <View style={styles.payRow}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>Refunded on</Text>
                      <Text style={[styles.infoValue, { color: colors.navy }]}>{refundRequest.refunded_at_label}</Text>
                    </View>
                  ) : null}
                  <Text style={[styles.completeHint, { color: colors.muted }]}>
                    {refundRequest.status === 'pending_review'
                      ? 'The barangay is reviewing your request. You will be notified of the decision.'
                      : refundRequest.status === 'refunding'
                        ? 'Approved. The refund is being processed through Xendit (test mode) to your original GCash.'
                        : refundRequest.status === 'refunded'
                          ? 'The refund was sent back to the GCash account you paid with.'
                          : refundRequest.status === 'rejected'
                            ? `Not approved${refundRequest.rejection_reason ? `: ${refundRequest.rejection_reason}` : '.'} Your payment records are kept.`
                            : refundRequest.status === 'failed'
                              ? 'The refund could not be completed yet. The barangay will retry or send it manually.'
                              : refundRequest.status_label}
                  </Text>
                </View>
              ) : null}

              {canChooseRefund ? (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.sectionHead}>
                    <View style={[styles.iconBadge, { backgroundColor: isDark ? colors.iconBg : ICON_BG }]}>
                      <Ionicons name="shield-checkmark-outline" size={16} color={colors.blue} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.navy }]}>You will not lose your payment</Text>
                  </View>
                  <Text style={[styles.infoLabel, { color: colors.muted, marginBottom: 12 }]}>
                    This trip was cancelled by the {refundRequest?.type === 'admin_cancelled' ? 'barangay admin' : 'operator'}. Choose a full refund of{' '}
                    {refundRequest?.refund_amount_label ?? 'your payment'} or reschedule to a new date.
                  </Text>
                  <View style={styles.actions}>
                    <Pressable
                      disabled={updating}
                      onPress={() => setChoiceCalendarOpen(true)}
                      style={({ pressed }) => [
                        styles.outlineBtn,
                        { borderColor: colors.blue },
                        (pressed || updating) && styles.pressed,
                      ]}>
                      <Text style={[styles.outlineText, { color: colors.blue }]}>Reschedule</Text>
                    </Pressable>
                    <Pressable
                      disabled={updating}
                      onPress={confirmFullRefund}
                      style={({ pressed }) => [
                        styles.filledBtn,
                        { backgroundColor: colors.blue },
                        (pressed || updating) && styles.pressed,
                      ]}>
                      {updating ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.filledText}>Full Refund</Text>}
                    </Pressable>
                  </View>
                  <TripCalendarModal
                    open={choiceCalendarOpen}
                    selected={rescheduleDate}
                    weatherDates={rescheduleHolds}
                    onVisibleDates={loadRescheduleHolds}
                    onClose={() => setChoiceCalendarOpen(false)}
                    onSelect={(value) => {
                      setChoiceCalendarOpen(false);
                      setRescheduleDate(value);
                      Alert.alert('Reschedule to this date?', formatTripDate(value), [
                        { text: 'Back', style: 'cancel' },
                        { text: 'Request date', onPress: () => submitRefundChoice('reschedule', value) },
                      ]);
                    }}
                  />
                </View>
              ) : null}

              {!operatorView && paymentRejected ? (
                <View style={[styles.payNotice, { backgroundColor: isDark ? '#3A2224' : '#FDECEC' }]}>
                  <Ionicons name="alert-circle" size={18} color={RED} />
                  <Text style={[styles.payNoticeText, { color: RED }]}>
                    Payment proof rejected{booking.payment_rejection_reason ? `: ${booking.payment_rejection_reason}` : '.'} You can resubmit a new receipt.
                  </Text>
                </View>
              ) : null}

              {operatorView && awaitingOperatorVerification ? (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.sectionHead}>
                    <View style={[styles.iconBadge, { backgroundColor: isDark ? colors.iconBg : ICON_BG }]}>
                      <Ionicons name="receipt-outline" size={16} color={colors.blue} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.navy }]}>Payment Verification</Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Rental ID</Text>
                    <Text style={[styles.infoValue, { color: colors.navy }]}>#{booking.code}</Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Passenger Name</Text>
                    <Text style={[styles.infoValue, { color: colors.navy }]}>{passengerName(booking)}</Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Boat Name</Text>
                    <Text style={[styles.infoValue, { color: colors.navy }]}>{booking.boat.name}</Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Destination</Text>
                    <Text style={[styles.infoValue, { color: colors.navy }]}>{booking.destination}</Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Total Rental Price</Text>
                    <Text style={[styles.infoValue, { color: colors.navy }]}>{booking.rental_price_label || '—'}</Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Down Payment Amount</Text>
                    <Text style={[styles.infoValue, { color: colors.navy }]}>
                      {booking.down_payment_amount_label || '—'}
                    </Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Remaining Balance</Text>
                    <Text style={[styles.infoValue, { color: colors.navy }]}>
                      {booking.remaining_balance_label || '—'}
                    </Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>GCash Reference Number</Text>
                    <Text style={[styles.infoValue, { color: colors.navy }]}>{booking.gcash_reference || '—'}</Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Payment Submission Date</Text>
                    <Text style={[styles.infoValue, { color: colors.navy }]}>
                      {booking.payment_submitted_at_label || '—'}
                    </Text>
                  </View>
                  {receiptSource ? (
                    <Pressable onPress={() => setPreviewImage(receiptSource)}>
                      <Image source={receiptSource} style={styles.receiptPreview} contentFit="contain" />
                    </Pressable>
                  ) : null}
                  {booking.can_verify_payment === false ? (
                    <View style={[styles.payNotice, { backgroundColor: colors.iconBg, marginTop: 12 }]}>
                      <Ionicons name="information-circle" size={18} color={colors.blue} />
                      <Text style={[styles.payNoticeText, { color: colors.navy }]}>
                        {booking.verify_payment_blocked_reason ||
                          'This payment was sent to the barangay GCash. The barangay admin will verify it. You will be notified once it is confirmed.'}
                      </Text>
                    </View>
                  ) : (
                  <View style={[styles.actions, { marginTop: 12 }]}>
                    <Pressable
                      disabled={updating}
                      onPress={() => setRejectOpen(true)}
                      style={({ pressed }) => [
                        styles.outlineBtn,
                        { borderColor: RED },
                        (pressed || updating) && styles.pressed,
                      ]}>
                      <Text style={[styles.outlineText, { color: RED }]}>Reject Payment Proof</Text>
                    </Pressable>
                    <Pressable
                      disabled={updating}
                      onPress={confirmVerifyPayment}
                      style={({ pressed }) => [
                        styles.filledBtn,
                        { backgroundColor: GREEN },
                        (pressed || updating) && styles.pressed,
                      ]}>
                      {updating ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.filledText}>Verify Payment</Text>
                      )}
                    </Pressable>
              </View>
                  )}
                </View>
              ) : null}

              {operatorView && booking.no_show_replacement_request ? (
                <View style={[styles.noShowCard, { backgroundColor: isDark ? '#1B2C4D' : '#EEF4FF', borderColor: colors.blue }]}>
                  <Text style={[styles.noShowTitle, { color: colors.blue }]}>Replacement trip request</Text>
                  <Text style={[styles.noShowBody, { color: colors.navy }]}>
                    {booking.no_show_replacement_request.message}
                  </Text>
                  <Text style={[styles.noShowBody, { color: colors.muted }]}>
                    {[booking.no_show_replacement_request.boat_name, booking.no_show_replacement_request.requested_at_label]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                <View style={styles.actions}>
                  <Pressable
                    disabled={updating}
                      onPress={() => respondReplacement(false)}
                    style={({ pressed }) => [
                      styles.outlineBtn,
                        { borderColor: RED, flex: 1 },
                      (pressed || updating) && styles.pressed,
                    ]}>
                      <Text style={[styles.outlineText, { color: RED }]}>Decline</Text>
                  </Pressable>
                  <Pressable
                    disabled={updating}
                      onPress={() => respondReplacement(true)}
                      style={({ pressed }) => [
                        styles.filledBtn,
                        { backgroundColor: GREEN, flex: 1 },
                        (pressed || updating) && styles.pressed,
                      ]}>
                      {updating ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.filledText}>Accept</Text>}
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {operatorView && approved ? (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.sectionHead}>
                    <View style={[styles.iconBadge, { backgroundColor: isDark ? colors.iconBg : ICON_BG }]}>
                      <Ionicons name="cash-outline" size={16} color={colors.blue} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.navy }]}>Remaining Balance</Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Total Rental Price</Text>
                    <Text style={[styles.infoValue, { color: colors.navy }]}>{booking.rental_price_label || '—'}</Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Verified Down Payment</Text>
                    <Text style={[styles.infoValue, { color: colors.navy }]}>
                      {booking.down_payment_amount_label || '—'}
                    </Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Remaining Balance</Text>
                    <Text style={[styles.infoValue, { color: colors.navy }]}>
                      {booking.remaining_balance_label || '—'}
                    </Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Balance Payment Status</Text>
                    <Text style={[styles.infoValue, { color: colors.navy }]}>
                      {booking.balance_status_label || 'Unpaid'}
                    </Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Payment Method</Text>
                    <Text style={[styles.infoValue, { color: colors.navy }]}>
                      {booking.balance_method_label || 'Collected during the trip'}
                    </Text>
                  </View>
                  {booking.balance_status !== 'paid' && booking.complete_blocked_reason ? (
                    <View style={[styles.payNotice, { backgroundColor: colors.iconBg, marginTop: 8 }]}>
                      <Ionicons name="information-circle" size={18} color={colors.blue} />
                      <Text style={[styles.payNoticeText, { color: colors.navy }]}>{booking.complete_blocked_reason}</Text>
                    </View>
                  ) : booking.balance_status !== 'paid' ? (
                    <View style={[styles.payNotice, { backgroundColor: colors.iconBg, marginTop: 8 }]}>
                      <Ionicons name="information-circle" size={18} color={colors.blue} />
                      <Text style={[styles.payNoticeText, { color: colors.navy }]}>
                        Collect the remaining balance during the trip. It is recorded automatically when you mark the trip Done.
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {showPayForm && booking && onlineDownPaymentOnly ? (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.sectionHead}>
                    <View style={[styles.iconBadge, { backgroundColor: isDark ? colors.iconBg : ICON_BG }]}>
                      <Ionicons name="wallet-outline" size={16} color={colors.blue} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.navy }]}>Pay for Your Rental</Text>
                  </View>
                  {xenditCheckoutOpen ? (
                    <Text style={[styles.infoLabel, { color: colors.muted, marginBottom: 10 }]}>
                      You already started a GCash payment. Tap Continue to Checkout below to finish it.
                    </Text>
                  ) : null}
                  <RentalXenditPaymentPanel
                    booking={booking}
                    colors={colors}
                    isDark={isDark}
                    checkoutLoading={checkoutLoading}
                    onlineMessage={
                      !canXenditDownpayment && !xenditCheckoutOpen ? onlinePay?.message ?? null : null
                    }
                    onPay={(plan) => void startXenditCheckout(plan)}
                  />
                </View>
              ) : null}

              {showPayForm && booking && !onlineDownPaymentOnly ? (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.sectionHead}>
                    <View style={[styles.iconBadge, { backgroundColor: isDark ? colors.iconBg : ICON_BG }]}>
                      <Ionicons name="wallet-outline" size={16} color={colors.blue} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.navy }]}>Pay Down Payment</Text>
                  </View>
                  <View
                    style={[
                      styles.payNotice,
                      { backgroundColor: isDark ? '#3A2E1C' : '#FFF4E5', marginBottom: 12 },
                    ]}>
                    <Ionicons name="alert-circle" size={18} color="#E39B2B" />
                    <Text style={[styles.payNoticeText, { color: isDark ? '#F6E7C8' : '#5C4318' }]}>
                      {booking.rental_ui?.down_payment_instruction ||
                        'Down payment is non-refundable once sent. The remaining balance is paid on the day of the trip.'}
                    </Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Total Rental Price</Text>
                    <Text style={[styles.infoValue, { color: colors.navy }]}>
                      {booking.rental_price_label || '—'}
                    </Text>
                  </View>
                  {booking.commission?.enabled ? (
                    <View style={styles.payRow}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>Included barangay commission</Text>
                      <Text style={[styles.infoValue, { color: colors.navy }]}>
                        {booking.commission.amount_label} ({booking.commission.percentage_label})
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.payRow}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Required Down Payment</Text>
                    <Text style={[styles.infoValue, { color: colors.navy }]}>
                      {booking.down_payment_amount_label || booking.down_payment_percent_label || '—'}
                    </Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>Remaining Balance</Text>
                    <Text style={[styles.infoValue, { color: colors.navy }]}>
                      {booking.remaining_balance_label || '—'}
                    </Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={[styles.infoLabel, { color: colors.muted }]}>GCash Account Name</Text>
                    <Text style={[styles.infoValue, { color: colors.navy }]}>
                      {booking.gcash_account_name || '—'}
                    </Text>
                  </View>
                  {booking.gcash_mobile_number ? (
                    <View style={styles.payRow}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>GCash Mobile Number</Text>
                      <Text style={[styles.infoValue, { color: colors.navy }]}>
                        {booking.gcash_mobile_number}
                      </Text>
                    </View>
                  ) : null}
                  {booking.gcash_qr_url ? (
                    <Pressable
                      onPress={() =>
                        setPreviewImage({
                          uri: resolveMediaUrl(booking.gcash_qr_url) || booking.gcash_qr_url || '',
                        })
                      }
                      style={styles.qrWrap}>
                      <Image
                        source={{ uri: resolveMediaUrl(booking.gcash_qr_url) || booking.gcash_qr_url }}
                        style={styles.qrImage}
                        contentFit="contain"
                      />
                      <View style={styles.qrHint} pointerEvents="none">
                        <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
                        <Text style={styles.qrHintText}>Tap to view</Text>
                      </View>
                    </Pressable>
                  ) : (
                    <Text style={[styles.empty, { color: colors.muted, marginBottom: 10 }]}>
                      GCash QR is not available yet. Please{' '}
                      <Text
                        onPress={() => router.push('/help')}
                        style={{ color: colors.blue, fontWeight: '700' }}>
                        contact the barangay office
                      </Text>
                      .
                    </Text>
                  )}
                  <View ref={payRefWrapRef} collapsable={false}>
                    <Text style={[styles.infoLabel, { color: colors.muted, marginBottom: 6 }]}>
                      Transaction Reference Number
                    </Text>
                    <TextInput
                      value={gcashReference}
                      onChangeText={setGcashReference}
                      placeholder="Enter GCash reference"
                      placeholderTextColor={colors.muted}
                      autoCapitalize="characters"
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={() => Keyboard.dismiss()}
                      onFocus={() => handleInputFocus(payRefWrapRef.current)}
                      style={[
                        styles.payInput,
                        { color: colors.navy, borderColor: colors.border, backgroundColor: colors.page },
                      ]}
                    />
                  </View>
                  <Pressable
                    onPress={() => void pickReceipt()}
                    style={({ pressed }) => [styles.uploadBtn, { borderColor: colors.blue }, pressed && styles.pressed]}>
                    <Ionicons name="image-outline" size={16} color={colors.blue} />
                    <Text style={[styles.outlineText, { color: colors.blue }]}>
                      {receiptUri ? 'Change Payment Receipt' : 'Upload Payment Receipt'}
                    </Text>
                  </Pressable>
                  {receiptUri ? (
                    <Pressable onPress={() => setPreviewImage({ uri: receiptUri })}>
                      <Image source={{ uri: receiptUri }} style={styles.receiptPreview} contentFit="cover" />
                    </Pressable>
                  ) : null}
                  <Pressable
                    disabled={submittingPayment}
                    onPress={() => void sendPaymentProof()}
                    style={({ pressed }) => [
                      styles.filledBtn,
                      { backgroundColor: colors.blue, marginTop: 12, flex: 0 },
                      (pressed || submittingPayment) && styles.pressed,
                    ]}>
                    {submittingPayment ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.filledText}>Submit Payment Proof</Text>
                    )}
                  </Pressable>
                </View>
              ) : null}

              {operatorView && pending ? null : operatorView && justConfirmed ? null : operatorView && approved ? (
                <>
                <View style={styles.tripActionStack}>
                  <View style={styles.tripActionRow}>
                    <Pressable
                      disabled={downloading}
                      onPress={() => void shareSlip()}
                      style={({ pressed }) => [
                        styles.slipBtn,
                        (pressed || downloading) && styles.pressed,
                      ]}>
                      {downloading ? (
                        <ActivityIndicator color={BLUE} />
                      ) : (
                        <>
                          <Ionicons name="download-outline" size={18} color={BLUE} />
                          <Text style={styles.slipBtnText}>Download Slip</Text>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      disabled={updating || !tripReady}
                    onPress={() => {
                        if (!tripReady) {
                          return;
                        }
                        if (!booking.can_complete) {
                          setCompleteNotice(
                            booking.complete_blocked_reason ||
                              'This rental cannot be completed yet.',
                          );
                          return;
                        }

                        setConfirmKind('complete');
                    }}
                    style={({ pressed }) => [
                        styles.completeTripBtn,
                        !tripReady && styles.completeTripBtnDisabled,
                        (pressed || updating) && tripReady && styles.pressed,
                      ]}>
                      {updating ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                          <Text style={styles.completeTripBtnText}>Complete Trip</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                  {!tripReady ? (
                    <Text style={[styles.completeHint, { color: colors.muted }]}>
                      Available on the rental date or after the trip.
                    </Text>
                  ) : null}
                  {canOperatorMarkPassengerNoShowLocal(booking, nowTick) ? (
                    <Pressable
                      disabled={updating}
                      onPress={() => setConfirmKind('passenger_no_show')}
                      style={({ pressed }) => [
                        styles.passengerNoShowBtn,
                        (pressed || updating) && styles.pressed,
                      ]}>
                      <Ionicons name="person-remove-outline" size={18} color={RED} />
                      <Text style={styles.passengerNoShowBtnText}>Passenger Did Not Show</Text>
                    </Pressable>
                  ) : isPassengerNoShowWaiting(booking, nowTick) ? (
                    <Text style={[styles.completeHint, { color: colors.muted }]}>
                      Passenger Did Not Show opens at {passengerNoShowOpensAtLabel(booking) || 'the end of the waiting period'}.
                    </Text>
                  ) : null}
                </View>
                </>
              ) : operatorView && passengerNoShow ? (
                <View style={{ gap: 10 }}>
                  <Text style={[styles.completeHint, { color: colors.muted }]}>
                    Passenger did not show. Down payment is not refunded. Remaining balance was not
                    collected. This is not a completed trip.
                  </Text>
                  {booking.passenger_no_show_report ? (
                    <Text style={[styles.completeHint, { color: colors.navy }]}>
                      Reported {booking.passenger_no_show_report.reported_at_label || '—'} ·{' '}
                      {booking.passenger_no_show_report.dispute_status_label}
                    </Text>
                  ) : null}
                </View>
              ) : !operatorView && weatherHold && canReschedule ? (
                <View style={{ gap: 10 }}>
                  <Text style={[styles.infoLabel, { color: colors.muted }]}>
                    Choose a new rental date
                  </Text>
                  <View ref={rescheduleWrapRef} collapsable={false}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Pick a new rental date"
                      onPress={() => setRescheduleCalendarOpen(true)}
                      style={[
                        styles.payInput,
                        styles.datePickerField,
                        { borderColor: colors.border, backgroundColor: colors.page },
                      ]}>
                      <Ionicons name="calendar-outline" size={18} color={colors.blue} />
                      <Text style={[styles.datePickerText, { color: colors.navy }]}>
                        {formatTripDate(rescheduleDate)}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={colors.muted} />
                    </Pressable>
                  </View>
                  <TripCalendarModal
                    open={rescheduleCalendarOpen}
                    selected={rescheduleDate}
                    weatherDates={rescheduleHolds}
                    onVisibleDates={loadRescheduleHolds}
                    onClose={() => setRescheduleCalendarOpen(false)}
                    onSelect={(value) => {
                      setRescheduleDate(value);
                      setRescheduleCalendarOpen(false);
                    }}
                  />
                  <View style={styles.actions}>
                    <Pressable
                      onPress={goBackToRentals}
                      style={({ pressed }) => [
                        styles.outlineBtn,
                        { borderColor: colors.blue },
                        pressed && styles.pressed,
                      ]}>
                      <Text style={[styles.outlineText, { color: colors.blue }]}>Back</Text>
                    </Pressable>
                    <Pressable
                      disabled={updating}
                      onPress={() => void submitReschedule()}
                      style={({ pressed }) => [
                        styles.filledBtn,
                      { backgroundColor: colors.blue },
                      (pressed || updating) && styles.pressed,
                    ]}>
                    {updating ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.filledText}>Reschedule</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : !operatorView && reschedulePending ? (
                <View style={styles.actions}>
                  <Pressable
                    onPress={goBackToRentals}
                    style={({ pressed }) => [
                      styles.filledBtn,
                      { backgroundColor: colors.blue, flex: 1 },
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.filledText}>Back to My Rentals</Text>
                  </Pressable>
                </View>
              ) : !operatorView && (canPay || awaitingPayment) && !showPayForm ? (
                <View style={styles.actions}>
                  {canCancelAwaiting ? (
                    <Pressable
                      disabled={updating}
                      onPress={confirmCancelRental}
                      style={({ pressed }) => [
                        styles.outlineBtn,
                        { borderColor: RED },
                        (pressed || updating) && styles.pressed,
                      ]}>
                      <Text style={[styles.outlineText, { color: RED }]}>Cancel Rental</Text>
                    </Pressable>
                  ) : null}
                  {canXenditDownpayment && !onlineDownPaymentOnly ? (
                    <Pressable
                      disabled={checkoutLoading}
                      onPress={() => void startXenditCheckout('downpayment')}
                      style={({ pressed }) => [
                        styles.filledBtn,
                        { backgroundColor: colors.blue },
                        (pressed || checkoutLoading) && styles.pressed,
                      ]}>
                      {checkoutLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.filledText}>
                          {xenditCheckoutOpen ? 'Continue GCash Checkout' : 'Pay with GCash Online'}
                        </Text>
                    )}
                  </Pressable>
                  ) : null}
                  {canPay && onlineDownPaymentOnly ? (
                    <Pressable
                      onPress={() => setShowPayForm(true)}
                      style={({ pressed }) => [
                        styles.filledBtn,
                        { backgroundColor: colors.blue },
                        pressed && styles.pressed,
                      ]}>
                      <Text style={styles.filledText}>
                        {xenditCheckoutOpen ? 'Continue GCash Checkout' : 'Proceed to payment'}
                      </Text>
                    </Pressable>
                  ) : canPay && !onlineDownPaymentOnly ? (
                    <Pressable
                      onPress={() => setShowPayForm(true)}
                      style={({ pressed }) => [
                        canXenditDownpayment ? styles.outlineBtn : styles.filledBtn,
                        canXenditDownpayment
                          ? { borderColor: colors.blue }
                          : { backgroundColor: colors.blue },
                        pressed && styles.pressed,
                      ]}>
                      <Text
                        style={[
                          canXenditDownpayment ? styles.outlineText : styles.filledText,
                          canXenditDownpayment ? { color: colors.blue } : null,
                        ]}>
                        Pay Down Payment
                      </Text>
                    </Pressable>
                  ) : !canPay && !canXenditDownpayment && !onlineDownPaymentOnly ? (
                    <Pressable
                      onPress={goBackToRentals}
                      style={({ pressed }) => [
                        styles.filledBtn,
                        { backgroundColor: colors.blue },
                        pressed && styles.pressed,
                      ]}>
                      <Text style={styles.filledText}>Back to My Rentals</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : !operatorView && pending ? (
                <View style={styles.actions}>
                  {canCancelPending ? (
                    <Pressable
                      disabled={updating}
                      onPress={confirmCancelRental}
                      style={({ pressed }) => [
                        styles.outlineBtn,
                        { borderColor: RED },
                        (pressed || updating) && styles.pressed,
                      ]}>
                      <Text style={[styles.outlineText, { color: RED }]}>Cancel Request</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => router.back()}
                    style={({ pressed }) => [
                      styles.filledBtn,
                      { backgroundColor: colors.blue },
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.filledText}>Back</Text>
                  </Pressable>
                </View>
              ) : !operatorView && approved ? (
                <View style={{ gap: 10 }}>
                <View style={styles.actions}>
                  <Pressable
                    disabled={downloading}
                      onPress={() => void shareSlip()}
                    style={({ pressed }) => [
                      styles.outlineBtn,
                      { borderColor: colors.blue },
                      (pressed || downloading) && styles.pressed,
                    ]}>
                    {downloading ? (
                      <ActivityIndicator color={colors.blue} />
                    ) : (
                      <>
                        <Ionicons name="download-outline" size={16} color={colors.blue} />
                          <Text style={[styles.outlineText, { color: colors.blue }]}>Download Rental Slip</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() =>
                        router.push({ pathname: '/payment-history', params: { code: booking.code } })
                      }
                      style={({ pressed }) => [
                        styles.filledBtn,
                        styles.iconBtn,
                        { backgroundColor: colors.blue },
                        pressed && styles.pressed,
                      ]}>
                      <Ionicons name="card-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.filledText}>View Payments</Text>
                    </Pressable>
                  </View>
                  {canCancelConfirmed ? (
                    <Pressable
                      disabled={updating}
                      onPress={confirmCancelRental}
                      style={({ pressed }) => [
                        styles.cancelWideBtn,
                        { backgroundColor: isDark ? '#3A2224' : '#FDECEC' },
                        (pressed || updating) && styles.pressed,
                      ]}>
                      <Ionicons name="close-circle-outline" size={18} color={RED} />
                      <Text style={styles.cancelWideText}>Cancel Rental</Text>
                    </Pressable>
                  ) : null}
                  {booking.operator_no_show_incident ? (
                    renderNoShowIncident(booking)
                  ) : booking.operator_no_show_resolution_label ? (
                    <Text style={[styles.completeHint, { color: colors.navy }]}>
                      What we did: {booking.operator_no_show_resolution_label}
                    </Text>
                  ) : canPassengerReportOperatorNoShow(booking, nowTick) ? (
                    <Pressable
                      disabled={updating}
                      onPress={openNoShowReport}
                      style={({ pressed }) => [
                        styles.outlineBtn,
                        { borderColor: RED },
                        (pressed || updating) && styles.pressed,
                      ]}>
                      <Text style={[styles.outlineText, { color: RED }]}>Report: boat did not arrive</Text>
                    </Pressable>
                  ) : booking.operator_no_show_report_pending ? (
                    <View
                      style={[
                        styles.noShowCard,
                        {
                          backgroundColor: isDark ? '#3A2E1C' : '#FFF6E8',
                          borderColor: isDark ? '#8A6A32' : '#F0C48A',
                        },
                      ]}>
                      <Text style={[styles.noShowTitle, { color: ORANGE }]}>Barangay is checking</Text>
                      <Text style={[styles.noShowBody, { color: isDark ? '#F6E7C8' : '#5C4318' }]}>
                        We received your report. Wait while barangay checks if the boat missed the trip.
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : !operatorView && passengerNoShow ? (
                <View style={{ gap: 10 }}>
                  <View
                    style={[
                      styles.noShowCard,
                      {
                        backgroundColor: isDark ? '#3A2224' : '#FDECEC',
                        borderColor: isDark ? '#8A4040' : '#F3B4B4',
                      },
                    ]}>
                    {passengerNoShowDetailCopy(booking.cancellation_display).map((line) => (
                      <Text
                        key={line}
                        style={[
                          styles.noShowBody,
                          { color: isDark ? '#FFD0D0' : '#9B2C2C', fontWeight: '700' },
                        ]}>
                        {line}
                      </Text>
                    ))}
                    <Text
                      style={[
                        styles.noShowBody,
                        { color: isDark ? '#FFD0D0' : '#9B2C2C', marginTop: 4, fontWeight: '600' },
                      ]}>
                      {booking.cancellation_display?.detail_message ??
                        'Marked as passenger no-show. Your down payment is not refunded.'}
                    </Text>
                  </View>
                  {booking.passenger_no_show_report ? (
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 6 }]}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>No-show details</Text>
                      {[
                        ['Reported by', booking.passenger_no_show_report.reported_by_label],
                        ['Reported at', booking.passenger_no_show_report.reported_at_label],
                        ['Scheduled departure', booking.passenger_no_show_report.scheduled_departure_label],
                        ['Amount paid', booking.passenger_no_show_report.amount_paid_label],
                        ['Refund', booking.passenger_no_show_report.refund_status_label],
                        ['Dispute', booking.passenger_no_show_report.dispute_status_label],
                        ...(booking.passenger_no_show_report.dispute_deadline_label
                          ? [['Dispute until', booking.passenger_no_show_report.dispute_deadline_label] as const]
                          : []),
                      ].map(([label, value]) => (
                        <View key={label} style={styles.noShowRow}>
                          <Text style={[styles.noShowRowLabel, { color: colors.muted }]}>{label}</Text>
                          <Text style={[styles.noShowRowValue, { color: colors.navy }]}>{value || '—'}</Text>
                        </View>
                      ))}
                      {booking.passenger_no_show_report.resolution_notes ? (
                        <Text style={[styles.noShowBody, { color: colors.navy }]}>
                          Barangay: {booking.passenger_no_show_report.resolution_notes}
                        </Text>
                      ) : null}
                      {booking.passenger_no_show_report.can_dispute ? (
                        disputeOpen ? (
                          <View style={{ gap: 8, marginTop: 6 }}>
                            <Text style={[styles.noShowBody, { color: colors.muted }]}>
                              You have 1 day from the report time to dispute. After that this rental stays cancelled as
                              passenger no-show.
                            </Text>
                            <TextInput
                              value={disputeText}
                              onChangeText={setDisputeText}
                              multiline
                              placeholder="Tell the barangay why this report is wrong (at least 10 characters)"
                              placeholderTextColor={colors.muted}
                              style={[styles.disputeInput, { borderColor: colors.border, color: colors.navy }]}
                            />
                            <View style={styles.actions}>
                              <Pressable
                                disabled={disputing}
                                onPress={() => setDisputeOpen(false)}
                    style={({ pressed }) => [
                                  styles.outlineBtn,
                                  { borderColor: colors.border, flex: 1 },
                                  pressed && styles.pressed,
                                ]}>
                                <Text style={[styles.outlineText, { color: colors.navy }]}>Cancel</Text>
                              </Pressable>
                              <Pressable
                                disabled={disputing || disputeText.trim().length < 10}
                                onPress={() => void submitDispute()}
                                style={({ pressed }) => [
                                  styles.filledBtn,
                                  { backgroundColor: RED, flex: 1 },
                                  (pressed || disputing || disputeText.trim().length < 10) && styles.pressed,
                                ]}>
                                {disputing ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                                  <Text style={styles.filledText}>Send Dispute</Text>
                    )}
                  </Pressable>
                            </View>
                </View>
              ) : (
                          <Pressable
                            onPress={() => setDisputeOpen(true)}
                            style={({ pressed }) => [
                              styles.outlineBtn,
                              { borderColor: RED, marginTop: 6 },
                              pressed && styles.pressed,
                            ]}>
                            <Text style={[styles.outlineText, { color: RED }]}>This report is wrong — Dispute</Text>
                          </Pressable>
                        )
                      ) : booking.passenger_no_show_report.dispute_status === 'none' ? (
                        <Text style={[styles.noShowBody, { color: colors.muted, marginTop: 6 }]}>
                          Dispute window ended. This rental stays cancelled as passenger no-show.
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  <View style={styles.actions}>
                    <Pressable
                      onPress={goBackToRentals}
                      style={({ pressed }) => [
                        styles.filledBtn,
                        { backgroundColor: colors.blue, flex: 1 },
                        pressed && styles.pressed,
                      ]}>
                      <Text style={styles.filledText}>Back to My Rentals</Text>
                    </Pressable>
                  </View>
                </View>
              ) : !operatorView && cancelled ? (
                <View style={{ gap: 10 }}>
                {renderNoShowIncident(booking)}
                <View style={styles.actions}>
                  <Pressable
                    onPress={goBackToRentals}
                    style={({ pressed }) => [
                      styles.filledBtn,
                      { backgroundColor: colors.blue, flex: 1 },
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.filledText}>Back to My Rentals</Text>
                  </Pressable>
                </View>
                </View>
              ) : completed ? (
                <View style={styles.actions}>
                  <Pressable
                    disabled={downloading}
                    onPress={() => void shareSlip()}
                    style={({ pressed }) => [
                      styles.outlineBtn,
                      { borderColor: colors.blue },
                      (pressed || downloading) && styles.pressed,
                    ]}>
                    {downloading ? (
                      <ActivityIndicator color={colors.blue} />
                    ) : (
                      <>
                        <Ionicons name="download-outline" size={16} color={colors.blue} />
                        <Text style={[styles.outlineText, { color: colors.blue }]}>Download Receipt</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (!operatorView && !rated) {
                        router.push({ pathname: '/feedback', params: { id: String(booking.id) } });
                        return;
                      }
                      goBackToRentals();
                    }}
                    style={({ pressed }) => [
                      styles.filledBtn,
                      { backgroundColor: colors.blue },
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.filledText}>
                      {operatorView ? 'Back' : rated ? 'Back to My Rentals' : 'Rate Your Journey'}
                    </Text>
                  </Pressable>
                </View>
              ) : operatorView && canCancelAwaiting && !justConfirmed ? (
                <View style={styles.actions}>
                  <Pressable
                    disabled={updating}
                    onPress={confirmCancelRental}
                    style={({ pressed }) => [
                      styles.outlineBtn,
                      { borderColor: RED },
                      (pressed || updating) && styles.pressed,
                    ]}>
                    <Text style={[styles.outlineText, { color: RED }]}>Cancel Rental</Text>
                  </Pressable>
                  <Pressable
                    onPress={goBackToRentals}
                    style={({ pressed }) => [
                      styles.filledBtn,
                      { backgroundColor: colors.blue },
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.filledText}>Back</Text>
                  </Pressable>
                </View>
              ) : operatorView && (justConfirmed || canReviewReschedule) ? null : (
                <View style={styles.actions}>
                  <Pressable
                    onPress={goBackToRentals}
                    style={({ pressed }) => [
                      styles.outlineBtn,
                      { borderColor: colors.blue, flex: 1 },
                      pressed && styles.pressed,
                    ]}>
                    <Ionicons name="chevron-back" size={16} color={colors.blue} />
                    <Text style={[styles.outlineText, { color: colors.blue, fontSize: 14 }]}>Back to My Rentals</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
          </Pressable>
        </ScrollView>
        </KeyboardAvoidingView>
        {operatorView && canReviewReschedule ? (
          <View
            style={[
              styles.stickyActions,
              {
                backgroundColor: colors.page,
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}>
            <Pressable
              disabled={updating}
              onPress={() => setRescheduleReview('reject')}
              style={({ pressed }) => [
                styles.outlineBtn,
                { borderColor: RED },
                (pressed || updating) && styles.pressed,
              ]}>
              <Text style={[styles.outlineText, { color: RED }]}>Decline date</Text>
            </Pressable>
            <Pressable
              disabled={updating}
              onPress={() => setRescheduleReview('approve')}
              style={({ pressed }) => [
                styles.filledBtn,
                { backgroundColor: GREEN },
                (pressed || updating) && styles.pressed,
              ]}>
              {updating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.filledText}>Approve date</Text>
              )}
            </Pressable>
          </View>
        ) : operatorView && pending ? (
          <View
            style={[
              styles.stickyActions,
              {
                backgroundColor: colors.page,
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}>
            <Pressable
              disabled={updating}
              onPress={() => setDeclineOpen(true)}
              style={({ pressed }) => [
                styles.outlineBtn,
                { borderColor: RED },
                (pressed || updating) && styles.pressed,
              ]}>
              <Text style={[styles.outlineText, { color: RED }]}>Decline</Text>
            </Pressable>
            <Pressable
              disabled={updating}
              onPress={() => {
                void changeStatus('approved');
              }}
              style={({ pressed }) => [
                styles.filledBtn,
                { backgroundColor: colors.blue },
                (pressed || updating) && styles.pressed,
              ]}>
              {updating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.filledText}>Accept trip</Text>
              )}
            </Pressable>
          </View>
        ) : operatorView && justConfirmed ? (
          <View style={[styles.stickyActions, { backgroundColor: colors.page }]}>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={finishAfterAccept}
              style={[styles.filledBtn, { backgroundColor: colors.blue, flex: 1 }]}>
              <Text style={styles.filledText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </SafeAreaView>

      <Modal
        visible={cancelOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelOpen(false)}>
        <Pressable style={styles.cancelOverlay} onPress={() => setCancelOpen(false)}>
          <Pressable
            style={[styles.cancelCard, { backgroundColor: colors.card }]}
            onPress={() => {}}>
            <Pressable
              onPress={() => setCancelOpen(false)}
              hitSlop={10}
              style={styles.cancelClose}
              disabled={updating}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </Pressable>
            <View style={styles.cancelIconWrap}>
              <Ionicons name="trash" size={24} color={RED} />
    </View>
            <Text style={[styles.cancelTitle, { color: colors.navy }]}>Cancel rental?</Text>
            <Text style={[styles.cancelBody, { color: colors.muted }]}>
              {operatorView
                ? booking?.is_paid_rental
                  ? 'Passenger already paid. They can pick a full refund or a new date.'
                  : 'The passenger will be notified and the boat will be free again.'
                : !paidVerified && !booking?.is_paid_rental
                  ? 'No payment yet. You can book again anytime.'
                  : booking?.cancel_refund_amount_label
                    ? 'Downpayment is non-refundable. Any extra amount needs barangay admin review before refund.'
                    : 'Downpayment is non-refundable. You can cancel before trip day only.'}
            </Text>
            {!operatorView && (paidVerified || booking?.is_paid_rental) ? (
              <View style={[styles.cancelSummary, { borderColor: colors.border, backgroundColor: colors.page }]}>
                {booking?.paid_online_label ? (
                  <View style={styles.cancelSummaryRow}>
                    <Text style={[styles.cancelSummaryLabel, { color: colors.muted }]}>You paid</Text>
                    <Text style={[styles.cancelSummaryValue, { color: colors.navy }]}>{booking.paid_online_label}</Text>
                  </View>
                ) : null}
                {booking?.down_payment_amount_label ? (
                  <View style={styles.cancelSummaryRow}>
                    <Text style={[styles.cancelSummaryLabel, { color: colors.muted }]}>Non-refundable</Text>
                    <Text style={[styles.cancelSummaryValue, { color: RED }]}>{booking.down_payment_amount_label}</Text>
                  </View>
                ) : null}
                {booking?.cancel_refund_amount_label ? (
                  <View style={styles.cancelSummaryRow}>
                    <Text style={[styles.cancelSummaryLabel, { color: colors.muted }]}>For admin review</Text>
                    <Text style={[styles.cancelSummaryValue, { color: GREEN }]}>{booking.cancel_refund_amount_label}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            {!operatorView ? (
              <View style={styles.cancelReasonWrap}>
                <View style={styles.cancelChips}>
                  {CANCEL_REASONS.map((reason) => {
                    const active = cancelReason === reason;
                    return (
                      <Pressable
                        key={reason}
                        onPress={() => {
                          setCancelReason(reason);
                          setCancelReasonError('');
                        }}
                        style={[
                          styles.cancelChip,
                          { borderColor: active ? RED : colors.border, backgroundColor: active ? '#FDECEC' : colors.page },
                        ]}>
                        <Text style={[styles.cancelChipText, { color: active ? RED : colors.navy }]}>{reason}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  value={cancelReason}
                  onChangeText={(value) => {
                    setCancelReason(value);
                    setCancelReasonError('');
                  }}
                  placeholder="Or type your reason"
                  placeholderTextColor={colors.muted}
                  maxLength={300}
                  multiline
                  style={[
                    styles.cancelReasonInput,
                    { color: colors.navy, borderColor: cancelReasonError ? RED : colors.border, backgroundColor: colors.page },
                  ]}
                />
                {cancelReasonError ? <Text style={styles.cancelReasonError}>{cancelReasonError}</Text> : null}
                <Pressable
                  onPress={() => {
                    setCancelOpen(false);
                    router.push({ pathname: '/help', params: { section: 'rental' } });
                  }}>
                  <Text style={[styles.cancelPolicyLink, { color: colors.blue }]}>Read the cancellation policy</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.cancelActions}>
              <Pressable
                disabled={updating}
                onPress={() => setCancelOpen(false)}
                style={({ pressed }) => [styles.cancelKeep, pressed && styles.pressed]}>
                <Text style={styles.cancelKeepText}>Keep</Text>
              </Pressable>
              <Pressable
                disabled={updating}
                onPress={() => void confirmCancelAndClose()}
                style={({ pressed }) => [styles.cancelConfirm, (pressed || updating) && styles.pressed]}>
                {updating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.cancelConfirmText} numberOfLines={1}>
                    Cancel Rental
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {rejectOpen ? (
      <Modal
        visible={rejectOpen}
        transparent
        animationType="fade"
        onRequestClose={closeRejectModal}>
        <Pressable style={styles.rejectOverlay} onPress={closeRejectModal}>
          <Pressable
            style={[styles.rejectCard, { backgroundColor: colors.card }]}
            onPress={() => setRejectPickerOpen(false)}>
            <View style={styles.rejectHead}>
              <Text style={[styles.rejectTitle, { color: colors.navy }]}>Reject Payment Proof</Text>
              <Pressable onPress={closeRejectModal} hitSlop={10} disabled={updating}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <View style={styles.rejectWarn}>
              <Ionicons name="alert-circle" size={18} color={RED} />
              <Text style={styles.rejectWarnText}>Are you sure you want to reject this payment proof?</Text>
            </View>

            <Text style={[styles.rejectLabel, { color: colors.navy }]}>Reason for Rejection</Text>
            <Pressable
              onPress={() => setRejectPickerOpen((open) => !open)}
              style={[
                styles.rejectSelect,
                {
                  backgroundColor: isDark ? colors.page : '#FFFFFF',
                  borderColor: rejectPickerOpen ? colors.blue : colors.border,
                },
              ]}>
              <Text
                style={[
                  styles.rejectSelectText,
                  { color: rejectReason ? colors.navy : colors.muted },
                ]}>
                {rejectReason || 'Select a reason'}
              </Text>
              <Ionicons
                name={rejectPickerOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.muted}
              />
            </Pressable>
            {rejectPickerOpen ? (
              <View
                style={[
                  styles.rejectMenu,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}>
                {REJECT_REASONS.map((reason) => (
                  <Pressable
                    key={reason}
                    onPress={() => {
                      setRejectReason(reason);
                      setRejectPickerOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.rejectOption,
                      rejectReason === reason && { backgroundColor: isDark ? colors.iconBg : '#F4F7FB' },
                      pressed && styles.pressed,
                    ]}>
                    <Text style={[styles.rejectOptionText, { color: colors.navy }]}>{reason}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.rejectNotesHead}>
              <Text style={[styles.rejectLabel, { color: colors.navy, marginBottom: 0 }]}>
                Additional notes <Text style={{ color: colors.muted, fontWeight: '500' }}>(optional)</Text>
              </Text>
              <Text style={[styles.rejectCount, { color: colors.muted }]}>{rejectNotes.length}/255</Text>
            </View>
            <TextInput
              value={rejectNotes}
              onChangeText={(text) => setRejectNotes(text.slice(0, 255))}
              placeholder="Add more details…"
              placeholderTextColor={colors.muted}
              multiline
              maxLength={255}
              style={[
                styles.rejectNotes,
                {
                  backgroundColor: isDark ? colors.page : '#FFFFFF',
                  borderColor: colors.border,
                  color: colors.navy,
                },
              ]}
            />

            <View style={styles.rejectActions}>
              <Pressable
                disabled={updating}
                onPress={closeRejectModal}
                style={({ pressed }) => [
                  styles.rejectCancel,
                  { borderColor: RED },
                  (pressed || updating) && styles.pressed,
                ]}>
                <Text style={[styles.rejectCancelText, { color: RED }]}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={updating}
                onPress={sendRejection}
                style={({ pressed }) => [
                  styles.rejectConfirm,
                  (pressed || updating) && styles.pressed,
                ]}>
                {updating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.rejectConfirmText}>Reject Payment</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      ) : null}

      <Modal
        visible={paymentSubmittedOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPaymentSubmittedOpen(false)}>
        <View style={styles.successOverlay}>
          <View style={[styles.successCard, { backgroundColor: colors.card }]}>
            <View style={[styles.successRing, { backgroundColor: isDark ? '#163528' : '#E7F8EE' }]}>
              <View style={styles.successCircle}>
                <Ionicons name="checkmark" size={24} color="#FFFFFF" />
              </View>
            </View>
            <Text style={[styles.successTitle, { color: colors.navy }]}>
              Payment Submitted
            </Text>
            <Text style={[styles.successBody, { color: colors.muted }]}>
              Please wait for the operator to verify it.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPaymentSubmittedOpen(false)}
              style={({ pressed }) => [
                styles.successBtn,
                { backgroundColor: colors.blue },
                pressed && styles.pressed,
              ]}>
              <Text style={styles.successBtnText}>Got It</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={confirmKind !== null}
        transparent
        animationType="fade"
        onRequestClose={() => (updating ? undefined : setConfirmKind(null))}>
        <View style={styles.successOverlay}>
          <View style={[styles.successCard, { backgroundColor: colors.card, alignItems: 'center' }]}>
            <View style={[styles.successRing, { backgroundColor: isDark ? '#163528' : '#E7F8EE' }]}>
              <View style={styles.successCircle}>
                <Ionicons
                  name={
                    confirmKind === 'verify'
                      ? 'shield-checkmark'
                      : confirmKind === 'complete'
                        ? 'checkmark-done'
                        : confirmKind === 'passenger_no_show' || confirmKind === 'operator_no_show'
                          ? 'alert-circle'
                          : 'cash'
                  }
                  size={24}
                  color="#FFFFFF"
                />
              </View>
            </View>
            <Text style={[styles.successTitle, { color: colors.navy }]}>
              {confirmKind === 'verify'
                ? 'Verify Payment'
                : confirmKind === 'complete'
                  ? 'Done'
                  : confirmKind === 'passenger_no_show'
                    ? 'Passenger did not show'
                    : confirmKind === 'operator_no_show'
                      ? 'Report operator no-show'
                      : 'Done'}
            </Text>
            <Text style={[styles.successBody, { color: colors.muted }]}>
              {confirmKind === 'verify'
                ? `Check that ₱${Number(booking?.down_payment_amount ?? 0).toFixed(2)} (ref ${booking?.gcash_reference || '—'}) is in your GCash history.`
                : confirmKind === 'complete'
                  ? booking?.complete_settles_balance
                    ? `Trip finished? Balance ${booking?.remaining_balance_label || ''} will be recorded as paid in cash.`
                    : 'Trip finished?'
                  : confirmKind === 'passenger_no_show'
                    ? 'The rental will be cancelled under the No-Show policy.'
                    : confirmKind === 'operator_no_show'
                      ? 'Boat did not arrive? Admin and operator will be notified.'
                      : 'Trip finished?'}
            </Text>
            {confirmKind === 'passenger_no_show' ? (
              <View style={styles.noShowDeclaration}>
                <Pressable
                  onPress={() => setPassengerNoShowDeclared((value) => !value)}
                  style={styles.noShowDeclarationRow}>
                  <Ionicons
                    name={passengerNoShowDeclared ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={passengerNoShowDeclared ? colors.blue : colors.muted}
                  />
                  <Text style={[styles.noShowDeclarationText, { color: colors.navy }]}>
                    I was at the pickup point and waited {booking?.passenger_no_show_grace_minutes ?? 15} minutes past
                    departure.
                  </Text>
                </Pressable>
                <TextInput
                  value={passengerNoShowRemarks}
                  onChangeText={setPassengerNoShowRemarks}
                  multiline
                  placeholder="Remarks (optional)"
                  placeholderTextColor={colors.muted}
                  style={[styles.disputeInput, { borderColor: colors.border, color: colors.navy }]}
                />
                <Text style={[styles.noShowDeclarationText, { color: colors.muted, marginTop: 4 }]}>
                  Proof photo (optional)
                </Text>
                {passengerNoShowPhoto?.uri ? (
                  <View style={{ gap: 8 }}>
                    <Image
                      source={{ uri: passengerNoShowPhoto.uri }}
                      style={{ width: '100%', height: 140, borderRadius: 12 }}
                      contentFit="cover"
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable
                        onPress={() => setPassengerNoShowSourceOpen(true)}
                        style={[styles.outlineBtn, { borderColor: colors.blue, flex: 1 }]}>
                        <Text style={[styles.outlineText, { color: colors.blue }]}>Change</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setPassengerNoShowPhoto(null)}
                        style={[styles.outlineBtn, { borderColor: RED, flex: 1 }]}>
                        <Text style={[styles.outlineText, { color: RED }]}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setPassengerNoShowSourceOpen(true)}
                    style={[
                      styles.outlineBtn,
                      { borderColor: colors.border, borderStyle: 'dashed', minHeight: 52 },
                    ]}>
                    <Ionicons name="camera-outline" size={18} color={colors.blue} />
                    <Text style={[styles.outlineText, { color: colors.navy }]}>
                      Take photo or upload
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null}
            <View style={styles.confirmActions}>
              <Pressable
                disabled={updating}
                onPress={() => setConfirmKind(null)}
                style={({ pressed }) => [
                  styles.confirmGhost,
                  { borderColor: colors.border, backgroundColor: isDark ? colors.iconBg : '#F3F7FF' },
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.confirmGhostText, { color: colors.blue }]}>
                  {confirmKind === 'passenger_no_show' ? 'Go Back' : 'Not yet'}
                </Text>
              </Pressable>
              <Pressable
                disabled={updating || (confirmKind === 'passenger_no_show' && !passengerNoShowDeclared)}
                onPress={() => {
                  const kind = confirmKind;
                  setConfirmKind(null);
                  if (kind === 'verify') {
                    void runVerifyPayment();
                    return;
                  }
                  if (kind === 'complete') {
                    void changeStatus('completed');
                    return;
                  }
                  if (kind === 'passenger_no_show') {
                    void runPassengerNoShow();
                  }
                }}
                style={({ pressed }) => [
                  styles.confirmFill,
                  (pressed || updating || (confirmKind === 'passenger_no_show' && !passengerNoShowDeclared)) &&
                    styles.pressed,
                ]}>
                {updating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.successBtnText} numberOfLines={1}>
                    {confirmKind === 'verify'
                      ? 'Verify Payment'
                      : confirmKind === 'complete'
                        ? 'Done'
                        : confirmKind === 'passenger_no_show'
                          ? 'Confirm No-Show'
                          : confirmKind === 'operator_no_show'
                            ? 'Send report'
                            : 'Done'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ImageSourceSheet
        visible={passengerNoShowSourceOpen}
        onClose={() => setPassengerNoShowSourceOpen(false)}
        onTakePhoto={() => {
          void takeProofPhoto().then((picked) => {
            if (picked) {
              setPassengerNoShowPhoto(picked);
            }
          });
        }}
        onChooseGallery={() => {
          void chooseProofFromGallery().then((picked) => {
            if (picked) {
              setPassengerNoShowPhoto(picked);
            }
          });
        }}
      />

      <Modal
        visible={Boolean(rescheduleReview)}
        transparent
        animationType="fade"
        onRequestClose={() => (updating ? undefined : setRescheduleReview(null))}>
        <View style={styles.successOverlay}>
          <View style={[styles.successCard, { backgroundColor: colors.card, alignItems: 'center' }]}>
            <View
              style={[
                styles.successRing,
                {
                  backgroundColor:
                    rescheduleReview === 'reject'
                      ? isDark
                        ? '#3A1F1F'
                        : '#FDECEC'
                      : isDark
                        ? '#163528'
                        : '#E7F8EE',
                },
              ]}>
              <View
                style={[
                  styles.successCircle,
                  { backgroundColor: rescheduleReview === 'reject' ? RED : GREEN },
                ]}>
                <Ionicons
                  name={rescheduleReview === 'reject' ? 'close' : 'checkmark'}
                  size={24}
                  color="#FFFFFF"
                />
              </View>
            </View>
            <Text style={[styles.successTitle, { color: colors.navy }]}>
              {rescheduleReview === 'reject' ? 'Decline new date?' : 'Approve new date?'}
            </Text>
            <Text style={[styles.successBody, { color: colors.muted }]}>
              {rescheduleReview === 'reject'
                ? 'The passenger can pick another date. Verified down payment stays with this rental.'
                : `Move this rental to ${booking?.requested_booking_date ?? 'the requested date'}. Down payment stays.`}
            </Text>
            {rescheduleReview === 'reject' ? (
              <TextInput
                value={rescheduleRejectReason}
                onChangeText={setRescheduleRejectReason}
                placeholder="Reason (at least 5 characters)"
                placeholderTextColor={colors.muted}
                multiline
                style={[
                  styles.payInput,
                  {
                    color: colors.navy,
                    borderColor: colors.border,
                    backgroundColor: isDark ? colors.page : '#F7FAFF',
                    width: '100%',
                    minHeight: 72,
                    textAlignVertical: 'top',
                    marginBottom: 12,
                  },
                ]}
              />
            ) : null}
            <View style={styles.confirmActions}>
              <Pressable
                disabled={updating}
                onPress={() => setRescheduleReview(null)}
                style={({ pressed }) => [
                  styles.confirmGhost,
                  { borderColor: colors.border, backgroundColor: isDark ? colors.iconBg : '#F3F7FF' },
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.confirmGhostText, { color: colors.blue }]}>Keep</Text>
              </Pressable>
              <Pressable
                disabled={
                  updating ||
                  (rescheduleReview === 'reject' && rescheduleRejectReason.trim().length < 5)
                }
                onPress={() => {
                  if (rescheduleReview) {
                    void submitRescheduleReview(rescheduleReview);
                  }
                }}
                style={({ pressed }) => [
                  styles.confirmFill,
                  { backgroundColor: rescheduleReview === 'reject' ? RED : GREEN },
                  (pressed || updating) && styles.pressed,
                ]}>
                {updating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.successBtnText}>
                    {rescheduleReview === 'reject' ? 'Decline' : 'Approve'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={declineOpen}
        transparent
        animationType="fade"
        onRequestClose={() => (updating ? undefined : setDeclineOpen(false))}>
        <View style={styles.successOverlay}>
          <View style={[styles.successCard, { backgroundColor: colors.card, alignItems: 'center' }]}>
            <View style={[styles.successRing, { backgroundColor: isDark ? '#3A1F1F' : '#FDECEC' }]}>
              <View style={[styles.successCircle, { backgroundColor: RED }]}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </View>
            </View>
            <Text style={[styles.successTitle, { color: colors.navy }]}>Decline request</Text>
            <Text style={[styles.successBody, { color: colors.muted }]}>
              The passenger will be notified and the boat will be free again.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                disabled={updating}
                onPress={() => setDeclineOpen(false)}
                style={({ pressed }) => [
                  styles.confirmGhost,
                  { borderColor: colors.border, backgroundColor: isDark ? colors.iconBg : '#F3F7FF' },
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.confirmGhostText, { color: colors.blue }]}>Keep</Text>
              </Pressable>
              <Pressable
                disabled={updating}
                onPress={() => {
                  setDeclineOpen(false);
                  void changeStatus('cancelled');
                }}
                style={({ pressed }) => [
                  styles.confirmFill,
                  { backgroundColor: RED },
                  (pressed || updating) && styles.pressed,
                ]}>
                {updating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.successBtnText}>Decline</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(completeNotice)}
        transparent
        animationType="fade"
        onRequestClose={() => setCompleteNotice('')}>
        <View style={styles.successOverlay}>
          <View style={[styles.successCard, { backgroundColor: colors.card }]}>
            <View style={[styles.successRing, { backgroundColor: isDark ? '#3D2A1C' : '#FDE8DC' }]}>
              <View style={[styles.successCircle, { backgroundColor: ORANGE }]}>
                <Ionicons name="time-outline" size={24} color="#FFFFFF" />
              </View>
            </View>
            <Text style={[styles.successTitle, { color: colors.navy }]}>Could not mark as done</Text>
            <Text style={[styles.successBody, { color: colors.muted }]}>{completeNotice}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setCompleteNotice('')}
              style={({ pressed }) => [
                styles.successBtn,
                { backgroundColor: colors.blue },
                pressed && styles.pressed,
              ]}>
              <Text style={styles.successBtnText}>Got It</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(previewImage)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}>
        <View style={styles.photoViewer}>
          <SafeAreaView style={styles.photoViewerSafe} edges={['top']}>
            <Pressable
              onPress={() => setPreviewImage(null)}
              style={({ pressed }) => [styles.photoClose, pressed && styles.pressed]}>
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </Pressable>
          </SafeAreaView>
          <Pressable style={styles.photoViewerBody} onPress={() => setPreviewImage(null)}>
            {previewImage ? (
              <Image
                source={previewImage}
                style={{ width: screenWidth, height: screenHeight * 0.78 }}
                contentFit="contain"
              />
            ) : null}
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginLeft: -8,
    marginBottom: 4,
  },
  loader: {
    marginTop: 32,
  },
  empty: {
    fontSize: 13,
    lineHeight: 18,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  titleCopy: {
    flex: 1,
  },
  titleIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  tripTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  boatImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#D7E8FB',
  },
  tripHead: {
    flex: 1,
    minWidth: 0,
  },
  boatName: {
    fontSize: 18,
    fontWeight: '800',
  },
  boatCode: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600',
  },
  requestId: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoTile: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    paddingRight: 8,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ICON_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  infoValue: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '800',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  operatorTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorCopy: {
    flex: 1,
  },
  operatorName: {
    fontSize: 16,
    fontWeight: '800',
  },
  operatorRole: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  contactWide: {
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  contactText: {
    color: BLUE,
    fontSize: 11,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  metaText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  boatInfoCard: {
    paddingBottom: 14,
  },
  boatInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  boatThumb: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#D7E8FB',
  },
  boatInfoCopy: {
    flex: 1,
  },
  completeHero: {
    alignItems: 'center',
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  completeHeroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  completeHeroTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  completeHeroBody: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  historyBlock: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  historyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  payChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  payChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  totalPaidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 2,
  },
  totalPaidLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  totalPaidValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  reminders: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#F0C48A',
    backgroundColor: '#FFF8EE',
    padding: 14,
    marginBottom: 16,
  },
  remindersHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  remindersTitle: {
    color: '#E39B2B',
    fontSize: 13,
    fontWeight: '800',
  },
  reminderGrid: {
    gap: 10,
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reminderBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF1D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  tripActionStack: {
    gap: 10,
  },
  tripActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  slipBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: BLUE,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  slipBtnText: {
    color: BLUE,
    fontSize: 13,
    fontWeight: '800',
  },
  completeTripBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  completeTripBtnDisabled: {
    backgroundColor: '#C5CDD8',
  },
  completeTripBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  passengerNoShowBtn: {
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: RED,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  passengerNoShowBtnText: {
    color: RED,
    fontSize: 14,
    fontWeight: '800',
  },
  completeHint: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  noShowCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  noShowTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  noShowBody: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  replacementOffer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    marginTop: 2,
  },
  noShowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  noShowRowLabel: { fontSize: 13 },
  noShowRowValue: { fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  disputeInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 80,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  noShowDeclaration: { width: '100%', gap: 10, marginTop: 12 },
  noShowDeclarationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noShowDeclarationText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  stickyActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    zIndex: 20,
    elevation: 12,
  },
  outlineBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  outlineText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  filledBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  filledText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
  payNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#E8F1FF',
    padding: 12,
    marginBottom: 14,
  },
  payNoticeText: {
    flex: 1,
    color: BLUE,
    fontSize: 13,
    fontWeight: '700',
  },
  payRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  qrWrap: {
    position: 'relative',
    marginVertical: 10,
    borderRadius: 16,
    overflow: 'hidden',
  },
  qrImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#F4F9FD',
  },
  qrHint: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  qrHintText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  successOverlay: modal.overlay,
  successCard: modal.card,
  successRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: modal.title,
  successBody: modal.body,
  successBtn: modal.btnFull,
  successBtnText: modal.btnText,
  confirmActions: modal.actions,
  confirmGhost: {
    ...modal.btn,
    borderWidth: 1.5,
  },
  confirmGhostText: modal.btnGhostText,
  confirmFill: {
    ...modal.btn,
    backgroundColor: GREEN,
  },
  photoViewer: {
    flex: 1,
    backgroundColor: 'rgba(6, 10, 18, 0.94)',
  },
  photoViewerSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  photoClose: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoViewerBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payInput: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 12,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  uploadBtn: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  receiptPreview: {
    marginTop: 10,
    height: 140,
    borderRadius: 12,
    backgroundColor: '#F4F9FD',
  },
  rejectOverlay: modal.overlay,
  rejectCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 18,
  },
  rejectHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rejectTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  rejectWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDECEC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  rejectWarnText: {
    flex: 1,
    color: RED,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  rejectLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  rejectSelect: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rejectSelectText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    paddingRight: 8,
  },
  rejectMenu: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: -8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  rejectOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  rejectOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rejectNotesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rejectCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  rejectNotes: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  rejectActions: {
    flexDirection: 'row',
    gap: 10,
  },
  rejectCancel: {
    ...modal.btn,
    borderWidth: 1.5,
  },
  rejectCancelText: {
    fontSize: 14,
    fontWeight: '800',
  },
  rejectConfirm: {
    ...modal.btn,
    backgroundColor: RED,
  },
  rejectConfirmText: modal.btnText,
  cancelOverlay: modal.overlay,
  cancelCard: modal.card,
  cancelClose: modal.close,
  cancelIconWrap: {
    ...modal.icon,
    backgroundColor: MODAL_COLORS.redSoft,
  },
  cancelTitle: modal.title,
  cancelBody: modal.body,
  cancelSummary: {
    alignSelf: 'stretch',
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  cancelSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  cancelSummaryLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  cancelSummaryValue: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  cancelActions: modal.actions,
  cancelKeep: {
    ...modal.btn,
    ...modal.btnGhost,
  },
  cancelKeepText: modal.btnGhostText,
  cancelConfirm: {
    ...modal.btn,
    backgroundColor: RED,
  },
  cancelConfirmText: modal.btnText,
  datePickerField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  datePickerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  cancelLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  cancelWideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: RED,
  },
  cancelWideText: {
    color: RED,
    fontSize: 15,
    fontWeight: '800',
  },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  confirmedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1FA971',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmedDivider: {
    width: 1,
    alignSelf: 'stretch',
  },
  confirmedCopy: {
    flex: 1,
  },
  confirmedTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  confirmedBody: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '500',
  },
  confirmedStrong: {
    fontWeight: '800',
  },
  cancelLinkText: {
    color: RED,
    fontSize: 13,
    fontWeight: '700',
  },
  cancelReasonWrap: {
    alignSelf: 'stretch',
    marginTop: 12,
    gap: 8,
  },
  cancelChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cancelChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cancelChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cancelReasonInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 60,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  cancelReasonError: {
    color: RED,
    fontSize: 12,
    fontWeight: '600',
  },
  cancelPolicyLink: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
