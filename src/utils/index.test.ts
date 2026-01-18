import { describe, it, expect } from 'vitest';
import {
  generateId,
  generateTenantId,
  generateUserId,
  generateLocationId,
  generateAuditId,
  isValidEmail,
  isValidSlug,
  getCurrentTimestamp,
  createErrorResponse,
} from './index';

describe('Utility Functions', () => {
  describe('ID Generation', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
    });

    it('should generate prefixed tenant IDs', () => {
      const tenantId = generateTenantId();
      expect(tenantId).toMatch(/^tenant_/);
    });

    it('should generate prefixed user IDs', () => {
      const userId = generateUserId();
      expect(userId).toMatch(/^user_/);
    });

    it('should generate prefixed location IDs', () => {
      const locationId = generateLocationId();
      expect(locationId).toMatch(/^location_/);
    });

    it('should generate prefixed audit IDs', () => {
      const auditId = generateAuditId();
      expect(auditId).toMatch(/^audit_/);
    });
  });

  describe('Email Validation', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
    });
  });

  describe('Slug Validation', () => {
    it('should validate correct slug formats', () => {
      expect(isValidSlug('valid-slug')).toBe(true);
      expect(isValidSlug('test123')).toBe(true);
    });

    it('should reject invalid slug formats', () => {
      expect(isValidSlug('Invalid_Slug')).toBe(false);
      expect(isValidSlug('ab')).toBe(false); // too short
    });
  });

  describe('Timestamp Generation', () => {
    it('should generate current timestamp', () => {
      const timestamp = getCurrentTimestamp();
      expect(typeof timestamp).toBe('number');
      expect(timestamp).toBeGreaterThan(0);
      
      // Should be close to current time (within 1 second)
      const now = Math.floor(Date.now() / 1000);
      expect(Math.abs(timestamp - now)).toBeLessThanOrEqual(1);
    });
  });

  describe('Error Response Creation', () => {
    it('should create standardized error response', () => {
      const error = createErrorResponse('ValidationError', 'Invalid input', 'VALIDATION_FAILED');
      
      expect(error.error).toBe('ValidationError');
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.timestamp).toBeTruthy();
      expect(new Date(error.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should include request ID when provided', () => {
      const error = createErrorResponse('Error', 'Message', 'CODE', 'req-123');
      expect(error.request_id).toBe('req-123');
    });
  });
});