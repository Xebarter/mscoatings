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
      'flex aspect-[4/3] items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-50 p-2 sm:p-3',
    image:
      'h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]',
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
        className={cn(styles.image, imageClassName)}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
