import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  subtitle?: string;
  className?: string;
}

const sizeMap = {
  sm: { icon: 'h-8 w-8', title: 'text-base', subtitle: 'text-xs' },
  md: { icon: 'h-10 w-10', title: 'text-lg', subtitle: 'text-xs' },
  lg: { icon: 'h-14 w-14', title: 'text-xl', subtitle: 'text-sm' },
};

export default function Logo({
  size = 'md',
  showText = true,
  subtitle,
  className,
}: LogoProps) {
  const s = sizeMap[size];

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0077c8] via-[#19b5fe] to-[#e53935] shadow-lg shadow-blue-500/20',
          s.icon
        )}
      >
        <span className="text-sm font-extrabold text-white">MS</span>
      </div>
      {showText && (
        <div className="min-w-0">
          <p className={cn('font-bold tracking-tight text-white', s.title)}>
            {BRAND_NAME}
          </p>
          <p className={cn('truncate text-slate-400', s.subtitle)}>
            {subtitle ?? BRAND_TAGLINE}
          </p>
        </div>
      )}
    </div>
  );
}
