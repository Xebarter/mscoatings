import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/api-auth';
import { recordCustomerPayment } from '@/lib/customers-server';
import { logStaffActivitySafe } from '@/lib/staff-activity-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffApi(request, 'manageCustomers');
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const amount = Number(body.amount);
    await recordCustomerPayment(id, body.amount, auth.staff.email);

    void logStaffActivitySafe({
      action: 'customer.payment',
      summary: `Recorded customer payment on ${id}`,
      actorEmail: auth.staff.email,
      actorUid: auth.staff.uid,
      resourceType: 'customer',
      resourceId: id,
      channel: 'api',
      metrics: {
        amount: Number.isFinite(amount) ? amount : null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Record payment error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to record payment';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
