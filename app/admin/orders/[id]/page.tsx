'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getOrders, updateOrderStatus, Order } from '@/lib/firestore';
import toast from 'react-hot-toast';
import AdminGuard from '@/components/admin-guard';
import AdminLayout from '@/components/admin-layout';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const orders = await getOrders();
      const found = orders.find((o) => o.id === orderId);
      if (found) {
        setOrder(found);
      } else {
        toast.error('Order not found');
        router.push('/admin/dashboard');
      }
    } catch (error) {
      console.error('Error loading order:', error);
      toast.error('Failed to load order');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: Order['status']) => {
    setIsUpdating(true);
    try {
      await updateOrderStatus(orderId, newStatus);
      setOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
      toast.success('Order status updated!');
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order status');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AdminGuard>
      <AdminLayout
      activeSection="orders"
      title={`Order #${order?.id.slice(0, 8).toUpperCase() ?? '...'}`}
      subtitle="Review order details and update fulfillment status."
    >
      <Link
        href="/admin/dashboard?tab=orders"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-blue-600"
      >
        <ArrowLeft size={18} />
        Back to Orders
      </Link>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
        </div>
      ) : !order ? (
        <div className="rounded-xl border border-slate-200/80 bg-white py-12 text-center shadow-sm">
          <p className="text-slate-500">Order not found</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <p className="mb-1 text-sm text-slate-500">Order Number</p>
                <p className="font-mono text-xl font-bold text-slate-900">
                  #{order.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <div>
                <p className="mb-1 text-sm text-slate-500">Order Date</p>
                <p className="text-xl font-bold text-slate-900">
                  {new Date(order.createdAt.toMillis()).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="mb-1 text-sm text-slate-500">Total Amount</p>
                <p className="text-xl font-bold text-emerald-600">
                  ${order.totalPrice.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="mb-1 text-sm text-slate-500">Current Status</p>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${
                    order.status === 'pending'
                      ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
                      : order.status === 'confirmed'
                      ? 'bg-blue-50 text-blue-700 ring-blue-600/20'
                      : order.status === 'shipped'
                      ? 'bg-violet-50 text-violet-700 ring-violet-600/20'
                      : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                  }`}
                >
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="mb-6 text-lg font-semibold text-slate-900">
              Customer Information
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <p className="mb-1 text-sm text-slate-500">Name</p>
                <p className="font-medium text-slate-900">{order.customerName}</p>
              </div>
              <div>
                <p className="mb-1 text-sm text-slate-500">Email</p>
                <p className="font-medium text-slate-900">{order.customerEmail}</p>
              </div>
              <div>
                <p className="mb-1 text-sm text-slate-500">Phone</p>
                <p className="font-medium text-slate-900">{order.customerPhone}</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Order Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Qty
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Price
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((item) => (
                    <tr key={item.productId}>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {item.productName}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{item.quantity}</td>
                      <td className="px-6 py-4 text-slate-600">
                        ${item.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-900">
                        ${(item.price * item.quantity).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="mb-6 text-lg font-semibold text-slate-900">Update Status</h2>
            <div className="flex flex-wrap gap-3">
              {(['pending', 'confirmed', 'shipped', 'delivered'] as const).map(
                (status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleStatusChange(status)}
                    disabled={isUpdating || order.status === status}
                    className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
                      order.status === status
                        ? 'cursor-not-allowed bg-slate-100 text-slate-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    } disabled:opacity-50`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
    </AdminGuard>
  );
}
