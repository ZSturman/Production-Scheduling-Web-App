import type { Product } from '@/types';
import { GoogleSheetsService } from './googleSheets';

interface PriorityUpdate {
  jobNumber: string;
  oldPriority: number;
  newPriority: number;
  rowIndex: number;
}

export class PriorityService {
  private sheetsService: GoogleSheetsService;

  constructor(sheetsService: GoogleSheetsService) {
    this.sheetsService = sheetsService;
  }

  async updatePriority(
    jobNumber: string,
    newPriority: number,
    workCenter: string
  ): Promise<PriorityUpdate[]> {
    const allProducts = await this.sheetsService.getAllProducts();
    const wcProducts = allProducts.filter((p) => p.workCenter === workCenter);

    const targetJob = wcProducts.find((p) => p.jobNumber === jobNumber);
    if (!targetJob) {
      throw new Error(`Job ${jobNumber} not found in work center ${workCenter}`);
    }

    const oldPriority = targetJob.priority;
    
    if (oldPriority === newPriority) {
      return [];
    }

    const otherJobs = wcProducts
      .filter((p) => p.jobNumber !== jobNumber)
      .sort((a, b) => a.priority - b.priority);

    const insertIndex = Math.min(newPriority - 1, otherJobs.length);
    otherJobs.splice(insertIndex, 0, targetJob);

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
          priorityUpdatedAt: job.jobNumber === jobNumber ? timestamp : job.priorityUpdatedAt,
        });
      }
    }

    if (sheetUpdates.length > 0) {
      await this.sheetsService.batchUpdatePriorities(sheetUpdates);
    }

    return updates;
  }

  async moveToWorkCenter(
    jobNumber: string,
    oldWorkCenter: string,
    newWorkCenter: string,
    newPriority?: number
  ): Promise<{ oldWcUpdates: PriorityUpdate[]; newWcUpdates: PriorityUpdate[] }> {
    const allProducts = await this.sheetsService.getAllProducts();
    const targetJob = allProducts.find((p) => p.jobNumber === jobNumber);
    
    if (!targetJob) {
      throw new Error(`Job ${jobNumber} not found`);
    }

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

    const newWcProducts = allProducts
      .filter((p) => p.workCenter === newWorkCenter)
      .sort((a, b) => a.priority - b.priority);

    const targetPriority = newPriority || newWcProducts.length + 1;
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

    const allSheetUpdates = [...oldWcSheetUpdates, ...newWcSheetUpdates];
    if (allSheetUpdates.length > 0) {
      await this.sheetsService.batchUpdatePriorities(allSheetUpdates);
    }

    return { oldWcUpdates, newWcUpdates };
  }

  async batchReorderPriorities(
    workCenter: string,
    orderedJobNumbers: string[]
  ): Promise<PriorityUpdate[]> {
    const allProducts = await this.sheetsService.getAllProducts();
    const wcProducts = allProducts.filter((p) => p.workCenter === workCenter);

    const updates: PriorityUpdate[] = [];
    const timestamp = new Date().toISOString();
    const sheetUpdates: { rowIndex: number; priority: number; priorityUpdatedAt: string }[] = [];

    for (let i = 0; i < orderedJobNumbers.length; i++) {
      const jobNumber = orderedJobNumbers[i];
      const job = wcProducts.find((p) => p.jobNumber === jobNumber);
      
      if (!job) continue;

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
      await this.sheetsService.batchUpdatePriorities(sheetUpdates);
    }

    return updates;
  }

  async compactPriorities(workCenter: string): Promise<PriorityUpdate[]> {
    const allProducts = await this.sheetsService.getAllProducts();
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
      await this.sheetsService.batchUpdatePriorities(sheetUpdates);
    }

    return updates;
  }
}
