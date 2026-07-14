import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/api-auth';
import { adjustStock } from '@/lib/inventory-server';
import type { StockMovementType } from '@/lib/erp-types';

export async function POST(request: NextRequest) {
  const auth = await requireStaffApi(request, 'adjustStock');
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const result = await adjustStock({
      productId: body.productId,
      type: body.type as StockMovementType,
      quantity: body.quantity,
      reason: body.reason ?? '',
      performedBy: auth.staff.email,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Adjust stock error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to adjust stock';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
