'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import AdminGuard from '@/components/admin-guard';
import AdminLayout from '@/components/admin-layout';
import CameraScannerModal from '@/components/admin/pos/camera-scanner-modal';
import CheckoutModal from '@/components/admin/pos/checkout-modal';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { usePermissions } from '@/hooks/use-permissions';
import SaleReceiptModal from '@/components/admin/pos/sale-receipt-modal';
import { createSaleClient, getSaleByIdClient, voidSaleClient } from '@/lib/sales-client';
import { formatUgx } from '@/lib/currency';
import {
  getProductByBarcode,
  getProducts,
  type Product,
} from '@/lib/firestore';
import type { Sale, SalePaymentMethod } from '@/lib/erp-types';
import {
  Camera,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  ScanBarcode,
  X,
} from 'lucide-react';

interface CartItem {
  product: Product;
  quantity: number;
}

export default function PosPage() {
  const { loading: permLoading, can } = usePermissions();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCancellingSale, setIsCancellingSale] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      const productsData = await getProducts();
      setProducts(productsData.filter((p) => p.stock > 0));
    } catch {
      toast.error('Failed to load POS data');
    } finally {
      setIsLoading(false);
    }
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = useCallback((product: Product, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const newQty = existing.quantity + qty;
        if (newQty > product.stock) {
          toast.error(`Only ${product.stock} in stock`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: newQty }
            : item
        );
      }
      if (qty > product.stock) {
        toast.error(`Only ${product.stock} in stock`);
        return prev;
      }
      return [...prev, { product, quantity: qty }];
    });
  }, []);

  const handleBarcodeScan = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;

      const fromCache = products.find((p) => p.barcode === trimmed);
      if (fromCache) {
        addToCart(fromCache);
        toast.success(`Added ${fromCache.name}`);
        return;
      }

      try {
        const product = await getProductByBarcode(trimmed);
        if (product && product.stock > 0) {
          addToCart(product);
          toast.success(`Added ${product.name}`);
        } else {
          toast.error('Product not found or out of stock');
        }
      } catch {
        toast.error('Failed to look up barcode');
      }
    },
    [addToCart, products]
  );

  useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: !checkoutOpen && !cameraOpen && !completedSale,
  });

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.colourCode?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
    );
  }, [products, search]);

  const total = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const newQty = item.quantity + delta;
          if (newQty > item.product.stock) {
            toast.error(`Only ${item.product.stock} in stock`);
            return item;
          }
          return { ...item, quantity: newQty };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
  };

  const handleCancelCompletedSale = async () => {
    if (!completedSale) return;

    if (
      !confirm(
        'Cancel this sale completely? It will be removed as if it never happened and stock will be restored.'
      )
    ) {
      return;
    }

    setIsCancellingSale(true);
    try {
      await voidSaleClient(completedSale.id);
      setCompletedSale(null);
      toast.success('Sale cancelled');
      void loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to cancel sale'
      );
    } finally {
      setIsCancellingSale(false);
    }
  };

  const handleCheckout = async (data: {
    paymentMethod: SalePaymentMethod;
    amountTendered?: number;
    paymentReference?: string;
  }) => {
    if (cart.length === 0) return;

    setIsProcessing(true);
    try {
      const saleId = await createSaleClient({
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          discount: 0,
        })),
        discountTotal: 0,
        paymentMethod: data.paymentMethod,
        amountTendered: data.amountTendered,
        paymentReference: data.paymentReference,
      });

      const sale = await getSaleByIdClient(saleId);
      if (!sale) {
        throw new Error('Sale saved but receipt could not be loaded.');
      }

      setCompletedSale(sale);
      setCart([]);
      setCheckoutOpen(false);
      toast.success('Sale completed!');
      void loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sale failed');
    } finally {
      setIsProcessing(false);
    }
  };

  if (permLoading) {
    return (
      <AdminGuard>
        <AdminLayout title="Point of Sale">
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
          </div>
        </AdminLayout>
      </AdminGuard>
    );
  }

  if (!can('accessPos')) {
    return (
      <AdminGuard>
        <AdminLayout title="Point of Sale">
          <p className="text-slate-600">You do not have permission to access POS.</p>
        </AdminLayout>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <AdminLayout
        activeSection="pos"
        title="Point of Sale"
        subtitle="Scan, search, and checkout — built for fast counter sales."
      >
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
          {/* Products panel */}
          <div className="min-w-0 flex-1 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, barcode, brand, paint code..."
                    data-barcode-input="true"
                    autoFocus
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <Camera size={18} />
                  Scan
                </button>
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                  <ScanBarcode size={12} />
                  Scanner active
                </span>
                USB scanner or camera — scan to add instantly
              </p>
            </div>

            {isLoading ? (
              <div className="flex justify-center rounded-2xl border border-slate-200 bg-white py-24">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
                <PackageIcon />
                <p className="mt-3 font-medium text-slate-700">No products found</p>
                <p className="mt-1 text-sm text-slate-500">
                  {search ? 'Try a different search term' : 'No in-stock products available'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 2xl:grid-cols-4">
                {filteredProducts.map((product) => {
                  const inCart = cart.find((c) => c.product.id === product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addToCart(product)}
                      className={`group relative flex flex-col rounded-2xl border bg-white p-3 text-left shadow-sm transition active:scale-[0.98] ${
                        inCart
                          ? 'border-blue-400 ring-2 ring-blue-100'
                          : 'border-slate-200 hover:border-blue-300 hover:shadow-md'
                      }`}
                    >
                      {inCart && (
                        <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-bold text-white">
                          {inCart.quantity}
                        </span>
                      )}
                      <div className="mb-3 flex h-24 items-center justify-center overflow-hidden rounded-xl bg-slate-50">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="h-full w-full object-contain p-2 transition group-hover:scale-105"
                          />
                        ) : (
                          <ShoppingCart size={28} className="text-slate-300" />
                        )}
                      </div>
                      <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
                        {product.name}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {product.brand && (
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            {product.brand}
                          </span>
                        )}
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          {product.category}
                        </span>
                      </div>
                      <div className="mt-auto flex items-end justify-between pt-3">
                        <span className="text-base font-bold text-blue-600">
                          {formatUgx(product.price)}
                        </span>
                        <span
                          className={`text-[11px] font-medium ${
                            product.stock <= (product.reorderLevel ?? 5)
                              ? 'text-amber-600'
                              : 'text-slate-400'
                          }`}
                        >
                          {product.stock} left
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart panel */}
          <aside className="w-full shrink-0 xl:sticky xl:top-6 xl:w-[360px]">
            <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-4 py-3.5 text-white">
                <div className="flex items-center gap-2.5">
                  <ShoppingCart size={20} />
                  <div>
                    <h3 className="font-semibold">Current Sale</h3>
                    <p className="text-xs text-slate-300">
                      {cartCount} item{cartCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="max-h-[min(50vh,420px)] overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="px-6 py-14 text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                      <ShoppingCart size={24} className="text-slate-400" />
                    </div>
                    <p className="font-medium text-slate-700">Cart is empty</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Tap a product or scan a barcode
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {cart.map((item) => {
                      const lineTotal = item.product.price * item.quantity;
                      return (
                        <li key={item.product.id} className="flex gap-3 px-4 py-3.5">
                          {item.product.image && (
                            <img
                              src={item.product.image}
                              alt=""
                              className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-slate-100"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {item.product.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatUgx(item.product.price)} × {item.quantity}
                            </p>
                            <p className="mt-1 text-sm font-bold text-slate-900">
                              {formatUgx(lineTotal)}
                            </p>
                          </div>
                          <div className="flex flex-col items-end justify-between gap-1">
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.product.id)}
                              className="rounded-md p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                              aria-label="Remove item"
                            >
                              <X size={16} />
                            </button>
                            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.product.id, -1)}
                                className="rounded-md p-1.5 text-slate-600 transition hover:bg-white"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="w-7 text-center text-sm font-bold text-slate-900">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.product.id, 1)}
                                className="rounded-md p-1.5 text-slate-600 transition hover:bg-white"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="border-t border-slate-100 bg-slate-50 p-4">
                <div className="mb-4 flex items-baseline justify-between">
                  <span className="text-sm font-medium text-slate-600">Total</span>
                  <span className="text-2xl font-bold tracking-tight text-slate-900">
                    {formatUgx(total)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCheckoutOpen(true)}
                  disabled={cart.length === 0}
                  className="w-full rounded-xl bg-blue-600 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {cart.length === 0 ? 'Add items to checkout' : `Checkout — ${formatUgx(total)}`}
                </button>
              </div>
            </div>
          </aside>
        </div>

        <CameraScannerModal
          open={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onScan={handleBarcodeScan}
        />

        <CheckoutModal
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          total={total}
          onConfirm={handleCheckout}
          isProcessing={isProcessing}
        />

        <SaleReceiptModal
          sale={completedSale}
          open={!!completedSale}
          onClose={() => setCompletedSale(null)}
          onCancelSale={
            can('processRefunds') ? handleCancelCompletedSale : undefined
          }
          isCancelling={isCancellingSale}
        />
      </AdminLayout>
    </AdminGuard>
  );
}

function PackageIcon() {
  return (
    <svg
      className="mx-auto h-10 w-10 text-slate-300"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  );
}
