import { isAdminEmail } from '@/lib/admin-auth';
import type { Permissions, StaffRole } from '@/lib/erp-types';
import { getPermissionsForRole } from '@/lib/roles';
import { getStaffByEmail } from '@/lib/staff-server';

interface FirebaseLookupResponse {
  users?: Array<{ email?: string; localId?: string }>;
  error?: { message?: string };
}

export interface VerifiedStaff {
  uid: string;
  email: string;
  role: StaffRole;
  permissions: Permissions;
}

export async function verifyStaffIdToken(
  idToken: string
): Promise<VerifiedStaff | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      cache: 'no-store',
    }
  );

  if (!response.ok) return null;

  const data = (await response.json()) as FirebaseLookupResponse;
  const user = data.users?.[0];
  const email = user?.email;
  const uid = user?.localId;

  if (!email || !uid) return null;

  if (isAdminEmail(email)) {
    return {
      uid,
      email,
      role: 'admin',
      permissions: getPermissionsForRole('admin'),
    };
  }

  const staff = await getStaffByEmail(email);
  if (staff?.active) {
    return {
      uid,
      email: staff.email,
      role: staff.role,
      permissions: getPermissionsForRole(staff.role),
    };
  }

  return null;
}

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}
