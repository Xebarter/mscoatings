import { doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ensureFirestoreAuthReady } from '@/lib/admin-auth';
import { isOnline } from './connectivity';
import { withTimeout } from './firestore-reads';
import {
  enqueuePendingWrite,
  listPendingWrites,
  markPendingAttempt,
  removePendingWrite,
  reviveDeep,
  serializeDeep,
  type PendingBatchWrite,
  type PendingDocOp,
  type PendingImageUpload,
  type PendingWrite,
} from './pending-writes';

/** Per-entry commit during background flush — long enough for reconnect handshake. */
const FLUSH_COMMIT_MS = 20_000;
/** Fast path when the user is already online (interactive save). */
const LIVE_COMMIT_MS = 4_000;
const MAX_ATTEMPTS_BEFORE_BACKOFF = 3;
const BACKOFF_BASE_MS = 15_000;
const BACKOFF_MAX_MS = 5 * 60_000;

export type FlushResult = {
  flushed: number;
  failed: number;
  skipped: number;
  remaining: number;
  errors: Array<{ id: string; kind: string; error: string }>;
};

function backoffMs(attempts: number): number {
  const exp = Math.min(
    BACKOFF_MAX_MS,
    BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - MAX_ATTEMPTS_BEFORE_BACKOFF)
  );
  return exp;
}

function shouldSkipForBackoff(entry: PendingWrite): boolean {
  const attempts = entry.attempts ?? 0;
  if (attempts < MAX_ATTEMPTS_BEFORE_BACKOFF) return false;
  const last = entry.lastAttemptAt ?? 0;
  return Date.now() - last < backoffMs(attempts);
}

export async function applyDocOps(
  ops: PendingDocOp[],
  timeoutMs = LIVE_COMMIT_MS
): Promise<void> {
  if (!ops.length) return;
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
  await withTimeout(batch.commit(), timeoutMs, 'Firestore commit timed out');
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

  // Always enqueue first so a crash mid-commit cannot lose the mutation.
  await enqueuePendingWrite(pending);

  if (!isOnline()) {
    // Do NOT attempt Firestore while we believe we're offline — hanging RPCs
    // poison the flush loop. App-level gating only (we never disableNetwork).
    const { requestSync } = await import('./sync');
    requestSync('queued-offline');
    return;
  }

  try {
    await applyDocOps(pending.ops, LIVE_COMMIT_MS);
    await removePendingWrite(pending.id);
  } catch (error) {
    await markPendingAttempt(
      pending.id,
      error instanceof Error ? error.message : 'Commit failed'
    );
    const { requestSync } = await import('./sync');
    requestSync('retry-after-live-fail', 3_000);
  }
}

export async function enqueueImageUpload(
  entry: Omit<PendingImageUpload, 'kind' | 'createdAt'> & { blob?: Blob }
) {
  const {
    countPendingImageBlobs,
    putPendingImageBlob,
    setCachedProductImage,
  } = await import('./local-store');
  const { canQueueOfflineImage } = await import('./health');

  const pendingImages = await countPendingImageBlobs();
  if (!canQueueOfflineImage(pendingImages) && entry.blob) {
    throw new Error(
      'Offline image queue is full. Sync online before adding more product photos.'
    );
  }

  const blobId = entry.blobId ?? entry.id;
  if (entry.blob) {
    await putPendingImageBlob({
      id: blobId,
      productId: entry.productId,
      contentType: entry.contentType,
      blob: entry.blob,
      savedAt: Date.now(),
    });
    // Also warm display cache so ProductThumb can show the photo offline.
    await setCachedProductImage({
      productId: entry.productId,
      sourceUrl: `offline-pending://${entry.productId}`,
      blob: entry.blob,
      cachedAt: Date.now(),
    });
  }

  const pending: PendingImageUpload = {
    id: entry.id,
    productId: entry.productId,
    contentType: entry.contentType,
    blobId,
    // Only keep tiny legacy dataUrl if provided without blob
    ...(entry.dataUrl && !entry.blob ? { dataUrl: entry.dataUrl } : {}),
    kind: 'product.image',
    createdAt: Date.now(),
  };
  await enqueuePendingWrite(pending);
  const { requestSync } = await import('./sync');
  requestSync(isOnline() ? 'image-queued-online' : 'image-queued-offline');
}

async function flushSaleKinds(entry: PendingWrite): Promise<void> {
  if (entry.kind !== 'sale.create' && entry.kind !== 'sale.void') {
    throw new Error(`Not a sale entry: ${entry.kind}`);
  }
  const { flushOnePendingSale } = await import('@/lib/sales');
  await flushOnePendingSale(entry);
}

async function flushImage(entry: PendingImageUpload): Promise<void> {
  const { uploadProductImageBlob, uploadProductImageFromDataUrl } = await import(
    '@/lib/storage'
  );
  const { updateDoc, doc: fsDoc } = await import('firebase/firestore');
  const {
    getPendingImageBlob,
    removePendingImageBlob,
    localGet,
    localSet,
    setCachedProductImage,
  } = await import('./local-store');

  let url: string;
  const blobRecord = entry.blobId
    ? await getPendingImageBlob(entry.blobId)
    : null;

  if (blobRecord?.blob) {
    url = await withTimeout(
      uploadProductImageBlob(
        blobRecord.blob,
        entry.contentType || blobRecord.contentType,
        entry.productId
      ),
      FLUSH_COMMIT_MS,
      'Image upload timed out'
    );
  } else if (entry.dataUrl) {
    url = await withTimeout(
      uploadProductImageFromDataUrl(
        entry.dataUrl,
        entry.contentType,
        entry.productId
      ),
      FLUSH_COMMIT_MS,
      'Image upload timed out'
    );
  } else {
    throw new Error('Pending image blob missing — re-save the product photo online');
  }

  await withTimeout(
    updateDoc(fsDoc(db, 'products', entry.productId), { image: url }),
    FLUSH_COMMIT_MS
  );

  const cached = await localGet<{ items: Array<{ id: string; image?: string }> }>(
    'products'
  );
  if (cached?.items) {
    await localSet('products', {
      items: cached.items.map((p) =>
        p.id === entry.productId ? { ...p, image: url } : p
      ),
      savedAt: Date.now(),
    });
  }

  if (blobRecord?.blob) {
    await setCachedProductImage({
      productId: entry.productId,
      sourceUrl: url,
      blob: blobRecord.blob,
      cachedAt: Date.now(),
    });
  }
  if (entry.blobId) await removePendingImageBlob(entry.blobId);
  await removePendingWrite(entry.id);
}

/** Flush the whole offline mutation queue after reconnect. Never aborts the whole queue on one failure. */
export async function flushPendingQueue(): Promise<FlushResult> {
  const empty: FlushResult = {
    flushed: 0,
    failed: 0,
    skipped: 0,
    remaining: 0,
    errors: [],
  };

  if (!isOnline()) {
    empty.remaining = (await listPendingWrites()).length;
    return empty;
  }

  try {
    await withTimeout(ensureFirestoreAuthReady(), 8_000, 'Auth not ready for sync');
  } catch (error) {
    empty.remaining = (await listPendingWrites()).length;
    empty.failed = empty.remaining;
    empty.errors.push({
      id: 'auth',
      kind: 'auth',
      error: error instanceof Error ? error.message : 'Auth failed',
    });
    return empty;
  }

  const queue = await listPendingWrites();
  let flushed = 0;
  let failed = 0;
  let skipped = 0;
  const errors: FlushResult['errors'] = [];

  for (const entry of queue) {
    if (shouldSkipForBackoff(entry)) {
      skipped += 1;
      continue;
    }

    try {
      if (entry.kind === 'sale.create' || entry.kind === 'sale.void') {
        await flushSaleKinds(entry);
        flushed += 1;
        continue;
      }

      if (entry.kind === 'product.image') {
        await flushImage(entry as PendingImageUpload);
        flushed += 1;
        continue;
      }

      if (!('ops' in entry) || !entry.ops?.length) {
        await removePendingWrite(entry.id);
        flushed += 1;
        continue;
      }

      await applyDocOps(entry.ops, FLUSH_COMMIT_MS);
      await removePendingWrite(entry.id);
      flushed += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : 'Sync failed';
      await markPendingAttempt(entry.id, message);
      errors.push({ id: entry.id, kind: entry.kind, error: message });
      console.warn('[sync] Failed pending write', entry.id, entry.kind, error);
      // Continue — one bad entry must not block the rest of the queue.
    }
  }

  const remaining = (await listPendingWrites()).length;
  return { flushed, failed, skipped, remaining, errors };
}
