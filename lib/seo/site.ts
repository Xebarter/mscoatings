import { BRAND_NAME } from '@/lib/brand';

const DEFAULT_SITE_URL = 'http://localhost:3000';

export function getSiteUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    DEFAULT_SITE_URL;

  return url.replace(/\/+$/, '');
}

export function absoluteUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
}

export function getProductUrl(productId: string): string {
  return absoluteUrl(`/product/${productId}`);
}

export function getProductShopUrl(productId: string): string {
  return absoluteUrl(`/shop?product=${encodeURIComponent(productId)}`);
}

export const SEO_KEYWORDS = [
  'MS Coatings',
  'MS Coatings Uganda',
  'automotive coatings',
  'industrial paint',
  'automotive refinish',
  'primers',
  'clear coat',
  'topcoat',
  'professional coatings',
  'car paint Uganda',
] as const;

export const DEFAULT_SITE_DESCRIPTION =
  'MS Coatings supplies professional automotive and industrial coatings, primers, clear coats, and finishing systems in Uganda. Shop online with fast checkout.';

export function buildPageTitle(title: string): string {
  return `${title} | ${BRAND_NAME}`;
}
