import type { OperatorCommission } from '@/lib/commissions';
import { unpaidCommissions } from '@/lib/commissions';
import { passengerName } from '@/lib/operator';
import { escapeHtml, logoDataUri, saveAndSharePdf } from '@/lib/pdf-share';
import type { AuthUser, MobileBooking } from '@/lib/types';

function peso(value: number) {
  return `PHP ${Number(value || 0).toFixed(2)}`;
}

function stamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function reportShell(input: {
  logo: string | null;
  title: string;
  subtitle: string;
  operator: AuthUser | null;
  summary: string;
  tableHead: string;
  tableBody: string;
}) {
  const logo = input.logo
    ? `<img class="logo" src="${input.logo}" alt="SafeSakay" />`
    : '';
  const operatorName = escapeHtml(input.operator?.name || 'Operator');
  const barangay = escapeHtml(input.operator?.organization?.name || '—');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; font-family: Arial, Helvetica, sans-serif; color: #1B2744; background: #fff; }
    .sheet { max-width: 900px; margin: 0 auto; border: 1px solid #D7E4F5; border-radius: 16px; overflow: hidden; }
    .header { background: #1A5AD7; color: #fff; padding: 20px 22px; }
    .brand { width: 100%; border-collapse: collapse; }
    .brand td { vertical-align: middle; }
    .logo { width: 48px; height: 38px; object-fit: contain; }
    .brand-name { font-size: 20px; font-weight: 800; letter-spacing: 0.8px; }
    .brand-tag { margin-top: 2px; font-size: 12px; opacity: 0.9; }
    .body { padding: 20px 22px 10px; }
    h2 { margin: 0 0 4px; font-size: 20px; }
    .meta { margin: 0 0 14px; color: #3F4A63; font-size: 12px; line-height: 18px; }
    .summary { display: block; margin: 0 0 16px; padding: 10px 12px; background: #EEF4FF; border-radius: 10px; font-size: 13px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th, td { font-size: 11px; text-align: left; padding: 8px 6px; border-bottom: 1px solid #EEF3FA; vertical-align: top; }
    th { color: #3F4A63; font-weight: 800; }
    .footer { padding: 12px 22px 18px; color: #3F4A63; font-size: 11px; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <table class="brand"><tr>
        <td style="width:56px">${logo}</td>
        <td>
          <div class="brand-name">SAFESAKAY</div>
          <div class="brand-tag">Operator export</div>
        </td>
      </tr></table>
    </div>
    <div class="body">
      <h2>${escapeHtml(input.title)}</h2>
      <p class="meta">
        ${escapeHtml(input.subtitle)}<br />
        Operator: ${operatorName} · Barangay: ${barangay}<br />
        Generated: ${escapeHtml(stamp())}
      </p>
      <div class="summary">${escapeHtml(input.summary)}</div>
      <table>
        <thead><tr>${input.tableHead}</tr></thead>
        <tbody>${input.tableBody}</tbody>
      </table>
    </div>
    <div class="footer">SafeSakay operator record · For barangay and operator files only.</div>
  </div>
</body>
</html>`;
}

export async function exportCommissionReport(
  items: OperatorCommission[],
  operator: AuthUser | null,
): Promise<'shared' | 'saved'> {
  if (!items.length) {
    throw new Error('No commission records to export yet.');
  }

  const due = unpaidCommissions(items);
  const paid = items.filter((item) => item.status === 'paid');
  const dueTotal = due.reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);
  const paidTotal = paid.reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);
  const logo = await logoDataUri();
  const html = reportShell({
    logo,
    title: 'Commission Settlement',
    subtitle: 'Barangay share for completed exclusive rentals.',
    operator,
    summary: `${items.length} records · ${due.length} need settlement (${peso(dueTotal)}) · ${paid.length} paid (${peso(paidTotal)})`,
    tableHead:
      '<th>Code</th><th>Boat</th><th>Rental date</th><th>Rental</th><th>Share</th><th>Status</th><th>GCash ref</th>',
    tableBody: items
      .map(
        (item) => `<tr>
          <td>${escapeHtml(item.code || `COMM-${item.id}`)}</td>
          <td>${escapeHtml(item.boat_name || '—')}</td>
          <td>${escapeHtml(item.rental_date_label || item.rental_date || '—')}</td>
          <td>${escapeHtml(item.rental_amount_label || peso(item.rental_amount))}</td>
          <td>${escapeHtml(item.commission_amount_label || peso(item.commission_amount))} (${escapeHtml(item.commission_percentage_label || '')})</td>
          <td>${escapeHtml(item.status_label || item.status)}</td>
          <td>${escapeHtml(item.gcash_reference || '—')}</td>
        </tr>`,
      )
      .join(''),
  });

  return saveAndSharePdf({
    html,
    filename: `SafeSakay-Commissions-${stamp()}.pdf`,
    dialogTitle: 'Export commissions',
  });
}

export async function exportRentalReport(
  bookings: MobileBooking[],
  operator: AuthUser | null,
  filterLabel: string,
): Promise<'shared' | 'saved'> {
  if (!bookings.length) {
    throw new Error('No rentals in this list to export.');
  }

  const logo = await logoDataUri();
  const html = reportShell({
    logo,
    title: `Rental Requests · ${filterLabel}`,
    subtitle: 'Passenger rentals for this operator boats only.',
    operator,
    summary: `${bookings.length} rental${bookings.length === 1 ? '' : 's'} in ${filterLabel}`,
    tableHead:
      '<th>Rental ID</th><th>Passenger</th><th>Boat</th><th>Destination</th><th>Date & time</th><th>Pax</th><th>Status</th><th>Amount</th>',
    tableBody: bookings
      .map(
        (item) => `<tr>
          <td>${escapeHtml(item.code)}</td>
          <td>${escapeHtml(passengerName(item) || '—')}</td>
          <td>${escapeHtml(item.boat?.name || '—')}</td>
          <td>${escapeHtml(item.destination || '—')}</td>
          <td>${escapeHtml([item.booking_date_label || item.booking_date, item.start_time_label || item.start_time].filter(Boolean).join(' · '))}</td>
          <td>${escapeHtml(String(item.passenger_count || '—'))}</td>
          <td>${escapeHtml(item.status_label || item.status)}</td>
          <td>${escapeHtml(item.rental_price_label || '—')}</td>
        </tr>`,
      )
      .join(''),
  });

  const slug = filterLabel.replace(/[^A-Za-z0-9]+/g, '-');
  return saveAndSharePdf({
    html,
    filename: `SafeSakay-Rentals-${slug}-${stamp()}.pdf`,
    dialogTitle: 'Export rentals',
  });
}
