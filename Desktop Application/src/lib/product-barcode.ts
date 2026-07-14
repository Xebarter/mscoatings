import type { Product } from '@/lib/types';
import { formatUgx } from '@/lib/currency';
import { BRAND_NAME } from '@/lib/brand';

type BarcodeLabelProduct = Pick<Product, 'id' | 'name' | 'price' | 'barcode'>;

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

function sanitizeFilename(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Download a simple PNG barcode label (name + barcode + price). */
export async function downloadProductBarcodeLabel(
  product: BarcodeLabelProduct
): Promise<void> {
  if (!product.barcode) {
    throw new Error('Product has no barcode');
  }

  const barcodeDataUrl = await createBarcodeDataUrl(product.barcode);
  const barcodeImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to render barcode'));
    img.src = barcodeDataUrl;
  });

  const width = 400;
  const height = 220;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, width - 16, height - 16);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px Segoe UI, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(BRAND_NAME, width / 2, 36);

  ctx.font = '600 15px Segoe UI, system-ui, sans-serif';
  const name =
    product.name.length > 36 ? `${product.name.slice(0, 33)}…` : product.name;
  ctx.fillText(name, width / 2, 62);

  const barcodeW = width - 60;
  const barcodeH = 90;
  ctx.drawImage(barcodeImg, (width - barcodeW) / 2, 72, barcodeW, barcodeH);

  ctx.fillStyle = '#0077c8';
  ctx.font = 'bold 18px Segoe UI, system-ui, sans-serif';
  ctx.fillText(formatUgx(product.price), width / 2, 200);

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `${sanitizeFilename(product.name) || product.id}-barcode.png`;
  link.click();
}
