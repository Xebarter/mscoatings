import { getAllProductsServer } from '@/lib/products-server';
import StructuredData from '@/components/structured-data';
import { HOME_FAQS } from '@/lib/seo/faqs';
import { buildHomePageSchema } from '@/lib/seo/json-ld';
import HomePageClient from './home-page-client';

export const revalidate = 60;

export default async function HomePage() {
  const products = await getAllProductsServer();

  return (
    <>
      <StructuredData data={buildHomePageSchema(HOME_FAQS)} />
      <HomePageClient products={products} />
    </>
  );
}
