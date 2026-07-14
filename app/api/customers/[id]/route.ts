import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/api-auth';
import {
  getCustomerById,
  getCustomerPurchaseHistory,
  updateCustomer,
} from '@/lib/customers-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffApi(request, 'manageCustomers');
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;
    const customer = await getCustomerById(id);
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const history = await getCustomerPurchaseHistory(id);
    return NextResponse.json({ customer, history });
  } catch (error) {
    console.error('Get customer error:', error);
    return NextResponse.json({ error: 'Failed to get customer' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffApi(request, 'manageCustomers');
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    await updateCustomer(id, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update customer error:', error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}
