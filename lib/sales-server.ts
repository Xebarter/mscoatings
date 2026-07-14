import type { Sale, SaleItem, SalePaymentMethod } from '@/lib/erp-types';
import { getNextBarcodeSequence } from '@/lib/barcode';
import { getAdminFirestore, getAdminTimestamp } from '@/lib/firebase-admin';
import { getMaxBarcodeSequence } from '@/lib/inventory-server';

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
  cashierId: string;
  cashierEmail: string;
}

async function generateReceiptNumber(): Promise<string> {
  const db = getAdminFirestore();
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `RCP-${datePart}-`;

  const snapshot = await db
    .collection('sales')
    .where('receiptNumber', '>=', prefix)
    .where('receiptNumber', '<', `${prefix}\uf8ff`)
    .get();

  const sequence = snapshot.size + 1;
  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

export async function createSale(input: CreateSaleInput): Promise<string> {
  const db = getAdminFirestore();
  const Timestamp = getAdminTimestamp();

  if (!input.items.length) {
    throw new Error('Sale must include at least one item.');
  }

  const receiptNumber = await generateReceiptNumber();

  return db.runTransaction(async (transaction) => {
    const productRefs = input.items.map((item) =>
      db.collection('products').doc(item.productId)
    );
    const productSnaps = await Promise.all(
      productRefs.map((ref) => transaction.get(ref))
    );

    const customerRef = input.customerId
      ? db.collection('customers').doc(input.customerId)
      : null;
    const customerSnap = customerRef
      ? await transaction.get(customerRef)
      : null;

    const saleItems: SaleItem[] = [];
    let subtotal = 0;
    const stockUpdates: Array<{
      ref: FirebaseFirestore.DocumentReference;
      productName: string;
      productId: string;
      newStock: number;
      quantity: number;
    }> = [];

    for (let i = 0; i < input.items.length; i++) {
      const cartItem = input.items[i];
      const productSnap = productSnaps[i];

      if (!productSnap.exists) {
        throw new Error(`Product ${cartItem.productId} not found`);
      }

      const product = productSnap.data()!;
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

    for (const update of stockUpdates) {
      transaction.update(update.ref, { stock: update.newStock });

      const movementRef = db.collection('stockMovements').doc();
      transaction.set(movementRef, {
        productId: update.productId,
        productName: update.productName,
        type: 'sale',
        quantityChange: -update.quantity,
        resultingStock: update.newStock,
        referenceType: 'sale',
        referenceId: receiptNumber,
        performedBy: input.cashierEmail,
        createdAt: Timestamp.now(),
      });
    }

    const saleRef = db.collection('sales').doc();
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
      cashierId: input.cashierId,
      cashierEmail: input.cashierEmail,
      status: 'completed',
      createdAt: Timestamp.now(),
    });

    if (customerRef && customerSnap?.exists) {
      const customer = customerSnap.data()!;
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
}

export async function getSaleById(saleId: string): Promise<Sale | null> {
  const db = getAdminFirestore();
  const snapshot = await db.collection('sales').doc(saleId).get();
  if (!snapshot.exists) return null;

  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<Sale, 'id'>),
  };
}

export async function listSales(limit = 100): Promise<Sale[]> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection('sales')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Sale, 'id'>),
  }));
}

export async function voidSale(saleId: string) {
  const db = getAdminFirestore();

  await db.runTransaction(async (transaction) => {
    const saleRef = db.collection('sales').doc(saleId);
    const saleSnap = await transaction.get(saleRef);

    if (!saleSnap.exists) {
      throw new Error('Sale not found');
    }

    const sale = saleSnap.data() as Omit<Sale, 'id'>;

    if (sale.status !== 'completed') {
      throw new Error(`Sale is already ${sale.status}`);
    }

    const movementsByReceipt = db
      .collection('stockMovements')
      .where('referenceId', '==', sale.receiptNumber);
    const movementsBySaleId = db
      .collection('stockMovements')
      .where('referenceId', '==', saleId);
    const [movementsByReceiptSnap, movementsBySaleIdSnap] = await Promise.all([
      transaction.get(movementsByReceipt),
      transaction.get(movementsBySaleId),
    ]);

    const productRefs = sale.items.map((item) =>
      db.collection('products').doc(item.productId)
    );
    const productSnaps = await Promise.all(
      productRefs.map((ref) => transaction.get(ref))
    );

    const customerRef = sale.customerId
      ? db.collection('customers').doc(sale.customerId)
      : null;
    const customerSnap = customerRef
      ? await transaction.get(customerRef)
      : null;

    for (let i = 0; i < sale.items.length; i++) {
      const item = sale.items[i];
      const productSnap = productSnaps[i];

      if (!productSnap.exists) continue;

      const product = productSnap.data()!;
      const currentStock = product.stock ?? 0;

      transaction.update(productRefs[i], {
        stock: currentStock + item.quantity,
      });
    }

    const movementIds = new Set<string>();
    for (const movementDoc of movementsByReceiptSnap.docs) {
      movementIds.add(movementDoc.id);
    }
    for (const movementDoc of movementsBySaleIdSnap.docs) {
      movementIds.add(movementDoc.id);
    }
    for (const movementId of movementIds) {
      transaction.delete(db.collection('stockMovements').doc(movementId));
    }

    if (customerRef && customerSnap?.exists) {
      const customer = customerSnap.data()!;
      const loyaltyReversal = Math.floor(sale.totalAmount / 10000);
      const updates: Record<string, unknown> = {
        totalSpent: Math.max(0, (customer.totalSpent ?? 0) - sale.totalAmount),
        loyaltyPoints: Math.max(
          0,
          (customer.loyaltyPoints ?? 0) - loyaltyReversal
        ),
      };

      if (sale.paymentMethod === 'credit') {
        updates.outstandingBalance = Math.max(
          0,
          (customer.outstandingBalance ?? 0) - sale.totalAmount
        );
      }

      transaction.update(customerRef, updates);
    }

    transaction.delete(saleRef);
  });
}

export async function refundOrCancelSale(
  saleId: string,
  action: 'refunded',
  performedBy: string
) {
  const db = getAdminFirestore();
  const Timestamp = getAdminTimestamp();

  await db.runTransaction(async (transaction) => {
    const saleRef = db.collection('sales').doc(saleId);
    const saleSnap = await transaction.get(saleRef);

    if (!saleSnap.exists) {
      throw new Error('Sale not found');
    }

    const sale = saleSnap.data() as Omit<Sale, 'id'>;

    if (sale.status !== 'completed') {
      throw new Error(`Sale is already ${sale.status}`);
    }

    const productRefs = sale.items.map((item) =>
      db.collection('products').doc(item.productId)
    );
    const productSnaps = await Promise.all(
      productRefs.map((ref) => transaction.get(ref))
    );

    const customerRef = sale.customerId
      ? db.collection('customers').doc(sale.customerId)
      : null;
    const customerSnap = customerRef
      ? await transaction.get(customerRef)
      : null;

    for (let i = 0; i < sale.items.length; i++) {
      const item = sale.items[i];
      const productSnap = productSnaps[i];

      if (!productSnap.exists) continue;

      const product = productSnap.data()!;
      const currentStock = product.stock ?? 0;
      const newStock = currentStock + item.quantity;

      transaction.update(productRefs[i], { stock: newStock });

      const movementRef = db.collection('stockMovements').doc();
      transaction.set(movementRef, {
        productId: item.productId,
        productName: product.name,
        type: 'return',
        quantityChange: item.quantity,
        resultingStock: newStock,
        referenceType: 'return',
        referenceId: saleId,
        reason: action,
        performedBy,
        createdAt: Timestamp.now(),
      });
    }

    transaction.update(saleRef, { status: action });

    if (customerRef && customerSnap?.exists) {
      const customer = customerSnap.data()!;
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
}

export async function generateProductBarcode(): Promise<string> {
  const maxSequence = await getMaxBarcodeSequence();
  return getNextBarcodeSequence(async () => maxSequence);
}
