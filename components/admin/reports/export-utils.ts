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

export function printEnterpriseReport(report: EnterpriseReport): void {
  const html = buildEnterpriseReportPrintDocument(report);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';

  document.body.appendChild(iframe);

  const printWindow = iframe.contentWindow;
  const printDocument = printWindow?.document;

  if (!printWindow || !printDocument) {
    document.body.removeChild(iframe);
    return;
  }

  printDocument.open();
  printDocument.write(html);
  printDocument.close();

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (iframe.parentNode) document.body.removeChild(iframe);
  };

  const triggerPrint = () => {
    printWindow.focus();
    printWindow.print();
    window.setTimeout(cleanup, 1200);
  };

  printWindow.onafterprint = cleanup;

  // Wait for logo image so branded header prints correctly
  const logo = printDocument.querySelector('img');
  if (logo && !logo.complete) {
    logo.addEventListener('load', () => window.setTimeout(triggerPrint, 50));
    logo.addEventListener('error', () => window.setTimeout(triggerPrint, 50));
    window.setTimeout(triggerPrint, 800);
  } else {
    window.setTimeout(triggerPrint, 150);
  }
}
