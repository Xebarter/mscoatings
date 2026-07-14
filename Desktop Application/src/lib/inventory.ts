import {
  doc,
  Timestamp,
  collection,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { ensureFirestoreAuthReady, getOfflineSession } from './admin-auth';
import type { StockMovement, StockMovementType, Product } from './types';
import { toFirestoreError, getProductById } from './firestore';
import { isOnline } from './offline/connectivity';
import { getDocHybrid, withTimeout } from './offline/firestore-reads';
import { localGet, localSet } from './offline/local-store';
import { syncDocOps } from './offline/flush-queue';
import { serializeDeep, stampTimestamp } from './offline/pending-writes';
import { logDesktopActivity } from './staff-activity';

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

function getQuantityChange(type: StockMovementType, quantity: number): number {
  const isDecrease =
    type === 'adjustment_remove' || type === 'damaged' || type === 'lost';
  return isDecrease ? -quantity : quantity;
}

async function resolveEmail(): Promise<string> {
  if (auth.currentUser?.email) return auth.currentUser.email.toLowerCase();
  const session = await getOfflineSession();
  if (session?.email) return session.email.toLowerCase();
  throw new Error('You must be signed in to adjust stock.');
}

async function loadProduct(productId: string): Promise<Product> {
  const mirrored = await localGet<{ items: Product[] }>('products');
  const fromMirror = mirrored?.items?.find((p) => p.id === productId);
  if (fromMirror) return fromMirror;

  if (!isOnline()) {
    throw new Error('Product not available offline. Sync the catalog online once.');
  }

  try {
    const snap = await getDocHybrid(doc(db, 'products', productId));
    if (snap.exists()) return { id: snap.id, ...snap.data() } as Product;
  } catch {
    /* fall through */
  }
  const product = await getProductById(productId);
  if (!product) throw new Error('Product not found');
  return product;
}

/**
 * Local-first stock adjustment — IndexedDB first, Firestore queues in background.
 */
export async function adjustStock(input: AdjustStockInput): Promise<number> {
  if (isOnline()) {
    try {
      await withTimeout(ensureFirestoreAuthReady(), 2_000);
    } catch {
      /* continue */
    }
  }

  if (!ADJUSTMENT_TYPES.includes(input.type)) throw new Error('Invalid adjustment type.');
  if (input.quantity <= 0) throw new Error('Quantity must be greater than zero.');

  const quantityChange = getQuantityChange(input.type, input.quantity);
  const performedBy = await resolveEmail();

  try {
    const product = await loadProduct(input.productId);
    const currentStock = product.stock ?? 0;
    const newStock = currentStock + quantityChange;
    if (newStock < 0) throw new Error('Insufficient stock for this adjustment.');

    const createdAt = Timestamp.now();
    const movementRef = doc(collection(db, 'stockMovements'));
    const movement: StockMovement = {
      id: movementRef.id,
      productId: input.productId,
      productName: product.name,
      type: input.type,
      quantityChange,
      resultingStock: newStock,
      reason: input.reason,
      performedBy,
      createdAt,
    };

    const productsCache = await localGet<{ items: Product[]; savedAt: number }>('products');
    if (productsCache?.items) {
      await localSet('products', {
        items: productsCache.items.map((p) =>
          p.id === input.productId ? { ...p, stock: newStock } : p
        ),
        savedAt: Date.now(),
      });
    }

    const movementsCache = await localGet<{ items: StockMovement[]; savedAt: number }>(
      'stockMovements'
    );
    await localSet('stockMovements', {
      items: [
        {
          ...movement,
          createdAt: stampTimestamp(createdAt) as unknown as StockMovement['createdAt'],
        },
        ...(movementsCache?.items ?? []),
      ].slice(0, 200),
      savedAt: Date.now(),
    });

    const { id: movementId, ...movementData } = movement;
    await syncDocOps({
      id: `inventory-adjust-${movementId}`,
      kind: 'inventory.adjust',
      ops: [
        {
          op: 'set',
          collection: 'products',
          docId: input.productId,
          data: { stock: newStock },
          merge: true,
        },
        {
          op: 'set',
          collection: 'stockMovements',
          docId: movementId,
          data: serializeDeep({
            ...movementData,
            createdAt: stampTimestamp(createdAt),
          }) as Record<string, unknown>,
        },
      ],
    });

    logDesktopActivity({
      action: 'inventory.adjust',
      summary: `Stock ${input.type.replace(/_/g, ' ')} · ${movement.productName} (${input.quantity})`,
      resourceType: 'stockMovement',
      resourceId: movementId,
      metrics: {
        productId: input.productId,
        productName: movement.productName,
        type: input.type,
        quantity: input.quantity,
        quantityChange: movement.quantityChange,
        resultingStock: newStock,
      },
    });

    return newStock;
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export const ADJUSTMENT_OPTIONS: { value: StockMovementType; label: string }[] = [
  { value: 'adjustment_add', label: 'Add Stock' },
  { value: 'adjustment_remove', label: 'Remove Stock' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'lost', label: 'Lost / Missing' },
];
