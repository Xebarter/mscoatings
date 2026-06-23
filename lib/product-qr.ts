import type { Product } from '@/lib/firestore';
import {
  BRAND_ASSETS,
  BRAND_COLORS,
  BRAND_NAME,
  BRAND_TAGLINE,
  getCategoryColor,
} from '@/lib/brand';
import { formatUgx } from '@/lib/currency';
import { getProductShopUrl } from '@/lib/seo/site';

type JsPdfDoc = import('jspdf').jsPDF;

const PDF_FILENAME = 'ms-coatings-product-qr-catalog.pdf';
const PRODUCTS_PER_PAGE = 4;
const GRID_COLS = 2;
const GRID_ROWS = 2;

function sanitizeFilename(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

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

function setDrawHex(doc: JsPdfDoc, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setDrawColor(r, g, b);
}

function setTextHex(doc: JsPdfDoc, hex: string) {
  const [r, g, b] = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}

async function loadImageAsDataUrl(path: string): Promise<string | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function createQrDataUrl(url: string, size = 512): Promise<string> {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(url, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: BRAND_COLORS.navy,
      light: '#ffffff',
    },
  });
}

function triggerDownload(href: string, filename: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
}

function drawBrandAccentBar(doc: JsPdfDoc, x: number, y: number, width: number, height: number) {
  const segment = width / 3;
  setFillHex(doc, BRAND_COLORS.premiumBlue);
  doc.rect(x, y, segment, height, 'F');
  setFillHex(doc, BRAND_COLORS.cyan);
  doc.rect(x + segment, y, segment, height, 'F');
  setFillHex(doc, BRAND_COLORS.performanceRed);
  doc.rect(x + segment * 2, y, segment, height, 'F');
}

function drawPageChrome(
  doc: JsPdfDoc,
  pageWidth: number,
  pageHeight: number,
  pageNumber: number,
  totalPages: number,
  logoDataUrl: string | null
) {
  const headerHeight = 16;

  setFillHex(doc, BRAND_COLORS.navy);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  drawBrandAccentBar(doc, 0, headerHeight, pageWidth, 1.4);

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', 10, 3.2, 9.5, 9.5);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(BRAND_NAME, logoDataUrl ? 22 : 10, 8.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 220, 240);
  doc.text('Product QR Catalog', logoDataUrl ? 22 : 10, 12.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('Scan · Shop · Order', pageWidth - 10, 9.5, { align: 'right' });

  const footerY = pageHeight - 9;
  setDrawHex(doc, '#e2e8f0');
  doc.setLineWidth(0.2);
  doc.line(10, footerY - 3, pageWidth - 10, footerY - 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setTextHex(doc, '#64748b');
  doc.text(BRAND_NAME, 10, footerY);
  doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth / 2, footerY, { align: 'center' });
  doc.text(BRAND_TAGLINE, pageWidth - 10, footerY, { align: 'right' });
}

function drawCoverPage(
  doc: JsPdfDoc,
  pageWidth: number,
  pageHeight: number,
  products: Product[],
  logoDataUrl: string | null
) {
  const heroHeight = 92;

  setFillHex(doc, BRAND_COLORS.navy);
  doc.rect(0, 0, pageWidth, heroHeight, 'F');

  setFillHex(doc, BRAND_COLORS.premiumBlue);
  doc.circle(pageWidth - 28, 18, 34, 'F');
  setFillHex(doc, BRAND_COLORS.cyan);
  doc.circle(pageWidth - 8, 52, 22, 'F');
  setFillHex(doc, BRAND_COLORS.performanceRed);
  doc.circle(18, 72, 16, 'F');

  drawBrandAccentBar(doc, 0, heroHeight, pageWidth, 2.2);

  if (logoDataUrl) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(pageWidth / 2 - 18, 22, 36, 36, 4, 4, 'F');
    doc.addImage(logoDataUrl, 'PNG', pageWidth / 2 - 14, 26, 28, 28);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.text('Product QR Catalog', pageWidth / 2, logoDataUrl ? 72 : 48, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(210, 230, 255);
  doc.text(BRAND_TAGLINE, pageWidth / 2, logoDataUrl ? 80 : 56, { align: 'center' });

  const statsY = heroHeight + 18;
  const statsWidth = 118;
  const statsX = (pageWidth - statsWidth) / 2;

  setFillHex(doc, '#f8fafc');
  setDrawHex(doc, BRAND_COLORS.premiumBlue);
  doc.setLineWidth(0.5);
  doc.roundedRect(statsX, statsY, statsWidth, 28, 3, 3, 'FD');

  setFillHex(doc, BRAND_COLORS.premiumBlue);
  doc.roundedRect(statsX, statsY, statsWidth, 6, 3, 3, 'F');
  doc.rect(statsX, statsY + 3, statsWidth, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  setTextHex(doc, BRAND_COLORS.navy);
  doc.text(String(products.length), pageWidth / 2, statsY + 17, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setTextHex(doc, '#64748b');
  doc.text(
    `product${products.length === 1 ? '' : 's'} ready to scan`,
    pageWidth / 2,
    statsY + 23,
    { align: 'center' }
  );

  const generatedAt = new Intl.DateTimeFormat('en-UG', {
    dateStyle: 'long',
  }).format(new Date());
  doc.setFontSize(8);
  doc.text(`Generated ${generatedAt}`, pageWidth / 2, statsY + 36, { align: 'center' });

  const guideY = statsY + 48;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  setTextHex(doc, BRAND_COLORS.navy);
  doc.text('How to use these codes', pageWidth / 2, guideY, { align: 'center' });

  const steps = [
    'Scan any QR code with your phone camera.',
    'Open the product instantly in our online shop.',
    'Add to cart and checkout in minutes.',
  ];

  steps.forEach((step, index) => {
    const stepY = guideY + 12 + index * 16;
    const badgeX = 28;

    setFillHex(doc, BRAND_COLORS.premiumBlue);
    doc.circle(badgeX, stepY - 1.2, 4.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(String(index + 1), badgeX, stepY + 0.6, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    setTextHex(doc, '#334155');
    doc.text(step, badgeX + 10, stepY + 0.6);
  });

  const tipY = pageHeight - 34;
  setFillHex(doc, '#eff6ff');
  setDrawHex(doc, '#bfdbfe');
  doc.setLineWidth(0.3);
  doc.roundedRect(18, tipY, pageWidth - 36, 18, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setTextHex(doc, BRAND_COLORS.premiumBlue);
  doc.text('Print tip', 24, tipY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setTextHex(doc, '#475569');
  doc.text(
    'For best results, print at 100% scale on white paper. Each card links directly to that product in the shop.',
    24,
    tipY + 12.5,
    { maxWidth: pageWidth - 48 }
  );
}

function drawProductCard(
  doc: JsPdfDoc,
  product: Product,
  qrDataUrl: string,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const categoryColor = getCategoryColor(product.category);
  const padding = 5;
  const accentHeight = 5;

  setFillHex(doc, '#ffffff');
  setDrawHex(doc, '#e2e8f0');
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, width, height, 4, 4, 'FD');

  setFillHex(doc, categoryColor);
  doc.roundedRect(x, y, width, accentHeight, 4, 4, 'F');
  doc.rect(x, y + accentHeight - 2, width, 2, 'F');

  const qrSize = Math.min(width - padding * 4, height * 0.42, 46);
  const qrX = x + (width - qrSize) / 2;
  const qrY = y + accentHeight + 6;

  setFillHex(doc, '#f8fafc');
  setDrawHex(doc, BRAND_COLORS.premiumBlue);
  doc.setLineWidth(0.6);
  doc.roundedRect(qrX - 2.5, qrY - 2.5, qrSize + 5, qrSize + 5, 2.5, 2.5, 'FD');
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  const textY = qrY + qrSize + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  setTextHex(doc, BRAND_COLORS.navy);
  doc.text(product.name, x + width / 2, textY, {
    align: 'center',
    maxWidth: width - padding * 2,
  });

  const badgeWidth = Math.min(width - padding * 2, 52);
  const badgeX = x + (width - badgeWidth) / 2;
  const badgeY = textY + 9;

  setFillHex(doc, categoryColor);
  doc.roundedRect(badgeX, badgeY, badgeWidth, 6.5, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(product.category.toUpperCase(), x + width / 2, badgeY + 4.3, {
    align: 'center',
    maxWidth: badgeWidth - 4,
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setTextHex(doc, BRAND_COLORS.premiumBlue);
  doc.text(formatUgx(product.price), x + width / 2, badgeY + 13, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setTextHex(doc, '#64748b');
  doc.text('Scan to view in shop', x + width / 2, y + height - 5, { align: 'center' });
}

export async function downloadProductQrPng(product: Product): Promise<void> {
  const url = getProductShopUrl(product.id);
  const dataUrl = await createQrDataUrl(url);
  const filename = `${sanitizeFilename(product.name) || product.id}-qr.png`;
  triggerDownload(dataUrl, filename);
}

export async function downloadAllProductQrPdf(products: Product[]): Promise<void> {
  if (products.length === 0) return;

  const [{ jsPDF }] = await Promise.all([import('jspdf'), import('qrcode')]);

  const logoDataUrl = await loadImageAsDataUrl(
    `${window.location.origin}${BRAND_ASSETS.logoLarge}`
  );

  const contentPageCount = Math.ceil(products.length / PRODUCTS_PER_PAGE);
  const totalPages = 1 + contentPageCount;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const contentTop = 24;
  const contentBottom = pageHeight - 14;
  const contentHeight = contentBottom - contentTop;
  const horizontalGap = 8;
  const verticalGap = 8;
  const contentWidth = pageWidth - 20;
  const cellWidth = (contentWidth - horizontalGap) / GRID_COLS;
  const cellHeight = (contentHeight - verticalGap) / GRID_ROWS;

  drawCoverPage(doc, pageWidth, pageHeight, products, logoDataUrl);

  for (let index = 0; index < products.length; index += 1) {
    const slot = index % PRODUCTS_PER_PAGE;

    if (slot === 0) {
      doc.addPage();
      drawPageChrome(doc, pageWidth, pageHeight, Math.floor(index / PRODUCTS_PER_PAGE) + 2, totalPages, logoDataUrl);
    }

    const product = products[index];
    const col = slot % GRID_COLS;
    const row = Math.floor(slot / GRID_COLS);
    const cellX = 10 + col * (cellWidth + horizontalGap);
    const cellY = contentTop + row * (cellHeight + verticalGap);

    const shopUrl = getProductShopUrl(product.id);
    const qrDataUrl = await createQrDataUrl(shopUrl, 320);

    drawProductCard(doc, product, qrDataUrl, cellX, cellY, cellWidth, cellHeight);
  }

  doc.save(PDF_FILENAME);
}
