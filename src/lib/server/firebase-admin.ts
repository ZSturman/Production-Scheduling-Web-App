import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Initialize Firebase Admin (singleton)
let initialized = false;

export function initializeFirebaseAdmin(): admin.app.App {
  // Check if already initialized
  try {
    return admin.app();
  } catch {
    // App not initialized yet, proceed with initialization
  }

  // Check for service account from environment
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    path.join(process.cwd(), 'service-account.json');

  const loadCredentials = (): admin.ServiceAccount | undefined => {
    // Prefer JSON provided via environment variable to avoid file I/O in serverless
    if (serviceAccount) {
      return JSON.parse(serviceAccount);
    }

    // Allow pointing to a file path via env var
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH && fs.existsSync(serviceAccountPath)) {
      const fileContents = fs.readFileSync(serviceAccountPath, 'utf8');
      return JSON.parse(fileContents);
    }

    // Fallback to local service-account.json for dev convenience
    if (fs.existsSync(serviceAccountPath)) {
      const fileContents = fs.readFileSync(serviceAccountPath, 'utf8');
      return JSON.parse(fileContents);
    }

    return undefined;
  };

  const credentials = loadCredentials();

  if (credentials) {
    const projectId = credentials.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    admin.initializeApp({
      credential: admin.credential.cert(credentials),
      projectId: projectId,
      databaseURL: `https://${projectId}.firebaseio.com`,
    });

    console.log(`Firebase Admin initialized for project: ${projectId}`);
  } else {
    // Use Application Default Credentials (works on Cloud Run automatically)
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    admin.initializeApp({
      projectId: projectId,
      databaseURL: `https://${projectId}.firebaseio.com`,
    });
    
    console.log(`Firebase Admin initialized with default credentials for project: ${projectId}`);
  }

  initialized = true;
  return admin.app();
}

// Get Firestore instance
export function getFirestore(): admin.firestore.Firestore {
  initializeFirebaseAdmin();
  return admin.firestore();
}

// Get Auth instance
export function getAuth(): admin.auth.Auth {
  initializeFirebaseAdmin();
  return admin.auth();
}

// Export admin for direct access if needed
export { admin };
