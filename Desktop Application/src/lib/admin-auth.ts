import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';
import { isOnline } from './offline/connectivity';
import { localGet, localSet, localRemove, type OfflineSession } from './offline/local-store';

export const ADMIN_ACCESS_DENIED_MESSAGE =
  'This account does not have admin access. Your email must be listed in VITE_ADMIN_EMAILS.';

export function getAdminEmails(): string[] {
  const raw = import.meta.env.VITE_ADMIN_EMAILS ?? '';
  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

export function userHasAdminRole(user: User): boolean {
  return isAdminEmail(user.email);
}

export async function saveOfflineSession(user: User): Promise<void> {
  if (!user.email) return;
  const session: OfflineSession = {
    email: user.email.toLowerCase(),
    uid: user.uid,
    displayName: user.displayName ?? undefined,
    savedAt: Date.now(),
  };
  await localSet('session', session);
}

export async function clearOfflineSession(): Promise<void> {
  await localRemove('session');
}

export async function getOfflineSession(): Promise<OfflineSession | null> {
  return localGet<OfflineSession>('session');
}

/**
 * Ensures auth is usable for Firestore.
 * Online: refreshes ID token if needed.
 * Offline: uses cached token without forcing a network refresh.
 */
export async function ensureFirestoreAuthReady(): Promise<void> {
  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      await currentUser.getIdToken(false);
    } catch {
      if (!isOnline()) {
        // Cached token still attached to SDK for offline Firestore rules in many cases
        return;
      }
      throw new Error('Could not refresh authentication. Please sign in again.');
    }
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(
        new Error(
          isOnline()
            ? 'Authentication timed out. Please sign in again.'
            : 'No offline session found. Connect to the internet and sign in once.'
        )
      );
    }, isOnline() ? 10_000 : 4_000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      clearTimeout(timeout);
      unsubscribe();
      try {
        await user.getIdToken(false);
        resolve();
      } catch (error) {
        if (!isOnline()) {
          resolve();
          return;
        }
        reject(error);
      }
    });
  });
}
