import { readFileSync } from 'fs';
import { resolve } from 'path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const FIREBASE_ADMIN_MISSING_MESSAGE =
  'Firebase Admin is not configured. Either set FIREBASE_SERVICE_ACCOUNT_PATH to a downloaded key file (e.g. ./ms-coatings-service-account.json), or set FIREBASE_SERVICE_ACCOUNT_JSON to the full JSON string. Get the key from Firebase Console → Project settings → Service accounts → Generate new private key.';

function loadServiceAccountRaw(): string {
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (filePath) {
    try {
      const absolutePath = resolve(process.cwd(), filePath);
      return readFileSync(absolutePath, 'utf8');
    } catch {
      throw new Error(
        `Could not read FIREBASE_SERVICE_ACCOUNT_PATH at "${filePath}". Download your service account JSON from Firebase Console and save it at that path.`
      );
    }
  }

  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    return inline;
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
      'FIREBASE_SERVICE_ACCOUNT_JSON looks like a placeholder (contains "..."). Download the real service account JSON from Firebase Console, save it as ms-coatings-service-account.json in the project root, and set FIREBASE_SERVICE_ACCOUNT_PATH=./ms-coatings-service-account.json in .env'
    );
  }

  try {
    return JSON.parse(trimmed) as Parameters<typeof cert>[0];
  } catch {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON. Prefer FIREBASE_SERVICE_ACCOUNT_PATH=./ms-coatings-service-account.json and save the downloaded key file in the project root instead.'
    );
  }
}

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const serviceAccount = parseServiceAccountJson(loadServiceAccountRaw());

  return initializeApp({
    credential: cert(serviceAccount),
  });
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
