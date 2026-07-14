import { useEffect, type ReactNode } from 'react';
import { AlertTriangle, Loader2, RotateCcw, Undo2, X } from 'lucide-react';

export type ConfirmDialogVariant = 'danger' | 'warning';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  loading?: boolean;
  details?: Array<{ label: string; value: string }>;
  icon?: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}

const VARIANT = {
  danger: {
    iconBg: 'bg-red-50 ring-red-100',
    iconColor: 'text-red-600',
    confirmBtn:
      'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/40',
    DefaultIcon: Undo2,
  },
  warning: {
    iconBg: 'bg-amber-50 ring-amber-100',
    iconColor: 'text-amber-600',
    confirmBtn:
      'bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500/40',
    DefaultIcon: RotateCcw,
  },
} as const;

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Keep sale',
  variant = 'danger',
  loading = false,
  details,
  icon,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  const theme = VARIANT[variant];
  const DefaultIcon = theme.DefaultIcon;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] sm:rounded-2xl">
        <div className="flex items-start gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${theme.iconBg}`}
          >
            {icon ?? <DefaultIcon size={22} className={theme.iconColor} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h2
                id="confirm-dialog-title"
                className="text-lg font-bold tracking-tight text-slate-900"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              {description}
            </p>
          </div>
        </div>

        {details && details.length > 0 && (
          <div className="mx-5 mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:mx-6">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <AlertTriangle size={12} />
              Sale summary
            </div>
            <dl className="mt-2 space-y-1.5">
              {details.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <dt className="text-slate-500">{row.label}</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-4 disabled:opacity-60 ${theme.confirmBtn}`}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
