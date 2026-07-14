import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/api-auth';
import { createCustomer, listCustomers } from '@/lib/customers-server';
import { logStaffActivitySafe } from '@/lib/staff-activity-server';

export async function GET(request: NextRequest) {
  const auth = await requireStaffApi(request, 'manageCustomers');
  if ('error' in auth) return auth.error;

  try {
    const customers = await listCustomers();
    return NextResponse.json({ customers });
  } catch (error) {
    console.error('List customers error:', error);
    return NextResponse.json({ error: 'Failed to list customers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireStaffApi(request, 'manageCustomers');
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const customerId = await createCustomer({
      name: body.name,
      phone: body.phone,
      email: body.email,
      notes: body.notes,
    });

    void logStaffActivitySafe({
      action: 'customer.create',
      summary: `Created customer ${String(body.name ?? '').trim() || customerId}`,
      actorEmail: auth.staff.email,
      actorUid: auth.staff.uid,
      resourceType: 'customer',
      resourceId: customerId,
      channel: 'api',
      metrics: {
        phone: body.phone ? String(body.phone) : null,
        email: body.email ? String(body.email) : null,
      },
    });

    return NextResponse.json({ customerId }, { status: 201 });
  } catch (error) {
    console.error('Create customer error:', error);
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}
