import { BRAND_NAME } from '@/lib/brand';
import { getSiteUrl } from '@/lib/seo/site';

export function toAbsoluteImageUrl(imageUrl: string | undefined | null): string | null {
  if (!imageUrl?.trim()) return null;

  const trimmed = imageUrl.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const siteUrl = getSiteUrl();
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${siteUrl}${path}`;
}

export function buildProductImageAlt(product: {
  name: string;
  category?: string;
}): string {
  const category = product.category?.trim();
  if (category) {
    return `${product.name} — ${category} | ${BRAND_NAME}`;
  }
  return `${product.name} | ${BRAND_NAME}`;
}

export function buildProductImageCaption(product: {
  name: string;
  category?: string;
  description?: string;
}): string {
  const alt = buildProductImageAlt(product);
  const description = product.description?.trim();
  if (!description) return alt;
  return `${alt}. ${description.slice(0, 160)}`;
}
