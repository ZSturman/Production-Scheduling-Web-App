import { Product } from './product';
import { ScheduleStatus } from './enums';

/**
 * Scheduled time segment for a job
 * Used when a job spans multiple days
 */
export interface ScheduleSegment {
  date: string;                  // ISO date (YYYY-MM-DD)
  startHour: number;             // Start hour (0-23)
  endHour: number;               // End hour (0-23)
  hoursScheduled: number;        // Hours in this segment
}

/**
 * Calculated schedule for a single product
 */
export interface CalculatedSchedule {
  jobNumber: string;
  workCenter: string;
  priority: number;
  
  // Production time calculation
  balanceQuantity: number;
  uph: number;
  setupHours: number;            // Setup minutes converted to hours
  productionHours: number;       // Balance Quantity / UPH
  totalHours: number;            // Setup + Production hours
  
  // Scheduled times
  scheduledStart: string;        // ISO datetime
  scheduledEnd: string;          // ISO datetime
  segments: ScheduleSegment[];   // Breakdown by day
  
  // Status
  requestedShipDate: string;
  scheduleStatus: ScheduleStatus;
  daysUntilDue: number;          // Negative = overdue
  
  // Lock status
  wasSkipped: boolean;           // True if job was locked and skipped
  lockReason: string | null;
}

/**
 * Scheduling result for a work center
 */
export interface WorkCenterScheduleResult {
  workCenterId: string;
  workCenterName: string;
  totalJobs: number;
  scheduledJobs: number;
  lockedJobs: number;
  skippedLockedJobs: number;     // Locked jobs that would have changed
  schedules: CalculatedSchedule[];
  lastJobEnd: string | null;     // When this work center finishes
}

/**
 * Full scheduling run result
 */
export interface SchedulingResult {
  success: boolean;
  timestamp: string;
  workCenterResults: WorkCenterScheduleResult[];
  
  // Summary stats
  totalJobs: number;
  scheduledJobs: number;
  lockedJobsAffected: number;    // For notification toast
  onTimeCount: number;
  atRiskCount: number;
  lateCount: number;
  
  // Errors
  errors: SchedulingError[];
}

/**
 * Scheduling error for a specific job
 */
export interface SchedulingError {
  jobNumber: string;
  workCenter: string;
  message: string;
  code: 'INVALID_UPH' | 'INVALID_QUANTITY' | 'NO_WORK_CENTER' | 'UNKNOWN';
}

/**
 * Gantt chart data format
 */
export interface GanttTask {
  id: string;                    // Job number
  name: string;                  // Display name (customer - product)
  start: string;                 // ISO date for Gantt start
  end: string;                   // ISO date for Gantt end
  progress: number;              // 0-100 (based on balance vs quantity)
  workCenter: string;
  workCenterName: string;
  priority: number;
  status: ScheduleStatus;
  dueDate: string;
  isLocked: boolean;
  lockReason: string | null;
  
  // For tooltip/details
  customer: string;
  productText: string;
  quantity: number;
  balanceQuantity: number;
  totalHours: number;
}

/**
 * Gantt chart data grouped by work center
 */
export interface GanttData {
  workCenters: {
    id: string;
    name: string;
    tasks: GanttTask[];
  }[];
  
  // Date range for the view
  startDate: string;
  endDate: string;
  
  // Summary
  totalTasks: number;
  lockedTasksAffected: number;
}

/**
 * Gantt filter options
 */
export interface GanttFilters {
  workCenters?: string[];        // Filter by work center IDs
  startDate?: string;            // View start date
  endDate?: string;              // View end date
  showLocked?: boolean;          // Include locked jobs
  status?: ScheduleStatus[];     // Filter by status
}
