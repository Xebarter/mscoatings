import { getAllProductsServer } from '@/lib/products-server';
import ProductsPageClient from './products-page-client';

export const revalidate = 3600;

export default async function ProductsPage() {
  const products = await getAllProductsServer();

  return <ProductsPageClient products={products} />;
}
