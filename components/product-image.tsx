'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  cacheProductImageFromUrl,
  resolveCachedProductImageSrc,
} from '@/lib/product-image-cache';

type ProductImageVariant = 'card' | 'hero' | 'detail' | 'thumb' | 'inline';

interface ProductImageProps {
  src: string;
  alt: string;
  /** Used to key offline IndexedDB cache entries. */
  productId?: string;
  variant?: ProductImageVariant;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  itemProp?: string;
}

const variantStyles: Record<
  ProductImageVariant,
  { frame: string; image: string }
> = {
  card: {
    frame:
      'flex aspect-[5/4] items-center justify-center overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50 p-0',
    image:
      'h-full w-full origin-center scale-[1.14] object-contain transition-transform duration-500 group-hover:scale-[1.2]',
  },
  hero: {
    frame:
      'flex aspect-[4/3] items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-50 p-2 sm:p-3',
    image: 'h-full w-full object-contain',
  },
  detail: {
    frame:
      'flex aspect-square items-center justify-center rounded-xl bg-gradient-to-b from-slate-50 via-white to-slate-50 p-3 sm:p-4',
    image: 'h-full w-full object-contain',
  },
  thumb: {
    frame: 'flex h-full w-full items-center justify-center bg-white p-0.5',
    image: 'h-full w-full object-contain',
  },
  inline: {
    frame: 'flex h-full w-full items-center justify-center bg-slate-50 p-0.5',
    image: 'h-full w-full object-contain',
  },
};

export default function ProductImage({
  src,
  alt,
  productId,
  variant = 'card',
  className,
  imageClassName,
  priority = false,
  itemProp,
}: ProductImageProps) {
  const styles = variantStyles[variant];
  const [displaySrc, setDisplaySrc] = useState(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setDisplaySrc(src);

    void (async () => {
      const resolved = await resolveCachedProductImageSrc(src, productId);
      if (cancelled || !resolved) return;
      setDisplaySrc(resolved);

      if (
        typeof navigator !== 'undefined' &&
        navigator.onLine &&
        src &&
        !resolved.startsWith('blob:')
      ) {
        const ok = await cacheProductImageFromUrl(src, productId);
        if (!ok || cancelled) return;
        const refreshed = await resolveCachedProductImageSrc(src, productId);
        if (!cancelled && refreshed) setDisplaySrc(refreshed);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, productId]);

  return (
    <div className={cn('relative overflow-hidden', styles.frame, className)}>
      {!failed && displaySrc ? (
        <img
          src={displaySrc}
          alt={alt}
          title={alt}
          className={cn(styles.image, imageClassName)}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          itemProp={itemProp}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-slate-100 text-xs font-medium text-slate-400"
          aria-hidden
        >
          No image
        </div>
      )}
    </div>
  );
}
