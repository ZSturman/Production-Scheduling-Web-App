import * as admin from 'firebase-admin';

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
  
  if (serviceAccount) {
    // Parse JSON from environment variable
    try {
      const credentials = JSON.parse(serviceAccount);
      admin.initializeApp({
        credential: admin.credential.cert(credentials),
        projectId: credentials.project_id,
      });
    } catch (error) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', error);
      throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON');
    }
  } else {
    // Use Application Default Credentials (works on Cloud Run automatically)
    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
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
