import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { getOrderById, updateOrderStatus } from '@/lib/firestore';
import { formatUgx, formatDate } from '@/lib/currency';
import type { Order, OrderStatus } from '@/lib/types';
import { PageLoader } from '@/components/LoadingSpinner';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered'];

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  confirmed: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  shipped: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  delivered: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
};

export default function OrderDetailPage() {
  const { id: orderId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    void loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const loadOrder = async () => {
    if (!orderId) return;
    try {
      const found = await getOrderById(orderId);
      if (!found) {
        toast.error('Order not found');
        navigate('/orders');
        return;
      }
      setOrder(found);
    } catch {
      toast.error('Failed to load order');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (!orderId) return;
    setIsUpdating(true);
    try {
      await updateOrderStatus(orderId, newStatus);
      setOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
      toast.success('Order status updated');
    } catch {
      toast.error('Failed to update order status');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) return <PageLoader />;

  if (!order) {
    return <p className="text-slate-600">Order not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/orders"
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600"
        >
          <ArrowLeft size={18} />
          Back to Orders
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Order #{order.id.slice(0, 8).toUpperCase()}
        </h1>
        <p className="mt-1 text-slate-500">Review details and update fulfillment status</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-1 text-sm text-slate-500">Order Number</p>
            <p className="font-mono text-xl font-bold text-slate-900">
              #{order.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <div>
            <p className="mb-1 text-sm text-slate-500">Order Date</p>
            <p className="text-xl font-bold text-slate-900">{formatDate(order.createdAt)}</p>
          </div>
          <div>
            <p className="mb-1 text-sm text-slate-500">Total Amount</p>
            <p className="text-xl font-bold text-emerald-600">
              {formatUgx(order.totalPrice)}
            </p>
          </div>
          <div>
            <p className="mb-1 text-sm text-slate-500">Current Status</p>
            <span
              className={cn(
                'inline-flex rounded-full px-3 py-1 text-sm font-semibold capitalize ring-1 ring-inset',
                statusStyles[order.status]
              )}
            >
              {order.status}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-lg font-semibold text-slate-900">Customer Information</h2>
        <div className="grid gap-6 md:grid-cols-3">
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Order Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
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
                  <td className="px-6 py-4 text-slate-600">{formatUgx(item.price)}</td>
                  <td className="px-6 py-4 text-right font-semibold text-slate-900">
                    {formatUgx(item.price * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-lg font-semibold text-slate-900">Update Status</h2>
        <div className="flex flex-wrap gap-3">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => void handleStatusChange(status)}
              disabled={isUpdating || order.status === status}
              className={cn(
                'rounded-lg px-5 py-2.5 text-sm font-semibold capitalize transition disabled:opacity-50',
                order.status === status
                  ? 'cursor-not-allowed bg-slate-100 text-slate-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
