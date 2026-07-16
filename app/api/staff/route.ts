import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/api-auth';
import {
  createStaffMember,
  deleteStaffMember,
  emailHasSuperAdminAccess,
  listStaff,
  updateStaffMember,
} from '@/lib/staff-server';
import { logStaffActivitySafe } from '@/lib/staff-activity-server';
import type { StaffRole } from '@/lib/erp-types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await requireStaffApi(request, 'manageStaff');
  if ('error' in auth) return auth.error;

  try {
    const staff = await listStaff();
    const actorIsSuperAdmin = await emailHasSuperAdminAccess(auth.staff.email);
    const serialized = staff.map((member) => ({
      ...member,
      createdAt:
        member.createdAt &&
        typeof (member.createdAt as { toDate?: () => Date }).toDate === 'function'
          ? (member.createdAt as { toDate: () => Date }).toDate().toISOString()
          : member.createdAt,
    }));
    return NextResponse.json({ staff: serialized, actorIsSuperAdmin });
  } catch (error) {
    console.error('List staff error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to list staff';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireStaffApi(request, 'manageStaff');
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const wantsSuper = body.isSuperAdmin === true;
    const role = body.role as StaffRole;

    if ((wantsSuper || role === 'admin') && !(await emailHasSuperAdminAccess(auth.staff.email))) {
      return NextResponse.json(
        { error: 'Only a Super Admin can create Admin or Super Admin accounts.' },
        { status: 403 }
      );
    }

    const staffId = await createStaffMember({
      email: body.email,
      displayName: body.displayName,
      role,
      isSuperAdmin: wantsSuper,
    });

    void logStaffActivitySafe({
      action: 'staff.create',
      summary: `Created staff ${body.displayName} (${body.email}) as ${role}${wantsSuper ? ' · Super Admin' : ''}`,
      actorEmail: auth.staff.email,
      actorUid: auth.staff.uid,
      resourceType: 'staff',
      resourceId: staffId,
      channel: 'api',
      metrics: {
        role,
        isSuperAdmin: wantsSuper,
        email: String(body.email ?? ''),
      },
    });

    return NextResponse.json({ staffId }, { status: 201 });
  } catch (error) {
    console.error('Create staff error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to create staff member';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireStaffApi(request, 'manageStaff');
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    await updateStaffMember(
      body.staffId,
      {
        displayName: body.displayName,
        role: body.role,
        active: body.active,
        isSuperAdmin: body.isSuperAdmin,
      },
      auth.staff.email
    );

    const parts: string[] = [];
    if (body.active === true) parts.push('granted access');
    if (body.active === false) parts.push('revoked access');
    if (body.role) parts.push(`role → ${body.role}`);
    if (body.isSuperAdmin === true) parts.push('made Super Admin');
    if (body.isSuperAdmin === false) parts.push('removed Super Admin');
    if (body.displayName) parts.push('renamed');

    void logStaffActivitySafe({
      action: 'staff.update',
      summary: `Updated staff ${body.displayName ?? body.staffId}${parts.length ? `: ${parts.join(', ')}` : ''}`,
      actorEmail: auth.staff.email,
      actorUid: auth.staff.uid,
      resourceType: 'staff',
      resourceId: String(body.staffId),
      channel: 'api',
      metrics: {
        role: body.role ?? null,
        active: body.active ?? null,
        isSuperAdmin: body.isSuperAdmin ?? null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update staff error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to update staff';
    const status =
      message.includes('Only a Super Admin') || message.includes('cannot') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireStaffApi(request, 'manageStaff');
  if ('error' in auth) return auth.error;

  try {
    const staffId = request.nextUrl.searchParams.get('id');
    if (!staffId) {
      return NextResponse.json({ error: 'Staff ID required' }, { status: 400 });
    }
    await deleteStaffMember(staffId, auth.staff.email);

    void logStaffActivitySafe({
      action: 'staff.delete',
      summary: `Removed staff record ${staffId}`,
      actorEmail: auth.staff.email,
      actorUid: auth.staff.uid,
      resourceType: 'staff',
      resourceId: staffId,
      channel: 'api',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete staff error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to delete staff';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
