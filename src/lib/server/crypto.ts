import CryptoJS from 'crypto-js';

// Cached encryption key
let cachedEncryptionKey: string | null = null;
const keyVersion = 'v1';

/**
 * Get encryption key from environment variable
 */
export function getEncryptionKey(): string {
  if (cachedEncryptionKey) {
    return cachedEncryptionKey;
  }

  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    // Generate a random key for development if not set
    if (process.env.NODE_ENV === 'development') {
      const devKey = CryptoJS.lib.WordArray.random(32).toString();
      console.warn('No ENCRYPTION_KEY set, using generated development key. Set ENCRYPTION_KEY in .env for persistence.');
      cachedEncryptionKey = devKey;
      return devKey;
    }
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  
  cachedEncryptionKey = key;
  return key;
}

/**
 * Get current encryption key version
 */
export function getEncryptionKeyVersion(): string {
  return keyVersion;
}

/**
 * Encrypt data using AES-256
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  
  // Generate random IV for each encryption
  const iv = CryptoJS.lib.WordArray.random(16);
  
  // Encrypt using AES-256-CBC
  const encrypted = CryptoJS.AES.encrypt(
    plaintext, 
    CryptoJS.enc.Utf8.parse(key.substring(0, 32)), 
    {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }
  );
  
  // Combine IV and ciphertext: base64(iv):base64(ciphertext)
  return `${iv.toString(CryptoJS.enc.Base64)}:${encrypted.toString()}`;
}

/**
 * Decrypt data
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  
  // Split IV and ciphertext
  const parts = ciphertext.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = CryptoJS.enc.Base64.parse(parts[0]);
  const encryptedData = parts[1];
  
  // Decrypt
  const decrypted = CryptoJS.AES.decrypt(
    encryptedData, 
    CryptoJS.enc.Utf8.parse(key.substring(0, 32)), 
    {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }
  );
  
  const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
  
  if (!plaintext) {
    throw new Error('Decryption failed - invalid key or corrupted data');
  }
  
  return plaintext;
}

/**
 * Validate service account JSON
 */
export function validateServiceAccountJson(jsonString: string): {
  valid: boolean;
  email?: string;
  projectId?: string;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonString);
    
    const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email'];
    const missingFields = requiredFields.filter(field => !parsed[field]);
    
    if (missingFields.length > 0) {
      return {
        valid: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
      };
    }
    
    if (parsed.type !== 'service_account') {
      return {
        valid: false,
        error: 'JSON must be a service account key (type: "service_account")',
      };
    }
    
    return {
      valid: true,
      email: parsed.client_email,
      projectId: parsed.project_id,
    };
  } catch {
    return {
      valid: false,
      error: 'Invalid JSON format',
    };
  }
}
