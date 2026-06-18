import { LucideIcon } from 'lucide-react';

interface AdminStatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const toneStyles = {
  default: {
    icon: 'bg-slate-100 text-slate-600',
    value: 'text-slate-900',
  },
  success: {
    icon: 'bg-emerald-50 text-emerald-600',
    value: 'text-emerald-700',
  },
  warning: {
    icon: 'bg-amber-50 text-amber-600',
    value: 'text-amber-700',
  },
  danger: {
    icon: 'bg-red-50 text-red-600',
    value: 'text-red-700',
  },
  info: {
    icon: 'bg-blue-50 text-blue-600',
    value: 'text-blue-700',
  },
};

export default function AdminStatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: AdminStatCardProps) {
  const styles = toneStyles[tone];

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={`mt-2 text-2xl font-bold tracking-tight sm:text-3xl ${styles.value}`}>
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
        <div className={`rounded-xl p-3 ${styles.icon}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}
