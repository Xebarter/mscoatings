import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  limit,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { ensureFirestoreAuthReady } from './admin-auth';
import { db } from './firebase';
import { toFirestoreError } from './firestore';
import { logDesktopActivity } from './staff-activity';

export type ContactMessageStatus = 'new' | 'read' | 'replied' | 'archived';

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: ContactMessageStatus;
  adminNotes?: string;
  createdAt?: string;
  updatedAt?: string;
};

const contactMessagesCollection = collection(db, 'contactMessages');

function toIso(value: unknown): string | undefined {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return undefined;
}

function mapDoc(id: string, data: DocumentData): ContactMessage {
  return {
    id,
    name: String(data.name ?? ''),
    email: String(data.email ?? ''),
    phone: data.phone ? String(data.phone) : undefined,
    subject: String(data.subject ?? ''),
    message: String(data.message ?? ''),
    status: (data.status as ContactMessageStatus) ?? 'new',
    adminNotes: data.adminNotes ? String(data.adminNotes) : undefined,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt ?? data.createdAt),
  };
}

export async function listContactMessagesClient(
  status: ContactMessageStatus | 'all' = 'all',
  max = 100
): Promise<ContactMessage[]> {
  try {
    await ensureFirestoreAuthReady();
    const capped = Math.min(max, 200);
    const q =
      status === 'all'
        ? query(contactMessagesCollection, orderBy('createdAt', 'desc'), limit(capped))
        : query(
            contactMessagesCollection,
            where('status', '==', status),
            orderBy('createdAt', 'desc'),
            limit(capped)
          );

    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDoc(d.id, d.data()));
  } catch (error) {
    throw toFirestoreError(error);
  }
}

export async function updateContactMessageStatusClient(
  id: string,
  status: ContactMessageStatus
): Promise<ContactMessage> {
  return updateContactMessageClient(id, { status });
}

export async function updateContactMessageClient(
  id: string,
  updates: { status?: ContactMessageStatus; adminNotes?: string }
): Promise<ContactMessage> {
  try {
    await ensureFirestoreAuthReady();
    const ref = doc(contactMessagesCollection, id);
    const status = updates.status;
    const patch: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (status) {
      patch.status = status;
      if (status === 'read') patch.readAt = new Date();
      if (status === 'archived') patch.archivedAt = new Date();
      if (status === 'replied') patch.repliedAt = new Date();
    }
    if (updates.adminNotes !== undefined) {
      patch.adminNotes = updates.adminNotes.slice(0, 2000);
    }
    await updateDoc(ref, patch);

    const messages = await listContactMessagesClient('all', 200);
    const updated = messages.find((m) => m.id === id);
    const result: ContactMessage = updated
      ? {
          ...updated,
          ...(status ? { status } : {}),
          ...(updates.adminNotes !== undefined
            ? { adminNotes: updates.adminNotes }
            : {}),
        }
      : {
          id,
          name: '',
          email: '',
          subject: '',
          message: '',
          status: status ?? 'new',
          adminNotes: updates.adminNotes,
        };

    if (status) {
      logDesktopActivity({
        action: 'message.status_change',
        summary: `Message marked as ${status}${result.subject ? `: ${result.subject}` : ''}`,
        resourceType: 'contactMessage',
        resourceId: id,
        metrics: { toStatus: status, sender: result.email || null },
      });
    }

    return result;
  } catch (error) {
    throw toFirestoreError(error);
  }
}
