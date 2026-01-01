/**
 * Ends type options for products
 */
export type EndsType = '_' | 'Open' | 'Lace' | 'End' | 'Long';

/**
 * Schedule status based on comparison of Scheduled End vs Requested Ship Date
 */
export type ScheduleStatus = 'On-Time' | 'At-Risk' | 'Late' | 'Unscheduled';

/**
 * Work center type classification
 */
export type WorkCenterType = 'Machine' | 'Manual' | 'Assembly' | 'Other';

/**
 * User roles for access control
 */
export type UserRole = 'viewer' | 'planner' | 'admin';

/**
 * Audit log action types
 */
export type AuditAction = 
  | 'PRIORITY_CHANGE'
  | 'WORK_CENTER_CHANGE'
  | 'SCHEDULE_RECALCULATED'
  | 'SCHEDULE_LOCKED'
  | 'SCHEDULE_UNLOCKED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'WORK_CENTER_CREATED'
  | 'WORK_CENTER_UPDATED'
  | 'SETTINGS_UPDATED'
  | 'SYNC_TRIGGERED';
