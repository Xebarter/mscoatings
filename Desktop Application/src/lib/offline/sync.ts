import { waitForPendingWrites } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '@/lib/firebase';
import {
  forceOnlineState,
  isOnline,
  probeReachability,
  subscribeConnectivity,
} from './connectivity';
import { withTimeout } from './firestore-reads';
import { flushPendingQueue, type FlushResult } from './flush-queue';
import { localSet, type OfflineMeta } from './local-store';
import {
  pendingWriteCount,
  subscribePendingQueue,
} from './pending-writes';

let networkBound = false;
let syncing = false;
/** SDK network left at default (enabled). Never toggle — see ensureFirestoreNetwork. */
let firestoreNetworkEnabled = true;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let probeTimer: ReturnType<typeof setInterval> | null = null;
let consecutiveProbeFails = 0;
let firestorePoisoned = false;

export type SyncEngineStatus = {
  syncing: boolean;
  pendingCount: number;
  lastSyncedAt: number | null;
  lastError: string | null;
  lastResult: FlushResult | null;
  firestorePoisoned: boolean;
};

type StatusListener = (status: SyncEngineStatus) => void;
const statusListeners = new Set<StatusListener>();

let status: SyncEngineStatus = {
  syncing: false,
  pendingCount: 0,
  lastSyncedAt: null,
  lastError: null,
  lastResult: null,
  firestorePoisoned: false,
};

function emitStatus(patch: Partial<SyncEngineStatus>) {
  status = { ...status, ...patch };
  for (const listener of statusListeners) listener(status);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ms-sync-status', { detail: status }));
  }
}

export function getSyncStatus(): SyncEngineStatus {
  return status;
}

export function subscribeSyncStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(status);
  return () => {
    statusListeners.delete(listener);
  };
}

export function getIsSyncing(): boolean {
  return syncing;
}

export function isFirestoreNetworkEnabled(): boolean {
  return firestoreNetworkEnabled;
}

export function isFirestorePoisoned(): boolean {
  return firestorePoisoned;
}

/** Detect Firestore SDK fatal assertion (ca9/b815) — client is dead until reload. */
export function isFirestoreFatalError(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.message}\n${error.stack ?? ''}`
      : String(error);
  return (
    /INTERNAL ASSERTION FAILED/i.test(text) ||
    /\b(ca9|b815|0xca9|0xb815)\b/i.test(text) ||
    /Unexpected state \(ID:\s*(ca9|b815)\)/i.test(text)
  );
}

/**
 * No-op by design. Firestore starts with the network enabled; calling
 * enableNetwork/disableNetwork (especially repeatedly) causes INTERNAL
 * ASSERTION ca9/b815 and permanently bricks the client until reload.
 * App offline is handled via isOnline() + the IndexedDB pending queue.
 */
export async function ensureFirestoreNetwork(): Promise<void> {
  firestoreNetworkEnabled = true;
}

/** @deprecated Kept for callers — never changes SDK network mode. */
export async function applyNetworkMode(_online: boolean): Promise<void> {
  // Intentionally empty: app-level queue + isOnline() gate writes.
}

function markFirestorePoisoned(error?: unknown): void {
  if (firestorePoisoned) return;
  firestorePoisoned = true;
  console.error('[sync] Firestore client poisoned — reload required', error);
  emitStatus({
    firestorePoisoned: true,
    lastError:
      'Firestore needs a restart after a sync error. Your offline queue is safe.',
  });
  toast.error(
    'Sync engine crashed. Click Sync or reload the app — offline sales are still saved.',
    { id: 'firestore-poisoned', duration: 12_000 }
  );
}

/**
 * Delete only Firebase Firestore IndexedDB databases (not our ms-coatings-offline queue).
 * Call before reload when recovering from ca9/b815.
 */
export async function clearFirestoreSdkCache(): Promise<void> {
  if (typeof indexedDB === 'undefined' || !indexedDB.databases) {
    return;
  }
  try {
    const dbs = await indexedDB.databases();
    await Promise.all(
      dbs
        .filter((d) => {
          const name = d.name ?? '';
          return (
            name.startsWith('firestore/') ||
            name.includes('firestore') ||
            name.startsWith('firebase-heartbeat') ||
            name.startsWith('firebase-installations')
          );
        })
        .map(
          (d) =>
            new Promise<void>((resolve) => {
              if (!d.name) {
                resolve();
                return;
              }
              // Never delete our app offline DB
              if (d.name === 'ms-coatings-offline') {
                resolve();
                return;
              }
              const req = indexedDB.deleteDatabase(d.name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            })
        )
    );
  } catch (error) {
    console.warn('Failed to clear Firestore SDK cache:', error);
  }
}

/** Recover from a poisoned Firestore client without wiping the offline POS queue. */
export async function recoverFirestoreClient(): Promise<void> {
  toast.loading('Repairing sync engine…', { id: 'firestore-recover' });
  try {
    await clearFirestoreSdkCache();
    toast.success('Restarting app…', { id: 'firestore-recover' });
  } catch {
    toast.error('Could not repair cache — restarting anyway', {
      id: 'firestore-recover',
    });
  }
  window.setTimeout(() => {
    window.location.reload();
  }, 400);
}

/**
 * Schedule a sync soon. Safe to call after every offline enqueue.
 * Coalesces rapid calls into one flush.
 */
export function requestSync(reason = 'manual', delayMs = 750): void {
  if (firestorePoisoned) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void flushPendingWrites(reason);
  }, delayMs);
}

export async function flushPendingWrites(reason = 'flush'): Promise<FlushResult> {
  const pendingBefore = await pendingWriteCount();
  emitStatus({ pendingCount: pendingBefore });

  if (firestorePoisoned) {
    return {
      flushed: 0,
      failed: pendingBefore,
      skipped: 0,
      remaining: pendingBefore,
      errors: [
        {
          id: 'poisoned',
          kind: 'firestore',
          error: 'Firestore client needs reload',
        },
      ],
    };
  }

  if (pendingBefore === 0) {
    if (isOnline()) {
      await ensureFirestoreNetwork();
    }
    return {
      flushed: 0,
      failed: 0,
      skipped: 0,
      remaining: 0,
      errors: [],
    };
  }

  if (syncing) {
    requestSync(`requeue:${reason}`, 2_000);
    return {
      flushed: 0,
      failed: 0,
      skipped: 0,
      remaining: pendingBefore,
      errors: [],
    };
  }

  const reachable = await probeReachability();
  if (!reachable && !navigator.onLine) {
    emitStatus({
      syncing: false,
      lastError: 'Waiting for internet connection',
      pendingCount: pendingBefore,
    });
    return {
      flushed: 0,
      failed: 0,
      skipped: 0,
      remaining: pendingBefore,
      errors: [{ id: 'network', kind: 'network', error: 'Offline' }],
    };
  }

  syncing = true;
  emitStatus({ syncing: true, lastError: null, pendingCount: pendingBefore });
  console.info(`[sync] Starting flush (${reason}), pending=${pendingBefore}`);

  try {
    await ensureFirestoreNetwork();
    // Brief settle so WebChannel is up before committing pending batches
    await new Promise((r) => setTimeout(r, 600));

    const result = await flushPendingQueue();

    // Check if any error was a fatal SDK assertion
    for (const err of result.errors) {
      if (isFirestoreFatalError(err.error)) {
        markFirestorePoisoned(err.error);
        break;
      }
    }

    if (!firestorePoisoned) {
      try {
        await withTimeout(
          waitForPendingWrites(db),
          20_000,
          'Firestore pending-write wait timed out'
        );
      } catch (error) {
        if (isFirestoreFatalError(error)) {
          markFirestorePoisoned(error);
        } else {
          console.warn('[sync] waitForPendingWrites:', error);
        }
      }
    }

    const remaining = await pendingWriteCount();
    await localSet<OfflineMeta>('meta', {
      lastSyncedAt: Date.now(),
      pendingWrites: remaining,
    });

    const lastError = firestorePoisoned
      ? status.lastError
      : result.errors[0]?.error ??
        (remaining > 0 ? `${remaining} change(s) still waiting to sync` : null);

    emitStatus({
      syncing: false,
      pendingCount: remaining,
      lastSyncedAt: remaining === 0 ? Date.now() : status.lastSyncedAt,
      lastError,
      lastResult: { ...result, remaining },
    });

    console.info('[sync] Flush result', { reason, ...result, remaining });

    if (!firestorePoisoned && remaining > 0) {
      requestSync(
        'remaining-retry',
        remaining === pendingBefore ? 8_000 : 3_000
      );
    }

    return { ...result, remaining };
  } catch (error) {
    if (isFirestoreFatalError(error)) {
      markFirestorePoisoned(error);
    }
    const message = error instanceof Error ? error.message : 'Sync failed';
    console.warn('[sync] Flush failed:', error);
    emitStatus({
      syncing: false,
      lastError: message,
      pendingCount: await pendingWriteCount(),
    });
    if (!firestorePoisoned) {
      requestSync('error-retry', 10_000);
    }
    return {
      flushed: 0,
      failed: 1,
      skipped: 0,
      remaining: await pendingWriteCount(),
      errors: [{ id: 'flush', kind: 'flush', error: message }],
    };
  } finally {
    syncing = false;
    emitStatus({ syncing: false });
  }
}

async function runProbeCycle(): Promise<void> {
  if (firestorePoisoned) return;

  const pending = await pendingWriteCount();
  const reachable = await probeReachability();

  if (reachable) {
    consecutiveProbeFails = 0;
    // Never toggle disable/enable here — only schedule app-level sync.
    if (pending > 0) {
      requestSync('probe-reachable', 500);
    }
    return;
  }

  consecutiveProbeFails += 1;
  if (consecutiveProbeFails >= 2 || !navigator.onLine) {
    // App-level offline only — leave Firestore SDK network alone.
    forceOnlineState(false, 'probe-fail-streak');
  }
}

/** Bind browser online/offline events to sync. Call once at app start. */
export function bindOfflineSync(): () => void {
  if (networkBound) return () => undefined;
  networkBound = true;

  void pendingWriteCount().then((n) => emitStatus({ pendingCount: n }));
  void ensureFirestoreNetwork();

  requestSync('app-start', 1_500);

  let wasOnline = isOnline();
  const unsubConnectivity = subscribeConnectivity((online) => {
    void (async () => {
      if (online) {
        await ensureFirestoreNetwork();
      }
      if (online && !wasOnline) {
        const pending = await pendingWriteCount();
        if (pending > 0) {
          toast.loading(`Back online — syncing ${pending} change(s)…`, {
            id: 'offline-sync',
          });
          const result = await flushPendingWrites('reconnect');
          if (firestorePoisoned) {
            toast.error('Sync needs an app restart — offline data is safe', {
              id: 'offline-sync',
              duration: 8_000,
            });
          } else if (result.remaining === 0) {
            toast.success(
              result.flushed > 0
                ? `Synced ${result.flushed} offline change(s)`
                : 'All changes synced',
              { id: 'offline-sync' }
            );
          } else {
            toast.error(
              `Synced ${result.flushed}, ${result.remaining} still pending — retrying…`,
              { id: 'offline-sync', duration: 5_000 }
            );
          }
        } else {
          toast.success('Back online', { id: 'offline-sync', duration: 2_000 });
        }
      } else if (!online && wasOnline) {
        toast('Offline — changes save on this device', {
          id: 'offline-mode',
          icon: '💾',
          duration: 4_000,
        });
      }
      wasOnline = online;
    })();
  });

  const unsubQueue = subscribePendingQueue((count) => {
    emitStatus({ pendingCount: count });
    if (count > 0 && isOnline() && !firestorePoisoned) {
      requestSync('queue-grew', 1_000);
    }
  });

  probeTimer = setInterval(() => {
    void runProbeCycle();
  }, 12_000);

  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      void runProbeCycle();
      if (!firestorePoisoned) {
        requestSync('visibility', 400);
      }
    }
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);

  // Global safety net for uncaught Firestore assertion noise
  const onRejection = (event: PromiseRejectionEvent) => {
    if (isFirestoreFatalError(event.reason)) {
      markFirestorePoisoned(event.reason);
    }
  };
  window.addEventListener('unhandledrejection', onRejection);

  return () => {
    networkBound = false;
    unsubConnectivity();
    unsubQueue();
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
    window.removeEventListener('unhandledrejection', onRejection);
    if (syncTimer) clearTimeout(syncTimer);
    if (probeTimer) clearInterval(probeTimer);
    syncTimer = null;
    probeTimer = null;
  };
}
