import type { Staff, StaffRole } from '@/lib/erp-types';
import { getAdminFirestore, getAdminTimestamp } from '@/lib/firebase-admin';

function staffDocId(email: string): string {
  return email.trim().toLowerCase().replace('@', '_at_').replace(/\./g, '_dot_');
}

export async function getStaffByEmail(email: string): Promise<Staff | null> {
  const db = getAdminFirestore();
  const normalized = email.trim().toLowerCase();
  const docRef = db.collection('staff').doc(staffDocId(normalized));
  const snapshot = await docRef.get();

  if (!snapshot.exists) return null;

  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<Staff, 'id'>),
  };
}

export async function listStaff(): Promise<Staff[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection('staff').orderBy('createdAt', 'desc').get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Staff, 'id'>),
  }));
}

export async function createStaffMember(input: {
  email: string;
  displayName: string;
  role: StaffRole;
}): Promise<string> {
  const db = getAdminFirestore();
  const Timestamp = getAdminTimestamp();
  const normalized = input.email.trim().toLowerCase();

  const existing = await getStaffByEmail(normalized);
  if (existing) {
    throw new Error('A staff member with this email already exists.');
  }

  const docRef = db.collection('staff').doc(staffDocId(normalized));
  await docRef.set({
    email: normalized,
    displayName: input.displayName.trim(),
    role: input.role,
    active: true,
    createdAt: Timestamp.now(),
  });

  return docRef.id;
}

export async function updateStaffMember(
  staffId: string,
  updates: Partial<Pick<Staff, 'displayName' | 'role' | 'active'>>
) {
  const db = getAdminFirestore();
  await db.collection('staff').doc(staffId).update(updates);
}

export async function deleteStaffMember(staffId: string) {
  const db = getAdminFirestore();
  await db.collection('staff').doc(staffId).delete();
}
