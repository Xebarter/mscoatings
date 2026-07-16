import { isAdminEmail } from '@/lib/admin-emails';
import { getAdminAuth } from '@/lib/firebase-admin';
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
  isSuperAdmin: boolean;
}

async function lookupUserFromIdToken(
  idToken: string
): Promise<{ uid: string; email: string } | null> {
  // Prefer Admin SDK (local cert verification) — avoids flaky Identity Toolkit HTTP timeouts.
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    if (decoded.email && decoded.uid) {
      return { uid: decoded.uid, email: decoded.email };
    }
  } catch {
    /* fall through to Identity Toolkit REST */
  }

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
  return { uid, email };
}

function toVerifiedStaff(
  uid: string,
  email: string,
  role: StaffRole,
  isSuperAdmin: boolean
): VerifiedStaff {
  const effectiveRole: StaffRole = isSuperAdmin ? 'admin' : role;
  return {
    uid,
    email,
    role: effectiveRole,
    permissions: getPermissionsForRole(effectiveRole),
    isSuperAdmin,
  };
}

export async function verifyStaffIdToken(
  idToken: string
): Promise<VerifiedStaff | null> {
  const identity = await lookupUserFromIdToken(idToken);
  if (!identity) return null;

  const { uid, email } = identity;

  if (isAdminEmail(email)) {
    return toVerifiedStaff(uid, email, 'admin', true);
  }

  const staff = await getStaffByEmail(email);
  if (staff?.active) {
    return toVerifiedStaff(
      uid,
      staff.email,
      staff.role,
      Boolean(staff.isSuperAdmin)
    );
  }

  return null;
}

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}
