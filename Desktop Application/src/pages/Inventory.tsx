import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Warehouse, X, AlertTriangle } from 'lucide-react';
import { getProducts, getStockMovements } from '@/lib/firestore';
import { adjustStock, ADJUSTMENT_OPTIONS } from '@/lib/inventory';
import { formatDate } from '@/lib/currency';
import type { Product, StockMovement, StockMovementType } from '@/lib/types';
import StatCard from '@/components/StatCard';
import Panel from '@/components/Panel';
import { PageLoader } from '@/components/LoadingSpinner';
import { cn } from '@/lib/utils';

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<StockMovementType>('adjustment_add');
  const [adjustQty, setAdjustQty] = useState('1');
  const [adjustReason, setAdjustReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    try {
      const [productsData, movementsData] = await Promise.all([
        getProducts(),
        getStockMovements(30),
      ]);
      setProducts(productsData);
      setMovements(movementsData);
    } catch {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const stats = useMemo(() => {
    const low = products.filter((p) => p.stock > 0 && p.stock <= (p.reorderLevel ?? 5)).length;
    const out = products.filter((p) => p.stock <= 0).length;
    const total = products.reduce((sum, p) => sum + p.stock, 0);
    return { low, out, total, count: products.length };
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const handleAdjust = async () => {
    if (!adjustProduct) return;
    const qty = parseInt(adjustQty, 10);
    if (!qty || qty <= 0) {
      toast.error('Enter a valid quantity');
      return;
    }

    setSubmitting(true);
    try {
      await adjustStock({
        productId: adjustProduct.id,
        type: adjustType,
        quantity: qty,
        reason: adjustReason || undefined,
      });
      toast.success(
        navigator.onLine
          ? 'Stock adjusted successfully'
          : 'Adjustment saved offline — will sync when online'
      );
      setAdjustProduct(null);
      setAdjustQty('1');
      setAdjustReason('');
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Adjustment failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Inventory</h1>
        <p className="mt-1 text-slate-500">Monitor stock levels and make adjustments</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Products" value={String(stats.count)} icon={Warehouse} />
        <StatCard label="Total Units" value={String(stats.total)} icon={Warehouse} tone="info" />
        <StatCard label="Low Stock" value={String(stats.low)} icon={AlertTriangle} tone="warning" />
        <StatCard label="Out of Stock" value={String(stats.out)} icon={AlertTriangle} tone="danger" />
      </div>

      <div className="relative max-w-md">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search inventory..."
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-5 py-3 font-semibold text-slate-600">Product</th>
                <th className="px-5 py-3 font-semibold text-slate-600">Stock</th>
                <th className="px-5 py-3 font-semibold text-slate-600">Reorder</th>
                <th className="px-5 py-3 font-semibold text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((product) => {
                const isLow = product.stock <= (product.reorderLevel ?? 5);
                return (
                  <tr key={product.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4 font-medium text-slate-900">{product.name}</td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-1 text-xs font-semibold',
                          product.stock <= 0
                            ? 'bg-red-50 text-red-700'
                            : isLow
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                        )}
                      >
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500">{product.reorderLevel ?? 5}</td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setAdjustProduct(product)}
                        className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Panel title="Recent Movements" subtitle="Last 30 stock changes">
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {movements.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No movements yet</p>
            ) : (
              movements.map((m) => (
                <div key={m.id} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-900">{m.productName}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {m.quantityChange > 0 ? '+' : ''}
                      {m.quantityChange} · {m.type.replace(/_/g, ' ')}
                    </span>
                    <span>{formatDate(m.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <AnimatePresence>
        {adjustProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
            onClick={() => !submitting && setAdjustProduct(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Adjust Stock</h2>
                <button type="button" onClick={() => setAdjustProduct(null)}>
                  <X size={20} />
                </button>
              </div>
              <p className="mb-4 text-sm text-slate-500">
                {adjustProduct.name} · Current: {adjustProduct.stock}
              </p>

              <div className="mb-4 grid grid-cols-2 gap-2">
                {ADJUSTMENT_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAdjustType(value)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-xs font-medium transition',
                      adjustType === value
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <input
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                min="1"
                className="mb-3 w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Quantity"
              />
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Reason (optional)"
              />

              <button
                type="button"
                onClick={handleAdjust}
                disabled={submitting}
                className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Confirm Adjustment'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
