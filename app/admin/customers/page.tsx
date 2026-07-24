'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import AdminGuard from '@/components/admin-guard';
import AdminLayout from '@/components/admin-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { formatUgx } from '@/lib/currency';
import { listSalesClient } from '@/lib/firestore';
import {
  buildPosCustomerContacts,
  type PosCustomerContact,
} from '@/lib/pos-customers';
import type { Sale } from '@/lib/erp-types';
import {
  ChevronRight,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';

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
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    try {
      const data = await listSalesClient(1500);
      setSales(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to load customers'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
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
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
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
    return {
      contacts: contacts.length,
      withPhone,
      totalSpent,
    };
  }, [contacts]);

  if (permissionsLoading) {
    return (
      <AdminGuard>
        <AdminLayout activeSection="customers" title="POS Customers">
          <div className="flex justify-center py-24">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
          </div>
        </AdminLayout>
      </AdminGuard>
    );
  }

  if (!canView) {
    return (
      <AdminGuard>
        <AdminLayout activeSection="customers" title="POS Customers">
          <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 px-6 py-10 text-center">
            <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-amber-600" />
            <p className="font-semibold text-amber-900">Access restricted</p>
            <p className="mt-1 text-sm text-amber-800">
              You need POS or customer permissions to view this directory.
            </p>
          </div>
        </AdminLayout>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <AdminLayout
        activeSection="customers"
        title="POS Customers"
        subtitle="Walk-in names and phones recorded at checkout"
        actions={
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={isRefreshing ? 'animate-spin' : undefined}
            />
            Refresh
          </button>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                label: 'Contacts',
                value: String(stats.contacts),
                icon: Users,
                tone: 'bg-blue-50 text-blue-700',
              },
              {
                label: 'With phone',
                value: String(stats.withPhone),
                icon: Phone,
                tone: 'bg-emerald-50 text-emerald-700',
              },
              {
                label: 'Total spent',
                value: formatUgx(stats.totalSpent),
                icon: ChevronRight,
                tone: 'bg-slate-100 text-slate-700',
              },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        {stat.label}
                      </p>
                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {stat.value}
                      </p>
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

              {isLoading ? (
                <div className="flex justify-center py-20">
                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="font-medium text-slate-700">No contacts found</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {search
                      ? 'Try a different search.'
                      : 'Customer name and phone appear here after they are entered at POS checkout.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-3 font-semibold">Customer</th>
                        <th className="px-4 py-3 font-semibold">Visits</th>
                        <th className="px-4 py-3 text-right font-semibold">
                          Spent
                        </th>
                        <th className="px-4 py-3 font-semibold">Last visit</th>
                        <th className="px-5 py-3 text-right font-semibold" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.map((contact) => (
                        <tr
                          key={contact.id}
                          className={`transition hover:bg-slate-50/80 ${
                            selectedId === contact.id ? 'bg-blue-50/60' : ''
                          }`}
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
                    <p className="text-lg font-bold text-slate-900">
                      {selected.name}
                    </p>
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
                      <p className="font-semibold text-slate-900">
                        {selected.visitCount}
                      </p>
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
                            href={`/admin/sales/${sale.id}`}
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
      </AdminLayout>
    </AdminGuard>
  );
}
