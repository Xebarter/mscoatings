import { type DocumentData, type Query } from 'firebase-admin/firestore';
import { getAdminFirestore, getAdminTimestamp } from '@/lib/firebase-admin';
import type { ContactMessage, ContactMessageStatus } from '@/lib/erp-types';

export type { ContactSubject } from '@/lib/contact';
export { CONTACT_SUBJECTS } from '@/lib/contact';

const COLLECTION = 'contactMessages';

export type CreateContactMessageInput = {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
};

function toIso(value: unknown): string {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function mapDoc(id: string, data: DocumentData): ContactMessage {
  return {
    id,
    name: String(data.name ?? ''),
    email: String(data.email ?? ''),
    phone: String(data.phone ?? ''),
    subject: String(data.subject ?? ''),
    message: String(data.message ?? ''),
    status: (data.status as ContactMessageStatus) ?? 'new',
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt ?? data.createdAt),
    readAt: data.readAt ? toIso(data.readAt) : undefined,
    readBy: data.readBy ? String(data.readBy) : undefined,
    repliedAt: data.repliedAt ? toIso(data.repliedAt) : undefined,
    repliedBy: data.repliedBy ? String(data.repliedBy) : undefined,
    archivedAt: data.archivedAt ? toIso(data.archivedAt) : undefined,
    adminNotes: data.adminNotes ? String(data.adminNotes) : undefined,
  };
}

export function validateContactPayload(body: unknown): {
  ok: true;
  data: CreateContactMessageInput;
} | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body' };
  }

  const raw = body as Record<string, unknown>;
  const name = String(raw.name ?? '').trim();
  const email = String(raw.email ?? '').trim().toLowerCase();
  const phone = String(raw.phone ?? '').trim();
  const subject = String(raw.subject ?? '').trim();
  const message = String(raw.message ?? '').trim();

  if (name.length < 2 || name.length > 120) {
    return { ok: false, error: 'Please enter a valid name' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return { ok: false, error: 'Please enter a valid email address' };
  }
  if (phone.length > 40) {
    return { ok: false, error: 'Phone number is too long' };
  }
  if (!subject || subject.length > 120) {
    return { ok: false, error: 'Please select a subject' };
  }
  if (message.length < 10 || message.length > 5000) {
    return { ok: false, error: 'Message must be between 10 and 5000 characters' };
  }

  // Honeypot field for bots
  if (String(raw.company ?? '').trim()) {
    return { ok: false, error: 'Rejected' };
  }

  return {
    ok: true,
    data: { name, email, phone, subject, message },
  };
}

export async function createContactMessage(
  input: CreateContactMessageInput
): Promise<string> {
  const db = getAdminFirestore();
  const Timestamp = getAdminTimestamp();
  const now = Timestamp.now();

  const ref = await db.collection(COLLECTION).add({
    name: input.name,
    email: input.email,
    phone: input.phone ?? '',
    subject: input.subject,
    message: input.message,
    status: 'new' satisfies ContactMessageStatus,
    createdAt: now,
    updatedAt: now,
  });

  return ref.id;
}

export async function listContactMessages(options?: {
  status?: ContactMessageStatus | 'all';
  limit?: number;
}): Promise<ContactMessage[]> {
  const db = getAdminFirestore();
  const limit = Math.min(options?.limit ?? 100, 200);
  const status = options?.status ?? 'all';

  let query: Query = db
    .collection(COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(limit);

  if (status !== 'all') {
    query = db
      .collection(COLLECTION)
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .limit(limit);
  }

  const snap = await query.get();
  return snap.docs.map((doc) => mapDoc(doc.id, doc.data()));
}

export async function getContactMessage(
  id: string
): Promise<ContactMessage | null> {
  const db = getAdminFirestore();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return mapDoc(doc.id, doc.data()!);
}

export async function updateContactMessageStatus(
  id: string,
  status: ContactMessageStatus,
  staffEmail: string,
  adminNotes?: string
): Promise<ContactMessage | null> {
  const db = getAdminFirestore();
  const Timestamp = getAdminTimestamp();
  const ref = db.collection(COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) return null;

  const now = Timestamp.now();
  const patch: Record<string, unknown> = {
    status,
    updatedAt: now,
  };

  if (status === 'read') {
    patch.readAt = now;
    patch.readBy = staffEmail.toLowerCase();
  }
  if (status === 'replied') {
    patch.repliedAt = now;
    patch.repliedBy = staffEmail.toLowerCase();
    if (!existing.data()?.readAt) {
      patch.readAt = now;
      patch.readBy = staffEmail.toLowerCase();
    }
  }
  if (status === 'archived') {
    patch.archivedAt = now;
  }
  if (adminNotes !== undefined) {
    patch.adminNotes = adminNotes.slice(0, 2000);
  }

  await ref.update(patch);
  const updated = await ref.get();
  return mapDoc(updated.id, updated.data()!);
}

export async function countNewContactMessages(): Promise<number> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTION)
    .where('status', '==', 'new')
    .count()
    .get();
  return snap.data().count;
}
