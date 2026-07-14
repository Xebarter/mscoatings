import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useOnline } from '@/hooks/useOnline';
import { flushPendingWrites, getIsSyncing } from '@/lib/offline/sync';
import { warmOfflineCache } from '@/lib/firestore';
import { pendingWriteCount } from '@/lib/offline/pending-writes';
import { cn } from '@/lib/utils';

export default function ConnectionStatus() {
  const online = useOnline();
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void pendingWriteCount().then((n) => {
        if (alive) setPending(n);
      });
    };
    refresh();
    const id = window.setInterval(refresh, 4_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [online]);

  const handleSync = async () => {
    if (!online || syncing) return;
    setSyncing(true);
    try {
      await flushPendingWrites();
      await warmOfflineCache();
      setPending(await pendingWriteCount());
      toast.success('Synced and cache refreshed');
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      className={cn(
        'mx-3 mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium',
        online
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'bg-amber-500/10 text-amber-400'
      )}
    >
      {online ? <Cloud size={14} /> : <CloudOff size={14} />}
      <span className="flex-1 truncate">
        {online
          ? pending > 0
            ? `Online · ${pending} pending`
            : 'Online'
          : pending > 0
            ? `Offline · ${pending} sale(s) queued`
            : 'Offline · local POS ready'}
      </span>
      {online && (
        <button
          type="button"
          onClick={() => void handleSync()}
          disabled={syncing || getIsSyncing()}
          className="rounded p-1 transition hover:bg-white/10 disabled:opacity-50"
          title="Sync & refresh offline cache"
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
        </button>
      )}
    </div>
  );
}
