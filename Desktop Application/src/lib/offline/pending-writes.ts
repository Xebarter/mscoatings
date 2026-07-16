import { Timestamp } from 'firebase/firestore';
import { localGet, localSetStrict, type SnapshotKey } from './local-store';

export type PendingSaleCreate = {
  id: string;
  kind: 'sale.create';
  createdAt: number;
  sale: Record<string, unknown>;
  stockUpdates: Array<{ productId: string; stock: number }>;
  movements: Array<Record<string, unknown>>;
  attempts?: number;
  lastError?: string | null;
  lastAttemptAt?: number;
};

export type PendingSaleVoid = {
  id: string;
  kind: 'sale.void';
  createdAt: number;
  saleId: string;
  stockUpdates: Array<{ productId: string; stock: number }>;
  movementIds: string[];
  attempts?: number;
  lastError?: string | null;
  lastAttemptAt?: number;
};

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
    | 'field.pick.settle'
    | 'field.agent.upsert'
    | 'field.agent.deposit'
    | 'expense.create'
    | 'expense.update'
    | 'expense.delete'
    | 'credit.customer.upsert'
    | 'credit.purchase'
    | 'credit.payment'
    | 'credit.deposit'
    | 'credit.wallet_apply'
    | 'batch';
  createdAt: number;
  ops: PendingDocOp[];
  attempts?: number;
  lastError?: string | null;
  lastAttemptAt?: number;
};

export type PendingImageUpload = {
  id: string;
  kind: 'product.image';
  createdAt: number;
  productId: string;
  contentType: string;
  /** IndexedDB key in pendingImages blob store (preferred). */
  blobId?: string;
  /** Legacy fallback for older queued entries. */
  dataUrl?: string;
  attempts?: number;
  lastError?: string | null;
  lastAttemptAt?: number;
};

export type PendingWrite =
  | PendingSaleCreate
  | PendingSaleVoid
  | PendingBatchWrite
  | PendingImageUpload;

const KEY = 'pendingWrites' as SnapshotKey;

type QueueListener = (count: number) => void;
const queueListeners = new Set<QueueListener>();

function notifyQueue(count: number) {
  for (const listener of queueListeners) {
    listener(count);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('ms-offline-queue', { detail: { count } })
    );
  }
}

export function subscribePendingQueue(listener: QueueListener): () => void {
  queueListeners.add(listener);
  void pendingWriteCount().then(listener);
  return () => {
    queueListeners.delete(listener);
  };
}

export async function listPendingWrites(): Promise<PendingWrite[]> {
  const cached = await localGet<{ items: PendingWrite[] }>(KEY);
  return cached?.items ?? [];
}

async function persistQueue(items: PendingWrite[]): Promise<void> {
  await localSetStrict(KEY, { items, savedAt: Date.now() });
  notifyQueue(items.length);
}

export async function enqueuePendingWrite(entry: PendingWrite): Promise<void> {
  const items = await listPendingWrites();
  const existing = items.find((w) => w.id === entry.id);
  const nextEntry: PendingWrite = {
    ...entry,
    attempts: existing?.attempts ?? entry.attempts ?? 0,
    lastError: existing?.lastError ?? entry.lastError ?? null,
    lastAttemptAt: existing?.lastAttemptAt ?? entry.lastAttemptAt,
  };
  const next = [...items.filter((w) => w.id !== entry.id), nextEntry];
  await persistQueue(next);
}

export async function removePendingWrite(id: string): Promise<void> {
  const items = await listPendingWrites();
  await persistQueue(items.filter((w) => w.id !== id));
}

export async function markPendingAttempt(
  id: string,
  error: string | null
): Promise<void> {
  const items = await listPendingWrites();
  const next = items.map((w) =>
    w.id === id
      ? {
          ...w,
          attempts: (w.attempts ?? 0) + 1,
          lastError: error,
          lastAttemptAt: Date.now(),
        }
      : w
  );
  await persistQueue(next);
}

export async function pendingWriteCount(): Promise<number> {
  return (await listPendingWrites()).length;
}

export function pendingKindLabel(kind: PendingWrite['kind']): string {
  switch (kind) {
    case 'sale.create':
      return 'Sale';
    case 'sale.void':
      return 'Void';
    case 'sale.refund':
      return 'Refund';
    case 'inventory.adjust':
      return 'Stock adjustment';
    case 'order.status':
      return 'Order update';
    case 'product.upsert':
      return 'Product save';
    case 'product.delete':
      return 'Product delete';
    case 'product.image':
      return 'Image upload';
    case 'field.pick.create':
      return 'Field pick';
    case 'field.pick.submit':
      return 'Field report';
    case 'field.pick.settle':
      return 'Field settlement';
    case 'field.agent.upsert':
      return 'Field agent';
    case 'field.agent.deposit':
      return 'Field agent deposit';
    case 'expense.create':
      return 'Expense';
    case 'expense.update':
      return 'Expense update';
    case 'expense.delete':
      return 'Expense delete';
    case 'credit.customer.upsert':
      return 'Credit customer';
    case 'credit.purchase':
      return 'Credit purchase';
    case 'credit.payment':
      return 'Credit payment';
    case 'credit.deposit':
      return 'Credit deposit';
    case 'credit.wallet_apply':
      return 'Wallet applied';
    default:
      return 'Change';
  }
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
    if (v === undefined) continue;
    out[k] = serializeDeep(v);
  }
  return out;
}
