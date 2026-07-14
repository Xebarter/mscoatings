import type { Customer } from '@/lib/erp-types';
import { getAdminFirestore, getAdminTimestamp } from '@/lib/firebase-admin';

export async function listCustomers(): Promise<Customer[]> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection('customers')
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Customer, 'id'>),
  }));
}

export async function getCustomerById(customerId: string): Promise<Customer | null> {
  const db = getAdminFirestore();
  const snapshot = await db.collection('customers').doc(customerId).get();
  if (!snapshot.exists) return null;

  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<Customer, 'id'>),
  };
}

export async function createCustomer(input: {
  name: string;
  phone: string;
  email?: string;
  notes?: string;
}): Promise<string> {
  const db = getAdminFirestore();
  const Timestamp = getAdminTimestamp();

  const docRef = await db.collection('customers').add({
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim() || null,
    notes: input.notes?.trim() || null,
    totalSpent: 0,
    outstandingBalance: 0,
    loyaltyPoints: 0,
    createdAt: Timestamp.now(),
  });

  return docRef.id;
}

export async function updateCustomer(
  customerId: string,
  updates: Partial<Pick<Customer, 'name' | 'phone' | 'email' | 'notes'>>
) {
  const db = getAdminFirestore();
  await db.collection('customers').doc(customerId).update(updates);
}

export async function recordCustomerPayment(
  customerId: string,
  amount: number,
  performedBy: string
) {
  const db = getAdminFirestore();

  if (amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  await db.runTransaction(async (transaction) => {
    const customerRef = db.collection('customers').doc(customerId);
    const customerSnap = await transaction.get(customerRef);

    if (!customerSnap.exists) {
      throw new Error('Customer not found');
    }

    const customer = customerSnap.data()!;
    const currentBalance = customer.outstandingBalance ?? 0;

    if (amount > currentBalance) {
      throw new Error(
        `Payment exceeds outstanding balance of ${currentBalance}`
      );
    }

    transaction.update(customerRef, {
      outstandingBalance: currentBalance - amount,
    });
  });
}

export async function getCustomerPurchaseHistory(customerId: string) {
  const db = getAdminFirestore();

  const [salesSnap, ordersSnap] = await Promise.all([
    db.collection('sales').where('customerId', '==', customerId).get(),
    db.collection('orders').where('customerId', '==', customerId).get(),
  ]);

  const sales = salesSnap.docs.map((doc) => ({
    type: 'sale' as const,
    id: doc.id,
    ...(doc.data() as Record<string, unknown>),
  }));

  const orders = ordersSnap.docs.map((doc) => ({
    type: 'order' as const,
    id: doc.id,
    ...(doc.data() as Record<string, unknown>),
  }));

  return [...sales, ...orders].sort((a, b) => {
    const aTime = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
    const bTime = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
    return bTime - aTime;
  });
}
