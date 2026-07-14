import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  cacheProductImage,
  resolveProductImageSrc,
} from '@/lib/offline/product-images';
import { isOnline } from '@/lib/offline/connectivity';

interface ProductThumbProps {
  productId: string;
  src?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
}

export default function ProductThumb({
  productId,
  src,
  alt,
  className,
  imageClassName,
  fallbackClassName,
}: ProductThumbProps) {
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    void (async () => {
      const resolved = await resolveProductImageSrc(productId, src);
      if (cancelled) return;
      setDisplaySrc(resolved);

      if (resolved && isOnline() && src && !resolved.startsWith('blob:')) {
        void cacheProductImage(productId, src).then(async (ok) => {
          if (!ok || cancelled) return;
          const refreshed = await resolveProductImageSrc(productId, src);
          if (!cancelled && refreshed) setDisplaySrc(refreshed);
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, src]);

  if (!displaySrc || failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-slate-100 text-slate-400',
          className,
          fallbackClassName
        )}
        aria-hidden
      >
        <Package className="h-5 w-5 opacity-70" />
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden bg-slate-50', className)}>
      <img
        src={displaySrc}
        alt={alt}
        className={cn('h-full w-full object-contain', imageClassName)}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
