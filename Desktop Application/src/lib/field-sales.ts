import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocFromCache,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { ensureFirestoreAuthReady } from './admin-auth';
import type {
  FieldAgent,
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
import { localGet, localSet } from './offline/local-store';
import { logDesktopActivity } from './staff-activity';

function generateReceiptNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RCP-${datePart}-${timePart}-${random}`;
}

async function requireUserEmail(): Promise<string> {
  const user = auth.currentUser;
  if (!user?.email) {
    await ensureFirestoreAuthReady();
  }
  const email = auth.currentUser?.email;
  if (!email) {
    throw new Error('You must be signed in.');
  }
  return email.toLowerCase();
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

async function loadPick(pickId: string): Promise<FieldPick> {
  const ref = doc(db, 'fieldPicks', pickId);
  try {
    const snap = isOnline() ? await getDoc(ref) : await getDocFromCache(ref);
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
    const snap = isOnline() ? await getDoc(ref) : await getDocFromCache(ref);
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
  const items = mutator(cached?.items ?? []);
  await localSet('fieldPicks', { items, savedAt: Date.now() });
}

async function patchLocalFieldAgents(mutator: (items: FieldAgent[]) => FieldAgent[]) {
  const cached = await localGet<{ items: FieldAgent[]; savedAt: number }>('fieldAgents');
  const items = mutator(cached?.items ?? []);
  await localSet('fieldAgents', { items, savedAt: Date.now() });
}

async function prependLocalSale(sale: Sale) {
  const cached = await localGet<{ items: Sale[]; savedAt: number }>('sales');
  const items = [sale, ...(cached?.items ?? [])].slice(0, 200);
  await localSet('sales', { items, savedAt: Date.now() });
}

async function prependLocalMovements(movements: StockMovement[]) {
  if (!movements.length) return;
  const cached = await localGet<{ items: StockMovement[]; savedAt: number }>(
    'stockMovements'
  );
  await localSet('stockMovements', {
    items: [...movements, ...(cached?.items ?? [])].slice(0, 200),
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
      createdAt,
      createdBy,
    };

    const docRef = await addDoc(collection(db, 'fieldAgents'), payload);

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
        createdAt,
        createdBy,
      },
      ...items,
    ]);

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
  await ensureFirestoreAuthReady();
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
    await updateDoc(doc(db, 'fieldAgents', agentId), payload);

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

    const batch = writeBatch(db);
    batch.set(pickRef, pickPayload);

    const movements: StockMovement[] = [];
    for (const update of stockUpdates) {
      batch.update(doc(db, 'products', update.productId), {
        stock: update.newStock,
      });

      const movementRef = doc(collection(db, 'stockMovements'));
      const movement: Omit<StockMovement, 'id'> = {
        productId: update.productId,
        productName: update.productName,
        type: 'field_pickup',
        quantityChange: -update.quantity,
        resultingStock: update.newStock,
        performedBy: pickedBy,
        createdAt: pickedAt,
      };
      batch.set(movementRef, {
        ...movement,
        referenceType: 'field_pick',
        referenceId: pickRef.id,
      });
      movements.push({ id: movementRef.id, ...movement });
    }

    await batch.commit();

    await patchLocalProductStock(
      stockUpdates.map((u) => ({ productId: u.productId, stock: u.newStock }))
    );
    await patchLocalFieldPicks((items) => [
      { id: pickRef.id, ...pickPayload },
      ...items,
    ]);
    await prependLocalMovements(movements);

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
  paymentMethod: SalePaymentMethod;
  amountCollected: number;
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
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in.');
  }

  try {
    const pick = await loadPick(input.pickId);
    if (pick.status !== 'active') {
      throw new Error('This pick has already been closed');
    }

    const agent = await loadAgent(pick.agentId);
    const reportItemMap = new Map(
      input.items.map((item) => [item.productId, item])
    );

    const reportItems: FieldPickReportItem[] = [];
    let totalSold = 0;
    let totalReturned = 0;
    let totalMissing = 0;
    let totalRevenue = 0;

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

      if (quantityMissing < 0) {
        throw new Error(
          `Sold + returned exceeds picked for ${pickItem.productName}`
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
      totalMissing += quantityMissing;
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

    const closedAt = Timestamp.now();
    const batch = writeBatch(db);
    let saleId: string | null = null;
    let salePayload: Omit<Sale, 'id'> | null = null;
    const movements: StockMovement[] = [];
    const stockPatches: Array<{ productId: string; stock: number }> = [];

    if (saleItems.length > 0) {
      const saleRef = doc(collection(db, 'sales'));
      saleId = saleRef.id;
      salePayload = {
        receiptNumber: generateReceiptNumber(),
        items: saleItems,
        subtotal: totalRevenue,
        discountTotal: 0,
        totalAmount: totalRevenue,
        paymentMethod: input.paymentMethod,
        amountTendered: input.amountCollected,
        changeGiven:
          input.paymentMethod === 'cash'
            ? Math.max(0, input.amountCollected - totalRevenue)
            : 0,
        cashierEmail: closedBy,
        status: 'completed',
        createdAt: closedAt,
      };
      batch.set(saleRef, {
        ...salePayload,
        paymentReference: null,
        customerId: null,
        customerName: pick.agentName,
        cashierId: user.uid,
        channel: 'field',
        fieldAgentId: pick.agentId,
        fieldAgentName: pick.agentName,
        fieldPickId: input.pickId,
      });
    }

    for (const reportItem of reportItems) {
      if (reportItem.quantityReturned <= 0 && reportItem.quantityMissing <= 0) {
        continue;
      }

      const product = productById.get(reportItem.productId);
      let currentStock = product?.stock ?? 0;

      if (reportItem.quantityReturned > 0) {
        const newStock = currentStock + reportItem.quantityReturned;
        batch.update(doc(db, 'products', reportItem.productId), {
          stock: newStock,
        });
        stockPatches.push({ productId: reportItem.productId, stock: newStock });

        const movementRef = doc(collection(db, 'stockMovements'));
        const movement: Omit<StockMovement, 'id'> = {
          productId: reportItem.productId,
          productName: reportItem.productName,
          type: 'return',
          quantityChange: reportItem.quantityReturned,
          resultingStock: newStock,
          reason: 'field_return',
          performedBy: closedBy,
          createdAt: closedAt,
        };
        batch.set(movementRef, {
          ...movement,
          referenceType: 'field_pick',
          referenceId: input.pickId,
        });
        movements.push({ id: movementRef.id, ...movement });
        currentStock = newStock;
      }

      if (reportItem.quantityMissing > 0) {
        const movementRef = doc(collection(db, 'stockMovements'));
        const movement: Omit<StockMovement, 'id'> = {
          productId: reportItem.productId,
          productName: reportItem.productName,
          type: 'lost',
          quantityChange: 0,
          resultingStock: currentStock,
          reason: `field_missing:${reportItem.quantityMissing}`,
          performedBy: closedBy,
          createdAt: closedAt,
        };
        batch.set(movementRef, {
          ...movement,
          referenceType: 'field_pick',
          referenceId: input.pickId,
        });
        movements.push({ id: movementRef.id, ...movement });
      }
    }

    const trimmedNotes = input.notes?.trim();
    const report: FieldPickReport = {
      items: reportItems,
      totalSold,
      totalReturned,
      totalMissing,
      totalRevenue,
      paymentMethod: input.paymentMethod,
      amountCollected: input.amountCollected,
      ...(trimmedNotes ? { notes: trimmedNotes } : {}),
      ...(saleId ? { saleId } : {}),
    };

    batch.update(doc(db, 'fieldPicks', input.pickId), {
      status: 'closed',
      report,
      closedAt,
      closedBy,
    });

    if (agent) {
      batch.update(doc(db, 'fieldAgents', pick.agentId), {
        totalPicks: (agent.totalPicks ?? 0) + 1,
        totalRevenue: (agent.totalRevenue ?? 0) + totalRevenue,
        totalUnitsMissing: (agent.totalUnitsMissing ?? 0) + totalMissing,
      });
    }

    await batch.commit();

    await patchLocalProductStock(stockPatches);
    await patchLocalFieldPicks((items) =>
      items.map((p) =>
        p.id === input.pickId
          ? { ...p, status: 'closed', report, closedAt, closedBy }
          : p
      )
    );
    if (agent) {
      await patchLocalFieldAgents((items) =>
        items.map((a) =>
          a.id === pick.agentId
            ? {
                ...a,
                totalPicks: (a.totalPicks ?? 0) + 1,
                totalRevenue: (a.totalRevenue ?? 0) + totalRevenue,
                totalUnitsMissing: (a.totalUnitsMissing ?? 0) + totalMissing,
              }
            : a
        )
      );
    }
    if (saleId && salePayload) {
      await prependLocalSale({ id: saleId, ...salePayload });
    }
    await prependLocalMovements(movements);

    logDesktopActivity({
      action: 'field_pick.submit_report',
      summary: `Field pick closed · sold ${report.totalSold} · revenue ${report.totalRevenue}`,
      resourceType: 'fieldPick',
      resourceId: input.pickId,
      metrics: {
        totalSold: report.totalSold,
        totalReturned: report.totalReturned,
        totalMissing: report.totalMissing,
        totalRevenue: report.totalRevenue,
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
