import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { ensureFirestoreAuthReady } from '@/lib/admin-auth';
import type {
  FieldAgent,
  FieldPick,
  FieldPickItem,
  FieldPickReport,
  FieldPickReportItem,
  SaleItem,
  SalePaymentMethod,
} from '@/lib/erp-types';
import { toFirestoreError } from '@/lib/firestore';
import { logClientActivity } from '@/lib/staff-activity-client';

const fieldAgentsCollection = collection(db, 'fieldAgents');
const fieldPicksCollection = collection(db, 'fieldPicks');

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

// --- Field Agents ---

export async function listFieldAgentsClient(): Promise<FieldAgent[]> {
  await ensureFirestoreAuthReady();
  try {
    const snapshot = await getDocs(fieldAgentsCollection);
    return snapshot.docs
      .map(
        (docSnap) =>
          ({
            id: docSnap.id,
            ...docSnap.data(),
          }) as FieldAgent
      )
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function getFieldAgentByIdClient(
  agentId: string
): Promise<FieldAgent | null> {
  await ensureFirestoreAuthReady();
  try {
    const snapshot = await getDoc(doc(db, 'fieldAgents', agentId));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as FieldAgent;
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
    const docRef = await addDoc(fieldAgentsCollection, {
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      notes: input.notes?.trim() || null,
      active: true,
      totalPicks: 0,
      totalRevenue: 0,
      totalUnitsMissing: 0,
      createdAt: Timestamp.now(),
      createdBy,
    });
    logClientActivity({
      action: 'field_agent.create',
      summary: `Created field agent ${input.name.trim()}`,
      resourceType: 'fieldAgent',
      resourceId: docRef.id,
      channel: 'web_admin',
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
    logClientActivity({
      action: 'field_agent.update',
      summary: `Updated field agent ${updates.name ?? agentId}`,
      resourceType: 'fieldAgent',
      resourceId: agentId,
      channel: 'web_admin',
      metrics: {
        active: updates.active ?? null,
        name: updates.name ?? null,
      },
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}

// --- Field Picks ---

export async function listFieldPicksClient(options?: {
  status?: 'active' | 'closed';
  agentId?: string;
  limit?: number;
}): Promise<FieldPick[]> {
  await ensureFirestoreAuthReady();
  try {
    const max = options?.limit ?? 100;
    const snapshot = await getDocs(fieldPicksCollection);
    let picks = snapshot.docs.map(
      (docSnap) =>
        ({
          id: docSnap.id,
          ...docSnap.data(),
        }) as FieldPick
    );

    if (options?.agentId) {
      picks = picks.filter((pick) => pick.agentId === options.agentId);
    }

    if (options?.status) {
      picks = picks.filter((pick) => pick.status === options.status);
    }

    picks.sort((a, b) => b.pickedAt.toMillis() - a.pickedAt.toMillis());

    return picks.slice(0, max);
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function getFieldPickByIdClient(
  pickId: string
): Promise<FieldPick | null> {
  await ensureFirestoreAuthReady();
  try {
    const snapshot = await getDoc(doc(db, 'fieldPicks', pickId));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as FieldPick;
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export interface CreateFieldPickInput {
  agentId: string;
  agentName: string;
  items: Array<{ productId: string; quantity: number }>;
}

export async function createFieldPickClient(
  input: CreateFieldPickInput
): Promise<string> {
  const pickedBy = await requireUserEmail();

  if (!input.items.length) {
    throw new Error('Pick must include at least one product.');
  }

  try {
    const pickId = await runTransaction(db, async (transaction) => {
      const productRefs = input.items.map((item) =>
        doc(db, 'products', item.productId)
      );
      const productSnaps = await Promise.all(
        productRefs.map((ref) => transaction.get(ref))
      );

      const pickItems: FieldPickItem[] = [];
      const stockUpdates: Array<{
        ref: ReturnType<typeof doc>;
        productName: string;
        productId: string;
        newStock: number;
        quantity: number;
      }> = [];

      for (let i = 0; i < input.items.length; i++) {
        const cartItem = input.items[i];
        const productSnap = productSnaps[i];

        if (!productSnap.exists()) {
          throw new Error(`Product ${cartItem.productId} not found`);
        }

        const product = productSnap.data();
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
          ref: productRefs[i],
          productName: product.name,
          productId: cartItem.productId,
          newStock: currentStock - cartItem.quantity,
          quantity: cartItem.quantity,
        });
      }

      const pickRef = doc(collection(db, 'fieldPicks'));
      const pickedAt = Timestamp.now();

      transaction.set(pickRef, {
        agentId: input.agentId,
        agentName: input.agentName,
        items: pickItems,
        status: 'active',
        pickedAt,
        pickedBy,
      });

      for (const update of stockUpdates) {
        transaction.update(update.ref, { stock: update.newStock });

        const movementRef = doc(collection(db, 'stockMovements'));
        transaction.set(movementRef, {
          productId: update.productId,
          productName: update.productName,
          type: 'field_pickup',
          quantityChange: -update.quantity,
          resultingStock: update.newStock,
          referenceType: 'field_pick',
          referenceId: pickRef.id,
          performedBy: pickedBy,
          createdAt: pickedAt,
        });
      }

      return pickRef.id;
    });

    logClientActivity({
      action: 'field_pick.create',
      summary: `Field pick issued to ${input.agentName} · ${input.items.length} line(s)`,
      resourceType: 'fieldPick',
      resourceId: pickId,
      channel: 'web_admin',
      metrics: {
        agentId: input.agentId,
        agentName: input.agentName,
        lineCount: input.items.length,
        units: input.items.reduce((sum, i) => sum + i.quantity, 0),
      },
    });

    return pickId;
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

export async function submitFieldPickReportClient(
  input: SubmitFieldPickReportInput
): Promise<SubmitFieldPickReportResult> {
  const closedBy = await requireUserEmail();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in.');
  }

  try {
    const result = await runTransaction(db, async (transaction) => {
      const pickRef = doc(db, 'fieldPicks', input.pickId);
      const pickSnap = await transaction.get(pickRef);

      if (!pickSnap.exists()) {
        throw new Error('Pick not found');
      }

      const pick = pickSnap.data() as Omit<FieldPick, 'id'>;

      if (pick.status !== 'active') {
        throw new Error('This pick has already been closed');
      }

      const agentRef = doc(db, 'fieldAgents', pick.agentId);
      const agentSnap = await transaction.get(agentRef);

      const reportItemMap = new Map(
        input.items.map((item) => [item.productId, item])
      );

      const reportItems: FieldPickReportItem[] = [];
      let totalSold = 0;
      let totalReturned = 0;
      let totalMissing = 0;
      let totalRevenue = 0;

      const saleItems: SaleItem[] = [];
      const productsToRead = new Set<string>();

      for (const pickItem of pick.items) {
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
          productsToRead.add(pickItem.productId);
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

      const productRefs = [...productsToRead].map((id) =>
        doc(db, 'products', id)
      );
      const productSnaps = await Promise.all(
        productRefs.map((ref) => transaction.get(ref))
      );
      const productSnapById = new Map(
        productRefs.map((ref, i) => [ref.id, productSnaps[i]])
      );

      const closedAt = Timestamp.now();
      let saleId: string | null = null;

      if (saleItems.length > 0) {
        const receiptNumber = generateReceiptNumber();
        const saleRef = doc(collection(db, 'sales'));
        saleId = saleRef.id;

        transaction.set(saleRef, {
          receiptNumber,
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
          paymentReference: null,
          customerId: null,
          customerName: pick.agentName,
          cashierId: user.uid,
          cashierEmail: closedBy,
          status: 'completed',
          channel: 'field',
          fieldAgentId: pick.agentId,
          fieldAgentName: pick.agentName,
          fieldPickId: input.pickId,
          createdAt: closedAt,
        });
      }

      for (const reportItem of reportItems) {
        if (reportItem.quantityReturned <= 0 && reportItem.quantityMissing <= 0) {
          continue;
        }

        const productRef = doc(db, 'products', reportItem.productId);
        const productSnap = productSnapById.get(reportItem.productId);

        if (!productSnap?.exists()) continue;

        const product = productSnap.data();
        let currentStock = product.stock ?? 0;

        if (reportItem.quantityReturned > 0) {
          const newStock = currentStock + reportItem.quantityReturned;
          transaction.update(productRef, { stock: newStock });

          const movementRef = doc(collection(db, 'stockMovements'));
          transaction.set(movementRef, {
            productId: reportItem.productId,
            productName: reportItem.productName,
            type: 'return',
            quantityChange: reportItem.quantityReturned,
            resultingStock: newStock,
            referenceType: 'field_pick',
            referenceId: input.pickId,
            reason: 'field_return',
            performedBy: closedBy,
            createdAt: closedAt,
          });

          currentStock = newStock;
        }

        if (reportItem.quantityMissing > 0) {
          const movementRef = doc(collection(db, 'stockMovements'));
          transaction.set(movementRef, {
            productId: reportItem.productId,
            productName: reportItem.productName,
            type: 'lost',
            quantityChange: 0,
            resultingStock: currentStock,
            referenceType: 'field_pick',
            referenceId: input.pickId,
            reason: `field_missing:${reportItem.quantityMissing}`,
            performedBy: closedBy,
            createdAt: closedAt,
          });
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

      transaction.update(pickRef, {
        status: 'closed',
        report,
        closedAt,
        closedBy,
      });

      if (agentSnap.exists()) {
        const agent = agentSnap.data();
        transaction.update(agentRef, {
          totalPicks: (agent.totalPicks ?? 0) + 1,
          totalRevenue: (agent.totalRevenue ?? 0) + totalRevenue,
          totalUnitsMissing: (agent.totalUnitsMissing ?? 0) + totalMissing,
        });
      }

      return { saleId, report };
    });

    logClientActivity({
      action: 'field_pick.submit_report',
      summary: `Field pick closed · sold ${result.report.totalSold} · revenue ${result.report.totalRevenue}`,
      resourceType: 'fieldPick',
      resourceId: input.pickId,
      channel: 'web_admin',
      metrics: {
        totalSold: result.report.totalSold,
        totalReturned: result.report.totalReturned,
        totalMissing: result.report.totalMissing,
        totalRevenue: result.report.totalRevenue,
        paymentMethod: result.report.paymentMethod,
        saleId: result.saleId,
      },
    });

    return result;
  } catch (error) {
    throw toFirestoreError(error);
  }
}
