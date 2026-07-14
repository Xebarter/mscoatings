/**
 * Wipe operational Firestore data while keeping products + Super Admins.
 *
 * Usage (from project root):
 *   npx tsx --env-file=.env scripts/wipe-operational-data.ts
 *   npx tsx --env-file=.env scripts/wipe-operational-data.ts --confirm
 *
 * Without --confirm: dry-run only (lists what would be deleted).
 * With --confirm: performs the deletes.
 *
 * Kept:
 *   - products (all documents)
 *   - staff where isSuperAdmin == true OR email is in NEXT_PUBLIC_ADMIN_EMAILS
 *
 * Cleared:
 *   - orders, sales, customers, stockMovements
 *   - fieldAgents, fieldPicks, contactMessages
 *   - other staff (pending / non–super-admin)
 *
 * Does NOT touch Firebase Authentication users.
 * Does NOT reset product stock fields (product docs are left as-is).
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

const WIPE_COLLECTIONS = [
  'orders',
  'sales',
  'customers',
  'stockMovements',
  'fieldAgents',
  'fieldPicks',
  'contactMessages',
] as const;

function loadEnvFromFile() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* rely on --env-file / existing env */
  }
}

function getBootstrapEmails(): Set<string> {
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '';
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

function initAdmin(): Firestore {
  if (getApps().length === 0) {
    const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
    const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    let raw: string;
    if (pathEnv) {
      raw = readFileSync(resolve(process.cwd(), pathEnv), 'utf8');
    } else if (jsonEnv) {
      raw = jsonEnv;
    } else {
      throw new Error(
        'Missing FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON in .env'
      );
    }
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  return getFirestore();
}

async function countCollection(db: Firestore, name: string): Promise<number> {
  const snap = await db.collection(name).count().get();
  return snap.data().count;
}

async function deleteCollection(
  db: Firestore,
  name: string,
  batchSize = 400
): Promise<number> {
  let deleted = 0;
  for (;;) {
    const snap = await db.collection(name).limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < batchSize) break;
  }
  return deleted;
}

async function main() {
  loadEnvFromFile();
  const confirm = process.argv.includes('--confirm');
  const db = initAdmin();
  const bootstrap = getBootstrapEmails();

  console.log('\nMS Coatings — operational data wipe');
  console.log(confirm ? 'MODE: CONFIRM (will delete)\n' : 'MODE: dry-run (no deletes)\n');
  console.log('Keeping: products (all), Super Admins / bootstrap admin emails');
  if (bootstrap.size) {
    console.log('Bootstrap emails:', [...bootstrap].join(', '));
  } else {
    console.log('Warning: NEXT_PUBLIC_ADMIN_EMAILS is empty');
  }

  console.log('\nCollection counts:');
  const productCount = await countCollection(db, 'products');
  console.log(`  products          ${productCount}  (KEEP)`);

  for (const name of WIPE_COLLECTIONS) {
    const n = await countCollection(db, name);
    console.log(`  ${name.padEnd(18)} ${n}  (WIPE)`);
  }

  const staffSnap = await db.collection('staff').get();
  const keepStaff: string[] = [];
  const wipeStaff: string[] = [];

  for (const doc of staffSnap.docs) {
    const data = doc.data();
    const email = String(data.email ?? '').trim().toLowerCase();
    const keep =
      data.isSuperAdmin === true || (email && bootstrap.has(email));
    if (keep) keepStaff.push(`${email || doc.id} (${doc.id})`);
    else wipeStaff.push(`${email || doc.id} (${doc.id})`);
  }

  console.log(`\n  staff keep (${keepStaff.length}):`);
  keepStaff.forEach((s) => console.log(`    ✓ ${s}`));
  console.log(`  staff wipe (${wipeStaff.length}):`);
  wipeStaff.forEach((s) => console.log(`    ✗ ${s}`));

  if (!confirm) {
    console.log(
      '\nDry-run only. To execute:\n  npx tsx --env-file=.env scripts/wipe-operational-data.ts --confirm\n'
    );
    return;
  }

  console.log('\nDeleting…');
  for (const name of WIPE_COLLECTIONS) {
    const n = await deleteCollection(db, name);
    console.log(`  deleted ${n} from ${name}`);
  }

  let staffDeleted = 0;
  for (const doc of staffSnap.docs) {
    const data = doc.data();
    const email = String(data.email ?? '').trim().toLowerCase();
    const keep =
      data.isSuperAdmin === true || (email && bootstrap.has(email));
    if (!keep) {
      await doc.ref.delete();
      staffDeleted += 1;
    }
  }
  console.log(`  deleted ${staffDeleted} from staff`);

  console.log('\nDone. Products and Super Admins preserved.');
  console.log(
    'Note: Desktop offline cache may still show old data — restart the desktop app or clear its offline cache once online.\n'
  );
}

main().catch((error) => {
  console.error('\nWipe failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
