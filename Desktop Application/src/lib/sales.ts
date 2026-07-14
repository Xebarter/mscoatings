import {
  doc,
  writeBatch,
  Timestamp,
  collection,
  query,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { ensureFirestoreAuthReady, getOfflineSession } from './admin-auth';
import type { Sale, SaleItem, SalePaymentMethod, Product, StockMovement } from './types';
import { toFirestoreError, getProductById } from './firestore';
import { isOnline } from './offline/connectivity';
import { getDocHybrid, getDocsHybrid, withTimeout } from './offline/firestore-reads';
import { localGet, localSet } from './offline/local-store';
import {
  enqueuePendingWrite,
  removePendingWrite,
  serializeDeep,
  stampTimestamp,
  type PendingSaleCreate,
  type PendingSaleVoid,
} from './offline/pending-writes';
import { syncDocOps } from './offline/flush-queue';
import { logDesktopActivity } from './staff-activity';

export interface CreateSaleInput {
  items: Array<{ productId: string; quantity: number; discount?: number }>;
  discountTotal?: number;
  paymentMethod: SalePaymentMethod;
  amountTendered?: number;
  paymentReference?: string;
}

/** Firestore commit must never hang the POS dialog. */
const COMMIT_TIMEOUT_MS = 2_500;

function generateReceiptNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RCP-${datePart}-${timePart}-${random}`;
}

function plainTimestamp(ts: Timestamp = Timestamp.now()) {
  return { seconds: ts.seconds, nanoseconds: ts.nanoseconds };
}

function revivePlainTimestamp(value: unknown): Timestamp {
  if (value instanceof Timestamp) return value;
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as { toMillis: () => number }).toMillis === 'function'
  ) {
    return value as Timestamp;
  }
  const raw = value as { seconds?: number; nanoseconds?: number } | null;
  return new Timestamp(raw?.seconds ?? 0, raw?.nanoseconds ?? 0);
}

function serializeSaleForStore(sale: Sale): Record<string, unknown> {
  return {
    ...sale,
    createdAt: plainTimestamp(
      sale.createdAt instanceof Timestamp
        ? sale.createdAt
        : revivePlainTimestamp(sale.createdAt)
    ),
  };
}

function serializeMovementForStore(m: StockMovement): Record<string, unknown> {
  return {
    ...m,
    createdAt: plainTimestamp(
      m.createdAt instanceof Timestamp
        ? m.createdAt
        : revivePlainTimestamp(m.createdAt)
    ),
  };
}

async function resolveCashier(): Promise<{ uid: string; email: string }> {
  const user = auth.currentUser;
  if (user?.email) {
    return { uid: user.uid, email: user.email.toLowerCase() };
  }
  const session = await getOfflineSession();
  if (session?.uid && session.email) {
    return { uid: session.uid, email: session.email.toLowerCase() };
  }
  throw new Error('You must be signed in to complete a sale.');
}

/** Instant local catalog lookup — never touches the network. */
async function loadProductFromLocal(productId: string): Promise<Product | null> {
  const mirrored = await localGet<{ items: Product[] }>('products');
  return mirrored?.items?.find((p) => p.id === productId) ?? null;
}

async function loadProduct(productId: string): Promise<Product> {
  const local = await loadProductFromLocal(productId);
  if (local) return local;

  if (!isOnline()) {
    throw new Error(
      'Product not available offline. Connect once to sync the catalog, then try again.'
    );
  }

  try {
    const snap = await getDocHybrid(doc(db, 'products', productId));
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
  const items = [serializeSaleForStore(sale) as unknown as Sale, ...(cached?.items ?? [])].slice(
    0,
    200
  );
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
    if (updated) next.push(serializeSaleForStore(updated) as unknown as Sale);
  }
  await localSet('sales', { items: next, savedAt: Date.now() });
}

async function prependLocalMovements(movements: StockMovement[]) {
  const cached = await localGet<{ items: StockMovement[]; savedAt: number }>(
    'stockMovements'
  );
  const items = [
    ...movements.map((m) => serializeMovementForStore(m) as unknown as StockMovement),
    ...(cached?.items ?? []),
  ].slice(0, 200);
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
  const cached = await localGet<{ items: Sale[] }>('sales');
  const fromMirror = cached?.items?.find((s) => s.id === saleId);
  if (fromMirror) {
    return {
      ...fromMirror,
      createdAt: revivePlainTimestamp(fromMirror.createdAt),
    };
  }

  if (!isOnline()) {
    throw new Error('Sale not found in offline history');
  }

  try {
    const snap = await getDocHybrid(doc(db, 'sales', saleId));
    if (snap.exists()) return { id: snap.id, ...snap.data() } as Sale;
  } catch {
    /* fall through */
  }
  throw new Error('Sale not found');
}

async function findSaleMovementIds(
  saleId: string,
  receiptNumber: string
): Promise<string[]> {
  const ids = new Set<string>();

  const cached = await localGet<{ items: StockMovement[] }>('stockMovements');
  for (const m of cached?.items ?? []) {
    if (m.referenceId === receiptNumber || m.referenceId === saleId) {
      ids.add(m.id);
    }
  }

  if (ids.size > 0 || !isOnline()) {
    return [...ids];
  }

  const tryQuery = async (referenceId: string) => {
    const q = query(
      collection(db, 'stockMovements'),
      where('referenceId', '==', referenceId)
    );
    try {
      const snap = await getDocsHybrid(q);
      snap.docs.forEach((d) => ids.add(d.id));
    } catch {
      /* ignore */
    }
  };

  await tryQuery(receiptNumber);
  if (receiptNumber !== saleId) await tryQuery(saleId);
  return [...ids];
}

function buildSalePayload(
  input: CreateSaleInput,
  products: Product[],
  cashier: { uid: string; email: string },
  receiptNumber: string,
  createdAt: Timestamp
): {
  salePayload: Omit<Sale, 'id'>;
  stockUpdates: Array<{ productId: string; stock: number; name: string }>;
} {
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

  const salePayload: Omit<Sale, 'id'> = {
    receiptNumber,
    items: saleItems,
    subtotal,
    discountTotal,
    totalAmount,
    paymentMethod: input.paymentMethod,
    cashierId: cashier.uid,
    cashierEmail: cashier.email,
    status: 'completed',
    createdAt,
    ...(input.amountTendered !== undefined ? { amountTendered: input.amountTendered } : {}),
    ...(changeGiven !== undefined ? { changeGiven } : {}),
    ...(input.paymentReference ? { paymentReference: input.paymentReference } : {}),
  };

  return { salePayload, stockUpdates };
}

async function commitSaleToFirestore(args: {
  saleId: string;
  salePayload: Omit<Sale, 'id'>;
  stockUpdates: Array<{ productId: string; stock: number; name: string }>;
  movements: StockMovement[];
  inputQuantities: number[];
}): Promise<void> {
  const batch = writeBatch(db);

  for (const update of args.stockUpdates) {
    // merge set is safer offline than update (update needs the doc in local cache)
    batch.set(
      doc(db, 'products', update.productId),
      { stock: update.stock },
      { merge: true }
    );
  }

  batch.set(doc(db, 'sales', args.saleId), args.salePayload);

  for (const movement of args.movements) {
    const { id, ...rest } = movement;
    batch.set(doc(db, 'stockMovements', id), rest);
  }

  await withTimeout(
    batch.commit(),
    COMMIT_TIMEOUT_MS,
    'Firestore commit timed out'
  );
}

/**
 * Local-first sale: IndexedDB is the source of truth for the UI.
 * Firestore sync happens in the background / on reconnect.
 */
export async function createSale(input: CreateSaleInput): Promise<Sale> {
  if (!input.items.length) throw new Error('Sale must include at least one item.');

  // Never block offline POS on token refresh.
  if (isOnline()) {
    try {
      await withTimeout(ensureFirestoreAuthReady(), 2_000);
    } catch {
      /* session / cached auth may still be enough */
    }
  }

  const cashier = await resolveCashier();
  const receiptNumber = generateReceiptNumber();
  const createdAt = Timestamp.now();

  const products = await Promise.all(
    input.items.map((item) => loadProduct(item.productId))
  );

  const { salePayload, stockUpdates } = buildSalePayload(
    input,
    products,
    cashier,
    receiptNumber,
    createdAt
  );

  // Generate stable IDs without a network round-trip
  const saleRef = doc(collection(db, 'sales'));
  const movements: StockMovement[] = input.items.map((item, i) => {
    const movementRef = doc(collection(db, 'stockMovements'));
    return {
      id: movementRef.id,
      productId: stockUpdates[i].productId,
      productName: stockUpdates[i].name,
      type: 'sale' as const,
      quantityChange: -item.quantity,
      resultingStock: stockUpdates[i].stock,
      referenceType: 'sale' as const,
      referenceId: saleRef.id,
      performedBy: cashier.email,
      createdAt,
    };
  });

  const sale: Sale = { id: saleRef.id, ...salePayload };

  // 1) Local mirrors first — completes in milliseconds
  await patchLocalProductStock(
    stockUpdates.map((u) => ({ productId: u.productId, stock: u.stock }))
  );
  await prependLocalSale(sale);
  await prependLocalMovements(movements);

  const pending: PendingSaleCreate = {
    id: `sale-create-${sale.id}`,
    kind: 'sale.create',
    createdAt: Date.now(),
    sale: serializeSaleForStore(sale),
    stockUpdates: stockUpdates.map((u) => ({
      productId: u.productId,
      stock: u.stock,
    })),
    movements: movements.map(serializeMovementForStore),
  };

  const tryFirestoreSync = async () => {
    await commitSaleToFirestore({
      saleId: sale.id,
      salePayload,
      stockUpdates,
      movements,
      inputQuantities: input.items.map((i) => i.quantity),
    });
    await removePendingWrite(pending.id);
  };

  if (!isOnline()) {
    await enqueuePendingWrite(pending);
    // Best-effort local Firestore queue (when disableNetwork is active this resolves fast)
    void tryFirestoreSync().catch(() => undefined);
  } else {
    try {
      await tryFirestoreSync();
    } catch {
      // Lie-fi or slow link — sale already saved locally; sync later
      await enqueuePendingWrite(pending);
    }
  }

  logDesktopActivity({
    action: 'sale.create',
    summary: `POS sale ${sale.receiptNumber} · ${sale.items.length} item(s)`,
    resourceType: 'sale',
    resourceId: sale.id,
    metrics: {
      totalAmount: sale.totalAmount,
      itemCount: sale.items.length,
      paymentMethod: sale.paymentMethod,
      receiptNumber: sale.receiptNumber,
      offline: !isOnline(),
    },
  });

  return sale;
}

/** Flush a single POS pending entry (used by the shared offline queue). */
export async function flushOnePendingSale(entry: PendingSaleCreate | PendingSaleVoid): Promise<void> {
  if (entry.kind === 'sale.create') {
    const sale = entry.sale as unknown as Sale;
    const createdAt = revivePlainTimestamp(sale.createdAt);
    const { id, createdAt: _c, ...rest } = {
      ...sale,
      createdAt,
    };
    const movements = (entry.movements as unknown as StockMovement[]).map((m) => ({
      ...m,
      createdAt: revivePlainTimestamp(m.createdAt),
    }));
    await commitSaleToFirestore({
      saleId: id,
      salePayload: rest as Omit<Sale, 'id'>,
      stockUpdates: entry.stockUpdates.map((u) => ({
        ...u,
        name: '',
      })),
      movements,
      inputQuantities: [],
    });
    await removePendingWrite(entry.id);
    return;
  }

  const batch = writeBatch(db);
  for (const update of entry.stockUpdates) {
    batch.set(doc(db, 'products', update.productId), { stock: update.stock }, { merge: true });
  }
  for (const movementId of entry.movementIds) {
    batch.delete(doc(db, 'stockMovements', movementId));
  }
  batch.delete(doc(db, 'sales', entry.saleId));
  await withTimeout(batch.commit(), COMMIT_TIMEOUT_MS);
  await removePendingWrite(entry.id);
}

/**
 * Void a completed sale: restore stock locally, sync Firestore when possible.
 */
export async function voidSale(
  saleId: string,
  knownSale?: Pick<Sale, 'receiptNumber'>
): Promise<void> {
  if (isOnline()) {
    try {
      await withTimeout(ensureFirestoreAuthReady(), 2_000);
    } catch {
      /* continue with session */
    }
  }

  const cashier = await resolveCashier().catch(() => null);
  if (!cashier && !auth.currentUser) {
    throw new Error('You must be signed in.');
  }

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

    // Local first
    await patchLocalProductStock(stockUpdates);
    await patchLocalSale(saleId, () => null);
    await removeLocalMovements(new Set(movementIds));

    const pending: PendingSaleVoid = {
      id: `sale-void-${saleId}-${Date.now()}`,
      kind: 'sale.void',
      createdAt: Date.now(),
      saleId,
      stockUpdates,
      movementIds,
    };

    const tryFirestore = async () => {
      const batch = writeBatch(db);
      for (const update of stockUpdates) {
        batch.set(doc(db, 'products', update.productId), { stock: update.stock }, { merge: true });
      }
      for (const movementId of movementIds) {
        batch.delete(doc(db, 'stockMovements', movementId));
      }
      batch.delete(doc(db, 'sales', saleId));
      await withTimeout(batch.commit(), COMMIT_TIMEOUT_MS);
      await removePendingWrite(pending.id);
    };

    if (!isOnline()) {
      await enqueuePendingWrite(pending);
      void tryFirestore().catch(() => undefined);
    } else {
      try {
        await tryFirestore();
      } catch {
        await enqueuePendingWrite(pending);
      }
    }

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
 * Refund a completed sale: restore stock locally, queue Firestore sync.
 */
export async function refundSale(saleId: string): Promise<void> {
  if (isOnline()) {
    try {
      await withTimeout(ensureFirestoreAuthReady(), 2_000);
    } catch {
      /* session may still work */
    }
  }

  const cashier = await resolveCashier();
  const performedBy = cashier.email;

  try {
    const sale = await loadSale(saleId);
    if (sale.status !== 'completed') {
      throw new Error(`Sale is already ${sale.status}`);
    }

    const createdAt = Timestamp.now();
    const stockUpdates: Array<{ productId: string; stock: number }> = [];
    const localMovements: StockMovement[] = [];
    const ops: Array<{
      op: 'set';
      collection: string;
      docId: string;
      data: Record<string, unknown>;
      merge?: boolean;
    }> = [];

    for (const item of sale.items) {
      const product = await loadProduct(item.productId);
      const newStock = (product.stock ?? 0) + item.quantity;
      stockUpdates.push({ productId: product.id, stock: newStock });
      ops.push({
        op: 'set',
        collection: 'products',
        docId: product.id,
        data: { stock: newStock },
        merge: true,
      });

      const movementRef = doc(collection(db, 'stockMovements'));
      const movement: StockMovement = {
        id: movementRef.id,
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
      const { id, ...movementData } = movement;
      ops.push({
        op: 'set',
        collection: 'stockMovements',
        docId: id,
        data: serializeDeep({
          ...movementData,
          createdAt: stampTimestamp(createdAt),
        }) as Record<string, unknown>,
      });
      localMovements.push(movement);
    }

    ops.push({
      op: 'set',
      collection: 'sales',
      docId: saleId,
      data: { status: 'refunded' },
      merge: true,
    });

    await patchLocalProductStock(stockUpdates);
    await patchLocalSale(saleId, (s) => ({ ...s, status: 'refunded' }));
    await prependLocalMovements(localMovements);

    await syncDocOps({
      id: `sale-refund-${saleId}`,
      kind: 'sale.refund',
      ops,
    });

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
