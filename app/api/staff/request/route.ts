import { NextRequest, NextResponse } from 'next/server';
import { getBearerToken } from '@/lib/verify-staff-token';
import { isAdminEmail } from '@/lib/admin-auth';
import { requestStaffAccess } from '@/lib/staff-server';

interface FirebaseLookupResponse {
  users?: Array<{ email?: string; localId?: string }>;
}

async function lookupAuthUser(idToken: string) {
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
  const user = data.users?.[0];
  if (!user?.email || !user.localId) return null;

  return { email: user.email, uid: user.localId };
}

/** Desktop self-registration — creates a pending staff record for super admin approval. */
export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await lookupAuthUser(token);
  if (!user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (isAdminEmail(user.email)) {
    return NextResponse.json(
      { error: 'Super admin accounts already have full access.' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const displayName =
      typeof body.displayName === 'string' && body.displayName.trim()
        ? body.displayName.trim()
        : user.email.split('@')[0];

    const result = await requestStaffAccess({
      email: user.email,
      displayName,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Staff access request error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to submit access request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
