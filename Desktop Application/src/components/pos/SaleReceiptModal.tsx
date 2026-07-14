import { Link } from 'react-router-dom';
import type { Sale } from '@/lib/types';
import { formatUgx } from '@/lib/currency';
import Receipt from '@/components/pos/Receipt';
import { printSaleReceipt } from '@/lib/print-receipt';
import { CheckCircle2, ExternalLink, Printer, Undo2, X } from 'lucide-react';

interface SaleReceiptModalProps {
  sale: Sale | null;
  open: boolean;
  onClose: () => void;
  onVoid?: () => void;
  canProcessRefunds?: boolean;
  isBusy?: boolean;
}

export default function SaleReceiptModal({
  sale,
  open,
  onClose,
  onVoid,
  canProcessRefunds = false,
  isBusy = false,
}: SaleReceiptModalProps) {
  if (!open || !sale) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-4">
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

        <div className="flex-1 overflow-y-auto bg-slate-100 px-4 py-5">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <Receipt sale={sale} />
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white px-5 py-4">
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
              to={`/sales/${sale.id}`}
              onClick={onClose}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              <ExternalLink size={18} />
              View details
            </Link>
          </div>

          {sale.status === 'completed' && canProcessRefunds && onVoid && (
            <button
              type="button"
              onClick={onVoid}
              disabled={isBusy}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              <Undo2 size={16} />
              Void sale
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
