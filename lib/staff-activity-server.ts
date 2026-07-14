import { getAdminFirestore, getAdminTimestamp } from '@/lib/firebase-admin';
import { emailHasSuperAdminAccess } from '@/lib/staff-server';
import type {
  StaffActivityAction,
  StaffActivityChannel,
  StaffActivityLog,
} from '@/lib/erp-types';

const COLLECTION = 'staffActivityLogs';

export type LogStaffActivityInput = {
  action: StaffActivityAction;
  summary: string;
  actorEmail: string;
  actorUid?: string;
  actorDisplayName?: string;
  resourceType?: string;
  resourceId?: string;
  channel?: StaffActivityChannel;
  metrics?: Record<string, string | number | boolean | null>;
  metadata?: Record<string, unknown>;
};

function categoryForAction(
  action: StaffActivityAction
): StaffActivityLog['category'] {
  if (action.startsWith('sale.')) return 'pos';
  if (action.startsWith('inventory.')) return 'inventory';
  if (action.startsWith('order.')) return 'orders';
  if (action.startsWith('message.')) return 'messages';
  if (action.startsWith('field_')) return 'field_sales';
  if (action.startsWith('product.')) return 'products';
  if (action.startsWith('staff.')) return 'staff';
  if (action.startsWith('customer.')) return 'customers';
  return 'other';
}

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

export async function logStaffActivity(
  input: LogStaffActivityInput
): Promise<string> {
  const db = getAdminFirestore();
  const Timestamp = getAdminTimestamp();
  const email = input.actorEmail.trim().toLowerCase();

  const ref = await db.collection(COLLECTION).add({
    action: input.action,
    category: categoryForAction(input.action),
    summary: input.summary.trim(),
    actorEmail: email,
    actorUid: input.actorUid ?? null,
    actorDisplayName: input.actorDisplayName ?? null,
    resourceType: input.resourceType ?? null,
    resourceId: input.resourceId ?? null,
    channel: input.channel ?? 'api',
    metrics: input.metrics ?? {},
    metadata: input.metadata ?? {},
    createdAt: Timestamp.now(),
  });

  return ref.id;
}

/** Never throws — safe to fire-and-forget from mutation handlers. */
export async function logStaffActivitySafe(
  input: LogStaffActivityInput
): Promise<void> {
  try {
    await logStaffActivity(input);
  } catch (error) {
    console.error('Failed to write staff activity log:', error);
  }
}

export async function listStaffActivity(options?: {
  limit?: number;
  action?: StaffActivityAction | 'all';
  category?: StaffActivityLog['category'] | 'all';
  actorEmail?: string;
}): Promise<StaffActivityLog[]> {
  const db = getAdminFirestore();
  const limit = Math.min(options?.limit ?? 100, 300);

  const snap = await db
    .collection(COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  let rows = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      action: data.action as StaffActivityAction,
      category: data.category as StaffActivityLog['category'],
      summary: String(data.summary ?? ''),
      actorEmail: String(data.actorEmail ?? ''),
      actorUid: data.actorUid ? String(data.actorUid) : undefined,
      actorDisplayName: data.actorDisplayName
        ? String(data.actorDisplayName)
        : undefined,
      resourceType: data.resourceType ? String(data.resourceType) : undefined,
      resourceId: data.resourceId ? String(data.resourceId) : undefined,
      channel: (data.channel as StaffActivityChannel) ?? 'api',
      metrics: (data.metrics as StaffActivityLog['metrics']) ?? {},
      metadata: (data.metadata as Record<string, unknown>) ?? {},
      createdAt: toIso(data.createdAt),
    } satisfies StaffActivityLog;
  });

  if (options?.action && options.action !== 'all') {
    rows = rows.filter((r) => r.action === options.action);
  }
  if (options?.category && options.category !== 'all') {
    rows = rows.filter((r) => r.category === options.category);
  }
  if (options?.actorEmail) {
    const email = options.actorEmail.trim().toLowerCase();
    rows = rows.filter((r) => r.actorEmail === email);
  }

  return rows;
}

export async function assertCanViewActivity(actorEmail: string): Promise<boolean> {
  return emailHasSuperAdminAccess(actorEmail);
}
