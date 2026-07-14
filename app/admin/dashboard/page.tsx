'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getProducts, getOrders, Product, Order } from '@/lib/firestore';
import toast from 'react-hot-toast';
import AdminGuard from '@/components/admin-guard';
import AdminLayout, { AdminSection } from '@/components/admin-layout';
import AdminStatCard from '@/components/admin-stat-card';
import { formatUgx } from '@/lib/currency';
import type { ReportSummary } from '@/lib/reports-server';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  FileDown,
  LayoutDashboard,
  Package,
  Plus,
  QrCode,
  ScanBarcode,
  Search,
  ShoppingBag,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { downloadAllProductQrPdf, downloadProductQrPng } from '@/lib/product-qr';
import { downloadAllBarcodeLabelsPdf } from '@/lib/product-barcode';
import { adminFetch } from '@/lib/admin-api';

const validTabs: AdminSection[] = ['overview', 'products', 'orders', 'analytics'];

const dashboardTabs: {
  id: AdminSection;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

function toDate(ts: { toDate?: () => Date; seconds?: number } | undefined): Date {
  if (ts && typeof ts.toDate === 'function') return ts.toDate();
  if (ts && typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
  return new Date(0);
}

function formatOrderDate(ts: Order['createdAt']): string {
  const date = toDate(ts);
  if (date.getTime() === 0) return '—';
  return date.toLocaleDateString('en-UG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPaymentStatusStyles(paymentStatus?: Order['paymentStatus']) {
  switch (paymentStatus) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
    case 'failed':
      return 'bg-red-50 text-red-700 ring-red-600/20';
    case 'cancelled':
      return 'bg-slate-100 text-slate-600 ring-slate-500/20';
    default:
      return 'bg-amber-50 text-amber-700 ring-amber-600/20';
  }
}

function getStatusStyles(status: Order['status']) {
  switch (status) {
    case 'pending':
      return 'bg-amber-50 text-amber-700 ring-amber-600/20';
    case 'confirmed':
      return 'bg-blue-50 text-blue-700 ring-blue-600/20';
    case 'shipped':
      return 'bg-violet-50 text-violet-700 ring-violet-600/20';
    default:
      return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
  }
}

function DashboardTabNav({ activeTab }: { activeTab: AdminSection }) {
  const router = useRouter();

  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {dashboardTabs.map(({ id, label, icon: Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => router.push(`/admin/dashboard?tab=${id}`)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm ${className}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as AdminSection | null;
  const activeTab: AdminSection =
    tabParam && validTabs.includes(tabParam) ? tabParam : 'overview';

  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingAllQr, setIsDownloadingAllQr] = useState(false);
  const [isDownloadingBarcodes, setIsDownloadingBarcodes] = useState(false);
  const [downloadingQrProductId, setDownloadingQrProductId] = useState<string | null>(
    null
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [dayReport, setDayReport] = useState<ReportSummary | null>(null);
  const [weekReport, setWeekReport] = useState<ReportSummary | null>(null);
  const [monthReport, setMonthReport] = useState<ReportSummary | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState<'all' | Order['status']>('all');

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsData, ordersData, dayRes, weekRes, monthRes] = await Promise.all([
        getProducts(),
        getOrders(),
        adminFetch('/api/reports/summary?period=day').catch(() => null),
        adminFetch('/api/reports/summary?period=week').catch(() => null),
        adminFetch('/api/reports/summary?period=month').catch(() => null),
      ]);

      setProducts(productsData);
      setOrders(ordersData);

      if (dayRes?.ok) {
        const data = await dayRes.json();
        setDayReport(data.summary ?? null);
      }
      if (weekRes?.ok) {
        const data = await weekRes.json();
        setWeekReport(data.summary ?? null);
      }
      if (monthRes?.ok) {
        const data = await monthRes.json();
        setMonthReport(data.summary ?? null);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const analyticsData = useMemo(() => {
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalPrice, 0);
    const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
    const totalCustomers = new Set(orders.map((o) => o.customerEmail)).size;
    const lowStockProducts = products.filter(
      (p) => p.stock <= (p.reorderLevel ?? 5)
    ).length;
    const outOfStock = products.filter((p) => p.stock <= 0).length;
    const pendingOrders = orders.filter((o) => o.status === 'pending').length;
    const completedOrders = orders.filter((o) => o.status === 'delivered').length;

    return {
      totalRevenue,
      averageOrderValue,
      totalCustomers,
      lowStockProducts,
      outOfStock,
      pendingOrders,
      completedOrders,
    };
  }, [orders, products]);

  const orderStatusCounts = useMemo(() => {
    const counts: Record<Order['status'], number> = {
      pending: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
    };
    for (const order of orders) counts[order.status]++;
    return counts;
  }, [orders]);

  const recentOrders = useMemo(
    () =>
      [...orders]
        .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime())
        .slice(0, 6),
    [orders]
  );

  const lowStockItems = useMemo(
    () =>
      products
        .filter((p) => p.stock <= (p.reorderLevel ?? 5))
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 6),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
    );
  }, [products, productSearch]);

  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesFilter = orderFilter === 'all' || order.status === orderFilter;
      const matchesSearch =
        !query ||
        order.customerName.toLowerCase().includes(query) ||
        order.customerEmail.toLowerCase().includes(query) ||
        order.id.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [orders, orderFilter, orderSearch]);

  const paymentData = useMemo(() => {
    if (!monthReport) return [];
    return Object.entries(monthReport.paymentMethodBreakdown).map(([method, amount]) => ({
      method: method.replace(/_/g, ' '),
      amount,
    }));
  }, [monthReport]);

  const todayLabel = new Date().toLocaleDateString('en-UG', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const handleDownloadProductQr = async (product: Product) => {
    setDownloadingQrProductId(product.id);
    try {
      await downloadProductQrPng(product);
      toast.success(`QR code downloaded for ${product.name}`);
    } catch (error) {
      console.error('Error downloading product QR:', error);
      toast.error('Failed to download QR code');
    } finally {
      setDownloadingQrProductId(null);
    }
  };

  const handleDownloadAllBarcodes = async () => {
    setIsDownloadingBarcodes(true);
    try {
      await downloadAllBarcodeLabelsPdf(products);
      toast.success('Barcode labels PDF downloaded');
    } catch (error) {
      console.error('Error downloading barcode labels:', error);
      toast.error('Failed to download barcode labels');
    } finally {
      setIsDownloadingBarcodes(false);
    }
  };

  const handleDownloadAllProductQr = async () => {
    setIsDownloadingAllQr(true);
    try {
      await downloadAllProductQrPdf(products);
      toast.success('PDF with all product QR codes downloaded');
    } catch (error) {
      console.error('Error downloading product QR PDF:', error);
      toast.error('Failed to download QR codes PDF');
    } finally {
      setIsDownloadingAllQr(false);
    }
  };

  const pageMeta: Record<AdminSection, { title: string; subtitle: string }> = {
    overview: {
      title: 'Dashboard',
      subtitle: 'Your command center for sales, inventory, and operations.',
    },
    products: {
      title: 'Products',
      subtitle: 'Manage your catalog, pricing, and stock levels.',
    },
    orders: {
      title: 'Orders',
      subtitle: 'Track customer orders and fulfillment status.',
    },
    analytics: {
      title: 'Analytics',
      subtitle: 'Revenue trends, order breakdowns, and business insights.',
    },
  };

  const { title, subtitle } = pageMeta[activeTab];

  const quickActions = [
    {
      title: 'Point of Sale',
      description: 'Process counter sales with barcode scanning',
      href: '/admin/pos',
      icon: ScanBarcode,
      accent: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Field Sales',
      description: 'Agent picks and end-of-day reconciliation',
      href: '/admin/field-sales',
      icon: Truck,
      accent: 'bg-violet-50 text-violet-600',
    },
    {
      title: 'Inventory',
      description: `${analyticsData.lowStockProducts} items need attention`,
      href: '/admin/inventory',
      icon: Warehouse,
      accent: 'bg-amber-50 text-amber-600',
    },
    {
      title: 'Reports',
      description: 'Detailed revenue and profit analysis',
      href: '/admin/reports',
      icon: BarChart3,
      accent: 'bg-sky-50 text-sky-600',
    },
    {
      title: 'Manage Products',
      description: `${products.length} products in catalog`,
      href: '/admin/dashboard?tab=products',
      icon: Package,
      accent: 'bg-slate-100 text-slate-600',
    },
  ];

  return (
    <AdminLayout
      activeSection={activeTab}
      title={title}
      subtitle={subtitle}
      actions={
        activeTab === 'products' ? (
          <div className="flex flex-wrap items-center gap-2">
            {products.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadAllBarcodes}
                  disabled={isDownloadingBarcodes}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ScanBarcode size={18} />
                  {isDownloadingBarcodes ? 'Preparing…' : 'Barcode labels'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadAllProductQr}
                  disabled={isDownloadingAllQr}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FileDown size={18} />
                  {isDownloadingAllQr ? 'Preparing…' : 'All QR codes'}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => router.push('/admin/products/new')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={18} />
              Add Product
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="mb-6">
        <DashboardTabNav activeTab={activeTab} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <>
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-6 text-white shadow-lg sm:p-8">
                <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-200">{todayLabel}</p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                      Welcome back
                    </h2>
                    <p className="mt-2 max-w-xl text-sm text-slate-300">
                      {dayReport
                        ? `${dayReport.transactionCount} transaction${dayReport.transactionCount === 1 ? '' : 's'} today · ${formatUgx(dayReport.totalRevenue)} revenue`
                        : 'Here is a snapshot of your business performance.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push('/admin/pos')}
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-blue-50"
                  >
                    <ScanBarcode size={16} />
                    Open POS
                  </button>
                </div>
                <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-blue-500/20 blur-2xl" />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <AdminStatCard
                  label="Today's Revenue"
                  value={formatUgx(dayReport?.totalRevenue ?? 0)}
                  hint="POS + online sales"
                  icon={TrendingUp}
                  tone="success"
                />
                <AdminStatCard
                  label="Today's Profit Est."
                  value={formatUgx(dayReport?.totalProfit ?? 0)}
                  hint="Based on cost price"
                  icon={BarChart3}
                  tone="info"
                />
                <AdminStatCard
                  label="Pending Orders"
                  value={String(analyticsData.pendingOrders)}
                  hint={`${orders.length} total orders`}
                  icon={Clock}
                  tone={analyticsData.pendingOrders > 0 ? 'warning' : 'default'}
                />
                <AdminStatCard
                  label="Low Stock Items"
                  value={String(analyticsData.lowStockProducts)}
                  hint={
                    analyticsData.outOfStock > 0
                      ? `${analyticsData.outOfStock} out of stock`
                      : 'At or below reorder level'
                  }
                  icon={AlertTriangle}
                  tone={analyticsData.lowStockProducts > 0 ? 'danger' : 'success'}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <Panel
                  title="Revenue — last 7 days"
                  subtitle="Daily sales performance"
                  className="xl:col-span-2"
                  action={
                    <button
                      type="button"
                      onClick={() => router.push('/admin/reports')}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      Full reports
                    </button>
                  }
                >
                  {weekReport && weekReport.dailyRevenue.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={weekReport.dailyRevenue}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) =>
                            new Date(v).toLocaleDateString('en-UG', {
                              month: 'short',
                              day: 'numeric',
                            })
                          }
                        />
                        <YAxis tick={{ fontSize: 11 }} width={72} />
                        <Tooltip formatter={(value: number) => formatUgx(value)} />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#2563eb' }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="py-16 text-center text-sm text-slate-400">
                      No revenue data for this period yet.
                    </p>
                  )}
                </Panel>

                <Panel title="Order pipeline" subtitle="Current fulfillment status">
                  <div className="space-y-4">
                    {(
                      [
                        { key: 'pending' as const, label: 'Pending', color: 'bg-amber-500' },
                        { key: 'confirmed' as const, label: 'Confirmed', color: 'bg-blue-500' },
                        { key: 'shipped' as const, label: 'Shipped', color: 'bg-violet-500' },
                        { key: 'delivered' as const, label: 'Delivered', color: 'bg-emerald-500' },
                      ] as const
                    ).map(({ key, label, color }) => {
                      const count = orderStatusCounts[key];
                      const pct =
                        orders.length > 0 ? Math.round((count / orders.length) * 100) : 0;
                      return (
                        <div key={key}>
                          <div className="mb-1.5 flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-700">{label}</span>
                            <span className="text-slate-500">
                              {count}{' '}
                              <span className="text-slate-400">({pct}%)</span>
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${color} transition-all`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 rounded-lg bg-slate-50 px-4 py-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Outstanding balances</span>
                      <span className="font-semibold text-slate-900">
                        {formatUgx(dayReport?.outstandingBalances ?? 0)}
                      </span>
                    </div>
                  </div>
                </Panel>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Panel
                  title="Recent orders"
                  subtitle="Latest customer activity"
                  action={
                    <button
                      type="button"
                      onClick={() => router.push('/admin/dashboard?tab=orders')}
                      className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      View all
                      <ArrowRight size={14} />
                    </button>
                  }
                >
                  {recentOrders.length === 0 ? (
                    <div className="py-10 text-center">
                      <ShoppingBag className="mx-auto mb-2 text-slate-300" size={32} />
                      <p className="text-sm text-slate-500">No orders yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {recentOrders.map((order) => (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => router.push(`/admin/orders/${order.id}`)}
                          className="flex w-full items-center justify-between gap-3 py-3 text-left transition first:pt-0 last:pb-0 hover:opacity-80"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">
                              {order.customerName}
                            </p>
                            <p className="text-xs text-slate-500">
                              #{order.id.slice(0, 8).toUpperCase()} ·{' '}
                              {formatOrderDate(order.createdAt)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-semibold text-slate-900">
                              {formatUgx(order.totalPrice)}
                            </p>
                            <span
                              className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${getStatusStyles(order.status)}`}
                            >
                              {order.status}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel
                  title="Stock alerts"
                  subtitle="Products at or below reorder level"
                  action={
                    <button
                      type="button"
                      onClick={() => router.push('/admin/inventory')}
                      className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      Inventory
                      <ArrowRight size={14} />
                    </button>
                  }
                >
                  {lowStockItems.length === 0 ? (
                    <div className="py-10 text-center">
                      <CheckCircle2 className="mx-auto mb-2 text-emerald-400" size={32} />
                      <p className="text-sm font-medium text-slate-700">All stock levels healthy</p>
                      <p className="mt-1 text-xs text-slate-500">
                        No products below reorder threshold.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {lowStockItems.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => router.push(`/admin/products/${product.id}`)}
                          className="flex w-full items-center justify-between gap-3 py-3 text-left transition first:pt-0 last:pb-0 hover:opacity-80"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <img
                              src={product.image}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-900">
                                {product.name}
                              </p>
                              <p className="text-xs text-slate-500">{product.category}</p>
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                              product.stock <= 0
                                ? 'bg-red-50 text-red-700 ring-red-600/20'
                                : 'bg-amber-50 text-amber-700 ring-amber-600/20'
                            }`}
                          >
                            {product.stock} left
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Quick actions
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {quickActions.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.title}
                        type="button"
                        onClick={() => router.push(item.href)}
                        className="group flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`rounded-xl p-2.5 ${item.accent}`}>
                            <Icon size={18} />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{item.title}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
                          </div>
                        </div>
                        <ArrowRight
                          size={16}
                          className="shrink-0 text-slate-300 transition group-hover:text-blue-600"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {activeTab === 'products' && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Total', value: products.length, tone: 'text-slate-900' },
                  {
                    label: 'In stock',
                    value: products.filter((p) => p.stock > (p.reorderLevel ?? 5)).length,
                    tone: 'text-emerald-700',
                  },
                  {
                    label: 'Low stock',
                    value: analyticsData.lowStockProducts,
                    tone: 'text-amber-700',
                  },
                  {
                    label: 'Out of stock',
                    value: analyticsData.outOfStock,
                    tone: 'text-red-700',
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                    <p className={`mt-1 text-2xl font-bold ${stat.tone}`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products by name or category…"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
                {filteredProducts.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <Package className="mx-auto mb-3 text-slate-300" size={40} />
                    <p className="font-medium text-slate-900">
                      {products.length === 0 ? 'No products yet' : 'No matching products'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {products.length === 0
                        ? 'Add your first product to start selling.'
                        : 'Try a different search term.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px]">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/80">
                          <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Product
                          </th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Category
                          </th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Price
                          </th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Stock
                          </th>
                          <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredProducts.map((product) => (
                          <tr key={product.id} className="transition hover:bg-slate-50/80">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200"
                                />
                                <p className="font-medium text-slate-900">{product.name}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {product.category}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                              {formatUgx(product.price)}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                                  product.stock <= 0
                                    ? 'bg-red-50 text-red-700 ring-red-600/20'
                                    : product.stock <= (product.reorderLevel ?? 5)
                                      ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
                                      : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                                }`}
                              >
                                {product.stock} in stock
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleDownloadProductQr(product)}
                                  disabled={downloadingQrProductId === product.id}
                                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                                  title="Download QR code"
                                >
                                  <QrCode size={16} />
                                  {downloadingQrProductId === product.id ? 'Saving…' : 'QR'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => router.push(`/admin/products/${product.id}`)}
                                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'orders' && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Total', value: orders.length },
                  { label: 'Pending', value: orderStatusCounts.pending },
                  { label: 'In progress', value: orderStatusCounts.confirmed + orderStatusCounts.shipped },
                  { label: 'Delivered', value: orderStatusCounts.delivered },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="search"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Search by customer, email, or order ID…"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(['all', 'pending', 'confirmed', 'shipped', 'delivered'] as const).map(
                    (status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setOrderFilter(status)}
                        className={`rounded-lg px-3 py-2 text-xs font-medium capitalize transition ${
                          orderFilter === status
                            ? 'bg-blue-600 text-white'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {status}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
                {filteredOrders.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <ShoppingBag className="mx-auto mb-3 text-slate-300" size={40} />
                    <p className="font-medium text-slate-900">
                      {orders.length === 0 ? 'No orders yet' : 'No matching orders'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {orders.length === 0
                        ? 'Orders will appear here when customers checkout.'
                        : 'Try adjusting your filters or search.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/80">
                          <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Order
                          </th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Customer
                          </th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Date
                          </th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Total
                          </th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Payment
                          </th>
                          <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Status
                          </th>
                          <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredOrders.map((order) => (
                          <tr key={order.id} className="transition hover:bg-slate-50/80">
                            <td className="px-6 py-4">
                              <p className="font-mono text-sm font-semibold text-slate-900">
                                #{order.id.slice(0, 8).toUpperCase()}
                              </p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-medium text-slate-900">{order.customerName}</p>
                              <p className="text-sm text-slate-500">{order.customerEmail}</p>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">
                              {formatOrderDate(order.createdAt)}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                              {formatUgx(order.totalPrice)}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getPaymentStatusStyles(order.paymentStatus)}`}
                              >
                                {(order.paymentStatus ?? 'pending').charAt(0).toUpperCase() +
                                  (order.paymentStatus ?? 'pending').slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getStatusStyles(order.status)}`}
                              >
                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => router.push(`/admin/orders/${order.id}`)}
                                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'analytics' && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <AdminStatCard
                  label="Total Revenue"
                  value={formatUgx(analyticsData.totalRevenue)}
                  hint={`From ${orders.length} orders`}
                  icon={TrendingUp}
                  tone="success"
                />
                <AdminStatCard
                  label="Avg Order Value"
                  value={formatUgx(analyticsData.averageOrderValue)}
                  hint="Per transaction"
                  icon={ShoppingBag}
                  tone="info"
                />
                <AdminStatCard
                  label="Total Customers"
                  value={String(analyticsData.totalCustomers)}
                  hint="Unique buyers"
                  icon={Users}
                />
                <AdminStatCard
                  label="Monthly Transactions"
                  value={String(monthReport?.transactionCount ?? 0)}
                  hint="Last 30 days"
                  icon={BarChart3}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Panel title="Revenue trend" subtitle="Last 30 days">
                  {monthReport && monthReport.dailyRevenue.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={monthReport.dailyRevenue}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) =>
                            new Date(v).toLocaleDateString('en-UG', {
                              month: 'short',
                              day: 'numeric',
                            })
                          }
                        />
                        <YAxis tick={{ fontSize: 11 }} width={72} />
                        <Tooltip formatter={(value: number) => formatUgx(value)} />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="profit"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={false}
                          strokeDasharray="4 4"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="py-16 text-center text-sm text-slate-400">No data available</p>
                  )}
                </Panel>

                <Panel title="Payment methods" subtitle="Last 30 days breakdown">
                  {paymentData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={paymentData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="method" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} width={72} />
                        <Tooltip formatter={(value: number) => formatUgx(value)} />
                        <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="py-16 text-center text-sm text-slate-400">No data available</p>
                  )}
                </Panel>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Panel title="Order statistics">
                  <div className="space-y-3">
                    {[
                      { label: 'Total orders', value: orders.length },
                      { label: 'Pending', value: orderStatusCounts.pending },
                      { label: 'Confirmed', value: orderStatusCounts.confirmed },
                      { label: 'Delivered', value: orderStatusCounts.delivered },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm"
                      >
                        <span className="text-slate-600">{stat.label}</span>
                        <span className="font-semibold text-slate-900">{stat.value}</span>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel title="Product insights">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
                      <span className="text-slate-600">Catalog size</span>
                      <span className="font-semibold text-slate-900">{products.length}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
                      <span className="text-slate-600">Low stock items</span>
                      <span
                        className={`font-semibold ${
                          analyticsData.lowStockProducts > 0 ? 'text-amber-600' : 'text-emerald-600'
                        }`}
                      >
                        {analyticsData.lowStockProducts}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
                      <span className="text-slate-600">Stock valuation</span>
                      <span className="font-semibold text-slate-900">
                        {formatUgx(monthReport?.stockValuation ?? 0)}
                      </span>
                    </div>
                  </div>
                </Panel>

                <Panel title="Best sellers" subtitle="Last 30 days">
                  {monthReport && monthReport.bestSellingProducts.length > 0 ? (
                    <div className="space-y-2">
                      {monthReport.bestSellingProducts.slice(0, 8).map((product) => (
                        <div
                          key={product.productId}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="truncate text-slate-700">{product.name}</span>
                          <span className="shrink-0 font-medium text-slate-900">
                            {product.quantity} sold
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-8 text-center text-sm text-slate-400">No sales data yet</p>
                  )}
                </Panel>
              </div>
            </>
          )}
        </div>
      )}
    </AdminLayout>
  );
}

export default function AdminDashboard() {
  return (
    <AdminGuard>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-slate-50">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </AdminGuard>
  );
}
