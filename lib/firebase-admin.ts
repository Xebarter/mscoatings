import admin from 'firebase-admin';

function initializeFirebaseAdmin() {
  if (admin.apps?.length > 0) {
    return admin.app();
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount;
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      'Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON.'
    );
  }

  return admin.initializeApp({
    projectId,
    credential: admin.credential.applicationDefault(),
  });
}

export function getAdminFirestore() {
  initializeFirebaseAdmin();
  return admin.firestore();
}

export function getAdminTimestamp() {
  initializeFirebaseAdmin();
  return admin.firestore.Timestamp;
}
