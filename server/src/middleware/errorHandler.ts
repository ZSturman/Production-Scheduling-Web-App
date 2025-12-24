import { Request, Response, NextFunction } from 'express';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('error-handler');

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Custom error class for application errors
 */
export class HttpError extends Error implements AppError {
  statusCode: number;
  code: string;
  details?: Record<string, unknown>;
  
  constructor(
    statusCode: number,
    message: string,
    code?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'ERROR';
    this.details = details;
    this.name = 'HttpError';
  }
}

/**
 * Not Found error
 */
export class NotFoundError extends HttpError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super(404, message, 'NOT_FOUND', { resource, id });
  }
}

/**
 * Validation error
 */
export class ValidationError extends HttpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, message, 'VALIDATION_ERROR', details);
  }
}

/**
 * Conflict error (e.g., duplicate key)
 */
export class ConflictError extends HttpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(409, message, 'CONFLICT', details);
  }
}

/**
 * Google Sheets API error
 */
export class SheetsApiError extends HttpError {
  constructor(message: string, originalError?: unknown) {
    super(502, message, 'SHEETS_API_ERROR', {
      originalError: originalError instanceof Error ? originalError.message : String(originalError),
    });
  }
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  
  // Log error
  if (statusCode >= 500) {
    logger.error('Server error', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      userId: req.user?.uid,
    });
  } else {
    logger.warn('Client error', {
      error: err.message,
      code,
      path: req.path,
      method: req.method,
    });
  }
  
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: err.message,
      details: err.details,
    },
  });
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
