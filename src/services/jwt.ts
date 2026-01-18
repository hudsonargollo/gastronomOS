import { CONFIG } from '../config';
import { JWTClaims } from '../types';
import { validateJWTConfig } from '../config';

// Extended JWT Claims interface with issuer for internal use
export interface ExtendedJWTClaims extends JWTClaims {
  iss: string;        // issuer
}

// JWT Header interface
interface JWTHeader {
  alg: string;
  typ: string;
}

// JWT Service interface as defined in the design document
export interface IJWTService {
  sign(claims: Omit<JWTClaims, 'exp' | 'iat'>): Promise<string>;
  verify(token: string): Promise<ExtendedJWTClaims>;
  decode(token: string): ExtendedJWTClaims | null;
}

export class JWTService implements IJWTService {
  private signingKey: CryptoKey | null = null;

  constructor(private secret: string) {}

  /**
   * Initialize the signing key using Web Crypto API
   */
  private async getSigningKey(): Promise<CryptoKey> {
    if (this.signingKey) {
      return this.signingKey;
    }

    // Convert secret string to ArrayBuffer
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.secret);

    // Import the key for HMAC-SHA256
    this.signingKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );

    return this.signingKey;
  }

  /**
   * Base64URL encode a string
   */
  private base64UrlEncode(str: string): string {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Base64URL decode a string
   */
  private base64UrlDecode(str: string): string {
    // Add padding if needed
    const padded = str + '='.repeat((4 - str.length % 4) % 4);
    // Replace URL-safe characters
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    
    try {
      const decoded = atob(base64);
      const decoder = new TextDecoder();
      const uint8Array = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
      return decoder.decode(uint8Array);
    } catch (error) {
      throw new Error('Invalid base64url encoding');
    }
  }

  /**
   * Sign JWT claims and return a complete JWT token
   */
  async sign(claims: Omit<JWTClaims, 'exp' | 'iat'>): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    
    // Create complete claims with timestamps and issuer
    const fullClaims: ExtendedJWTClaims = {
      ...claims,
      iat: now,
      exp: now + CONFIG.JWT.EXPIRES_IN,
      iss: CONFIG.JWT.ISSUER,
    };

    // Create JWT header
    const header: JWTHeader = {
      alg: CONFIG.JWT.ALGORITHM,
      typ: 'JWT',
    };

    // Encode header and payload
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(fullClaims));
    
    // Create signature input
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    
    // Sign using Web Crypto API
    const key = await this.getSigningKey();
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signatureInput)
    );

    // Encode signature
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return `${signatureInput}.${encodedSignature}`;
  }

  /**
   * Verify JWT token and return claims if valid
   */
  async verify(token: string): Promise<ExtendedJWTClaims> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new Error('Invalid JWT format: missing parts');
    }

    try {
      // Decode and parse header
      const headerJson = this.base64UrlDecode(encodedHeader);
      const header: JWTHeader = JSON.parse(headerJson);

      // Verify algorithm
      if (header.alg !== CONFIG.JWT.ALGORITHM) {
        throw new Error('Invalid JWT algorithm');
      }

      // Decode and parse payload
      const payloadJson = this.base64UrlDecode(encodedPayload);
      const claims: ExtendedJWTClaims = JSON.parse(payloadJson);

      // Verify expiration
      const now = Math.floor(Date.now() / 1000);
      if (claims.exp <= now) {
        throw new Error('JWT token has expired');
      }

      // Verify issuer
      if (claims.iss !== CONFIG.JWT.ISSUER) {
        throw new Error('Invalid JWT issuer');
      }

      // Verify signature
      const signatureInput = `${encodedHeader}.${encodedPayload}`;
      const key = await this.getSigningKey();
      const encoder = new TextEncoder();
      
      // Decode the signature
      const signatureBytes = Uint8Array.from(
        atob(encodedSignature.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - encodedSignature.length % 4) % 4)),
        c => c.charCodeAt(0)
      );

      const isValid = await crypto.subtle.verify(
        'HMAC',
        key,
        signatureBytes,
        encoder.encode(signatureInput)
      );

      if (!isValid) {
        throw new Error('Invalid JWT signature');
      }

      return claims;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`JWT verification failed: ${error.message}`);
      }
      throw new Error('JWT verification failed: Unknown error');
    }
  }

  /**
   * Decode JWT token without verification (for debugging/inspection)
   */
  decode(token: string): ExtendedJWTClaims | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const [, encodedPayload] = parts;
      if (!encodedPayload) {
        return null;
      }
      
      const payloadJson = this.base64UrlDecode(encodedPayload);
      return JSON.parse(payloadJson) as ExtendedJWTClaims;
    } catch {
      return null;
    }
  }
}

/**
 * Factory function to create JWT service instance with configuration validation
 */
export function createJWTService(secret: string, environment?: string): IJWTService {
  // Validate configuration
  validateJWTConfig(secret, environment);
  
  return new JWTService(secret);
}