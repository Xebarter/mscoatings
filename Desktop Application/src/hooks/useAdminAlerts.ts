import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { adminFetch } from '@/lib/admin-api';
import {
  isAlertsMuted,
  playAlertChime,
  setAlertsMuted,
} from '@/lib/alert-sound';
import { getOrders } from '@/lib/firestore';
import { listContactMessagesClient } from '@/lib/messages';
import { useOnline } from '@/hooks/useOnline';

export type AdminAlerts = {
  pendingOrders: number;
  newMessages: number;
};

const POLL_MS = 20_000;

export function useAdminAlerts(enabled = true) {
  const online = useOnline();
  const [alerts, setAlerts] = useState<AdminAlerts>({
    pendingOrders: 0,
    newMessages: 0,
  });
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const prevRef = useRef<AdminAlerts | null>(null);
  const primedRef = useRef(false);

  useEffect(() => {
    setMuted(isAlertsMuted());
  }, []);

  const notify = useCallback(
    (next: AdminAlerts, prev: AdminAlerts | null) => {
      if (!prev || muted) return;

      const newOrders = next.pendingOrders > prev.pendingOrders;
      const newMsgs = next.newMessages > prev.newMessages;
      if (!newOrders && !newMsgs) return;

      if (newOrders && newMsgs) {
        playAlertChime('both');
        toast.success(
          `New activity: ${next.pendingOrders - prev.pendingOrders} order(s), ${next.newMessages - prev.newMessages} message(s)`,
          { id: 'admin-alerts', duration: 5000 }
        );
      } else if (newOrders) {
        playAlertChime('order');
        toast.success(
          `New pending order${next.pendingOrders - prev.pendingOrders > 1 ? 's' : ''} — check Orders`,
          { id: 'admin-alerts-orders', duration: 4500 }
        );
      } else {
        playAlertChime('message');
        toast.success(
          `New contact message${next.newMessages - prev.newMessages > 1 ? 's' : ''} — check Messages`,
          { id: 'admin-alerts-messages', duration: 4500 }
        );
      }

      const title =
        newOrders && newMsgs
          ? 'New orders & messages'
          : newOrders
            ? 'New pending order'
            : 'New contact message';
      const body =
        newOrders && newMsgs
          ? `${next.pendingOrders} pending orders · ${next.newMessages} new messages`
          : newOrders
            ? `${next.pendingOrders} pending order${next.pendingOrders === 1 ? '' : 's'}`
            : `${next.newMessages} unread message${next.newMessages === 1 ? '' : 's'}`;

      void window.electronAPI?.showNotification?.({ title, body });
    },
    [muted]
  );

  const refreshFromCache = useCallback(async () => {
    try {
      const [orders, messages] = await Promise.all([
        getOrders().catch(() => []),
        listContactMessagesClient('all', 100).catch(() => []),
      ]);
      const next = {
        pendingOrders: orders.filter((o) => o.status === 'pending').length,
        newMessages: messages.filter((m) => m.status === 'new').length,
      };
      prevRef.current = next;
      primedRef.current = true;
      setAlerts(next);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    if (!online) {
      await refreshFromCache();
      return;
    }
    try {
      const res = await adminFetch('/api/admin/alerts');
      if (!res.ok) {
        await refreshFromCache();
        return;
      }
      const data = (await res.json()) as AdminAlerts;
      const next = {
        pendingOrders: Number(data.pendingOrders) || 0,
        newMessages: Number(data.newMessages) || 0,
      };

      if (primedRef.current) {
        notify(next, prevRef.current);
      } else {
        primedRef.current = true;
      }

      prevRef.current = next;
      setAlerts(next);
    } catch {
      await refreshFromCache();
    } finally {
      setLoading(false);
    }
  }, [enabled, online, notify, refreshFromCache]);

  useEffect(() => {
    if (!enabled) return;

    void refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_MS);

    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onManual = () => void refresh();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('ms-alerts-refresh', onManual);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('ms-alerts-refresh', onManual);
    };
  }, [enabled, refresh]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setAlertsMuted(next);
    if (!next) playAlertChime('message');
  };

  return {
    alerts,
    loading,
    muted,
    toggleMute,
    refresh,
  };
}
