import {
  collection,
  doc,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { ensureFirestoreAuthReady } from '@/lib/admin-auth';
import type { StockMovement, StockMovementType } from '@/lib/erp-types';
import { toFirestoreError } from '@/lib/firestore';

const ADJUSTMENT_TYPES: StockMovementType[] = [
  'adjustment_add',
  'adjustment_remove',
  'damaged',
  'lost',
];

export interface AdjustStockInput {
  productId: string;
  type: StockMovementType;
  quantity: number;
  reason?: string;
}

export interface AdjustStockResult {
  movementId: string;
  resultingStock: number;
  movement: StockMovement;
}

export function getAdjustmentQuantityChange(
  type: StockMovementType,
  quantity: number
): number {
  const isDecrease =
    type === 'adjustment_remove' || type === 'damaged' || type === 'lost';
  return isDecrease ? -quantity : quantity;
}

export async function adjustStockClient(
  input: AdjustStockInput
): Promise<AdjustStockResult> {
  const user = auth.currentUser;
  if (!user?.email) {
    await ensureFirestoreAuthReady();
  }

  const email = auth.currentUser?.email;
  if (!email) {
    throw new Error('You must be signed in to adjust stock.');
  }

  if (!ADJUSTMENT_TYPES.includes(input.type)) {
    throw new Error('Invalid adjustment type.');
  }

  if (input.quantity <= 0 || !Number.isInteger(input.quantity)) {
    throw new Error('Quantity must be a whole number greater than zero.');
  }

  const quantityChange = getAdjustmentQuantityChange(
    input.type,
    input.quantity
  );
  const performedBy = email.toLowerCase();

  try {
    return await runTransaction(db, async (transaction) => {
      const productRef = doc(db, 'products', input.productId);
      const productSnap = await transaction.get(productRef);

      if (!productSnap.exists()) {
        throw new Error('Product not found');
      }

      const product = productSnap.data();
      const currentStock = product.stock ?? 0;
      const newStock = currentStock + quantityChange;

      if (newStock < 0) {
        throw new Error(`Insufficient stock. Available: ${currentStock}`);
      }

      const createdAt = Timestamp.now();
      const movementRef = doc(collection(db, 'stockMovements'));

      transaction.update(productRef, { stock: newStock });
      transaction.set(movementRef, {
        productId: input.productId,
        productName: product.name,
        type: input.type,
        quantityChange,
        resultingStock: newStock,
        referenceType: 'adjustment',
        reason: input.reason?.trim() ?? '',
        performedBy,
        createdAt,
      });

      return {
        movementId: movementRef.id,
        resultingStock: newStock,
        movement: {
          id: movementRef.id,
          productId: input.productId,
          productName: product.name,
          type: input.type,
          quantityChange,
          resultingStock: newStock,
          referenceType: 'adjustment',
          reason: input.reason?.trim() ?? '',
          performedBy,
          createdAt,
        },
      };
    });
  } catch (error) {
    throw toFirestoreError(error);
  }
}
