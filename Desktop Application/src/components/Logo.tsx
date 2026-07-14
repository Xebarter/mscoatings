import { BRAND_ASSETS, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  subtitle?: string;
  textVariant?: 'light' | 'dark';
  className?: string;
}

const sizeMap = {
  sm: 32,
  md: 40,
  lg: 64,
} as const;

export default function Logo({
  size = 'md',
  showText = true,
  subtitle,
  textVariant = 'light',
  className,
}: LogoProps) {
  const dimension = sizeMap[size];

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <img
        src={BRAND_ASSETS.logo}
        alt={BRAND_NAME}
        width={dimension}
        height={dimension}
        className="rounded-xl object-contain"
      />
      {showText && (
        <div className="min-w-0 text-left">
          <p
            className={cn(
              'font-bold tracking-tight',
              size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-base' : 'text-lg',
              textVariant === 'light' ? 'text-white' : 'text-slate-900'
            )}
          >
            {BRAND_NAME}
          </p>
          <p
            className={cn(
              'truncate text-xs',
              textVariant === 'light' ? 'text-slate-400' : 'text-slate-500'
            )}
          >
            {subtitle ?? BRAND_TAGLINE}
          </p>
        </div>
      )}
    </div>
  );
}
