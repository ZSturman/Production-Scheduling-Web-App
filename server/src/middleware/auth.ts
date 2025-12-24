import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { config } from '../config';
import { createModuleLogger } from '../utils/logger';
import { User, UserRole } from '../../../shared/src/types/audit';

const logger = createModuleLogger('auth');

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Initialize Firebase Admin
let firebaseInitialized = false;

export function initializeFirebase(): void {
  if (firebaseInitialized) return;
  
  try {
    admin.initializeApp({
      projectId: config.firebaseProjectId,
    });
    firebaseInitialized = true;
    logger.info('Firebase Admin initialized');
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin', { error });
    throw error;
  }
}

/**
 * Get user role from custom claims or default to viewer
 */
function getUserRole(decodedToken: admin.auth.DecodedIdToken): UserRole {
  // Check for custom claims
  if (decodedToken.role === 'admin') return 'admin';
  if (decodedToken.role === 'planner') return 'planner';
  if (decodedToken.planner === true) return 'planner';
  if (decodedToken.admin === true) return 'admin';
  return 'viewer';
}

/**
 * Authentication middleware
 * Verifies Firebase ID token and attaches user to request
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
      },
    });
    return;
  }
  
  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      displayName: decodedToken.name || null,
      photoURL: decodedToken.picture || null,
      role: getUserRole(decodedToken),
    };
    
    next();
  } catch (error) {
    logger.warn('Token verification failed', { error });
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired authentication token',
      },
    });
  }
}

/**
 * Role-based authorization middleware factory
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Access denied - insufficient role', {
        userId: req.user.uid,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
      });
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions for this action',
        },
      });
      return;
    }
    
    next();
  };
}

/**
 * Optional auth middleware - attaches user if token present, continues otherwise
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }
  
  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      displayName: decodedToken.name || null,
      photoURL: decodedToken.picture || null,
      role: getUserRole(decodedToken),
    };
  } catch {
    // Token invalid, continue without user
  }
  
  next();
}
