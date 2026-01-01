import { AuditAction, UserRole } from './enums';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: AuditAction;
  jobNumber: string | null;
  workCenterId: string | null;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  details: string | null;
  rowIndex: number;
}

export interface CreateAuditLogInput {
  userId: string;
  userEmail: string;
  action: AuditAction;
  jobNumber?: string;
  workCenterId?: string;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  details?: string;
}

export interface AuditLogFilters {
  startDate?: string;
  endDate?: string;
  action?: AuditAction;
  userId?: string;
  jobNumber?: string;
  workCenterId?: string;
}

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
}

export interface AuthContext {
  user: AuthUser;
  token: string;
}
