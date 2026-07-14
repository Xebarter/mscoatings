import { auth } from './firebase';
import { isOnline } from './offline/connectivity';
import { withTimeout } from './offline/firestore-reads';

const API_BASE = (import.meta.env.VITE_APP_URL ?? 'https://www.mscoatings.shop').replace(
  /\/$/,
  ''
);

const FETCH_TIMEOUT_MS = 12_000;

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken(false);
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function mergeHeaders(
  base: Record<string, string>,
  extra?: HeadersInit
): Record<string, string> {
  const out = { ...base };
  if (!extra) return out;
  if (extra instanceof Headers) {
    extra.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(extra)) {
    for (const [key, value] of extra) out[key] = value;
    return out;
  }
  return { ...out, ...extra };
}

/**
 * Authenticated fetch to the web ERP API.
 * In Electron, requests go through the main process to avoid renderer CORS.
 * Fails fast when offline; times out under lie-fi.
 */
export async function adminFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  if (!isOnline()) {
    throw new Error('You are offline');
  }

  const headers = mergeHeaders(await getAuthHeaders(), options.headers);
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  if (window.electronAPI?.apiFetch) {
    const body =
      typeof options.body === 'string'
        ? options.body
        : options.body != null
          ? String(options.body)
          : null;

    const result = await withTimeout(
      window.electronAPI.apiFetch({
        url,
        method: options.method ?? 'GET',
        headers,
        body,
      }),
      FETCH_TIMEOUT_MS,
      'API request timed out'
    );

    return new Response(result.body, {
      status: result.status || (result.ok ? 200 : 502),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export { API_BASE };
