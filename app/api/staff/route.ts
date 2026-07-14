import { NextRequest, NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/api-auth';
import {
  createStaffMember,
  deleteStaffMember,
  listStaff,
  updateStaffMember,
} from '@/lib/staff-server';
import type { StaffRole } from '@/lib/erp-types';

export async function GET(request: NextRequest) {
  const auth = await requireStaffApi(request, 'manageStaff');
  if ('error' in auth) return auth.error;

  try {
    const staff = await listStaff();
    return NextResponse.json({ staff });
  } catch (error) {
    console.error('List staff error:', error);
    return NextResponse.json({ error: 'Failed to list staff' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireStaffApi(request, 'manageStaff');
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const staffId = await createStaffMember({
      email: body.email,
      displayName: body.displayName,
      role: body.role as StaffRole,
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
    await updateStaffMember(body.staffId, {
      displayName: body.displayName,
      role: body.role,
      active: body.active,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update staff error:', error);
    return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 });
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
    await deleteStaffMember(staffId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete staff error:', error);
    return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 });
  }
}
