import { doc, getDocFromCache, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { ensureFirestoreAuthReady } from './admin-auth';
import { isOnline } from './offline/connectivity';
import { getDocHybrid } from './offline/firestore-reads';

function staffDocId(email: string): string {
  return email.trim().toLowerCase().replace('@', '_at_').replace(/\./g, '_dot_');
}

/**
 * Creates a pending staff record in Firestore (active: false).
 * Does not require the production HTTP API — works as soon as rules are deployed.
 */
export async function requestStaffAccess(displayName: string): Promise<void> {
  await ensureFirestoreAuthReady();
  const user = auth.currentUser;
  if (!user?.email) {
    throw new Error('You must be signed in to request access.');
  }

  const email = user.email.trim().toLowerCase();
  const name =
    displayName.trim() || user.displayName?.trim() || email.split('@')[0];
  if (!name) {
    throw new Error('Please provide your name.');
  }

  if (!isOnline()) {
    throw new Error('Connect to the internet to request access the first time.');
  }

  const ref = doc(db, 'staff', staffDocId(email));

  try {
    const existing = await getDocHybrid(ref).catch(() => getDocFromCache(ref));
    if (existing.exists()) {
      const data = existing.data();
      if (data.active) {
        throw new Error('This account already has access. Sign out and sign in again.');
      }
      return;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('already has access')) throw error;
  }

  try {
    await setDoc(ref, {
      email,
      displayName: name,
      role: 'sales',
      isSuperAdmin: false,
      active: false,
      createdAt: Timestamp.now(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    if (message.includes('permission')) {
      throw new Error(
        'Missing permissions. Ask a Super Admin to deploy the latest Firestore rules, then try again.'
      );
    }
    throw error instanceof Error ? error : new Error('Request failed');
  }
}
