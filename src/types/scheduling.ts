import { ScheduleStatus } from './enums';

export interface ScheduleSegment {
  date: string;
  startHour: number;
  endHour: number;
  hoursScheduled: number;
}

export interface CalculatedSchedule {
  jobNumber: string;
  workCenter: string;
  priority: number;
  balanceQuantity: number;
  uph: number;
  setupHours: number;
  productionHours: number;
  totalHours: number;
  scheduledStart: string;
  scheduledEnd: string;
  segments: ScheduleSegment[];
  requestedShipDate: string;
  scheduleStatus: ScheduleStatus;
  daysUntilDue: number;
  wasSkipped: boolean;
  lockReason: string | null;
}

export interface WorkCenterScheduleResult {
  workCenterId: string;
  workCenterName: string;
  totalJobs: number;
  scheduledJobs: number;
  lockedJobs: number;
  skippedLockedJobs: number;
  schedules: CalculatedSchedule[];
  lastJobEnd: string | null;
}

export interface SchedulingResult {
  success: boolean;
  timestamp: string;
  workCenterResults: WorkCenterScheduleResult[];
  totalJobs: number;
  scheduledJobs: number;
  lockedJobsAffected: number;
  onTimeCount: number;
  atRiskCount: number;
  lateCount: number;
  errors: SchedulingError[];
}

export interface SchedulingError {
  jobNumber: string;
  workCenter: string;
  message: string;
  code: 'INVALID_UPH' | 'INVALID_QUANTITY' | 'NO_WORK_CENTER' | 'UNKNOWN';
}

export interface GanttTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  workCenter: string;
  workCenterName: string;
  priority: number;
  status: ScheduleStatus;
  dueDate: string;
  isLocked: boolean;
  lockReason: string | null;
  customer: string;
  productText: string;
  quantity: number;
  balanceQuantity: number;
  totalHours: number;
}

export interface GanttData {
  workCenters: {
    id: string;
    name: string;
    tasks: GanttTask[];
  }[];
  startDate: string;
  endDate: string;
  totalTasks: number;
  lockedTasksAffected: number;
}

export interface GanttFilters {
  workCenters?: string[];
  startDate?: string;
  endDate?: string;
  showLocked?: boolean;
  status?: ScheduleStatus[];
}
