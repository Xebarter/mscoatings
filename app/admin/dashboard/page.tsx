'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getProducts, getOrders, Product, Order } from '@/lib/firestore';
import toast from 'react-hot-toast';
import AdminGuard from '@/components/admin-guard';
import AdminLayout, { AdminSection } from '@/components/admin-layout';
import AdminStatCard from '@/components/admin-stat-card';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Package,
  Plus,
  ShoppingBag,
  TrendingUp,
  Users,
} from 'lucide-react';

const validTabs: AdminSection[] = ['overview', 'products', 'orders', 'analytics'];

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

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as AdminSection | null;
  const activeTab: AdminSection =
    tabParam && validTabs.includes(tabParam) ? tabParam : 'overview';

  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [analyticsData, setAnalyticsData] = useState({
    totalRevenue: 0,
    averageOrderValue: 0,
    totalCustomers: 0,
    lowStockProducts: 0,
    pendingOrders: 0,
    completedOrders: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsData, ordersData] = await Promise.all([
        getProducts(),
        getOrders(),
      ]);
      setProducts(productsData);
      setOrders(ordersData);

      const totalRevenue = ordersData.reduce((sum, order) => sum + order.totalPrice, 0);
      const averageOrderValue = ordersData.length > 0 ? totalRevenue / ordersData.length : 0;
      const totalCustomers = new Set(ordersData.map((o) => o.customerEmail)).size;
      const lowStockProducts = productsData.filter((p) => p.stock < 5).length;
      const pendingOrders = ordersData.filter((o) => o.status === 'pending').length;
      const completedOrders = ordersData.filter((o) => o.status === 'delivered').length;

      setAnalyticsData({
        totalRevenue,
        averageOrderValue,
        totalCustomers,
        lowStockProducts,
        pendingOrders,
        completedOrders,
      });
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const pageMeta: Record<AdminSection, { title: string; subtitle: string }> = {
    overview: {
      title: 'Dashboard Overview',
      subtitle: 'Monitor store performance and key metrics at a glance.',
    },
    products: {
      title: 'Products',
      subtitle: 'Manage your catalog, pricing, and inventory levels.',
    },
    orders: {
      title: 'Orders',
      subtitle: 'Track customer orders and fulfillment status.',
    },
    analytics: {
      title: 'Analytics',
      subtitle: 'Detailed insights into revenue, orders, and customers.',
    },
  };

  const { title, subtitle } = pageMeta[activeTab];

  return (
    <AdminLayout
      activeSection={activeTab}
      title={title}
      subtitle={subtitle}
      actions={
        activeTab === 'products' ? (
          <button
            type="button"
            onClick={() => router.push('/admin/products/new')}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus size={18} />
            Add Product
          </button>
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Stats — shown on overview and as context on other tabs */}
          {(activeTab === 'overview' || activeTab === 'analytics') && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <AdminStatCard
                  label="Total Revenue"
                  value={`$${analyticsData.totalRevenue.toFixed(2)}`}
                  hint={`From ${orders.length} orders`}
                  icon={TrendingUp}
                  tone="success"
                />
                <AdminStatCard
                  label="Avg Order Value"
                  value={`$${analyticsData.averageOrderValue.toFixed(2)}`}
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
                  label="Total Products"
                  value={String(products.length)}
                  hint="In catalog"
                  icon={Package}
                />
              </div>

              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <AdminStatCard
                    label="Pending Orders"
                    value={String(analyticsData.pendingOrders)}
                    icon={Clock}
                    tone="warning"
                  />
                  <AdminStatCard
                    label="Delivered Orders"
                    value={String(analyticsData.completedOrders)}
                    icon={CheckCircle2}
                    tone="success"
                  />
                  <AdminStatCard
                    label="Low Stock Products"
                    value={String(analyticsData.lowStockProducts)}
                    icon={AlertTriangle}
                    tone={analyticsData.lowStockProducts > 0 ? 'danger' : 'success'}
                  />
                </div>
              )}
            </>
          )}

          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                {
                  title: 'Manage Products',
                  description: `${products.length} products in catalog`,
                  href: '/admin/dashboard?tab=products',
                  icon: Package,
                },
                {
                  title: 'Review Orders',
                  description: `${analyticsData.pendingOrders} pending fulfillment`,
                  href: '/admin/dashboard?tab=orders',
                  icon: ShoppingBag,
                },
                {
                  title: 'View Analytics',
                  description: 'Revenue and customer insights',
                  href: '/admin/dashboard?tab=analytics',
                  icon: TrendingUp,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => router.push(item.href)}
                    className="group flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-5 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md"
                  >
                    <div className="flex items-start gap-4">
                      <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                        <Icon size={20} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                      </div>
                    </div>
                    <ArrowRight
                      size={18}
                      className="text-slate-300 transition group-hover:text-blue-600"
                    />
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === 'products' && (
            <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
              {products.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <Package className="mx-auto mb-3 text-slate-300" size={40} />
                  <p className="font-medium text-slate-900">No products yet</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Add your first product to start selling.
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
                      {products.map((product) => (
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
                            ${product.price}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                                product.stock > 0
                                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                                  : 'bg-red-50 text-red-700 ring-red-600/20'
                              }`}
                            >
                              {product.stock} in stock
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => router.push(`/admin/products/${product.id}`)}
                              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
              {orders.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <ShoppingBag className="mx-auto mb-3 text-slate-300" size={40} />
                  <p className="font-medium text-slate-900">No orders yet</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Orders will appear here when customers checkout.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80">
                        <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Order
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Customer
                        </th>
                        <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Total
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
                      {orders.map((order) => (
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
                          <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                            ${order.totalPrice.toFixed(2)}
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
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
                <h3 className="text-lg font-semibold text-slate-900">Order Statistics</h3>
                <div className="mt-6 grid grid-cols-2 gap-6 lg:grid-cols-4">
                  {[
                    { label: 'Total Orders', value: orders.length, color: 'border-blue-500' },
                    { label: 'Pending', value: analyticsData.pendingOrders, color: 'border-amber-500' },
                    {
                      label: 'Confirmed',
                      value: orders.filter((o) => o.status === 'confirmed').length,
                      color: 'border-sky-500',
                    },
                    { label: 'Delivered', value: analyticsData.completedOrders, color: 'border-emerald-500' },
                  ].map((stat) => (
                    <div key={stat.label} className={`border-l-4 pl-4 ${stat.color}`}>
                      <p className="text-sm text-slate-500">{stat.label}</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
                  <h3 className="text-lg font-semibold text-slate-900">Product Insights</h3>
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                      <span className="text-sm text-slate-600">Catalog size</span>
                      <span className="font-semibold text-slate-900">{products.length}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                      <span className="text-sm text-slate-600">Low stock items</span>
                      <span
                        className={`font-semibold ${
                          analyticsData.lowStockProducts > 0 ? 'text-red-600' : 'text-emerald-600'
                        }`}
                      >
                        {analyticsData.lowStockProducts}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                      <span className="text-sm text-slate-600">Revenue per product</span>
                      <span className="font-semibold text-slate-900">
                        $
                        {products.length > 0
                          ? (analyticsData.totalRevenue / products.length).toFixed(2)
                          : '0.00'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
                  <h3 className="text-lg font-semibold text-slate-900">Customer Insights</h3>
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                      <span className="text-sm text-slate-600">Total customers</span>
                      <span className="font-semibold text-slate-900">
                        {analyticsData.totalCustomers}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                      <span className="text-sm text-slate-600">Revenue per customer</span>
                      <span className="font-semibold text-slate-900">
                        $
                        {analyticsData.totalCustomers > 0
                          ? (analyticsData.totalRevenue / analyticsData.totalCustomers).toFixed(2)
                          : '0.00'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                      <span className="text-sm text-slate-600">Repeat order volume</span>
                      <span className="font-semibold text-slate-900">
                        {analyticsData.totalCustomers > 0
                          ? Math.max(0, orders.length - analyticsData.totalCustomers)
                          : 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
