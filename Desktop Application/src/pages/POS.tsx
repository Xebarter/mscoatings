import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  ScanBarcode,
  CreditCard,
  X,
} from 'lucide-react';
import { getProducts, getProductByBarcode } from '@/lib/firestore';
import { createSale, PAYMENT_METHODS, voidSale } from '@/lib/sales';
import { formatUgx } from '@/lib/currency';
import type { Product, Sale, SalePaymentMethod } from '@/lib/types';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useOnline } from '@/hooks/useOnline';
import { usePermissions } from '@/hooks/usePermissions';
import Panel from '@/components/Panel';
import ProductThumb from '@/components/ProductThumb';
import SaleReceiptModal from '@/components/pos/SaleReceiptModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { PageLoader } from '@/components/LoadingSpinner';
import { cn } from '@/lib/utils';

interface CartItem {
  product: Product;
  quantity: number;
  discount: number; // fixed UGX discount for this line
}

export default function POSPage() {
  const online = useOnline();
  const { can, permissions } = usePermissions();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('cash');
  const [amountTendered, setAmountTendered] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [confirmKind, setConfirmKind] = useState<'void' | null>(null);
  useEffect(() => {
    void getProducts()
      .then((data) => setProducts(data.filter((p) => p.stock > 0)))
      .catch(() =>
        toast.error(
          online
            ? 'Failed to load products'
            : 'No offline catalog yet. Connect once to sync products.'
        )
      )
      .finally(() => setLoading(false));
  }, [online]);

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
          item.product.id === product.id ? { ...item, quantity: newQty } : item
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

      const cached = products.find((p) => p.barcode === trimmed);
      if (cached) {
        addToCart(cached);
        toast.success(`Added ${cached.name}`);
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
        toast.error('Barcode lookup failed');
      }
    },
    [products, addToCart]
  );

  useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: !checkoutOpen && !receiptOpen,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
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

  const cartTotal = Math.max(0, discountedSubtotal - effectiveOrderDiscount);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

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
      const newDiscountCap = newGrossSubtotal * (maxDiscountPercent / 100);

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

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => {
      const nextCart = prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > item.product.stock) {
            toast.error(`Only ${item.product.stock} in stock`);
            return item;
          }

          const lineGross = item.product.price * newQty;
          const nextDiscountByLine = canApplyDiscount
            ? Math.min(item.discount, lineGross)
            : 0;

          return { ...item, quantity: newQty, discount: nextDiscountByLine };
        })
        .filter(Boolean) as CartItem[];

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

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleCheckout = async () => {
    if (!cart.length || processing) return;
    setProcessing(true);
    const cartSnapshot = cart;
    try {
      const sale = await createSale({
        items: cartSnapshot.map((item) => {
          const lineGross = item.product.price * item.quantity;
          return {
            productId: item.product.id,
            quantity: item.quantity,
            discount: canApplyDiscount
              ? Math.min(item.discount, lineGross)
              : 0,
          };
        }),
        paymentMethod,
        discountTotal: canApplyDiscount ? effectiveOrderDiscount : 0,
        maxDiscountPercent: canApplyDiscount ? maxDiscountPercent : 0,
        amountTendered:
          paymentMethod === 'cash' ? parseFloat(amountTendered) || cartTotal : undefined,
        paymentReference:
          paymentMethod === 'mobile_money' && paymentReference.trim()
            ? paymentReference.trim()
            : undefined,
      });

      toast.success(
        online ? 'Sale completed' : 'Sale saved on this device — syncs when online',
        { duration: 3500 }
      );

      setCart([]);
      setOrderDiscount(0);
      setCheckoutOpen(false);
      setAmountTendered('');
      setPaymentReference('');

      const soldQty = new Map(
        cartSnapshot.map((item) => [item.product.id, item.quantity] as const)
      );
      setProducts((prev) =>
        prev
          .map((p) => {
            const qty = soldQty.get(p.id);
            return qty ? { ...p, stock: Math.max(0, p.stock - qty) } : p;
          })
          .filter((p) => p.stock > 0)
      );

      setReceiptSale(sale);
      setReceiptOpen(true);

      if (online) {
        void getProducts()
          .then((updated) => setProducts(updated.filter((p) => p.stock > 0)))
          .catch(() => undefined);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Checkout failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleVoidReceiptSale = async () => {
    if (!receiptSale) return;
    setReceiptBusy(true);
    try {
      await voidSale(receiptSale.id, receiptSale);
      toast.success('Sale voided');
      setConfirmKind(null);
      setReceiptOpen(false);

      const restored = new Map(
        receiptSale.items.map((item) => [item.productId, item.quantity] as const)
      );
      setProducts((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]));
        for (const [productId, qty] of restored) {
          const existing = byId.get(productId);
          if (existing) {
            byId.set(productId, { ...existing, stock: existing.stock + qty });
          }
        }
        return [...byId.values()].filter((p) => p.stock > 0);
      });
      setReceiptSale(null);

      if (online) {
        void getProducts()
          .then((updated) => setProducts(updated.filter((p) => p.stock > 0)))
          .catch(() => undefined);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Void failed');
    } finally {
      setReceiptBusy(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Point of Sale</h1>
          <p className="mt-1 text-slate-500">
            {online
              ? 'Search products · USB scanner ready'
              : 'Offline POS enabled — sales queue until you reconnect'}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2 text-blue-700">
          <ScanBarcode size={18} />
          <span className="text-sm font-medium">
            {online ? 'Scanner active' : 'Offline · Scanner active'}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, barcode, or SKU..."
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-slate-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addToCart(product)}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                  <ProductThumb
                    productId={product.id}
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{product.name}</p>
                  <p className="text-xs text-slate-500">{product.category}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-bold text-blue-600">{formatUgx(product.price)}</span>
                    <span className="text-xs text-slate-400">{product.stock} in stock</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          <Panel
            title="Cart"
            subtitle={`${cartCount} item${cartCount !== 1 ? 's' : ''}`}
            className="sticky top-0"
          >
            {cart.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-slate-400">
                <ShoppingCart size={40} className="mb-3 opacity-50" />
                <p className="text-sm">Cart is empty</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  <AnimatePresence>
                    {cart.map((item) => (
                      <motion.div
                        key={item.product.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-3 rounded-lg bg-slate-50 p-3"
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md">
                          <ProductThumb
                            productId={item.product.id}
                            src={item.product.image}
                            alt={item.product.name}
                            className="h-full w-full"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {item.product.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatUgx(item.product.price)} each
                          </p>
                          {(() => {
                            const lineGross = item.product.price * item.quantity;
                            const lineDiscount = canApplyDiscount
                              ? Math.min(item.discount, lineGross)
                              : 0;
                            const lineTotal = Math.max(0, lineGross - lineDiscount);

                            return (
                              <>
                                {canApplyDiscount && (
                                  <div className="mt-2 flex items-center justify-between gap-3">
                                    <span className="text-[11px] font-medium text-slate-500">
                                      Disc
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
                                      className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs font-semibold text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                  </div>
                                )}
                                <p className="mt-1 text-xs font-semibold text-slate-700">
                                  {formatUgx(lineTotal)}
                                </p>
                              </>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateQty(item.product.id, -1)}
                            className="rounded-md p-1 hover:bg-slate-200"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center text-sm font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQty(item.product.id, 1)}
                            className="rounded-md p-1 hover:bg-slate-200"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.product.id)}
                          className="rounded-md p-1 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                <div className="border-t border-slate-200 pt-4">
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
                          max={Math.max(0, discountCap - itemDiscountTotal)}
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
                  <div className="flex items-center justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-emerald-700">{formatUgx(cartTotal)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCheckoutOpen(true)}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-3 font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:shadow-blue-500/40"
                  >
                    <CreditCard size={18} />
                    Checkout
                  </button>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>

      <AnimatePresence>
        {checkoutOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
            onClick={() => !processing && setCheckoutOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Complete Sale</h2>
                  {!online && (
                    <p className="mt-0.5 text-xs font-medium text-amber-700">
                      Offline — saves to this device instantly
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => !processing && setCheckoutOpen(false)}
                  disabled={processing}
                  className="rounded-lg p-1 hover:bg-slate-100 disabled:opacity-40"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="mb-4 text-3xl font-bold text-emerald-700">{formatUgx(cartTotal)}</p>

              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPaymentMethod(value)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm font-medium transition',
                        paymentMethod === value
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'cash' && (
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Amount Tendered
                  </label>
                  <input
                    type="number"
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                    placeholder={String(cartTotal)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  {parseFloat(amountTendered) > cartTotal && (
                    <p className="mt-2 text-sm text-emerald-600">
                      Change: {formatUgx(parseFloat(amountTendered) - cartTotal)}
                    </p>
                  )}
                </div>
              )}

              {paymentMethod === 'mobile_money' && (
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Payment Reference <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="MM / transaction ID"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleCheckout()}
                disabled={processing}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-3.5 font-semibold text-white shadow-lg transition disabled:cursor-wait disabled:opacity-70"
              >
                {processing ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {online ? 'Completing sale…' : 'Saving locally…'}
                  </>
                ) : (
                  'Confirm Payment'
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SaleReceiptModal
        sale={receiptSale}
        open={receiptOpen}
        onClose={() => {
          setReceiptOpen(false);
          setReceiptSale(null);
        }}
        canProcessRefunds={can('processRefunds')}
        isBusy={receiptBusy}
        onVoid={() => setConfirmKind('void')}
      />

      <ConfirmDialog
        open={confirmKind === 'void'}
        variant="danger"
        title="Void this sale?"
        description="This cancels the sale completely. Stock will be restored and the sale record removed as if it never happened."
        confirmLabel="Void sale"
        cancelLabel="Keep sale"
        loading={receiptBusy}
        details={
          receiptSale
            ? [
                { label: 'Receipt', value: receiptSale.receiptNumber },
                { label: 'Amount', value: formatUgx(receiptSale.totalAmount) },
                {
                  label: 'Items',
                  value: String(receiptSale.items.length),
                },
              ]
            : undefined
        }
        onClose={() => {
          if (!receiptBusy) setConfirmKind(null);
        }}
        onConfirm={() => void handleVoidReceiptSale()}
      />

    </div>
  );
}
