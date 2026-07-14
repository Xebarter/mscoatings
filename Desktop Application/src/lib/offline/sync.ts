import {
  disableNetwork,
  enableNetwork,
  waitForPendingWrites,
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '@/lib/firebase';
import { isOnline, subscribeConnectivity } from './connectivity';
import { withTimeout } from './firestore-reads';
import { localSet, type OfflineMeta } from './local-store';

let networkBound = false;
let syncing = false;
let firestoreNetworkEnabled = true;

export function getIsSyncing(): boolean {
  return syncing;
}

export function isFirestoreNetworkEnabled(): boolean {
  return firestoreNetworkEnabled;
}

export async function applyNetworkMode(online: boolean): Promise<void> {
  try {
    if (online) {
      await enableNetwork(db);
      firestoreNetworkEnabled = true;
    } else {
      await disableNetwork(db);
      firestoreNetworkEnabled = false;
    }
  } catch (error) {
    console.warn('Failed to toggle Firestore network:', error);
  }
}

export async function flushPendingWrites(): Promise<void> {
  if (!isOnline() || syncing) return;
  syncing = true;
  try {
    await enableNetwork(db);
    firestoreNetworkEnabled = true;
    await withTimeout(
      waitForPendingWrites(db),
      45_000,
      'Sync timed out — will retry when online'
    );
    await localSet<OfflineMeta>('meta', {
      lastSyncedAt: Date.now(),
      pendingWrites: 0,
    });
  } catch (error) {
    console.warn('Pending write flush failed:', error);
  } finally {
    syncing = false;
  }
}

/** Bind browser online/offline events to Firestore network + sync. Call once at app start. */
export function bindOfflineSync(): () => void {
  if (networkBound) return () => undefined;
  networkBound = true;

  void applyNetworkMode(isOnline());

  let wasOnline = isOnline();
  return subscribeConnectivity((online) => {
    void (async () => {
      await applyNetworkMode(online);
      if (online && !wasOnline) {
        toast.success('Back online — syncing data…', { id: 'offline-sync' });
        await flushPendingWrites();
        toast.success('Offline changes synced', { id: 'offline-sync' });
      } else if (!online && wasOnline) {
        toast('You are offline — sales and stock still work locally', {
          id: 'offline-mode',
          icon: '📡',
          duration: 4000,
        });
      }
      wasOnline = online;
    })();
  });
}
