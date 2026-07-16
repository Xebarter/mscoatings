import { getBearerToken, verifyStaffIdToken } from '@/lib/verify-staff-token';
import type { Permissions } from '@/lib/erp-types';
import { NextResponse } from 'next/server';

export async function requireStaffApi(
  request: Request,
  permission?: keyof Permissions
) {
  const token = getBearerToken(request);
  if (!token) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  try {
    const staff = await verifyStaffIdToken(token);
    if (!staff) {
      return {
        error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      };
    }

    if (permission && !staff.permissions[permission]) {
      return {
        error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }),
      };
    }

    return { staff };
  } catch (error) {
    console.error('Staff API auth error:', error);
    const message =
      error instanceof Error ? error.message : 'Authentication failed';
    const isConfigError =
      /FIREBASE_SERVICE_ACCOUNT|Firebase Admin is not configured/i.test(message);
    return {
      error: NextResponse.json(
        { error: message },
        { status: isConfigError ? 503 : 500 }
      ),
    };
  }
}
