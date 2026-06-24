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
  return absoluteUrl(`/products?product=${encodeURIComponent(productId)}`);
}

export const HOME_TITLE =
  'Automotive & Industrial Coatings Uganda | Buy Online';

export const DEFAULT_SITE_DESCRIPTION =
  'MS Coatings supplies professional automotive and industrial coatings, primers, clear coats, and finishing systems in Uganda. Shop online with fast checkout and nationwide delivery.';

export const SEO_KEYWORDS = [
  'MS Coatings',
  'MS Coatings Uganda',
  'MS Coatings shop',
  'mscoatings.shop',
  'automotive coatings Uganda',
  'industrial paint Uganda',
  'automotive refinish Uganda',
  'car paint Uganda',
  'clear coat Uganda',
  '2K clear coat',
  'automotive primer Uganda',
  'body shop paint supplies',
  'industrial coatings Kampala',
  'paint shop Uganda',
  'automotive paint supplier Uganda',
  'primers',
  'clear coat',
  'topcoat',
  'thinners',
  'nitrocellulous paint',
  'acrylic paint',
  'professional coatings',
  'fleet paint supplies',
  'collision repair coatings',
] as const;

export function buildPageTitle(title: string): string {
  return `${title} | ${BRAND_NAME}`;
}
