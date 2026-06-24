import type { Metadata } from 'next';
import { BRAND_ASSETS, BRAND_NAME } from '@/lib/brand';
import { buildPageTitle, SEO_KEYWORDS } from '@/lib/seo/site';

type RobotsDirective = Metadata['robots'];

interface BuildPageMetadataOptions {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  image?: string;
  imageAlt?: string;
  robots?: RobotsDirective;
  openGraphType?: 'website' | 'article';
}

const DEFAULT_ROBOTS: RobotsDirective = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
  },
};

export const NOINDEX_ROBOTS: RobotsDirective = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

export function buildPageMetadata({
  title,
  description,
  path,
  keywords = [...SEO_KEYWORDS],
  image = BRAND_ASSETS.logoLarge,
  imageAlt = BRAND_NAME,
  robots = DEFAULT_ROBOTS,
  openGraphType = 'website',
}: BuildPageMetadataOptions): Metadata {
  const pageTitle = buildPageTitle(title);
  const canonical = path.startsWith('/') ? path : `/${path}`;

  return {
    title: pageTitle,
    description,
    keywords,
    alternates: { canonical },
    robots,
    openGraph: {
      type: openGraphType,
      siteName: BRAND_NAME,
      title: pageTitle,
      description,
      url: canonical,
      locale: 'en_UG',
      images: [
        {
          url: image,
          width: 512,
          height: 512,
          alt: imageAlt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description,
      images: [image],
    },
  };
}
