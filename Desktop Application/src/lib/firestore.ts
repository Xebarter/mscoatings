import {
  collection,
  doc,
  getDocFromCache,
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
import type { Product, Order, Sale, StockMovement, FieldAgent, FieldPick, Staff, Customer } from './types';

export const productsCollection = collection(db, 'products');
export const ordersCollection = collection(db, 'orders');
export const salesCollection = collection(db, 'sales');
export const stockMovementsCollection = collection(db, 'stockMovements');
export const fieldAgentsCollection = collection(db, 'fieldAgents');
export const fieldPicksCollection = collection(db, 'fieldPicks');
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

async function ensureAccess() {
  await ensureFirestoreAuthReady();
}

async function withLocalMirror<T>(
  key: SnapshotKey,
  fetch: () => Promise<T[]>,
  serialize?: (items: T[]) => unknown
): Promise<T[]> {
  // Prefer IndexedDB mirror immediately when offline so POS/checkout never blocks.
  if (!isOnline()) {
    const cached = await localGet<{ items: T[]; savedAt: number }>(key);
    if (cached?.items) {
      return cached.items;
    }
  }

  try {
    const items = await fetch();
    await localSet(key, {
      items: serialize ? serialize(items) : items,
      savedAt: Date.now(),
    });
    return items;
  } catch (error) {
    const cached = await localGet<{ items: T[]; savedAt: number }>(key);
    if (cached?.items) {
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
    const snap = await getDocHybrid(doc(productsCollection, productId));
    if (snap.exists()) return { id: snap.id, ...snap.data() } as Product;
  } catch {
    /* fall through */
  }
  const products = await getProducts();
  return products.find((p) => p.id === productId) ?? null;
}

async function patchLocalProducts(
  mutator: (items: Product[]) => Product[]
): Promise<void> {
  const cached = await localGet<{ items: Product[]; savedAt: number }>('products');
  if (!cached?.items) return;
  await localSet('products', {
    items: serializeProducts(mutator(cached.items)),
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
    const payload = {
      ...productData,
      reorderLevel: productData.reorderLevel ?? 5,
      costPrice: productData.costPrice ?? 0,
      createdAt,
    };
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
    await patchLocalProducts((items) =>
      items.map((p) => (p.id === productId ? { ...p, ...updates } : p))
    );

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
          data: serializeDeep(updates) as Record<string, unknown>,
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
    const ref = doc(ordersCollection, orderId);
    const snap = await getDocHybrid(ref);
    if (snap.exists()) return { id: snap.id, ...snap.data() } as Order;
  } catch {
    /* fall through */
  }
  const orders = await getOrders();
  return orders.find((o) => o.id === orderId) ?? null;
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
  return reviveSales(items).slice(0, limitCount);
}

export async function getStockMovements(limitCount = 50): Promise<StockMovement[]> {
  await ensureAccess();
  const items = await withLocalMirror('stockMovements', async () => {
    const q = query(stockMovementsCollection, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocsHybrid(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as StockMovement);
  }, serializeMovements);
  return reviveMovements(items).slice(0, limitCount);
}

export async function getFieldAgents(): Promise<FieldAgent[]> {
  await ensureAccess();
  const items = await withLocalMirror('fieldAgents', async () => {
    const snapshot = await getDocsHybrid(fieldAgentsCollection);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as FieldAgent);
  }, serializeAgents);
  return reviveAgents(items);
}

export async function getFieldPicks(): Promise<FieldPick[]> {
  await ensureAccess();
  const items = await withLocalMirror('fieldPicks', async () => {
    const snapshot = await getDocsHybrid(fieldPicksCollection);
    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }) as FieldPick)
      .sort((a, b) => {
        const aMs = (a.pickedAt ?? a.createdAt)?.toMillis?.() ?? 0;
        const bMs = (b.pickedAt ?? b.createdAt)?.toMillis?.() ?? 0;
        return bMs - aMs;
      });
  }, serializePicks);
  return revivePicks(items);
}

export async function getCustomers(): Promise<Customer[]> {
  await ensureAccess();
  const items = await withLocalMirror('customers', async () => {
    const snapshot = await getDocsHybrid(customersCollection);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Customer);
  }, serializeCustomers);
  return reviveCustomers(items);
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
    listSales(500),
    getStockMovements(200),
    getFieldAgents(),
    getFieldPicks(),
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
