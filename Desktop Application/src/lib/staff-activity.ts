import { isOnline } from './offline/connectivity';
import { adminFetch } from '@/lib/admin-api';

export type DesktopActivityAction =
  | 'sale.create'
  | 'sale.void'
  | 'sale.refund'
  | 'product.create'
  | 'product.update'
  | 'product.delete'
  | 'inventory.adjust'
  | 'order.status_change'
  | 'message.status_change'
  | 'field_agent.create'
  | 'field_agent.update'
  | 'field_pick.create'
  | 'field_pick.submit_report'
  | 'expense.create'
  | 'expense.update'
  | 'expense.delete';

/** Fire-and-forget activity log for desktop mutations (via main-process API proxy). */
export function logDesktopActivity(input: {
  action: DesktopActivityAction;
  summary: string;
  resourceType?: string;
  resourceId?: string;
  metrics?: Record<string, string | number | boolean | null>;
}): void {
  if (!isOnline()) return;
  void adminFetch('/api/activity', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      channel: 'desktop',
    }),
  }).catch(() => {
    /* ignore when offline / API down */
  });
}
