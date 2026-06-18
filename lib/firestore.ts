import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { ensureFirestoreAuthReady } from './admin-auth';
import { db } from './firebase';

// Product types
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  image: string;
  createdAt: Timestamp;
}

// Order types
export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export type OrderPaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled';

export interface Order {
  id: string;
  items: OrderItem[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered';
  paymentStatus?: OrderPaymentStatus;
  paytotaPurchaseId?: string;
  paytotaReference?: string;
  paymentMethod?: string;
  paidAt?: Timestamp;
  createdAt: Timestamp;
}

export const FIRESTORE_NOT_FOUND_MESSAGE =
  'Firestore is not set up for this Firebase project. Create a Firestore database in the Firebase Console (Build → Firestore Database → Create database), then try again.';

export const FIRESTORE_PERMISSION_MESSAGE =
  'Firestore access denied. Sign in as an admin and deploy the latest security rules with: npx firebase deploy --only firestore';

function toFirestoreError(error: unknown): Error {
  if (error instanceof FirebaseError) {
    if (error.code === 'not-found') {
      return new Error(FIRESTORE_NOT_FOUND_MESSAGE);
    }
    if (error.code === 'permission-denied') {
      return new Error(FIRESTORE_PERMISSION_MESSAGE);
    }
  }

  if (
    error instanceof Error &&
    error.message.includes("Database '(default)' not found")
  ) {
    return new Error(FIRESTORE_NOT_FOUND_MESSAGE);
  }

  return error instanceof Error ? error : new Error('Firestore request failed');
}

// Products collection
export const productsCollection = collection(db, 'products');
export const ordersCollection = collection(db, 'orders');

async function ensureAdminFirestoreAccess() {
  await ensureFirestoreAuthReady();
}

// Product functions
export async function addProduct(productData: Omit<Product, 'id' | 'createdAt'>) {
  try {
    await ensureAdminFirestoreAccess();
    const docRef = await addDoc(productsCollection, {
      ...productData,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding product:', error);
    throw toFirestoreError(error);
  }
}

export async function getProducts() {
  try {
    const snapshot = await getDocs(productsCollection);
    const products: Product[] = [];
    snapshot.forEach((doc) => {
      products.push({
        id: doc.id,
        ...doc.data(),
      } as Product);
    });
    return products;
  } catch (error) {
    console.error('Error getting products:', error);
    throw toFirestoreError(error);
  }
}

export async function updateProduct(
  productId: string,
  updates: Partial<Omit<Product, 'id' | 'createdAt'>>
) {
  try {
    await ensureAdminFirestoreAccess();
    const productRef = doc(productsCollection, productId);
    await updateDoc(productRef, updates);
  } catch (error) {
    console.error('Error updating product:', error);
    throw toFirestoreError(error);
  }
}

export async function deleteProduct(productId: string) {
  try {
    await ensureAdminFirestoreAccess();
    await deleteDoc(doc(productsCollection, productId));
  } catch (error) {
    console.error('Error deleting product:', error);
    throw toFirestoreError(error);
  }
}

// Order functions
export async function createOrder(orderData: Omit<Order, 'id' | 'createdAt'>) {
  try {
    const docRef = await addDoc(ordersCollection, {
      ...orderData,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating order:', error);
    throw toFirestoreError(error);
  }
}

export async function getOrders() {
  try {
    await ensureAdminFirestoreAccess();
    const snapshot = await getDocs(ordersCollection);
    const orders: Order[] = [];
    snapshot.forEach((doc) => {
      orders.push({
        id: doc.id,
        ...doc.data(),
      } as Order);
    });
    // Sort by most recent first
    return orders.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  } catch (error) {
    console.error('Error getting orders:', error);
    throw toFirestoreError(error);
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: Order['status']
) {
  try {
    await ensureAdminFirestoreAccess();
    const orderRef = doc(ordersCollection, orderId);
    await updateDoc(orderRef, { status });
  } catch (error) {
    console.error('Error updating order:', error);
    throw toFirestoreError(error);
  }
}
