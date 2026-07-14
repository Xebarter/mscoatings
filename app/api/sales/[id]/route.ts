import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/api-auth';
import { getSaleById, refundOrCancelSale, voidSale } from '@/lib/sales-server';
import { logStaffActivitySafe } from '@/lib/staff-activity-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffApi(request, 'accessPos');
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;
    const sale = await getSaleById(id);
    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }
    return NextResponse.json({ sale });
  } catch (error) {
    console.error('Get sale error:', error);
    return NextResponse.json({ error: 'Failed to get sale' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffApi(request, 'processRefunds');
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const action = body.action as 'refunded' | 'cancelled';

    if (action !== 'refunded' && action !== 'cancelled') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (action === 'cancelled') {
      await voidSale(id);
      void logStaffActivitySafe({
        action: 'sale.void',
        summary: `Voided sale ${id}`,
        actorEmail: auth.staff.email,
        actorUid: auth.staff.uid,
        resourceType: 'sale',
        resourceId: id,
        channel: 'api',
      });
    } else {
      await refundOrCancelSale(id, action, auth.staff.email);
      void logStaffActivitySafe({
        action: 'sale.refund',
        summary: `Refunded sale ${id}`,
        actorEmail: auth.staff.email,
        actorUid: auth.staff.uid,
        resourceType: 'sale',
        resourceId: id,
        channel: 'api',
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Refund/cancel sale error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to update sale';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
