/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

/**
 * API error details
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Response metadata
 */
export interface ResponseMeta {
  timestamp: string;
  requestId?: string;
  pagination?: PaginationMeta;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Sync status response
 */
export interface SyncStatusResponse {
  lastSyncTimestamp: string | null;
  syncInProgress: boolean;
  pendingChanges: number;
  errors: string[];
}

/**
 * Schedule recalculation response
 */
export interface RecalculateResponse {
  success: boolean;
  timestamp: string;
  jobsScheduled: number;
  lockedJobsAffected: number;    // For UI notification
  onTimeCount: number;
  atRiskCount: number;
  lateCount: number;
  errors: string[];
}

/**
 * Batch priority update request
 */
export interface BatchPriorityUpdateRequest {
  workCenter: string;
  priorities: {
    jobNumber: string;
    priority: number;
  }[];
}

/**
 * Priority cascade result
 */
export interface PriorityCascadeResult {
  success: boolean;
  updatedJobs: {
    jobNumber: string;
    oldPriority: number;
    newPriority: number;
  }[];
  triggerRecalculation: boolean;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  services: {
    googleSheets: 'connected' | 'disconnected' | 'error';
    firebase: 'connected' | 'disconnected' | 'error';
  };
}
