import { isAdminEmail } from '@/lib/admin-auth';

interface FirebaseLookupResponse {
  users?: Array<{ email?: string }>;
  error?: { message?: string };
}

export async function verifyAdminIdToken(
  idToken: string
): Promise<{ email: string } | null> {
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
  const email = data.users?.[0]?.email;

  if (!email || !isAdminEmail(email)) return null;

  return { email };
}
