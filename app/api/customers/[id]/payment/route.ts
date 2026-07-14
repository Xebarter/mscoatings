import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/api-auth';
import { recordCustomerPayment } from '@/lib/customers-server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffApi(request, 'manageCustomers');
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    await recordCustomerPayment(id, body.amount, auth.staff.email);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Record payment error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to record payment';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
