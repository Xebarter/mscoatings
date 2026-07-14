import { cn } from '@/lib/utils';

interface PanelProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: PanelProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
