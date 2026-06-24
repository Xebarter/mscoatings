import type { Metadata } from 'next';
import { getAllProductsServer } from '@/lib/products-server';
import { buildProductItemListSchema } from '@/lib/seo/json-ld';
import { buildPageTitle, DEFAULT_SITE_DESCRIPTION } from '@/lib/seo/site';
import StructuredData from '@/components/structured-data';

export const metadata: Metadata = {
  title: buildPageTitle('Products'),
  description:
    'Browse MS Coatings automotive and industrial coatings, primers, clear coats, and professional finishing products.',
  alternates: {
    canonical: '/products',
  },
  openGraph: {
    title: buildPageTitle('Products'),
    description: DEFAULT_SITE_DESCRIPTION,
    url: '/products',
  },
};

export const revalidate = 60;

export default async function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const products = await getAllProductsServer();

  return (
    <>
      {products.length > 0 && (
        <StructuredData data={buildProductItemListSchema(products)} />
      )}
      {children}
    </>
  );
}
