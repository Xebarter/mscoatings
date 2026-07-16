import {
  collection,
  doc,
  Timestamp,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { auth } from './firebase';
import { ensureFirestoreAuthReady } from './admin-auth';
import { db } from './firebase';
import { isOnline } from './offline/connectivity';
import { getDocHybrid, getDocsHybrid } from './offline/firestore-reads';
import { localGet, localSet, type SnapshotKey } from './offline/local-store';
import { prefetchProductImages } from './offline/product-images';
import type {
  Product,
  Order,
  Sale,
  StockMovement,
  FieldAgent,
  FieldPick,
  FieldAgentTransaction,
  Staff,
  Customer,
  Expense,
  CreditCustomer,
  CreditPurchase,
  CreditTransaction,
} from './types';

export const productsCollection = collection(db, 'products');
export const ordersCollection = collection(db, 'orders');
export const salesCollection = collection(db, 'sales');
export const stockMovementsCollection = collection(db, 'stockMovements');
export const fieldAgentsCollection = collection(db, 'fieldAgents');
export const fieldPicksCollection = collection(db, 'fieldPicks');
export const fieldAgentTransactionsCollection = collection(db, 'fieldAgentTransactions');
export const expensesCollection = collection(db, 'expenses');
export const creditCustomersCollection = collection(db, 'creditCustomers');
export const creditPurchasesCollection = collection(db, 'creditPurchases');
export const creditTransactionsCollection = collection(db, 'creditTransactions');
export const staffCollection = collection(db, 'staff');
export const customersCollection = collection(db, 'customers');

function toFirestoreError(error: unknown): Error {
  if (error instanceof FirebaseError) {
    if (error.code === 'permission-denied') {
      return new Error('Firestore access denied. Sign in as an admin.');
    }
    if (error.code === 'unavailable') {
      return new Error('You are offline and no cached data is available yet. Connect once to sync.');
    }
  }
  return error instanceof Error ? error : new Error('Firestore request failed');
}

/** Firestore rejects `undefined` field values — omit them instead. */
function omitUndefinedFields<T extends Record<string, unknown>>(data: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}

async function ensureAccess() {
  await ensureFirestoreAuthReady();
}

/** Local-first merge: pending offline writes stay visible until Firestore catches up. */
function mergeMirrorItems<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of remote) byId.set(item.id, item);
  for (const item of local) byId.set(item.id, item);
  return Array.from(byId.values());
}

function timestampMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    const maybe = value as { toMillis?: () => number };
    if (typeof maybe.toMillis === 'function') return maybe.toMillis();
  }
  return reviveTimestamp(value).toMillis();
}

async function findInMirror<T extends { id: string }>(
  key: SnapshotKey,
  id: string,
  revive?: (items: T[]) => T[]
): Promise<T | null> {
  const cached = await localGet<{ items: T[]; savedAt: number }>(key);
  const item = cached?.items?.find((entry) => entry.id === id);
  if (!item) return null;
  return revive ? revive([item])[0] ?? item : item;
}

async function withLocalMirror<T extends { id: string }>(
  key: SnapshotKey,
  fetch: () => Promise<T[]>,
  serialize?: (items: T[]) => unknown
): Promise<T[]> {
  const cached = await localGet<{ items: T[]; savedAt: number }>(key);
  const localItems = cached?.items ?? [];

  // Prefer IndexedDB mirror immediately when offline so POS/checkout never blocks.
  if (!isOnline()) {
    if (cached && Array.isArray(cached.items)) {
      return cached.items;
    }
  }

  try {
    const remote = await fetch();
    const merged = mergeMirrorItems(localItems, remote);
    await localSet(key, {
      items: serialize ? serialize(merged) : merged,
      savedAt: Date.now(),
    });
    return merged;
  } catch (error) {
    if (cached && Array.isArray(cached.items)) {
      return cached.items;
    }
    throw toFirestoreError(error);
  }
}

function serializeTimestamp(value: unknown): { seconds: number; nanoseconds: number } | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as { seconds?: number; nanoseconds?: number };
  if (typeof v.seconds === 'number') {
    return { seconds: v.seconds, nanoseconds: v.nanoseconds ?? 0 };
  }
  return null;
}

/** Strip Firestore Timestamp for IndexedDB cloning safety. */
function serializeProducts(items: Product[]) {
  return items.map((p) => ({
    ...p,
    fieldPickPrice: p.fieldPickPrice ?? p.price ?? 0,
    createdAt: serializeTimestamp(p.createdAt),
  }));
}

function serializeOrders(items: Order[]) {
  return items.map((o) => ({
    ...o,
    createdAt: serializeTimestamp(o.createdAt),
  }));
}

function serializeSales(items: Sale[]) {
  return items.map((s) => ({
    ...s,
    createdAt: serializeTimestamp(s.createdAt),
  }));
}

function serializeMovements(items: StockMovement[]) {
  return items.map((m) => ({
    ...m,
    createdAt: serializeTimestamp(m.createdAt),
  }));
}

function serializeAgents(items: FieldAgent[]) {
  return items.map((a) => ({
    ...a,
    createdAt: serializeTimestamp(a.createdAt),
  }));
}

function serializePicks(items: FieldPick[]) {
  return items.map((p) => ({
    ...p,
    createdAt: serializeTimestamp(p.createdAt),
    pickedAt: serializeTimestamp(p.pickedAt),
    closedAt: serializeTimestamp(p.closedAt),
  }));
}

function serializeCustomers(items: Customer[]) {
  return items.map((c) => ({
    ...c,
    createdAt: serializeTimestamp(c.createdAt),
  }));
}

function serializeExpenses(items: Expense[]) {
  return items.map((e) => ({
    ...e,
    date: serializeTimestamp(e.date),
    createdAt: serializeTimestamp(e.createdAt),
  }));
}

function serializeCreditCustomers(items: CreditCustomer[]) {
  return items.map((c) => ({
    ...c,
    createdAt: serializeTimestamp(c.createdAt),
  }));
}

function serializeCreditPurchases(items: CreditPurchase[]) {
  return items.map((p) => ({
    ...p,
    createdAt: serializeTimestamp(p.createdAt),
    dueDate: serializeTimestamp(p.dueDate),
    closedAt: serializeTimestamp(p.closedAt),
  }));
}

function serializeCreditTransactions(items: CreditTransaction[]) {
  return items.map((t) => ({
    ...t,
    createdAt: serializeTimestamp(t.createdAt),
  }));
}

function serializeFieldAgentTransactions(items: FieldAgentTransaction[]) {
  return items.map((t) => ({
    ...t,
    createdAt: serializeTimestamp(t.createdAt),
  }));
}

function serializeStaff(items: Staff[]) {
  return items.map((s) => ({
    ...s,
    createdAt: serializeTimestamp(s.createdAt),
  }));
}

function reviveTimestamp(value: unknown): { toMillis: () => number; seconds: number; nanoseconds: number; toDate: () => Date } {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis: () => number }).toMillis === 'function') {
    return value as { toMillis: () => number; seconds: number; nanoseconds: number; toDate: () => Date };
  }
  const raw = value as { seconds?: number; nanoseconds?: number } | null;
  const seconds = raw?.seconds ?? 0;
  const nanoseconds = raw?.nanoseconds ?? 0;
  return {
    seconds,
    nanoseconds,
    toMillis: () => seconds * 1000 + Math.floor(nanoseconds / 1e6),
    toDate: () => new Date(seconds * 1000),
  };
}

function reviveProducts(items: Product[]): Product[] {
  return items.map((p) => ({
    ...p,
    createdAt: reviveTimestamp(p.createdAt) as Product['createdAt'],
    // Legacy offline mirrors may lack fieldPickPrice — default to retail price.
    fieldPickPrice: p.fieldPickPrice ?? p.price ?? 0,
  }));
}

function reviveOrders(items: Order[]): Order[] {
  return items.map((o) => ({
    ...o,
    createdAt: reviveTimestamp(o.createdAt) as Order['createdAt'],
  }));
}

function reviveSales(items: Sale[]): Sale[] {
  return items.map((s) => ({
    ...s,
    createdAt: reviveTimestamp(s.createdAt) as Sale['createdAt'],
  }));
}

function reviveMovements(items: StockMovement[]): StockMovement[] {
  return items.map((m) => ({
    ...m,
    createdAt: reviveTimestamp(m.createdAt) as StockMovement['createdAt'],
  }));
}

function reviveAgents(items: FieldAgent[]): FieldAgent[] {
  return items.map((a) => ({
    ...a,
    createdAt: reviveTimestamp(a.createdAt) as FieldAgent['createdAt'],
  }));
}

function revivePicks(items: FieldPick[]): FieldPick[] {
  return items.map((p) => ({
    ...p,
    items: p.items ?? [],
    pickedBy: p.pickedBy ?? '',
    createdAt: p.createdAt
      ? (reviveTimestamp(p.createdAt) as FieldPick['createdAt'])
      : undefined,
    pickedAt: reviveTimestamp(p.pickedAt) as FieldPick['pickedAt'],
    closedAt: p.closedAt
      ? (reviveTimestamp(p.closedAt) as FieldPick['closedAt'])
      : undefined,
  }));
}

function reviveCustomers(items: Customer[]): Customer[] {
  return items.map((c) => ({
    ...c,
    createdAt: reviveTimestamp(c.createdAt) as Customer['createdAt'],
  }));
}

function reviveExpenses(items: Expense[]): Expense[] {
  return items.map((e) => ({
    ...e,
    date: reviveTimestamp(e.date) as Expense['date'],
    createdAt: reviveTimestamp(e.createdAt) as Expense['createdAt'],
  }));
}

function reviveCreditCustomers(items: CreditCustomer[]): CreditCustomer[] {
  return items.map((c) => ({
    ...c,
    createdAt: reviveTimestamp(c.createdAt) as CreditCustomer['createdAt'],
  }));
}

function reviveCreditPurchases(items: CreditPurchase[]): CreditPurchase[] {
  return items.map((p) => ({
    ...p,
    createdAt: reviveTimestamp(p.createdAt) as CreditPurchase['createdAt'],
    dueDate: p.dueDate
      ? (reviveTimestamp(p.dueDate) as CreditPurchase['dueDate'])
      : undefined,
    closedAt: p.closedAt
      ? (reviveTimestamp(p.closedAt) as CreditPurchase['closedAt'])
      : undefined,
  }));
}

function reviveCreditTransactions(items: CreditTransaction[]): CreditTransaction[] {
  return items.map((t) => ({
    ...t,
    createdAt: reviveTimestamp(t.createdAt) as CreditTransaction['createdAt'],
  }));
}

function reviveFieldAgentTransactions(
  items: FieldAgentTransaction[]
): FieldAgentTransaction[] {
  return items.map((t) => ({
    ...t,
    createdAt: reviveTimestamp(t.createdAt) as FieldAgentTransaction['createdAt'],
  }));
}

export async function getProducts(): Promise<Product[]> {
  const items = await withLocalMirror('products', async () => {
    const snapshot = await getDocsHybrid(productsCollection);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Product);
  }, serializeProducts);

  const products = reviveProducts(items);
  if (isOnline()) {
    void prefetchProductImages(products);
  }
  return products;
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const trimmed = barcode.trim();
  if (!trimmed) return null;

  const products = await getProducts();
  const fromMirror = products.find((p) => p.barcode === trimmed);
  if (fromMirror) return fromMirror;

  if (!isOnline()) return null;

  try {
    const q = query(productsCollection, where('barcode', '==', trimmed));
    const snapshot = await getDocsHybrid(q);
    if (!snapshot.empty) {
      const d = snapshot.docs[0];
      return { id: d.id, ...d.data() } as Product;
    }
  } catch {
    /* fall through */
  }

  return null;
}

export async function getProductById(productId: string): Promise<Product | null> {
  const fromMirror = await findInMirror('products', productId, reviveProducts);
  if (fromMirror) return fromMirror;

  try {
    const snap = await getDocHybrid(doc(productsCollection, productId));
    if (snap.exists()) return { id: snap.id, ...snap.data() } as Product;
  } catch {
    /* fall through */
  }
  return null;
}

async function patchLocalProducts(
  mutator: (items: Product[]) => Product[]
): Promise<void> {
  const cached = await localGet<{ items: Product[]; savedAt: number }>('products');
  const items = serializeProducts(mutator(cached?.items ?? []));
  await localSet('products', {
    items,
    savedAt: Date.now(),
  });
}

export async function addProduct(
  productData: Omit<Product, 'id' | 'createdAt'>
): Promise<string> {
  try {
    if (isOnline()) {
      try {
        await ensureAccess();
      } catch {
        /* offline session may still work */
      }
    }
    const createdAt = Timestamp.now();
    const payload = omitUndefinedFields({
      ...productData,
      reorderLevel: productData.reorderLevel ?? 5,
      costPrice: productData.costPrice ?? 0,
      fieldPickPrice: productData.fieldPickPrice ?? productData.price,
      createdAt,
    }) as Omit<Product, 'id'>;
    const docRef = doc(productsCollection);
    const product: Product = { id: docRef.id, ...payload };
    await patchLocalProducts((items) => [...items, product]);

    const { syncDocOps } = await import('./offline/flush-queue');
    const { serializeDeep, stampTimestamp } = await import('./offline/pending-writes');
    await syncDocOps({
      id: `product-create-${docRef.id}`,
      kind: 'product.upsert',
      ops: [
        {
          op: 'set',
          collection: 'products',
          docId: docRef.id,
          data: serializeDeep({
            ...payload,
            createdAt: stampTimestamp(createdAt),
          }) as Record<string, unknown>,
        },
      ],
    });

    const { logDesktopActivity } = await import('./staff-activity');
    logDesktopActivity({
      action: 'product.create',
      summary: `Created product ${productData.name}`,
      resourceType: 'product',
      resourceId: docRef.id,
      metrics: {
        price: productData.price,
        stock: productData.stock,
        category: productData.category,
      },
    });
    return docRef.id;
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function updateProduct(
  productId: string,
  updates: Partial<Omit<Product, 'id' | 'createdAt'>>
): Promise<void> {
  try {
    if (isOnline()) {
      try {
        await ensureAccess();
      } catch {
        /* continue */
      }
    }

    const normalizedUpdates: Partial<Omit<Product, 'id' | 'createdAt'>> = {
      ...updates,
    };
    if (updates.fieldPickPrice !== undefined) {
      normalizedUpdates.fieldPickPrice =
        updates.fieldPickPrice || updates.price || 0;
    }

    await patchLocalProducts((items) =>
      items.map((p) => {
        if (p.id !== productId) return p;
        const merged = { ...p, ...normalizedUpdates };
        // Keep offline mirror pick-ready even for legacy products missing the field.
        if (merged.fieldPickPrice == null) {
          merged.fieldPickPrice = merged.price ?? 0;
        }
        return merged;
      })
    );

    const cleanUpdates = omitUndefinedFields(
      normalizedUpdates as Record<string, unknown>
    ) as Partial<Omit<Product, 'id' | 'createdAt'>>;

    const { syncDocOps } = await import('./offline/flush-queue');
    const { serializeDeep } = await import('./offline/pending-writes');
    await syncDocOps({
      id: `product-update-${productId}-${Date.now()}`,
      kind: 'product.upsert',
      ops: [
        {
          op: 'set',
          collection: 'products',
          docId: productId,
          data: serializeDeep(cleanUpdates) as Record<string, unknown>,
          merge: true,
        },
      ],
    });

    const { logDesktopActivity } = await import('./staff-activity');
    logDesktopActivity({
      action: 'product.update',
      summary: `Updated product ${updates.name ?? productId}`,
      resourceType: 'product',
      resourceId: productId,
      metrics: {
        price: updates.price ?? null,
        fieldPickPrice: normalizedUpdates.fieldPickPrice ?? null,
        stock: updates.stock ?? null,
        category: updates.category ?? null,
      },
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function deleteProduct(productId: string): Promise<void> {
  try {
    if (isOnline()) {
      try {
        await ensureAccess();
      } catch {
        /* continue */
      }
    }
    await patchLocalProducts((items) => items.filter((p) => p.id !== productId));

    const { syncDocOps } = await import('./offline/flush-queue');
    await syncDocOps({
      id: `product-delete-${productId}`,
      kind: 'product.delete',
      ops: [{ op: 'delete', collection: 'products', docId: productId }],
    });

    const { logDesktopActivity } = await import('./staff-activity');
    logDesktopActivity({
      action: 'product.delete',
      summary: `Deleted product ${productId}`,
      resourceType: 'product',
      resourceId: productId,
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function getOrders(): Promise<Order[]> {
  await ensureAccess();
  const items = await withLocalMirror('orders', async () => {
    const snapshot = await getDocsHybrid(ordersCollection);
    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Order)
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  }, serializeOrders);
  return reviveOrders(items);
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  try {
    await ensureAccess();
    const orders = await getOrders();
    const fromMirror = orders.find((o) => o.id === orderId);
    if (fromMirror) return fromMirror;

    const ref = doc(ordersCollection, orderId);
    const snap = await getDocHybrid(ref);
    if (snap.exists()) return { id: snap.id, ...snap.data() } as Order;
  } catch {
    /* fall through */
  }
  return null;
}

export async function updateOrderStatus(orderId: string, status: Order['status']) {
  try {
    if (isOnline()) {
      try {
        await ensureAccess();
      } catch {
        /* continue */
      }
    }
    const orders = await localGet<{ items: Order[] }>('orders');
    if (orders?.items) {
      await localSet('orders', {
        items: orders.items.map((o) => (o.id === orderId ? { ...o, status } : o)),
        savedAt: Date.now(),
      });
    }

    const { syncDocOps } = await import('./offline/flush-queue');
    await syncDocOps({
      id: `order-status-${orderId}-${status}`,
      kind: 'order.status',
      ops: [
        {
          op: 'set',
          collection: 'orders',
          docId: orderId,
          data: { status },
          merge: true,
        },
      ],
    });

    const { logDesktopActivity } = await import('./staff-activity');
    logDesktopActivity({
      action: 'order.status_change',
      summary: `Order status → ${status}`,
      resourceType: 'order',
      resourceId: orderId,
      metrics: { status },
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function listSales(limitCount = 100): Promise<Sale[]> {
  await ensureAccess();
  const items = await withLocalMirror('sales', async () => {
    const q = query(salesCollection, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocsHybrid(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Sale);
  }, serializeSales);
  return reviveSales(items)
    .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt))
    .slice(0, limitCount);
}

export async function getStockMovements(limitCount = 50): Promise<StockMovement[]> {
  await ensureAccess();
  const items = await withLocalMirror('stockMovements', async () => {
    const q = query(stockMovementsCollection, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocsHybrid(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as StockMovement);
  }, serializeMovements);
  return reviveMovements(items)
    .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt))
    .slice(0, limitCount);
}

export async function getFieldAgents(): Promise<FieldAgent[]> {
  await ensureAccess();
  const items = await withLocalMirror('fieldAgents', async () => {
    const snapshot = await getDocsHybrid(fieldAgentsCollection);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as FieldAgent);
  }, serializeAgents);
  return reviveAgents(items);
}

function sortFieldPicks(items: FieldPick[]): FieldPick[] {
  return [...items].sort((a, b) => {
    const aMs = (a.pickedAt ?? a.createdAt)?.toMillis?.() ?? 0;
    const bMs = (b.pickedAt ?? b.createdAt)?.toMillis?.() ?? 0;
    return bMs - aMs;
  });
}

export async function getFieldPicks(): Promise<FieldPick[]> {
  await ensureAccess();
  const items = await withLocalMirror('fieldPicks', async () => {
    const snapshot = await getDocsHybrid(fieldPicksCollection);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as FieldPick);
  }, serializePicks);
  return sortFieldPicks(revivePicks(items));
}

export async function getCustomers(): Promise<Customer[]> {
  await ensureAccess();
  const items = await withLocalMirror('customers', async () => {
    const snapshot = await getDocsHybrid(customersCollection);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Customer);
  }, serializeCustomers);
  return reviveCustomers(items);
}

export async function getExpenses(limitCount = 2_000): Promise<Expense[]> {
  await ensureAccess();
  const items = await withLocalMirror('expenses', async () => {
    const q = query(expensesCollection, orderBy('date', 'desc'), limit(limitCount));
    const snapshot = await getDocsHybrid(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense);
  }, serializeExpenses);
  return reviveExpenses(items).slice(0, limitCount);
}

export async function getCreditCustomers(limitCount = 1_000): Promise<CreditCustomer[]> {
  await ensureAccess();
  const items = await withLocalMirror('creditCustomers', async () => {
    const q = query(
      creditCustomersCollection,
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocsHybrid(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CreditCustomer);
  }, serializeCreditCustomers);
  return reviveCreditCustomers(items).slice(0, limitCount);
}

export async function getCreditPurchases(limitCount = 2_000): Promise<CreditPurchase[]> {
  await ensureAccess();
  const items = await withLocalMirror('creditPurchases', async () => {
    const q = query(
      creditPurchasesCollection,
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocsHybrid(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CreditPurchase);
  }, serializeCreditPurchases);
  return reviveCreditPurchases(items).slice(0, limitCount);
}

export async function getCreditTransactions(
  limitCount = 5_000
): Promise<CreditTransaction[]> {
  await ensureAccess();
  const items = await withLocalMirror('creditTransactions', async () => {
    const q = query(
      creditTransactionsCollection,
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocsHybrid(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CreditTransaction);
  }, serializeCreditTransactions);
  return reviveCreditTransactions(items).slice(0, limitCount);
}

export async function getFieldAgentTransactions(
  limitCount = 2_000
): Promise<FieldAgentTransaction[]> {
  await ensureAccess();
  const items = await withLocalMirror('fieldAgentTransactions', async () => {
    const q = query(
      fieldAgentTransactionsCollection,
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocsHybrid(q);
    return snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as FieldAgentTransaction
    );
  }, serializeFieldAgentTransactions);
  return reviveFieldAgentTransactions(items)
    .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt))
    .slice(0, limitCount);
}

export async function getSaleById(saleId: string): Promise<Sale | null> {
  try {
    await ensureAccess();
    const ref = doc(salesCollection, saleId);
    try {
      const snap = await getDocHybrid(ref);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as Sale;
      }
    } catch {
      /* fall through to local mirrors */
    }

    const cached = await localGet<{ items: Sale[]; savedAt: number }>('sales');
    const fromMirror = cached?.items?.find((s) => s.id === saleId);
    if (fromMirror) {
      return reviveSales([fromMirror])[0] ?? fromMirror;
    }

    if (isOnline()) {
      const sales = await listSales(500);
      return sales.find((s) => s.id === saleId) ?? null;
    }

    return null;
  } catch (error) {
    throw toFirestoreError(error);
  }
}

async function cacheStaffMember(staff: Staff): Promise<void> {
  const cached = await localGet<{ items: Staff[]; savedAt: number }>('staff');
  const items = cached?.items ?? [];
  const next = [
    staff,
    ...items.filter(
      (s) => s.id !== staff.id && s.email.toLowerCase() !== staff.email.toLowerCase()
    ),
  ].slice(0, 50);
  await localSet('staff', {
    items: serializeStaff(next),
    savedAt: Date.now(),
  });
}

export async function getStaffByEmail(email: string): Promise<Staff | null> {
  try {
    const normalized = email.trim().toLowerCase();
    const id = staffDocId(normalized);

    try {
      const snap = await getDocHybrid(doc(staffCollection, id));
      if (snap.exists()) {
        const staff = { id: snap.id, ...snap.data() } as Staff;
        await cacheStaffMember(staff);
        return staff;
      }
    } catch {
      /* fall through */
    }

    try {
      const q = query(staffCollection, where('email', '==', normalized));
      const snapshot = await getDocsHybrid(q);
      if (!snapshot.empty) {
        const d = snapshot.docs[0];
        const staff = { id: d.id, ...d.data() } as Staff;
        await cacheStaffMember(staff);
        return staff;
      }
    } catch {
      /* fall through to mirror */
    }

    const cached = await localGet<{ items: Staff[]; savedAt: number }>('staff');
    const fromMirror = cached?.items?.find(
      (s) => s.email.toLowerCase() === normalized || s.id === id
    );
    return fromMirror ?? null;
  } catch (error) {
    const cached = await localGet<{ items: Staff[]; savedAt: number }>('staff');
    const fromMirror = cached?.items?.find(
      (s) => s.email.toLowerCase() === email.trim().toLowerCase()
    );
    if (fromMirror) return fromMirror;
    throw toFirestoreError(error);
  }
}

function staffDocId(email: string): string {
  return email.trim().toLowerCase().replace('@', '_at_').replace(/\./g, '_dot_');
}

/** Warm all critical collections into Firestore cache + IndexedDB mirror while online. */
export async function warmOfflineCache(): Promise<void> {
  if (!isOnline()) return;
  const results = await Promise.allSettled([
    getProducts(),
    getOrders(),
    listSales(2_000),
    getStockMovements(2_000),
    getFieldAgents(),
    getFieldPicks(),
    getFieldAgentTransactions(2_000),
    getExpenses(2_000),
    getCreditCustomers(1_000),
    getCreditPurchases(2_000),
    getCreditTransactions(5_000),
    getCustomers(),
    auth.currentUser?.email
      ? getStaffByEmail(auth.currentUser.email)
      : Promise.resolve(null),
    import('./messages').then((m) => m.listContactMessagesClient('all', 100)),
  ]);
  const productsResult = results[0];
  if (productsResult.status === 'fulfilled') {
    await prefetchProductImages(productsResult.value as Product[]);
  }
  await localSet('meta', { lastSyncedAt: Date.now(), pendingWrites: 0 });
}

export { toFirestoreError };
