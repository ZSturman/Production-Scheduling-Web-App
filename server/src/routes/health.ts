import { Router, Request, Response } from 'express';
import { config } from '../config';
import { googleSheetsService } from '../services/googleSheets';
import { HealthCheckResponse } from '../../../shared/src/types/api';

const router = Router();

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/', async (_req: Request, res: Response) => {
  let sheetsStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
  
  try {
    // Check Google Sheets connection
    const isConnected = await googleSheetsService.testConnection();
    sheetsStatus = isConnected ? 'connected' : 'error';
  } catch {
    sheetsStatus = 'error';
  }
  
  const response: HealthCheckResponse = {
    status: sheetsStatus === 'connected' ? 'healthy' : 'degraded',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: {
      googleSheets: sheetsStatus,
      firebase: 'connected', // If we got here, Firebase is working
    },
  };
  
  const statusCode = response.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(response);
});

/**
 * GET /api/health/ready
 * Readiness probe for Cloud Run
 */
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    const isReady = await googleSheetsService.testConnection();
    if (isReady) {
      res.status(200).json({ ready: true });
    } else {
      res.status(503).json({ ready: false, reason: 'Google Sheets not connected' });
    }
  } catch (error) {
    res.status(503).json({
      ready: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/health/live
 * Liveness probe for Cloud Run
 */
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ alive: true });
});

export default router;
