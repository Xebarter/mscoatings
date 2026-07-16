import { BRAND_ASSETS, BRAND_NAME } from '@/lib/brand';
import { formatUgx } from '@/lib/currency';
import type { Sale } from '@/lib/types';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Bank Transfer',
  card: 'Card',
  online: 'Online',
  credit: 'Credit / On Account',
};

/** Trading company details printed on POS receipts */
export const RECEIPT_BUSINESS = {
  tradingName: 'NEW PAINT SOLUTION',
  brandLine: BRAND_NAME,
  location: 'Located in Ndeeba Opp. ZMK near Ndeeba Railway Gate',
  distributors:
    'DISTRIBUTORS OF M.S COATINGS PRODUCTS and KAPCI AUTOMOTIVE PRODUCTS',
  postal: 'P.O. Box Kampala',
  phones: ['0776 656935', '0709 805 895'],
  siteUrl: 'www.mscoatings.shop',
} as const;

export function getReceiptLogoSrc(): string {
  return BRAND_ASSETS.logo;
}

export function getSaleDate(createdAt: Sale['createdAt']): Date {
  if (!createdAt) return new Date();
  if (
    typeof createdAt === 'object' &&
    'toDate' in createdAt &&
    typeof createdAt.toDate === 'function'
  ) {
    return createdAt.toDate();
  }
  if (typeof createdAt === 'object' && 'seconds' in createdAt) {
    return new Date((createdAt as { seconds: number }).seconds * 1000);
  }
  return new Date(String(createdAt));
}

export function formatReceiptDate(date: Date): string {
  return date.toLocaleString('en-UG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function getPaymentLabel(method: Sale['paymentMethod']): string {
  return PAYMENT_LABELS[method] ?? method;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCashier(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const RECEIPT_PRINT_STYLES = `
  @page {
    size: 80mm auto;
    margin: 0;
  }

  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
    width: 80mm;
    background: #fff;
    color: #111827;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    font-size: 11px;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .receipt {
    width: 80mm;
    padding: 5mm 4.5mm 4mm;
    page-break-inside: avoid;
    page-break-after: avoid;
  }

  .brand {
    text-align: center;
    margin-bottom: 8px;
  }

  .brand-logo {
    display: block;
    width: 48px;
    height: 48px;
    margin: 0 auto 6px;
    object-fit: contain;
    border-radius: 8px;
  }

  .brand-name {
    margin: 0;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    line-height: 1.25;
  }

  .brand-sub {
    margin: 3px 0 0;
    font-size: 9px;
    font-weight: 700;
    color: #1f2937;
    letter-spacing: 0.04em;
  }

  .brand-location {
    margin: 5px 0 0;
    font-size: 8.5px;
    color: #374151;
    line-height: 1.35;
  }

  .brand-distributors {
    margin: 4px 0 0;
    font-size: 7.5px;
    font-weight: 600;
    color: #4b5563;
    line-height: 1.35;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .brand-contact {
    margin: 5px 0 0;
    font-size: 8.5px;
    color: #4b5563;
    line-height: 1.4;
  }

  .brand-phones {
    margin: 2px 0 0;
    font-size: 8.5px;
    color: #111827;
    font-weight: 600;
    line-height: 1.45;
  }

  .rule {
    border: 0;
    border-top: 1px dashed #9ca3af;
    margin: 8px 0;
  }

  .rule-solid {
    border-top-style: solid;
    border-top-color: #111827;
  }

  .doc-title {
    text-align: center;
    margin: 0 0 8px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .meta {
    margin: 0 0 4px;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 10px;
  }

  .meta span:first-child {
    color: #6b7280;
    flex-shrink: 0;
  }

  .meta span:last-child {
    text-align: right;
    font-weight: 600;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }

  thead th {
    padding: 0 0 4px;
    border-bottom: 1px solid #d1d5db;
    color: #6b7280;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 8px;
    letter-spacing: 0.06em;
  }

  th.qty, td.qty {
    width: 28px;
    text-align: center;
  }

  th.amt, td.amt {
    width: 72px;
    text-align: right;
    white-space: nowrap;
  }

  tbody td {
    padding: 5px 0;
    vertical-align: top;
    border-bottom: 1px solid #f3f4f6;
  }

  .item-name {
    font-weight: 600;
    line-height: 1.25;
  }

  .item-code {
    margin-top: 1px;
    font-size: 8px;
    color: #9ca3af;
  }

  .totals {
    margin-top: 8px;
    font-size: 10px;
  }

  .total-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 3px;
  }

  .total-row.muted span:first-child {
    color: #6b7280;
  }

  .total-row.grand {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid #111827;
    font-size: 12px;
    font-weight: 700;
  }

  .footer {
    margin-top: 10px;
    text-align: center;
    font-size: 9px;
    color: #6b7280;
  }

  .footer strong {
    display: block;
    margin-bottom: 3px;
    color: #111827;
    font-size: 10px;
  }
`;

export function buildReceiptHeaderHtml(logoSrc?: string): string {
  const src = logoSrc || getReceiptLogoSrc();
  const phones = RECEIPT_BUSINESS.phones
    .map((phone) => escapeHtml(phone))
    .join('<br />');

  return `
      <div class="brand">
        <img class="brand-logo" src="${escapeHtml(src)}" alt="${escapeHtml(RECEIPT_BUSINESS.tradingName)}" />
        <h1 class="brand-name">${escapeHtml(RECEIPT_BUSINESS.tradingName)}</h1>
        <p class="brand-sub">${escapeHtml(RECEIPT_BUSINESS.brandLine)}</p>
        <p class="brand-location">${escapeHtml(RECEIPT_BUSINESS.location)}</p>
        <p class="brand-distributors">${escapeHtml(RECEIPT_BUSINESS.distributors)}</p>
        <p class="brand-contact">${escapeHtml(RECEIPT_BUSINESS.postal)}</p>
        <p class="brand-phones">Tel:<br />${phones}</p>
      </div>
  `;
}

export function buildReceiptPrintDocument(sale: Sale, logoSrc?: string): string {
  const date = getSaleDate(sale.createdAt);
  const itemsHtml = sale.items
    .map((item) => {
      return `
        <tr>
          <td>
            <div class="item-name">${escapeHtml(item.name)}</div>
          </td>
          <td class="qty">${item.quantity}</td>
          <td class="amt">${escapeHtml(formatUgx(item.lineTotal))}</td>
        </tr>
      `;
    })
    .join('');

  const discountHtml =
    sale.discountTotal > 0
      ? `<div class="total-row muted"><span>Discount</span><span>-${escapeHtml(formatUgx(sale.discountTotal))}</span></div>`
      : '';

  const cashHtml =
    sale.paymentMethod === 'cash' && sale.amountTendered != null
      ? `
        <div class="total-row muted"><span>Tendered</span><span>${escapeHtml(formatUgx(sale.amountTendered))}</span></div>
        <div class="total-row muted"><span>Change</span><span>${escapeHtml(formatUgx(sale.changeGiven ?? 0))}</span></div>
      `
      : '';

  const customerHtml = sale.customerName
    ? `<div class="meta"><span>Customer</span><span>${escapeHtml(sale.customerName)}</span></div>`
    : '';

  const referenceHtml = sale.paymentReference
    ? `<div class="meta"><span>Reference</span><span>${escapeHtml(sale.paymentReference)}</span></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(sale.receiptNumber)}</title>
    <style>${RECEIPT_PRINT_STYLES}</style>
  </head>
  <body>
    <div class="receipt">
      ${buildReceiptHeaderHtml(logoSrc)}

      <hr class="rule" />

      <p class="doc-title">Sales Receipt</p>

      <div class="meta"><span>Receipt No.</span><span>${escapeHtml(sale.receiptNumber)}</span></div>
      <div class="meta"><span>Date</span><span>${escapeHtml(formatReceiptDate(date))}</span></div>
      <div class="meta"><span>Cashier</span><span>${escapeHtml(formatCashier(sale.cashierEmail))}</span></div>
      ${customerHtml}
      ${referenceHtml}

      <hr class="rule" />

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th class="qty">Qty</th>
            <th class="amt">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <hr class="rule rule-solid" />

      <div class="totals">
        <div class="total-row muted"><span>Subtotal</span><span>${escapeHtml(formatUgx(sale.subtotal))}</span></div>
        ${discountHtml}
        <div class="total-row grand"><span>Total</span><span>${escapeHtml(formatUgx(sale.totalAmount))}</span></div>
        <div class="total-row muted"><span>Payment</span><span>${escapeHtml(getPaymentLabel(sale.paymentMethod))}</span></div>
        ${cashHtml}
      </div>

      <hr class="rule" />

      <div class="footer">
        <strong>Thank you for your business</strong>
        <span>Please retain this receipt for your records.</span>
        <br />
        <span>${escapeHtml(RECEIPT_BUSINESS.siteUrl)}</span>
      </div>
    </div>
  </body>
</html>`;
}
