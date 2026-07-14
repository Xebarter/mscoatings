import { isAdminEmail } from '@/lib/admin-auth';
import { getAdminAuth } from '@/lib/firebase-admin';

interface FirebaseLookupResponse {
  users?: Array<{ email?: string }>;
  error?: { message?: string };
}

async function resolveEmailFromIdToken(idToken: string): Promise<string | null> {
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    if (decoded.email) return decoded.email;
  } catch {
    /* fall through */
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      cache: 'no-store',
    }
  );

  if (!response.ok) return null;

  const data = (await response.json()) as FirebaseLookupResponse;
  return data.users?.[0]?.email ?? null;
}

export async function verifyAdminIdToken(
  idToken: string
): Promise<{ email: string } | null> {
  const email = await resolveEmailFromIdToken(idToken);
  if (!email || !isAdminEmail(email)) return null;
  return { email };
}
