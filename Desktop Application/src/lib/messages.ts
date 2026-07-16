import {
  collection,
  doc,
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
import { getDocsHybrid } from './offline/firestore-reads';
import { isOnline } from './offline/connectivity';
import { localGet, localSet } from './offline/local-store';
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

function mergeMessages(local: ContactMessage[], remote: ContactMessage[]): ContactMessage[] {
  const byId = new Map<string, ContactMessage>();
  for (const item of remote) byId.set(item.id, item);
  for (const item of local) byId.set(item.id, item);
  return Array.from(byId.values()).sort((a, b) => {
    const aMs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bMs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bMs - aMs;
  });
}

export async function cacheContactMessages(items: ContactMessage[]): Promise<void> {
  const cached = await localGet<{ items: ContactMessage[] }>('contactMessages');
  await saveMessagesMirror(mergeMessages(cached?.items ?? [], items));
}

async function saveMessagesMirror(items: ContactMessage[]): Promise<void> {
  await localSet('contactMessages', { items, savedAt: Date.now() });
}

async function patchMessagesMirror(
  mutator: (items: ContactMessage[]) => ContactMessage[]
): Promise<void> {
  const cached = await localGet<{ items: ContactMessage[] }>('contactMessages');
  await saveMessagesMirror(mutator(cached?.items ?? []));
}

export async function listContactMessagesClient(
  status: ContactMessageStatus | 'all' = 'all',
  max = 100
): Promise<ContactMessage[]> {
  try {
    await ensureFirestoreAuthReady();
    const capped = Math.min(max, 200);

    if (!isOnline()) {
      const cached = await localGet<{ items: ContactMessage[] }>('contactMessages');
      if (cached?.items) {
        const items =
          status === 'all'
            ? cached.items
            : cached.items.filter((m) => m.status === status);
        return items.slice(0, capped);
      }
    }

    const q =
      status === 'all'
        ? query(contactMessagesCollection, orderBy('createdAt', 'desc'), limit(capped))
        : query(
            contactMessagesCollection,
            where('status', '==', status),
            orderBy('createdAt', 'desc'),
            limit(capped)
          );

    try {
      const snap = await getDocsHybrid(q);
      const remote = snap.docs.map((d) => mapDoc(d.id, d.data()));
      const cached = await localGet<{ items: ContactMessage[] }>('contactMessages');
      const merged = mergeMessages(cached?.items ?? [], remote);
      if (status === 'all') {
        await saveMessagesMirror(merged);
      }
      const items =
        status === 'all' ? merged : merged.filter((m) => m.status === status);
      return items.slice(0, capped);
    } catch (error) {
      const cached = await localGet<{ items: ContactMessage[] }>('contactMessages');
      if (cached?.items?.length) {
        const items =
          status === 'all'
            ? cached.items
            : cached.items.filter((m) => m.status === status);
        return items.slice(0, capped);
      }
      throw error;
    }
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

    let result: ContactMessage | undefined;
    await patchMessagesMirror((items) =>
      items.map((m) => {
        if (m.id !== id) return m;
        result = {
          ...m,
          ...(status ? { status } : {}),
          ...(updates.adminNotes !== undefined
            ? { adminNotes: updates.adminNotes }
            : {}),
          updatedAt: new Date().toISOString(),
        };
        return result;
      })
    );

    if (!result) {
      const messages = await listContactMessagesClient('all', 200);
      result = messages.find((m) => m.id === id) ?? {
        id,
        name: '',
        email: '',
        subject: '',
        message: '',
        status: status ?? 'new',
        adminNotes: updates.adminNotes,
      };
      if (status || updates.adminNotes !== undefined) {
        result = {
          ...result,
          ...(status ? { status } : {}),
          ...(updates.adminNotes !== undefined
            ? { adminNotes: updates.adminNotes }
            : {}),
        };
      }
    }

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
