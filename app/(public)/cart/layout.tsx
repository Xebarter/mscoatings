import type { Metadata } from 'next';
import { NOINDEX_ROBOTS } from '@/lib/seo/metadata';
import { buildPageTitle } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: buildPageTitle('Shopping Cart'),
  alternates: { canonical: '/cart' },
  robots: NOINDEX_ROBOTS,
};

export default function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
