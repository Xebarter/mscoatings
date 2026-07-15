import {
  PENDING_CRITICAL_COUNT,
  PENDING_IMAGE_MAX,
  PENDING_WARN_COUNT,
  STORAGE_CRITICAL_MB,
  STORAGE_LOW_MB,
} from './limits';
import {
  countPendingImageBlobs,
  estimateStorage,
} from './local-store';
import { listPendingWrites, pendingWriteCount } from './pending-writes';

export type HealthLevel = 'ok' | 'warn' | 'critical';

export type OfflineHealth = {
  level: HealthLevel;
  pendingCount: number;
  pendingImages: number;
  freeMb: number | null;
  usagePct: number | null;
  messages: string[];
  /** Operator-facing one-liner for the sidebar. */
  summary: string;
};

export async function assessOfflineHealth(): Promise<OfflineHealth> {
  const [pendingCount, pendingImages, storage, queue] = await Promise.all([
    pendingWriteCount(),
    countPendingImageBlobs(),
    estimateStorage(),
    listPendingWrites(),
  ]);

  const messages: string[] = [];
  const state = { level: 'ok' as HealthLevel };

  const bump = (next: HealthLevel) => {
    const rank = { ok: 0, warn: 1, critical: 2 } as const;
    if (rank[next] > rank[state.level]) state.level = next;
  };

  if (pendingCount >= PENDING_CRITICAL_COUNT) {
    bump('critical');
    messages.push(
      `${pendingCount} changes waiting to sync — reconnect as soon as possible`
    );
  } else if (pendingCount >= PENDING_WARN_COUNT) {
    bump('warn');
    messages.push(`${pendingCount} offline changes queued — reconnect today if you can`);
  }

  if (pendingImages >= PENDING_IMAGE_MAX) {
    bump('critical');
    messages.push('Offline image queue is full — sync before adding more product photos');
  } else if (pendingImages >= Math.floor(PENDING_IMAGE_MAX * 0.7)) {
    bump('warn');
    messages.push(`${pendingImages} product images waiting to upload`);
  }

  if (storage.freeMb != null) {
    if (storage.freeMb < STORAGE_CRITICAL_MB) {
      bump('critical');
      messages.push(
        `Low disk space (~${Math.round(storage.freeMb)} MB free) — free space or sync`
      );
    } else if (storage.freeMb < STORAGE_LOW_MB) {
      bump('warn');
      messages.push(`Storage getting low (~${Math.round(storage.freeMb)} MB free)`);
    }
  }

  const failedHeavy = queue.filter((q) => (q.attempts ?? 0) >= 5).length;
  if (failedHeavy > 0) {
    bump('warn');
    messages.push(`${failedHeavy} change(s) failed repeatedly — use Sync when online`);
  }

  const level = state.level;
  const summary =
    level === 'critical'
      ? messages[0] ?? 'Offline storage critical'
      : level === 'warn'
        ? messages[0] ?? 'Reconnect recommended'
        : pendingCount > 0
          ? `${pendingCount} queued · storage OK`
          : 'Local storage healthy';

  return {
    level,
    pendingCount,
    pendingImages,
    freeMb: storage.freeMb,
    usagePct: storage.usagePct,
    messages,
    summary,
  };
}

export function canQueueOfflineImage(pendingImages: number): boolean {
  return pendingImages < PENDING_IMAGE_MAX;
}
