import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Banknote,
  ChevronRight,
  CreditCard,
  Plus,
  Search,
  ShieldAlert,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useOnline } from '@/hooks/useOnline';
import { formatUgx } from '@/lib/currency';
import {
  listCreditCustomers,
  listCreditTransactions,
  registerCreditCustomer,
  type CreditCustomerInput,
} from '@/lib/credit';
import type { CreditCustomer, CreditTransaction } from '@/lib/types';
import StatCard from '@/components/StatCard';
import { PageLoader, EmptyState } from '@/components/LoadingSpinner';
import { cn } from '@/lib/utils';

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
  const online = useOnline();
  const { can, loading: permissionsLoading } = usePermissions();
  const canManage = can('manageCredit');
  const canView = canManage || can('manageCustomers') || can('viewReports') || can('accessPos');

  const [customers, setCustomers] = useState<CreditCustomer[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
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
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canView) void loadData();
    else setLoading(false);
  }, [canView]);

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
      if (tx.type !== 'installment' && tx.type !== 'wallet_applied') continue;
      const date = getTsDate(tx.createdAt);
      if (date >= monthStart) collectedThisMonth += tx.amount;
    }

    return { outstanding, wallet, active, collectedThisMonth };
  }, [customers, transactions]);

  const handleSubmit = async () => {
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

    setSubmitting(true);
    try {
      await registerCreditCustomer(input);
      toast.success(
        online
          ? 'Customer registered'
          : 'Customer saved offline — will sync when online'
      );
      setShowForm(false);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to register customer');
    } finally {
      setSubmitting(false);
    }
  };

  if (permissionsLoading || loading) return <PageLoader />;

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100">
          <ShieldAlert size={28} />
        </div>
        <p className="text-base font-semibold text-slate-800">Access restricted</p>
        <p className="mt-1.5 text-sm text-slate-500">
          You do not have permission to view credit accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!online && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You are offline. Credit actions are saved locally and will sync when you reconnect.
          Connect once first so customers, purchases, and products are cached.
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Credit</h1>
          <p className="mt-1 text-slate-500">
            Register people, track product picks on credit, and record installment deposits.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setForm(EMPTY_FORM);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus size={16} />
            Register customer
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Outstanding"
          value={formatUgx(stats.outstanding)}
          icon={CreditCard}
          tone="warning"
        />
        <StatCard
          label="Wallet Balances"
          value={formatUgx(stats.wallet)}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="Collected This Month"
          value={formatUgx(stats.collectedThisMonth)}
          icon={Banknote}
          tone="info"
        />
        <StatCard label="Active Accounts" value={String(stats.active)} icon={Users} tone="info" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone…"
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No credit customers found"
            description={
              search || statusFilter !== 'all'
                ? 'Try clearing your search or filters.'
                : 'Register the first person to start tracking credit.'
            }
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-5 py-3 font-semibold text-slate-600">Customer</th>
                <th className="px-5 py-3 font-semibold text-slate-600">Status</th>
                <th className="px-5 py-3 text-right font-semibold text-slate-600">Wallet</th>
                <th className="px-5 py-3 text-right font-semibold text-slate-600">Outstanding</th>
                <th className="px-5 py-3 text-right font-semibold text-slate-600" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50/80">
                  <td className="px-5 py-4">
                    <Link to={`/credit/${customer.id}`} className="group block">
                      <p className="font-medium text-slate-900 group-hover:text-blue-600">
                        {customer.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{customer.phone}</p>
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        customer.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      )}
                    >
                      {customer.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-slate-900">
                    {formatUgx(customer.walletBalance ?? 0)}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-amber-700">
                    {formatUgx(customer.outstandingBalance ?? 0)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      to={`/credit/${customer.id}`}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                    >
                      Open
                      <ChevronRight size={14} />
                    </Link>
                  </td>
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
            onClick={() => !submitting && setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Register Customer</h2>
                <button type="button" onClick={() => !submitting && setShowForm(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="Phone"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="Email (optional)"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Address (optional)"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={form.idNumber}
                    onChange={(e) => setForm((f) => ({ ...f, idNumber: e.target.value }))}
                    placeholder="ID number"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <input
                    type="number"
                    value={form.creditLimit}
                    onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value }))}
                    placeholder="Credit limit"
                    min={0}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes (optional)"
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                  className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Register Customer'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
