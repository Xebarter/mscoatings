import {
  doc,
  writeBatch,
  Timestamp,
  collection,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  query,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { ensureFirestoreAuthReady } from './admin-auth';
import type { Sale, SaleItem, SalePaymentMethod, Product, StockMovement } from './types';
import { toFirestoreError, getProductById, getProducts, getSaleById } from './firestore';
import { isOnline } from './offline/connectivity';
import { localGet, localSet } from './offline/local-store';
import { logDesktopActivity } from './staff-activity';

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

async function patchLocalSale(
  saleId: string,
  mutator: (sale: Sale) => Sale | null
): Promise<void> {
  const cached = await localGet<{ items: Sale[]; savedAt: number }>('sales');
  if (!cached?.items) return;
  const next: Sale[] = [];
  for (const sale of cached.items) {
    if (sale.id !== saleId) {
      next.push(sale);
      continue;
    }
    const updated = mutator(sale);
    if (updated) next.push(updated);
  }
  await localSet('sales', { items: next, savedAt: Date.now() });
}

async function prependLocalMovements(movements: StockMovement[]) {
  const cached = await localGet<{ items: StockMovement[]; savedAt: number }>(
    'stockMovements'
  );
  const items = [...movements, ...(cached?.items ?? [])].slice(0, 200);
  await localSet('stockMovements', { items, savedAt: Date.now() });
}

async function removeLocalMovements(movementIds: Set<string>) {
  const cached = await localGet<{ items: StockMovement[]; savedAt: number }>(
    'stockMovements'
  );
  if (!cached?.items) return;
  await localSet('stockMovements', {
    items: cached.items.filter((m) => !movementIds.has(m.id)),
    savedAt: Date.now(),
  });
}

async function loadSale(saleId: string): Promise<Sale> {
  const ref = doc(db, 'sales', saleId);
  try {
    const snap = isOnline() ? await getDoc(ref) : await getDocFromCache(ref);
    if (snap.exists()) return { id: snap.id, ...snap.data() } as Sale;
  } catch {
    /* fall through */
  }
  const sale = await getSaleById(saleId);
  if (!sale) throw new Error('Sale not found');
  return sale;
}

async function findSaleMovementIds(
  saleId: string,
  receiptNumber: string
): Promise<string[]> {
  const ids = new Set<string>();

  const tryQuery = async (referenceId: string) => {
    const q = query(
      collection(db, 'stockMovements'),
      where('referenceId', '==', referenceId)
    );
    try {
      const snap = isOnline() ? await getDocs(q) : await getDocsFromCache(q);
      snap.docs.forEach((d) => ids.add(d.id));
    } catch {
      /* offline empty / missing index — fall through to local mirror */
    }
  };

  await tryQuery(receiptNumber);
  if (receiptNumber !== saleId) {
    await tryQuery(saleId);
  }

  if (ids.size === 0) {
    const cached = await localGet<{ items: StockMovement[] }>('stockMovements');
    for (const m of cached?.items ?? []) {
      if (m.referenceId === receiptNumber || m.referenceId === saleId) {
        ids.add(m.id);
      }
    }
  }

  return [...ids];
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
      cashierId: user.uid,
      cashierEmail,
      status: 'completed',
      createdAt,
      ...(input.amountTendered !== undefined
        ? { amountTendered: input.amountTendered }
        : {}),
      ...(changeGiven !== undefined ? { changeGiven } : {}),
      ...(input.paymentReference
        ? { paymentReference: input.paymentReference }
        : {}),
    };

    const batch = writeBatch(db);

    for (let i = 0; i < input.items.length; i++) {
      const productRef = doc(db, 'products', stockUpdates[i].productId);
      batch.update(productRef, { stock: stockUpdates[i].stock });
    }

    batch.set(saleRef, salePayload);

    const localMovements: StockMovement[] = [];
    for (let i = 0; i < input.items.length; i++) {
      const movementRef = doc(collection(db, 'stockMovements'));
      const movement: Omit<StockMovement, 'id'> = {
        productId: stockUpdates[i].productId,
        productName: stockUpdates[i].name,
        type: 'sale',
        quantityChange: -input.items[i].quantity,
        resultingStock: stockUpdates[i].stock,
        referenceType: 'sale',
        referenceId: saleRef.id,
        performedBy: cashierEmail,
        createdAt,
      };
      batch.set(movementRef, movement);
      localMovements.push({ id: movementRef.id, ...movement });
    }

    await batch.commit();

    await patchLocalProductStock(
      stockUpdates.map((u) => ({ productId: u.productId, stock: u.stock }))
    );
    await prependLocalSale({ id: saleRef.id, ...salePayload });
    await prependLocalMovements(localMovements);

    if (isOnline()) {
      void getProducts().catch(() => undefined);
    }

    logDesktopActivity({
      action: 'sale.create',
      summary: `POS sale ${salePayload.receiptNumber} · ${salePayload.items.length} item(s)`,
      resourceType: 'sale',
      resourceId: saleRef.id,
      metrics: {
        totalAmount: salePayload.totalAmount,
        itemCount: salePayload.items.length,
        paymentMethod: salePayload.paymentMethod,
        receiptNumber: salePayload.receiptNumber,
      },
    });

    return saleRef.id;
  } catch (error) {
    throw toFirestoreError(error);
  }
}

/**
 * Void a completed sale: restore stock, delete sale + related movements (writeBatch / offline-safe).
 */
export async function voidSale(
  saleId: string,
  knownSale?: Pick<Sale, 'receiptNumber'>
): Promise<void> {
  await ensureFirestoreAuthReady();
  const user = auth.currentUser;
  if (!user?.email) throw new Error('You must be signed in.');

  try {
    const sale = await loadSale(saleId);
    if (sale.status !== 'completed') {
      throw new Error(`Sale is already ${sale.status}`);
    }

    const receiptNumber = knownSale?.receiptNumber ?? sale.receiptNumber;
    const movementIds = await findSaleMovementIds(saleId, receiptNumber);

    const stockUpdates: Array<{ productId: string; stock: number }> = [];
    for (const item of sale.items) {
      const product = await loadProduct(item.productId);
      stockUpdates.push({
        productId: product.id,
        stock: (product.stock ?? 0) + item.quantity,
      });
    }

    const batch = writeBatch(db);

    for (const update of stockUpdates) {
      batch.update(doc(db, 'products', update.productId), { stock: update.stock });
    }

    for (const movementId of movementIds) {
      batch.delete(doc(db, 'stockMovements', movementId));
    }

    batch.delete(doc(db, 'sales', saleId));
    await batch.commit();

    await patchLocalProductStock(stockUpdates);
    await patchLocalSale(saleId, () => null);
    await removeLocalMovements(new Set(movementIds));

    logDesktopActivity({
      action: 'sale.void',
      summary: `Voided sale ${receiptNumber}`,
      resourceType: 'sale',
      resourceId: saleId,
      metrics: { receiptNumber },
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}

/**
 * Refund a completed sale: restore stock, set status refunded, add return movements.
 */
export async function refundSale(saleId: string): Promise<void> {
  await ensureFirestoreAuthReady();
  const user = auth.currentUser;
  if (!user?.email) throw new Error('You must be signed in.');

  const performedBy = user.email.toLowerCase();

  try {
    const sale = await loadSale(saleId);
    if (sale.status !== 'completed') {
      throw new Error(`Sale is already ${sale.status}`);
    }

    const createdAt = Timestamp.now();
    const stockUpdates: Array<{ productId: string; stock: number }> = [];
    const localMovements: StockMovement[] = [];
    const batch = writeBatch(db);

    for (const item of sale.items) {
      const product = await loadProduct(item.productId);
      const newStock = (product.stock ?? 0) + item.quantity;
      stockUpdates.push({ productId: product.id, stock: newStock });
      batch.update(doc(db, 'products', product.id), { stock: newStock });

      const movementRef = doc(collection(db, 'stockMovements'));
      const movement: Omit<StockMovement, 'id'> = {
        productId: item.productId,
        productName: product.name,
        type: 'return',
        quantityChange: item.quantity,
        resultingStock: newStock,
        referenceType: 'return',
        referenceId: saleId,
        reason: 'refunded',
        performedBy,
        createdAt,
      };
      batch.set(movementRef, movement);
      localMovements.push({ id: movementRef.id, ...movement });
    }

    batch.update(doc(db, 'sales', saleId), { status: 'refunded' });
    await batch.commit();

    await patchLocalProductStock(stockUpdates);
    await patchLocalSale(saleId, (s) => ({ ...s, status: 'refunded' }));
    await prependLocalMovements(localMovements);

    logDesktopActivity({
      action: 'sale.refund',
      summary: `Refunded sale ${sale.receiptNumber}`,
      resourceType: 'sale',
      resourceId: saleId,
      metrics: {
        receiptNumber: sale.receiptNumber,
        totalAmount: sale.totalAmount,
      },
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export const PAYMENT_METHODS: { value: SalePaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
];
