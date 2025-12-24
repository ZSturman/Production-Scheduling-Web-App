import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export interface Config {
  // Server
  port: number;
  nodeEnv: string;
  
  // Google Sheets
  googleSheetsId: string;
  googleCredentialsPath: string;
  
  // Firebase
  firebaseProjectId: string;
  
  // Feature flags
  enableAuditLog: boolean;
  
  // Rate limiting
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

export const config: Config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Google Sheets
  googleSheetsId: process.env.GOOGLE_SHEETS_ID || '',
  googleCredentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
  
  // Firebase
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  
  // Feature flags
  enableAuditLog: process.env.ENABLE_AUDIT_LOG !== 'false',
  
  // Rate limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
};

/**
 * Validate required configuration
 */
export function validateConfig(): void {
  const required: (keyof Config)[] = ['googleSheetsId', 'firebaseProjectId'];
  
  for (const key of required) {
    if (!config[key]) {
      console.warn(`Warning: Missing required config: ${key}`);
    }
  }
}
