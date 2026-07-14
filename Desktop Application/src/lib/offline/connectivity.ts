type Listener = (online: boolean) => void;

const listeners = new Set<Listener>();
let online = typeof navigator !== 'undefined' ? navigator.onLine : true;

function notify() {
  for (const listener of listeners) {
    listener(online);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    online = true;
    notify();
  });
  window.addEventListener('offline', () => {
    online = false;
    notify();
  });
}

export function isOnline(): boolean {
  return online;
}

export function subscribeConnectivity(listener: Listener): () => void {
  listeners.add(listener);
  listener(online);
  return () => listeners.delete(listener);
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
