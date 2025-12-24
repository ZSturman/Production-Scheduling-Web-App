/**
 * Manufacturing Scheduler - Google Apps Script
 * 
 * This script provides:
 * 1. Installable onEdit trigger for priority cascade
 * 2. In-sheet Gantt view on "Schedule View" sheet
 * 3. Custom menu for manual operations
 * 4. Time-driven refresh trigger
 */

// Configuration
const CONFIG = {
  PRODUCTS_SHEET: 'Products',
  WORK_CENTERS_SHEET: 'Work Centers',
  SCHEDULE_VIEW_SHEET: 'Schedule View',
  SETTINGS_SHEET: 'Settings',
  HOLIDAYS_SHEET: 'Holidays',
  API_URL: '', // Set this to your Cloud Run API URL
};

// Column indices for Products sheet (0-based)
const PRODUCT_COLS = {
  JOB_NUMBER: 0,
  CUSTOMER: 1,
  PRODUCT_TEXT: 2,
  BALANCE_QTY: 3,
  REQUESTED_SHIP_DATE: 4,
  WORK_CENTER: 5,
  PRIORITY: 6,
  UPH: 7,
  SETUP_TIME: 8,
  ENDS_TYPE: 9,
  SCHEDULED_START: 10,
  SCHEDULED_END: 11,
  SCHEDULE_STATUS: 12,
  SCHEDULE_LOCKED: 13,
  LOCK_REASON: 14,
  PRIORITY_UPDATED_AT: 15,
  NOTES: 16,
};

/**
 * Creates custom menu on spreadsheet open
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📅 Scheduler')
    .addItem('🔄 Refresh Schedule View', 'refreshScheduleView')
    .addItem('📊 Recalculate All Schedules', 'recalculateSchedules')
    .addSeparator()
    .addItem('🔧 Setup Triggers', 'setupTriggers')
    .addItem('❓ Help', 'showHelp')
    .addToUi();
}

/**
 * Shows help dialog
 */
function showHelp() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'Manufacturing Scheduler Help',
    'This spreadsheet is connected to the Manufacturing Scheduler web app.\n\n' +
    '• Priority: Lower number = higher priority. Changing priority auto-cascades.\n' +
    '• Schedule Locked: Set to TRUE to prevent automatic recalculation.\n' +
    '• Schedule View: Visual Gantt chart updated every 5 minutes or manually.\n' +
    '• Work Centers: Define capacity and working hours.\n\n' +
    'For full features, use the web app.',
    ui.ButtonSet.OK
  );
}

/**
 * Sets up installable triggers
 */
function setupTriggers() {
  // Remove existing triggers first
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onEditInstallable' || 
        trigger.getHandlerFunction() === 'refreshScheduleViewTrigger') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create onEdit trigger
  ScriptApp.newTrigger('onEditInstallable')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  
  // Create time-driven trigger (every 5 minutes)
  ScriptApp.newTrigger('refreshScheduleViewTrigger')
    .timeBased()
    .everyMinutes(5)
    .create();
  
  SpreadsheetApp.getUi().alert('Triggers set up successfully!');
}

/**
 * Installable onEdit trigger - handles priority cascade
 */
function onEditInstallable(e) {
  if (!e || !e.range) return;
  
  const sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.PRODUCTS_SHEET) return;
  
  const row = e.range.getRow();
  const col = e.range.getColumn();
  
  // Skip header row
  if (row === 1) return;
  
  // Check if priority column was edited (column index is 1-based in getColumn())
  if (col === PRODUCT_COLS.PRIORITY + 1) {
    handlePriorityChange(sheet, row, e.oldValue, e.value);
  }
  
  // Check if work center was changed
  if (col === PRODUCT_COLS.WORK_CENTER + 1) {
    handleWorkCenterChange(sheet, row, e.oldValue, e.value);
  }
}

/**
 * Handles priority change with cascade logic
 * "Most recent update wins" - shifts other priorities
 */
function handlePriorityChange(sheet, row, oldPriority, newPriority) {
  const lock = LockService.getScriptLock();
  try {
    // Try to get lock, wait up to 10 seconds
    lock.waitLock(10000);
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // Get the work center for this job
    const workCenter = rows[row - 2][PRODUCT_COLS.WORK_CENTER];
    const jobNumber = rows[row - 2][PRODUCT_COLS.JOB_NUMBER];
    
    // Filter jobs in the same work center (excluding the changed job)
    const wcJobs = rows
      .map((r, i) => ({ row: i + 2, ...rowToJob(r) }))
      .filter(j => j.workCenter === workCenter && j.jobNumber !== jobNumber);
    
    // Sort by priority
    wcJobs.sort((a, b) => (a.priority || 999) - (b.priority || 999));
    
    const newPriorityNum = parseInt(newPriority) || 1;
    
    // Shift priorities
    let currentPriority = 1;
    const updates = [];
    
    wcJobs.forEach(job => {
      if (currentPriority === newPriorityNum) {
        currentPriority++; // Skip the position taken by edited job
      }
      
      if (job.priority !== currentPriority) {
        updates.push({ row: job.row, priority: currentPriority });
      }
      currentPriority++;
    });
    
    // Apply updates
    updates.forEach(update => {
      sheet.getRange(update.row, PRODUCT_COLS.PRIORITY + 1).setValue(update.priority);
    });
    
    // Update timestamp for the changed job
    sheet.getRange(row, PRODUCT_COLS.PRIORITY_UPDATED_AT + 1)
      .setValue(new Date().toISOString());
    
  } catch (e) {
    console.error('Priority cascade error:', e);
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Error updating priorities. Please try again.',
      'Error',
      5
    );
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handles work center change - assigns priority at end of new WC queue
 */
function handleWorkCenterChange(sheet, row, oldWorkCenter, newWorkCenter) {
  if (!newWorkCenter || oldWorkCenter === newWorkCenter) return;
  
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);
  
  // Find max priority in new work center
  let maxPriority = 0;
  rows.forEach(r => {
    if (r[PRODUCT_COLS.WORK_CENTER] === newWorkCenter) {
      const priority = parseInt(r[PRODUCT_COLS.PRIORITY]) || 0;
      if (priority > maxPriority) maxPriority = priority;
    }
  });
  
  // Assign next priority
  sheet.getRange(row, PRODUCT_COLS.PRIORITY + 1).setValue(maxPriority + 1);
  sheet.getRange(row, PRODUCT_COLS.PRIORITY_UPDATED_AT + 1)
    .setValue(new Date().toISOString());
  
  // Compact priorities in old work center
  compactPriorities(sheet, oldWorkCenter);
}

/**
 * Compacts priorities in a work center to be sequential
 */
function compactPriorities(sheet, workCenter) {
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);
  
  // Get all jobs in this work center with their row numbers
  const wcJobs = rows
    .map((r, i) => ({ row: i + 2, priority: r[PRODUCT_COLS.PRIORITY], wc: r[PRODUCT_COLS.WORK_CENTER] }))
    .filter(j => j.wc === workCenter)
    .sort((a, b) => (a.priority || 999) - (b.priority || 999));
  
  // Reassign sequential priorities
  wcJobs.forEach((job, index) => {
    const newPriority = index + 1;
    if (job.priority !== newPriority) {
      sheet.getRange(job.row, PRODUCT_COLS.PRIORITY + 1).setValue(newPriority);
    }
  });
}

/**
 * Helper to convert row array to job object
 */
function rowToJob(row) {
  return {
    jobNumber: row[PRODUCT_COLS.JOB_NUMBER],
    customer: row[PRODUCT_COLS.CUSTOMER],
    productText: row[PRODUCT_COLS.PRODUCT_TEXT],
    balanceQuantity: row[PRODUCT_COLS.BALANCE_QTY],
    requestedShipDate: row[PRODUCT_COLS.REQUESTED_SHIP_DATE],
    workCenter: row[PRODUCT_COLS.WORK_CENTER],
    priority: row[PRODUCT_COLS.PRIORITY],
    scheduledStart: row[PRODUCT_COLS.SCHEDULED_START],
    scheduledEnd: row[PRODUCT_COLS.SCHEDULED_END],
    scheduleStatus: row[PRODUCT_COLS.SCHEDULE_STATUS],
    scheduleLocked: row[PRODUCT_COLS.SCHEDULE_LOCKED],
  };
}

/**
 * Time-driven trigger wrapper
 */
function refreshScheduleViewTrigger() {
  try {
    refreshScheduleView();
  } catch (e) {
    console.error('Auto-refresh error:', e);
  }
}

/**
 * Refreshes the Schedule View sheet with Gantt-style visualization
 */
function refreshScheduleView() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Get or create Schedule View sheet
  let scheduleSheet = ss.getSheetByName(CONFIG.SCHEDULE_VIEW_SHEET);
  if (!scheduleSheet) {
    scheduleSheet = ss.insertSheet(CONFIG.SCHEDULE_VIEW_SHEET);
  }
  
  // Clear existing content
  scheduleSheet.clear();
  
  // Get products data
  const productsSheet = ss.getSheetByName(CONFIG.PRODUCTS_SHEET);
  if (!productsSheet) {
    scheduleSheet.getRange('A1').setValue('Products sheet not found');
    return;
  }
  
  const data = productsSheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  // Convert to jobs and filter scheduled ones
  const jobs = rows
    .map(rowToJob)
    .filter(j => j.scheduledStart && j.scheduledEnd);
  
  if (jobs.length === 0) {
    scheduleSheet.getRange('A1').setValue('No scheduled jobs found');
    return;
  }
  
  // Group by work center
  const wcGroups = {};
  jobs.forEach(job => {
    if (!wcGroups[job.workCenter]) {
      wcGroups[job.workCenter] = [];
    }
    wcGroups[job.workCenter].push(job);
  });
  
  // Sort jobs within each work center by priority
  Object.values(wcGroups).forEach(group => {
    group.sort((a, b) => (a.priority || 999) - (b.priority || 999));
  });
  
  // Calculate date range
  let minDate = new Date();
  let maxDate = new Date();
  jobs.forEach(job => {
    const start = new Date(job.scheduledStart);
    const end = new Date(job.scheduledEnd);
    if (start < minDate) minDate = start;
    if (end > maxDate) maxDate = end;
  });
  
  // Extend range a bit
  minDate = new Date(minDate);
  minDate.setDate(minDate.getDate() - 1);
  maxDate = new Date(maxDate);
  maxDate.setDate(maxDate.getDate() + 7);
  
  // Generate date columns
  const dates = [];
  const currentDate = new Date(minDate);
  while (currentDate <= maxDate && dates.length < 60) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Build header row
  const headerRow = ['Work Center', 'Job', 'Customer', 'Priority', 'Status'];
  dates.forEach(d => {
    headerRow.push(Utilities.formatDate(d, 'GMT', 'MM/dd'));
  });
  
  // Build data rows
  const outputRows = [headerRow];
  
  Object.entries(wcGroups).sort().forEach(([wc, wcJobs]) => {
    wcJobs.forEach(job => {
      const row = [
        wc,
        job.jobNumber,
        job.customer,
        job.priority,
        job.scheduleStatus || 'Unknown',
      ];
      
      const jobStart = new Date(job.scheduledStart);
      const jobEnd = new Date(job.scheduledEnd);
      
      dates.forEach(d => {
        const dayStart = new Date(d);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d);
        dayEnd.setHours(23, 59, 59, 999);
        
        // Check if job overlaps this day
        if (jobStart <= dayEnd && jobEnd >= dayStart) {
          row.push('█');
        } else {
          row.push('');
        }
      });
      
      outputRows.push(row);
    });
  });
  
  // Write to sheet
  scheduleSheet.getRange(1, 1, outputRows.length, outputRows[0].length)
    .setValues(outputRows);
  
  // Format header
  scheduleSheet.getRange(1, 1, 1, outputRows[0].length)
    .setBackground('#4285f4')
    .setFontColor('white')
    .setFontWeight('bold');
  
  // Format status column with conditional coloring
  const statusRange = scheduleSheet.getRange(2, 5, outputRows.length - 1, 1);
  const statusValues = statusRange.getValues();
  
  for (let i = 0; i < statusValues.length; i++) {
    const status = statusValues[i][0];
    const cell = scheduleSheet.getRange(i + 2, 5);
    
    if (status === 'On-Time') {
      cell.setBackground('#d4edda').setFontColor('#155724');
    } else if (status === 'At-Risk') {
      cell.setBackground('#fff3cd').setFontColor('#856404');
    } else if (status === 'Late') {
      cell.setBackground('#f8d7da').setFontColor('#721c24');
    }
  }
  
  // Color the Gantt bars based on status
  for (let i = 1; i < outputRows.length; i++) {
    const status = outputRows[i][4];
    let barColor = '#9e9e9e'; // default gray
    
    if (status === 'On-Time') barColor = '#4caf50';
    else if (status === 'At-Risk') barColor = '#ff9800';
    else if (status === 'Late') barColor = '#f44336';
    
    for (let j = 5; j < outputRows[i].length; j++) {
      if (outputRows[i][j] === '█') {
        scheduleSheet.getRange(i + 1, j + 1).setFontColor(barColor);
      }
    }
  }
  
  // Freeze header and job info columns
  scheduleSheet.setFrozenRows(1);
  scheduleSheet.setFrozenColumns(5);
  
  // Resize columns
  scheduleSheet.setColumnWidth(1, 120); // Work Center
  scheduleSheet.setColumnWidth(2, 100); // Job
  scheduleSheet.setColumnWidth(3, 150); // Customer
  scheduleSheet.setColumnWidth(4, 60);  // Priority
  scheduleSheet.setColumnWidth(5, 80);  // Status
  for (let i = 6; i <= outputRows[0].length; i++) {
    scheduleSheet.setColumnWidth(i, 35); // Date columns
  }
  
  // Add last updated timestamp
  const lastRow = outputRows.length + 2;
  scheduleSheet.getRange(lastRow, 1)
    .setValue('Last updated: ' + new Date().toLocaleString())
    .setFontColor('#999999')
    .setFontStyle('italic');
  
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Schedule View updated with ' + jobs.length + ' jobs',
    'Refresh Complete',
    3
  );
}

/**
 * Recalculates all schedules by calling the API
 * (Requires API_URL to be set)
 */
function recalculateSchedules() {
  if (!CONFIG.API_URL) {
    SpreadsheetApp.getUi().alert(
      'API URL not configured. Please set CONFIG.API_URL in the script.'
    );
    return;
  }
  
  try {
    const response = UrlFetchApp.fetch(CONFIG.API_URL + '/api/schedule/recalculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      muteHttpExceptions: true,
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.success) {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        `Recalculated ${result.data.totalProcessed} jobs (${result.data.lockedCount} locked)`,
        'Recalculation Complete',
        5
      );
      
      // Refresh the sheet data
      Utilities.sleep(2000);
      refreshScheduleView();
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (e) {
    SpreadsheetApp.getUi().alert('Recalculation failed: ' + e.message);
  }
}
