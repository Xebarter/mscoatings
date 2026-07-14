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

export async function createSaleClient(input: CreateSaleInput): Promise<string> {
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
    return await runTransaction(db, async (transaction) => {
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
          createdAt: Timestamp.now(),
        });
      }

      const saleRef = doc(collection(db, 'sales'));
      transaction.set(saleRef, {
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
        status: 'completed',
        createdAt: Timestamp.now(),
      });

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

      return saleRef.id;
    });
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

export async function voidSaleClient(saleId: string): Promise<void> {
  await ensureFirestoreAuthReady();

  const user = auth.currentUser;
  if (!user?.email) {
    throw new Error('You must be signed in.');
  }

  await user.getIdToken(true);

  try {
    const movementsByReceiptSnap = await getDocs(
      query(
        collection(db, 'stockMovements'),
        where('referenceId', '==', saleId)
      )
    );
    const saleSnapPreview = await getDoc(doc(db, 'sales', saleId));
    if (!saleSnapPreview.exists()) {
      throw new Error('Sale not found');
    }
    const receiptNumber = (saleSnapPreview.data() as Omit<Sale, 'id'>)
      .receiptNumber;
    const movementsByReceiptNumberSnap = await getDocs(
      query(
        collection(db, 'stockMovements'),
        where('referenceId', '==', receiptNumber)
      )
    );

    const movementIds = new Set<string>();
    for (const movementDoc of movementsByReceiptSnap.docs) {
      movementIds.add(movementDoc.id);
    }
    for (const movementDoc of movementsByReceiptNumberSnap.docs) {
      movementIds.add(movementDoc.id);
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

      const movementSnaps = await Promise.all(
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

      for (const movementSnap of movementSnaps) {
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
  } catch (error) {
    throw toFirestoreError(error);
  }
}
