'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { submitFieldPickReportClient } from '@/lib/field-sales-client';
import type { FieldPick, SalePaymentMethod } from '@/lib/erp-types';
import { formatUgx } from '@/lib/currency';
import {
  AlertTriangle,
  Banknote,
  ClipboardCheck,
  ShoppingCart,
  Smartphone,
  Undo2,
  X,
} from 'lucide-react';

interface SubmitReportModalProps {
  pick: FieldPick | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PAYMENT_METHODS: {
  value: SalePaymentMethod;
  label: string;
  icon: typeof Banknote;
}[] = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
];

export default function SubmitReportModal({
  pick,
  open,
  onClose,
  onSuccess,
}: SubmitReportModalProps) {
  const [quantities, setQuantities] = useState<
    Record<string, { sold: number; returned: number }>
  >({});
  const [paymentMethod, setPaymentMethod] =
    useState<SalePaymentMethod>('cash');
  const [amountCollected, setAmountCollected] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !pick) return;
    const initial: Record<string, { sold: number; returned: number }> = {};
    for (const item of pick.items) {
      initial[item.productId] = { sold: 0, returned: 0 };
    }
    setQuantities(initial);
    setPaymentMethod('cash');
    setAmountCollected('');
    setNotes('');
  }, [open, pick]);

  const rows = useMemo(() => {
    if (!pick) return [];
    return pick.items.map((item) => {
      const entry = quantities[item.productId] ?? { sold: 0, returned: 0 };
      const missing =
        item.quantityPicked - entry.sold - entry.returned;
      const lineRevenue = entry.sold * item.unitPrice;
      return { item, ...entry, missing, lineRevenue };
    });
  }, [pick, quantities]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        sold: acc.sold + row.sold,
        returned: acc.returned + row.returned,
        missing: acc.missing + Math.max(0, row.missing),
        revenue: acc.revenue + row.lineRevenue,
      }),
      { sold: 0, returned: 0, missing: 0, revenue: 0 }
    );
  }, [rows]);

  const hasDiscrepancy = totals.missing > 0;
  const hasInvalidRow = rows.some((row) => row.missing < 0);

  const setAllSold = () => {
    if (!pick) return;
    const next: Record<string, { sold: number; returned: number }> = {};
    for (const item of pick.items) {
      next[item.productId] = { sold: item.quantityPicked, returned: 0 };
    }
    setQuantities(next);
  };

  const setAllReturned = () => {
    if (!pick) return;
    const next: Record<string, { sold: number; returned: number }> = {};
    for (const item of pick.items) {
      next[item.productId] = { sold: 0, returned: item.quantityPicked };
    }
    setQuantities(next);
  };

  const updateQty = (
    productId: string,
    field: 'sold' | 'returned',
    value: number
  ) => {
    setQuantities((prev) => ({
      ...prev,
      [productId]: {
        sold: field === 'sold' ? value : (prev[productId]?.sold ?? 0),
        returned:
          field === 'returned' ? value : (prev[productId]?.returned ?? 0),
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pick || hasInvalidRow) return;

    setIsSubmitting(true);
    try {
      await submitFieldPickReportClient({
        pickId: pick.id,
        items: pick.items.map((item) => ({
          productId: item.productId,
          quantitySold: quantities[item.productId]?.sold ?? 0,
          quantityReturned: quantities[item.productId]?.returned ?? 0,
        })),
        paymentMethod,
        amountCollected: parseFloat(amountCollected) || totals.revenue,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      toast.success('End-of-day report submitted');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to submit report'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open || !pick) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
              <ClipboardCheck size={20} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Submit end-of-day report
              </h3>
              <p className="text-sm text-slate-500">
                {pick.agentName} · {pick.items.length} product
                {pick.items.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {hasDiscrepancy && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {totals.missing} unit{totals.missing === 1 ? '' : 's'} unaccounted
                </p>
                <p className="text-xs text-amber-800">
                  Missing stock will be recorded as lost automatically. Add a note
                  explaining the discrepancy if possible.
                </p>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Line items</p>
                <p className="text-xs text-slate-500">
                  Fill each row manually or apply a quick fill to all products.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={setAllSold}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <ShoppingCart size={15} className="shrink-0" />
                  All Sold
                </button>
                <button
                  type="button"
                  onClick={setAllReturned}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                >
                  <Undo2 size={15} className="shrink-0" />
                  All Returned
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-3 py-3 text-center font-semibold">Picked</th>
                  <th className="px-3 py-3 text-center font-semibold">Sold</th>
                  <th className="px-3 py-3 text-center font-semibold">Returned</th>
                  <th className="px-3 py-3 text-center font-semibold">Missing</th>
                  <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.item.productId}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">
                        {row.item.productName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatUgx(row.item.unitPrice)} each
                      </p>
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-slate-700">
                      {row.item.quantityPicked}
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min={0}
                        max={row.item.quantityPicked}
                        value={row.sold}
                        onChange={(e) =>
                          updateQty(
                            row.item.productId,
                            'sold',
                            parseInt(e.target.value, 10) || 0
                          )
                        }
                        className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-center text-sm"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min={0}
                        max={row.item.quantityPicked}
                        value={row.returned}
                        onChange={(e) =>
                          updateQty(
                            row.item.productId,
                            'returned',
                            parseInt(e.target.value, 10) || 0
                          )
                        }
                        className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-center text-sm"
                      />
                    </td>
                    <td
                      className={`px-3 py-3 text-center font-semibold ${
                        row.missing < 0
                          ? 'text-red-600'
                          : row.missing > 0
                            ? 'text-amber-600'
                            : 'text-slate-500'
                      }`}
                    >
                      {row.missing}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatUgx(row.lineRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Payment method
              </p>
              <div className="flex gap-2">
                {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPaymentMethod(value)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                      paymentMethod === value
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Amount collected
              </label>
              <input
                type="number"
                min={0}
                value={amountCollected}
                onChange={(e) => setAmountCollected(e.target.value)}
                placeholder={String(totals.revenue)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Notes {hasDiscrepancy && '(recommended)'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes about today's field sales…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">Sold</p>
              <p className="text-lg font-bold text-slate-900">{totals.sold}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Returned</p>
              <p className="text-lg font-bold text-slate-900">{totals.returned}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Missing</p>
              <p
                className={`text-lg font-bold ${
                  totals.missing > 0 ? 'text-amber-600' : 'text-slate-900'
                }`}
              >
                {totals.missing}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Revenue</p>
              <p className="text-lg font-bold text-emerald-700">
                {formatUgx(totals.revenue)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || hasInvalidRow}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting…' : 'Finalize report'}
          </button>
        </div>
      </form>
    </div>
  );
}
