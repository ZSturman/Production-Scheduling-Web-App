import { UserRole } from './enums';

export type OrgConfigStatus = 'pending' | 'configured' | 'error';
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  configStatus: OrgConfigStatus;
  memberCount: number;
}

export interface OrganizationMember {
  uid: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  joinedAt: string;
  invitedBy: string | null;
  lastLogin?: string;
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  spreadsheetName?: string;
  serviceAccountEmail: string;
  configured: boolean;
  lastValidated: string | null;
  lastValidationError: string | null;
  // Dynamic sheet names (custom names override defaults)
  sheetNames?: SheetNamesConfig;
}

// Configuration for custom sheet names
export interface SheetNamesConfig {
  products: string;
  workCenters: string;
  holidays: string;
  settings: string;
  auditLog?: string;
  syncMetadata?: string;
}

export interface EncryptedCredentials {
  encryptedData: string;
  encryptionKeyVersion: string;
  createdAt: string;
  createdBy: string;
  lastUsed: string | null;
}

export interface OrganizationInvite {
  id: string;
  orgId: string;
  orgName: string;
  email: string;
  role: UserRole;
  inviteCode: string;
  status: InviteStatus;
  createdAt: string;
  createdBy: string;
  expiresAt: string;
  acceptedAt?: string;
  acceptedBy?: string;
}

export interface User {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  orgId: string | null;
  orgName?: string;
}

export interface CreateOrganizationRequest {
  name: string;
}

export interface CreateOrganizationResponse {
  organization: Organization;
  member: OrganizationMember;
}

export interface InviteUserRequest {
  email: string;
  role: UserRole;
}

export interface InviteUserResponse {
  invite: OrganizationInvite;
  inviteLink: string;
}

export interface JoinOrganizationRequest {
  inviteCode: string;
}

export interface JoinOrganizationResponse {
  organization: Organization;
  member: OrganizationMember;
}

export interface SaveGoogleSheetsConfigRequest {
  spreadsheetId: string;
  serviceAccountJson: string;
}

export interface GoogleSheetsConfigResponse {
  config: GoogleSheetsConfig | null;
  requiresSetup: boolean;
}

export interface TestGoogleSheetsRequest {
  spreadsheetId: string;
  serviceAccountJson: string;
}

export interface TestGoogleSheetsResponse {
  success: boolean;
  spreadsheetName?: string;
  sheetNames?: string[];
  error?: string;
  troubleshooting?: string[];
}

export interface OrgContext {
  orgId: string;
  orgName: string;
  configStatus: OrgConfigStatus;
  googleSheetsConfig: GoogleSheetsConfig | null;
}

// Alias for backwards compatibility
export type Invite = OrganizationInvite;
