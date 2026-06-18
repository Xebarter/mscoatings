import Link from 'next/link';
import { cn } from '@/lib/utils';

type BrandButtonProps = {
  children: React.ReactNode;
  className?: string;
  href?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'md' | 'lg';
};

export default function BrandButton({
  children,
  className,
  href,
  type = 'button',
  disabled,
  onClick,
  variant = 'primary',
  size = 'md',
}: BrandButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center font-semibold transition-all duration-300',
    size === 'lg' ? 'px-8 py-4 text-base rounded-xl' : 'px-6 py-3 text-sm rounded-xl',
    variant === 'primary' && 'btn-primary text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5',
    variant === 'secondary' && 'btn-secondary text-white shadow-md hover:shadow-lg hover:-translate-y-0.5',
    variant === 'outline' && 'btn-outline hover:bg-[#0077C8]/5',
    disabled && 'pointer-events-none opacity-50',
    className
  );

  if (href) {
    const isExternal = href.startsWith('http');
    if (isExternal) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={classes} onClick={onClick}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
