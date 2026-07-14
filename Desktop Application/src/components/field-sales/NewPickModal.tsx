import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Search,
  Truck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  createFieldAgentClient,
  createFieldPickClient,
  listFieldAgentsClient,
} from '@/lib/field-sales';
import { getProductByBarcode, getProducts } from '@/lib/firestore';
import type { FieldAgent, Product } from '@/lib/types';
import { formatUgx } from '@/lib/currency';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useOnline } from '@/hooks/useOnline';
import CameraScannerModal from '@/components/CameraScannerModal';

interface CartItem {
  product: Product;
  quantity: number;
}

interface NewPickModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (pickId: string) => void;
}

export default function NewPickModal({
  open,
  onClose,
  onSuccess,
}: NewPickModalProps) {
  const online = useOnline();
  const [step, setStep] = useState<1 | 2>(1);
  const [agents, setAgents] = useState<FieldAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [showNewAgent, setShowNewAgent] = useState(false);
  const [agentForm, setAgentForm] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingAgent, setIsSavingAgent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    void loadData();
    setStep(1);
    setSelectedAgentId('');
    setCart([]);
    setSearch('');
    setShowNewAgent(false);
    setAgentForm({ name: '', phone: '', email: '', notes: '' });
  }, [open]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [agentsData, productsData] = await Promise.all([
        listFieldAgentsClient(),
        getProducts(),
      ]);
      setAgents(agentsData.filter((a) => a.active));
      setProducts(productsData.filter((p) => p.stock > 0));
    } catch {
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

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
    enabled: open && step === 2 && !cameraOpen,
  });

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 24);
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, search]);

  const cartTotal = cart.reduce(
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

  const handleCreateAgent = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingAgent(true);
    try {
      const id = await createFieldAgentClient(agentForm);
      toast.success(
        online
          ? 'Field agent registered'
          : 'Agent saved offline — will sync when online'
      );
      await loadData();
      setSelectedAgentId(id);
      setShowNewAgent(false);
      setAgentForm({ name: '', phone: '', email: '', notes: '' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create agent');
    } finally {
      setIsSavingAgent(false);
    }
  };

  const handleSubmitPick = async () => {
    if (!selectedAgent || cart.length === 0) return;

    setIsSubmitting(true);
    try {
      const pickId = await createFieldPickClient({
        agentId: selectedAgent.id,
        agentName: selectedAgent.name,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      });
      toast.success(
        online
          ? `Pick created for ${selectedAgent.name}`
          : `Pick saved offline for ${selectedAgent.name} — will sync when online`
      );
      onSuccess(pickId);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create pick');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/70 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50">
              <Truck size={20} className="text-violet-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">New field pick</h3>
              <p className="text-sm text-slate-500">
                Step {step} of 2 — {step === 1 ? 'Select agent' : 'Add products'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-violet-600" />
            </div>
          ) : step === 1 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">
                  Select a field agent
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewAgent(!showNewAgent)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700"
                >
                  <UserPlus size={16} />
                  Register agent
                </button>
              </div>

              {showNewAgent && (
                <form
                  onSubmit={handleCreateAgent}
                  className="rounded-xl border border-violet-200 bg-violet-50/50 p-4"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Full name *"
                      value={agentForm.name}
                      onChange={(e) =>
                        setAgentForm({ ...agentForm, name: e.target.value })
                      }
                      required
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="tel"
                      placeholder="Phone *"
                      value={agentForm.phone}
                      onChange={(e) =>
                        setAgentForm({ ...agentForm, phone: e.target.value })
                      }
                      required
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={agentForm.email}
                      onChange={(e) =>
                        setAgentForm({ ...agentForm, email: e.target.value })
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Notes"
                      value={agentForm.notes}
                      onChange={(e) =>
                        setAgentForm({ ...agentForm, notes: e.target.value })
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSavingAgent}
                    className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {isSavingAgent ? 'Saving…' : 'Save agent'}
                  </button>
                </form>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                {agents.length === 0 ? (
                  <p className="col-span-full py-8 text-center text-sm text-slate-500">
                    No field agents yet. Register one to continue.
                  </p>
                ) : (
                  agents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setSelectedAgentId(agent.id)}
                      className={`rounded-xl border p-4 text-left transition ${
                        selectedAgentId === agent.id
                          ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <p className="font-semibold text-slate-900">{agent.name}</p>
                      <p className="mt-0.5 text-sm text-slate-500">{agent.phone}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        {agent.totalPicks} picks · {formatUgx(agent.totalRevenue)}{' '}
                        revenue
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search or scan barcode…"
                      className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCameraOpen(true)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-slate-600 hover:bg-slate-50"
                    aria-label="Scan barcode"
                  >
                    <Camera size={18} />
                  </button>
                </div>

                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addToCart(product)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-left hover:bg-slate-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {product.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {product.stock} in stock · {formatUgx(product.price)}
                        </p>
                      </div>
                      <Plus size={16} className="text-violet-600" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-900">
                  Pick list for {selectedAgent?.name}
                </p>
                {cart.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">
                    Add products to the pick
                  </p>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex items-center justify-between rounded-lg bg-white px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {item.product.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatUgx(item.product.price)} each
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="rounded p-1 hover:bg-slate-100"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center text-sm font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="rounded p-1 hover:bg-slate-100"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-slate-200 pt-3 text-sm font-bold text-slate-900">
                      Total value: {formatUgx(cartTotal)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <ChevronLeft size={16} />
              Back
            </button>
          ) : (
            <div />
          )}

          {step === 1 ? (
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!selectedAgentId}
              className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              Continue
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSubmitPick()}
              disabled={isSubmitting || cart.length === 0}
              className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating pick…' : 'Create pick'}
            </button>
          )}
        </div>
      </div>
    </div>

    <CameraScannerModal
      open={cameraOpen}
      onClose={() => setCameraOpen(false)}
      onScan={(code) => void handleBarcodeScan(code)}
    />
    </>
  );
}
