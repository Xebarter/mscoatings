import { Timestamp } from 'firebase/firestore';
import { localGet, localSet, type SnapshotKey } from './local-store';

export type PendingSaleCreate = {
  id: string;
  kind: 'sale.create';
  createdAt: number;
  sale: Record<string, unknown>;
  stockUpdates: Array<{ productId: string; stock: number }>;
  movements: Array<Record<string, unknown>>;
};

export type PendingSaleVoid = {
  id: string;
  kind: 'sale.void';
  createdAt: number;
  saleId: string;
  stockUpdates: Array<{ productId: string; stock: number }>;
  movementIds: string[];
};

/** Generic Firestore batch ops (set/delete) for inventory, orders, field sales, products, refunds. */
export type PendingDocOp =
  | {
      op: 'set';
      collection: string;
      docId: string;
      data: Record<string, unknown>;
      merge?: boolean;
    }
  | {
      op: 'delete';
      collection: string;
      docId: string;
    };

export type PendingBatchWrite = {
  id: string;
  kind:
    | 'sale.refund'
    | 'inventory.adjust'
    | 'order.status'
    | 'product.upsert'
    | 'product.delete'
    | 'field.pick.create'
    | 'field.pick.submit'
    | 'field.agent.upsert'
    | 'batch';
  createdAt: number;
  ops: PendingDocOp[];
};

export type PendingImageUpload = {
  id: string;
  kind: 'product.image';
  createdAt: number;
  productId: string;
  dataUrl: string;
  contentType: string;
};

export type PendingWrite =
  | PendingSaleCreate
  | PendingSaleVoid
  | PendingBatchWrite
  | PendingImageUpload;

const KEY = 'pendingWrites' as SnapshotKey;

export async function listPendingWrites(): Promise<PendingWrite[]> {
  const cached = await localGet<{ items: PendingWrite[] }>(KEY);
  return cached?.items ?? [];
}

export async function enqueuePendingWrite(entry: PendingWrite): Promise<void> {
  const items = await listPendingWrites();
  // Replace same id if re-queued
  const next = [...items.filter((w) => w.id !== entry.id), entry];
  await localSet(KEY, { items: next, savedAt: Date.now() });
}

export async function removePendingWrite(id: string): Promise<void> {
  const items = await listPendingWrites();
  await localSet(KEY, {
    items: items.filter((w) => w.id !== id),
    savedAt: Date.now(),
  });
}

export async function pendingWriteCount(): Promise<number> {
  return (await listPendingWrites()).length;
}

export function stampTimestamp(ts: Timestamp = Timestamp.now()) {
  return {
    __type: 'timestamp' as const,
    seconds: ts.seconds,
    nanoseconds: ts.nanoseconds,
  };
}

export function reviveDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reviveDeep);
  if (!value || typeof value !== 'object') return value;
  const obj = value as Record<string, unknown>;
  if (obj.__type === 'timestamp' && typeof obj.seconds === 'number') {
    return new Timestamp(obj.seconds, Number(obj.nanoseconds ?? 0));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = reviveDeep(v);
  }
  return out;
}

export function serializeDeep(value: unknown): unknown {
  if (value instanceof Timestamp) {
    return stampTimestamp(value);
  }
  if (
    value &&
    typeof value === 'object' &&
    'seconds' in value &&
    'nanoseconds' in value &&
    typeof (value as { toMillis?: () => number }).toMillis === 'function'
  ) {
    const t = value as { seconds: number; nanoseconds: number };
    return { __type: 'timestamp', seconds: t.seconds, nanoseconds: t.nanoseconds };
  }
  if (Array.isArray(value)) return value.map(serializeDeep);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = serializeDeep(v);
  }
  return out;
}
