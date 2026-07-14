import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/api-auth';
import {
  getContactMessage,
  updateContactMessageStatus,
} from '@/lib/messages-server';
import { logStaffActivitySafe } from '@/lib/staff-activity-server';
import type { ContactMessageStatus } from '@/lib/erp-types';

const ALLOWED: ContactMessageStatus[] = ['new', 'read', 'replied', 'archived'];

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffApi(request, 'viewMessages');
  if ('error' in auth) return auth.error;

  try {
    const { id } = await context.params;
    const message = await getContactMessage(id);
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    return NextResponse.json({ message });
  } catch (error) {
    console.error('Get message error:', error);
    return NextResponse.json({ error: 'Failed to load message' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffApi(request, 'viewMessages');
  if ('error' in auth) return auth.error;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const status = body.status as ContactMessageStatus;
    if (!ALLOWED.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const previous = await getContactMessage(id);
    const message = await updateContactMessageStatus(
      id,
      status,
      auth.staff.email,
      typeof body.adminNotes === 'string' ? body.adminNotes : undefined
    );

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    void logStaffActivitySafe({
      action: 'message.status_change',
      summary: `Message marked as ${status}: ${message.subject}`,
      actorEmail: auth.staff.email,
      actorUid: auth.staff.uid,
      resourceType: 'contactMessage',
      resourceId: id,
      channel: 'api',
      metrics: {
        fromStatus: previous?.status ?? null,
        toStatus: status,
        sender: message.email,
      },
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Update message error:', error);
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
  }
}
