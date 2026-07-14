const DB_NAME = 'ms-coatings-offline';
const DB_VERSION = 1;
const STORE = 'snapshots';

export type SnapshotKey =
  | 'products'
  | 'orders'
  | 'sales'
  | 'stockMovements'
  | 'fieldAgents'
  | 'fieldPicks'
  | 'session'
  | 'reportCache'
  | 'meta';

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

export interface OfflineSession {
  email: string;
  uid: string;
  displayName?: string;
  savedAt: number;
}

export interface OfflineMeta {
  lastSyncedAt: number | null;
  pendingWrites: number;
}
