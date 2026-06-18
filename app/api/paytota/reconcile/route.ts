import { NextRequest, NextResponse } from 'next/server';
import { getPaytotaPurchase } from '@/lib/paytota/client';
import {
  listPendingPaymentOrders,
  updateOrderPaymentFromPaytota,
} from '@/lib/orders-server';

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pendingOrders = await listPendingPaymentOrders();
    const results: Array<{ orderId: string; purchaseId: string; status: string }> =
      [];

    for (const order of pendingOrders) {
      if (!order.paytotaPurchaseId) continue;

      const purchase = await getPaytotaPurchase(order.paytotaPurchaseId);

      if (purchase.status === 'paid') {
        await updateOrderPaymentFromPaytota(order.id, {
          paymentStatus: 'paid',
          status: 'confirmed',
        });
        results.push({
          orderId: order.id,
          purchaseId: order.paytotaPurchaseId,
          status: 'paid',
        });
      } else if (purchase.status === 'error' || purchase.status === 'cancelled') {
        await updateOrderPaymentFromPaytota(order.id, {
          paymentStatus: purchase.status === 'cancelled' ? 'cancelled' : 'failed',
        });
        results.push({
          orderId: order.id,
          purchaseId: order.paytotaPurchaseId,
          status: purchase.status,
        });
      }
    }

    return NextResponse.json({
      reconciled: results.length,
      results,
    });
  } catch (error) {
    console.error('Paytota reconcile error:', error);
    return NextResponse.json(
      { error: 'Failed to reconcile payments' },
      { status: 500 }
    );
  }
}
