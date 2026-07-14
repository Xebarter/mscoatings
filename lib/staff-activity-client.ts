import { adminFetch } from '@/lib/admin-api';
import type {
  StaffActivityAction,
  StaffActivityChannel,
} from '@/lib/erp-types';

export type ClientActivityInput = {
  action: StaffActivityAction;
  summary: string;
  resourceType?: string;
  resourceId?: string;
  channel?: StaffActivityChannel;
  metrics?: Record<string, string | number | boolean | null>;
  metadata?: Record<string, unknown>;
};

/** Fire-and-forget activity log for client-side mutations. Never throws. */
export function logClientActivity(input: ClientActivityInput): void {
  void adminFetch('/api/activity', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      channel: input.channel ?? 'web_admin',
    }),
  }).catch(() => {
    /* ignore offline / CORS blips — mutation already succeeded */
  });
}
