export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMeta {
  timestamp: string;
  requestId?: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface SyncStatusResponse {
  lastSyncTimestamp: string | null;
  syncInProgress: boolean;
  pendingChanges: number;
  errors: string[];
}

export interface RecalculateResponse {
  success: boolean;
  timestamp: string;
  jobsScheduled: number;
  lockedJobsAffected: number;
  onTimeCount: number;
  atRiskCount: number;
  lateCount: number;
  errors: string[];
}

export interface BatchPriorityUpdateRequest {
  workCenter: string;
  priorities: {
    jobNumber: string;
    priority: number;
  }[];
}

export interface PriorityCascadeResult {
  success: boolean;
  updatedJobs: {
    jobNumber: string;
    oldPriority: number;
    newPriority: number;
  }[];
  triggerRecalculation: boolean;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  services: {
    googleSheets: 'connected' | 'disconnected' | 'error';
    firebase: 'connected' | 'disconnected' | 'error';
  };
}
