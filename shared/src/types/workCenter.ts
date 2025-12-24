import { WorkCenterType } from './enums';

/**
 * Time range for work center availability
 */
export interface TimeRange {
  start: string;  // HH:MM format (24-hour)
  end: string;    // HH:MM format (24-hour)
}

/**
 * Weekly schedule for a work center
 * Each day can have a time range or null (closed)
 */
export interface WeeklySchedule {
  monday: TimeRange | null;
  tuesday: TimeRange | null;
  wednesday: TimeRange | null;
  thursday: TimeRange | null;
  friday: TimeRange | null;
  saturday: TimeRange | null;
  sunday: TimeRange | null;
}

/**
 * Work Center data model
 */
export interface WorkCenter {
  id: string;                    // Unique identifier (e.g., "SL_50", "Q", "FABRICATION")
  name: string;                  // Display name (e.g., "SL 50", "Q", "Fabrication")
  type: WorkCenterType;
  active: boolean;
  efficiencyFactor: number;      // 0.0 - 1.0 (default 1.0)
  schedule: WeeklySchedule;
  
  // Sync metadata
  rowIndex: number;
}

/**
 * Work center creation input
 */
export interface CreateWorkCenterInput {
  id: string;
  name: string;
  type?: WorkCenterType;
  active?: boolean;
  efficiencyFactor?: number;
  schedule?: WeeklySchedule;
}

/**
 * Work center update input
 */
export interface UpdateWorkCenterInput {
  name?: string;
  type?: WorkCenterType;
  active?: boolean;
  efficiencyFactor?: number;
  schedule?: Partial<WeeklySchedule>;
}

/**
 * Default work center schedule (Mon-Fri 6AM-5PM)
 */
export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  monday: { start: '06:00', end: '17:00' },
  tuesday: { start: '06:00', end: '17:00' },
  wednesday: { start: '06:00', end: '17:00' },
  thursday: { start: '06:00', end: '17:00' },
  friday: { start: '06:00', end: '17:00' },
  saturday: null,
  sunday: null,
};

/**
 * Pre-defined work centers from requirements
 */
export const DEFAULT_WORK_CENTERS: Omit<WorkCenter, 'rowIndex'>[] = [
  { id: 'UNASSIGNED', name: 'UNASSIGNED', type: 'Other', active: true, efficiencyFactor: 1.0, schedule: DEFAULT_WEEKLY_SCHEDULE },
  { id: 'SL_50', name: 'SL 50', type: 'Machine', active: true, efficiencyFactor: 1.0, schedule: DEFAULT_WEEKLY_SCHEDULE },
  { id: 'SL_30', name: 'SL 30', type: 'Machine', active: true, efficiencyFactor: 1.0, schedule: DEFAULT_WEEKLY_SCHEDULE },
  { id: 'Q', name: 'Q', type: 'Machine', active: true, efficiencyFactor: 1.0, schedule: DEFAULT_WEEKLY_SCHEDULE },
  { id: 'Q2', name: 'Q2', type: 'Machine', active: true, efficiencyFactor: 1.0, schedule: DEFAULT_WEEKLY_SCHEDULE },
  { id: 'R', name: 'R', type: 'Machine', active: true, efficiencyFactor: 1.0, schedule: DEFAULT_WEEKLY_SCHEDULE },
  { id: 'A', name: 'A', type: 'Machine', active: true, efficiencyFactor: 1.0, schedule: DEFAULT_WEEKLY_SCHEDULE },
  { id: 'X', name: 'X', type: 'Machine', active: true, efficiencyFactor: 1.0, schedule: DEFAULT_WEEKLY_SCHEDULE },
  { id: 'SECT_1', name: 'SECT #1', type: 'Machine', active: true, efficiencyFactor: 1.0, schedule: DEFAULT_WEEKLY_SCHEDULE },
  { id: 'N', name: 'N', type: 'Machine', active: true, efficiencyFactor: 1.0, schedule: DEFAULT_WEEKLY_SCHEDULE },
  { id: 'H', name: 'H', type: 'Machine', active: true, efficiencyFactor: 1.0, schedule: DEFAULT_WEEKLY_SCHEDULE },
  { id: 'LONG_PRESS', name: 'Long press', type: 'Machine', active: true, efficiencyFactor: 1.0, schedule: DEFAULT_WEEKLY_SCHEDULE },
  { id: 'FABRICATION', name: 'Fabrication', type: 'Manual', active: true, efficiencyFactor: 1.0, schedule: DEFAULT_WEEKLY_SCHEDULE },
  { id: 'PVC', name: 'PVC', type: 'Machine', active: true, efficiencyFactor: 1.0, schedule: DEFAULT_WEEKLY_SCHEDULE },
  { id: 'PVC_VG', name: 'PVC VG', type: 'Machine', active: true, efficiencyFactor: 1.0, schedule: DEFAULT_WEEKLY_SCHEDULE },
  { id: 'PUNCH_PRESS', name: 'Punch press', type: 'Machine', active: true, efficiencyFactor: 1.0, schedule: DEFAULT_WEEKLY_SCHEDULE },
  { id: 'LOOSE_BW', name: 'Loose BW', type: 'Other', active: true, efficiencyFactor: 1.0, schedule: DEFAULT_WEEKLY_SCHEDULE },
  { id: 'READY', name: 'Ready', type: 'Other', active: true, efficiencyFactor: 1.0, schedule: DEFAULT_WEEKLY_SCHEDULE },
];
