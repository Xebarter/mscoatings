import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  addDoc,
  Timestamp,
  doc,
  getDoc,
  updateDoc,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const ordersCollection = collection(db, 'orders');

// GET all orders or a specific order
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('id');

    if (orderId) {
      const docRef = doc(db, 'orders', orderId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return NextResponse.json({
          id: docSnap.id,
          ...docSnap.data(),
        });
      } else {
        return NextResponse.json(
          { error: 'Order not found' },
          { status: 404 }
        );
      }
    }

    // Get all orders
    const querySnapshot = await getDocs(ordersCollection);
    const orders = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort by most recent first
    orders.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

// POST - Create a new order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, customerName, customerEmail, customerPhone, totalPrice } =
      body;

    // Validation
    if (!items || !customerName || !customerEmail || totalPrice === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const docRef = await addDoc(ordersCollection, {
      items,
      customerName,
      customerEmail,
      customerPhone: customerPhone || '',
      totalPrice: parseFloat(totalPrice),
      status: 'pending',
      createdAt: Timestamp.now(),
    });

    return NextResponse.json(
      {
        id: docRef.id,
        items,
        customerName,
        customerEmail,
        totalPrice,
        status: 'pending',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}

// PUT - Update an order (e.g., status)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    const docRef = doc(db, 'orders', id);
    await updateDoc(docRef, { status });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}
