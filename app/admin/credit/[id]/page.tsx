'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import AdminGuard from '@/components/admin-guard';
import AdminLayout from '@/components/admin-layout';
import { usePermissions } from '@/hooks/use-permissions';
import { formatUgx } from '@/lib/currency';
import { getProducts, type Product } from '@/lib/firestore';
import {
  applyWalletToPurchase,
  getCreditCustomer,
  listCreditPurchases,
  listCreditTransactions,
  pickProductsForCustomer,
  recordAccountDeposit,
  recordInstallmentPayment,
  setCreditCustomerStatus,
  updateCreditCustomer,
  type CreditCustomerInput,
} from '@/lib/credit-client';
import {
  CREDIT_PURCHASE_STATUS_LABELS,
  CREDIT_TRANSACTION_TYPE_LABELS,
  type CreditCustomer,
  type CreditPurchase,
  type CreditTransaction,
  type SalePaymentMethod,
} from '@/lib/erp-types';
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  ShoppingBag,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';

const PAYMENT_METHODS: { value: SalePaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
];

function getTsDate(value: unknown): Date {
  if (!value) return new Date();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybe = value as { toDate?: () => Date };
    if (typeof maybe.toDate === 'function') return maybe.toDate();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return new Date(String(value));
}

function toDateInputValue(date: Date): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

type ModalKind = 'pick' | 'payment' | 'deposit' | 'wallet' | 'edit' | null;

interface CartLine {
  productId: string;
  name: string;
  price: number;
  stock: number;
  quantity: number;
}

export default function CreditCustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const customerId = params.id;
  const { can, loading: permissionsLoading } = usePermissions();
  const canManage = can('manageCredit');
  const canView = canManage || can('manageCustomers') || can('viewReports') || can('accessPos');

  const [customer, setCustomer] = useState<CreditCustomer | null>(null);
  const [purchases, setPurchases] = useState<CreditPurchase[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState<ModalKind>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Pick products state
  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [pickDueDate, setPickDueDate] = useState('');
  const [pickNotes, setPickNotes] = useState('');

  // Payment / deposit / wallet
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('cash');
  const [notes, setNotes] = useState('');

  // Edit profile
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    idNumber: '',
    notes: '',
    creditLimit: '',
  });

  const loadData = useCallback(async () => {
    if (!customerId) return;
    try {
      const [c, p, t] = await Promise.all([
        getCreditCustomer(customerId),
        listCreditPurchases({ customerId, limit: 500 }),
        listCreditTransactions({ customerId, limit: 500 }),
      ]);
      setCustomer(c);
      setPurchases(p);
      setTransactions(t);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load account');
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openPurchases = useMemo(
    () => purchases.filter((p) => p.status === 'open'),
    [purchases]
  );

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products
      .filter((p) => (p.stock ?? 0) > 0)
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q)
        );
      })
      .slice(0, 40);
  }, [products, productSearch]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [cart]
  );

  const closeModal = () => {
    if (isSaving) return;
    setModal(null);
    setProductSearch('');
    setCart([]);
    setPickDueDate('');
    setPickNotes('');
    setSelectedPurchaseId('');
    setAmount('');
    setPaymentMethod('cash');
    setNotes('');
  };

  const openPickModal = async () => {
    setModal('pick');
    try {
      const list = await getProducts();
      setProducts(list);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load products');
    }
  };

  const openPaymentModal = () => {
    setSelectedPurchaseId(openPurchases[0]?.id ?? '');
    setAmount('');
    setPaymentMethod('cash');
    setNotes('');
    setModal('payment');
  };

  const openDepositModal = () => {
    setAmount('');
    setPaymentMethod('cash');
    setNotes('');
    setModal('deposit');
  };

  const openWalletModal = () => {
    setSelectedPurchaseId(openPurchases[0]?.id ?? '');
    setAmount('');
    setModal('wallet');
  };

  const openEditModal = () => {
    if (!customer) return;
    setEditForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? '',
      address: customer.address ?? '',
      idNumber: customer.idNumber ?? '',
      notes: customer.notes ?? '',
      creditLimit:
        customer.creditLimit !== undefined && customer.creditLimit !== null
          ? String(customer.creditLimit)
          : '',
    });
    setModal('edit');
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error(`Only ${product.stock} in stock`);
          return prev;
        }
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          stock: product.stock,
          quantity: 1,
        },
      ];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.productId !== productId) return l;
          const next = l.quantity + delta;
          if (next > l.stock) {
            toast.error(`Only ${l.stock} in stock`);
            return l;
          }
          return { ...l, quantity: next };
        })
        .filter((l) => l.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  };

  const cartItemCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  const handlePickSubmit = async () => {
    if (!customerId || cart.length === 0) {
      toast.error('Add at least one product.');
      return;
    }
    setIsSaving(true);
    try {
      await pickProductsForCustomer(
        customerId,
        cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        {
          dueDate: pickDueDate ? new Date(`${pickDueDate}T00:00:00`) : undefined,
          notes: pickNotes.trim() || undefined,
        }
      );
      toast.success('Products picked on credit');
      closeModal();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to record purchase');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!customerId || !selectedPurchaseId) {
      toast.error('Select a purchase to pay against.');
      return;
    }
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    setIsSaving(true);
    try {
      await recordInstallmentPayment(
        customerId,
        selectedPurchaseId,
        value,
        paymentMethod,
        notes.trim() || undefined
      );
      toast.success('Installment recorded');
      closeModal();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to record payment');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDepositSubmit = async () => {
    if (!customerId) return;
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    setIsSaving(true);
    try {
      await recordAccountDeposit(
        customerId,
        value,
        paymentMethod,
        notes.trim() || undefined
      );
      toast.success('Deposit recorded');
      closeModal();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to record deposit');
    } finally {
      setIsSaving(false);
    }
  };

  const handleWalletSubmit = async () => {
    if (!customerId || !selectedPurchaseId) {
      toast.error('Select a purchase.');
      return;
    }
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    setIsSaving(true);
    try {
      await applyWalletToPurchase(customerId, selectedPurchaseId, value);
      toast.success('Wallet balance applied');
      closeModal();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to apply wallet');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSubmit = async () => {
    if (!customerId) return;
    if (!editForm.name.trim() || !editForm.phone.trim()) {
      toast.error('Name and phone are required.');
      return;
    }
    const creditLimitRaw = editForm.creditLimit.trim();
    const creditLimit = creditLimitRaw ? parseFloat(creditLimitRaw) : undefined;
    if (creditLimitRaw && (!Number.isFinite(creditLimit) || (creditLimit ?? 0) < 0)) {
      toast.error('Enter a valid credit limit.');
      return;
    }
    const input: CreditCustomerInput = {
      name: editForm.name.trim(),
      phone: editForm.phone.trim(),
      email: editForm.email.trim() || undefined,
      address: editForm.address.trim() || undefined,
      idNumber: editForm.idNumber.trim() || undefined,
      notes: editForm.notes.trim() || undefined,
      creditLimit,
    };
    setIsSaving(true);
    try {
      await updateCreditCustomer(customerId, input);
      toast.success('Profile updated');
      closeModal();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async () => {
    if (!customer || !customerId) return;
    const next = customer.status === 'active' ? 'inactive' : 'active';
    try {
      await setCreditCustomerStatus(customerId, next);
      toast.success(`Account marked ${next}`);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update status');
    }
  };

  if (!permissionsLoading && !canView) {
    return (
      <AdminGuard>
        <AdminLayout activeSection="credit" title="Credit account">
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-red-500" />
            <p className="font-semibold text-slate-800">Access restricted</p>
          </div>
        </AdminLayout>
      </AdminGuard>
    );
  }

  if (isLoading) {
    return (
      <AdminGuard>
        <AdminLayout activeSection="credit" title="Credit account">
          <div className="flex justify-center py-24">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
          </div>
        </AdminLayout>
      </AdminGuard>
    );
  }

  if (!customer) {
    return (
      <AdminGuard>
        <AdminLayout activeSection="credit" title="Credit account">
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="font-semibold text-slate-800">Customer not found</p>
            <Link href="/admin/credit" className="mt-3 inline-block text-sm font-medium text-blue-600">
              Back to credit list
            </Link>
          </div>
        </AdminLayout>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <AdminLayout
        activeSection="credit"
        title={customer.name}
        subtitle={`${customer.phone}${customer.email ? ` · ${customer.email}` : ''}`}
        actions={
          <Link
            href="/admin/credit"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            All accounts
          </Link>
        }
      >
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Wallet balance</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">
              {formatUgx(customer.walletBalance ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Outstanding</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">
              {formatUgx(customer.outstandingBalance ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Total purchased</p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {formatUgx(customer.totalPurchased ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Total paid</p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {formatUgx(customer.totalPaid ?? 0)}
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-800">Status:</span>{' '}
                <span
                  className={
                    customer.status === 'active' ? 'text-emerald-700' : 'text-slate-500'
                  }
                >
                  {customer.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </p>
              {customer.address && <p>Address: {customer.address}</p>}
              {customer.idNumber && <p>ID: {customer.idNumber}</p>}
              {customer.creditLimit !== undefined && customer.creditLimit !== null && (
                <p>Credit limit: {formatUgx(customer.creditLimit)}</p>
              )}
              {customer.notes && <p className="text-slate-500">{customer.notes}</p>}
            </div>
            {canManage && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void openPickModal()}
                  disabled={customer.status !== 'active'}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  <ShoppingBag size={16} />
                  Pick products
                </button>
                <button
                  type="button"
                  onClick={openPaymentModal}
                  disabled={openPurchases.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Banknote size={16} />
                  Record payment
                </button>
                <button
                  type="button"
                  onClick={openDepositModal}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Wallet size={16} />
                  Deposit
                </button>
                <button
                  type="button"
                  onClick={openWalletModal}
                  disabled={
                    openPurchases.length === 0 || (customer.walletBalance ?? 0) <= 0
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <CreditCard size={16} />
                  Apply wallet
                </button>
                <button
                  type="button"
                  onClick={openEditModal}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Pencil size={16} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void toggleStatus()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Mark {customer.status === 'active' ? 'inactive' : 'active'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="font-semibold text-slate-900">Purchases</h3>
              <p className="text-sm text-slate-500">{purchases.length} credit picks</p>
            </div>
            {purchases.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-500">
                No products picked yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {purchases.map((purchase) => {
                  const paidPct =
                    purchase.totalAmount > 0
                      ? Math.min(
                          100,
                          Math.round((purchase.amountPaid / purchase.totalAmount) * 100)
                        )
                      : 0;
                  return (
                    <div key={purchase.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatUgx(purchase.totalAmount)} · {purchase.items.length} item
                            {purchase.items.length === 1 ? '' : 's'}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {getTsDate(purchase.createdAt).toLocaleDateString('en-UG', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                            {' · '}
                            {CREDIT_PURCHASE_STATUS_LABELS[purchase.status]}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            {purchase.items
                              .slice(0, 3)
                              .map((i) => `${i.productName} ×${i.quantity}`)
                              .join(', ')}
                            {purchase.items.length > 3 ? '…' : ''}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-semibold text-amber-700">
                            {formatUgx(purchase.balanceRemaining)} left
                          </p>
                          <p className="text-xs text-slate-500">
                            Paid {formatUgx(purchase.amountPaid)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${paidPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="font-semibold text-slate-900">Transaction ledger</h3>
              <p className="text-sm text-slate-500">{transactions.length} entries</p>
            </div>
            {transactions.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-500">
                No transactions yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-3 font-semibold">Date</th>
                      <th className="px-3 py-3 font-semibold">Type</th>
                      <th className="px-5 py-3 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                          {getTsDate(tx.createdAt).toLocaleDateString('en-UG', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-slate-900">
                            {CREDIT_TRANSACTION_TYPE_LABELS[tx.type]}
                          </p>
                          {tx.notes && (
                            <p className="text-xs text-slate-500">{tx.notes}</p>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-900">
                          {formatUgx(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {modal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
            onClick={closeModal}
          >
            <div
              className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl ${
                modal === 'pick' ? 'max-w-3xl' : 'max-w-lg'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  {modal === 'pick' && 'Pick products on credit'}
                  {modal === 'payment' && 'Record installment'}
                  {modal === 'deposit' && 'Deposit to account'}
                  {modal === 'wallet' && 'Apply wallet to purchase'}
                  {modal === 'edit' && 'Edit profile'}
                </h2>
                <button type="button" onClick={closeModal} aria-label="Close">
                  <X size={20} />
                </button>
              </div>

              {modal === 'pick' && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="relative">
                        <Search
                          size={16}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          type="search"
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          placeholder="Search by name, SKU or barcode…"
                          className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                      <div className="h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                        {filteredProducts.length === 0 ? (
                          <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-sm text-slate-500">
                            <Package size={20} className="text-slate-300" />
                            <p>No products found</p>
                          </div>
                        ) : (
                          filteredProducts.map((p) => {
                            const inCart = cart.find((l) => l.productId === p.id);
                            const lowStock = p.stock <= 5;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => addToCart(p)}
                                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-slate-50 ${
                                  inCart ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : ''
                                }`}
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <Package size={14} className="shrink-0 text-slate-400" />
                                  <span className="min-w-0">
                                    <span className="block truncate font-medium text-slate-900">
                                      {p.name}
                                    </span>
                                    <span
                                      className={`text-xs ${
                                        lowStock ? 'text-amber-600' : 'text-slate-500'
                                      }`}
                                    >
                                      Stock {p.stock}
                                      {p.sku ? ` · ${p.sku}` : ''}
                                    </span>
                                  </span>
                                </span>
                                <span className="flex shrink-0 items-center gap-2">
                                  <span className="font-semibold text-slate-700">
                                    {formatUgx(p.price)}
                                  </span>
                                  {inCart && (
                                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1 text-xs font-bold text-white">
                                      {inCart.quantity}
                                    </span>
                                  )}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase text-slate-500">
                          Selected items
                        </p>
                        {cart.length > 0 && (
                          <span className="text-xs font-medium text-slate-500">
                            {cart.length} product{cart.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {cart.length === 0 ? (
                        <div className="flex h-64 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 px-4 text-center text-sm text-slate-400">
                          <ShoppingBag size={20} className="text-slate-300" />
                          <p>Add products from the list to build this pick</p>
                        </div>
                      ) : (
                        <div className="h-64 space-y-2 overflow-y-auto rounded-lg border border-blue-100 bg-blue-50/40 p-2">
                          {cart.map((line) => (
                            <div
                              key={line.productId}
                              className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-2 text-sm shadow-sm"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-800">
                                  {line.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {formatUgx(line.price)} each
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(line.productId, -1)}
                                  className="rounded p-1 text-slate-500 hover:bg-slate-100"
                                  aria-label="Decrease quantity"
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="w-6 text-center font-semibold">
                                  {line.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(line.productId, 1)}
                                  className="rounded p-1 text-slate-500 hover:bg-slate-100"
                                  aria-label="Increase quantity"
                                >
                                  <Plus size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeFromCart(line.productId)}
                                  className="ml-1 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                  aria-label="Remove item"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                        Due date
                      </label>
                      <input
                        type="date"
                        value={pickDueDate}
                        onChange={(e) => setPickDueDate(e.target.value)}
                        min={toDateInputValue(new Date())}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                      />
                      <div className="mt-1.5 flex gap-1.5">
                        {[7, 14, 30].map((days) => (
                          <button
                            key={days}
                            type="button"
                            onClick={() =>
                              setPickDueDate(
                                toDateInputValue(new Date(Date.now() + days * 86400000))
                              )
                            }
                            className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition hover:bg-slate-50"
                          >
                            +{days}d
                          </button>
                        ))}
                        {pickDueDate && (
                          <button
                            type="button"
                            onClick={() => setPickDueDate('')}
                            className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition hover:bg-slate-50"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                        Notes
                      </label>
                      <textarea
                        value={pickNotes}
                        onChange={(e) => setPickNotes(e.target.value)}
                        maxLength={1000}
                        rows={2}
                        placeholder="Optional note about this pick…"
                        className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                    <span className="text-sm font-medium text-slate-600">
                      Total ({cartItemCount} item{cartItemCount === 1 ? '' : 's'})
                    </span>
                    <span className="text-lg font-bold text-slate-900">
                      {formatUgx(cartTotal)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handlePickSubmit()}
                    disabled={isSaving || cart.length === 0}
                    className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving…' : 'Confirm pick'}
                  </button>
                </div>
              )}

              {modal === 'payment' && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                      Open purchase
                    </label>
                    <select
                      value={selectedPurchaseId}
                      onChange={(e) => setSelectedPurchaseId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    >
                      {openPurchases.map((p) => (
                        <option key={p.id} value={p.id}>
                          {formatUgx(p.balanceRemaining)} left ·{' '}
                          {getTsDate(p.createdAt).toLocaleDateString('en-UG')} ·{' '}
                          {p.items.length} item(s)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                        Amount (UGX)
                      </label>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        min={1}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                        Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) =>
                          setPaymentMethod(e.target.value as SalePaymentMethod)
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void handlePaymentSubmit()}
                    disabled={isSaving}
                    className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving…' : 'Record payment'}
                  </button>
                </div>
              )}

              {modal === 'deposit' && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">
                    Deposit money to this person&apos;s account without picking products. Funds stay
                    in their wallet until applied to a purchase.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                        Amount (UGX)
                      </label>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        min={1}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                        Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) =>
                          setPaymentMethod(e.target.value as SalePaymentMethod)
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void handleDepositSubmit()}
                    disabled={isSaving}
                    className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving…' : 'Record deposit'}
                  </button>
                </div>
              )}

              {modal === 'wallet' && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">
                    Available wallet: {formatUgx(customer.walletBalance ?? 0)}
                  </p>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                      Open purchase
                    </label>
                    <select
                      value={selectedPurchaseId}
                      onChange={(e) => setSelectedPurchaseId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    >
                      {openPurchases.map((p) => (
                        <option key={p.id} value={p.id}>
                          {formatUgx(p.balanceRemaining)} left ·{' '}
                          {getTsDate(p.createdAt).toLocaleDateString('en-UG')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                      Amount (UGX)
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      min={1}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleWalletSubmit()}
                    disabled={isSaving}
                    className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving…' : 'Apply wallet'}
                  </button>
                </div>
              )}

              {modal === 'edit' && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Full name"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="Phone"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="Email (optional)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="Address (optional)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={editForm.idNumber}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, idNumber: e.target.value }))
                      }
                      placeholder="ID number"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    />
                    <input
                      type="number"
                      value={editForm.creditLimit}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, creditLimit: e.target.value }))
                      }
                      placeholder="Credit limit"
                      min={0}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    />
                  </div>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Notes"
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void handleEditSubmit()}
                    disabled={isSaving}
                    className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}
