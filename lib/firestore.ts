import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { ensureFirestoreAuthReady } from './admin-auth';
import { db } from './firebase';
import type { Customer, Sale, Staff, StockMovement } from './erp-types';
import { logClientActivity } from '@/lib/staff-activity-client';

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered';

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
  barcode?: string;
  sku?: string;
  brand?: string;
  paintType?: string;
  colourCode?: string;
  sizeVolume?: string;
  packagingUnit?: string;
  costPrice?: number;
  reorderLevel?: number;
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
  status: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  paytotaPurchaseId?: string;
  paytotaReference?: string;
  paymentMethod?: string;
  paidAt?: Timestamp;
  customerId?: string;
  stockDeducted?: boolean;
  createdAt: Timestamp;
}

export const FIRESTORE_NOT_FOUND_MESSAGE =
  'Firestore is not set up for this Firebase project. Create a Firestore database in the Firebase Console (Build → Firestore Database → Create database), then try again.';

export const FIRESTORE_PERMISSION_MESSAGE =
  'Firestore access denied. Sign in as an admin and deploy the latest security rules with: npx firebase deploy --only firestore';

export function toFirestoreError(error: unknown): Error {
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

// Collections
export const productsCollection = collection(db, 'products');
export const ordersCollection = collection(db, 'orders');
export const customersCollection = collection(db, 'customers');
export const staffCollection = collection(db, 'staff');
export const stockMovementsCollection = collection(db, 'stockMovements');
export const salesCollection = collection(db, 'sales');

async function ensureAdminFirestoreAccess() {
  await ensureFirestoreAuthReady();
}

// Product functions
export async function addProduct(productData: Omit<Product, 'id' | 'createdAt'>) {
  try {
    await ensureAdminFirestoreAccess();
    const docRef = await addDoc(productsCollection, {
      ...productData,
      reorderLevel: productData.reorderLevel ?? 5,
      costPrice: productData.costPrice ?? 0,
      createdAt: Timestamp.now(),
    });
    logClientActivity({
      action: 'product.create',
      summary: `Created product ${productData.name}`,
      resourceType: 'product',
      resourceId: docRef.id,
      channel: 'web_admin',
      metrics: {
        price: productData.price,
        stock: productData.stock,
        category: productData.category,
      },
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
    snapshot.forEach((docSnap) => {
      products.push({
        id: docSnap.id,
        ...docSnap.data(),
      } as Product);
    });
    return products;
  } catch (error) {
    console.error('Error getting products:', error);
    throw toFirestoreError(error);
  }
}

export async function getProductByBarcode(barcode: string): Promise<Product | null> {
  try {
    const q = query(productsCollection, where('barcode', '==', barcode.trim()));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Product;
  } catch (error) {
    console.error('Error getting product by barcode:', error);
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
    logClientActivity({
      action: 'product.update',
      summary: `Updated product ${updates.name ?? productId}`,
      resourceType: 'product',
      resourceId: productId,
      channel: 'web_admin',
      metrics: {
        price: updates.price ?? null,
        stock: updates.stock ?? null,
        category: updates.category ?? null,
      },
    });
  } catch (error) {
    console.error('Error updating product:', error);
    throw toFirestoreError(error);
  }
}

export async function deleteProduct(productId: string) {
  try {
    await ensureAdminFirestoreAccess();
    await deleteDoc(doc(productsCollection, productId));
    logClientActivity({
      action: 'product.delete',
      summary: `Deleted product ${productId}`,
      resourceType: 'product',
      resourceId: productId,
      channel: 'web_admin',
    });
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
    snapshot.forEach((docSnap) => {
      orders.push({
        id: docSnap.id,
        ...docSnap.data(),
      } as Order);
    });
    return orders.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  } catch (error) {
    console.error('Error getting orders:', error);
    throw toFirestoreError(error);
  }
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  try {
    await ensureAdminFirestoreAccess();
    const snapshot = await getDoc(doc(ordersCollection, orderId));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as Order;
  } catch (error) {
    console.error('Error getting order:', error);
    throw toFirestoreError(error);
  }
}

export async function updateOrderStatus(orderId: string, status: Order['status']) {
  try {
    await ensureAdminFirestoreAccess();
    const orderRef = doc(ordersCollection, orderId);
    await updateDoc(orderRef, { status });
    logClientActivity({
      action: 'order.status_change',
      summary: `Order status → ${status}`,
      resourceType: 'order',
      resourceId: orderId,
      channel: 'web_admin',
      metrics: { status },
    });
  } catch (error) {
    console.error('Error updating order:', error);
    throw toFirestoreError(error);
  }
}

// Customer functions (client read)
export async function getCustomers(): Promise<Customer[]> {
  try {
    await ensureAdminFirestoreAccess();
    const snapshot = await getDocs(customersCollection);
    return snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }) as Customer)
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  } catch (error) {
    console.error('Error getting customers:', error);
    throw toFirestoreError(error);
  }
}

export async function getCustomerByIdClient(customerId: string): Promise<Customer | null> {
  try {
    await ensureAdminFirestoreAccess();
    const snapshot = await getDoc(doc(customersCollection, customerId));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as Customer;
  } catch (error) {
    console.error('Error getting customer:', error);
    throw toFirestoreError(error);
  }
}

// Staff functions (client read)
export async function getStaffMembers(): Promise<Staff[]> {
  try {
    await ensureAdminFirestoreAccess();
    const snapshot = await getDocs(staffCollection);
    return snapshot.docs
      .map(
        (docSnap) =>
          ({
            id: docSnap.id,
            ...docSnap.data(),
          }) as Staff
      )
      .sort((a, b) => {
        const aMs =
          a.createdAt && typeof a.createdAt.toMillis === 'function'
            ? a.createdAt.toMillis()
            : 0;
        const bMs =
          b.createdAt && typeof b.createdAt.toMillis === 'function'
            ? b.createdAt.toMillis()
            : 0;
        return bMs - aMs;
      });
  } catch (error) {
    console.error('Error getting staff:', error);
    throw toFirestoreError(error);
  }
}

export async function getStaffByEmailClient(email: string): Promise<Staff | null> {
  try {
    const normalized = email.trim().toLowerCase();
    // Prefer direct doc get (works for pending users reading their own record)
    const id = normalized.replace('@', '_at_').replace(/\./g, '_dot_');
    const byId = await getDoc(doc(staffCollection, id));
    if (byId.exists()) {
      return { id: byId.id, ...byId.data() } as Staff;
    }

    const q = query(staffCollection, where('email', '==', normalized));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Staff;
  } catch (error) {
    console.error('Error getting staff by email:', error);
    throw toFirestoreError(error);
  }
}

export async function listSalesClient(limitCount = 500): Promise<Sale[]> {
  try {
    await ensureAdminFirestoreAccess();
    const q = query(
      collection(db, 'sales'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(
      (docSnap) =>
        ({
          id: docSnap.id,
          ...docSnap.data(),
        }) as Sale
    );
  } catch (error) {
    console.error('Error listing sales:', error);
    throw toFirestoreError(error);
  }
}

// Stock movements (client read)
export async function getStockMovementsClient(options?: {
  productId?: string;
  limit?: number;
}): Promise<StockMovement[]> {
  try {
    await ensureAdminFirestoreAccess();
    const max = options?.limit ?? 50;
    const q = options?.productId
      ? query(
          stockMovementsCollection,
          where('productId', '==', options.productId),
          orderBy('createdAt', 'desc'),
          limit(max)
        )
      : query(
          stockMovementsCollection,
          orderBy('createdAt', 'desc'),
          limit(max)
        );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(
      (docSnap) =>
        ({
          id: docSnap.id,
          ...docSnap.data(),
        }) as StockMovement
    );
  } catch (error) {
    console.error('Error getting stock movements:', error);
    throw toFirestoreError(error);
  }
}
