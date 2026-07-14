import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  Timestamp,
  where,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { ensureFirestoreAuthReady } from '@/lib/admin-auth';
import type { Sale, SaleItem, SalePaymentMethod } from '@/lib/erp-types';
import { toFirestoreError } from '@/lib/firestore';
import { logClientActivity } from '@/lib/staff-activity-client';

interface CreateSaleInput {
  items: Array<{
    productId: string;
    quantity: number;
    discount?: number;
  }>;
  discountTotal?: number;
  paymentMethod: SalePaymentMethod;
  amountTendered?: number;
  paymentReference?: string;
  customerId?: string;
  customerName?: string;
}

function generateReceiptNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RCP-${datePart}-${timePart}-${random}`;
}

export async function createSaleClient(input: CreateSaleInput): Promise<Sale> {
  await ensureFirestoreAuthReady();

  const user = auth.currentUser;
  if (!user?.email) {
    throw new Error('You must be signed in to complete a sale.');
  }

  if (!input.items.length) {
    throw new Error('Sale must include at least one item.');
  }

  const receiptNumber = generateReceiptNumber();
  const cashierEmail = user.email.toLowerCase();
  const cashierId = user.uid;

  try {
    const sale = await runTransaction(db, async (transaction) => {
      // Phase 1: all reads first
      const productRefs = input.items.map((item) =>
        doc(db, 'products', item.productId)
      );
      const productSnaps = await Promise.all(
        productRefs.map((ref) => transaction.get(ref))
      );

      const customerRef = input.customerId
        ? doc(db, 'customers', input.customerId)
        : null;
      const customerSnap = customerRef
        ? await transaction.get(customerRef)
        : null;

      // Phase 2: validate and compute from reads
      const saleItems: SaleItem[] = [];
      let subtotal = 0;
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

        const unitPrice = product.price ?? 0;
        const costPrice = product.costPrice ?? 0;
        const lineDiscount = cartItem.discount ?? 0;
        const lineTotal = unitPrice * cartItem.quantity - lineDiscount;

        saleItems.push({
          productId: cartItem.productId,
          name: product.name,
          barcode: product.barcode ?? '',
          quantity: cartItem.quantity,
          unitPrice,
          costPrice,
          discount: lineDiscount,
          lineTotal,
        });

        subtotal += lineTotal;

        stockUpdates.push({
          ref: productRefs[i],
          productName: product.name,
          productId: cartItem.productId,
          newStock: currentStock - cartItem.quantity,
          quantity: cartItem.quantity,
        });
      }

      const discountTotal = input.discountTotal ?? 0;
      const totalAmount = Math.max(0, subtotal - discountTotal);
      const amountTendered = input.amountTendered ?? totalAmount;
      const changeGiven =
        input.paymentMethod === 'cash'
          ? Math.max(0, amountTendered - totalAmount)
          : 0;
      const createdAt = Timestamp.now();

      // Phase 3: all writes
      for (const update of stockUpdates) {
        transaction.update(update.ref, { stock: update.newStock });

        const movementRef = doc(collection(db, 'stockMovements'));
        transaction.set(movementRef, {
          productId: update.productId,
          productName: update.productName,
          type: 'sale',
          quantityChange: -update.quantity,
          resultingStock: update.newStock,
          referenceType: 'sale',
          referenceId: receiptNumber,
          performedBy: cashierEmail,
          createdAt,
        });
      }

      const saleRef = doc(collection(db, 'sales'));
      const saleData = {
        receiptNumber,
        items: saleItems,
        subtotal,
        discountTotal,
        totalAmount,
        paymentMethod: input.paymentMethod,
        amountTendered,
        changeGiven,
        paymentReference: input.paymentReference ?? null,
        customerId: input.customerId ?? null,
        customerName: input.customerName ?? null,
        cashierId,
        cashierEmail,
        status: 'completed' as const,
        createdAt,
      };
      transaction.set(saleRef, saleData);

      if (customerRef && customerSnap?.exists()) {
        const customer = customerSnap.data();
        const updates: Record<string, unknown> = {
          totalSpent: (customer.totalSpent ?? 0) + totalAmount,
          loyaltyPoints:
            (customer.loyaltyPoints ?? 0) + Math.floor(totalAmount / 10000),
        };

        if (input.paymentMethod === 'credit') {
          updates.outstandingBalance =
            (customer.outstandingBalance ?? 0) + totalAmount;
        }

        transaction.update(customerRef, updates);
      }

      return {
        id: saleRef.id,
        ...saleData,
        paymentReference: input.paymentReference,
        customerId: input.customerId,
        customerName: input.customerName,
      } satisfies Sale;
    });

    logClientActivity({
      action: 'sale.create',
      summary: `POS sale ${sale.receiptNumber} · ${sale.items.length} item(s)`,
      resourceType: 'sale',
      resourceId: sale.id,
      channel: 'web_admin',
      metrics: {
        totalAmount: sale.totalAmount,
        itemCount: sale.items.length,
        paymentMethod: sale.paymentMethod,
        receiptNumber: sale.receiptNumber,
      },
    });

    return sale;
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function getSaleByIdClient(saleId: string): Promise<Sale | null> {
  await ensureFirestoreAuthReady();
  try {
    const snapshot = await getDoc(doc(db, 'sales', saleId));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as Sale;
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function voidSaleClient(
  saleId: string,
  knownSale?: Pick<Sale, 'receiptNumber'>
): Promise<void> {
  await ensureFirestoreAuthReady();

  const user = auth.currentUser;
  if (!user?.email) {
    throw new Error('You must be signed in.');
  }

  try {
    let receiptNumber = knownSale?.receiptNumber;
    if (!receiptNumber) {
      const saleSnapPreview = await getDoc(doc(db, 'sales', saleId));
      if (!saleSnapPreview.exists()) {
        throw new Error('Sale not found');
      }
      receiptNumber = (saleSnapPreview.data() as Omit<Sale, 'id'>).receiptNumber;
    }

    // Movements are keyed by receipt number (and historically sometimes by sale id)
    const movementQueries = [
      getDocs(
        query(
          collection(db, 'stockMovements'),
          where('referenceId', '==', receiptNumber)
        )
      ),
    ];
    if (receiptNumber !== saleId) {
      movementQueries.push(
        getDocs(
          query(
            collection(db, 'stockMovements'),
            where('referenceId', '==', saleId)
          )
        )
      );
    }

    const movementSnaps = await Promise.all(movementQueries);
    const movementIds = new Set<string>();
    for (const snap of movementSnaps) {
      for (const movementDoc of snap.docs) {
        movementIds.add(movementDoc.id);
      }
    }
    const movementRefs = [...movementIds].map((id) =>
      doc(db, 'stockMovements', id)
    );

    await runTransaction(db, async (transaction) => {
      const saleRef = doc(db, 'sales', saleId);
      const saleSnap = await transaction.get(saleRef);

      if (!saleSnap.exists()) {
        throw new Error('Sale not found');
      }

      const sale = saleSnap.data() as Omit<Sale, 'id'>;

      if (sale.status !== 'completed') {
        throw new Error(`Sale is already ${sale.status}`);
      }

      const productRefs = sale.items.map((item) =>
        doc(db, 'products', item.productId)
      );
      const productSnaps = await Promise.all(
        productRefs.map((ref) => transaction.get(ref))
      );

      const customerRef = sale.customerId
        ? doc(db, 'customers', sale.customerId)
        : null;
      const customerSnap = customerRef
        ? await transaction.get(customerRef)
        : null;

      const movementDocSnaps = await Promise.all(
        movementRefs.map((ref) => transaction.get(ref))
      );

      for (let i = 0; i < sale.items.length; i++) {
        const item = sale.items[i];
        const productSnap = productSnaps[i];

        if (!productSnap.exists()) continue;

        const product = productSnap.data();
        const currentStock = product.stock ?? 0;

        transaction.update(productRefs[i], {
          stock: currentStock + item.quantity,
        });
      }

      for (const movementSnap of movementDocSnaps) {
        if (!movementSnap.exists()) continue;
        transaction.delete(movementSnap.ref);
      }

      if (customerRef && customerSnap?.exists()) {
        const customer = customerSnap.data();
        const loyaltyReversal = Math.floor(sale.totalAmount / 10000);

        transaction.update(customerRef, {
          totalSpent: Math.max(0, (customer.totalSpent ?? 0) - sale.totalAmount),
          loyaltyPoints: Math.max(
            0,
            (customer.loyaltyPoints ?? 0) - loyaltyReversal
          ),
          ...(sale.paymentMethod === 'credit'
            ? {
                outstandingBalance: Math.max(
                  0,
                  (customer.outstandingBalance ?? 0) - sale.totalAmount
                ),
              }
            : {}),
        });
      }

      transaction.delete(saleRef);
    });

    logClientActivity({
      action: 'sale.void',
      summary: `Voided sale ${receiptNumber ?? saleId}`,
      resourceType: 'sale',
      resourceId: saleId,
      channel: 'web_admin',
      metrics: { receiptNumber: receiptNumber ?? null },
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function refundOrCancelSaleClient(
  saleId: string,
  action: 'refunded'
): Promise<void> {
  await ensureFirestoreAuthReady();

  const user = auth.currentUser;
  if (!user?.email) {
    throw new Error('You must be signed in.');
  }

  try {
    let receiptNumber = '';
    let totalAmount = 0;
    await runTransaction(db, async (transaction) => {
      const saleRef = doc(db, 'sales', saleId);
      const saleSnap = await transaction.get(saleRef);

      if (!saleSnap.exists()) {
        throw new Error('Sale not found');
      }

      const sale = saleSnap.data() as Omit<Sale, 'id'>;
      receiptNumber = sale.receiptNumber;
      totalAmount = sale.totalAmount;

      if (sale.status !== 'completed') {
        throw new Error(`Sale is already ${sale.status}`);
      }

      // Phase 1: read all products and customer
      const productRefs = sale.items.map((item) =>
        doc(db, 'products', item.productId)
      );
      const productSnaps = await Promise.all(
        productRefs.map((ref) => transaction.get(ref))
      );

      const customerRef = sale.customerId
        ? doc(db, 'customers', sale.customerId)
        : null;
      const customerSnap = customerRef
        ? await transaction.get(customerRef)
        : null;

      // Phase 2: all writes
      for (let i = 0; i < sale.items.length; i++) {
        const item = sale.items[i];
        const productSnap = productSnaps[i];

        if (!productSnap.exists()) continue;

        const product = productSnap.data();
        const currentStock = product.stock ?? 0;
        const newStock = currentStock + item.quantity;

        transaction.update(productRefs[i], { stock: newStock });

        const movementRef = doc(collection(db, 'stockMovements'));
        transaction.set(movementRef, {
          productId: item.productId,
          productName: product.name,
          type: 'return',
          quantityChange: item.quantity,
          resultingStock: newStock,
          referenceType: 'return',
          referenceId: saleId,
          reason: action,
          performedBy: user.email,
          createdAt: Timestamp.now(),
        });
      }

      transaction.update(saleRef, { status: action });

      if (customerRef && customerSnap?.exists()) {
        const customer = customerSnap.data();
        const updates: Record<string, unknown> = {
          totalSpent: Math.max(0, (customer.totalSpent ?? 0) - sale.totalAmount),
        };

        if (sale.paymentMethod === 'credit') {
          updates.outstandingBalance = Math.max(
            0,
            (customer.outstandingBalance ?? 0) - sale.totalAmount
          );
        }

        transaction.update(customerRef, updates);
      }
    });

    logClientActivity({
      action: 'sale.refund',
      summary: `Refunded sale ${receiptNumber || saleId}`,
      resourceType: 'sale',
      resourceId: saleId,
      channel: 'web_admin',
      metrics: {
        receiptNumber: receiptNumber || null,
        totalAmount,
      },
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}
