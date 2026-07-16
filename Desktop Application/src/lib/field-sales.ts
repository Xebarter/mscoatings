import {
  collection,
  doc,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { ensureFirestoreAuthReady, getOfflineSession } from './admin-auth';
import type {
  FieldAgent,
  FieldAgentTransaction,
  FieldPick,
  FieldPickItem,
  FieldPickReport,
  FieldPickReportItem,
  Product,
  Sale,
  SaleItem,
  SalePaymentMethod,
  StockMovement,
} from './types';
import {
  getFieldAgents,
  getFieldPicks,
  getProductById,
  toFirestoreError,
} from './firestore';
import { isOnline } from './offline/connectivity';
import { getDocHybrid, getDocsHybrid, withTimeout } from './offline/firestore-reads';
import { localGet, localSet } from './offline/local-store';
import {
  LOCAL_FIELD_PICKS_RETENTION,
  LOCAL_MOVEMENTS_RETENTION,
  LOCAL_SALES_RETENTION,
} from './offline/limits';
import { syncDocOps } from './offline/flush-queue';
import {
  serializeDeep,
  stampTimestamp,
  type PendingDocOp,
} from './offline/pending-writes';
import { logDesktopActivity } from './staff-activity';

function generateReceiptNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RCP-${datePart}-${timePart}-${random}`;
}

async function requireUserEmail(): Promise<string> {
  if (auth.currentUser?.email) {
    return auth.currentUser.email.toLowerCase();
  }
  if (isOnline()) {
    try {
      await withTimeout(ensureFirestoreAuthReady(), 2_000);
    } catch {
      /* fall through to session */
    }
  }
  if (auth.currentUser?.email) {
    return auth.currentUser.email.toLowerCase();
  }
  const session = await getOfflineSession();
  if (session?.email) return session.email.toLowerCase();
  throw new Error('You must be signed in.');
}

async function requireCashierUid(): Promise<string> {
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  const session = await getOfflineSession();
  if (session?.uid) return session.uid;
  throw new Error('You must be signed in.');
}

async function loadProduct(productId: string): Promise<Product> {
  const mirrored = await localGet<{ items: Product[] }>('products');
  const fromMirror = mirrored?.items?.find((p) => p.id === productId);
  if (fromMirror) return fromMirror;

  if (!isOnline()) {
    throw new Error(`Product not available offline: ${productId}`);
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

async function loadPick(pickId: string): Promise<FieldPick> {
  const ref = doc(db, 'fieldPicks', pickId);
  try {
    const snap = await getDocHybrid(ref);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as FieldPick;
    }
  } catch {
    /* fall through */
  }
  const cached = await localGet<{ items: FieldPick[]; savedAt: number }>('fieldPicks');
  const local = cached?.items?.find((p) => p.id === pickId);
  if (local) return local;
  throw new Error('Pick not found');
}

async function loadAgent(agentId: string): Promise<FieldAgent | null> {
  const ref = doc(db, 'fieldAgents', agentId);
  try {
    const snap = await getDocHybrid(ref);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as FieldAgent;
    }
  } catch {
    /* fall through */
  }
  const cached = await localGet<{ items: FieldAgent[]; savedAt: number }>('fieldAgents');
  return cached?.items?.find((a) => a.id === agentId) ?? null;
}

async function patchLocalProductStock(
  updates: Array<{ productId: string; stock: number }>
) {
  const cached = await localGet<{ items: Product[]; savedAt: number }>('products');
  if (!cached?.items) return;
  const next = cached.items.map((p) => {
    const match = updates.find((u) => u.productId === p.id);
    return match ? { ...p, stock: match.stock } : p;
  });
  await localSet('products', { items: next, savedAt: Date.now() });
}

async function patchLocalFieldPicks(mutator: (items: FieldPick[]) => FieldPick[]) {
  const cached = await localGet<{ items: FieldPick[]; savedAt: number }>('fieldPicks');
  const items = mutator(cached?.items ?? []).slice(0, LOCAL_FIELD_PICKS_RETENTION);
  await localSet('fieldPicks', { items, savedAt: Date.now() });
}

async function patchLocalFieldAgents(mutator: (items: FieldAgent[]) => FieldAgent[]) {
  const cached = await localGet<{ items: FieldAgent[]; savedAt: number }>('fieldAgents');
  const items = mutator(cached?.items ?? []);
  await localSet('fieldAgents', { items, savedAt: Date.now() });
}

async function prependLocalSale(sale: Sale) {
  const cached = await localGet<{ items: Sale[]; savedAt: number }>('sales');
  const items = [sale, ...(cached?.items ?? [])].slice(0, LOCAL_SALES_RETENTION);
  await localSet('sales', { items, savedAt: Date.now() });
}

async function prependLocalMovements(movements: StockMovement[]) {
  if (!movements.length) return;
  const cached = await localGet<{ items: StockMovement[]; savedAt: number }>(
    'stockMovements'
  );
  await localSet('stockMovements', {
    items: [...movements, ...(cached?.items ?? [])].slice(
      0,
      LOCAL_MOVEMENTS_RETENTION
    ),
    savedAt: Date.now(),
  });
}

/** Reads use Firestore cache + IndexedDB mirrors so the page works offline. */
export async function listFieldAgentsClient(): Promise<FieldAgent[]> {
  await ensureFirestoreAuthReady();
  try {
    return await getFieldAgents();
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function getFieldAgentByIdClient(
  agentId: string
): Promise<FieldAgent | null> {
  await ensureFirestoreAuthReady();
  try {
    return await loadAgent(agentId);
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function createFieldAgentClient(input: {
  name: string;
  phone: string;
  email?: string;
  notes?: string;
}): Promise<string> {
  const createdBy = await requireUserEmail();
  try {
    const createdAt = Timestamp.now();
    const payload = {
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      notes: input.notes?.trim() || null,
      active: true,
      totalPicks: 0,
      totalRevenue: 0,
      totalUnitsMissing: 0,
      walletBalance: 0,
      createdAt,
      createdBy,
    };

    const docRef = doc(collection(db, 'fieldAgents'));

    await patchLocalFieldAgents((items) => [
      {
        id: docRef.id,
        name: payload.name,
        phone: payload.phone,
        email: payload.email ?? undefined,
        notes: payload.notes ?? undefined,
        active: true,
        totalPicks: 0,
        totalRevenue: 0,
        totalUnitsMissing: 0,
        walletBalance: 0,
        createdAt,
        createdBy,
      },
      ...items,
    ]);

    await syncDocOps({
      id: `field-agent-create-${docRef.id}`,
      kind: 'field.agent.upsert',
      ops: [
        {
          op: 'set',
          collection: 'fieldAgents',
          docId: docRef.id,
          data: serializeDeep({
            ...payload,
            createdAt: stampTimestamp(createdAt),
          }) as Record<string, unknown>,
        },
      ],
    });

    logDesktopActivity({
      action: 'field_agent.create',
      summary: `Created field agent ${input.name.trim()}`,
      resourceType: 'fieldAgent',
      resourceId: docRef.id,
      metrics: { phone: input.phone.trim() },
    });
    return docRef.id;
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function updateFieldAgentClient(
  agentId: string,
  updates: Partial<Pick<FieldAgent, 'name' | 'phone' | 'email' | 'notes' | 'active'>>
): Promise<void> {
  try {
    const payload: {
      name?: string;
      phone?: string;
      email?: string | null;
      notes?: string | null;
      active?: boolean;
    } = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.phone !== undefined) payload.phone = updates.phone.trim();
    if (updates.email !== undefined) payload.email = updates.email?.trim() || null;
    if (updates.notes !== undefined) payload.notes = updates.notes?.trim() || null;
    if (updates.active !== undefined) payload.active = updates.active;

    await patchLocalFieldAgents((items) =>
      items.map((a) =>
        a.id === agentId
          ? {
              ...a,
              ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
              ...(updates.phone !== undefined ? { phone: updates.phone.trim() } : {}),
              ...(updates.email !== undefined
                ? { email: updates.email?.trim() || undefined }
                : {}),
              ...(updates.notes !== undefined
                ? { notes: updates.notes?.trim() || undefined }
                : {}),
              ...(updates.active !== undefined ? { active: updates.active } : {}),
            }
          : a
      )
    );

    await syncDocOps({
      id: `field-agent-update-${agentId}`,
      kind: 'field.agent.upsert',
      ops: [
        {
          op: 'set',
          collection: 'fieldAgents',
          docId: agentId,
          data: serializeDeep(payload) as Record<string, unknown>,
          merge: true,
        },
      ],
    });

    logDesktopActivity({
      action: 'field_agent.update',
      summary: `Updated field agent ${updates.name ?? agentId}`,
      resourceType: 'fieldAgent',
      resourceId: agentId,
      metrics: {
        active: updates.active ?? null,
        name: updates.name ?? null,
      },
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function listFieldPicksClient(options?: {
  status?: 'active' | 'closed';
  agentId?: string;
  limit?: number;
}): Promise<FieldPick[]> {
  await ensureFirestoreAuthReady();
  try {
    let picks = await getFieldPicks();
    if (options?.agentId) {
      picks = picks.filter((pick) => pick.agentId === options.agentId);
    }
    if (options?.status) {
      picks = picks.filter((pick) => pick.status === options.status);
    }
    return picks.slice(0, options?.limit ?? 100);
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function getFieldPickByIdClient(
  pickId: string
): Promise<FieldPick | null> {
  await ensureFirestoreAuthReady();
  try {
    return await loadPick(pickId);
  } catch {
    return null;
  }
}

export async function recordFieldAgentDepositClient(
  agentId: string,
  amount: number,
  paymentMethod: SalePaymentMethod,
  notes?: string
): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Deposit amount must be greater than zero.');
  }
  if (notes && notes.length > 1000) {
    throw new Error('Notes must be 1000 characters or fewer.');
  }

  const recordedBy = await requireUserEmail();

  try {
    const agent = await loadAgent(agentId);
    if (!agent) throw new Error('Field agent not found.');

    const walletBalance = Number(agent.walletBalance ?? 0) + amount;
    const createdAt = Timestamp.now();
    const txRef = doc(collection(db, 'fieldAgentTransactions'));

    const transactionPayload = {
      agentId,
      agentName: agent.name,
      type: 'deposit' as const,
      amount,
      paymentMethod,
      ...(notes?.trim() ? { notes: notes.trim() } : {}),
      walletBalanceAfter: walletBalance,
      recordedBy,
    };

    await patchLocalFieldAgents((items) =>
      items.map((a) => (a.id === agentId ? { ...a, walletBalance } : a))
    );

    await syncDocOps({
      id: `field-agent-deposit-${txRef.id}`,
      kind: 'field.agent.deposit',
      ops: [
        {
          op: 'set',
          collection: 'fieldAgents',
          docId: agentId,
          data: { walletBalance },
          merge: true,
        },
        {
          op: 'set',
          collection: 'fieldAgentTransactions',
          docId: txRef.id,
          data: serializeDeep({
            ...transactionPayload,
            createdAt: stampTimestamp(createdAt),
          }) as Record<string, unknown>,
        },
      ],
    });

    logDesktopActivity({
      action: 'field_agent.deposit_record',
      summary: `Field agent deposit · UGX ${amount.toLocaleString()}`,
      resourceType: 'fieldAgent',
      resourceId: agentId,
      metrics: { amount, paymentMethod, offline: !isOnline() },
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function listFieldAgentTransactionsClient(options?: {
  agentId?: string;
  limit?: number;
}): Promise<FieldAgentTransaction[]> {
  await ensureFirestoreAuthReady();
  try {
    const max = options?.limit ?? 200;
    const constraints = [] as ReturnType<typeof where>[];
    if (options?.agentId) {
      constraints.push(where('agentId', '==', options.agentId));
    }

    const q = query(
      collection(db, 'fieldAgentTransactions'),
      ...constraints,
      orderBy('createdAt', 'desc'),
      limit(max)
    );
    const snapshot = await getDocsHybrid(q);
    return snapshot.docs.map(
      (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as FieldAgentTransaction
    );
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export interface CreateFieldPickInput {
  agentId: string;
  agentName: string;
  items: Array<{ productId: string; quantity: number }>;
}

/**
 * Create a field pick with writeBatch so it works offline (queued by Firestore).
 * Transactions cannot run while the network is disabled.
 */
export async function createFieldPickClient(
  input: CreateFieldPickInput
): Promise<string> {
  const pickedBy = await requireUserEmail();

  if (!input.items.length) {
    throw new Error('Pick must include at least one product.');
  }

  try {
    const products = await Promise.all(
      input.items.map((item) => loadProduct(item.productId))
    );

    const pickItems: FieldPickItem[] = [];
    const stockUpdates: Array<{
      productId: string;
      productName: string;
      newStock: number;
      quantity: number;
    }> = [];

    for (let i = 0; i < input.items.length; i++) {
      const cartItem = input.items[i];
      const product = products[i];
      const currentStock = product.stock ?? 0;

      if (currentStock < cartItem.quantity) {
        throw new Error(
          `Insufficient stock for ${product.name}. Available: ${currentStock}`
        );
      }

      pickItems.push({
        productId: cartItem.productId,
        productName: product.name,
        barcode: product.barcode ?? '',
        quantityPicked: cartItem.quantity,
        unitPrice: product.price ?? 0,
        costPrice: product.costPrice ?? 0,
      });

      stockUpdates.push({
        productId: cartItem.productId,
        productName: product.name,
        newStock: currentStock - cartItem.quantity,
        quantity: cartItem.quantity,
      });
    }

    const pickRef = doc(collection(db, 'fieldPicks'));
    const pickedAt = Timestamp.now();
    const pickPayload: Omit<FieldPick, 'id'> = {
      agentId: input.agentId,
      agentName: input.agentName,
      items: pickItems,
      status: 'active',
      pickedAt,
      pickedBy,
    };

    const ops: PendingDocOp[] = [
      {
        op: 'set',
        collection: 'fieldPicks',
        docId: pickRef.id,
        data: serializeDeep({
          ...pickPayload,
          pickedAt: stampTimestamp(pickedAt),
        }) as Record<string, unknown>,
      },
    ];

    const movements: StockMovement[] = [];
    for (const update of stockUpdates) {
      ops.push({
        op: 'set',
        collection: 'products',
        docId: update.productId,
        data: { stock: update.newStock },
        merge: true,
      });

      const movementRef = doc(collection(db, 'stockMovements'));
      const movement: StockMovement = {
        id: movementRef.id,
        productId: update.productId,
        productName: update.productName,
        type: 'field_pickup',
        quantityChange: -update.quantity,
        resultingStock: update.newStock,
        referenceType: 'field_pick',
        referenceId: pickRef.id,
        performedBy: pickedBy,
        createdAt: pickedAt,
      };
      const { id: movementId, ...movementData } = movement;
      ops.push({
        op: 'set',
        collection: 'stockMovements',
        docId: movementId,
        data: serializeDeep({
          ...movementData,
          createdAt: stampTimestamp(pickedAt),
        }) as Record<string, unknown>,
      });
      movements.push(movement);
    }

    await patchLocalProductStock(
      stockUpdates.map((u) => ({ productId: u.productId, stock: u.newStock }))
    );
    await patchLocalFieldPicks((items) => [
      { id: pickRef.id, ...pickPayload },
      ...items,
    ]);
    await prependLocalMovements(movements);

    await syncDocOps({
      id: `field-pick-create-${pickRef.id}`,
      kind: 'field.pick.create',
      ops,
    });

    logDesktopActivity({
      action: 'field_pick.create',
      summary: `Field pick issued to ${input.agentName} · ${input.items.length} line(s)`,
      resourceType: 'fieldPick',
      resourceId: pickRef.id,
      metrics: {
        agentId: input.agentId,
        agentName: input.agentName,
        lineCount: input.items.length,
        units: input.items.reduce((sum, i) => sum + i.quantity, 0),
        offline: !isOnline(),
      },
    });

    return pickRef.id;
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export interface SubmitFieldPickReportInput {
  pickId: string;
  items: Array<{
    productId: string;
    quantitySold: number;
    quantityReturned: number;
  }>;
  depositAmount?: number;
  depositPaymentMethod?: SalePaymentMethod;
  depositNotes?: string;
  notes?: string;
}

export interface SubmitFieldPickReportResult {
  saleId: string | null;
  report: FieldPickReport;
}

/**
 * Close a field pick with writeBatch so reports can be saved offline and sync later.
 */
export async function submitFieldPickReportClient(
  input: SubmitFieldPickReportInput
): Promise<SubmitFieldPickReportResult> {
  const closedBy = await requireUserEmail();
  const cashierId = await requireCashierUid();

  try {
    const pick = await loadPick(input.pickId);
    if (pick.status !== 'active') {
      throw new Error('This pick has already been closed');
    }

    const agent = await loadAgent(pick.agentId);
    if (!agent) {
      throw new Error('Field agent not found');
    }
    const reportItemMap = new Map(
      input.items.map((item) => [item.productId, item])
    );

    const reportItems: FieldPickReportItem[] = [];
    let totalSold = 0;
    let totalReturned = 0;
    let totalRevenue = 0;
    const pickValue = (pick.items ?? []).reduce(
      (sum, item) => sum + item.quantityPicked * item.unitPrice,
      0
    );
    const depositAmount = Number(input.depositAmount ?? 0);
    if (!Number.isFinite(depositAmount) || depositAmount < 0) {
      throw new Error('Deposit amount must be zero or a positive number.');
    }
    if (input.depositNotes && input.depositNotes.length > 1000) {
      throw new Error('Deposit notes must be 1000 characters or fewer.');
    }

    const saleItems: SaleItem[] = [];
    const returnProductIds: string[] = [];

    for (const pickItem of pick.items ?? []) {
      const submitted = reportItemMap.get(pickItem.productId) ?? {
        quantitySold: 0,
        quantityReturned: 0,
      };

      const quantitySold = submitted.quantitySold;
      const quantityReturned = submitted.quantityReturned;
      const quantityMissing =
        pickItem.quantityPicked - quantitySold - quantityReturned;

      if (quantitySold < 0 || quantityReturned < 0) {
        throw new Error(`Invalid quantities for ${pickItem.productName}`);
      }

      if (quantityMissing !== 0) {
        throw new Error(
          `Sold + returned must equal picked for ${pickItem.productName}`
        );
      }

      const lineRevenue = quantitySold * pickItem.unitPrice;

      reportItems.push({
        productId: pickItem.productId,
        productName: pickItem.productName,
        quantityPicked: pickItem.quantityPicked,
        quantitySold,
        quantityReturned,
        quantityMissing,
        unitPrice: pickItem.unitPrice,
        lineRevenue,
      });

      totalSold += quantitySold;
      totalReturned += quantityReturned;
      totalRevenue += lineRevenue;

      if (quantityReturned > 0) {
        returnProductIds.push(pickItem.productId);
      }

      if (quantitySold > 0) {
        saleItems.push({
          productId: pickItem.productId,
          name: pickItem.productName,
          barcode: pickItem.barcode,
          quantity: quantitySold,
          unitPrice: pickItem.unitPrice,
          costPrice: pickItem.costPrice,
          discount: 0,
          lineTotal: lineRevenue,
        });
      }
    }

    const returnedProducts = await Promise.all(
      returnProductIds.map((id) => loadProduct(id))
    );
    const productById = new Map(returnedProducts.map((p) => [p.id, p]));

    const currentWallet = Number(agent.walletBalance ?? 0);
    const walletAfterDeposit = currentWallet + depositAmount;
    if (walletAfterDeposit < pickValue) {
      throw new Error(
        `Insufficient wallet balance. Required ${pickValue.toLocaleString()}, available ${walletAfterDeposit.toLocaleString()}.`
      );
    }
    const walletAfterSettlement = walletAfterDeposit - pickValue;
    const closedAt = Timestamp.now();
    const ops: PendingDocOp[] = [];
    let saleId: string | null = null;
    let salePayload: Omit<Sale, 'id'> | null = null;
    const movements: StockMovement[] = [];
    const stockPatches: Array<{ productId: string; stock: number }> = [];
    const settlementPaymentMethod = input.depositPaymentMethod ?? 'cash';

    if (depositAmount > 0) {
      const depositTxRef = doc(collection(db, 'fieldAgentTransactions'));
      ops.push({
        op: 'set',
        collection: 'fieldAgentTransactions',
        docId: depositTxRef.id,
        data: serializeDeep({
          agentId: pick.agentId,
          agentName: pick.agentName,
          type: 'deposit',
          amount: depositAmount,
          paymentMethod: settlementPaymentMethod,
          ...(input.depositNotes?.trim() ? { notes: input.depositNotes.trim() } : {}),
          walletBalanceAfter: walletAfterDeposit,
          recordedBy: closedBy,
          createdAt: stampTimestamp(closedAt),
        }) as Record<string, unknown>,
      });
    }

    const settlementTxRef = doc(collection(db, 'fieldAgentTransactions'));
    ops.push({
      op: 'set',
      collection: 'fieldAgentTransactions',
      docId: settlementTxRef.id,
      data: serializeDeep({
        agentId: pick.agentId,
        agentName: pick.agentName,
        type: 'pick_settlement',
        amount: pickValue,
        pickId: input.pickId,
        walletBalanceAfter: walletAfterSettlement,
        recordedBy: closedBy,
        createdAt: stampTimestamp(closedAt),
      }) as Record<string, unknown>,
    });

    if (saleItems.length > 0) {
      const saleRef = doc(collection(db, 'sales'));
      saleId = saleRef.id;
      salePayload = {
        receiptNumber: generateReceiptNumber(),
        items: saleItems,
        subtotal: totalRevenue,
        discountTotal: 0,
        totalAmount: totalRevenue,
        paymentMethod: settlementPaymentMethod,
        amountTendered: totalRevenue,
        changeGiven: 0,
        cashierEmail: closedBy,
        status: 'completed',
        createdAt: closedAt,
      };
      ops.push({
        op: 'set',
        collection: 'sales',
        docId: saleRef.id,
        data: serializeDeep({
          ...salePayload,
          createdAt: stampTimestamp(closedAt),
          paymentReference: null,
          customerId: null,
          customerName: pick.agentName,
          cashierId,
          channel: 'field',
          fieldAgentId: pick.agentId,
          fieldAgentName: pick.agentName,
          fieldPickId: input.pickId,
        }) as Record<string, unknown>,
      });
    }

    for (const reportItem of reportItems) {
      if (reportItem.quantityReturned <= 0) {
        continue;
      }

      const product = productById.get(reportItem.productId);
      let currentStock = product?.stock ?? 0;

      if (reportItem.quantityReturned > 0) {
        const newStock = currentStock + reportItem.quantityReturned;
        ops.push({
          op: 'set',
          collection: 'products',
          docId: reportItem.productId,
          data: { stock: newStock },
          merge: true,
        });
        stockPatches.push({ productId: reportItem.productId, stock: newStock });

        const movementRef = doc(collection(db, 'stockMovements'));
        const movement: StockMovement = {
          id: movementRef.id,
          productId: reportItem.productId,
          productName: reportItem.productName,
          type: 'return',
          quantityChange: reportItem.quantityReturned,
          resultingStock: newStock,
          reason: 'field_return',
          performedBy: closedBy,
          createdAt: closedAt,
          referenceType: 'field_pick',
          referenceId: input.pickId,
        };
        const { id: movementId, ...movementData } = movement;
        ops.push({
          op: 'set',
          collection: 'stockMovements',
          docId: movementId,
          data: serializeDeep({
            ...movementData,
            createdAt: stampTimestamp(closedAt),
          }) as Record<string, unknown>,
        });
        movements.push(movement);
        currentStock = newStock;
      }

    }

    const trimmedNotes = input.notes?.trim();
    const report: FieldPickReport = {
      items: reportItems,
      totalSold,
      totalReturned,
      totalMissing: 0,
      totalRevenue,
      paymentMethod: settlementPaymentMethod,
      amountCollected: depositAmount,
      pickValue,
      depositAtReport: depositAmount > 0 ? depositAmount : undefined,
      walletApplied: pickValue,
      walletBalanceAfter: walletAfterSettlement,
      ...(trimmedNotes ? { notes: trimmedNotes } : {}),
      ...(saleId ? { saleId } : {}),
    };

    ops.push({
      op: 'set',
      collection: 'fieldPicks',
      docId: input.pickId,
      data: serializeDeep({
        status: 'closed',
        report,
        closedAt: stampTimestamp(closedAt),
        closedBy,
      }) as Record<string, unknown>,
      merge: true,
    });

    ops.push({
      op: 'set',
      collection: 'fieldAgents',
      docId: pick.agentId,
      data: {
        totalPicks: (agent.totalPicks ?? 0) + 1,
        totalRevenue: (agent.totalRevenue ?? 0) + totalRevenue,
        walletBalance: walletAfterSettlement,
      },
      merge: true,
    });

    await patchLocalProductStock(stockPatches);
    await patchLocalFieldPicks((items) =>
      items.map((p) =>
        p.id === input.pickId
          ? { ...p, status: 'closed', report, closedAt, closedBy }
          : p
      )
    );
    await patchLocalFieldAgents((items) =>
      items.map((a) =>
        a.id === pick.agentId
          ? {
              ...a,
              totalPicks: (a.totalPicks ?? 0) + 1,
              totalRevenue: (a.totalRevenue ?? 0) + totalRevenue,
              walletBalance: walletAfterSettlement,
            }
          : a
      )
    );
    if (saleId && salePayload) {
      await prependLocalSale({ id: saleId, ...salePayload });
    }
    await prependLocalMovements(movements);

    await syncDocOps({
      id: `field-pick-submit-${input.pickId}`,
      kind: 'field.pick.settle',
      ops,
    });

    logDesktopActivity({
      action: 'field_pick.submit_report',
      summary: `Field pick closed · sold ${report.totalSold} · revenue ${report.totalRevenue}`,
      resourceType: 'fieldPick',
      resourceId: input.pickId,
      metrics: {
        totalSold: report.totalSold,
        totalReturned: report.totalReturned,
        totalRevenue: report.totalRevenue,
        pickValue: report.pickValue ?? 0,
        walletApplied: report.walletApplied ?? 0,
        depositAtReport: report.depositAtReport ?? 0,
        paymentMethod: report.paymentMethod,
        saleId,
        offline: !isOnline(),
      },
    });

    return { saleId, report };
  } catch (error) {
    throw toFirestoreError(error);
  }
}
