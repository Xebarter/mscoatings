import type { SeoProduct } from '@/lib/seo/json-ld';

export function mapApiProductToSeoProduct(
  product: Record<string, unknown>
): SeoProduct | null {
  const id = typeof product.id === 'string' ? product.id : '';
  const name = typeof product.name === 'string' ? product.name : '';
  const image = typeof product.image === 'string' ? product.image : '';

  if (!id || !name || !image) return null;

  return {
    id,
    name,
    description:
      typeof product.description === 'string' ? product.description : '',
    price: Number(product.price ?? 0),
    category:
      typeof product.category === 'string' ? product.category : 'Uncategorized',
    stock: Number(product.stock ?? 0),
    image,
  };
}

export function mapApiProductsToSeoProducts(
  products: unknown
): SeoProduct[] {
  if (!Array.isArray(products)) return [];

  return products
    .map((product) =>
      mapApiProductToSeoProduct(product as Record<string, unknown>)
    )
    .filter((product): product is SeoProduct => product !== null);
}

export async function fetchLiveCatalogProducts(): Promise<SeoProduct[]> {
  const response = await fetch('/api/products', { cache: 'no-store' });
  if (!response.ok) return [];

  const data = await response.json();
  return mapApiProductsToSeoProducts(data);
}
