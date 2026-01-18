/**
 * PO Matcher Service Tests
 * 
 * Tests for receipt-to-PO matching functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createPOMatcherService, IPOMatcherService } from './po-matcher';

// Mock database for testing
const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve([])
      }),
      innerJoin: () => ({
        where: () => ({
          limit: () => Promise.resolve([])
        })
      })
    })
  }),
  update: () => ({
    set: () => ({
      where: () => Promise.resolve({ success: true })
    })
  })
} as any;

describe('POMatcherService', () => {
  let poMatcherService: IPOMatcherService;

  beforeEach(() => {
    poMatcherService = createPOMatcherService(mockDb);
  });

  describe('Service Creation', () => {
    it('should create a PO matcher service instance', () => {
      expect(poMatcherService).toBeDefined();
      expect(typeof poMatcherService.findPOMatches).toBe('function');
      expect(typeof poMatcherService.linkReceiptToPO).toBe('function');
      expect(typeof poMatcherService.unlinkReceiptFromPO).toBe('function');
      expect(typeof poMatcherService.detectVariances).toBe('function');
      expect(typeof poMatcherService.getReceiptPOVariances).toBe('function');
      expect(typeof poMatcherService.attemptAutomaticLinking).toBe('function');
    });
  });

  describe('Input Validation', () => {
    it('should validate receipt ID for findPOMatches', async () => {
      await expect(poMatcherService.findPOMatches('')).rejects.toThrow();
    });

    it('should validate parameters for linkReceiptToPO', async () => {
      await expect(poMatcherService.linkReceiptToPO('', 'po-123', 'user-123')).rejects.toThrow();
      await expect(poMatcherService.linkReceiptToPO('receipt-123', '', 'user-123')).rejects.toThrow();
      await expect(poMatcherService.linkReceiptToPO('receipt-123', 'po-123', '')).rejects.toThrow();
    });

    it('should validate parameters for unlinkReceiptFromPO', async () => {
      await expect(poMatcherService.unlinkReceiptFromPO('', 'user-123')).rejects.toThrow();
      await expect(poMatcherService.unlinkReceiptFromPO('receipt-123', '')).rejects.toThrow();
    });

    it('should validate parameters for detectVariances', async () => {
      await expect(poMatcherService.detectVariances('', 'po-123')).rejects.toThrow();
      await expect(poMatcherService.detectVariances('receipt-123', '')).rejects.toThrow();
    });

    it('should validate tenant ID for getReceiptPOVariances', async () => {
      await expect(poMatcherService.getReceiptPOVariances('')).rejects.toThrow();
    });

    it('should validate receipt ID for attemptAutomaticLinking', async () => {
      await expect(poMatcherService.attemptAutomaticLinking('')).rejects.toThrow();
    });
  });

  describe('String Similarity Calculation', () => {
    it('should calculate string similarity correctly', () => {
      // Access the private method through the service instance
      const service = poMatcherService as any;
      
      // Test exact matches
      expect(service.calculateStringSimilarity('test', 'test')).toBe(1);
      
      // Test completely different strings
      expect(service.calculateStringSimilarity('abc', 'xyz')).toBeLessThan(0.5);
      
      // Test similar strings
      expect(service.calculateStringSimilarity('restaurant', 'restaurant inc')).toBeGreaterThan(0.7);
      
      // Test empty strings
      expect(service.calculateStringSimilarity('', '')).toBe(1);
      expect(service.calculateStringSimilarity('test', '')).toBe(0);
      expect(service.calculateStringSimilarity('', 'test')).toBe(0);
    });
  });
});