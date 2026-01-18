import { describe, it, expect, beforeEach } from 'vitest';
import { createTransferOptimizationService } from './transfer-optimization';
import { createTransferService } from './transfer';

// Mock database for testing
const mockDb = {} as any;

describe('TransferOptimizationService', () => {
  let optimizationService: any;
  let transferService: any;

  beforeEach(() => {
    transferService = createTransferService(mockDb);
    optimizationService = createTransferOptimizationService(mockDb, transferService);
  });

  describe('Service Creation', () => {
    it('should create transfer optimization service successfully', () => {
      expect(optimizationService).toBeDefined();
      expect(typeof optimizationService.optimizeTransferRoutes).toBe('function');
      expect(typeof optimizationService.createBulkTransfers).toBe('function');
      expect(typeof optimizationService.scheduleTransferBatch).toBe('function');
      expect(typeof optimizationService.getOptimizationRecommendations).toBe('function');
      expect(typeof optimizationService.analyzeBatchPerformance).toBe('function');
    });
  });

  describe('Route Optimization', () => {
    it('should validate required fields for route optimization', async () => {
      const invalidRequest = {
        sourceLocationId: '',
        destinationLocationIds: [],
        productId: '',
        totalQuantity: 0,
        priority: 'NORMAL' as const,
        requestedBy: 'user1'
      };

      await expect(
        optimizationService.optimizeTransferRoutes(invalidRequest, 'tenant1')
      ).rejects.toThrow('Source location, destination locations, product, and positive quantity are required');
    });

    it('should validate positive quantity for route optimization', async () => {
      const invalidRequest = {
        sourceLocationId: 'loc1',
        destinationLocationIds: ['loc2'],
        productId: 'prod1',
        totalQuantity: -5,
        priority: 'NORMAL' as const,
        requestedBy: 'user1'
      };

      await expect(
        optimizationService.optimizeTransferRoutes(invalidRequest, 'tenant1')
      ).rejects.toThrow('Source location, destination locations, product, and positive quantity are required');
    });
  });

  describe('Bulk Transfers', () => {
    it('should validate bulk transfer requests', async () => {
      const invalidRequest = {
        transfers: [],
        priority: 'NORMAL' as const,
        requestedBy: 'user1'
      };

      await expect(
        optimizationService.createBulkTransfers(invalidRequest, 'tenant1')
      ).rejects.toThrow('At least one transfer request is required');
    });
  });

  describe('Transfer Scheduling', () => {
    it('should validate scheduling requests', async () => {
      const invalidRequest = {
        transfers: [],
        scheduledFor: new Date(),
        priority: 'NORMAL' as const,
        requestedBy: 'user1'
      };

      await expect(
        optimizationService.scheduleTransferBatch(invalidRequest, 'tenant1')
      ).rejects.toThrow('Transfer requests and scheduled time are required');
    });
  });

  describe('Optimization Recommendations', () => {
    it('should validate location ID for recommendations', async () => {
      await expect(
        optimizationService.getOptimizationRecommendations('', 'tenant1')
      ).rejects.toThrow('Location ID is required');
    });
  });

  describe('Batch Performance Analysis', () => {
    it('should validate batch ID for performance analysis', async () => {
      await expect(
        optimizationService.analyzeBatchPerformance('', 'tenant1')
      ).rejects.toThrow('Batch ID is required');
    });
  });
});