import type { MetadataRoute } from 'next';
import { getAllProductsServer } from '@/lib/products-server';
import { toAbsoluteImageUrl } from '@/lib/seo/images';
import { absoluteUrl, getProductUrl, getSiteUrl } from '@/lib/seo/site';

export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getAllProductsServer();
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: getSiteUrl(),
      lastModified,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: absoluteUrl('/products'),
      lastModified,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: absoluteUrl('/about'),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: absoluteUrl('/contact'),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: absoluteUrl('/privacy-policy'),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: absoluteUrl('/terms-of-service'),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: absoluteUrl('/cookie-policy'),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => {
    const imageUrl = toAbsoluteImageUrl(product.image);

    return {
      url: getProductUrl(product.id),
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
      images: imageUrl ? [imageUrl] : undefined,
    };
  });

  return [...staticRoutes, ...productRoutes];
}
