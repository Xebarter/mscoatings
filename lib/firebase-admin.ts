import { readFileSync } from 'fs';
import { resolve } from 'path';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const FIREBASE_ADMIN_MISSING_MESSAGE =
  'Firebase Admin is not configured. On Vercel set FIREBASE_SERVICE_ACCOUNT_JSON to the full service-account JSON (one line). Locally you can use FIREBASE_SERVICE_ACCOUNT_PATH=./ms-coatings-service-account.json instead.';

let cachedApp: App | null = null;
let initError: Error | null = null;

function loadServiceAccountRaw(): string {
  // Prefer inline JSON in production (Vercel has no local key file).
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    return inline;
  }

  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (filePath) {
    try {
      const absolutePath = resolve(process.cwd(), filePath);
      return readFileSync(absolutePath, 'utf8');
    } catch {
      throw new Error(
        `Could not read FIREBASE_SERVICE_ACCOUNT_PATH at "${filePath}". On Vercel use FIREBASE_SERVICE_ACCOUNT_JSON instead of a file path.`
      );
    }
  }

  throw new Error(FIREBASE_ADMIN_MISSING_MESSAGE);
}

function parseServiceAccountJson(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(FIREBASE_ADMIN_MISSING_MESSAGE);
  }

  if (trimmed.includes('...')) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON looks like a placeholder (contains "..."). Paste the full downloaded service account JSON.'
    );
  }

  try {
    return JSON.parse(trimmed) as Parameters<typeof cert>[0];
  } catch {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON. Paste the full key on one line in Vercel env vars.'
    );
  }
}

function initializeFirebaseAdmin(): App {
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApps()[0]!;
    return cachedApp;
  }
  if (initError) throw initError;

  try {
    const serviceAccount = parseServiceAccountJson(loadServiceAccountRaw());
    cachedApp = initializeApp({
      credential: cert(serviceAccount),
    });
    return cachedApp;
  } catch (error) {
    initError =
      error instanceof Error ? error : new Error(FIREBASE_ADMIN_MISSING_MESSAGE);
    throw initError;
  }
}

export function getAdminFirestore() {
  initializeFirebaseAdmin();
  return getFirestore();
}

export function getAdminAuth() {
  initializeFirebaseAdmin();
  return getAuth();
}

export function getAdminTimestamp() {
  return Timestamp;
}
