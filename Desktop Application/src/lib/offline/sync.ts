import {
  disableNetwork,
  enableNetwork,
  waitForPendingWrites,
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '@/lib/firebase';
import { isOnline, subscribeConnectivity } from './connectivity';
import { localSet, type OfflineMeta } from './local-store';

let networkBound = false;
let syncing = false;

export function getIsSyncing(): boolean {
  return syncing;
}

export async function applyNetworkMode(online: boolean): Promise<void> {
  try {
    if (online) {
      await enableNetwork(db);
    } else {
      await disableNetwork(db);
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
    await waitForPendingWrites(db);
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
        toast('You are offline — POS & inventory still work', {
          id: 'offline-mode',
          icon: '📡',
          duration: 4000,
        });
      }
      wasOnline = online;
    })();
  });
}
