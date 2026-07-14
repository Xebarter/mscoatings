import type { StockMovement, StockMovementType } from '@/lib/erp-types';
import { getAdminFirestore, getAdminTimestamp } from '@/lib/firebase-admin';

interface StockLineItem {
  productId: string;
  quantity: number;
}

export async function decrementStockForOrder(
  orderId: string,
  items: StockLineItem[],
  performedBy: string
) {
  const db = getAdminFirestore();
  const Timestamp = getAdminTimestamp();

  await db.runTransaction(async (transaction) => {
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) {
      throw new Error('Order not found');
    }

    const orderData = orderSnap.data();
    if (orderData?.stockDeducted) {
      return;
    }

    const productRefs = items.map((item) =>
      db.collection('products').doc(item.productId)
    );
    const productSnaps = await Promise.all(
      productRefs.map((ref) => transaction.get(ref))
    );

    const stockUpdates: Array<{
      ref: FirebaseFirestore.DocumentReference;
      productName: string;
      productId: string;
      newStock: number;
      quantity: number;
    }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const productSnap = productSnaps[i];

      if (!productSnap.exists) {
        throw new Error(`Product ${item.productId} not found`);
      }

      const product = productSnap.data()!;
      const currentStock = product.stock ?? 0;

      stockUpdates.push({
        ref: productRefs[i],
        productName: product.name,
        productId: item.productId,
        newStock: Math.max(0, currentStock - item.quantity),
        quantity: item.quantity,
      });
    }

    for (const update of stockUpdates) {
      transaction.update(update.ref, { stock: update.newStock });

      const movementRef = db.collection('stockMovements').doc();
      transaction.set(movementRef, {
        productId: update.productId,
        productName: update.productName,
        type: 'sale',
        quantityChange: -update.quantity,
        resultingStock: update.newStock,
        referenceType: 'order',
        referenceId: orderId,
        performedBy,
        createdAt: Timestamp.now(),
      });
    }

    transaction.update(orderRef, { stockDeducted: true });
  });
}

export async function adjustStock(input: {
  productId: string;
  type: StockMovementType;
  quantity: number;
  reason: string;
  performedBy: string;
}) {
  const db = getAdminFirestore();
  const Timestamp = getAdminTimestamp();

  if (input.quantity <= 0) {
    throw new Error('Quantity must be greater than zero.');
  }

  const isDecrease =
    input.type === 'sale' ||
    input.type === 'adjustment_remove' ||
    input.type === 'damaged' ||
    input.type === 'lost';

  const quantityChange = isDecrease ? -input.quantity : input.quantity;

  return db.runTransaction(async (transaction) => {
    const productRef = db.collection('products').doc(input.productId);
    const productSnap = await transaction.get(productRef);

    if (!productSnap.exists) {
      throw new Error('Product not found');
    }

    const product = productSnap.data()!;
    const currentStock = product.stock ?? 0;
    const newStock = currentStock + quantityChange;

    if (newStock < 0) {
      throw new Error(`Insufficient stock. Available: ${currentStock}`);
    }

    transaction.update(productRef, { stock: newStock });

    const movementRef = db.collection('stockMovements').doc();
    transaction.set(movementRef, {
      productId: input.productId,
      productName: product.name,
      type: input.type,
      quantityChange,
      resultingStock: newStock,
      referenceType: 'adjustment',
      reason: input.reason,
      performedBy: input.performedBy,
      createdAt: Timestamp.now(),
    });

    return {
      movementId: movementRef.id,
      resultingStock: newStock,
    };
  });
}

export async function listStockMovements(options?: {
  productId?: string;
  limit?: number;
}): Promise<StockMovement[]> {
  const db = getAdminFirestore();
  let query: FirebaseFirestore.Query = db
    .collection('stockMovements')
    .orderBy('createdAt', 'desc');

  if (options?.productId) {
    query = query.where('productId', '==', options.productId);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  } else {
    query = query.limit(200);
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<StockMovement, 'id'>),
  }));
}

export async function getMaxBarcodeSequence(): Promise<number> {
  const db = getAdminFirestore();
  const snapshot = await db.collection('products').select('barcode').get();

  let max = 0;
  snapshot.docs.forEach((doc) => {
    const barcode = doc.data().barcode as string | undefined;
    if (!barcode?.startsWith('MSC')) return;
    const sequence = parseInt(barcode.slice(3), 10);
    if (!Number.isNaN(sequence) && sequence > max) {
      max = sequence;
    }
  });

  return max;
}
