import { getAllProductsServer } from '@/lib/products-server';
import HomePageClient from './home-page-client';

export const revalidate = 3600;

export default async function HomePage() {
  const products = await getAllProductsServer();

  return <HomePageClient products={products} />;
}
