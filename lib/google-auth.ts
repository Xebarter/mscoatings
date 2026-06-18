import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  type UserCredential,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from './firebase';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let redirectResultPromise: Promise<UserCredential | null> | null = null;

export function getGoogleRedirectResultOnce() {
  if (!redirectResultPromise) {
    redirectResultPromise = getRedirectResult(auth);
  }
  return redirectResultPromise;
}

export async function signInWithGoogle() {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (
      error instanceof FirebaseError &&
      (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user')
    ) {
      if (error.code === 'auth/popup-closed-by-user') {
        throw error;
      }
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw error;
  }
}

export function getGoogleAuthErrorMessage(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return 'Failed to sign in with Google. Please try again.';
  }

  switch (error.code) {
    case 'auth/popup-closed-by-user':
      return '';
    case 'auth/invalid-credential':
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled. Enable Google in Firebase Console → Authentication → Sign-in method.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized. Add it in Firebase Console → Authentication → Settings → Authorized domains.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.';
    default:
      return 'Failed to sign in with Google. Please try again.';
  }
}
