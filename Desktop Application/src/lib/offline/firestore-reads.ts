import {
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { isOnline } from './connectivity';

/** Cap server waits so lie-fi (online UI, dead link) cannot hang the UI. */
const SERVER_READ_MS = 4_000;

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'Request timed out'
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Document read that never hangs on a dead network.
 * Offline → cache only. Online → server with timeout, then cache.
 */
export async function getDocHybrid(
  ref: DocumentReference<DocumentData>
): Promise<DocumentSnapshot<DocumentData>> {
  if (!isOnline()) {
    return getDocFromCache(ref);
  }

  try {
    return await withTimeout(getDoc(ref), SERVER_READ_MS);
  } catch {
    return getDocFromCache(ref);
  }
}

/**
 * Query read that never hangs on a dead network.
 * Offline → cache only (never getDocs — that can block forever).
 */
export async function getDocsHybrid(
  q: Query<DocumentData>
): Promise<QuerySnapshot<DocumentData>> {
  if (!isOnline()) {
    return getDocsFromCache(q);
  }

  try {
    return await withTimeout(getDocs(q), SERVER_READ_MS);
  } catch (error) {
    try {
      return await getDocsFromCache(q);
    } catch {
      throw error;
    }
  }
}
