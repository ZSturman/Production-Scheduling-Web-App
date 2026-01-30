import { getFirestore } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { decrypt, encrypt, getEncryptionKeyVersion, validateServiceAccountJson } from './crypto';
import type {
  Organization,
  OrganizationMember,
  GoogleSheetsConfig,
  EncryptedCredentials,
  OrganizationInvite,
  OrgConfigStatus,
  SheetNamesConfig,
} from '@/types/organization';
import type { UserRole } from '@/types/enums';

// Collection paths
const COLLECTIONS = {
  organizations: 'organizations',
  members: (orgId: string) => `organizations/${orgId}/members`,
  config: (orgId: string) => `organizations/${orgId}/config`,
  secrets: (orgId: string) => `organizations/${orgId}/secrets`,
  invites: (orgId: string) => `organizations/${orgId}/invites`,
} as const;

const CONFIG_DOCS = {
  googleSheets: 'googleSheets',
  googleServiceAccount: 'googleServiceAccount',
  sheetNames: 'sheetNames',
} as const;

// ============================================================================
// Organization CRUD
// ============================================================================

export async function createOrganization(
  name: string,
  creatorUid: string,
  creatorEmail: string,
  creatorDisplayName: string | null
): Promise<{ organization: Organization; member: OrganizationMember }> {
  const db = getFirestore();
  const orgRef = db.collection(COLLECTIONS.organizations).doc();
  const now = new Date().toISOString();

  const organization: Organization = {
    id: orgRef.id,
    name,
    createdAt: now,
    createdBy: creatorUid,
    configStatus: 'pending',
    memberCount: 1,
  };

  const member: OrganizationMember = {
    uid: creatorUid,
    email: creatorEmail,
    displayName: creatorDisplayName,
    role: 'admin',
    joinedAt: now,
    invitedBy: null,
  };

  const batch = db.batch();
  batch.set(orgRef, organization);
  batch.set(
    db.collection(COLLECTIONS.members(orgRef.id)).doc(creatorUid),
    member
  );

  await batch.commit();

  return { organization, member };
}

export async function getOrganization(orgId: string): Promise<Organization | null> {
  const db = getFirestore();
  const doc = await db.collection(COLLECTIONS.organizations).doc(orgId).get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as Organization;
}

export async function updateOrganizationConfigStatus(
  orgId: string,
  status: OrgConfigStatus
): Promise<void> {
  const db = getFirestore();
  await db.collection(COLLECTIONS.organizations).doc(orgId).update({
    configStatus: status,
  });
}

// ============================================================================
// Member Management
// ============================================================================

export async function getOrganizationMember(
  orgId: string,
  uid: string
): Promise<OrganizationMember | null> {
  const db = getFirestore();
  const doc = await db.collection(COLLECTIONS.members(orgId)).doc(uid).get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as OrganizationMember;
}

export async function addOrganizationMember(
  orgId: string,
  member: OrganizationMember
): Promise<void> {
  const db = getFirestore();
  const batch = db.batch();

  batch.set(db.collection(COLLECTIONS.members(orgId)).doc(member.uid), member);
  batch.update(db.collection(COLLECTIONS.organizations).doc(orgId), {
    memberCount: FieldValue.increment(1),
  });

  await batch.commit();
}

export async function getOrganizationMembers(orgId: string): Promise<OrganizationMember[]> {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTIONS.members(orgId)).get();

  return snapshot.docs.map((doc) => doc.data() as OrganizationMember);
}

export async function findUserOrganization(uid: string): Promise<{
  organization: Organization;
  member: OrganizationMember;
} | null> {
  const db = getFirestore();

  const memberQuery = await db
    .collectionGroup('members')
    .where('uid', '==', uid)
    .limit(1)
    .get();

  if (memberQuery.empty) {
    return null;
  }

  const memberDoc = memberQuery.docs[0];
  const member = memberDoc.data() as OrganizationMember;

  const pathParts = memberDoc.ref.path.split('/');
  const orgId = pathParts[1];

  const organization = await getOrganization(orgId);
  if (!organization) {
    return null;
  }

  return { organization, member };
}

// ============================================================================
// Google Sheets Configuration
// ============================================================================

export async function getGoogleSheetsConfig(
  orgId: string
): Promise<GoogleSheetsConfig | null> {
  const db = getFirestore();
  const doc = await db
    .collection(COLLECTIONS.config(orgId))
    .doc(CONFIG_DOCS.googleSheets)
    .get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as GoogleSheetsConfig;
}

export async function saveGoogleSheetsConfig(
  orgId: string,
  config: Omit<GoogleSheetsConfig, 'configured'>
): Promise<void> {
  const db = getFirestore();

  const fullConfig: GoogleSheetsConfig = {
    ...config,
    configured: true,
  };

  await db
    .collection(COLLECTIONS.config(orgId))
    .doc(CONFIG_DOCS.googleSheets)
    .set(fullConfig);

  await updateOrganizationConfigStatus(orgId, 'configured');
}

export async function saveServiceAccountCredentials(
  orgId: string,
  serviceAccountJson: string,
  creatorUid: string
): Promise<{ email: string }> {
  const validation = validateServiceAccountJson(serviceAccountJson);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const encryptedData = encrypt(serviceAccountJson);

  const credentials: EncryptedCredentials = {
    encryptedData,
    encryptionKeyVersion: getEncryptionKeyVersion(),
    createdAt: new Date().toISOString(),
    createdBy: creatorUid,
    lastUsed: null,
  };

  const db = getFirestore();
  await db
    .collection(COLLECTIONS.secrets(orgId))
    .doc(CONFIG_DOCS.googleServiceAccount)
    .set(credentials);

  return { email: validation.email! };
}

export async function getServiceAccountCredentials(orgId: string): Promise<string | null> {
  const db = getFirestore();
  const doc = await db
    .collection(COLLECTIONS.secrets(orgId))
    .doc(CONFIG_DOCS.googleServiceAccount)
    .get();

  if (!doc.exists) {
    return null;
  }

  const credentials = doc.data() as EncryptedCredentials;
  const decrypted = decrypt(credentials.encryptedData);

  await doc.ref.update({ lastUsed: new Date().toISOString() });

  return decrypted;
}

export async function deleteGoogleSheetsConfig(orgId: string): Promise<void> {
  const db = getFirestore();
  const batch = db.batch();

  batch.delete(
    db.collection(COLLECTIONS.config(orgId)).doc(CONFIG_DOCS.googleSheets)
  );
  batch.delete(
    db.collection(COLLECTIONS.secrets(orgId)).doc(CONFIG_DOCS.googleServiceAccount)
  );

  await batch.commit();

  await updateOrganizationConfigStatus(orgId, 'pending');
}

// ============================================================================
// Invites
// ============================================================================

export async function createInvite(
  orgId: string,
  orgName: string,
  email: string,
  role: UserRole,
  inviteCode: string,
  creatorUid: string,
  expiresInDays: number = 7
): Promise<OrganizationInvite> {
  const db = getFirestore();
  const inviteRef = db.collection(COLLECTIONS.invites(orgId)).doc();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

  const invite: OrganizationInvite = {
    id: inviteRef.id,
    orgId,
    orgName,
    email,
    role,
    inviteCode,
    status: 'pending',
    createdAt: now.toISOString(),
    createdBy: creatorUid,
    expiresAt: expiresAt.toISOString(),
  };

  await inviteRef.set(invite);

  return invite;
}

export async function getInviteByCode(inviteCode: string): Promise<OrganizationInvite | null> {
  const db = getFirestore();

  const query = await db
    .collectionGroup('invites')
    .where('inviteCode', '==', inviteCode)
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (query.empty) {
    return null;
  }

  const invite = query.docs[0].data() as OrganizationInvite;

  if (new Date(invite.expiresAt) < new Date()) {
    await query.docs[0].ref.update({ status: 'expired' });
    return null;
  }

  return invite;
}

export async function acceptInvite(
  inviteCode: string,
  uid: string,
  email: string,
  displayName: string | null
): Promise<{ organization: Organization; member: OrganizationMember } | null> {
  const invite = await getInviteByCode(inviteCode);
  if (!invite) {
    return null;
  }

  const db = getFirestore();
  const now = new Date().toISOString();

  const member: OrganizationMember = {
    uid,
    email,
    displayName,
    role: invite.role,
    joinedAt: now,
    invitedBy: invite.createdBy,
  };

  await db.runTransaction(async (transaction) => {
    const inviteRef = db
      .collection(COLLECTIONS.invites(invite.orgId))
      .doc(invite.id);

    transaction.update(inviteRef, {
      status: 'accepted',
      acceptedAt: now,
      acceptedBy: uid,
    });

    transaction.set(
      db.collection(COLLECTIONS.members(invite.orgId)).doc(uid),
      member
    );

    transaction.update(
      db.collection(COLLECTIONS.organizations).doc(invite.orgId),
      { memberCount: FieldValue.increment(1) }
    );
  });

  const organization = await getOrganization(invite.orgId);
  if (!organization) {
    throw new Error('Organization not found after accepting invite');
  }

  return { organization, member };
}

export async function getOrganizationInvites(orgId: string): Promise<OrganizationInvite[]> {
  const db = getFirestore();
  const snapshot = await db
    .collection(COLLECTIONS.invites(orgId))
    .where('status', '==', 'pending')
    .get();

  return snapshot.docs.map((doc) => doc.data() as OrganizationInvite);
}

// ============================================================================
// Sheet Names Configuration
// ============================================================================

const DEFAULT_SHEET_NAMES: SheetNamesConfig = {
  products: 'Products',
  workCenters: 'Work Centers',
  holidays: 'Holidays',
  settings: 'Settings',
  auditLog: '_AuditLog',
  syncMetadata: '_SyncMetadata',
};

export async function getSheetNamesConfig(orgId: string): Promise<SheetNamesConfig> {
  const db = getFirestore();
  
  // First check if custom names are stored in the googleSheets config
  const gsConfig = await getGoogleSheetsConfig(orgId);
  if (gsConfig?.sheetNames) {
    return { ...DEFAULT_SHEET_NAMES, ...gsConfig.sheetNames };
  }
  
  // Check for separate sheetNames doc (legacy support)
  const doc = await db
    .collection(COLLECTIONS.config(orgId))
    .doc(CONFIG_DOCS.sheetNames)
    .get();

  if (!doc.exists) {
    return DEFAULT_SHEET_NAMES;
  }

  return { ...DEFAULT_SHEET_NAMES, ...(doc.data() as Partial<SheetNamesConfig>) };
}

export async function saveSheetNamesConfig(
  orgId: string,
  sheetNames: Partial<SheetNamesConfig>
): Promise<void> {
  const db = getFirestore();
  
  // Get current Google Sheets config
  const gsConfig = await getGoogleSheetsConfig(orgId);
  if (!gsConfig) {
    throw new Error('Google Sheets not configured for this organization');
  }
  
  // Update the googleSheets config with the new sheet names
  const updatedConfig: GoogleSheetsConfig = {
    ...gsConfig,
    sheetNames: { ...DEFAULT_SHEET_NAMES, ...gsConfig.sheetNames, ...sheetNames },
  };
  
  await db
    .collection(COLLECTIONS.config(orgId))
    .doc(CONFIG_DOCS.googleSheets)
    .set(updatedConfig);
}

// ============================================================================
// Member Activity Tracking
// ============================================================================

export async function updateMemberLastLogin(
  orgId: string,
  uid: string
): Promise<void> {
  const db = getFirestore();
  await db.collection(COLLECTIONS.members(orgId)).doc(uid).update({
    lastLogin: new Date().toISOString(),
  });
}
