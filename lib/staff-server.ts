import type { Staff, StaffRole } from '@/lib/erp-types';
import { isAdminEmail } from '@/lib/admin-auth';
import { getAdminFirestore, getAdminTimestamp } from '@/lib/firebase-admin';

function staffDocId(email: string): string {
  return email.trim().toLowerCase().replace('@', '_at_').replace(/\./g, '_dot_');
}

export async function getStaffByEmail(email: string): Promise<Staff | null> {
  const db = getAdminFirestore();
  const normalized = email.trim().toLowerCase();
  const docRef = db.collection('staff').doc(staffDocId(normalized));
  const snapshot = await docRef.get();

  if (snapshot.exists) {
    return {
      id: snapshot.id,
      ...(snapshot.data() as Omit<Staff, 'id'>),
    };
  }

  // Legacy docs may use auto-generated IDs
  const byEmail = await db
    .collection('staff')
    .where('email', '==', normalized)
    .limit(1)
    .get();
  if (byEmail.empty) return null;

  const doc = byEmail.docs[0]!;
  return {
    id: doc.id,
    ...(doc.data() as Omit<Staff, 'id'>),
  };
}

export async function listStaff(): Promise<Staff[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection('staff').get();
  return snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Staff, 'id'>),
    }))
    .sort((a, b) => {
      const aMs =
        a.createdAt && typeof (a.createdAt as { toMillis?: () => number }).toMillis === 'function'
          ? (a.createdAt as { toMillis: () => number }).toMillis()
          : 0;
      const bMs =
        b.createdAt && typeof (b.createdAt as { toMillis?: () => number }).toMillis === 'function'
          ? (b.createdAt as { toMillis: () => number }).toMillis()
          : 0;
      return bMs - aMs;
    });
}

export function isBootstrapSuperAdmin(email: string | null | undefined): boolean {
  return isAdminEmail(email);
}

export function isStaffSuperAdmin(staff: Staff | null | undefined): boolean {
  return Boolean(staff?.active && staff.isSuperAdmin);
}

/** Env bootstrap OR staff document marked Super Admin. */
export async function emailHasSuperAdminAccess(email: string): Promise<boolean> {
  if (isBootstrapSuperAdmin(email)) return true;
  const staff = await getStaffByEmail(email);
  return isStaffSuperAdmin(staff);
}

export async function createStaffMember(input: {
  email: string;
  displayName: string;
  role: StaffRole;
  active?: boolean;
  isSuperAdmin?: boolean;
}): Promise<string> {
  const db = getAdminFirestore();
  const Timestamp = getAdminTimestamp();
  const normalized = input.email.trim().toLowerCase();

  const existing = await getStaffByEmail(normalized);
  if (existing?.active) {
    throw new Error('A staff member with this email already exists.');
  }

  const isSuperAdmin = input.isSuperAdmin === true;
  const role: StaffRole = isSuperAdmin ? 'admin' : input.role;

  const docRef = db.collection('staff').doc(staffDocId(normalized));
  await docRef.set({
    email: normalized,
    displayName: input.displayName.trim(),
    role,
    isSuperAdmin,
    active: input.active ?? true,
    createdAt: existing?.createdAt ?? Timestamp.now(),
  });

  return docRef.id;
}

/** Self-service registration from desktop app — pending until super admin approves. */
export async function requestStaffAccess(input: {
  email: string;
  displayName: string;
}): Promise<{ staffId: string; status: 'pending' | 'already_pending' | 'already_active' }> {
  const normalized = input.email.trim().toLowerCase();
  const existing = await getStaffByEmail(normalized);

  if (existing?.active) {
    return { staffId: existing.id, status: 'already_active' };
  }

  if (existing && !existing.active) {
    return { staffId: existing.id, status: 'already_pending' };
  }

  const staffId = await createStaffMember({
    email: normalized,
    displayName: input.displayName,
    role: 'sales',
    active: false,
    isSuperAdmin: false,
  });

  return { staffId, status: 'pending' };
}

export async function updateStaffMember(
  staffId: string,
  updates: Partial<Pick<Staff, 'displayName' | 'role' | 'active' | 'isSuperAdmin'>>,
  actorEmail: string
) {
  const db = getAdminFirestore();
  const docRef = db.collection('staff').doc(staffId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    throw new Error('Staff member not found');
  }

  const target = {
    id: snapshot.id,
    ...(snapshot.data() as Omit<Staff, 'id'>),
  };

  const actorIsSuper =
    isBootstrapSuperAdmin(actorEmail) ||
    isStaffSuperAdmin(await getStaffByEmail(actorEmail));

  const nextRole = updates.role ?? target.role;
  const nextIsSuperAdmin =
    updates.isSuperAdmin !== undefined ? updates.isSuperAdmin : Boolean(target.isSuperAdmin);

  // Only Super Admins can assign Admin role or Super Admin flag
  if (
    (nextRole === 'admin' && target.role !== 'admin') ||
    (nextIsSuperAdmin && !target.isSuperAdmin) ||
    (updates.isSuperAdmin === false && target.isSuperAdmin) ||
    (target.role === 'admin' && nextRole !== 'admin')
  ) {
    if (!actorIsSuper) {
      throw new Error('Only a Super Admin can change Admin or Super Admin status.');
    }
  }

  // Cannot demote/revoke yourself if you are a Super Admin
  if (target.email === actorEmail.toLowerCase()) {
    if (updates.active === false) {
      throw new Error('You cannot revoke your own access.');
    }
    if (updates.isSuperAdmin === false && target.isSuperAdmin) {
      throw new Error('You cannot remove your own Super Admin status.');
    }
    if (target.role === 'admin' && nextRole !== 'admin') {
      throw new Error('You cannot demote your own Admin role.');
    }
  }

  // Bootstrap env Super Admins cannot be demoted via staff doc (they may not even have one)
  if (isBootstrapSuperAdmin(target.email)) {
    if (updates.active === false || updates.isSuperAdmin === false || nextRole !== 'admin') {
      throw new Error(
        'Bootstrap Super Admins listed in NEXT_PUBLIC_ADMIN_EMAILS cannot be demoted here.'
      );
    }
  }

  const patch: Record<string, unknown> = {};
  if (updates.displayName !== undefined) patch.displayName = updates.displayName;
  if (updates.role !== undefined) patch.role = updates.role;
  if (updates.active !== undefined) patch.active = updates.active;
  if (updates.isSuperAdmin !== undefined) {
    patch.isSuperAdmin = updates.isSuperAdmin;
    // Super Admin always gets Admin role
    if (updates.isSuperAdmin) {
      patch.role = 'admin';
      patch.active = true;
    }
  }

  await docRef.update(patch);
}

export async function deleteStaffMember(staffId: string, actorEmail: string) {
  const db = getAdminFirestore();
  const docRef = db.collection('staff').doc(staffId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    throw new Error('Staff member not found');
  }

  const target = snapshot.data() as Omit<Staff, 'id'>;
  if (isBootstrapSuperAdmin(target.email)) {
    throw new Error('Cannot remove a bootstrap Super Admin.');
  }
  if (target.email === actorEmail.toLowerCase()) {
    throw new Error('You cannot remove your own account.');
  }
  if (target.isSuperAdmin) {
    const actorIsSuper =
      isBootstrapSuperAdmin(actorEmail) ||
      isStaffSuperAdmin(await getStaffByEmail(actorEmail));
    if (!actorIsSuper) {
      throw new Error('Only a Super Admin can remove another Super Admin.');
    }
  }

  await docRef.delete();
}
