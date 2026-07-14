import { NextRequest, NextResponse } from 'next/server';
import { getPaytotaConfig } from '@/lib/paytota/config';
import { verifyPaytotaSignature } from '@/lib/paytota/signature';
import type { PaytotaWebhookPayload } from '@/lib/paytota/types';
import {
  getOrderByReference,
  updateOrderPaymentFromPaytota,
} from '@/lib/orders-server';
import { decrementStockForOrder } from '@/lib/inventory-server';
import type { OrderPaymentStatus, OrderStatus } from '@/lib/firestore';

function mapWebhookToOrderUpdate(payload: PaytotaWebhookPayload): {
  paymentStatus: OrderPaymentStatus;
  status?: OrderStatus;
  paymentMethod?: string;
} | null {
  switch (payload.event_type) {
    case 'purchase.paid':
      return {
        paymentStatus: 'paid',
        status: 'confirmed',
        paymentMethod: payload.transaction_data?.payment_method,
      };
    case 'purchase.payment_failure':
      return { paymentStatus: 'failed' };
    case 'purchase.cancelled':
      return { paymentStatus: 'cancelled' };
    default:
      if (payload.status === 'paid') {
        return {
          paymentStatus: 'paid',
          status: 'confirmed',
          paymentMethod: payload.transaction_data?.payment_method,
        };
      }
      if (payload.status === 'error') {
        return { paymentStatus: 'failed' };
      }
      if (payload.status === 'cancelled') {
        return { paymentStatus: 'cancelled' };
      }
      return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-signature') ?? '';
    const { webhookPublicKey } = getPaytotaConfig();

    if (webhookPublicKey && !verifyPaytotaSignature(rawBody, signature, webhookPublicKey)) {
      console.error('Invalid Paytota webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as PaytotaWebhookPayload;
    const update = mapWebhookToOrderUpdate(payload);

    if (!update) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const order = await getOrderByReference(payload.reference);
    if (!order) {
      console.warn('Paytota webhook: order not found for reference', payload.reference);
      return NextResponse.json({ received: true, orderNotFound: true });
    }

    if (order.paymentStatus === 'paid' && update.paymentStatus === 'paid') {
      return NextResponse.json({ received: true, alreadyPaid: true });
    }

    await updateOrderPaymentFromPaytota(order.id, update);

    if (update.paymentStatus === 'paid') {
      try {
        await decrementStockForOrder(
          order.id,
          order.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          'paytota-webhook'
        );
      } catch (stockError) {
        console.error('Stock deduction failed for order', order.id, stockError);
      }
    }

    return NextResponse.json({ received: true, orderId: order.id });
  } catch (error) {
    console.error('Paytota webhook error:', error);

    if (
      error instanceof Error &&
      error.message.includes('FIREBASE_SERVICE_ACCOUNT_JSON')
    ) {
      return NextResponse.json(
        {
          error:
            'Server cannot update orders. Configure FIREBASE_SERVICE_ACCOUNT_JSON.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
