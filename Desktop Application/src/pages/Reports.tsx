import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { BarChart3, TrendingUp, DollarSign, ShoppingCart } from 'lucide-react';
import { adminFetch } from '@/lib/admin-api';
import { buildLocalReport, type LocalReportData } from '@/lib/offline/local-reports';
import { isOnline } from '@/lib/offline/connectivity';
import { formatUgx } from '@/lib/currency';
import { useOnline } from '@/hooks/useOnline';
import StatCard from '@/components/StatCard';
import Panel from '@/components/Panel';
import { PageLoader } from '@/components/LoadingSpinner';

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'Quarter' },
];

export default function ReportsPage() {
  const online = useOnline();
  const [preset, setPreset] = useState('week');
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<LocalReportData | null>(null);

  useEffect(() => {
    void loadReport(preset);
  }, [preset]);

  async function loadReport(p: string) {
    setLoading(true);
    try {
      if (isOnline()) {
        try {
          const res = await adminFetch(`/api/reports/enterprise?preset=${p}`);
          if (res.ok) {
            const data = await res.json();
            const mapped: LocalReportData = {
              summary: {
                totalRevenue: data.summary?.totalRevenue ?? 0,
                totalSales: data.summary?.totalSales ?? 0,
                averageOrderValue: data.summary?.averageOrderValue ?? 0,
                totalProductsSold: data.summary?.totalProductsSold ?? 0,
                lowStockCount: data.summary?.lowStockCount ?? 0,
                pendingOrders: data.summary?.pendingOrders ?? 0,
              },
              revenueByDay: data.revenueByDay ?? data.charts?.revenueByDay ?? [],
              topProducts: data.topProducts ?? data.charts?.topProducts ?? [],
              source: 'live',
            };
            // If API shape is thin, fill charts from local sales
            if (!mapped.revenueByDay.length || !mapped.topProducts.length) {
              const local = await buildLocalReport(p);
              mapped.revenueByDay = mapped.revenueByDay.length
                ? mapped.revenueByDay
                : local.revenueByDay;
              mapped.topProducts = mapped.topProducts.length
                ? mapped.topProducts
                : local.topProducts;
            }
            setReport(mapped);
            return;
          }
        } catch {
          /* fall through to local */
        }
      }

      const local = await buildLocalReport(p);
      setReport(local);
      if (!online) {
        toast('Showing offline report from cached sales', { icon: '📊' });
      }
    } catch {
      toast.error(
        online
          ? 'Failed to load reports.'
          : 'No cached sales for offline reports yet. Sync once while online.'
      );
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <PageLoader />;

  const summary = report?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reports</h1>
          <p className="mt-1 text-slate-500">
            {report?.source === 'offline'
              ? 'Offline analytics from cached POS sales'
              : 'Business intelligence and analytics'}
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {PRESETS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPreset(value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                preset === value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Revenue"
              value={formatUgx(summary.totalRevenue)}
              icon={DollarSign}
              tone="success"
            />
            <StatCard
              label="Total Sales"
              value={String(summary.totalSales)}
              icon={ShoppingCart}
              tone="info"
            />
            <StatCard
              label="Average Order Value"
              value={formatUgx(summary.averageOrderValue)}
              icon={TrendingUp}
            />
            <StatCard
              label="Products Sold"
              value={String(summary.totalProductsSold)}
              icon={BarChart3}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {report?.revenueByDay && report.revenueByDay.length > 0 && (
              <Panel title="Revenue Trend" subtitle="Daily revenue over period">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={report.revenueByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip
                      formatter={(value: number) => [formatUgx(value), 'Revenue']}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#0077c8"
                      strokeWidth={2}
                      dot={{ fill: '#0077c8', r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Panel>
            )}

            {report?.topProducts && report.topProducts.length > 0 && (
              <Panel title="Top Products" subtitle="Best performers by revenue">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={report.topProducts.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 11 }}
                      stroke="#94a3b8"
                    />
                    <Tooltip
                      formatter={(value: number) => [formatUgx(value), 'Revenue']}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="revenue" fill="#0077c8" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <BarChart3 size={48} className="mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-700">No report data available</h3>
          <p className="mt-2 text-sm text-slate-500">
            Connect to the internet once to sync sales, then reports work offline too.
          </p>
        </div>
      )}
    </div>
  );
}
