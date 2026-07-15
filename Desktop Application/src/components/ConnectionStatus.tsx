import { AlertTriangle, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useOnline } from '@/hooks/useOnline';
import {
  flushPendingWrites,
  getIsSyncing,
  getSyncStatus,
  isFirestoreFatalError,
  recoverFirestoreClient,
  subscribeSyncStatus,
  type SyncEngineStatus,
} from '@/lib/offline/sync';
import { warmOfflineCache } from '@/lib/firestore';
import { assessOfflineHealth, type OfflineHealth } from '@/lib/offline/health';
import { pendingKindLabel, listPendingWrites } from '@/lib/offline/pending-writes';
import { cn } from '@/lib/utils';

export default function ConnectionStatus() {
  const online = useOnline();
  const [status, setStatus] = useState<SyncEngineStatus | null>(null);
  const [health, setHealth] = useState<OfflineHealth | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeSyncStatus(setStatus), []);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void assessOfflineHealth().then((h) => {
        if (alive) setHealth(h);
      });
    };
    refresh();
    const id = window.setInterval(refresh, 8_000);
    const onQueue = () => refresh();
    window.addEventListener('ms-offline-queue', onQueue);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener('ms-offline-queue', onQueue);
    };
  }, [online, status?.pendingCount]);

  const pending = status?.pendingCount ?? health?.pendingCount ?? 0;
  const syncing = busy || status?.syncing || getIsSyncing();
  const poisoned = Boolean(status?.firestorePoisoned);
  const level = poisoned ? 'critical' : health?.level ?? 'ok';

  const handleSync = async () => {
    if (syncing) return;
    setBusy(true);
    try {
      if (poisoned) {
        await recoverFirestoreClient();
        return;
      }
      if (!online) {
        toast.error('Connect to the internet to sync');
        return;
      }
      const before = await listPendingWrites();
      toast.loading(
        before.length
          ? `Syncing ${before.length} change(s)…`
          : 'Refreshing offline cache…',
        { id: 'manual-sync' }
      );
      const result = await flushPendingWrites('manual');
      if (
        getSyncStatus().firestorePoisoned ||
        result.errors.some((e) => isFirestoreFatalError(e.error))
      ) {
        toast.error('Sync engine crashed — repairing…', { id: 'manual-sync' });
        await recoverFirestoreClient();
        return;
      }
      if (online) {
        await warmOfflineCache().catch(() => undefined);
      }
      setHealth(await assessOfflineHealth());
      if (result.remaining === 0) {
        toast.success(
          result.flushed > 0
            ? `Synced ${result.flushed} change(s)`
            : 'Everything is up to date',
          { id: 'manual-sync' }
        );
      } else {
        const kinds = before
          .slice(0, 3)
          .map((w) => pendingKindLabel(w.kind))
          .join(', ');
        toast.error(
          `Synced ${result.flushed}, ${result.remaining} left${kinds ? ` (${kinds}…)` : ''}. Retrying…`,
          { id: 'manual-sync', duration: 5_000 }
        );
      }
    } catch {
      toast.error('Sync failed — will retry automatically', { id: 'manual-sync' });
    } finally {
      setBusy(false);
    }
  };

  const label = (() => {
    if (poisoned) return 'Sync broken — tap to repair';
    if (syncing) return pending > 0 ? `Syncing ${pending}…` : 'Syncing…';
    if (level === 'critical') {
      return health?.summary ?? 'Storage critical — sync soon';
    }
    if (level === 'warn' && !online) {
      return health?.summary ?? `Offline · ${pending} queued`;
    }
    if (!online) {
      return pending > 0
        ? `Offline · ${pending} queued`
        : 'Offline · local mode';
    }
    if (level === 'warn') return health?.summary ?? `${pending} to sync`;
    if (pending > 0) return `Online · ${pending} to sync`;
    if (status?.lastSyncedAt) return 'Online · synced';
    return 'Online';
  })();

  const title = [
    health?.summary,
    ...(health?.messages ?? []),
    status?.lastError,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={cn(
        'mx-3 mb-3 rounded-lg px-3 py-2 text-xs font-medium',
        syncing
          ? 'bg-sky-500/10 text-sky-300'
          : level === 'critical'
            ? 'bg-red-500/15 text-red-300'
            : level === 'warn' || (!online && pending > 0)
              ? 'bg-amber-500/10 text-amber-300'
              : online
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-amber-500/10 text-amber-400'
      )}
    >
      <div className="flex items-center gap-2">
        {level === 'critical' ? (
          <AlertTriangle size={14} />
        ) : online ? (
          <Cloud size={14} />
        ) : (
          <CloudOff size={14} />
        )}
        <button
          type="button"
          onClick={() => void handleSync()}
          disabled={syncing || (!online && !poisoned)}
          className="min-w-0 flex-1 truncate text-left disabled:opacity-100"
          title={
            poisoned
              ? 'Repair sync engine (keeps offline sales queue)'
              : title || label
          }
        >
          {label}
        </button>
        <button
          type="button"
          onClick={() => void handleSync()}
          disabled={syncing || (!online && !poisoned)}
          className="rounded p-1 transition hover:bg-white/10 disabled:opacity-40"
          title={
            poisoned
              ? 'Repair sync engine (keeps offline sales queue)'
              : online
                ? 'Sync now'
                : 'Connect to sync'
          }
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
        </button>
      </div>
      {level !== 'ok' && health?.freeMb != null && (
        <p className="mt-1 truncate text-[10px] font-normal opacity-80">
          ~{Math.round(health.freeMb)} MB free
          {health.pendingImages > 0
            ? ` · ${health.pendingImages} photo(s) queued`
            : ''}
        </p>
      )}
    </div>
  );
}
