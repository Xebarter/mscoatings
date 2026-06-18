import { cn } from '@/lib/utils';

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  light?: boolean;
  className?: string;
};

export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  light = false,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'max-w-3xl',
        align === 'center' && 'mx-auto text-center',
        className
      )}
    >
      {eyebrow && (
        <p
          className={cn(
            'mb-2 text-xs font-semibold uppercase tracking-[0.15em] sm:mb-3 sm:text-sm sm:tracking-[0.2em]',
            light ? 'text-cyan' : 'text-premium-blue'
          )}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className={cn(
          'text-2xl font-extrabold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl',
          light ? 'text-white' : 'text-navy'
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            'mt-3 text-base leading-relaxed sm:mt-4 sm:text-lg',
            light ? 'text-gray-300' : 'text-body'
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
