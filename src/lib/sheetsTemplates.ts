import type { SheetsTemplate, SheetConfig } from '@/types/settings';

// Re-export types for convenience
export type { SheetsTemplate, SheetConfig } from '@/types/settings';

// ============================================================================
// Production Scheduling Template
// ============================================================================

const PRODUCTS_SHEET: SheetConfig = {
  key: 'products',
  name: 'Products',
  description: 'Contains all products/jobs to be scheduled with their details and scheduling information.',
  columns: [
    { key: 'jobNumber', label: 'Job Number', required: true, description: 'Unique identifier for the job/product', dataType: 'string' },
    { key: 'customer', label: 'Customer', required: false, description: 'Customer name', dataType: 'string' },
    { key: 'productText', label: 'Product Text', required: false, description: 'Product description', dataType: 'string' },
    { key: 'quantity', label: 'Quantity', required: false, description: 'Total quantity ordered', dataType: 'number' },
    { key: 'length', label: 'Length', required: false, description: 'Product length', dataType: 'number' },
    { key: 'requestedShipDate', label: 'Requested Ship Date', required: true, description: 'Due date for the order - used to calculate On-Time/At-Risk/Late status', dataType: 'date' },
    { key: 'setupMinutes', label: 'Setup Time (min)', required: false, description: 'Setup time in minutes before production', dataType: 'number' },
    { key: 'uph', label: 'UPH', required: false, description: 'Units per hour - production rate', dataType: 'number' },
    { key: 'cut', label: 'Cut', required: false, description: 'Cut operation flag', dataType: 'boolean' },
    { key: 'extrusion', label: 'Extrusion', required: false, description: 'Extrusion operation flag', dataType: 'boolean' },
    { key: 'ground', label: 'Ground', required: false, description: 'Ground operation flag', dataType: 'boolean' },
    { key: 'drawing', label: 'Drawing', required: false, description: 'Drawing reference', dataType: 'string' },
    { key: 'ends', label: 'Ends', required: false, description: 'Ends type', dataType: 'string' },
    { key: 'workCenter', label: 'Work Center', required: true, description: 'Assigned work center ID - determines where the job is scheduled', dataType: 'string' },
    { key: 'balanceQuantity', label: 'Balance Quantity', required: false, description: 'Remaining quantity to produce', dataType: 'number' },
    { key: 'priority', label: 'Priority', required: true, description: 'Scheduling priority (lower number = higher priority)', dataType: 'number' },
    { key: 'priorityUpdatedAt', label: 'Priority Updated At', required: false, description: 'Timestamp when priority was last changed', dataType: 'date' },
    { key: 'scheduledStart', label: 'Scheduled Start', required: true, description: 'Calculated start time for the job', dataType: 'date' },
    { key: 'scheduledEnd', label: 'Scheduled End', required: true, description: 'Calculated end time for the job', dataType: 'date' },
    { key: 'scheduleStatus', label: 'Schedule Status', required: true, description: 'Status: On-Time, At-Risk, Late, or Unscheduled', dataType: 'string' },
    { key: 'scheduleLocked', label: 'Schedule Locked', required: false, description: 'Whether the schedule is locked from automatic changes', dataType: 'boolean' },
    { key: 'lockReason', label: 'Lock Reason', required: false, description: 'Reason for locking the schedule', dataType: 'string' },
    { key: 'rowHash', label: 'Row Hash', required: false, description: 'Internal hash for change detection', dataType: 'string' },
    { key: 'notes', label: 'Notes', required: false, description: 'Additional notes', dataType: 'string' },
    { key: 'customerPO', label: 'Customer PO', required: false, description: 'Customer purchase order number', dataType: 'string' },
    { key: 'materialStatus', label: 'Material Status', required: false, description: 'Material availability status', dataType: 'string' },
    { key: 'lotNumber', label: 'Lot Number', required: false, description: 'Lot/batch number', dataType: 'string' },
  ],
};

const WORK_CENTERS_SHEET: SheetConfig = {
  key: 'workCenters',
  name: 'Work Centers',
  description: 'Defines work centers with their operating hours and efficiency settings.',
  columns: [
    { key: 'id', label: 'ID', required: true, description: 'Unique identifier for the work center', dataType: 'string' },
    { key: 'name', label: 'Name', required: true, description: 'Display name', dataType: 'string' },
    { key: 'type', label: 'Type', required: false, description: 'Category (Cutting, Forming, Welding, etc.)', dataType: 'string' },
    { key: 'active', label: 'Active', required: true, description: 'Whether the work center is available for scheduling', dataType: 'boolean' },
    { key: 'efficiencyFactor', label: 'Efficiency Factor', required: false, description: 'Multiplier for production rate (1.0 = 100%)', dataType: 'number' },
    { key: 'monStart', label: 'Mon Start', required: false, description: 'Monday start time (HH:MM)', dataType: 'string' },
    { key: 'monEnd', label: 'Mon End', required: false, description: 'Monday end time', dataType: 'string' },
    { key: 'tueStart', label: 'Tue Start', required: false, description: 'Tuesday start time', dataType: 'string' },
    { key: 'tueEnd', label: 'Tue End', required: false, description: 'Tuesday end time', dataType: 'string' },
    { key: 'wedStart', label: 'Wed Start', required: false, description: 'Wednesday start time', dataType: 'string' },
    { key: 'wedEnd', label: 'Wed End', required: false, description: 'Wednesday end time', dataType: 'string' },
    { key: 'thuStart', label: 'Thu Start', required: false, description: 'Thursday start time', dataType: 'string' },
    { key: 'thuEnd', label: 'Thu End', required: false, description: 'Thursday end time', dataType: 'string' },
    { key: 'friStart', label: 'Fri Start', required: false, description: 'Friday start time', dataType: 'string' },
    { key: 'friEnd', label: 'Fri End', required: false, description: 'Friday end time', dataType: 'string' },
    { key: 'satStart', label: 'Sat Start', required: false, description: 'Saturday start time', dataType: 'string' },
    { key: 'satEnd', label: 'Sat End', required: false, description: 'Saturday end time', dataType: 'string' },
    { key: 'sunStart', label: 'Sun Start', required: false, description: 'Sunday start time', dataType: 'string' },
    { key: 'sunEnd', label: 'Sun End', required: false, description: 'Sunday end time', dataType: 'string' },
  ],
};

const HOLIDAYS_SHEET: SheetConfig = {
  key: 'holidays',
  name: 'Holidays',
  description: 'Defines company holidays when work centers are closed.',
  columns: [
    { key: 'date', label: 'Date', required: true, description: 'Holiday date (YYYY-MM-DD)', dataType: 'date' },
    { key: 'name', label: 'Name', required: true, description: 'Holiday name', dataType: 'string' },
    { key: 'affectedWorkCenters', label: 'Affected Work Centers', required: false, description: 'Comma-separated list or "ALL"', dataType: 'string' },
  ],
};

const SETTINGS_SHEET: SheetConfig = {
  key: 'settings',
  name: 'Settings',
  description: 'Application settings stored in the spreadsheet.',
  columns: [
    { key: 'setting', label: 'Setting', required: true, description: 'Setting name', dataType: 'string' },
    { key: 'value', label: 'Value', required: true, description: 'Setting value', dataType: 'string' },
  ],
};

export const PRODUCTION_SCHEDULING_TEMPLATE: SheetsTemplate = {
  id: 'production-scheduling',
  name: 'Production Scheduling',
  description: 'Schedule manufacturing jobs across work centers with automatic priority management, Gantt chart visualization, and deadline tracking.',
  version: '1.0.0',
  sheets: [PRODUCTS_SHEET, WORK_CENTERS_SHEET, HOLIDAYS_SHEET, SETTINGS_SHEET],
};

// ============================================================================
// Template Registry
// ============================================================================

export const SHEETS_TEMPLATES: SheetsTemplate[] = [PRODUCTION_SCHEDULING_TEMPLATE];

export function getTemplateById(id: string): SheetsTemplate | undefined {
  return SHEETS_TEMPLATES.find((t) => t.id === id);
}

export function getDefaultTemplate(): SheetsTemplate {
  return PRODUCTION_SCHEDULING_TEMPLATE;
}

// ============================================================================
// Helper Functions
// ============================================================================

export function getRequiredColumns(template: SheetsTemplate, sheetKey: string): string[] {
  const sheet = template.sheets.find((s) => s.key === sheetKey);
  if (!sheet) return [];
  return sheet.columns.filter((c) => c.required).map((c) => c.label);
}

export function getOptionalColumns(template: SheetsTemplate, sheetKey: string): string[] {
  const sheet = template.sheets.find((s) => s.key === sheetKey);
  if (!sheet) return [];
  return sheet.columns.filter((c) => !c.required).map((c) => c.label);
}

export function getAllColumnLabels(template: SheetsTemplate, sheetKey: string): string[] {
  const sheet = template.sheets.find((s) => s.key === sheetKey);
  if (!sheet) return [];
  return sheet.columns.map((c) => c.label);
}

export function getSheetNames(template: SheetsTemplate): string[] {
  return template.sheets.map((s) => s.name);
}

// ============================================================================
// Default Work Centers Data
// ============================================================================

export const DEFAULT_WORK_CENTERS = [
  ['STRAIGHT', 'Straight Cutting', 'Cutting', 'TRUE', 1.0, '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '', '', '', ''],
  ['ANGLED', 'Angled Cutting', 'Cutting', 'TRUE', 1.0, '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '', '', '', ''],
  ['FLANGE', 'Flange Forming', 'Forming', 'TRUE', 1.0, '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '', '', '', ''],
  ['SWAGE', 'Swaging', 'Forming', 'TRUE', 1.0, '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '', '', '', ''],
  ['WELD_MIG', 'MIG Welding', 'Welding', 'TRUE', 1.0, '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '', '', '', ''],
  ['WELD_TIG', 'TIG Welding', 'Welding', 'TRUE', 1.0, '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '', '', '', ''],
  ['WELD_SPOT', 'Spot Welding', 'Welding', 'TRUE', 1.0, '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '', '', '', ''],
  ['BEND', 'Bending', 'Forming', 'TRUE', 1.0, '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '', '', '', ''],
  ['DRILL', 'Drilling', 'Machining', 'TRUE', 1.0, '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '', '', '', ''],
  ['LATHE', 'Lathe', 'Machining', 'TRUE', 1.0, '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '', '', '', ''],
  ['MILL', 'Milling', 'Machining', 'TRUE', 1.0, '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '', '', '', ''],
  ['GRIND', 'Grinding', 'Finishing', 'TRUE', 1.0, '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '', '', '', ''],
  ['POLISH', 'Polishing', 'Finishing', 'TRUE', 1.0, '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '', '', '', ''],
  ['PAINT', 'Painting', 'Finishing', 'TRUE', 1.0, '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '', '', '', ''],
  ['POWDER', 'Powder Coating', 'Finishing', 'TRUE', 1.0, '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '', '', '', ''],
  ['ASSEMBLE', 'Assembly', 'Assembly', 'TRUE', 1.0, '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '', '', '', ''],
  ['INSPECT', 'Quality Inspection', 'QC', 'TRUE', 1.0, '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '', '', '', ''],
  ['PACK', 'Packaging', 'Shipping', 'TRUE', 1.0, '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '07:00', '15:30', '', '', '', ''],
];

// ============================================================================
// Default Holidays (Updated for 2026)
// ============================================================================

export const DEFAULT_HOLIDAYS = [
  ['2026-01-01', "New Year's Day", 'ALL'],
  ['2026-01-19', 'MLK Day', 'ALL'],
  ['2026-02-16', "Presidents' Day", 'ALL'],
  ['2026-05-25', 'Memorial Day', 'ALL'],
  ['2026-07-03', 'Independence Day (Observed)', 'ALL'],
  ['2026-09-07', 'Labor Day', 'ALL'],
  ['2026-11-26', 'Thanksgiving', 'ALL'],
  ['2026-11-27', 'Day After Thanksgiving', 'ALL'],
  ['2026-12-24', 'Christmas Eve', 'ALL'],
  ['2026-12-25', 'Christmas Day', 'ALL'],
  ['2026-12-31', "New Year's Eve", 'ALL'],
];
