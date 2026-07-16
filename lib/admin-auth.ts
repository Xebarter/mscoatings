import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';
import { isAdminEmail } from './admin-emails';

export { getAdminEmails, isAdminEmail } from './admin-emails';

export const ADMIN_ACCESS_DENIED_MESSAGE =
  'This account does not have admin access. Ask a Super Admin to grant Admin access, or use an approved Super Admin email.';

export function userHasAdminRole(user: User): boolean {
  return isAdminEmail(user.email);
}

/** Ensures Firestore requests include a fresh auth token (avoids race after login). */
export async function ensureFirestoreAuthReady(): Promise<void> {
  const currentUser = auth.currentUser;
  if (currentUser) {
    await currentUser.getIdToken();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error('Authentication timed out. Please sign in again.'));
    }, 10_000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      clearTimeout(timeout);
      unsubscribe();

      try {
        await user.getIdToken();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}
