import type { MetadataRoute } from 'next';
import { getAllProductsServer } from '@/lib/products-server';
import {
  categoryToSlug,
  getUniqueCategoriesFromProducts,
  MARKETING_CATEGORIES,
} from '@/lib/seo/categories';
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
      priority: 0.8,
    },
    {
      url: absoluteUrl('/contact'),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: absoluteUrl('/privacy-policy'),
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: absoluteUrl('/terms-of-service'),
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: absoluteUrl('/cookie-policy'),
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  const dbCategories = getUniqueCategoriesFromProducts(products);
  const categoryRoutes: MetadataRoute.Sitemap = dbCategories.map((category) => ({
    url: absoluteUrl(`/products/category/${categoryToSlug(category)}`),
    lastModified,
    changeFrequency: 'weekly',
    priority: 0.75,
  }));

  const marketingRoutes: MetadataRoute.Sitemap = MARKETING_CATEGORIES.map(
    (category) => ({
      url: absoluteUrl(`/products/category/${category.slug}`),
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    })
  );

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

  const seen = new Set<string>();
  const allRoutes = [
    ...staticRoutes,
    ...categoryRoutes,
    ...marketingRoutes,
    ...productRoutes,
  ].filter((route) => {
    if (seen.has(route.url)) return false;
    seen.add(route.url);
    return true;
  });

  return allRoutes;
}
