import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/api-auth';
import { countNewContactMessages } from '@/lib/messages-server';
import { countPendingOrders } from '@/lib/orders-server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireStaffApi(request);
  if ('error' in auth) return auth.error;

  try {
    const [pendingOrders, newMessages] = await Promise.all([
      countPendingOrders(),
      auth.staff.permissions.viewMessages
        ? countNewContactMessages()
        : Promise.resolve(0),
    ]);

    return NextResponse.json({
      pendingOrders,
      newMessages,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Admin alerts error:', error);
    return NextResponse.json({ error: 'Failed to load alerts' }, { status: 500 });
  }
}
