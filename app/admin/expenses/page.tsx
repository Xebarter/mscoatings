'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import AdminGuard from '@/components/admin-guard';
import AdminLayout from '@/components/admin-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { formatUgx } from '@/lib/currency';
import {
  addExpenseClient,
  deleteExpenseClient,
  listExpensesClient,
  updateExpenseClient,
  type ExpenseInput,
} from '@/lib/expenses-client';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  type Expense,
  type ExpenseCategory,
} from '@/lib/erp-types';
import type { SalePaymentMethod } from '@/lib/erp-types';
import {
  Banknote,
  CreditCard,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';

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

function CategoryBadge({ category }: { category: ExpenseCategory }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
      {EXPENSE_CATEGORY_LABELS[category]}
    </span>
  );
}

function PaymentMethodIcon({ method }: { method: SalePaymentMethod }) {
  if (method === 'mobile_money') return <Smartphone size={14} className="text-violet-600" />;
  if (method === 'bank_transfer' || method === 'card')
    return <CreditCard size={14} className="text-blue-600" />;
  return <Banknote size={14} className="text-emerald-600" />;
}

export default function ExpensesPage() {
  const { can, loading: permissionsLoading } = usePermissions();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'all'>('all');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    try {
      const data = await listExpensesClient({ limit: 1000 });
      setExpenses(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load expenses');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const canManage = can('manageExpenses');

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (expense: Expense) => {
    setEditingId(expense.id);
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
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

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

    setIsSaving(true);
    try {
      if (editingId) {
        await updateExpenseClient(editingId, input);
        toast.success('Expense updated');
      } else {
        await addExpenseClient(input);
        toast.success('Expense recorded');
      }
      closeForm();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save expense');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (expense: Expense) => {
    if (!window.confirm(`Delete this ${EXPENSE_CATEGORY_LABELS[expense.category]} expense of ${formatUgx(expense.amount)}?`)) {
      return;
    }
    setDeletingId(expense.id);
    try {
      await deleteExpenseClient(expense.id, { category: expense.category, amount: expense.amount });
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
      toast.success('Expense deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete expense');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredExpenses = useMemo(() => {
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
      count: expenses.length,
      topCategory: topCategory
        ? { label: EXPENSE_CATEGORY_LABELS[topCategory[0] as ExpenseCategory], amount: topCategory[1] }
        : null,
    };
  }, [expenses]);

  if (!permissionsLoading && !can('viewReports') && !canManage) {
    return (
      <AdminGuard>
        <AdminLayout activeSection="expenses" title="Expenses">
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100">
              <ShieldAlert size={28} />
            </div>
            <p className="text-base font-semibold text-slate-800">Access restricted</p>
            <p className="mt-1.5 text-sm text-slate-500">
              You do not have permission to view expenses. Contact an administrator if you need access.
            </p>
          </div>
        </AdminLayout>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <AdminLayout
        activeSection="expenses"
        title="Expenses"
        subtitle="Record and manage business expenses so cash at hand stays accurate."
        actions={
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : undefined} />
            Refresh
          </button>
        }
      >
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Total expenses',
            value: isLoading ? '—' : formatUgx(stats.total),
            icon: Receipt,
            tone: 'text-red-600 bg-red-50',
          },
          {
            label: 'This month',
            value: isLoading ? '—' : formatUgx(stats.monthTotal),
            icon: Wallet,
            tone: 'text-amber-600 bg-amber-50',
          },
          {
            label: 'Paid in cash',
            value: isLoading ? '—' : formatUgx(stats.cashTotal),
            icon: Banknote,
            tone: 'text-emerald-600 bg-emerald-50',
          },
          {
            label: 'Top category',
            value: isLoading ? '—' : stats.topCategory ? stats.topCategory.label : '—',
            icon: CreditCard,
            tone: 'text-blue-600 bg-blue-50',
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{stat.value}</p>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.tone}`}>
                  <Icon size={18} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h3 className="font-semibold text-slate-900">Expenses</h3>
                <p className="text-sm text-slate-500">
                  {filteredExpenses.length} of {expenses.length} entries
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search purpose, payee…"
                    className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-56"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | 'all')}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="all">All categories</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {EXPENSE_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-20">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <Receipt className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="font-medium text-slate-700">No expenses found</p>
                <p className="mt-1 text-sm text-slate-500">
                  {search || categoryFilter !== 'all'
                    ? 'Try clearing your search or filters.'
                    : 'Record your first expense to start tracking cash flow.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Purpose</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Method</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount</th>
                      {canManage && <th className="px-5 py-3 text-right font-semibold">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredExpenses.map((expense) => (
                      <tr key={expense.id} className="transition hover:bg-slate-50/80">
                        <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">
                          {getExpenseDate(expense.date).toLocaleDateString('en-UG', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-slate-900">{expense.purpose}</p>
                          {expense.payee && (
                            <p className="mt-0.5 text-xs text-slate-500">{expense.payee}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <CategoryBadge category={expense.category} />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <PaymentMethodIcon method={expense.paymentMethod} />
                            {PAYMENT_METHODS.find((m) => m.value === expense.paymentMethod)?.label ??
                              expense.paymentMethod}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                          {formatUgx(expense.amount)}
                        </td>
                        {canManage && (
                          <td className="px-5 py-3.5 text-right">
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
                                onClick={() => void handleDelete(expense)}
                                disabled={deletingId === expense.id}
                                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
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
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {canManage && showForm ? (
            <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                    <Receipt size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {editingId ? 'Edit expense' : 'Record expense'}
                    </h3>
                    <p className="text-xs text-slate-500">Track spending and its purpose</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Close form"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 p-5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date
                    </label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Category
                    </label>
                    <select
                      value={form.category}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Purpose
                  </label>
                  <input
                    type="text"
                    value={form.purpose}
                    onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                    placeholder="What was this expense for?"
                    required
                    maxLength={300}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Amount (UGX)
                    </label>
                    <input
                      type="number"
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                      min={1}
                      step="0.01"
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Payment method
                    </label>
                    <select
                      value={form.paymentMethod}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, paymentMethod: e.target.value as SalePaymentMethod }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Payee <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={form.payee}
                    onChange={(e) => setForm((f) => ({ ...f, payee: e.target.value }))}
                    placeholder="Vendor or recipient"
                    maxLength={200}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Notes <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    maxLength={1000}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving…' : editingId ? 'Save changes' : 'Record expense'}
                </button>
              </div>
            </form>
          ) : canManage ? (
            <button
              type="button"
              onClick={openAddForm}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white py-8 text-sm font-semibold text-slate-600 transition hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600"
            >
              <Plus size={18} />
              Record a new expense
            </button>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
              You have view-only access to expenses. Ask an admin or manager to add or edit entries.
            </div>
          )}
        </div>
      </div>
      </AdminLayout>
    </AdminGuard>
  );
}
