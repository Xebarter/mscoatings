import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/api-auth';
import {
  assertCanViewActivity,
  listStaffActivity,
  logStaffActivity,
} from '@/lib/staff-activity-server';
import type {
  StaffActivityAction,
  StaffActivityChannel,
  StaffActivityLog,
} from '@/lib/erp-types';

export const runtime = 'nodejs';

const ACTIONS = new Set<StaffActivityAction>([
  'sale.create',
  'sale.void',
  'sale.refund',
  'inventory.adjust',
  'order.status_change',
  'message.status_change',
  'field_agent.create',
  'field_agent.update',
  'field_pick.create',
  'field_pick.submit_report',
  'product.create',
  'product.update',
  'product.delete',
  'staff.create',
  'staff.update',
  'staff.delete',
  'customer.create',
  'customer.update',
  'customer.payment',
  'expense.create',
  'expense.update',
  'expense.delete',
  'credit.customer_create',
  'credit.customer_update',
  'credit.purchase_create',
  'credit.payment_record',
  'credit.deposit_record',
  'credit.wallet_apply',
]);

const CHANNELS = new Set<StaffActivityChannel>([
  'web_admin',
  'desktop',
  'api',
  'system',
]);

/** Super Admin activity feed */
export async function GET(request: NextRequest) {
  const auth = await requireStaffApi(request);
  if ('error' in auth) return auth.error;

  if (!(await assertCanViewActivity(auth.staff.email))) {
    return NextResponse.json(
      { error: 'Only a Super Admin can view the staff activity log.' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = request.nextUrl;
    const limit = Number(searchParams.get('limit') ?? '100');
    const action = (searchParams.get('action') ?? 'all') as
      | StaffActivityAction
      | 'all';
    const category = (searchParams.get('category') ?? 'all') as
      | StaffActivityLog['category']
      | 'all';
    const actorEmail = searchParams.get('actor') ?? undefined;

    const activities = await listStaffActivity({
      limit: Number.isFinite(limit) ? limit : 100,
      action,
      category,
      actorEmail: actorEmail ?? undefined,
    });

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('List staff activity error:', error);
    return NextResponse.json(
      { error: 'Failed to load activity log' },
      { status: 500 }
    );
  }
}

/** Any authenticated staff can append an activity entry for their own actions. */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApi(request);
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const action = body.action as StaffActivityAction;
    const summary = String(body.summary ?? '').trim();

    if (!ACTIONS.has(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    if (summary.length < 3 || summary.length > 500) {
      return NextResponse.json({ error: 'Invalid summary' }, { status: 400 });
    }

    const channel = (body.channel as StaffActivityChannel) ?? 'web_admin';
    if (!CHANNELS.has(channel)) {
      return NextResponse.json({ error: 'Invalid channel' }, { status: 400 });
    }

    const id = await logStaffActivity({
      action,
      summary,
      actorEmail: auth.staff.email,
      actorUid: auth.staff.uid,
      actorDisplayName: body.actorDisplayName
        ? String(body.actorDisplayName)
        : undefined,
      resourceType: body.resourceType ? String(body.resourceType) : undefined,
      resourceId: body.resourceId ? String(body.resourceId) : undefined,
      channel,
      metrics:
        body.metrics && typeof body.metrics === 'object'
          ? (body.metrics as Record<string, string | number | boolean | null>)
          : undefined,
      metadata:
        body.metadata && typeof body.metadata === 'object'
          ? (body.metadata as Record<string, unknown>)
          : undefined,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error('Create staff activity error:', error);
    return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 });
  }
}
