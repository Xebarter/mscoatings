import { doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ensureFirestoreAuthReady } from '@/lib/admin-auth';
import { isOnline } from './connectivity';
import { withTimeout } from './firestore-reads';
import {
  enqueuePendingWrite,
  listPendingWrites,
  removePendingWrite,
  reviveDeep,
  serializeDeep,
  type PendingBatchWrite,
  type PendingDocOp,
  type PendingImageUpload,
  type PendingWrite,
} from './pending-writes';

const COMMIT_MS = 2_500;

export async function applyDocOps(ops: PendingDocOp[]): Promise<void> {
  const batch = writeBatch(db);
  for (const op of ops) {
    const ref = doc(db, op.collection, op.docId);
    if (op.op === 'delete') {
      batch.delete(ref);
    } else {
      const data = reviveDeep(op.data) as Record<string, unknown>;
      batch.set(ref, data, { merge: op.merge ?? false });
    }
  }
  await withTimeout(batch.commit(), COMMIT_MS, 'Firestore commit timed out');
}

/**
 * Local-first Firestore sync: never block the UI on a dead network.
 * Caller must already have updated IndexedDB mirrors.
 */
export async function syncDocOps(args: {
  id: string;
  kind: PendingBatchWrite['kind'];
  ops: PendingDocOp[];
}): Promise<void> {
  const pending: PendingBatchWrite = {
    id: args.id,
    kind: args.kind,
    createdAt: Date.now(),
    ops: serializeDeep(args.ops) as PendingDocOp[],
  };

  const tryCommit = async () => {
    await applyDocOps(pending.ops);
    await removePendingWrite(pending.id);
  };

  if (!isOnline()) {
    await enqueuePendingWrite(pending);
    void tryCommit().catch(() => undefined);
    return;
  }

  try {
    await tryCommit();
  } catch {
    await enqueuePendingWrite(pending);
  }
}

export async function enqueueImageUpload(entry: Omit<PendingImageUpload, 'kind' | 'createdAt'>) {
  const pending: PendingImageUpload = {
    ...entry,
    kind: 'product.image',
    createdAt: Date.now(),
  };
  await enqueuePendingWrite(pending);
}

async function flushSaleKinds(entry: PendingWrite): Promise<boolean> {
  if (entry.kind !== 'sale.create' && entry.kind !== 'sale.void') return false;

  // Lazy import avoids circular init with sales.ts
  const { flushOnePendingSale } = await import('@/lib/sales');
  await flushOnePendingSale(entry);
  return true;
}

async function flushImage(entry: PendingImageUpload): Promise<void> {
  const { uploadProductImageFromDataUrl } = await import('@/lib/storage');
  const { updateDoc, doc: fsDoc } = await import('firebase/firestore');
  const url = await uploadProductImageFromDataUrl(
    entry.dataUrl,
    entry.contentType,
    entry.productId
  );
  await withTimeout(
    updateDoc(fsDoc(db, 'products', entry.productId), { image: url }),
    COMMIT_MS
  );

  const { localGet, localSet } = await import('./local-store');
  const cached = await localGet<{ items: Array<{ id: string; image?: string }> }>('products');
  if (cached?.items) {
    await localSet('products', {
      items: cached.items.map((p) =>
        p.id === entry.productId ? { ...p, image: url } : p
      ),
      savedAt: Date.now(),
    });
  }

  await removePendingWrite(entry.id);
}

/** Flush the whole offline mutation queue after reconnect. */
export async function flushPendingQueue(): Promise<number> {
  if (!isOnline()) return 0;
  try {
    await ensureFirestoreAuthReady();
  } catch {
    return 0;
  }

  const queue = await listPendingWrites();
  let flushed = 0;

  for (const entry of queue) {
    try {
      if (entry.kind === 'sale.create' || entry.kind === 'sale.void') {
        const handled = await flushSaleKinds(entry);
        if (handled) flushed += 1;
        continue;
      }

      if (entry.kind === 'product.image') {
        await flushImage(entry as PendingImageUpload);
        flushed += 1;
        continue;
      }

      await applyDocOps(entry.ops);
      await removePendingWrite(entry.id);
      flushed += 1;
    } catch (error) {
      console.warn('Failed to flush pending write', entry.id, error);
      break;
    }
  }

  return flushed;
}
