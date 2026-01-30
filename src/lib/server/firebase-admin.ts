import { initializeApp, getApps, cert, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore as getFirestoreInstance, Firestore } from 'firebase-admin/firestore';
import { getAuth as getAuthInstance, Auth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

// Initialize Firebase Admin (singleton)
let initialized = false;

export function initializeFirebaseAdmin(): App {
  // Check if already initialized
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  // Check for service account from environment
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    path.join(process.cwd(), 'service-account.json');

  const loadCredentials = (): ServiceAccount | undefined => {
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
  let app: App;

  if (credentials) {
    const projectId = (credentials as ServiceAccount & { project_id?: string }).project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    app = initializeApp({
      credential: cert(credentials),
      projectId: projectId,
      databaseURL: `https://${projectId}.firebaseio.com`,
    });

    console.log(`Firebase Admin initialized for project: ${projectId}`);
  } else {
    // Use Application Default Credentials (works on Cloud Run automatically)
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    app = initializeApp({
      projectId: projectId,
      databaseURL: `https://${projectId}.firebaseio.com`,
    });
    
    console.log(`Firebase Admin initialized with default credentials for project: ${projectId}`);
  }

  initialized = true;
  return app;
}

// Get Firestore instance
export function getFirestore(): Firestore {
  initializeFirebaseAdmin();
  return getFirestoreInstance();
}

// Get Auth instance
export function getAuth(): Auth {
  initializeFirebaseAdmin();
  return getAuthInstance();
}
