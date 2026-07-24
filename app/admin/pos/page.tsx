'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import AdminGuard from '@/components/admin-guard';
import AdminLayout from '@/components/admin-layout';
import ProductImage from '@/components/product-image';
import CheckoutModal from '@/components/admin/pos/checkout-modal';
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner';
import { usePermissions } from '@/hooks/use-permissions';
import SaleReceiptModal from '@/components/admin/pos/sale-receipt-modal';
import ConfirmDialog from '@/components/admin/confirm-dialog';
import { createSaleClient, voidSaleClient } from '@/lib/sales-client';
import { formatUgx } from '@/lib/currency';
import {
  getProductByBarcode,
  getProducts,
  type Product,
} from '@/lib/firestore';
import { prefetchProductImages } from '@/lib/product-image-cache';
import type { Sale, SalePaymentMethod } from '@/lib/erp-types';
import { Timestamp } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import {
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
  discount: number; // fixed UGX discount for this line
}

export default function PosPage() {
  const { loading: permLoading, can, permissions } = usePermissions();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCancellingSale, setIsCancellingSale] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);
  const [orderDiscount, setOrderDiscount] = useState(0);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      const productsData = await getProducts();
      const inStock = productsData.filter((p) => p.stock > 0);
      setProducts(inStock);
      void prefetchProductImages(productsData);
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
      return [...prev, { product, quantity: qty, discount: 0 }];
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
    enabled: !checkoutOpen && !completedSale,
  });

  const filteredProducts = useMemo(() => {
    const inStock = products.filter((p) => p.stock > 0);
    const q = search.trim().toLowerCase();
    if (!q) return inStock;
    return inStock.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.colourCode?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
    );
  }, [products, search]);

  const canApplyDiscount = can('applyDiscount');
  const maxDiscountPercent = permissions?.maxDiscountPercent ?? 0;

  const grossSubtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const itemDiscountTotal = canApplyDiscount
    ? cart.reduce(
        (sum, item) =>
          sum + Math.min(item.discount, item.product.price * item.quantity),
        0
      )
    : 0;

  const discountedSubtotal = Math.max(0, grossSubtotal - itemDiscountTotal);

  const discountCap = canApplyDiscount
    ? grossSubtotal * (maxDiscountPercent / 100)
    : 0;

  const effectiveOrderDiscount = canApplyDiscount
    ? Math.min(
        orderDiscount,
        discountedSubtotal,
        Math.max(0, discountCap - itemDiscountTotal)
      )
    : 0;

  const total = Math.max(0, discountedSubtotal - effectiveOrderDiscount);

  const setItemDiscount = (productId: string, nextDiscount: number) => {
    if (!canApplyDiscount) return;

    setCart((prev) => {
      const target = prev.find((i) => i.product.id === productId);
      if (!target) return prev;

      const desired = Number.isFinite(nextDiscount) ? nextDiscount : 0;
      const safeDesired = Math.max(0, desired);

      const newGrossSubtotal = prev.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      );
      const newDiscountCap =
        canApplyDiscount ? newGrossSubtotal * (maxDiscountPercent / 100) : 0;

      const otherItemDiscountTotal = prev.reduce((sum, item) => {
        if (item.product.id === productId) return sum;
        return (
          sum +
          Math.min(item.discount, item.product.price * item.quantity)
        );
      }, 0);

      const lineGross = target.product.price * target.quantity;
      const remainingForTarget = Math.max(
        0,
        newDiscountCap - orderDiscount - otherItemDiscountTotal
      );

      const clamped = Math.min(safeDesired, lineGross, remainingForTarget);

      return prev.map((i) =>
        i.product.id === productId ? { ...i, discount: clamped } : i
      );
    });
  };

  const setOrderDiscountClamped = (nextDiscount: number) => {
    if (!canApplyDiscount) return;
    const desired = Number.isFinite(nextDiscount) ? nextDiscount : 0;
    const safeDesired = Math.max(0, desired);
    const maxBySubtotal = discountedSubtotal;
    const maxByCap = Math.max(0, discountCap - itemDiscountTotal);
    setOrderDiscount(Math.min(safeDesired, maxBySubtotal, maxByCap));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      const nextCart = prev
        .map((item) => {
          if (item.product.id !== productId) return item;

          const newQty = item.quantity + delta;
          if (newQty > item.product.stock) {
            toast.error(`Only ${item.product.stock} in stock`);
            return item;
          }
          if (newQty <= 0) return null;

          const lineGross = item.product.price * newQty;
          const nextDiscountByLine = canApplyDiscount
            ? Math.min(item.discount, lineGross)
            : 0;

          return { ...item, quantity: newQty, discount: nextDiscountByLine };
        })
        .filter((item): item is CartItem => item !== null);

      if (!canApplyDiscount) {
        return nextCart.map((i) => ({ ...i, discount: 0 }));
      }

      // Enforce total discount cap: (sum(item discounts) + orderDiscount) <= cap
      const newGrossSubtotal = nextCart.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      );
      const newDiscountCap = newGrossSubtotal * (maxDiscountPercent / 100);

      const otherItemDiscountTotal = nextCart.reduce((sum, item) => {
        if (item.product.id === productId) return sum;
        return (
          sum +
          Math.min(item.discount, item.product.price * item.quantity)
        );
      }, 0);

      const target = nextCart.find((i) => i.product.id === productId);
      if (!target) return nextCart;

      const lineGross = target.product.price * target.quantity;
      const remainingForTarget = Math.max(
        0,
        newDiscountCap - orderDiscount - otherItemDiscountTotal
      );
      const clampedTargetDiscount = Math.min(
        target.discount,
        lineGross,
        remainingForTarget
      );

      return nextCart.map((i) =>
        i.product.id === productId ? { ...i, discount: clampedTargetDiscount } : i
      );
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setOrderDiscount(0);
  };

  const applyStockDelta = (items: Array<{ productId: string; quantity: number }>, direction: 1 | -1) => {
    setProducts((prev) =>
      prev.map((product) => {
        const delta = items.find((item) => item.productId === product.id);
        if (!delta) return product;
        return {
          ...product,
          stock: Math.max(0, product.stock + direction * delta.quantity),
        };
      })
    );
  };

  const handleCancelCompletedSale = async () => {
    if (!completedSale || completedSale.id.startsWith('pending-')) return;

    const saleToCancel = completedSale;
    setVoidConfirmOpen(false);
    // Instant UI: close receipt immediately
    setCompletedSale(null);
    applyStockDelta(saleToCancel.items, 1);

    setIsCancellingSale(true);
    const toastId = toast.loading('Cancelling sale…');
    try {
      await voidSaleClient(saleToCancel.id, saleToCancel);
      toast.success('Sale cancelled', { id: toastId });
    } catch (error) {
      // Roll back optimistic cancel
      setCompletedSale(saleToCancel);
      applyStockDelta(saleToCancel.items, -1);
      toast.error(
        error instanceof Error ? error.message : 'Failed to cancel sale',
        { id: toastId }
      );
    } finally {
      setIsCancellingSale(false);
    }
  };

  const handleCheckout = async (data: {
    paymentMethod: SalePaymentMethod;
    amountTendered?: number;
    paymentReference?: string;
    customerName?: string;
    customerPhone?: string;
  }) => {
    if (cart.length === 0 || isProcessing) return;

    setIsProcessing(true);

    const cartSnapshot = cart;
    const user = auth.currentUser;
    const cashierEmail = user?.email?.toLowerCase() ?? '';
    const cashierId = user?.uid ?? '';

    const saleItems = cartSnapshot.map((item) => {
      const lineGross = item.product.price * item.quantity;
      const lineDiscount = canApplyDiscount
        ? Math.min(item.discount, lineGross)
        : 0;

      return {
        productId: item.product.id,
        name: item.product.name,
        barcode: item.product.barcode ?? '',
        quantity: item.quantity,
        unitPrice: item.product.price,
        costPrice: item.product.costPrice ?? 0,
        discount: lineDiscount,
        lineTotal: lineGross - lineDiscount,
      };
    });

    const subtotal = saleItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const discountTotal = canApplyDiscount ? effectiveOrderDiscount : 0;
    const totalAmount = Math.max(0, subtotal - discountTotal);
    const amountTendered = data.amountTendered ?? totalAmount;
    const changeGiven =
      data.paymentMethod === 'cash'
        ? Math.max(0, amountTendered - totalAmount)
        : 0;

    const optimisticSale: Sale = {
      id: `pending-${Date.now()}`,
      receiptNumber: 'Saving…',
      items: saleItems,
      subtotal,
      discountTotal,
      totalAmount,
      paymentMethod: data.paymentMethod,
      amountTendered,
      changeGiven,
      paymentReference: data.paymentReference,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      cashierId,
      cashierEmail,
      status: 'completed',
      createdAt: Timestamp.now(),
    };

    // Instant UI: clear cart, close checkout, show receipt
    setCart([]);
    setOrderDiscount(0);
    setCheckoutOpen(false);
    setCompletedSale(optimisticSale);
    applyStockDelta(saleItems, -1);
    setIsProcessing(false);

    const toastId = toast.loading('Saving sale…');

    try {
      const sale = await createSaleClient({
        items: cartSnapshot.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          discount: canApplyDiscount
            ? Math.min(item.discount, item.product.price * item.quantity)
            : 0,
        })),
        discountTotal,
        maxDiscountPercent: canApplyDiscount ? maxDiscountPercent : 0,
        paymentMethod: data.paymentMethod,
        amountTendered: data.amountTendered,
        paymentReference: data.paymentReference,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
      });
      setCompletedSale(sale);
      toast.success('Sale completed!', { id: toastId });
    } catch (error) {
      // Roll back optimistic complete
      setCompletedSale(null);
      setCart(cartSnapshot);
      setCheckoutOpen(true);
      applyStockDelta(saleItems, 1);
      toast.error(error instanceof Error ? error.message : 'Sale failed', {
        id: toastId,
      });
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
        subtitle="Search and checkout — built for fast counter sales."
      >
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
          {/* Products panel */}
          <div className="min-w-0 flex-1 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="relative">
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
              <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                  <ScanBarcode size={12} />
                  Scanner active
                </span>
                USB scanner — scan to add instantly
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
                          <ProductImage
                            src={product.image}
                            alt={product.name}
                            productId={product.id}
                            variant="thumb"
                            className="h-full w-full"
                            imageClassName="p-2 transition group-hover:scale-105"
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
                      Tap a product to add it
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {cart.map((item) => {
                      const lineGross = item.product.price * item.quantity;
                      const lineDiscount = canApplyDiscount
                        ? Math.min(item.discount, lineGross)
                        : 0;
                      const lineTotal = Math.max(0, lineGross - lineDiscount);
                      return (
                        <li key={item.product.id} className="flex gap-3 px-4 py-3.5">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-slate-100">
                            {item.product.image ? (
                              <ProductImage
                                src={item.product.image}
                                alt={item.product.name}
                                productId={item.product.id}
                                variant="inline"
                                className="h-full w-full"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-slate-50">
                                <ShoppingCart size={16} className="text-slate-300" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {item.product.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatUgx(item.product.price)} × {item.quantity}
                            </p>
                            {canApplyDiscount && (
                              <div className="mt-1 flex items-center justify-between gap-3">
                                <span className="text-[11px] font-medium text-slate-500">
                                  Discount
                                </span>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  max={lineGross}
                                  step={1}
                                  value={item.discount}
                                  onChange={(e) => {
                                    const next = parseFloat(e.target.value);
                                    setItemDiscount(
                                      item.product.id,
                                      Number.isNaN(next) ? 0 : next
                                    );
                                  }}
                                  className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs font-semibold text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                              </div>
                            )}
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
                {canApplyDiscount && (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-700">
                        Order discount
                      </span>
                      <span className="text-xs text-slate-500">
                        Max {formatUgx(Math.max(0, discountCap - itemDiscountTotal))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-medium text-slate-500">
                        UGX
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        max={discountedSubtotal}
                        value={effectiveOrderDiscount}
                        onChange={(e) => {
                          const next = parseFloat(e.target.value);
                          setOrderDiscountClamped(
                            Number.isNaN(next) ? 0 : next
                          );
                        }}
                        className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-right text-sm font-semibold text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                )}
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
            can('processRefunds') ? () => setVoidConfirmOpen(true) : undefined
          }
          isCancelling={isCancellingSale}
        />

        <ConfirmDialog
          open={voidConfirmOpen && !!completedSale}
          variant="danger"
          title="Void this sale?"
          description="This cancels the sale completely. Stock will be restored and the sale record removed as if it never happened."
          confirmLabel="Void sale"
          cancelLabel="Keep sale"
          loading={isCancellingSale}
          details={
            completedSale
              ? [
                  { label: 'Receipt', value: completedSale.receiptNumber },
                  {
                    label: 'Amount',
                    value: formatUgx(completedSale.totalAmount),
                  },
                  {
                    label: 'Items',
                    value: String(completedSale.items.length),
                  },
                ]
              : undefined
          }
          onClose={() => {
            if (!isCancellingSale) setVoidConfirmOpen(false);
          }}
          onConfirm={() => void handleCancelCompletedSale()}
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
