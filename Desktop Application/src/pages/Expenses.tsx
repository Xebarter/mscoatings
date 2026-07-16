import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Banknote,
  CreditCard,
  Pencil,
  Plus,
  Receipt,
  Search,
  ShieldAlert,
  Smartphone,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { formatUgx } from '@/lib/currency';
import { addExpense, deleteExpense, listExpenses, updateExpense, type ExpenseInput } from '@/lib/expenses';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  type Expense,
  type ExpenseCategory,
  type SalePaymentMethod,
} from '@/lib/types';
import StatCard from '@/components/StatCard';
import ConfirmDialog from '@/components/ConfirmDialog';
import { PageLoader, EmptyState } from '@/components/LoadingSpinner';
import { cn } from '@/lib/utils';

const PAYMENT_METHODS: { value: SalePaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
];

function toDateInputValue(date: Date): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function getExpenseDate(value: Expense['date']): Date {
  if (!value) return new Date();
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (typeof value === 'object' && 'seconds' in value) {
    return new Date((value as unknown as { seconds: number }).seconds * 1000);
  }
  return new Date(String(value));
}

interface FormState {
  date: string;
  category: ExpenseCategory;
  purpose: string;
  amount: string;
  paymentMethod: SalePaymentMethod;
  payee: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  date: toDateInputValue(new Date()),
  category: 'other',
  purpose: '',
  amount: '',
  paymentMethod: 'cash',
  payee: '',
  notes: '',
};

function PaymentMethodIcon({ method }: { method: SalePaymentMethod }) {
  if (method === 'mobile_money') return <Smartphone size={14} className="text-violet-600" />;
  if (method === 'bank_transfer' || method === 'card')
    return <CreditCard size={14} className="text-blue-600" />;
  return <Banknote size={14} className="text-emerald-600" />;
}

export default function ExpensesPage() {
  const { can, loading: permissionsLoading } = usePermissions();
  const canManage = can('manageExpenses');
  const canView = can('viewReports') || canManage;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'all'>('all');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadData() {
    try {
      const data = await listExpenses({ limit: 1000 });
      setExpenses(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canView) void loadData();
    else setLoading(false);
  }, [canView]);

  const openAddForm = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (expense: Expense) => {
    setEditing(expense);
    setForm({
      date: toDateInputValue(getExpenseDate(expense.date)),
      category: expense.category,
      purpose: expense.purpose,
      amount: String(expense.amount),
      paymentMethod: expense.paymentMethod,
      payee: expense.payee ?? '',
      notes: expense.notes ?? '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    if (submitting) return;
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async () => {
    const amount = parseFloat(form.amount);
    if (!form.purpose.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a purpose and a valid amount.');
      return;
    }

    const input: ExpenseInput = {
      date: new Date(`${form.date}T00:00:00`),
      category: form.category,
      purpose: form.purpose.trim(),
      amount,
      paymentMethod: form.paymentMethod,
      payee: form.payee.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    setSubmitting(true);
    try {
      if (editing) {
        await updateExpense(editing.id, input);
        toast.success('Expense updated');
      } else {
        await addExpense(input);
        toast.success('Expense recorded');
      }
      closeForm();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteExpense(deleteTarget.id, {
        category: deleteTarget.category,
        amount: deleteTarget.amount,
      });
      setExpenses((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      toast.success('Expense deleted');
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete expense');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((expense) => {
      if (categoryFilter !== 'all' && expense.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        expense.purpose.toLowerCase().includes(q) ||
        expense.payee?.toLowerCase().includes(q) ||
        expense.recordedBy.toLowerCase().includes(q)
      );
    });
  }, [expenses, search, categoryFilter]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let total = 0;
    let monthTotal = 0;
    let cashTotal = 0;
    const byCategory = new Map<string, number>();

    for (const expense of expenses) {
      total += expense.amount;
      if (expense.paymentMethod === 'cash') cashTotal += expense.amount;
      const date = getExpenseDate(expense.date);
      if (date >= monthStart) monthTotal += expense.amount;
      byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + expense.amount);
    }

    const topCategory = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1])[0];

    return {
      total,
      monthTotal,
      cashTotal,
      topCategoryLabel: topCategory
        ? EXPENSE_CATEGORY_LABELS[topCategory[0] as ExpenseCategory]
        : '—',
    };
  }, [expenses]);

  if (permissionsLoading || loading) return <PageLoader />;

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100">
          <ShieldAlert size={28} />
        </div>
        <p className="text-base font-semibold text-slate-800">Access restricted</p>
        <p className="mt-1.5 text-sm text-slate-500">
          You do not have permission to view expenses. Contact an administrator if you need access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Expenses</h1>
          <p className="mt-1 text-slate-500">
            Record and manage business expenses so cash at hand stays accurate.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openAddForm}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus size={16} />
            Record expense
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Expenses" value={formatUgx(stats.total)} icon={Receipt} tone="danger" />
        <StatCard label="This Month" value={formatUgx(stats.monthTotal)} icon={Wallet} tone="warning" />
        <StatCard label="Paid in Cash" value={formatUgx(stats.cashTotal)} icon={Banknote} tone="success" />
        <StatCard label="Top Category" value={stats.topCategoryLabel} icon={CreditCard} tone="info" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search purpose, payee…"
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | 'all')}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {EXPENSE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No expenses found"
            description={
              search || categoryFilter !== 'all'
                ? 'Try clearing your search or filters.'
                : 'Record your first expense to start tracking cash flow.'
            }
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-5 py-3 font-semibold text-slate-600">Date</th>
                <th className="px-5 py-3 font-semibold text-slate-600">Purpose</th>
                <th className="px-5 py-3 font-semibold text-slate-600">Category</th>
                <th className="px-5 py-3 font-semibold text-slate-600">Method</th>
                <th className="px-5 py-3 text-right font-semibold text-slate-600">Amount</th>
                {canManage && <th className="px-5 py-3 text-right font-semibold text-slate-600">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((expense) => (
                <tr key={expense.id} className="hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    {getExpenseDate(expense.date).toLocaleDateString('en-UG', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{expense.purpose}</p>
                    {expense.payee && <p className="mt-0.5 text-xs text-slate-500">{expense.payee}</p>}
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                      {EXPENSE_CATEGORY_LABELS[expense.category]}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <PaymentMethodIcon method={expense.paymentMethod} />
                      {PAYMENT_METHODS.find((m) => m.value === expense.paymentMethod)?.label ??
                        expense.paymentMethod}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-slate-900">
                    {formatUgx(expense.amount)}
                  </td>
                  {canManage && (
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditForm(expense)}
                          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600"
                          aria-label="Edit expense"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(expense)}
                          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                          aria-label="Delete expense"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AnimatePresence>
        {showForm && canManage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
            onClick={closeForm}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  {editing ? 'Edit Expense' : 'Record Expense'}
                </h2>
                <button type="button" onClick={closeForm}>
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date
                    </label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Category
                    </label>
                    <select
                      value={form.category}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {EXPENSE_CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Purpose
                  </label>
                  <input
                    type="text"
                    value={form.purpose}
                    onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                    placeholder="What was this expense for?"
                    maxLength={300}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Amount (UGX)
                    </label>
                    <input
                      type="number"
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                      min="1"
                      step="0.01"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Payment method
                    </label>
                    <select
                      value={form.paymentMethod}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, paymentMethod: e.target.value as SalePaymentMethod }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <input
                  type="text"
                  value={form.payee}
                  onChange={(e) => setForm((f) => ({ ...f, payee: e.target.value }))}
                  placeholder="Payee / vendor (optional)"
                  maxLength={200}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />

                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes (optional)"
                  rows={2}
                  maxLength={1000}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={cn(
                    'w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50'
                  )}
                >
                  {submitting ? 'Saving...' : editing ? 'Save Changes' : 'Record Expense'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete expense"
        description={
          deleteTarget
            ? `Delete this ${EXPENSE_CATEGORY_LABELS[deleteTarget.category]} expense of ${formatUgx(deleteTarget.amount)}? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
