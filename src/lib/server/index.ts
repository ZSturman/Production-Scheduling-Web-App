// Server-side utilities and services
// These should only be imported in API routes (app/api/**/route.ts)

export { initializeFirebaseAdmin, getFirestore, getAuth, admin } from './firebase-admin';
export { withAuth, withOrg, withConfiguredOrg, withRole, setUserCustomClaims, verifyAuth } from './auth';
export type { AuthenticatedUser, RequestContext, AuthenticatedHandler, AuthResult } from './auth';

export { encrypt, decrypt, validateServiceAccountJson, getEncryptionKey, getEncryptionKeyVersion } from './crypto';

export * from './firestoreService';

export { 
  GoogleSheetsService, 
  createGoogleSheetsClient, 
  createTestGoogleSheetsClient,
  clearOrgServiceCache,
  SHEET_NAMES,
  PRODUCT_COLUMNS,
  WORK_CENTER_COLUMNS,
} from './googleSheets';

export { SchedulingEngine } from './schedulingEngine';
export { PriorityService } from './priorityService';
