import type { Metadata } from 'next';
import { getAllProductsServer } from '@/lib/products-server';
import StructuredData from '@/components/structured-data';
import { buildProductItemListSchema } from '@/lib/seo/json-ld';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { SEO_KEYWORDS } from '@/lib/seo/site';

export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'Automotive & Industrial Coatings Catalog',
  description:
    'Shop MS Coatings primers, clear coats, acrylic paints, 2K systems, thinners, and industrial finishing products online in Uganda. Fast checkout and nationwide delivery.',
  path: '/products',
  keywords: [
    ...SEO_KEYWORDS,
    'buy car paint online Uganda',
    'automotive coatings catalog',
    'clear coat shop Uganda',
  ],
});

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
