'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Filter,
  Loader2,
  RefreshCw,
  ScanBarcode,
  ShoppingBag,
  Warehouse,
  Inbox,
  Truck,
  Package,
  Users,
  UserCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminFetch } from '@/lib/admin-api';
import type { StaffActivityLog } from '@/lib/erp-types';
import { formatUgx } from '@/lib/currency';

const CATEGORIES: { id: StaffActivityLog['category'] | 'all'; label: string; short: string }[] = [
  { id: 'all', label: 'All', short: 'All' },
  { id: 'pos', label: 'POS', short: 'POS' },
  { id: 'inventory', label: 'Inventory', short: 'Stock' },
  { id: 'orders', label: 'Orders', short: 'Orders' },
  { id: 'messages', label: 'Messages', short: 'Msgs' },
  { id: 'field_sales', label: 'Field sales', short: 'Field' },
  { id: 'products', label: 'Products', short: 'Products' },
  { id: 'staff', label: 'Staff', short: 'Staff' },
  { id: 'customers', label: 'Customers', short: 'Cust.' },
];

function categoryIcon(category: StaffActivityLog['category']) {
  switch (category) {
    case 'pos':
      return ScanBarcode;
    case 'inventory':
      return Warehouse;
    case 'orders':
      return ShoppingBag;
    case 'messages':
      return Inbox;
    case 'field_sales':
      return Truck;
    case 'products':
      return Package;
    case 'staff':
      return Users;
    case 'customers':
      return UserCircle;
    default:
      return Activity;
  }
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { relative: '—', absolute: '—' };

  const absolute = d.toLocaleString('en-UG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  let relative = absolute;
  if (mins < 1) relative = 'Just now';
  else if (mins < 60) relative = `${mins}m ago`;
  else if (mins < 1440) relative = `${Math.floor(mins / 60)}h ago`;
  else if (mins < 10080) relative = `${Math.floor(mins / 1440)}d ago`;

  return { relative, absolute };
}

function formatMetricValue(key: string, value: string | number | boolean | null) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (
    typeof value === 'number' &&
    /(amount|revenue|price|total|balance)/i.test(key)
  ) {
    return formatUgx(value);
  }
  return String(value);
}

function humanMetricKey(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function channelLabel(channel: StaffActivityLog['channel']) {
  switch (channel) {
    case 'desktop':
      return 'Desktop';
    case 'web_admin':
      return 'Web';
    case 'system':
      return 'System';
    default:
      return 'API';
  }
}

export default function StaffActivityFeed({ enabled }: { enabled: boolean }) {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<StaffActivityLog[]>([]);
  const [category, setCategory] = useState<StaffActivityLog['category'] | 'all'>('all');
  const [actor, setActor] = useState('');

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '150' });
      if (category !== 'all') params.set('category', category);
      if (actor.trim()) params.set('actor', actor.trim());
      const res = await adminFetch(`/api/activity?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Failed to load activity'
        );
      }
      setActivities((data.activities as StaffActivityLog[]) ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [enabled, category, actor]);

  useEffect(() => {
    void load();
  }, [load]);

  const actors = useMemo(() => {
    const set = new Set(activities.map((a) => a.actorEmail).filter(Boolean));
    return [...set].sort();
  }, [activities]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = activities.filter(
      (a) => new Date(a.createdAt).getTime() >= today.getTime()
    ).length;
    const byCategory = CATEGORIES.filter((c) => c.id !== 'all').map((c) => ({
      id: c.id,
      label: c.label,
      count: activities.filter((a) => a.category === c.id).length,
    }));
    return { todayCount, byCategory, total: activities.length };
  }, [activities]);

  if (!enabled) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 sm:text-base">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-premium-blue/10 text-premium-blue">
              <Activity size={16} />
            </span>
            Staff activity log
          </h2>
          <p className="mt-1 text-xs text-slate-500 sm:pl-10 sm:text-sm">
            Audit trail of POS, inventory, orders, messages, and access changes
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 self-stretch rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 touch-manipulation hover:bg-slate-50 sm:min-h-10 sm:self-start"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-slate-100 p-3 sm:grid-cols-4 sm:gap-3 sm:p-4">
        {[
          { label: 'Loaded', value: stats.total },
          { label: 'Today', value: stats.todayCount },
          {
            label: 'POS',
            value: stats.byCategory.find((c) => c.id === 'pos')?.count ?? 0,
          },
          {
            label: 'Inventory',
            value: stats.byCategory.find((c) => c.id === 'inventory')?.count ?? 0,
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {stat.label}
            </p>
            <p className="text-lg font-bold tabular-nums text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3 border-b border-slate-100 p-3 sm:p-4">
        <div className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategory(tab.id)}
              className={`inline-flex min-h-10 shrink-0 snap-start items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold touch-manipulation transition ${
                category === tab.id
                  ? 'bg-gradient-to-r from-premium-blue to-cyan text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.id === 'all' ? <Filter size={12} /> : null}
              <span className="sm:hidden">{tab.short}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-500" htmlFor="activity-actor">
            Staff member
          </label>
          <select
            id="activity-actor"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-premium-blue/40 focus:ring-4 focus:ring-premium-blue/10"
          >
            <option value="">Everyone</option>
            {actors.map((email) => (
              <option key={email} value={email}>
                {email}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <Loader2 className="animate-spin" size={18} />
          <span className="text-sm">Loading activity…</span>
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-14 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Activity size={22} />
          </div>
          <p className="text-sm font-medium text-slate-600">No activity yet</p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-400">
            POS sales, inventory changes, orders, messages, and field sales will appear here
            with timestamps.
          </p>
        </div>
      ) : (
        <ul className="max-h-[min(70vh,560px)] divide-y divide-slate-100 overflow-y-auto overscroll-contain">
          {activities.map((item) => {
            const Icon = categoryIcon(item.category);
            const when = formatWhen(item.createdAt);
            const metricEntries = Object.entries(item.metrics ?? {}).filter(
              ([, v]) => v !== null && v !== undefined && v !== ''
            );
            return (
              <li key={item.id} className="px-3.5 py-3.5 sm:px-5">
                <div className="flex gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 text-sm font-medium leading-snug text-slate-900">
                        {item.summary}
                      </p>
                      <time
                        dateTime={item.createdAt}
                        title={when.absolute}
                        className="shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-400"
                      >
                        <span className="block sm:hidden">{when.relative}</span>
                        <span className="hidden sm:block">{when.absolute}</span>
                      </time>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500 sm:text-xs">
                      <span className="font-medium text-slate-600">
                        {item.actorDisplayName || item.actorEmail}
                      </span>
                      {item.actorDisplayName ? (
                        <span className="hidden sm:inline"> · {item.actorEmail}</span>
                      ) : null}
                      <span> · {channelLabel(item.channel)}</span>
                      <span className="sm:hidden"> · {when.absolute}</span>
                    </p>
                    {metricEntries.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {metricEntries.slice(0, 6).map(([key, value]) => (
                          <span
                            key={key}
                            className="inline-flex max-w-full items-center truncate rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/80"
                          >
                            <span className="mr-1 shrink-0 text-slate-400">
                              {humanMetricKey(key)}
                            </span>
                            <span className="truncate">{formatMetricValue(key, value)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
