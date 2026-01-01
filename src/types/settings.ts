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
