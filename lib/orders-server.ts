import type { OrderItem, OrderPaymentStatus, OrderStatus } from '@/lib/firestore';
import { getAdminFirestore, getAdminTimestamp } from '@/lib/firebase-admin';

export interface ServerOrder {
  id: string;
  items: OrderItem[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalPrice: number;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  paytotaPurchaseId?: string;
  paytotaReference?: string;
  paymentMethod?: string;
  createdAt: FirebaseFirestore.Timestamp;
  paidAt?: FirebaseFirestore.Timestamp;
}

export async function getOrderById(orderId: string): Promise<ServerOrder | null> {
  const db = getAdminFirestore();
  const snapshot = await db.collection('orders').doc(orderId).get();
  if (!snapshot.exists) return null;

  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<ServerOrder, 'id'>),
  };
}

export async function getOrderByReference(
  reference: string
): Promise<ServerOrder | null> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection('orders')
    .where('paytotaReference', '==', reference)
    .limit(1)
    .get();

  if (snapshot.empty) {
    const byId = await getOrderById(reference);
    return byId;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...(doc.data() as Omit<ServerOrder, 'id'>),
  };
}

export async function updateOrderPaymentFromPaytota(
  orderId: string,
  update: {
    paymentStatus: OrderPaymentStatus;
    status?: OrderStatus;
    paymentMethod?: string;
    paidAt?: FirebaseFirestore.Timestamp;
  }
) {
  const db = getAdminFirestore();
  const Timestamp = getAdminTimestamp();

  const payload: Record<string, unknown> = {
    paymentStatus: update.paymentStatus,
  };

  if (update.status) payload.status = update.status;
  if (update.paymentMethod) payload.paymentMethod = update.paymentMethod;
  if (update.paidAt) payload.paidAt = update.paidAt;
  if (update.paymentStatus === 'paid' && !update.paidAt) {
    payload.paidAt = Timestamp.now();
  }

  await db.collection('orders').doc(orderId).update(payload);
}

export async function listPendingPaymentOrders(): Promise<ServerOrder[]> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection('orders')
    .where('paymentStatus', '==', 'pending')
    .get();

  return snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<ServerOrder, 'id'>),
    }))
    .filter((order) => Boolean(order.paytotaPurchaseId));
}

export async function countPendingOrders(): Promise<number> {
  const db = getAdminFirestore();
  const snap = await db
    .collection('orders')
    .where('status', '==', 'pending')
    .count()
    .get();
  return snap.data().count;
}
