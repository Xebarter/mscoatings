import {
  doc,
  writeBatch,
  Timestamp,
  collection,
  getDoc,
  getDocFromCache,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { ensureFirestoreAuthReady } from './admin-auth';
import type { Sale, SaleItem, SalePaymentMethod, Product } from './types';
import { toFirestoreError, getProductById, getProducts } from './firestore';
import { isOnline } from './offline/connectivity';
import { localGet, localSet } from './offline/local-store';

export interface CreateSaleInput {
  items: Array<{ productId: string; quantity: number; discount?: number }>;
  discountTotal?: number;
  paymentMethod: SalePaymentMethod;
  amountTendered?: number;
  paymentReference?: string;
}

function generateReceiptNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RCP-${datePart}-${timePart}-${random}`;
}

async function loadProduct(productId: string): Promise<Product> {
  const ref = doc(db, 'products', productId);
  try {
    const snap = isOnline() ? await getDoc(ref) : await getDocFromCache(ref);
    if (snap.exists()) return { id: snap.id, ...snap.data() } as Product;
  } catch {
    /* fall through */
  }
  const product = await getProductById(productId);
  if (!product) throw new Error(`Product not found: ${productId}`);
  return product;
}

async function patchLocalProductStock(updates: Array<{ productId: string; stock: number }>) {
  const cached = await localGet<{ items: Product[]; savedAt: number }>('products');
  if (!cached?.items) return;
  const next = cached.items.map((p) => {
    const match = updates.find((u) => u.productId === p.id);
    return match ? { ...p, stock: match.stock } : p;
  });
  await localSet('products', { items: next, savedAt: Date.now() });
}

async function prependLocalSale(sale: Sale) {
  const cached = await localGet<{ items: Sale[]; savedAt: number }>('sales');
  const items = [sale, ...(cached?.items ?? [])].slice(0, 200);
  await localSet('sales', { items, savedAt: Date.now() });
}

/**
 * Creates a sale using writeBatch (works offline — queued & synced by Firestore).
 * Transactions cannot run offline, so batch writes are required for POS reliability.
 */
export async function createSale(input: CreateSaleInput): Promise<string> {
  await ensureFirestoreAuthReady();
  const user = auth.currentUser;
  if (!user?.email) throw new Error('You must be signed in to complete a sale.');
  if (!input.items.length) throw new Error('Sale must include at least one item.');

  const receiptNumber = generateReceiptNumber();
  const cashierEmail = user.email.toLowerCase();

  try {
    const products = await Promise.all(
      input.items.map((item) => loadProduct(item.productId))
    );

    const saleItems: SaleItem[] = [];
    let subtotal = 0;
    const stockUpdates: Array<{ productId: string; stock: number; name: string }> = [];

    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i];
      const product = products[i];
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}`);
      }

      const unitPrice = product.price ?? 0;
      const costPrice = product.costPrice ?? 0;
      const discount = item.discount ?? 0;
      const lineTotal = unitPrice * item.quantity - discount;
      subtotal += lineTotal;

      saleItems.push({
        productId: product.id,
        name: product.name,
        barcode: product.barcode ?? '',
        quantity: item.quantity,
        unitPrice,
        costPrice,
        discount,
        lineTotal,
      });

      stockUpdates.push({
        productId: product.id,
        stock: product.stock - item.quantity,
        name: product.name,
      });
    }

    const discountTotal = input.discountTotal ?? 0;
    const totalAmount = subtotal - discountTotal;
    const changeGiven =
      input.paymentMethod === 'cash' && input.amountTendered
        ? Math.max(0, input.amountTendered - totalAmount)
        : undefined;

    const saleRef = doc(collection(db, 'sales'));
    const createdAt = Timestamp.now();
    const salePayload: Omit<Sale, 'id'> = {
      receiptNumber,
      items: saleItems,
      subtotal,
      discountTotal,
      totalAmount,
      paymentMethod: input.paymentMethod,
      amountTendered: input.amountTendered,
      changeGiven,
      paymentReference: input.paymentReference,
      cashierEmail,
      status: 'completed',
      createdAt,
    };

    const batch = writeBatch(db);

    for (let i = 0; i < input.items.length; i++) {
      const productRef = doc(db, 'products', stockUpdates[i].productId);
      batch.update(productRef, { stock: stockUpdates[i].stock });
    }

    batch.set(saleRef, salePayload);

    for (let i = 0; i < input.items.length; i++) {
      const movementRef = doc(collection(db, 'stockMovements'));
      batch.set(movementRef, {
        productId: stockUpdates[i].productId,
        productName: stockUpdates[i].name,
        type: 'sale',
        quantityChange: -input.items[i].quantity,
        resultingStock: stockUpdates[i].stock,
        referenceType: 'sale',
        referenceId: saleRef.id,
        performedBy: cashierEmail,
        createdAt,
      });
    }

    await batch.commit();

    await patchLocalProductStock(
      stockUpdates.map((u) => ({ productId: u.productId, stock: u.stock }))
    );
    await prependLocalSale({ id: saleRef.id, ...salePayload });

    // Keep in-memory product list fresh for subsequent online warm
    if (isOnline()) {
      void getProducts().catch(() => undefined);
    }

    return saleRef.id;
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export const PAYMENT_METHODS: { value: SalePaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'credit', label: 'Credit' },
];
