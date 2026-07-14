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
import { createSale, PAYMENT_METHODS } from '@/lib/sales';
import { formatUgx } from '@/lib/currency';
import type { Product, SalePaymentMethod } from '@/lib/types';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useOnline } from '@/hooks/useOnline';
import Panel from '@/components/Panel';
import { PageLoader } from '@/components/LoadingSpinner';
import { cn } from '@/lib/utils';

interface CartItem {
  product: Product;
  quantity: number;
}

export default function POSPage() {
  const online = useOnline();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('cash');
  const [amountTendered, setAmountTendered] = useState('');

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
      return [...prev, { product, quantity: qty }];
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

  useBarcodeScanner({ onScan: handleBarcodeScan, enabled: !checkoutOpen });

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

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > item.product.stock) {
            toast.error(`Only ${item.product.stock} in stock`);
            return item;
          }
          return { ...item, quantity: newQty };
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleCheckout = async () => {
    if (!cart.length) return;
    setProcessing(true);
    try {
      await createSale({
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
        paymentMethod,
        amountTendered:
          paymentMethod === 'cash' ? parseFloat(amountTendered) || cartTotal : undefined,
      });
      toast.success(
        online ? 'Sale completed!' : 'Sale saved offline — will sync when online'
      );
      setCart([]);
      setCheckoutOpen(false);
      setAmountTendered('');
      const updated = await getProducts();
      setProducts(updated.filter((p) => p.stock > 0));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Checkout failed');
    } finally {
      setProcessing(false);
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
              ? 'Scan barcodes or search products · USB scanner ready'
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
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg">
                  🎨
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
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {item.product.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatUgx(item.product.price)} each
                          </p>
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
                <h2 className="text-xl font-bold text-slate-900">Complete Sale</h2>
                <button
                  type="button"
                  onClick={() => setCheckoutOpen(false)}
                  className="rounded-lg p-1 hover:bg-slate-100"
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

              <button
                type="button"
                onClick={handleCheckout}
                disabled={processing}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-3 font-semibold text-white shadow-lg transition disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Confirm Payment'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
