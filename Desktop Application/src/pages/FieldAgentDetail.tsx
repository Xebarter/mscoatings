import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Phone, Truck, Wallet, X } from 'lucide-react';
import { PageLoader } from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import {
  getFieldAgentByIdClient,
  listFieldAgentTransactionsClient,
  listFieldPicksClient,
  recordFieldAgentDepositClient,
} from '@/lib/field-sales';
import { formatUgx } from '@/lib/currency';
import {
  FIELD_AGENT_TRANSACTION_TYPE_LABELS,
  type FieldAgent,
  type FieldAgentTransaction,
  type FieldPick,
  type SalePaymentMethod,
} from '@/lib/types';

const PAYMENT_METHODS: { value: SalePaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
];

function getTsDate(value: unknown): Date {
  if (!value) return new Date();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybe = value as { toDate?: () => Date };
    if (typeof maybe.toDate === 'function') return maybe.toDate();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return new Date(String(value));
}

export default function FieldAgentDetailPage() {
  const { id: agentId } = useParams<{ id: string }>();
  const { permissions } = useAuth();
  const canManage = Boolean(permissions?.manageFieldSales);
  const [agent, setAgent] = useState<FieldAgent | null>(null);
  const [picks, setPicks] = useState<FieldPick[]>([]);
  const [transactions, setTransactions] = useState<FieldAgentTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('cash');
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async () => {
    if (!agentId) return;
    setIsLoading(true);
    try {
      const [agentData, picksData, transactionsData] = await Promise.all([
        getFieldAgentByIdClient(agentId),
        listFieldPicksClient({ agentId, limit: 50 }),
        listFieldAgentTransactionsClient({ agentId, limit: 100 }),
      ]);
      if (!agentData) throw new Error('Agent not found');
      setAgent(agentData);
      setPicks(picksData);
      setTransactions(transactionsData);
    } catch {
      toast.error('Failed to load agent');
      setAgent(null);
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (!agentId) return;
    void loadData();
  }, [agentId, loadData]);

  const closeModal = () => {
    if (submitting) return;
    setShowDepositModal(false);
    setAmount('');
    setPaymentMethod('cash');
    setNotes('');
  };

  const openDepositModal = () => {
    setAmount('');
    setPaymentMethod('cash');
    setNotes('');
    setShowDepositModal(true);
  };

  const handleDepositSubmit = async () => {
    if (!agentId) return;
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    setSubmitting(true);
    try {
      await recordFieldAgentDepositClient(
        agentId,
        value,
        paymentMethod,
        notes.trim() || undefined
      );
      toast.success('Deposit recorded');
      closeModal();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to record deposit');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canManage) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">You do not have permission.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/field-sales"
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-violet-600"
        >
          <ArrowLeft size={18} />
          Back to Field Sales
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {agent?.name ?? 'Field agent'}
        </h1>
        <p className="mt-1 text-slate-500">{agent?.phone ?? '—'}</p>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : agent ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { label: 'Total picks', value: String(agent.totalPicks) },
              { label: 'Total revenue', value: formatUgx(agent.totalRevenue) },
              {
                label: 'Units missing',
                value: String(agent.totalUnitsMissing ?? 0),
              },
              {
                label: 'Wallet balance',
                value: formatUgx(agent.walletBalance ?? 0),
                accent: true,
              },
              {
                label: 'Status',
                value: agent.active ? 'Active' : 'Inactive',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                <p
                  className={`mt-1 text-xl font-bold ${
                    stat.accent ? 'text-violet-700' : 'text-slate-900'
                  }`}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Phone size={16} />
                {agent.phone}
              </div>
              {agent.email && <p className="text-slate-600">{agent.email}</p>}
              {agent.notes && <p className="text-slate-500">{agent.notes}</p>}
            </div>
            <button
              type="button"
              onClick={openDepositModal}
              className="inline-flex items-center gap-2 self-start rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              <Wallet size={16} />
              Deposit
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="font-semibold text-slate-900">Pick history</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {picks.length === 0 ? (
                <p className="px-5 py-12 text-center text-sm text-slate-400">
                  No picks yet
                </p>
              ) : (
                picks.map((pick) => (
                  <Link
                    key={pick.id}
                    to={`/field-sales/picks/${pick.id}`}
                    className="flex items-center justify-between px-5 py-4 transition hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
                        <Truck size={16} className="text-violet-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {(pick.items ?? []).length} products
                        </p>
                        <p className="text-xs text-slate-500">
                          {pick.status === 'active' ? 'Active' : 'Closed'} ·{' '}
                          {(
                            pick.pickedAt &&
                            typeof pick.pickedAt === 'object' &&
                            'toDate' in pick.pickedAt
                              ? pick.pickedAt.toDate()
                              : new Date()
                          ).toLocaleString('en-UG', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {pick.status === 'closed'
                          ? formatUgx(pick.report?.totalRevenue ?? 0)
                          : formatUgx(
                              (pick.items ?? []).reduce(
                                (s, i) => s + i.quantityPicked * i.unitPrice,
                                0
                              )
                            )}
                      </p>
                      <p className="text-xs text-violet-600">View details</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="font-semibold text-slate-900">Wallet ledger</h3>
              <p className="text-sm text-slate-500">{transactions.length} entries</p>
            </div>
            {transactions.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-500">
                No deposits yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-3 font-semibold">Date</th>
                      <th className="px-3 py-3 font-semibold">Type</th>
                      <th className="px-5 py-3 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                          {getTsDate(tx.createdAt).toLocaleDateString('en-UG', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-slate-900">
                            {FIELD_AGENT_TRANSACTION_TYPE_LABELS[tx.type]}
                          </p>
                          {tx.notes && (
                            <p className="text-xs text-slate-500">{tx.notes}</p>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-900">
                          {formatUgx(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-slate-600">Agent not found.</p>
      )}

      <AnimatePresence>
        {showDepositModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Deposit to account</h2>
                <button type="button" onClick={closeModal}>
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-3">
                <p className="text-sm text-slate-500">
                  Record cash or mobile money handed in by this agent. Funds are added to
                  their wallet balance.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Amount"
                    min={1}
                    className="rounded-xl border border-slate-200 px-4 py-3"
                  />
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as SalePaymentMethod)}
                    className="rounded-xl border border-slate-200 px-4 py-3"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  rows={2}
                  maxLength={1000}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3"
                />
                <button
                  type="button"
                  onClick={() => void handleDepositSubmit()}
                  disabled={submitting}
                  className="w-full rounded-xl bg-violet-600 py-3 font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Record deposit'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
