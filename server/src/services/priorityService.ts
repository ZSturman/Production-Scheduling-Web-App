import { createModuleLogger } from '../utils/logger';
import { googleSheetsService } from './googleSheets';
import { Product } from '../../../shared/src';

const logger = createModuleLogger('priority-service');

interface PriorityUpdate {
  jobNumber: string;
  oldPriority: number;
  newPriority: number;
  rowIndex: number;
}

class PriorityService {
  /**
   * Handle a priority change for a single job
   * Implements "insert and shift" algorithm
   */
  async updatePriority(
    jobNumber: string,
    newPriority: number,
    workCenter: string
  ): Promise<PriorityUpdate[]> {
    logger.info('Processing priority update', { jobNumber, newPriority, workCenter });

    // Get all products in this work center
    const allProducts = await googleSheetsService.getAllProducts();
    const wcProducts = allProducts.filter(
      (p) => p.workCenter === workCenter
    );

    // Find the target job
    const targetJob = wcProducts.find((p) => p.jobNumber === jobNumber);
    if (!targetJob) {
      throw new Error(`Job ${jobNumber} not found in work center ${workCenter}`);
    }

    const oldPriority = targetJob.priority;
    
    // If priority didn't change, nothing to do
    if (oldPriority === newPriority) {
      return [];
    }

    // Get other jobs (excluding target)
    const otherJobs = wcProducts
      .filter((p) => p.jobNumber !== jobNumber)
      .sort((a, b) => a.priority - b.priority);

    // Insert target at new position and renumber
    const insertIndex = Math.min(newPriority - 1, otherJobs.length);
    otherJobs.splice(insertIndex, 0, targetJob);

    // Generate updates with new sequential priorities
    const updates: PriorityUpdate[] = [];
    const timestamp = new Date().toISOString();
    const sheetUpdates: { rowIndex: number; priority: number; priorityUpdatedAt: string }[] = [];

    for (let i = 0; i < otherJobs.length; i++) {
      const job = otherJobs[i];
      const assignedPriority = i + 1;
      
      if (job.priority !== assignedPriority) {
        updates.push({
          jobNumber: job.jobNumber,
          oldPriority: job.priority,
          newPriority: assignedPriority,
          rowIndex: job.rowIndex,
        });
        
        sheetUpdates.push({
          rowIndex: job.rowIndex,
          priority: assignedPriority,
          // Only update timestamp for the job that was explicitly changed
          priorityUpdatedAt: job.jobNumber === jobNumber ? timestamp : job.priorityUpdatedAt,
        });
      }
    }

    // Batch update the sheet
    if (sheetUpdates.length > 0) {
      await googleSheetsService.batchUpdatePriorities(sheetUpdates);
      logger.info('Priority cascade complete', {
        jobNumber,
        affectedJobs: updates.length,
      });
    }

    return updates;
  }

  /**
   * Handle a job moving to a different work center
   * 1. Remove from old work center (compact priorities)
   * 2. Add to new work center at end or specified priority
   */
  async moveToWorkCenter(
    jobNumber: string,
    oldWorkCenter: string,
    newWorkCenter: string,
    newPriority?: number
  ): Promise<{ oldWcUpdates: PriorityUpdate[]; newWcUpdates: PriorityUpdate[] }> {
    logger.info('Moving job between work centers', {
      jobNumber,
      from: oldWorkCenter,
      to: newWorkCenter,
      newPriority,
    });

    const allProducts = await googleSheetsService.getAllProducts();
    const targetJob = allProducts.find((p) => p.jobNumber === jobNumber);
    
    if (!targetJob) {
      throw new Error(`Job ${jobNumber} not found`);
    }

    // Step 1: Remove from old work center and compact
    const oldWcProducts = allProducts
      .filter((p) => p.workCenter === oldWorkCenter && p.jobNumber !== jobNumber)
      .sort((a, b) => a.priority - b.priority);

    const oldWcUpdates: PriorityUpdate[] = [];
    const oldWcSheetUpdates: { rowIndex: number; priority: number; priorityUpdatedAt: string }[] = [];

    for (let i = 0; i < oldWcProducts.length; i++) {
      const job = oldWcProducts[i];
      const assignedPriority = i + 1;
      
      if (job.priority !== assignedPriority) {
        oldWcUpdates.push({
          jobNumber: job.jobNumber,
          oldPriority: job.priority,
          newPriority: assignedPriority,
          rowIndex: job.rowIndex,
        });
        
        oldWcSheetUpdates.push({
          rowIndex: job.rowIndex,
          priority: assignedPriority,
          priorityUpdatedAt: job.priorityUpdatedAt,
        });
      }
    }

    // Step 2: Add to new work center
    const newWcProducts = allProducts
      .filter((p) => p.workCenter === newWorkCenter)
      .sort((a, b) => a.priority - b.priority);

    // Determine priority in new work center
    const targetPriority = newPriority || newWcProducts.length + 1;
    
    // Insert and renumber
    const insertIndex = Math.min(targetPriority - 1, newWcProducts.length);
    newWcProducts.splice(insertIndex, 0, targetJob);

    const timestamp = new Date().toISOString();
    const newWcUpdates: PriorityUpdate[] = [];
    const newWcSheetUpdates: { rowIndex: number; priority: number; priorityUpdatedAt: string }[] = [];

    for (let i = 0; i < newWcProducts.length; i++) {
      const job = newWcProducts[i];
      const assignedPriority = i + 1;
      
      newWcUpdates.push({
        jobNumber: job.jobNumber,
        oldPriority: job.priority,
        newPriority: assignedPriority,
        rowIndex: job.rowIndex,
      });
      
      newWcSheetUpdates.push({
        rowIndex: job.rowIndex,
        priority: assignedPriority,
        priorityUpdatedAt: job.jobNumber === jobNumber ? timestamp : job.priorityUpdatedAt,
      });
    }

    // Batch update all changes
    const allSheetUpdates = [...oldWcSheetUpdates, ...newWcSheetUpdates];
    if (allSheetUpdates.length > 0) {
      await googleSheetsService.batchUpdatePriorities(allSheetUpdates);
    }

    logger.info('Work center move complete', {
      jobNumber,
      oldWcAffected: oldWcUpdates.length,
      newWcAffected: newWcUpdates.length,
    });

    return { oldWcUpdates, newWcUpdates };
  }

  /**
   * Batch update priorities for drag-drop reordering
   * Takes an ordered list of job numbers and assigns sequential priorities
   */
  async batchReorderPriorities(
    workCenter: string,
    orderedJobNumbers: string[]
  ): Promise<PriorityUpdate[]> {
    logger.info('Batch reorder priorities', {
      workCenter,
      jobs: orderedJobNumbers.length,
    });

    const allProducts = await googleSheetsService.getAllProducts();
    const wcProducts = allProducts.filter((p) => p.workCenter === workCenter);

    const updates: PriorityUpdate[] = [];
    const timestamp = new Date().toISOString();
    const sheetUpdates: { rowIndex: number; priority: number; priorityUpdatedAt: string }[] = [];

    for (let i = 0; i < orderedJobNumbers.length; i++) {
      const jobNumber = orderedJobNumbers[i];
      const job = wcProducts.find((p) => p.jobNumber === jobNumber);
      
      if (!job) {
        logger.warn(`Job ${jobNumber} not found in work center ${workCenter}`);
        continue;
      }

      const newPriority = i + 1;
      
      if (job.priority !== newPriority) {
        updates.push({
          jobNumber: job.jobNumber,
          oldPriority: job.priority,
          newPriority,
          rowIndex: job.rowIndex,
        });
        
        sheetUpdates.push({
          rowIndex: job.rowIndex,
          priority: newPriority,
          priorityUpdatedAt: timestamp,
        });
      }
    }

    if (sheetUpdates.length > 0) {
      await googleSheetsService.batchUpdatePriorities(sheetUpdates);
    }

    logger.info('Batch reorder complete', { updated: updates.length });
    return updates;
  }

  /**
   * Compact priorities in a work center (close gaps)
   */
  async compactPriorities(workCenter: string): Promise<PriorityUpdate[]> {
    const allProducts = await googleSheetsService.getAllProducts();
    const wcProducts = allProducts
      .filter((p) => p.workCenter === workCenter)
      .sort((a, b) => a.priority - b.priority);

    const updates: PriorityUpdate[] = [];
    const sheetUpdates: { rowIndex: number; priority: number; priorityUpdatedAt: string }[] = [];

    for (let i = 0; i < wcProducts.length; i++) {
      const job = wcProducts[i];
      const newPriority = i + 1;
      
      if (job.priority !== newPriority) {
        updates.push({
          jobNumber: job.jobNumber,
          oldPriority: job.priority,
          newPriority,
          rowIndex: job.rowIndex,
        });
        
        sheetUpdates.push({
          rowIndex: job.rowIndex,
          priority: newPriority,
          priorityUpdatedAt: job.priorityUpdatedAt,
        });
      }
    }

    if (sheetUpdates.length > 0) {
      await googleSheetsService.batchUpdatePriorities(sheetUpdates);
    }

    return updates;
  }
}

// Export singleton instance
export const priorityService = new PriorityService();
