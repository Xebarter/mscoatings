import { getAdminFirestore } from '@/lib/firebase-admin';
import type { SeoProduct } from '@/lib/seo/json-ld';

function mapProductDoc(
  id: string,
  data: FirebaseFirestore.DocumentData
): SeoProduct {
  return {
    id,
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    price: Number(data.price ?? 0),
    category: String(data.category ?? 'Uncategorized'),
    stock: Number(data.stock ?? 0),
    image: String(data.image ?? ''),
  };
}

export async function getAllProductsServer(): Promise<SeoProduct[]> {
  try {
    const db = getAdminFirestore();
    const snapshot = await db.collection('products').get();

    return snapshot.docs
      .map((doc) => mapProductDoc(doc.id, doc.data()))
      .filter((product) => product.name && product.image);
  } catch (error) {
    console.error('Failed to fetch products for SEO:', error);
    return [];
  }
}

export async function getProductByIdServer(
  productId: string
): Promise<SeoProduct | null> {
  try {
    const db = getAdminFirestore();
    const snapshot = await db.collection('products').doc(productId).get();

    if (!snapshot.exists) return null;

    const product = mapProductDoc(snapshot.id, snapshot.data() ?? {});
    if (!product.name) return null;

    return product;
  } catch (error) {
    console.error(`Failed to fetch product ${productId} for SEO:`, error);
    return null;
  }
}
