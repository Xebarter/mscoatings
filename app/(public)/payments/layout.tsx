import type { Metadata } from 'next';
import { NOINDEX_ROBOTS } from '@/lib/seo/metadata';
import { buildPageTitle } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: buildPageTitle('Payment'),
  robots: NOINDEX_ROBOTS,
};

export default function PaymentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
