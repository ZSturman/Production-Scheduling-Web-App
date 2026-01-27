export interface AppSettings {
  atRiskBufferDays: number;
  syncIntervalSeconds: number;
  ganttRefreshMinutes: number;
  defaultPriorityPosition: 'end' | 'start';
  minGanttDisplayHours: number;
}

export interface UpdateSettingsInput {
  atRiskBufferDays?: number;
  syncIntervalSeconds?: number;
  ganttRefreshMinutes?: number;
  defaultPriorityPosition?: 'end' | 'start';
  minGanttDisplayHours?: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  atRiskBufferDays: 2,
  syncIntervalSeconds: 60,
  ganttRefreshMinutes: 5,
  defaultPriorityPosition: 'end',
  minGanttDisplayHours: 1,
};

export const SETTINGS_KEYS: Record<keyof AppSettings, string> = {
  atRiskBufferDays: 'atRiskBufferDays',
  syncIntervalSeconds: 'syncIntervalSeconds',
  ganttRefreshMinutes: 'ganttRefreshMinutes',
  defaultPriorityPosition: 'defaultPriorityPosition',
  minGanttDisplayHours: 'minGanttDisplayHours',
};

// ============================================================================
// Sheet Health & Configuration Types
// ============================================================================

export type SheetIssueCode =
  | 'SHEET_NOT_FOUND'
  | 'HEADER_MISMATCH'
  | 'MISSING_REQUIRED_HEADER'
  | 'INVALID_DATA_TYPE'
  | 'API_DISABLED'
  | 'PERMISSION_DENIED'
  | 'SPREADSHEET_NOT_FOUND'
  | 'INVALID_CREDENTIALS'
  | 'RATE_LIMITED'
  | 'UNKNOWN_ERROR';

export type SheetIssueSeverity = 'error' | 'warning' | 'info';

export interface SheetIssue {
  code: SheetIssueCode;
  severity: SheetIssueSeverity;
  sheetName?: string;
  columnName?: string;
  message: string;
  userAction: string;
  adminRequired: boolean;
  details?: Record<string, unknown>;
}

export type SheetsHealthStatus = 'healthy' | 'degraded' | 'error' | 'unconfigured';

export interface SheetsHealth {
  status: SheetsHealthStatus;
  issues: SheetIssue[];
  lastChecked: string;
  sheets: {
    name: string;
    exists: boolean;
    hasRequiredHeaders: boolean;
    missingHeaders: string[];
    extraHeaders: string[];
  }[];
}

// ============================================================================
// Sheets Configuration / Template Types
// ============================================================================

export interface SheetColumnConfig {
  key: string;
  label: string;
  customLabel?: string;
  required: boolean;
  description: string;
  dataType: 'string' | 'number' | 'boolean' | 'date';
}

export interface SheetConfig {
  key: string;
  name: string;
  customName?: string;
  description: string;
  columns: SheetColumnConfig[];
}

export interface SheetsTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  sheets: SheetConfig[];
}

export interface OrganizationSheetsConfig {
  templateId: string;
  templateVersion: string;
  sheets: {
    key: string;
    name: string;
    columns: {
      key: string;
      label: string;
      enabled: boolean;
    }[];
  }[];
  configuredAt: string;
  configuredBy: string;
}

export interface SheetsConfigHistory {
  config: OrganizationSheetsConfig;
  changedAt: string;
  changedBy: string;
  changeReason?: string;
}
