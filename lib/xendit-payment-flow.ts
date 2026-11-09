import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { createXenditCheckout, fetchBooking } from '@/lib/bookings';
import type { MobileBooking, OnlinePaymentPayload, XenditCheckoutPlan } from '@/lib/types';

export type XenditPaymentPlan = 'downpayment' | 'full_rental' | 'full_payment';

export function onlinePaymentFor(booking: MobileBooking | null): OnlinePaymentPayload | null {
  if (!booking) {
    return null;
  }

  return booking.xendit ?? booking.online_payment ?? null;
}

export function checkoutPlanFor(
  booking: MobileBooking,
  plan: XenditPaymentPlan,
): XenditCheckoutPlan | null {
  const plans = onlinePaymentFor(booking)?.checkout_plans;
  if (!plans) {
    return null;
  }

  return plans[plan] ?? null;
}

export function isXenditPaymentConfirmed(booking: MobileBooking, plan: XenditPaymentPlan): boolean {
  const receipt = onlinePaymentFor(booking)?.payment_receipt;
  if (receipt?.payment_type === plan) {
    return true;
  }

  if (plan === 'full_payment') {
    return booking.balance_status === 'paid';
  }

  if (plan === 'full_rental') {
    return booking.balance_status === 'paid' || booking.overall_payment_status === 'paid';
  }

  return booking.payment_status === 'verified';
}

export async function resolveCheckoutUrl(
  bookingId: number,
  plan: XenditPaymentPlan,
  online: OnlinePaymentPayload | null,
  policyVersion: string,
  appReturnUrl?: string,
): Promise<string> {
  if (!appReturnUrl && online?.checkout_pending && online.checkout_url && online.checkout_payment_type === plan) {
    return online.checkout_url;
  }

  const session = await createXenditCheckout(bookingId, plan, policyVersion, appReturnUrl);
  if (!session.checkout_url) {
    throw new Error('Checkout URL missing from server.');
  }

  return session.checkout_url;
}

export const XENDIT_APP_RETURN_PATH = 'xendit-return';

/** App link (exp:// in Expo Go, safesakay:// in builds) the server return page redirects to. */
export function xenditAppReturnUrl(): string {
  return Linking.createURL(XENDIT_APP_RETURN_PATH);
}

export function isCancelledXenditReturn(result: WebBrowser.WebBrowserAuthSessionResult): boolean {
  return result.type === 'success' && /[?&]cancelled=1\b/.test(result.url);
}

export async function openXenditGcashBrowser(
  checkoutUrl: string,
  successReturnUrl: string,
): Promise<WebBrowser.WebBrowserAuthSessionResult> {
  if (Platform.OS === 'web') {
    await WebBrowser.openBrowserAsync(checkoutUrl, {
      showInRecents: true,
      enableBarCollapsing: true,
    });

    return { type: WebBrowser.WebBrowserResultType.CANCEL };
  }

  WebBrowser.maybeCompleteAuthSession();

  return WebBrowser.openAuthSessionAsync(checkoutUrl, successReturnUrl, {
    showInRecents: true,
    preferEphemeralSession: false,
  });
}

export type PollResult =
  | { status: 'confirmed'; booking: MobileBooking }
  | { status: 'timeout'; booking: MobileBooking }
  | { status: 'cancelled'; booking: MobileBooking };

export async function pollUntilXenditConfirmed(
  bookingId: number,
  plan: XenditPaymentPlan,
  options?: {
    maxAttempts?: number;
    intervalMs?: number;
    isCancelled?: () => boolean;
  },
): Promise<PollResult> {
  const maxAttempts = options?.maxAttempts ?? 45;
  const intervalMs = options?.intervalMs ?? 2000;

  let latest = await fetchBooking(bookingId);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (options?.isCancelled?.()) {
      return { status: 'cancelled', booking: latest };
    }

    if (isXenditPaymentConfirmed(latest, plan)) {
      return { status: 'confirmed', booking: latest };
    }

    await sleep(intervalMs);
    latest = await fetchBooking(bookingId);
  }

  return { status: 'timeout', booking: latest };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
