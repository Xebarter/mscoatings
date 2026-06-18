import { cn } from '@/lib/utils';

type ProductImageVariant = 'card' | 'hero' | 'detail' | 'thumb' | 'inline';

interface ProductImageProps {
  src: string;
  alt: string;
  variant?: ProductImageVariant;
  className?: string;
  imageClassName?: string;
}

const variantStyles: Record<
  ProductImageVariant,
  { frame: string; image: string }
> = {
  card: {
    frame:
      'aspect-[4/3] bg-gradient-to-b from-slate-50 via-white to-slate-50 p-5 sm:p-6',
    image:
      'max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]',
  },
  hero: {
    frame:
      'flex min-h-[220px] items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-50 p-6 sm:min-h-[300px] sm:p-8 lg:min-h-[380px]',
    image: 'max-h-[200px] w-full object-contain sm:max-h-[260px] lg:max-h-[340px]',
  },
  detail: {
    frame:
      'flex min-h-[320px] items-center justify-center rounded-xl bg-gradient-to-b from-slate-50 via-white to-slate-50 p-8 sm:min-h-[400px] lg:min-h-[480px]',
    image: 'max-h-[280px] w-full object-contain sm:max-h-[360px] lg:max-h-[440px]',
  },
  thumb: {
    frame: 'flex h-full w-full items-center justify-center bg-white p-1.5',
    image: 'max-h-full max-w-full object-contain',
  },
  inline: {
    frame: 'flex h-full w-full items-center justify-center bg-slate-50 p-1',
    image: 'max-h-full max-w-full object-contain',
  },
};

export default function ProductImage({
  src,
  alt,
  variant = 'card',
  className,
  imageClassName,
}: ProductImageProps) {
  const styles = variantStyles[variant];

  return (
    <div className={cn('relative overflow-hidden', styles.frame, className)}>
      <img
        src={src}
        alt={alt}
        className={cn('mx-auto', styles.image, imageClassName)}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
