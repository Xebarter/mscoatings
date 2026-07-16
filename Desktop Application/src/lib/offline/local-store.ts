const DB_NAME = 'ms-coatings-offline';
/** v3: pending product-image blobs for offline capture → upload on reconnect. */
const DB_VERSION = 3;
const STORE = 'snapshots';
const IMAGES_STORE = 'productImages';
const PENDING_IMAGES_STORE = 'pendingImages';

export type SnapshotKey =
  | 'products'
  | 'orders'
  | 'sales'
  | 'stockMovements'
  | 'fieldAgents'
  | 'fieldPicks'
  | 'fieldAgentTransactions'
  | 'expenses'
  | 'creditCustomers'
  | 'creditPurchases'
  | 'creditTransactions'
  | 'customers'
  | 'contactMessages'
  | 'staff'
  | 'session'
  | 'reportCache'
  | 'meta'
  | 'pendingWrites';

export interface CachedProductImage {
  productId: string;
  sourceUrl: string;
  blob: Blob;
  cachedAt: number;
}

export interface PendingImageBlob {
  id: string;
  productId: string;
  contentType: string;
  blob: Blob;
  savedAt: number;
}

export class OfflineStorageError extends Error {
  constructor(
    message: string,
    public readonly code: 'quota' | 'write_failed' | 'unavailable'
  ) {
    super(message);
    this.name = 'OfflineStorageError';
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        db.createObjectStore(IMAGES_STORE, { keyPath: 'productId' });
      }
      if (!db.objectStoreNames.contains(PENDING_IMAGES_STORE)) {
        db.createObjectStore(PENDING_IMAGES_STORE, { keyPath: 'id' });
      }
    };
  });
}

export async function localGet<T>(key: SnapshotKey): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/** Best-effort snapshot write (mirrors, cache). Does not throw. */
export async function localSet<T>(key: SnapshotKey, value: T): Promise<void> {
  try {
    await localSetStrict(key, value);
  } catch (error) {
    console.warn('Failed to write offline snapshot:', key, error);
  }
}

/** Strict write — throws OfflineStorageError on quota / failure (use for pending queue). */
export async function localSetStrict<T>(key: SnapshotKey, value: T): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const quota =
      (error instanceof DOMException && error.name === 'QuotaExceededError') ||
      /quota|storage/i.test(message);
    throw new OfflineStorageError(
      quota
        ? 'Device storage is full. Sync or free space before continuing offline.'
        : `Failed to save offline data (${key}).`,
      quota ? 'quota' : 'write_failed'
    );
  }
}

export async function localRemove(key: SnapshotKey): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export async function getCachedProductImage(
  productId: string
): Promise<CachedProductImage | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IMAGES_STORE, 'readonly');
      const req = tx.objectStore(IMAGES_STORE).get(productId);
      req.onsuccess = () => resolve((req.result as CachedProductImage) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function setCachedProductImage(
  entry: CachedProductImage
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IMAGES_STORE, 'readwrite');
      tx.objectStore(IMAGES_STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn('Failed to cache product image:', entry.productId, error);
  }
}

export async function putPendingImageBlob(entry: PendingImageBlob): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PENDING_IMAGES_STORE, 'readwrite');
      tx.objectStore(PENDING_IMAGES_STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const quota =
      (error instanceof DOMException && error.name === 'QuotaExceededError') ||
      /quota|storage/i.test(message);
    throw new OfflineStorageError(
      quota
        ? 'Device storage is full. Cannot queue more offline images.'
        : 'Failed to store offline product image.',
      quota ? 'quota' : 'write_failed'
    );
  }
}

export async function getPendingImageBlob(
  id: string
): Promise<PendingImageBlob | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PENDING_IMAGES_STORE, 'readonly');
      const req = tx.objectStore(PENDING_IMAGES_STORE).get(id);
      req.onsuccess = () => resolve((req.result as PendingImageBlob) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function removePendingImageBlob(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PENDING_IMAGES_STORE, 'readwrite');
      tx.objectStore(PENDING_IMAGES_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export async function countPendingImageBlobs(): Promise<number> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PENDING_IMAGES_STORE, 'readonly');
      const req = tx.objectStore(PENDING_IMAGES_STORE).count();
      req.onsuccess = () => resolve(Number(req.result) || 0);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

export type StorageEstimate = {
  usageBytes: number | null;
  quotaBytes: number | null;
  freeBytes: number | null;
  freeMb: number | null;
  usagePct: number | null;
};

export async function estimateStorage(): Promise<StorageEstimate> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
      return {
        usageBytes: null,
        quotaBytes: null,
        freeBytes: null,
        freeMb: null,
        usagePct: null,
      };
    }
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const free = quota > 0 ? Math.max(0, quota - usage) : null;
    return {
      usageBytes: usage,
      quotaBytes: quota || null,
      freeBytes: free,
      freeMb: free != null ? free / (1024 * 1024) : null,
      usagePct: quota > 0 ? (usage / quota) * 100 : null,
    };
  } catch {
    return {
      usageBytes: null,
      quotaBytes: null,
      freeBytes: null,
      freeMb: null,
      usagePct: null,
    };
  }
}

export type OfflineAccessStatus = 'super_admin' | 'staff' | 'pending';

export interface OfflineSession {
  email: string;
  uid: string;
  displayName?: string;
  savedAt: number;
  accessStatus?: OfflineAccessStatus;
  role?: import('../types').StaffRole;
  isSuperAdmin?: boolean;
  active?: boolean;
}

export interface OfflineMeta {
  lastSyncedAt: number | null;
  pendingWrites: number;
}
