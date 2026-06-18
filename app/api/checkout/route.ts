import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { ordersCollection, type OrderItem } from '@/lib/firestore';
import {
  appendOrderIdToUrl,
  getPaytotaConfig,
  normalizePhone,
} from '@/lib/paytota/config';
import { createPaytotaPurchase } from '@/lib/paytota/client';

interface CheckoutRequestBody {
  items: OrderItem[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalPrice: number;
}

function buildPaytotaProducts(items: OrderItem[], subtotal: number) {
  const lineItems = items.map((item) => ({
    name: `${item.productName} x${item.quantity}`,
    price: String(Math.round(item.price * item.quantity)),
  }));

  const tax = Math.round(subtotal * 0.1);
  if (tax > 0) {
    lineItems.push({
      name: 'Tax (10%)',
      price: String(tax),
    });
  }

  return lineItems;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CheckoutRequestBody;
    const { items, customerName, customerEmail, customerPhone, totalPrice } =
      body;

    if (
      !items?.length ||
      !customerName?.trim() ||
      !customerEmail?.trim() ||
      !customerPhone?.trim() ||
      totalPrice === undefined
    ) {
      return NextResponse.json(
        { error: 'Missing required checkout fields' },
        { status: 400 }
      );
    }

    const config = getPaytotaConfig();
    const orderReference = randomUUID();
    const orderRef = doc(ordersCollection);
    const orderId = orderRef.id;
    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const expectedTotal = Math.round(subtotal * 1.1);

    if (Math.round(totalPrice) !== expectedTotal) {
      return NextResponse.json(
        { error: 'Order total mismatch. Please refresh and try again.' },
        { status: 400 }
      );
    }

    const purchase = await createPaytotaPurchase({
      reference: orderReference,
      client: {
        email: customerEmail.trim(),
        phone: normalizePhone(customerPhone, config.country),
        country: config.country,
        full_name: customerName.trim(),
      },
      products: buildPaytotaProducts(items, subtotal),
      currency: config.currency,
      successRedirect: appendOrderIdToUrl(config.successRedirect, orderId),
      failureRedirect: appendOrderIdToUrl(config.failureRedirect, orderId),
      cancelRedirect: appendOrderIdToUrl(config.cancelRedirect, orderId),
    });

    await setDoc(orderRef, {
      items,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      totalPrice: expectedTotal,
      status: 'pending',
      paymentStatus: 'pending',
      paytotaPurchaseId: purchase.id,
      paytotaReference: orderReference,
      createdAt: Timestamp.now(),
    });

    return NextResponse.json(
      {
        orderId,
        checkoutUrl: purchase.checkout_url,
        successUrl: appendOrderIdToUrl(config.successRedirect, orderId),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Checkout error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to start payment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
