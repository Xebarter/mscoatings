import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  ArrowRight,
  Package,
  ScanBarcode,
  ShoppingBag,
  TrendingUp,
  Truck,
  Warehouse,
} from 'lucide-react';
import { getProducts, getOrders, listSales } from '@/lib/firestore';
import { buildDaySummary } from '@/lib/offline/local-reports';
import { formatUgx, formatDate } from '@/lib/currency';
import type { Product, Order, Sale, ReportSummary } from '@/lib/types';
import { useOnline } from '@/hooks/useOnline';
import StatCard from '@/components/StatCard';
import Panel from '@/components/Panel';
import { PageLoader } from '@/components/LoadingSpinner';

export default function DashboardPage() {
  const online = useOnline();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [dayReport, setDayReport] = useState<ReportSummary | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    try {
      const [productsData, ordersData, salesData, daySummary] = await Promise.all([
        getProducts(),
        getOrders().catch(() => [] as Order[]),
        listSales(10).catch(() => [] as Sale[]),
        buildDaySummary().catch(() => null),
      ]);
      setProducts(productsData);
      setOrders(ordersData);
      setSales(salesData);
      if (daySummary) setDayReport(daySummary);
    } catch {
      toast.error(
        online
          ? 'Failed to load dashboard data'
          : 'No offline cache yet. Connect once to sync your catalog.'
      );
    } finally {
      setLoading(false);
    }
  }

  const lowStock = useMemo(
    () => products.filter((p) => p.stock <= (p.reorderLevel ?? 5)),
    [products]
  );

  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === 'pending'),
    [orders]
  );

  const quickLinks = [
    { to: '/pos', label: 'Open POS', icon: ScanBarcode, color: 'bg-blue-600' },
    { to: '/inventory', label: 'Inventory', icon: Warehouse, color: 'bg-violet-600' },
    { to: '/field-sales', label: 'Field Sales', icon: Truck, color: 'bg-emerald-600' },
    { to: '/products', label: 'Products', icon: Package, color: 'bg-amber-600' },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Overview</h1>
        <p className="mt-1 text-slate-500">
          {online
            ? 'Your business at a glance'
            : 'Offline — showing cached data. Sales will sync when you reconnect.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's Revenue"
          value={dayReport ? formatUgx(dayReport.totalRevenue) : '—'}
          hint={online ? 'From POS & online sales' : 'From local sales cache'}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="Products"
          value={String(products.length)}
          hint={`${lowStock.length} low stock`}
          icon={Package}
          tone={lowStock.length > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Pending Orders"
          value={String(pendingOrders.length)}
          hint="Awaiting fulfillment"
          icon={ShoppingBag}
          tone={pendingOrders.length > 0 ? 'info' : 'default'}
        />
        <StatCard
          label="Today's Sales"
          value={dayReport ? String(dayReport.totalSales) : '—'}
          hint="Completed transactions"
          icon={ScanBarcode}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map(({ to, label, icon: Icon, color }) => (
          <Link
            key={to}
            to={to}
            className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className={`rounded-xl p-3 text-white ${color}`}>
              <Icon size={20} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900">{label}</p>
              <p className="text-xs text-slate-500">Quick access</p>
            </div>
            <ArrowRight
              size={16}
              className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600"
            />
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Recent Sales" subtitle="Latest POS transactions">
          {sales.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No sales yet today</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {sales.slice(0, 5).map((sale) => (
                <div key={sale.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-slate-900">{sale.receiptNumber}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(sale.createdAt)} · {sale.items.length} items
                    </p>
                  </div>
                  <p className="font-semibold text-emerald-700">
                    {formatUgx(sale.totalAmount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Low Stock Alerts"
          subtitle={`${lowStock.length} products need attention`}
        >
          {lowStock.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">All stock levels healthy</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {lowStock.slice(0, 5).map((product) => (
                <div key={product.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={16} className="text-amber-500" />
                    <div>
                      <p className="font-medium text-slate-900">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.category}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    {product.stock} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
