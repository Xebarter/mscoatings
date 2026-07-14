'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import AdminGuard from '@/components/admin-guard';
import AdminLayout from '@/components/admin-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { auth } from '@/lib/firebase';
import { adjustStockClient, getAdjustmentQuantityChange } from '@/lib/inventory-client';
import { formatUgx } from '@/lib/currency';
import {
  getProducts,
  getStockMovementsClient,
  type Product,
} from '@/lib/firestore';
import type { StockMovement, StockMovementType } from '@/lib/erp-types';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  History,
  Package,
  RefreshCw,
  Search,
  TrendingDown,
  Warehouse,
} from 'lucide-react';

const ADJUSTMENT_TYPES: {
  value: StockMovementType;
  label: string;
  description: string;
}[] = [
  {
    value: 'adjustment_add',
    label: 'Add stock',
    description: 'Incoming delivery or restock',
  },
  {
    value: 'adjustment_remove',
    label: 'Remove stock',
    description: 'Manual stock reduction',
  },
  {
    value: 'damaged',
    label: 'Damaged',
    description: 'Write off damaged units',
  },
  {
    value: 'lost',
    label: 'Lost / missing',
    description: 'Shrinkage or unaccounted loss',
  },
];

const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  sale: 'Sale',
  return: 'Return',
  adjustment_add: 'Stock in',
  adjustment_remove: 'Stock out',
  damaged: 'Damaged',
  lost: 'Lost',
  initial: 'Initial',
};

function getReorderLevel(product: Product): number {
  return product.reorderLevel ?? 5;
}

function getStockStatus(
  product: Product
): 'out' | 'low' | 'ok' {
  if (product.stock <= 0) return 'out';
  if (product.stock <= getReorderLevel(product)) return 'low';
  return 'ok';
}

function getMovementDate(createdAt: StockMovement['createdAt']): Date {
  if (!createdAt) return new Date();
  if (
    typeof createdAt === 'object' &&
    'toDate' in createdAt &&
    typeof createdAt.toDate === 'function'
  ) {
    return createdAt.toDate();
  }
  if (typeof createdAt === 'object' && 'seconds' in createdAt) {
    return new Date((createdAt as { seconds: number }).seconds * 1000);
  }
  return new Date(String(createdAt));
}

function formatMovementTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleString('en-UG', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StockStatusBadge({ status }: { status: 'out' | 'low' | 'ok' }) {
  if (status === 'out') {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">
        Out of stock
      </span>
    );
  }
  if (status === 'low') {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
        Low stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
      In stock
    </span>
  );
}

export default function InventoryPage() {
  const { can } = usePermissions();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [adjustType, setAdjustType] =
    useState<StockMovementType>('adjustment_add');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    try {
      const [productsData, movementsData] = await Promise.all([
        getProducts(),
        getStockMovementsClient({ limit: 50 }),
      ]);
      setProducts(productsData);
      setMovements(movementsData);
    } catch {
      toast.error('Failed to load inventory');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !quantity || isAdjusting) return;

    const parsedQuantity = parseInt(quantity, 10);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) return;

    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;

    const quantityChange = getAdjustmentQuantityChange(adjustType, parsedQuantity);
    const optimisticStock = product.stock + quantityChange;

    if (optimisticStock < 0) {
      toast.error(`Insufficient stock. Available: ${product.stock}`);
      return;
    }

    const performedBy =
      auth.currentUser?.email?.toLowerCase() ?? 'staff';
    const reasonNote = reason.trim();
    const tempMovementId = `pending-${Date.now()}`;
    const optimisticMovement: StockMovement = {
      id: tempMovementId,
      productId: product.id,
      productName: product.name,
      type: adjustType,
      quantityChange,
      resultingStock: optimisticStock,
      referenceType: 'adjustment',
      reason: reasonNote,
      performedBy,
      createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as StockMovement['createdAt'],
    };

    setProducts((prev) =>
      prev.map((p) =>
        p.id === selectedProductId ? { ...p, stock: optimisticStock } : p
      )
    );
    setMovements((prev) => [optimisticMovement, ...prev].slice(0, 50));
    setQuantity('');
    setReason('');

    setIsAdjusting(true);
    try {
      const result = await adjustStockClient({
        productId: selectedProductId,
        type: adjustType,
        quantity: parsedQuantity,
        reason: reasonNote,
      });

      setProducts((prev) =>
        prev.map((p) =>
          p.id === selectedProductId
            ? { ...p, stock: result.resultingStock }
            : p
        )
      );
      setMovements((prev) =>
        prev.map((movement) =>
          movement.id === tempMovementId ? result.movement : movement
        )
      );
      toast.success(`Updated · ${result.resultingStock} in stock`, {
        duration: 2000,
      });
    } catch (error) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === selectedProductId ? { ...p, stock: product.stock } : p
        )
      );
      setMovements((prev) =>
        prev.filter((movement) => movement.id !== tempMovementId)
      );
      toast.error(error instanceof Error ? error.message : 'Adjustment failed');
    } finally {
      setIsAdjusting(false);
    }
  };

  const stats = useMemo(() => {
    const lowStockCount = products.filter(
      (p) => getStockStatus(p) === 'low'
    ).length;
    const outOfStockCount = products.filter(
      (p) => getStockStatus(p) === 'out'
    ).length;
    const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
    const inventoryValue = products.reduce(
      (sum, p) => sum + p.stock * (p.costPrice ?? 0),
      0
    );

    return {
      skuCount: products.length,
      totalUnits,
      inventoryValue,
      lowStockCount,
      outOfStockCount,
    };
  }, [products]);

  const displayedProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products
      .filter((product) => {
        if (filterLowStock && getStockStatus(product) === 'ok') return false;
        if (!query) return true;
        return (
          product.name.toLowerCase().includes(query) ||
          product.barcode?.toLowerCase().includes(query) ||
          product.sku?.toLowerCase().includes(query) ||
          product.category.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const statusOrder = { out: 0, low: 1, ok: 2 };
        const statusDiff =
          statusOrder[getStockStatus(a)] - statusOrder[getStockStatus(b)];
        if (statusDiff !== 0) return statusDiff;
        return a.name.localeCompare(b.name);
      });
  }, [products, filterLowStock, search]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  return (
    <AdminGuard>
      <AdminLayout
        activeSection="inventory"
        title="Inventory"
        subtitle="Monitor stock levels, record adjustments, and review movement history."
        actions={
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={isRefreshing ? 'animate-spin' : undefined}
            />
            Refresh
          </button>
        }
      >
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: 'Products tracked',
              value: String(stats.skuCount),
              icon: Package,
              tone: 'text-blue-600 bg-blue-50',
            },
            {
              label: 'Units on hand',
              value: stats.totalUnits.toLocaleString('en-UG'),
              icon: Boxes,
              tone: 'text-violet-600 bg-violet-50',
            },
            {
              label: 'Inventory value',
              value: formatUgx(stats.inventoryValue),
              icon: Warehouse,
              tone: 'text-emerald-600 bg-emerald-50',
            },
            {
              label: 'Needs attention',
              value: String(stats.lowStockCount + stats.outOfStockCount),
              icon: TrendingDown,
              tone: 'text-amber-600 bg-amber-50',
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
                      {isLoading ? '—' : stat.value}
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

        {(stats.lowStockCount > 0 || stats.outOfStockCount > 0) && !isLoading && (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                <AlertTriangle size={18} className="text-amber-700" />
              </div>
              <div>
                <p className="font-semibold text-amber-900">Stock alert</p>
                <p className="text-sm text-amber-800">
                  {stats.outOfStockCount > 0 && (
                    <>
                      <strong>{stats.outOfStockCount}</strong> out of stock
                      {stats.lowStockCount > 0 ? ', ' : ''}
                    </>
                  )}
                  {stats.lowStockCount > 0 && (
                    <>
                      <strong>{stats.lowStockCount}</strong> below reorder level
                    </>
                  )}
                  . Review and restock soon.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFilterLowStock(true)}
              className="shrink-0 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800"
            >
              View items
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <h3 className="font-semibold text-slate-900">Stock levels</h3>
                  <p className="text-sm text-slate-500">
                    {displayedProducts.length} of {products.length} products
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative">
                    <Search
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search name, barcode, category…"
                      className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-64"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilterLowStock((prev) => !prev)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      filterLowStock
                        ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-200'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Low stock only
                  </button>
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-20">
                  <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                </div>
              ) : displayedProducts.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <Package className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="font-medium text-slate-700">No products found</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {search || filterLowStock
                      ? 'Try clearing your search or filters.'
                      : 'Add products to start tracking inventory.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-3 font-semibold">Product</th>
                        <th className="px-4 py-3 font-semibold">Barcode</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 text-right font-semibold">
                          On hand
                        </th>
                        <th className="px-4 py-3 text-right font-semibold">
                          Reorder
                        </th>
                        <th className="px-5 py-3 text-right font-semibold">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedProducts.map((product) => {
                        const status = getStockStatus(product);
                        const reorder = getReorderLevel(product);
                        const stockRatio = Math.min(
                          100,
                          reorder > 0 ? (product.stock / reorder) * 100 : 100
                        );

                        return (
                          <tr
                            key={product.id}
                            className="transition hover:bg-slate-50/80"
                          >
                            <td className="px-5 py-3.5">
                              <p className="font-medium text-slate-900">
                                {product.name}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {product.category}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                              {product.barcode ?? '—'}
                            </td>
                            <td className="px-4 py-3.5">
                              <StockStatusBadge status={status} />
                              <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={`h-full rounded-full ${
                                    status === 'out'
                                      ? 'bg-red-500'
                                      : status === 'low'
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${stockRatio}%` }}
                                />
                              </div>
                            </td>
                            <td
                              className={`px-4 py-3.5 text-right font-semibold tabular-nums ${
                                status === 'out'
                                  ? 'text-red-600'
                                  : status === 'low'
                                    ? 'text-amber-600'
                                    : 'text-slate-900'
                              }`}
                            >
                              {product.stock}
                            </td>
                            <td className="px-4 py-3.5 text-right tabular-nums text-slate-500">
                              {reorder}
                            </td>
                            <td className="px-5 py-3.5 text-right font-medium text-slate-700">
                              {formatUgx(product.stock * (product.costPrice ?? 0))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {can('adjustStock') && (
              <form
                onSubmit={handleAdjust}
                className="rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                      <Package size={18} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Adjust stock
                      </h3>
                      <p className="text-xs text-slate-500">
                        Record incoming, outgoing, or write-off movements
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Product
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Select product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.stock} in stock
                        </option>
                      ))}
                    </select>
                    {selectedProduct && (
                      <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        Current level:{' '}
                        <span className="font-semibold text-slate-900">
                          {selectedProduct.stock} units
                        </span>
                        {selectedProduct.barcode && (
                          <>
                            {' '}
                            · {selectedProduct.barcode}
                          </>
                        )}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Adjustment type
                    </label>
                    <select
                      value={adjustType}
                      onChange={(e) =>
                        setAdjustType(e.target.value as StockMovementType)
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      {ADJUSTMENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {
                        ADJUSTMENT_TYPES.find((t) => t.value === adjustType)
                          ?.description
                      }
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Quantity
                      </label>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        min={1}
                        required
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Reason
                      </label>
                      <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Optional note"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isAdjusting}
                    className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isAdjusting ? 'Applying…' : 'Apply adjustment'}
                  </button>
                </div>
              </form>
            )}

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                  <History size={18} className="text-slate-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Recent movements
                  </h3>
                  <p className="text-xs text-slate-500">Last 50 transactions</p>
                </div>
              </div>

              <div className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                  </div>
                ) : movements.length === 0 ? (
                  <p className="px-5 py-12 text-center text-sm text-slate-400">
                    No stock movements recorded yet
                  </p>
                ) : (
                  movements.map((movement) => {
                    const isIncrease = movement.quantityChange > 0;
                    const Icon = isIncrease ? ArrowUpRight : ArrowDownRight;

                    return (
                      <div
                        key={movement.id}
                        className="flex gap-3 px-5 py-3.5 transition hover:bg-slate-50"
                      >
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            isIncrease
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-red-50 text-red-600'
                          }`}
                        >
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate font-medium text-slate-900">
                              {movement.productName}
                            </p>
                            <span
                              className={`shrink-0 text-sm font-semibold tabular-nums ${
                                isIncrease ? 'text-emerald-600' : 'text-red-600'
                              }`}
                            >
                              {isIncrease ? '+' : ''}
                              {movement.quantityChange}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                              {MOVEMENT_LABELS[movement.type]}
                            </span>
                            <span className="text-xs text-slate-500">
                              Balance: {movement.resultingStock}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {formatMovementTime(getMovementDate(movement.createdAt))}
                            {movement.performedBy && (
                              <> · {movement.performedBy.split('@')[0]}</>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
