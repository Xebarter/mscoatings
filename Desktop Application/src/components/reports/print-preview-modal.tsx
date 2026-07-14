import { useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import { createPortal } from 'react-dom';

type PrintPreviewModalProps = {
  html: string;
  open: boolean;
  onClose: () => void;
};

/**
 * Visible on-screen print preview (Electron has no Chrome print-preview for iframes).
 */
export function PrintPreviewModal({ html, open, onClose }: PrintPreviewModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const handlePrint = () => {
    const frame = document.getElementById(
      'ms-bi-print-preview-frame'
    ) as HTMLIFrameElement | null;
    const win = frame?.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-slate-950/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Print preview"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-950 px-4 py-3 text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-300/90">
            Print preview
          </p>
          <p className="text-sm text-slate-300">Business Intelligence report</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-600"
          >
            <X size={16} />
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-premium-blue to-cyan px-3.5 py-2 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
          >
            <Printer size={16} />
            Print
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden bg-slate-800/40 p-3 sm:p-5">
        <iframe
          id="ms-bi-print-preview-frame"
          title="Business Intelligence print preview"
          srcDoc={html}
          className="h-full w-full rounded-xl border border-slate-700 bg-white shadow-2xl"
        />
      </div>
    </div>,
    document.body
  );
}
