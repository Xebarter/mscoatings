import { auth } from './firebase';

const API_BASE = (import.meta.env.VITE_APP_URL ?? 'https://www.mscoatings.shop').replace(
  /\/$/,
  ''
);

export async function getAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function adminFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = await getAuthHeaders();
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  return fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers ?? {}) },
  });
}

export { API_BASE };
