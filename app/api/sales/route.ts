import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/api-auth';
import { createSale, listSales } from '@/lib/sales-server';
import { logStaffActivitySafe } from '@/lib/staff-activity-server';

export async function GET(request: NextRequest) {
  const auth = await requireStaffApi(request, 'accessPos');
  if ('error' in auth) return auth.error;

  try {
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? 100);
    const sales = await listSales(limit);
    return NextResponse.json({ sales });
  } catch (error) {
    console.error('List sales error:', error);
    return NextResponse.json({ error: 'Failed to list sales' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireStaffApi(request, 'accessPos');
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const saleId = await createSale({
      items: body.items,
      discountTotal: body.discountTotal,
      paymentMethod: body.paymentMethod,
      amountTendered: body.amountTendered,
      paymentReference: body.paymentReference,
      customerId: body.customerId,
      customerName: body.customerName,
      cashierId: auth.staff.uid,
      cashierEmail: auth.staff.email,
    });

    const itemCount = Array.isArray(body.items) ? body.items.length : 0;
    void logStaffActivitySafe({
      action: 'sale.create',
      summary: `POS sale created${body.customerName ? ` for ${body.customerName}` : ''}`,
      actorEmail: auth.staff.email,
      actorUid: auth.staff.uid,
      resourceType: 'sale',
      resourceId: saleId,
      channel: 'api',
      metrics: {
        itemCount,
        paymentMethod: body.paymentMethod ? String(body.paymentMethod) : null,
        discountTotal: Number(body.discountTotal) || 0,
      },
    });

    return NextResponse.json({ saleId }, { status: 201 });
  } catch (error) {
    console.error('Create sale error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create sale';
    const isConfigError = message.includes('FIREBASE_SERVICE_ACCOUNT_JSON');
    return NextResponse.json(
      { error: message },
      { status: isConfigError ? 503 : 400 }
    );
  }
}
