import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

import { SAFESAKAY_LOGO } from '@/components/brand-lockup';
import { passengerName } from '@/lib/operator';
import type { MobileBooking, XenditPaymentReceipt } from '@/lib/types';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusTone(status: MobileBooking['status']) {
  if (status === 'approved' || status === 'completed') {
    return { bg: '#DFF6EA', color: '#1FA971' };
  }
  if (status === 'cancelled') {
    return { bg: '#FDECEC', color: '#E25C5C' };
  }
  return { bg: '#FDE8DC', color: '#C05621' };
}

async function logoDataUri(): Promise<string | null> {
  try {
    const asset = Asset.fromModule(SAFESAKAY_LOGO);
    await asset.downloadAsync();
    if (!asset.localUri) {
      return null;
    }

    const data = await FileSystem.readAsStringAsync(asset.localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/png;base64,${data}`;
  } catch {
    return null;
  }
}

function row(label: string, value: string) {
  return `
    <tr>
      <td class="label">${escapeHtml(label)}</td>
      <td class="value">${escapeHtml(value || '—')}</td>
    </tr>
  `;
}

function downPaymentWhenLabel(booking: MobileBooking) {
  const when = booking.down_payment_recorded_at_label || booking.payment_verified_at_label || booking.payment_submitted_at_label;
  if (!when) {
    return '';
  }
  if (booking.down_payment_recorded_at_kind === 'verified') {
    return row('Down Payment Verified On', when);
  }
  if (booking.down_payment_recorded_at_kind === 'submitted') {
    return row('Down Payment Submitted On', when);
  }
  if (booking.down_payment_recorded_at_kind === 'recorded') {
    return row('Down Payment Recorded On', when);
  }
  return row('Down Payment Date & Time', when);
}

function paymentSection(booking: MobileBooking) {
  const commission = booking.commission?.enabled
    ? row(
        'Included barangay commission',
        [booking.commission.amount_label, booking.commission.percentage_label ? `(${booking.commission.percentage_label})` : '']
          .filter(Boolean)
          .join(' ') || '—',
      )
    : '';

  return `
      <h3>Transaction History</h3>
      <table class="details">
        ${row('Total Rental Price', booking.rental_price_label || '—')}
        ${commission}
        ${row('Down Payment', booking.down_payment_amount_label || '—')}
        ${row('Down Payment Method', booking.down_payment_method_label || 'GCash')}
        ${row('Down Payment Status', booking.payment_status_label || booking.payment_status || '—')}
        ${downPaymentWhenLabel(booking)}
        ${booking.gcash_reference ? row('GCash Reference Number', booking.gcash_reference) : ''}
        ${row('Remaining Balance', booking.remaining_balance_label || '—')}
        ${row('Balance Method', booking.balance_method_label || booking.balance_method || '—')}
        ${row('Balance Status', booking.balance_status_label || booking.balance_status || '—')}
        ${booking.balance_paid_at_label ? row('Balance Recorded On', booking.balance_paid_at_label) : ''}
        ${booking.balance_reference ? row('Balance Reference', booking.balance_reference) : ''}
        ${row('Total Paid', booking.total_paid_label || '—')}
        ${
          booking.overall_payment_status_label || booking.overall_payment_status
            ? row('Overall Payment', booking.overall_payment_status_label || booking.overall_payment_status || '—')
            : ''
        }
      </table>
  `;
}

export async function bookingSlipHtml(booking: MobileBooking): Promise<string> {
  const tone = statusTone(booking.status);
  const logo = await logoDataUri();
  const booker = passengerName(booking);
  const operator = booking.operator;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>SafeSakay Rental Slip ${escapeHtml(booking.code)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 28px;
      font-family: Arial, Helvetica, sans-serif;
      color: #1B2744;
      background: #ffffff;
    }
    .slip {
      max-width: 720px;
      margin: 0 auto;
      border: 1px solid #D7E4F5;
      border-radius: 18px;
      overflow: hidden;
    }
    .header {
      background: #1A5AD7;
      color: #ffffff;
      padding: 22px 24px;
    }
    .brand {
      width: 100%;
      border-collapse: collapse;
    }
    .brand td { vertical-align: middle; }
    .logo { width: 52px; height: 42px; object-fit: contain; }
    .brand-name { font-size: 22px; font-weight: 800; letter-spacing: 1px; }
    .brand-tag { margin-top: 2px; font-size: 12px; opacity: 0.9; }
    .status {
      display: inline-block;
      margin-top: 14px;
      background: ${tone.bg};
      color: ${tone.color};
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      padding: 6px 10px;
      border-radius: 999px;
    }
    .body { padding: 22px 24px 8px; }
    h2 {
      margin: 0 0 6px;
      font-size: 20px;
      color: #1B2744;
    }
    .code { margin: 0 0 16px; color: #3F4A63; font-size: 13px; }
    table.details, table.manifest {
      width: 100%;
      border-collapse: collapse;
    }
    table.details td {
      padding: 9px 0;
      border-bottom: 1px solid #EEF3FA;
      font-size: 13px;
    }
    td.label { width: 42%; color: #3F4A63; }
    td.value { font-weight: 700; text-align: right; }
    h3 {
      margin: 22px 0 10px;
      font-size: 13px;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      color: #1A5AD7;
    }
    table.manifest th, table.manifest td {
      border: 1px solid #D7E4F5;
      padding: 8px 10px;
      font-size: 12px;
      text-align: left;
    }
    table.manifest th {
      background: #F3F7FF;
      color: #3F4A63;
      font-size: 11px;
      text-transform: uppercase;
    }
    .note {
      margin-top: 16px;
      padding: 12px 14px;
      background: #F3F7FF;
      border-radius: 12px;
      color: #1B2744;
      font-size: 12px;
      line-height: 1.45;
    }
    .footer {
      padding: 16px 24px 22px;
      color: #3F4A63;
      font-size: 11px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="slip">
    <div class="header">
      <table class="brand">
        <tr>
          <td style="width:64px;">
            ${logo ? `<img class="logo" src="${logo}" alt="SafeSakay" />` : ''}
          </td>
          <td>
            <div class="brand-name">SAFESAKAY</div>
            <div class="brand-tag">Safer Boats, Safe Trips, SafeSakay</div>
          </td>
        </tr>
      </table>
      <div class="status">${escapeHtml(booking.status_label.toUpperCase())}</div>
    </div>
    <div class="body">
      <h2>${booking.status === 'completed' ? 'Trip Receipt' : 'Rental Slip'}</h2>
      <p class="code">Booking Reference: ${escapeHtml(booking.code)}</p>
      <table class="details">
        ${row('Passenger', booker)}
        ${row('Contact Number', booking.passenger?.contact_number || '—')}
        ${row('Boat', `${booking.boat.name} (${booking.boat.code})`)}
        ${row(
          'Assigned Operator',
          operator?.full_name || booking.boat.operator_name || '—',
        )}
        ${row(
          'Booking Date & Time',
          booking.created_at_label && booking.created_at_time_label
            ? `${booking.created_at_label} · ${booking.created_at_time_label}`
            : booking.created_at_label || '—',
        )}
        ${row('Rental Date', booking.booking_date_label)}
        ${row('Departure Time', booking.start_time_label)}
        ${row('Destination', booking.destination)}
        ${row('Pickup Point', booking.pickup_point || '—')}
        ${row('Number of Passengers', String(booking.passenger_count))}
        ${
          booking.status === 'completed'
            ? row(
                'Completed Date & Time',
                booking.completed_at_date_label && booking.completed_at_time_label
                  ? `${booking.completed_at_date_label} · ${booking.completed_at_time_label}`
                  : booking.completed_at_label || '—',
              )
            : ''
        }
        ${row('Purpose of trip', booking.purpose || '—')}
        ${row('Additional notes', booking.remarks || '—')}
      </table>
      ${paymentSection(booking)}
      <div class="note">Keep this slip during boarding. Show the payment details and GCash reference to the boat operator if asked.</div>
    </div>
    <div class="footer">SafeSakay barangay boat rental · Generated for ${escapeHtml(booking.code)}</div>
  </div>
</body>
</html>`;
}

export async function downloadBookingSlip(booking: MobileBooking): Promise<void> {
  const html = await bookingSlipHtml(booking);
  const filename = `SafeSakay-${booking.status === 'completed' ? 'Receipt' : 'Rental-Slip'}-${booking.code.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`;
  const printed = await Print.printToFileAsync({
    html,
    base64: true,
  });

  if (Platform.OS === 'web') {
    return;
  }

  const destDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!destDir) {
    throw new Error('Could not save the rental slip on this device.');
  }

  const dest = `${destDir}${filename}`;
  await FileSystem.deleteAsync(dest, { idempotent: true });

  if (printed.base64) {
    await FileSystem.writeAsStringAsync(dest, printed.base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } else {
    await FileSystem.copyAsync({
      from: toFileUri(printed.uri),
      to: dest,
    });
  }

  const saved = await FileSystem.getInfoAsync(dest);
  if (!saved.exists) {
    throw new Error('Could not save the rental slip on this device.');
  }

  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(dest, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: booking.status === 'completed' ? 'Download Receipt' : 'Download Rental Slip',
      });
      return;
    }
  } catch {
    // Expo Go on Android can block sharing some local URIs. Save with the folder picker instead.
  }

  if (Platform.OS === 'android') {
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      throw new Error('Choose a folder to save the rental slip.');
    }

    const data =
      printed.base64 ??
      (await FileSystem.readAsStringAsync(dest, {
        encoding: FileSystem.EncodingType.Base64,
      }));
    const safUri = await FileSystem.StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      filename,
      'application/pdf',
    );
    await FileSystem.writeAsStringAsync(safUri, data, {
      encoding: FileSystem.EncodingType.Base64,
    });
    Alert.alert('Rental slip saved', 'The PDF was saved to the folder you selected.');
    return;
  }

  await Print.printAsync({ html });
}

async function xenditPaymentReceiptHtml(
  booking: MobileBooking,
  receipt: XenditPaymentReceipt,
): Promise<string> {
  const logo = await logoDataUri();
  const booker = passengerName(booking);
  const code = receipt.booking_code || booking.code;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>SafeSakay Payment Receipt ${escapeHtml(code)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 28px; font-family: Arial, Helvetica, sans-serif; color: #1B2744; background: #fff; }
    .slip { max-width: 720px; margin: 0 auto; border: 1px solid #D7E4F5; border-radius: 18px; overflow: hidden; }
    .header { background: #1A5AD7; color: #fff; padding: 22px 24px; }
    .brand { width: 100%; border-collapse: collapse; }
    .brand td { vertical-align: middle; }
    .logo { width: 52px; height: 42px; object-fit: contain; }
    .brand-name { font-size: 22px; font-weight: 800; letter-spacing: 1px; }
    .brand-tag { margin-top: 2px; font-size: 12px; opacity: 0.9; }
    .body { padding: 22px 24px 24px; }
    h2 { margin: 0 0 6px; font-size: 20px; }
    .code { margin: 0 0 16px; color: #3F4A63; font-size: 13px; }
    table.details { width: 100%; border-collapse: collapse; }
    table.details td { padding: 9px 0; border-bottom: 1px solid #EEF3FA; font-size: 13px; }
    td.label { width: 42%; color: #3F4A63; }
    td.value { font-weight: 700; text-align: right; }
    .note { margin-top: 16px; padding: 12px 14px; background: #F3F7FF; border-radius: 12px; font-size: 12px; line-height: 1.5; color: #3F4A63; }
    .footer { margin-top: 18px; text-align: center; font-size: 11px; color: #7A879C; }
  </style>
</head>
<body>
  <div class="slip">
    <div class="header">
      <table class="brand"><tr>
        <td style="width:58px">${logo ? `<img class="logo" src="${logo}" alt="" />` : ''}</td>
        <td><div class="brand-name">SAFESAKAY</div><div class="brand-tag">Payment receipt · GCash via Xendit</div></td>
      </tr></table>
    </div>
    <div class="body">
      <h2>Online payment confirmed</h2>
      <p class="code">Booking ${escapeHtml(code)}</p>
      <table class="details">
        ${row('Passenger', booker)}
        ${row('Boat', booking.boat?.name || '—')}
        ${row('Trip date', booking.booking_date_label || '—')}
        ${row('Payment type', receipt.payment_type || '—')}
        ${row('Amount paid', receipt.amount_label)}
        ${receipt.provider_payment_id ? row('Payment reference', receipt.provider_payment_id) : ''}
        ${receipt.paid_at_label ? row('Paid on', receipt.paid_at_label) : ''}
      </table>
      <div class="note">This receipt confirms that your online payment was recorded. Keep it for your records and show it to the boat operator if asked.</div>
    </div>
    <div class="footer">SafeSakay barangay boat rental · Generated for ${escapeHtml(code)}</div>
  </div>
</body>
</html>`;
}

export async function downloadXenditPaymentReceipt(
  booking: MobileBooking,
  receipt: XenditPaymentReceipt,
): Promise<void> {
  const html = await xenditPaymentReceiptHtml(booking, receipt);
  const filename = `SafeSakay-Receipt-${booking.code.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`;
  const printed = await Print.printToFileAsync({
    html,
    base64: true,
  });

  if (Platform.OS === 'web') {
    return;
  }

  const destDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!destDir) {
    throw new Error('Could not save the receipt on this device.');
  }

  const dest = `${destDir}${filename}`;
  await FileSystem.deleteAsync(dest, { idempotent: true });

  if (printed.base64) {
    await FileSystem.writeAsStringAsync(dest, printed.base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } else {
    await FileSystem.copyAsync({
      from: toFileUri(printed.uri),
      to: dest,
    });
  }

  const saved = await FileSystem.getInfoAsync(dest);
  if (!saved.exists) {
    throw new Error('Could not save the receipt on this device.');
  }

  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(dest, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Payment receipt',
      });
      return;
    }
  } catch {
    // fall through to SAF / print
  }

  if (Platform.OS === 'android') {
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      throw new Error('Choose a folder to save the receipt.');
    }

    const data =
      printed.base64 ??
      (await FileSystem.readAsStringAsync(dest, {
        encoding: FileSystem.EncodingType.Base64,
      }));
    const safUri = await FileSystem.StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      filename,
      'application/pdf',
    );
    await FileSystem.writeAsStringAsync(safUri, data, {
      encoding: FileSystem.EncodingType.Base64,
    });
    Alert.alert('Receipt saved', 'The PDF was saved to the folder you selected.');
    return;
  }

  await Print.printAsync({ html });
}

function toFileUri(uri: string) {
  if (uri.startsWith('file://') || uri.startsWith('content://')) {
    return uri;
  }

  return `file://${uri}`;
}
