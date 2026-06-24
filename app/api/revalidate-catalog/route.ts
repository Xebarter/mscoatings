import { NextRequest, NextResponse } from 'next/server';
import { revalidateCatalog } from '@/lib/revalidate-catalog';
import { verifyAdminIdToken } from '@/lib/verify-admin-token';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const idToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!idToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = await verifyAdminIdToken(idToken);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let productId: string | undefined;
  try {
    const body = await request.json();
    productId =
      typeof body?.productId === 'string' ? body.productId : undefined;
  } catch {
    productId = undefined;
  }

  revalidateCatalog(productId);

  return NextResponse.json({ revalidated: true });
}
