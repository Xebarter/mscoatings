import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';
import { isOnline } from './offline/connectivity';
import {
  localGet,
  localSet,
  localRemove,
  type OfflineSession,
  type OfflineAccessStatus,
} from './offline/local-store';
import type { StaffRole } from './types';

export const ADMIN_ACCESS_DENIED_MESSAGE =
  'Your account does not have access yet. Ask a Super Admin to approve you from the web admin dashboard.';

export function getAdminEmails(): string[] {
  const raw = import.meta.env.VITE_ADMIN_EMAILS ?? '';
  return raw
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

export function userHasAdminRole(user: User): boolean {
  return isAdminEmail(user.email);
}

export type OfflineSessionAccess = {
  accessStatus: OfflineAccessStatus;
  role?: StaffRole;
  isSuperAdmin?: boolean;
  active?: boolean;
};

export async function saveOfflineSession(
  user: User,
  access?: OfflineSessionAccess
): Promise<void> {
  if (!user.email) return;
  const previous = await getOfflineSession();
  const session: OfflineSession = {
    email: user.email.toLowerCase(),
    uid: user.uid,
    displayName: user.displayName ?? previous?.displayName,
    savedAt: Date.now(),
    accessStatus: access?.accessStatus ?? previous?.accessStatus,
    role: access?.role ?? previous?.role,
    isSuperAdmin: access?.isSuperAdmin ?? previous?.isSuperAdmin,
    active: access?.active ?? previous?.active,
  };
  await localSet('session', session);
}

export async function clearOfflineSession(): Promise<void> {
  await localRemove('session');
}

export async function getOfflineSession(): Promise<OfflineSession | null> {
  return localGet<OfflineSession>('session');
}

/** Refresh session timestamp so a trusted desktop login stays durable. */
export async function touchOfflineSession(): Promise<void> {
  const session = await getOfflineSession();
  if (!session) return;
  await localSet('session', { ...session, savedAt: Date.now() });
}

/**
 * Ensures auth is usable for Firestore.
 * Online: refreshes ID token if needed.
 * Offline: uses cached token without forcing a network refresh — never blocks POS.
 */
export async function ensureFirestoreAuthReady(): Promise<void> {
  const currentUser = auth.currentUser;
  if (currentUser) {
    if (!isOnline()) {
      // Cached auth is enough for offline local writes
      try {
        await Promise.race([
          currentUser.getIdToken(false),
          new Promise((resolve) => setTimeout(resolve, 400)),
        ]);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      await currentUser.getIdToken(false);
    } catch {
      // Don't force sign-out; local/offline work can continue with trusted session.
      const session = await getOfflineSession();
      if (session?.accessStatus === 'super_admin' || session?.accessStatus === 'staff') {
        return;
      }
      throw new Error('Could not refresh authentication. Please sign in again.');
    }
    return;
  }

  // No Firebase user yet — trusted desktop session is enough for local ops.
  const existing = await getOfflineSession();
  if (
    existing?.accessStatus === 'super_admin' ||
    existing?.accessStatus === 'staff'
  ) {
    if (!isOnline()) return;
    // Online without Auth: wait briefly for persistence restore, then allow local ops.
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(async () => {
      unsubscribe();
      const session = await getOfflineSession();
      if (session?.accessStatus === 'super_admin' || session?.accessStatus === 'staff') {
        resolve();
        return;
      }
      reject(
        new Error(
          isOnline()
            ? 'Authentication timed out. Please sign in again.'
            : 'No offline session found. Connect to the internet and sign in once.'
        )
      );
    }, isOnline() ? 10_000 : 2_000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      clearTimeout(timeout);
      unsubscribe();
      try {
        if (isOnline()) {
          await user.getIdToken(false);
        }
        resolve();
      } catch (error) {
        if (!isOnline()) {
          resolve();
          return;
        }
        const session = await getOfflineSession();
        if (session?.accessStatus === 'super_admin' || session?.accessStatus === 'staff') {
          resolve();
          return;
        }
        reject(error);
      }
    });
  });
}
