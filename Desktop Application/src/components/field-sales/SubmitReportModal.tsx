import { useEffect, useMemo, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import {
  Banknote,
  ClipboardCheck,
  Info,
  ShoppingCart,
  Smartphone,
  Undo2,
  Wallet,
  X,
} from 'lucide-react';
import {
  getFieldAgentByIdClient,
  listFieldAgentTransactionsClient,
  recordFieldAgentDepositClient,
  submitFieldPickReportClient,
} from '@/lib/field-sales';
import type {
  FieldAgent,
  FieldAgentTransaction,
  FieldPick,
  SalePaymentMethod,
} from '@/lib/types';
import { formatUgx } from '@/lib/currency';
import { useOnline } from '@/hooks/useOnline';

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

function getTxLabel(type: FieldAgentTransaction['type']) {
  return type === 'deposit' ? 'Deposit' : 'Pick settlement';
}

export default function SubmitReportModal({
  pick,
  open,
  onClose,
  onSuccess,
}: SubmitReportModalProps) {
  const online = useOnline();
  const [quantities, setQuantities] = useState<
    Record<string, { sold: number; returned: number }>
  >({});
  const [agent, setAgent] = useState<FieldAgent | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<FieldAgentTransaction[]>(
    []
  );
  const [depositAmount, setDepositAmount] = useState('');
  const [depositPaymentMethod, setDepositPaymentMethod] =
    useState<SalePaymentMethod>('cash');
  const [depositNotes, setDepositNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDeposit, setIsSavingDeposit] = useState(false);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);

  useEffect(() => {
    if (!open || !pick) return;
    const initial: Record<string, { sold: number; returned: number }> = {};
    for (const item of pick.items) {
      initial[item.productId] = { sold: 0, returned: item.quantityPicked };
    }
    setQuantities(initial);
    setAgent(null);
    setRecentTransactions([]);
    setDepositAmount('');
    setDepositPaymentMethod('cash');
    setDepositNotes('');
    setNotes('');

    setIsLoadingMeta(true);
    void Promise.all([
      getFieldAgentByIdClient(pick.agentId),
      listFieldAgentTransactionsClient({ agentId: pick.agentId, limit: 5 }),
    ])
      .then(([agentData, txs]) => {
        setAgent(agentData);
        setRecentTransactions(txs);
      })
      .catch(() => {
        toast.error('Failed to load deposit history');
      })
      .finally(() => setIsLoadingMeta(false));
  }, [open, pick]);

  const rows = useMemo(() => {
    if (!pick) return [];
    return pick.items.map((item) => {
      const entry = quantities[item.productId] ?? { sold: 0, returned: 0 };
      const missing = item.quantityPicked - entry.sold - entry.returned;
      const lineRevenue = entry.sold * item.unitPrice;
      return { item, ...entry, missing, lineRevenue };
    });
  }, [pick, quantities]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        sold: acc.sold + row.sold,
        returned: acc.returned + row.returned,
        revenue: acc.revenue + row.lineRevenue,
      }),
      { sold: 0, returned: 0, revenue: 0 }
    );
  }, [rows]);

  const hasUnbalancedRow = rows.some((row) => row.missing !== 0);
  const hasInvalidRow = rows.some(
    (row) => row.missing < 0 || row.sold < 0 || row.returned < 0
  );
  const pickValue = useMemo(
    () =>
      (pick?.items ?? []).reduce(
        (sum, item) => sum + item.quantityPicked * item.unitPrice,
        0
      ),
    [pick]
  );
  const currentWalletBalance = Number(agent?.walletBalance ?? 0);
  const parsedDeposit = Number.parseFloat(depositAmount);
  const depositValue =
    Number.isFinite(parsedDeposit) && parsedDeposit > 0 ? parsedDeposit : 0;
  const availableWallet = currentWalletBalance + depositValue;
  const shortfall = Math.max(0, pickValue - availableWallet);

  const handleSaveDeposit = async () => {
    if (!pick) return;
    const value = Number.parseFloat(depositAmount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a valid deposit amount.');
      return;
    }
    if (depositNotes && depositNotes.length > 1000) {
      toast.error('Deposit notes must be 1000 characters or fewer.');
      return;
    }

    setIsSavingDeposit(true);
    try {
      await recordFieldAgentDepositClient(
        pick.agentId,
        value,
        depositPaymentMethod,
        depositNotes.trim() || undefined
      );
      toast.success('Deposit saved');
      setDepositAmount('');
      setDepositNotes('');

      const [agentData, txs] = await Promise.all([
        getFieldAgentByIdClient(pick.agentId),
        listFieldAgentTransactionsClient({ agentId: pick.agentId, limit: 5 }),
      ]);
      setAgent(agentData);
      setRecentTransactions(txs);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save deposit'
      );
    } finally {
      setIsSavingDeposit(false);
    }
  };

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
    if (!pick) return;
    const pickItem = pick.items.find((item) => item.productId === productId);
    if (!pickItem) return;
    const bounded = Math.max(0, Math.min(pickItem.quantityPicked, value));
    setQuantities((prev) => ({
      ...prev,
      [productId]: {
        sold: field === 'sold' ? bounded : pickItem.quantityPicked - bounded,
        returned:
          field === 'returned' ? bounded : pickItem.quantityPicked - bounded,
      },
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pick || hasInvalidRow || hasUnbalancedRow || shortfall > 0) return;

    setIsSubmitting(true);
    try {
      await submitFieldPickReportClient({
        pickId: pick.id,
        items: pick.items.map((item) => ({
          productId: item.productId,
          quantitySold: quantities[item.productId]?.sold ?? 0,
          quantityReturned: quantities[item.productId]?.returned ?? 0,
        })),
        ...(depositValue > 0 ? { depositAmount: depositValue } : {}),
        ...(depositValue > 0 ? { depositPaymentMethod } : {}),
        ...(depositNotes.trim() ? { depositNotes: depositNotes.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      toast.success(
        online
          ? 'Report submitted'
          : 'Report saved offline — will sync when online'
      );
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
              <h3 className="text-lg font-bold text-slate-900">Submit report</h3>
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
          <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Wallet size={16} className="text-violet-700" />
              <p className="text-sm font-semibold text-violet-900">
                Deposit and settlement
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-white px-3 py-2">
                <p className="text-xs text-slate-500">Current wallet</p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatUgx(currentWalletBalance)}
                </p>
              </div>
              <div className="rounded-lg bg-white px-3 py-2">
                <p className="text-xs text-slate-500">Pick value required</p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatUgx(pickValue)}
                </p>
              </div>
              <div className="rounded-lg bg-white px-3 py-2">
                <p className="text-xs text-slate-500">Shortfall</p>
                <p
                  className={`text-sm font-semibold ${
                    shortfall > 0 ? 'text-red-600' : 'text-emerald-700'
                  }`}
                >
                  {formatUgx(shortfall)}
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                type="number"
                min={0}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Deposit amount (optional)"
                className="rounded-lg border border-violet-200 px-3 py-2.5 text-sm"
              />
              <div className="flex gap-2">
                {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDepositPaymentMethod(value)}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-3 py-2 text-sm ${
                      depositPaymentMethod === value
                        ? 'border-violet-500 bg-violet-100 text-violet-800'
                        : 'border-violet-200 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={depositNotes}
              onChange={(e) => setDepositNotes(e.target.value)}
              rows={2}
              placeholder="Deposit notes (optional)"
              className="mt-3 w-full rounded-lg border border-violet-200 px-3 py-2.5 text-sm"
            />
            <p className="mt-2 text-xs text-violet-800">
              Available after deposit:{' '}
              <span className="font-semibold">{formatUgx(availableWallet)}</span>
            </p>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => void handleSaveDeposit()}
                disabled={isSavingDeposit || depositValue <= 0}
                className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {isSavingDeposit ? 'Saving…' : 'Save deposit'}
              </button>
            </div>
            <div className="mt-2 rounded-lg bg-white px-3 py-2">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Recent ledger
              </p>
              {isLoadingMeta ? (
                <p className="text-xs text-slate-500">Loading…</p>
              ) : recentTransactions.length === 0 ? (
                <p className="text-xs text-slate-500">No recent entries</p>
              ) : (
                <div className="space-y-1">
                  {recentTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-slate-600">{getTxLabel(tx.type)}</span>
                      <span className="font-medium text-slate-900">
                        {formatUgx(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Line items</p>
                <p className="text-xs text-slate-500">
                  Sold and returned must exactly match picked quantity.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={setAllSold}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
                >
                  <ShoppingCart size={15} />
                  All Sold
                </button>
                <button
                  type="button"
                  onClick={setAllReturned}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800"
                >
                  <Undo2 size={15} />
                  All Returned
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-3 py-3 text-center font-semibold">Picked</th>
                    <th className="px-3 py-3 text-center font-semibold">Sold</th>
                    <th className="px-3 py-3 text-center font-semibold">Returned</th>
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
                      <td className="px-4 py-3 text-right font-medium">
                        {formatUgx(row.lineRevenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes about this report…"
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
              <p className="text-xs text-slate-500">Pick value</p>
              <p className="text-lg font-bold text-slate-900">
                {formatUgx(pickValue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Revenue</p>
              <p className="text-lg font-bold text-emerald-700">
                {formatUgx(totals.revenue)}
              </p>
            </div>
          </div>

          {hasUnbalancedRow && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <Info size={16} className="mt-0.5 shrink-0" />
              <p>Each row must satisfy sold + returned = picked before submit.</p>
            </div>
          )}
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
            disabled={isSubmitting || hasInvalidRow || hasUnbalancedRow || shortfall > 0}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting…' : 'Finalize report'}
          </button>
        </div>
      </form>
    </div>
  );
}
