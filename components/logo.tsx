import Link from 'next/link';
import { BRAND_ASSETS, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';
import { cn } from '@/lib/utils';

const sizeMap = {
  sm: 32,
  md: 40,
  lg: 64,
} as const;

interface LogoProps {
  href?: string | null;
  size?: keyof typeof sizeMap;
  showText?: boolean;
  subtitle?: string;
  textVariant?: 'light' | 'dark';
  className?: string;
}

export default function Logo({
  href = '/',
  size = 'md',
  showText = true,
  subtitle = BRAND_TAGLINE,
  textVariant = 'light',
  className,
}: LogoProps) {
  const dimension = sizeMap[size];

  const content = (
    <div className={cn('flex shrink-0 items-center gap-3', className)}>
      <img
        src={BRAND_ASSETS.logo}
        alt={BRAND_NAME}
        width={dimension}
        height={dimension}
        className="rounded-xl object-contain"
      />
      {showText && (
        <div className={cn(size === 'sm' ? 'hidden' : 'hidden sm:block')}>
          <p
            className={cn(
              'font-bold',
              size === 'lg' ? 'text-lg' : 'text-base',
              textVariant === 'light' ? 'text-white' : 'text-slate-900'
            )}
          >
            {BRAND_NAME}
          </p>
          {subtitle && (
            <p
              className={cn(
                'text-xs',
                textVariant === 'light' ? 'text-gray-300' : 'text-slate-500'
              )}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex">
        {content}
      </Link>
    );
  }

  return content;
}
