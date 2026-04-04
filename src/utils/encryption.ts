/**
 * Encryption utilities for secure credential storage
 * Uses Web Crypto API for AES-GCM encryption
 */

export interface EncryptionResult {
  encryptedData: string;
  iv: string;
  salt: string;
}

export interface DecryptionInput {
  encryptedData: string;
  iv: string;
  salt: string;
}

export class EncryptionService {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12; // 96 bits for GCM
  private static readonly SALT_LENGTH = 16; // 128 bits
  private static readonly TAG_LENGTH = 16; // 128 bits for GCM

  /**
   * Derive encryption key from password using PBKDF2
   */
  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000, // OWASP recommended minimum
        hash: 'SHA-256'
      },
      keyMaterial,
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt sensitive data using AES-GCM
   */
  static async encrypt(plaintext: string, password: string): Promise<EncryptionResult> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);

      // Generate random salt and IV
      const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

      // Derive key from password
      const key = await this.deriveKey(password, salt);

      // Encrypt the data
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: iv,
          tagLength: this.TAG_LENGTH * 8 // Convert to bits
        },
        key,
        data
      );

      // Convert to base64 for storage
      const encryptedArray = new Uint8Array(encryptedBuffer);
      const encryptedData = btoa(String.fromCharCode(...encryptedArray));
      const ivBase64 = btoa(String.fromCharCode(...iv));
      const saltBase64 = btoa(String.fromCharCode(...salt));

      return {
        encryptedData,
        iv: ivBase64,
        salt: saltBase64
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt sensitive data using AES-GCM
   */
  static async decrypt(input: DecryptionInput, password: string): Promise<string> {
    try {
      // Convert from base64
      const encryptedData = new Uint8Array(
        atob(input.encryptedData).split('').map(char => char.charCodeAt(0))
      );
      const iv = new Uint8Array(
        atob(input.iv).split('').map(char => char.charCodeAt(0))
      );
      const salt = new Uint8Array(
        atob(input.salt).split('').map(char => char.charCodeAt(0))
      );

      // Derive key from password
      const key = await this.deriveKey(password, salt);

      // Decrypt the data
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: iv,
          tagLength: this.TAG_LENGTH * 8 // Convert to bits
        },
        key,
        encryptedData
      );

      // Convert back to string
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Invalid credentials or corrupted data'}`);
    }
  }

  /**
   * Generate a secure random password for encryption
   */
  static generateEncryptionKey(): string {
    const array = new Uint8Array(32); // 256 bits
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  }

  /**
   * Validate encryption key strength
   */
  static validateEncryptionKey(key: string): boolean {
    if (!key || key.length < 32) {
      return false;
    }

    // Check for basic entropy
    const uniqueChars = new Set(key).size;
    return uniqueChars >= 16;
  }
}