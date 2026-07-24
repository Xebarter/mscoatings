'use client';

import { BRAND_ASSETS } from '@/lib/brand';
import { formatUgx } from '@/lib/currency';
import type { Sale } from '@/lib/erp-types';
import {
  formatReceiptDate,
  getPaymentLabel,
  getSaleDate,
  RECEIPT_BUSINESS,
} from '@/lib/receipt-document';

interface ReceiptProps {
  sale: Sale;
}

function formatCashier(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Receipt({ sale }: ReceiptProps) {
  const date = getSaleDate(sale.createdAt);

  return (
    <div className="mx-auto w-full max-w-[80mm] bg-white px-4 py-5 font-sans text-[11px] leading-snug text-slate-900">
      <div className="text-center">
        <img
          src={BRAND_ASSETS.logo}
          alt={RECEIPT_BUSINESS.tradingName}
          width={48}
          height={48}
          className="mx-auto mb-1.5 h-12 w-12 rounded-lg object-contain"
        />
        <h2 className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-slate-900">
          {RECEIPT_BUSINESS.tradingName}
        </h2>
        <p className="mt-0.5 text-[9px] font-bold tracking-wide text-slate-800">
          {RECEIPT_BUSINESS.brandLine}
        </p>
        <p className="mt-1.5 text-[8.5px] leading-snug text-slate-600">
          {RECEIPT_BUSINESS.location}
        </p>
        <p className="mt-1 text-[7.5px] font-semibold uppercase leading-snug tracking-wide text-slate-500">
          {RECEIPT_BUSINESS.distributors}
        </p>
        <p className="mt-1.5 text-[8.5px] text-slate-600">{RECEIPT_BUSINESS.postal}</p>
        <div className="mt-1 text-[8.5px] font-semibold leading-relaxed text-slate-900">
          <p>Tel:</p>
          {RECEIPT_BUSINESS.phones.map((phone) => (
            <p key={phone}>{phone}</p>
          ))}
        </div>
      </div>

      <hr className="my-3 border-0 border-t border-dashed border-slate-300" />

      <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-slate-800">
        Sales Receipt
      </p>

      <div className="space-y-1 text-[10px]">
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">Receipt No.</span>
          <span className="text-right font-semibold">{sale.receiptNumber}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">Date</span>
          <span className="text-right font-semibold">
            {formatReceiptDate(date)}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">Cashier</span>
          <span className="text-right font-semibold">
            {formatCashier(sale.cashierEmail)}
          </span>
        </div>
        {sale.customerName && (
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Customer</span>
            <span className="text-right font-semibold">{sale.customerName}</span>
          </div>
        )}
        {sale.customerPhone && (
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Phone</span>
            <span className="text-right font-semibold">{sale.customerPhone}</span>
          </div>
        )}
      </div>

      <hr className="my-3 border-0 border-t border-dashed border-slate-300" />

      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[8px] uppercase tracking-wider text-slate-500">
            <th className="pb-1.5 font-semibold">Item</th>
            <th className="w-7 pb-1.5 text-center font-semibold">Qty</th>
            <th className="w-[72px] pb-1.5 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item, index) => (
            <tr
              key={`${item.productId}-${index}`}
              className="border-b border-slate-100"
            >
              <td className="py-1.5 pr-2 align-top">
                <p className="font-semibold leading-tight">{item.name}</p>
                {item.barcode && (
                  <p className="mt-0.5 text-[8px] text-slate-400">
                    {item.barcode}
                  </p>
                )}
              </td>
              <td className="py-1.5 text-center align-top">{item.quantity}</td>
              <td className="py-1.5 text-right align-top whitespace-nowrap">
                {formatUgx(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr className="my-3 border-0 border-t border-slate-900" />

      <div className="space-y-1 text-[10px]">
        <div className="flex justify-between text-slate-500">
          <span>Subtotal</span>
          <span>{formatUgx(sale.subtotal)}</span>
        </div>
        {sale.discountTotal > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Discount</span>
            <span>-{formatUgx(sale.discountTotal)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-slate-900 pt-2 text-xs font-bold">
          <span>Total</span>
          <span>{formatUgx(sale.totalAmount)}</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>Payment</span>
          <span>{getPaymentLabel(sale.paymentMethod)}</span>
        </div>
        {sale.paymentMethod === 'cash' &&
          sale.amountTendered != null &&
          (sale.changeGiven ?? 0) > 0 && (
          <>
            <div className="flex justify-between text-slate-500">
              <span>Tendered</span>
              <span>{formatUgx(sale.amountTendered)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Change</span>
              <span>{formatUgx(sale.changeGiven ?? 0)}</span>
            </div>
          </>
        )}
      </div>

      <hr className="my-3 border-0 border-t border-dashed border-slate-300" />

      <div className="text-center text-[9px] text-slate-500">
        <p className="mb-1 text-[10px] font-semibold text-slate-800">
          Thank you for your business
        </p>
        <p>Please retain this receipt for your records.</p>
        <p className="mt-1">{RECEIPT_BUSINESS.siteUrl}</p>
      </div>
    </div>
  );
}
