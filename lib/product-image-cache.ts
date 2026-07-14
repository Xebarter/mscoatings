'use client';

const DB_NAME = 'ms-coatings-product-images';
const DB_VERSION = 1;
const STORE = 'images';

interface CachedImage {
  id: string;
  sourceUrl: string;
  blob: Blob;
  cachedAt: number;
}

const inflight = new Map<string, Promise<boolean>>();
const objectUrls = new Map<string, string>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
  });
}

function cacheId(productId: string | undefined, sourceUrl: string): string {
  return productId?.trim() || sourceUrl;
}

async function getCached(id: string): Promise<CachedImage | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve((req.result as CachedImage) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function setCached(entry: CachedImage): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn('Failed to cache product image:', entry.id, error);
  }
}

function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

/** Prefer a blob URL from IndexedDB so images still render offline after first visit. */
export async function resolveCachedProductImageSrc(
  sourceUrl: string | undefined | null,
  productId?: string
): Promise<string | null> {
  const url = sourceUrl?.trim();
  if (!url) return null;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;

  const id = cacheId(productId, url);
  const cached = await getCached(id);

  if (cached?.blob && (cached.sourceUrl === url || !isBrowserOnline())) {
    const existing = objectUrls.get(id);
    if (existing) return existing;
    const objectUrl = URL.createObjectURL(cached.blob);
    objectUrls.set(id, objectUrl);
    return objectUrl;
  }

  if (!isBrowserOnline()) return cached?.blob
    ? (() => {
        const existing = objectUrls.get(id);
        if (existing) return existing;
        const objectUrl = URL.createObjectURL(cached.blob);
        objectUrls.set(id, objectUrl);
        return objectUrl;
      })()
    : null;

  return url;
}

export async function cacheProductImageFromUrl(
  sourceUrl: string,
  productId?: string
): Promise<boolean> {
  const url = sourceUrl?.trim();
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return false;
  if (!isBrowserOnline()) return false;

  const id = cacheId(productId, url);
  const existing = await getCached(id);
  if (existing?.sourceUrl === url && existing.blob.size > 0) return true;

  const key = `${id}::${url}`;
  if (inflight.has(key)) {
    return inflight.get(key)!;
  }

  const task = (async () => {
    try {
      const response = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        cache: 'force-cache',
      });
      if (!response.ok) return false;
      const blob = await response.blob();
      if (blob.size === 0) return false;

      await setCached({
        id,
        sourceUrl: url,
        blob,
        cachedAt: Date.now(),
      });

      const previous = objectUrls.get(id);
      if (previous) URL.revokeObjectURL(previous);
      objectUrls.set(id, URL.createObjectURL(blob));
      return true;
    } catch {
      return false;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, task);
  return task;
}

/** Warm product image cache while the user is online. */
export async function prefetchProductImages(
  products: Array<{ id?: string; image?: string | null }>
): Promise<void> {
  if (!isBrowserOnline()) return;

  const queue = products.filter((p) => p.image?.trim());
  const concurrency = 4;
  let index = 0;

  async function worker() {
    while (index < queue.length) {
      const current = queue[index++];
      if (!current?.image) continue;
      await cacheProductImageFromUrl(current.image, current.id);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, () => worker())
  );
}
