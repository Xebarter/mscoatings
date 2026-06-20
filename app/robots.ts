import type { MetadataRoute } from 'next';
import { absoluteUrl, getSiteUrl } from '@/lib/seo/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/checkout', '/cart', '/payments/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
    host: getSiteUrl(),
  };
}
