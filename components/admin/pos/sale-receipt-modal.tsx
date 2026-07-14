'use client';

import Link from 'next/link';
import type { Sale } from '@/lib/erp-types';
import { formatUgx } from '@/lib/currency';
import Receipt from '@/components/admin/pos/receipt';
import { printSaleReceipt } from '@/lib/print-receipt';
import { CheckCircle2, ExternalLink, Printer, ShoppingCart, Undo2, X } from 'lucide-react';

interface SaleReceiptModalProps {
  sale: Sale | null;
  open: boolean;
  onClose: () => void;
  onCancelSale?: () => void;
  isCancelling?: boolean;
}

export default function SaleReceiptModal({
  sale,
  open,
  onClose,
  onCancelSale,
  isCancelling = false,
}: SaleReceiptModalProps) {
  if (!open || !sale) return null;

  return (
    <div className="sale-receipt-modal fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 p-0 sm:items-center sm:p-4 print:bg-white print:p-0">
      <div className="sale-receipt-modal-panel flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl print:max-h-none print:max-w-none print:rounded-none print:shadow-none">
        {/* Header — hidden when printing */}
        <div className="sale-receipt-modal-chrome border-b border-emerald-100 bg-emerald-50 px-5 py-4 print:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 size={22} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-900">Sale completed</h3>
                <p className="text-sm text-emerald-700">
                  {sale.receiptNumber} · {formatUgx(sale.totalAmount)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-white/80"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Receipt preview */}
        <div className="sale-receipt-modal-body flex-1 overflow-y-auto bg-slate-100 px-4 py-5 print:overflow-visible print:bg-white print:p-0">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm print:border-0 print:shadow-none">
            <Receipt sale={sale} />
          </div>
        </div>

        {/* Actions — print-first */}
        <div className="sale-receipt-modal-chrome border-t border-slate-200 bg-white px-5 py-4 print:hidden">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => printSaleReceipt(sale)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              <Printer size={18} />
              Print receipt
            </button>
            <Link
              href={`/admin/sales/${sale.id}`}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              <ExternalLink size={18} />
              View details
            </Link>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            <ShoppingCart size={16} />
            New sale
          </button>
          {onCancelSale && (
            <button
              type="button"
              onClick={onCancelSale}
              disabled={isCancelling}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              <Undo2 size={16} />
              {isCancelling ? 'Cancelling…' : 'Cancel sale'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
