'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import AdminGuard from '@/components/admin-guard';
import AdminLayout from '@/components/admin-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { formatUgx } from '@/lib/currency';
import {
  listCreditCustomers,
  listCreditTransactions,
  registerCreditCustomer,
  type CreditCustomerInput,
} from '@/lib/credit-client';
import type { CreditCustomer, CreditTransaction } from '@/lib/erp-types';
import {
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
  Wallet,
  CreditCard,
  Banknote,
  X,
  ChevronRight,
} from 'lucide-react';

function getTsDate(value: CreditCustomer['createdAt'] | CreditTransaction['createdAt']): Date {
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
  name: string;
  phone: string;
  email: string;
  address: string;
  idNumber: string;
  notes: string;
  creditLimit: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  phone: '',
  email: '',
  address: '',
  idNumber: '',
  notes: '',
  creditLimit: '',
};

export default function CreditPage() {
  const { can, loading: permissionsLoading } = usePermissions();
  const canManage = can('manageCredit');
  const canView = canManage || can('manageCustomers') || can('viewReports') || can('accessPos');

  const [customers, setCustomers] = useState<CreditCustomer[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    try {
      const [customerData, txData] = await Promise.all([
        listCreditCustomers({ limit: 1000 }),
        listCreditTransactions({ limit: 500 }),
      ]);
      setCustomers(customerData);
      setTransactions(txData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load credit accounts');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const openAddForm = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Name and phone are required.');
      return;
    }

    const creditLimitRaw = form.creditLimit.trim();
    const creditLimit = creditLimitRaw ? parseFloat(creditLimitRaw) : undefined;
    if (creditLimitRaw && (!Number.isFinite(creditLimit) || (creditLimit ?? 0) < 0)) {
      toast.error('Enter a valid credit limit.');
      return;
    }

    const input: CreditCustomerInput = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      idNumber: form.idNumber.trim() || undefined,
      notes: form.notes.trim() || undefined,
      creditLimit,
    };

    setIsSaving(true);
    try {
      await registerCreditCustomer(input);
      toast.success('Customer registered');
      closeForm();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to register customer');
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.idNumber?.toLowerCase().includes(q)
      );
    });
  }, [customers, search, statusFilter]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let outstanding = 0;
    let wallet = 0;
    let active = 0;
    let collectedThisMonth = 0;

    for (const c of customers) {
      outstanding += c.outstandingBalance ?? 0;
      wallet += c.walletBalance ?? 0;
      if (c.status === 'active') active += 1;
    }

    for (const tx of transactions) {
      if (tx.type !== 'installment' && tx.type !== 'wallet_applied' && tx.type !== 'deposit') {
        continue;
      }
      if (tx.type === 'deposit') continue;
      const date = getTsDate(tx.createdAt);
      if (date >= monthStart) collectedThisMonth += tx.amount;
    }

    return { outstanding, wallet, active, collectedThisMonth, count: customers.length };
  }, [customers, transactions]);

  if (!permissionsLoading && !canView) {
    return (
      <AdminGuard>
        <AdminLayout activeSection="credit" title="Credit">
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100">
              <ShieldAlert size={28} />
            </div>
            <p className="text-base font-semibold text-slate-800">Access restricted</p>
            <p className="mt-1.5 text-sm text-slate-500">
              You do not have permission to view credit accounts. Contact an administrator if you need
              access.
            </p>
          </div>
        </AdminLayout>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <AdminLayout
        activeSection="credit"
        title="Credit"
        subtitle="Register people, track product picks on credit, and record installment deposits."
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
              label: 'Total outstanding',
              value: isLoading ? '—' : formatUgx(stats.outstanding),
              icon: CreditCard,
              tone: 'text-amber-600 bg-amber-50',
            },
            {
              label: 'Wallet balances',
              value: isLoading ? '—' : formatUgx(stats.wallet),
              icon: Wallet,
              tone: 'text-emerald-600 bg-emerald-50',
            },
            {
              label: 'Collected this month',
              value: isLoading ? '—' : formatUgx(stats.collectedThisMonth),
              icon: Banknote,
              tone: 'text-blue-600 bg-blue-50',
            },
            {
              label: 'Active accounts',
              value: isLoading ? '—' : String(stats.active),
              icon: Users,
              tone: 'text-violet-600 bg-violet-50',
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
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.tone}`}
                  >
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
                  <h3 className="font-semibold text-slate-900">Credit customers</h3>
                  <p className="text-sm text-slate-500">
                    {filtered.length} of {customers.length} accounts
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
                      placeholder="Search name, phone…"
                      className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-56"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-20">
                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="font-medium text-slate-700">No credit customers found</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {search || statusFilter !== 'all'
                      ? 'Try clearing your search or filters.'
                      : 'Register the first person to start tracking credit.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-3 font-semibold">Customer</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 text-right font-semibold">Wallet</th>
                        <th className="px-4 py-3 text-right font-semibold">Outstanding</th>
                        <th className="px-5 py-3 text-right font-semibold" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.map((customer) => (
                        <tr key={customer.id} className="transition hover:bg-slate-50/80">
                          <td className="px-5 py-3.5">
                            <Link
                              href={`/admin/credit/${customer.id}`}
                              className="group block"
                            >
                              <p className="font-medium text-slate-900 group-hover:text-blue-600">
                                {customer.name}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">{customer.phone}</p>
                            </Link>
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                                customer.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                  : 'bg-slate-100 text-slate-600 ring-slate-200'
                              }`}
                            >
                              {customer.status === 'active' ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-medium text-slate-900">
                            {formatUgx(customer.walletBalance ?? 0)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold text-amber-700">
                            {formatUgx(customer.outstandingBalance ?? 0)}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <Link
                              href={`/admin/credit/${customer.id}`}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                            >
                              Open
                              <ChevronRight size={14} />
                            </Link>
                          </td>
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
              <form
                onSubmit={handleSubmit}
                className="rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                      <Users size={18} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">Register customer</h3>
                      <p className="text-xs text-slate-500">Create a new credit account</p>
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
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Full name
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      required
                      maxLength={200}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      required
                      maxLength={40}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Email <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      maxLength={200}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Address <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                      maxLength={400}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        ID number
                      </label>
                      <input
                        type="text"
                        value={form.idNumber}
                        onChange={(e) => setForm((f) => ({ ...f, idNumber: e.target.value }))}
                        maxLength={80}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Credit limit
                      </label>
                      <input
                        type="number"
                        value={form.creditLimit}
                        onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value }))}
                        min={0}
                        step="1"
                        placeholder="Optional"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
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
                    {isSaving ? 'Saving…' : 'Register customer'}
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
                Register a new customer
              </button>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
                You have view-only access. Ask an admin, manager, or sales staff to register customers.
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
