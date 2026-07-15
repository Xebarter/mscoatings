type Listener = (online: boolean) => void;

const listeners = new Set<Listener>();

/** Effective connectivity used by the app (navigator + reachability probes). */
let online = typeof navigator !== 'undefined' ? navigator.onLine : true;

/** Last successful probe timestamp (ms). */
let lastReachableAt: number | null = null;

function notify() {
  for (const listener of listeners) {
    listener(online);
  }
}

function setOnlineState(next: boolean, reason?: string) {
  if (online === next) return;
  online = next;
  if (next) lastReachableAt = Date.now();
  if (typeof console !== 'undefined') {
    console.info(`[connectivity] ${next ? 'online' : 'offline'}${reason ? ` (${reason})` : ''}`);
  }
  notify();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setOnlineState(true, 'navigator-online');
  });
  window.addEventListener('offline', () => {
    setOnlineState(false, 'navigator-offline');
  });
}

export function isOnline(): boolean {
  return online;
}

export function getLastReachableAt(): number | null {
  return lastReachableAt;
}

/**
 * Force connectivity state (used by reachability probes).
 * Prefer markReachable/markUnreachable over calling this directly.
 */
export function forceOnlineState(next: boolean, reason?: string): void {
  setOnlineState(next, reason);
}

export function subscribeConnectivity(listener: Listener): () => void {
  listeners.add(listener);
  listener(online);
  return () => {
    listeners.delete(listener);
  };
}

export function waitForOnline(timeoutMs = 30_000): Promise<boolean> {
  if (online) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeoutMs);
    const unsubscribe = subscribeConnectivity((next) => {
      if (next) {
        clearTimeout(timer);
        unsubscribe();
        resolve(true);
      }
    });
  });
}

function probeUrl(): string {
  const base = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '');
  if (base) return `${base}/favicon.ico?_=${Date.now()}`;
  return `https://www.gstatic.com/generate_204?_=${Date.now()}`;
}

/**
 * Active reachability check. Updates online state when the result differs
 * from navigator-only guessing (fixes Electron / lie-fi).
 */
export async function probeReachability(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    forceOnlineState(false, 'navigator-offline-probe');
    return false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(probeUrl(), {
      method: 'GET',
      cache: 'no-store',
      mode: 'no-cors',
      signal: controller.signal,
    });
    // no-cors → opaque; reaching here means the network path worked
    void res;
    forceOnlineState(true, 'probe-ok');
    lastReachableAt = Date.now();
    return true;
  } catch {
    // If the OS still claims online, stay optimistic but record failure for callers.
    // Only force offline when navigator also says offline, or repeated failures (handled by sync).
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      forceOnlineState(false, 'probe-fail');
    }
    return false;
  } finally {
    clearTimeout(timer);
  }
}
