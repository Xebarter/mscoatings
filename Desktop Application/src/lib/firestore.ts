import {
  collection,
  doc,
  getDocs,
  getDocsFromCache,
  getDoc,
  getDocFromCache,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  type Query,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { ensureFirestoreAuthReady } from './admin-auth';
import { db } from './firebase';
import { isOnline } from './offline/connectivity';
import { localGet, localSet, type SnapshotKey } from './offline/local-store';
import type { Product, Order, Sale, StockMovement, FieldAgent, FieldPick } from './types';

export const productsCollection = collection(db, 'products');
export const ordersCollection = collection(db, 'orders');
export const salesCollection = collection(db, 'sales');
export const stockMovementsCollection = collection(db, 'stockMovements');
export const fieldAgentsCollection = collection(db, 'fieldAgents');
export const fieldPicksCollection = collection(db, 'fieldPicks');

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

async function ensureAccess() {
  await ensureFirestoreAuthReady();
}

async function getDocsHybrid(q: Query<DocumentData>): Promise<QuerySnapshot<DocumentData>> {
  if (!isOnline()) {
    try {
      return await getDocsFromCache(q);
    } catch {
      // Cache empty — try network path which may fail; caller uses local mirror
      return await getDocs(q);
    }
  }

  try {
    return await getDocs(q);
  } catch (error) {
    try {
      return await getDocsFromCache(q);
    } catch {
      throw error;
    }
  }
}

async function withLocalMirror<T>(
  key: SnapshotKey,
  fetch: () => Promise<T[]>,
  serialize?: (items: T[]) => unknown
): Promise<T[]> {
  try {
    const items = await fetch();
    await localSet(key, {
      items: serialize ? serialize(items) : items,
      savedAt: Date.now(),
    });
    return items;
  } catch (error) {
    const cached = await localGet<{ items: T[]; savedAt: number }>(key);
    if (cached?.items?.length) {
      return cached.items;
    }
    throw toFirestoreError(error);
  }
}

/** Strip Firestore Timestamp to plain millis for IndexedDB cloning safety. */
function serializeProducts(items: Product[]) {
  return items.map((p) => ({
    ...p,
    createdAt: p.createdAt ? { seconds: p.createdAt.seconds, nanoseconds: p.createdAt.nanoseconds } : null,
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
    createdAt: reviveTimestamp(p.createdAt) as FieldPick['createdAt'],
  }));
}

export async function getProducts(): Promise<Product[]> {
  const items = await withLocalMirror('products', async () => {
    const snapshot = await getDocsHybrid(productsCollection);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Product);
  }, serializeProducts);

  return reviveProducts(items);
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  const trimmed = barcode.trim();
  try {
    const q = query(productsCollection, where('barcode', '==', trimmed));
    const snapshot = await getDocsHybrid(q);
    if (!snapshot.empty) {
      const d = snapshot.docs[0];
      return { id: d.id, ...d.data() } as Product;
    }
  } catch {
    /* fall through to local + id lookup */
  }

  try {
    const snap = await getDocFromCache(doc(productsCollection, trimmed)).catch(() => null);
    if (snap?.exists()) return { id: snap.id, ...snap.data() } as Product;
  } catch {
    /* ignore */
  }

  const products = await getProducts();
  return products.find((p) => p.barcode === trimmed) ?? null;
}

export async function getProductById(productId: string): Promise<Product | null> {
  try {
    const snap = isOnline()
      ? await getDoc(doc(productsCollection, productId))
      : await getDocFromCache(doc(productsCollection, productId));
    if (snap.exists()) return { id: snap.id, ...snap.data() } as Product;
  } catch {
    /* fall through */
  }
  const products = await getProducts();
  return products.find((p) => p.id === productId) ?? null;
}

export async function getOrders(): Promise<Order[]> {
  await ensureAccess();
  const items = await withLocalMirror('orders', async () => {
    const snapshot = await getDocsHybrid(ordersCollection);
    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Order)
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  });
  return reviveOrders(items);
}

export async function updateOrderStatus(orderId: string, status: Order['status']) {
  try {
    await ensureAccess();
    await updateDoc(doc(ordersCollection, orderId), { status });
    const orders = await localGet<{ items: Order[] }>('orders');
    if (orders?.items) {
      await localSet('orders', {
        items: orders.items.map((o) => (o.id === orderId ? { ...o, status } : o)),
        savedAt: Date.now(),
      });
    }
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
  });
  return reviveSales(items).slice(0, limitCount);
}

export async function getStockMovements(limitCount = 50): Promise<StockMovement[]> {
  await ensureAccess();
  const items = await withLocalMirror('stockMovements', async () => {
    const q = query(stockMovementsCollection, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocsHybrid(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as StockMovement);
  });
  return reviveMovements(items).slice(0, limitCount);
}

export async function getFieldAgents(): Promise<FieldAgent[]> {
  await ensureAccess();
  const items = await withLocalMirror('fieldAgents', async () => {
    const snapshot = await getDocsHybrid(fieldAgentsCollection);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as FieldAgent);
  });
  return reviveAgents(items);
}

export async function getFieldPicks(): Promise<FieldPick[]> {
  await ensureAccess();
  const items = await withLocalMirror('fieldPicks', async () => {
    const snapshot = await getDocsHybrid(fieldPicksCollection);
    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }) as FieldPick)
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  });
  return revivePicks(items);
}

export async function getSaleById(saleId: string): Promise<Sale | null> {
  try {
    await ensureAccess();
    const ref = doc(salesCollection, saleId);
    const snap = isOnline() ? await getDoc(ref) : await getDocFromCache(ref);
    if (!snap.exists()) {
      const sales = await listSales(500);
      return sales.find((s) => s.id === saleId) ?? null;
    }
    return { id: snap.id, ...snap.data() } as Sale;
  } catch (error) {
    throw toFirestoreError(error);
  }
}

/** Warm all critical collections into Firestore cache + IndexedDB mirror while online. */
export async function warmOfflineCache(): Promise<void> {
  if (!isOnline()) return;
  await Promise.allSettled([
    getProducts(),
    getOrders(),
    listSales(200),
    getStockMovements(100),
    getFieldAgents(),
    getFieldPicks(),
  ]);
  await localSet('meta', { lastSyncedAt: Date.now(), pendingWrites: 0 });
}

export { toFirestoreError };
