import { revalidatePath } from 'next/cache';

export function revalidateCatalog(productId?: string) {
  revalidatePath('/');
  revalidatePath('/products', 'layout');
  revalidatePath('/products');
  revalidatePath('/shop');
  revalidatePath('/sitemap.xml');

  if (productId) {
    revalidatePath(`/product/${productId}`);
  }
}
