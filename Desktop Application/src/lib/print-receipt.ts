import { buildReceiptPrintDocument } from '@/lib/receipt-document';
import type { Sale } from '@/lib/types';

export function printSaleReceipt(sale: Sale): void {
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
  printDocument.write(buildReceiptPrintDocument(sale));
  printDocument.close();

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    document.body.removeChild(iframe);
  };

  printWindow.onafterprint = cleanup;
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
    window.setTimeout(cleanup, 1000);
  }, 150);
}
