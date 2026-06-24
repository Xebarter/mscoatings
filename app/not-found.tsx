import Link from 'next/link';
import type { Metadata } from 'next';
import BrandButton from '@/components/brand-button';
import { buildPageMetadata, NOINDEX_ROBOTS } from '@/lib/seo/metadata';
import { buildPageTitle } from '@/lib/seo/site';

export const metadata: Metadata = buildPageMetadata({
  title: 'Page Not Found',
  description: 'The page you are looking for could not be found on MS Coatings.',
  path: '/404',
  robots: NOINDEX_ROBOTS,
});

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-white px-5 py-16 text-center">
      <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-premium-blue">
        404
      </p>
      <h1 className="mb-4 text-3xl font-extrabold text-navy sm:text-4xl">
        Page not found
      </h1>
      <p className="mb-8 max-w-md text-body">
        The page you requested does not exist. Browse our coatings catalog or
        return to the homepage.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <BrandButton href="/products" variant="primary">
          Browse Products
        </BrandButton>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-navy transition hover:border-premium-blue hover:text-premium-blue"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
