import { auth } from './firebase';

const API_BASE = (import.meta.env.VITE_APP_URL ?? 'https://www.mscoatings.shop').replace(
  /\/$/,
  ''
);

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
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
 */
export async function adminFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = mergeHeaders(await getAuthHeaders(), options.headers);
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  if (window.electronAPI?.apiFetch) {
    const body =
      typeof options.body === 'string'
        ? options.body
        : options.body != null
          ? String(options.body)
          : null;

    const result = await window.electronAPI.apiFetch({
      url,
      method: options.method ?? 'GET',
      headers,
      body,
    });

    return new Response(result.body, {
      status: result.status || (result.ok ? 200 : 502),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

export { API_BASE };
