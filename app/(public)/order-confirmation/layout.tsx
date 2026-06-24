import type { Metadata } from 'next';
import { NOINDEX_ROBOTS } from '@/lib/seo/metadata';
import { buildPageTitle } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: buildPageTitle('Order Confirmation'),
  robots: NOINDEX_ROBOTS,
};

export default function OrderConfirmationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
