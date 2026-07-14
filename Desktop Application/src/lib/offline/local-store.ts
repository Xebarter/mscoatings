const DB_NAME = 'ms-coatings-offline';
const DB_VERSION = 2;
const STORE = 'snapshots';
const IMAGES_STORE = 'productImages';

export type SnapshotKey =
  | 'products'
  | 'orders'
  | 'sales'
  | 'stockMovements'
  | 'fieldAgents'
  | 'fieldPicks'
  | 'customers'
  | 'contactMessages'
  | 'staff'
  | 'session'
  | 'reportCache'
  | 'meta';

export interface CachedProductImage {
  productId: string;
  sourceUrl: string;
  blob: Blob;
  cachedAt: number;
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

export async function localSet<T>(key: SnapshotKey, value: T): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn('Failed to write offline snapshot:', key, error);
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

export type OfflineAccessStatus = 'super_admin' | 'staff' | 'pending';

export interface OfflineSession {
  email: string;
  uid: string;
  displayName?: string;
  savedAt: number;
  /** Cached access so staff can keep working after reconnect without a staff doc hit. */
  accessStatus?: OfflineAccessStatus;
  role?: import('../types').StaffRole;
  isSuperAdmin?: boolean;
  active?: boolean;
}

export interface OfflineMeta {
  lastSyncedAt: number | null;
  pendingWrites: number;
}
