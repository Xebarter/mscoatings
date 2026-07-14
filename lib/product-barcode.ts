import type { Product } from '@/lib/firestore';
import { BRAND_COLORS, BRAND_NAME } from '@/lib/brand';
import { formatUgx } from '@/lib/currency';

type JsPdfDoc = import('jspdf').jsPDF;

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function setFillHex(doc: JsPdfDoc, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setFillColor(r, g, b);
}

function setTextHex(doc: JsPdfDoc, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}

async function createBarcodeDataUrl(barcode: string): Promise<string> {
  const JsBarcode = (await import('jsbarcode')).default;

  const canvas = document.createElement('canvas');
  JsBarcode(canvas, barcode, {
    format: 'CODE128',
    width: 2,
    height: 80,
    displayValue: true,
    fontSize: 14,
    margin: 8,
  });

  return canvas.toDataURL('image/png');
}

function triggerDownload(href: string, filename: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
}

function sanitizeFilename(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function drawLabel(
  doc: JsPdfDoc,
  product: Product,
  barcodeDataUrl: string,
  x: number,
  y: number,
  width: number,
  height: number
) {
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, height, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setTextHex(doc, BRAND_COLORS.navy);
  doc.text(product.name, x + width / 2, y + 8, {
    align: 'center',
    maxWidth: width - 6,
  });

  const barcodeWidth = width - 10;
  const barcodeHeight = 18;
  doc.addImage(
    barcodeDataUrl,
    'PNG',
    x + 5,
    y + 12,
    barcodeWidth,
    barcodeHeight
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  setTextHex(doc, '#64748b');
  doc.text(product.barcode ?? '', x + width / 2, y + 33, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setTextHex(doc, BRAND_COLORS.premiumBlue);
  doc.text(formatUgx(product.price), x + width / 2, y + height - 5, {
    align: 'center',
  });
}

export async function downloadProductBarcodeLabel(product: Product): Promise<void> {
  if (!product.barcode) {
    throw new Error('Product has no barcode');
  }

  const [{ jsPDF }] = await Promise.all([import('jspdf')]);
  const barcodeDataUrl = await createBarcodeDataUrl(product.barcode);

  const doc = new jsPDF({ unit: 'mm', format: [70, 40] });
  drawLabel(doc, product, barcodeDataUrl, 2, 2, 66, 36);

  const filename = `${sanitizeFilename(product.name) || product.id}-barcode.pdf`;
  doc.save(filename);
}

export async function downloadAllBarcodeLabelsPdf(products: Product[]): Promise<void> {
  const withBarcodes = products.filter((p) => p.barcode);
  if (withBarcodes.length === 0) return;

  const [{ jsPDF }] = await Promise.all([import('jspdf')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const labelWidth = 70;
  const labelHeight = 40;
  const cols = Math.floor((pageWidth - 20) / (labelWidth + 5));
  const rows = Math.floor((pageHeight - 20) / (labelHeight + 5));

  let index = 0;
  for (const product of withBarcodes) {
    const barcodeDataUrl = await createBarcodeDataUrl(product.barcode!);
    const slot = index % (cols * rows);

    if (index > 0 && slot === 0) {
      doc.addPage();
    }

    const col = slot % cols;
    const row = Math.floor(slot / cols);
    const x = 10 + col * (labelWidth + 5);
    const y = 10 + row * (labelHeight + 5);

    drawLabel(doc, product, barcodeDataUrl, x, y, labelWidth, labelHeight);
    index += 1;
  }

  setFillHex(doc, BRAND_COLORS.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(BRAND_NAME, pageWidth / 2, pageHeight - 5, { align: 'center' });

  doc.save('ms-coatings-barcode-labels.pdf');
}

export async function downloadBarcodePng(barcode: string): Promise<void> {
  const dataUrl = await createBarcodeDataUrl(barcode);
  triggerDownload(dataUrl, `${barcode}.png`);
}
