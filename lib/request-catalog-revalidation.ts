import { auth } from '@/lib/firebase';

export async function requestCatalogRevalidation(productId?: string) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const idToken = await user.getIdToken();
    await fetch('/api/revalidate-catalog', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId }),
      cache: 'no-store',
    });
  } catch (error) {
    console.warn('Failed to revalidate public catalog cache:', error);
  }
}
