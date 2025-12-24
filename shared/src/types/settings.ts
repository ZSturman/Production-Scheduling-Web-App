/**
 * Application settings stored in the Settings sheet
 */
export interface AppSettings {
  /**
   * Number of days before due date to mark job as "At-Risk"
   * Default: 2
   */
  atRiskBufferDays: number;
  
  /**
   * Sync interval in seconds for polling updates from Google Sheets
   * Default: 60
   */
  syncIntervalSeconds: number;
  
  /**
   * Gantt refresh interval in minutes (for Apps Script time trigger)
   * Default: 5
   */
  ganttRefreshMinutes: number;
  
  /**
   * Default priority position for new products
   * 'end' = append to end of work center queue
   * 'start' = insert at beginning (shifts others down)
   */
  defaultPriorityPosition: 'end' | 'start';
  
  /**
   * Minimum hours to display on Gantt (for very short jobs)
   * Default: 1
   */
  minGanttDisplayHours: number;
}

/**
 * Settings update input (all optional)
 */
export interface UpdateSettingsInput {
  atRiskBufferDays?: number;
  syncIntervalSeconds?: number;
  ganttRefreshMinutes?: number;
  defaultPriorityPosition?: 'end' | 'start';
  minGanttDisplayHours?: number;
}

/**
 * Default application settings
 */
export const DEFAULT_SETTINGS: AppSettings = {
  atRiskBufferDays: 2,
  syncIntervalSeconds: 60,
  ganttRefreshMinutes: 5,
  defaultPriorityPosition: 'end',
  minGanttDisplayHours: 1,
};

/**
 * Settings key names as used in the Settings sheet
 */
export const SETTINGS_KEYS: Record<keyof AppSettings, string> = {
  atRiskBufferDays: 'atRiskBufferDays',
  syncIntervalSeconds: 'syncIntervalSeconds',
  ganttRefreshMinutes: 'ganttRefreshMinutes',
  defaultPriorityPosition: 'defaultPriorityPosition',
  minGanttDisplayHours: 'minGanttDisplayHours',
};
