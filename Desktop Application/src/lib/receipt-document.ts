import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';
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

const BUSINESS_PHONE = '+256 700 000 000';
const SITE_URL = 'www.mscoatings.shop';

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

  .brand-name {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .brand-tagline {
    margin: 2px 0 0;
    font-size: 9px;
    color: #4b5563;
    letter-spacing: 0.04em;
  }

  .brand-meta {
    margin: 4px 0 0;
    font-size: 9px;
    color: #6b7280;
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

export function buildReceiptPrintDocument(sale: Sale): string {
  const date = getSaleDate(sale.createdAt);
  const itemsHtml = sale.items
    .map((item) => {
      const barcode = item.barcode
        ? `<div class="item-code">${escapeHtml(item.barcode)}</div>`
        : '';
      return `
        <tr>
          <td>
            <div class="item-name">${escapeHtml(item.name)}</div>
            ${barcode}
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

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(sale.receiptNumber)}</title>
    <style>${RECEIPT_PRINT_STYLES}</style>
  </head>
  <body>
    <div class="receipt">
      <div class="brand">
        <h1 class="brand-name">${escapeHtml(BRAND_NAME)}</h1>
        <p class="brand-tagline">${escapeHtml(BRAND_TAGLINE)}</p>
        <p class="brand-meta">Kampala, Uganda · ${escapeHtml(BUSINESS_PHONE)}</p>
      </div>

      <hr class="rule" />

      <p class="doc-title">Sales Receipt</p>

      <div class="meta"><span>Receipt No.</span><span>${escapeHtml(sale.receiptNumber)}</span></div>
      <div class="meta"><span>Date</span><span>${escapeHtml(formatReceiptDate(date))}</span></div>
      <div class="meta"><span>Cashier</span><span>${escapeHtml(formatCashier(sale.cashierEmail))}</span></div>
      ${customerHtml}

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
        <span>${escapeHtml(SITE_URL)}</span>
      </div>
    </div>
  </body>
</html>`;
}
