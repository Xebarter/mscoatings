import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ChevronRight,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { formatUgx } from '@/lib/currency';
import { listSales } from '@/lib/firestore';
import {
  buildPosCustomerContacts,
  type PosCustomerContact,
} from '@/lib/pos-customers';
import type { Sale } from '@/lib/types';
import { PageLoader, EmptyState } from '@/components/LoadingSpinner';
import { cn } from '@/lib/utils';

function formatDate(date: Date): string {
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function saleDate(sale: Sale): Date {
  const value = sale.createdAt;
  if (!value) return new Date(0);
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (typeof value === 'object' && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return new Date(String(value));
}

export default function PosCustomersPage() {
  const { can, loading: permissionsLoading } = usePermissions();
  const canView =
    can('accessPos') || can('manageCustomers') || can('viewReports');

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const data = await listSales(1500);
      setSales(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to load customers'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const contacts = useMemo(
    () => buildPosCustomerContacts(sales),
    [sales]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    const digits = q.replace(/\D/g, '');
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (digits.length > 0 && c.phone.replace(/\D/g, '').includes(digits))
    );
  }, [contacts, search]);

  const selected: PosCustomerContact | null =
    contacts.find((c) => c.id === selectedId) ?? null;

  const selectedSales = useMemo(() => {
    if (!selected) return [];
    const idSet = new Set(selected.saleIds);
    return sales
      .filter((s) => idSet.has(s.id))
      .sort((a, b) => saleDate(b).getTime() - saleDate(a).getTime());
  }, [sales, selected]);

  const stats = useMemo(() => {
    const withPhone = contacts.filter((c) => c.phone).length;
    const totalSpent = contacts.reduce((sum, c) => sum + c.totalSpent, 0);
    return { contacts: contacts.length, withPhone, totalSpent };
  }, [contacts]);

  if (permissionsLoading || loading) {
    return <PageLoader />;
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 px-6 py-10 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-amber-600" />
        <p className="font-semibold text-amber-900">Access restricted</p>
        <p className="mt-1 text-sm text-amber-800">
          You need POS or customer permissions to view this directory.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">POS Customers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Walk-in names and phones recorded at checkout
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : undefined} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Contacts</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{stats.contacts}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">With phone</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{stats.withPhone}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total spent</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {formatUgx(stats.totalSpent)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h3 className="font-semibold text-slate-900">Directory</h3>
              <p className="text-sm text-slate-500">
                {filtered.length} of {contacts.length} contacts
              </p>
            </div>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or phone…"
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-64"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No contacts found"
              description={
                search
                  ? 'Try a different search.'
                  : 'Customer name and phone appear here after they are entered at POS checkout.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Visits</th>
                    <th className="px-4 py-3 text-right font-semibold">Spent</th>
                    <th className="px-4 py-3 font-semibold">Last visit</th>
                    <th className="px-5 py-3 text-right font-semibold" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((contact) => (
                    <tr
                      key={contact.id}
                      className={cn(
                        'transition hover:bg-slate-50/80',
                        selectedId === contact.id && 'bg-blue-50/60'
                      )}
                    >
                      <td className="px-5 py-3.5">
                        <button
                          type="button"
                          onClick={() => setSelectedId(contact.id)}
                          className="group block text-left"
                        >
                          <p className="font-medium text-slate-900 group-hover:text-blue-600">
                            {contact.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {contact.phone || 'No phone'}
                          </p>
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">
                        {contact.visitCount}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-slate-900">
                        {formatUgx(contact.totalSpent)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {formatDate(contact.lastSaleAt)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedId(contact.id)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                        >
                          Open
                          <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h3 className="font-semibold text-slate-900">Contact</h3>
            {selected && (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {!selected ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              Select a contact to see phone, visits, and recent receipts.
            </div>
          ) : (
            <div className="space-y-5 px-5 py-5">
              <div>
                <p className="text-lg font-bold text-slate-900">{selected.name}</p>
                {selected.phone ? (
                  <a
                    href={`tel:${selected.phone}`}
                    className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
                  >
                    <Phone size={14} />
                    {selected.phone}
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">No phone on file</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Visits</p>
                  <p className="font-semibold text-slate-900">{selected.visitCount}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Total spent</p>
                  <p className="font-semibold text-slate-900">
                    {formatUgx(selected.totalSpent)}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Recent sales
                </p>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {selectedSales.map((sale) => (
                    <li key={sale.id}>
                      <Link
                        to={`/sales/${sale.id}`}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">
                            {sale.receiptNumber}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDate(saleDate(sale))}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold text-slate-800">
                          {formatUgx(sale.totalAmount)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
