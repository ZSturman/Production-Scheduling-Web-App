import { AuditAction, UserRole } from './enums';

/**
 * Audit log entry for tracking changes
 */
export interface AuditLogEntry {
  id: string;                    // Unique ID
  timestamp: string;             // ISO timestamp
  userId: string;                // Firebase user ID
  userEmail: string;             // User email for display
  action: AuditAction;
  jobNumber: string | null;      // Affected job (if applicable)
  workCenterId: string | null;   // Affected work center (if applicable)
  field: string | null;          // Changed field name
  oldValue: string | null;       // Previous value (stringified)
  newValue: string | null;       // New value (stringified)
  details: string | null;        // Additional context
  rowIndex: number;              // 1-based row in audit sheet
}

/**
 * Create audit log entry input
 */
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

/**
 * Audit log filter options
 */
export interface AuditLogFilters {
  startDate?: string;            // Filter entries after this date
  endDate?: string;              // Filter entries before this date
  action?: AuditAction;
  userId?: string;
  jobNumber?: string;
  workCenterId?: string;
}

/**
 * User information from Firebase Auth
 */
export interface User {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
}

/**
 * Auth context for requests
 */
export interface AuthContext {
  user: User;
  token: string;
}
