import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { SeoProduct } from '@/lib/seo/json-ld';

const productsCollection = collection(db, 'products');

function mapProductDoc(
  id: string,
  data: Record<string, unknown>
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
    const snapshot = await getDocs(productsCollection);

    return snapshot.docs
      .map((productDoc) => mapProductDoc(productDoc.id, productDoc.data()))
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
    const snapshot = await getDoc(doc(db, 'products', productId));

    if (!snapshot.exists()) return null;

    const product = mapProductDoc(snapshot.id, snapshot.data());
    if (!product.name) return null;

    return product;
  } catch (error) {
    console.error(`Failed to fetch product ${productId} for SEO:`, error);
    return null;
  }
}
