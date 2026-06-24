import type { Metadata } from 'next';
import { NOINDEX_ROBOTS } from '@/lib/seo/metadata';
import { buildPageTitle } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: buildPageTitle('Checkout'),
  alternates: { canonical: '/checkout' },
  robots: NOINDEX_ROBOTS,
};

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
