import { isOnline } from './connectivity';
import {
  getCachedProductImage,
  setCachedProductImage,
} from './local-store';

const inflight = new Map<string, Promise<string | null>>();
const objectUrls = new Map<string, string>();

function normalizeUrl(url: string | undefined | null): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return trimmed;
  return trimmed;
}

/** Return a displayable image URL, preferring a locally cached blob when offline. */
export async function resolveProductImageSrc(
  productId: string,
  sourceUrl: string | undefined | null
): Promise<string | null> {
  const url = normalizeUrl(sourceUrl);
  if (!url) return null;
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;

  const cached = await getCachedProductImage(productId);
  const preferCache =
    url.startsWith('offline-pending:') ||
    cached?.sourceUrl === url ||
    Boolean(cached?.sourceUrl?.startsWith('offline-pending:'));

  if (cached?.blob && preferCache) {
    const existing = objectUrls.get(productId);
    if (existing) return existing;
    const objectUrl = URL.createObjectURL(cached.blob);
    objectUrls.set(productId, objectUrl);
    return objectUrl;
  }

  if (!isOnline() || url.startsWith('offline-pending:')) {
    // Stale cache still better than a broken remote URL offline
    if (cached?.blob) {
      const existing = objectUrls.get(productId);
      if (existing) return existing;
      const objectUrl = URL.createObjectURL(cached.blob);
      objectUrls.set(productId, objectUrl);
      return objectUrl;
    }
    return null;
  }

  return url;
}

export async function cacheProductImage(
  productId: string,
  sourceUrl: string
): Promise<boolean> {
  const url = normalizeUrl(sourceUrl);
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return false;
  if (!isOnline()) return false;

  const existing = await getCachedProductImage(productId);
  if (existing?.sourceUrl === url && existing.blob.size > 0) return true;

  const key = `${productId}::${url}`;
  const pending = inflight.get(key);
  if (pending) {
    await pending;
    return true;
  }

  const task = (async (): Promise<string | null> => {
    try {
      const response = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        cache: 'force-cache',
      });
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!blob.type.startsWith('image/') && blob.size === 0) return null;

      await setCachedProductImage({
        productId,
        sourceUrl: url,
        blob,
        cachedAt: Date.now(),
      });

      const previous = objectUrls.get(productId);
      if (previous) URL.revokeObjectURL(previous);
      objectUrls.set(productId, URL.createObjectURL(blob));
      return url;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, task);
  return Boolean(await task);
}

/** Prefetch product images into IndexedDB while online (used by offline warm). */
export async function prefetchProductImages(
  products: Array<{ id: string; image?: string }>
): Promise<void> {
  if (!isOnline()) return;

  const queue = products.filter((p) => p.id && normalizeUrl(p.image));
  const concurrency = 4;
  let index = 0;

  async function worker() {
    while (index < queue.length) {
      const current = queue[index++];
      if (!current?.image) continue;
      await cacheProductImage(current.id, current.image);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, () => worker())
  );
}
