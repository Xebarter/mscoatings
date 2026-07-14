'use client';

import Link from 'next/link';
import { Inbox, ShoppingBag } from 'lucide-react';
import { useOptionalAdminAlerts } from '@/components/admin-alerts-provider';

export default function AdminAlertsBanner() {
  const ctx = useOptionalAdminAlerts();
  if (!ctx) return null;

  const { pendingOrders, newMessages } = ctx.alerts;
  if (pendingOrders <= 0 && newMessages <= 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1 text-sm text-amber-950">
        {pendingOrders > 0 && (
          <p className="flex items-center gap-2 font-medium">
            <ShoppingBag size={16} className="shrink-0 text-amber-600" />
            {pendingOrders} pending order{pendingOrders === 1 ? '' : 's'} need attention
          </p>
        )}
        {newMessages > 0 && (
          <p className="flex items-center gap-2 font-medium">
            <Inbox size={16} className="shrink-0 text-amber-600" />
            {newMessages} new contact message{newMessages === 1 ? '' : 's'}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {pendingOrders > 0 && (
          <Link
            href="/admin/dashboard?tab=orders"
            className="inline-flex items-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
          >
            View orders
          </Link>
        )}
        {newMessages > 0 && (
          <Link
            href="/admin/messages"
            className="inline-flex items-center rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-300 transition hover:bg-amber-100"
          >
            Open inbox
          </Link>
        )}
      </div>
    </div>
  );
}
