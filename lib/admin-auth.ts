import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';

export const ADMIN_ACCESS_DENIED_MESSAGE =
  'This account does not have admin access. Your email must be listed in NEXT_PUBLIC_ADMIN_EMAILS.';

export function getAdminEmails(): string[] {
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '';
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
