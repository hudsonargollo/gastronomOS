import { describe, it, expect, beforeEach } from 'vitest';
import { JWTService, createJWTService } from './jwt';
import { JWTClaims } from '../types';

describe('JWT Service', () => {
  let jwtService: JWTService;
  const testSecret = 'test-secret-that-is-long-enough-for-validation-and-security';

  beforeEach(() => {
    jwtService = createJWTService(testSecret) as JWTService;
  });

  describe('Token Creation and Verification', () => {
    it('should create and verify a valid JWT token', async () => {
      const claims: Omit<JWTClaims, 'exp' | 'iat'> = {
        sub: 'user-123',
        tenant_id: 'tenant-456',
        role: 'ADMIN',
        location_id: 'location-789',
      };

      const token = await jwtService.sign(claims);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const verifiedClaims = await jwtService.verify(token);
      expect(verifiedClaims.sub).toBe(claims.sub);
      expect(verifiedClaims.tenant_id).toBe(claims.tenant_id);
      expect(verifiedClaims.role).toBe(claims.role);
      expect(verifiedClaims.location_id).toBe(claims.location_id);
      expect(verifiedClaims.iss).toBe('gastronomos-auth');
      expect(verifiedClaims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(verifiedClaims.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    });

    it('should create token without location_id', async () => {
      const claims: Omit<JWTClaims, 'exp' | 'iat'> = {
        sub: 'user-123',
        tenant_id: 'tenant-456',
        role: 'STAFF',
      };

      const token = await jwtService.sign(claims);
      const verifiedClaims = await jwtService.verify(token);
      
      expect(verifiedClaims.sub).toBe(claims.sub);
      expect(verifiedClaims.tenant_id).toBe(claims.tenant_id);
      expect(verifiedClaims.role).toBe(claims.role);
      expect(verifiedClaims.location_id).toBeUndefined();
    });
  });

  describe('Token Validation', () => {
    it('should reject invalid token format', async () => {
      await expect(jwtService.verify('invalid-token')).rejects.toThrow('Invalid JWT format');
      await expect(jwtService.verify('invalid.token')).rejects.toThrow('Invalid JWT format');
    });

    it('should reject token with invalid signature', async () => {
      const claims: Omit<JWTClaims, 'exp' | 'iat'> = {
        sub: 'user-123',
        tenant_id: 'tenant-456',
        role: 'ADMIN',
      };

      const token = await jwtService.sign(claims);
      const parts = token.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.invalid-signature`;

      await expect(jwtService.verify(tamperedToken)).rejects.toThrow('JWT verification failed');
    });
  });

  describe('Token Decoding', () => {
    it('should decode token without verification', () => {
      const claims: Omit<JWTClaims, 'exp' | 'iat'> = {
        sub: 'user-123',
        tenant_id: 'tenant-456',
        role: 'MANAGER',
        location_id: 'location-789',
      };

      return jwtService.sign(claims).then(token => {
        const decoded = jwtService.decode(token);
        expect(decoded).toBeDefined();
        expect(decoded!.sub).toBe(claims.sub);
        expect(decoded!.tenant_id).toBe(claims.tenant_id);
      });
    });

    it('should return null for invalid token format', () => {
      expect(jwtService.decode('invalid-token')).toBeNull();
    });
  });

  describe('Configuration Validation', () => {
    it('should reject short secrets', () => {
      expect(() => createJWTService('short')).toThrow('JWT_SECRET must be at least 32 characters long');
    });

    it('should reject empty secrets', () => {
      expect(() => createJWTService('')).toThrow('JWT_SECRET is required but not provided');
    });

    it('should accept valid secrets', () => {
      expect(() => createJWTService(testSecret)).not.toThrow();
    });
  });
});