import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    const orderId = new URL(request.url).searchParams.get('id');

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const snapshot = await getDoc(doc(db, 'orders', orderId));
    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const data = snapshot.data();

    return NextResponse.json({
      id: snapshot.id,
      status: data.status,
      paymentStatus: data.paymentStatus ?? 'pending',
      totalPrice: data.totalPrice,
      customerName: data.customerName,
      createdAt: data.createdAt,
      paidAt: data.paidAt ?? null,
    });
  } catch (error) {
    console.error('Order status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order status' },
      { status: 500 }
    );
  }
}
