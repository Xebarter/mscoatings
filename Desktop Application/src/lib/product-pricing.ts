import type { Product } from './types';

/** Unit price for field-agent picks; falls back to retail price for legacy/offline mirrors. */
export function getFieldPickUnitPrice(
  product: Pick<Product, 'price' | 'fieldPickPrice'>
): number {
  return Number(product.fieldPickPrice ?? product.price ?? 0);
}

/** Ensure mirrored/offline product docs always carry an explicit field pick price. */
export function withFieldPickPrice<T extends Pick<Product, 'price' | 'fieldPickPrice'>>(
  product: T
): T & { fieldPickPrice: number } {
  return {
    ...product,
    fieldPickPrice: getFieldPickUnitPrice(product),
  };
}
