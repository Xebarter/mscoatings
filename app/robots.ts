import type { MetadataRoute } from 'next';
import { absoluteUrl, getSiteUrl } from '@/lib/seo/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/api/',
        '/cart',
        '/checkout',
        '/payments/',
        '/order-confirmation/',
      ],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
    host: getSiteUrl(),
  };
}
