import { buildEnterpriseReportPrintDocument } from '@/lib/reports/print-document';
import type { EnterpriseReport } from '@/lib/reports/types';

export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (value: string) => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const content = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ].join('\n');

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** @deprecated Prefer printEnterpriseReport(report) for professional BI output */
export function printReport(elementId: string) {
  const element = document.getElementById(elementId);
  if (!element) return;
  void element;
  console.warn('printReport(elementId) is deprecated; use printEnterpriseReport(report)');
}

export type PrintPreviewHandler = (html: string) => void;

let previewHandler: PrintPreviewHandler | null = null;

/** Reports dashboard registers a modal opener so print always shows on-screen preview. */
export function setPrintPreviewHandler(handler: PrintPreviewHandler | null) {
  previewHandler = handler;
}

export function buildReportPrintHtml(report: EnterpriseReport): string {
  return buildEnterpriseReportPrintDocument(report);
}

/**
 * Opens the in-app print preview when registered; otherwise falls back to Electron
 * preview window or a print dialog.
 */
export function printEnterpriseReport(report: EnterpriseReport): void {
  const html = buildReportPrintHtml(report);

  if (previewHandler) {
    previewHandler(html);
    return;
  }

  if (window.electronAPI?.printPreview) {
    void window.electronAPI.printPreview(html).catch(() => {
      /* ignore */
    });
    return;
  }

  // Last resort: open a real tab-sized window so the user can see content
  const win = window.open('', '_blank', 'width=960,height=900');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    return;
  }

  window.print();
}
