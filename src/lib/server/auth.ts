import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getFirestore, admin } from './firebase-admin';
import type { UserRole } from '@/types/enums';
import type { User, OrgContext, GoogleSheetsConfig } from '@/types/organization';

/**
 * Authenticated user context
 */
export interface AuthenticatedUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  orgId: string | null;
  orgName?: string;
}

/**
 * Request context with auth and org info
 */
export interface RequestContext {
  user: AuthenticatedUser;
  org: OrgContext | null;
}

/**
 * API Route handler type with context
 */
export type AuthenticatedHandler = (
  request: NextRequest,
  context: RequestContext
) => Promise<NextResponse>;

/**
 * Extract and verify Firebase token from request
 */
async function verifyToken(request: NextRequest): Promise<admin.auth.DecodedIdToken | null> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.split('Bearer ')[1];
  
  try {
    const auth = getAuth();
    return await auth.verifyIdToken(token);
  } catch {
    return null;
  }
}

/**
 * Get user role from custom claims
 */
function getUserRole(decodedToken: admin.auth.DecodedIdToken): UserRole {
  if (decodedToken.role === 'admin') return 'admin';
  if (decodedToken.role === 'planner') return 'planner';
  if (decodedToken.planner === true) return 'planner';
  if (decodedToken.admin === true) return 'admin';
  return 'viewer';
}

/**
 * Find user's organization from Firestore
 */
async function findUserOrganization(uid: string): Promise<{
  orgId: string;
  orgName: string;
  configStatus: 'pending' | 'configured' | 'error';
  role: UserRole;
} | null> {
  const db = getFirestore();
  
  // Use collection group query to find user across all member subcollections
  let memberQuery;
  try {
    memberQuery = await db
      .collectionGroup('members')
      .where('uid', '==', uid)
      .limit(1)
      .get();
  } catch (error: unknown) {
    const firestoreError = error as { code?: number; message?: string };
    // Handle FAILED_PRECONDITION (code 9) - missing index
    if (firestoreError.code === 9) {
      console.error(
        'Firestore index missing for collection group query on "members.uid".\n' +
        'To fix this, either:\n' +
        '1. Run: firebase deploy --only firestore:indexes\n' +
        '2. Or create the index manually in Firebase Console:\n' +
        '   - Collection group: members\n' +
        '   - Field: uid (Ascending)\n' +
        '   - Query scope: Collection group\n'
      );
    }
    throw error;
  }

  if (memberQuery.empty) {
    return null;
  }

  const memberDoc = memberQuery.docs[0];
  const member = memberDoc.data();

  // Extract orgId from path: organizations/{orgId}/members/{uid}
  const pathParts = memberDoc.ref.path.split('/');
  const orgId = pathParts[1];

  // Get organization
  const orgDoc = await db.collection('organizations').doc(orgId).get();
  if (!orgDoc.exists) {
    return null;
  }

  const org = orgDoc.data()!;

  return {
    orgId,
    orgName: org.name,
    configStatus: org.configStatus,
    role: member.role,
  };
}

/**
 * Get Google Sheets config for an organization
 */
async function getGoogleSheetsConfig(orgId: string): Promise<GoogleSheetsConfig | null> {
  const db = getFirestore();
  const doc = await db
    .collection(`organizations/${orgId}/config`)
    .doc('googleSheets')
    .get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as GoogleSheetsConfig;
}

/**
 * Result of authentication verification
 */
export interface AuthResult {
  authenticated: boolean;
  user: (AuthenticatedUser & { organizationId?: string }) | null;
  org: OrgContext | null;
}

/**
 * Verify authentication for a request and return auth info
 * Unlike withAuth, this doesn't wrap a handler - it just returns the result
 */
export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  const decodedToken = await verifyToken(request);
  
  if (!decodedToken) {
    return { authenticated: false, user: null, org: null };
  }

  // Build user object
  const user: AuthenticatedUser & { organizationId?: string } = {
    uid: decodedToken.uid,
    email: decodedToken.email || '',
    displayName: decodedToken.name || null,
    photoURL: decodedToken.picture || null,
    role: getUserRole(decodedToken),
    orgId: (decodedToken.orgId as string) || null,
  };

  // Try to find user's organization
  let org: OrgContext | null = null;
  const userOrg = await findUserOrganization(user.uid);
  
  if (userOrg) {
    user.role = userOrg.role;
    user.orgId = userOrg.orgId;
    user.orgName = userOrg.orgName;
    user.organizationId = userOrg.orgId; // Alias for convenience

    // Load Google Sheets config if configured
    let googleSheetsConfig: GoogleSheetsConfig | null = null;
    if (userOrg.configStatus === 'configured') {
      googleSheetsConfig = await getGoogleSheetsConfig(userOrg.orgId);
    }

    org = {
      orgId: userOrg.orgId,
      orgName: userOrg.orgName,
      configStatus: userOrg.configStatus,
      googleSheetsConfig,
    };
  }

  return { authenticated: true, user, org };
}

/**
 * Wrapper for authenticated API routes
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const decodedToken = await verifyToken(request);
    
    if (!decodedToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid authorization header',
          },
        },
        { status: 401 }
      );
    }

    // Build user object
    const user: AuthenticatedUser = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      displayName: decodedToken.name || null,
      photoURL: decodedToken.picture || null,
      role: getUserRole(decodedToken),
      orgId: (decodedToken.orgId as string) || null,
    };

    // Try to find user's organization
    let org: OrgContext | null = null;
    const userOrg = await findUserOrganization(user.uid);
    
    if (userOrg) {
      user.role = userOrg.role;
      user.orgId = userOrg.orgId;
      user.orgName = userOrg.orgName;

      // Load Google Sheets config if configured
      let googleSheetsConfig: GoogleSheetsConfig | null = null;
      if (userOrg.configStatus === 'configured') {
        googleSheetsConfig = await getGoogleSheetsConfig(userOrg.orgId);
      }

      org = {
        orgId: userOrg.orgId,
        orgName: userOrg.orgName,
        configStatus: userOrg.configStatus,
        googleSheetsConfig,
      };
    }

    return handler(request, { user, org });
  };
}

/**
 * Wrapper that requires user to be in an organization
 */
export function withOrg(handler: AuthenticatedHandler) {
  return withAuth(async (request, context) => {
    if (!context.org) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_ORGANIZATION',
            message: 'You must be a member of an organization to access this resource',
            details: { requiresOnboarding: true },
          },
        },
        { status: 403 }
      );
    }
    return handler(request, context);
  });
}

/**
 * Wrapper that requires configured organization
 */
export function withConfiguredOrg(handler: AuthenticatedHandler) {
  return withOrg(async (request, context) => {
    if (context.org!.configStatus !== 'configured') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ORG_NOT_CONFIGURED',
            message: 'Your organization has not completed setup',
            details: {
              requiresSetup: true,
              configStatus: context.org!.configStatus,
              isAdmin: context.user.role === 'admin',
            },
          },
        },
        { status: 403 }
      );
    }
    return handler(request, context);
  });
}

/**
 * Wrapper that requires specific roles
 */
export function withRole(...allowedRoles: UserRole[]) {
  return (handler: AuthenticatedHandler) => {
    return withAuth(async (request, context) => {
      if (!allowedRoles.includes(context.user.role)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Insufficient permissions for this action',
            },
          },
          { status: 403 }
        );
      }
      return handler(request, context);
    });
  };
}

/**
 * Set custom claims for a user (orgId, role)
 */
export async function setUserCustomClaims(
  uid: string,
  claims: { orgId?: string; role?: UserRole }
): Promise<void> {
  const auth = getAuth();
  const user = await auth.getUser(uid);
  const existingClaims = user.customClaims || {};

  await auth.setCustomUserClaims(uid, {
    ...existingClaims,
    ...claims,
  });
}
