/**
 * Allocation Analytics Service Tests
 * 
 * Tests for allocation analytics and reporting functionality.
 * Implements requirements 3.5 for allocation analytics and reporting.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAllocationAnalyticsService, AllocationAnalyticsService } from './allocation-analytics';
import { DrizzleD1Database } from 'drizzle-orm/d1';

// Mock database
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
} as unknown as DrizzleD1Database;

describe('AllocationAnalyticsService', () => {
  let analyticsService: AllocationAnalyticsService;

  beforeEach(() => {
    vi.clearAllMocks();
    analyticsService = new AllocationAnalyticsService(mockDb);
  });

  describe('Service Creation', () => {
    it('should create service instance', () => {
      expect(analyticsService).toBeInstanceOf(AllocationAnalyticsService);
    });

    it('should create service via factory function', () => {
      const service = createAllocationAnalyticsService(mockDb);
      expect(service).toBeDefined();
    });
  });

  describe('getEfficiencyMetrics', () => {
    it('should validate required parameters', async () => {
      // Mock database responses
      (mockDb.select as any).mockResolvedValueOnce([{
        totalAllocations: 10,
        totalAllocatedQuantity: 100,
        averageAllocationSize: 10
      }]);
      
      (mockDb.select as any).mockResolvedValueOnce([{
        totalAllocatedValue: 1000
      }]);
      
      (mockDb.select as any).mockResolvedValueOnce([{
        totalOrdered: 120,
        totalAllocated: 100
      }]);

      const result = await analyticsService.getEfficiencyMetrics('tenant_123');
      
      expect(result).toBeDefined();
      expect(result.tenantId).toBe('tenant_123');
      expect(result.totalAllocations).toBe(10);
      expect(result.totalAllocatedQuantity).toBe(100);
    });

    it('should handle filters correctly', async () => {
      const filters = {
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-12-31'),
        locationIds: ['loc1', 'loc2']
      };

      // Mock database responses
      (mockDb.select as any).mockResolvedValueOnce([{
        totalAllocations: 5,
        totalAllocatedQuantity: 50,
        averageAllocationSize: 10
      }]);
      
      (mockDb.select as any).mockResolvedValueOnce([{
        totalAllocatedValue: 500
      }]);
      
      (mockDb.select as any).mockResolvedValueOnce([{
        totalOrdered: 60,
        totalAllocated: 50
      }]);

      const result = await analyticsService.getEfficiencyMetrics('tenant_123', filters);
      
      expect(result).toBeDefined();
      expect(result.totalAllocations).toBe(5);
    });
  });

  describe('getLocationPatterns', () => {
    it('should return location patterns', async () => {
      // Mock database response
      (mockDb.select as any).mockResolvedValueOnce([{
        locationId: 'loc1',
        locationName: 'Location 1',
        locationType: 'RESTAURANT',
        totalAllocations: 5,
        totalQuantityAllocated: 50,
        totalValueAllocated: 500,
        averageAllocationSize: 10
      }]);

      const result = await analyticsService.getLocationPatterns('tenant_123');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty results', async () => {
      // Mock empty database response
      (mockDb.select as any).mockResolvedValueOnce([]);

      const result = await analyticsService.getLocationPatterns('tenant_123');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('getVarianceReport', () => {
    it('should generate variance report', async () => {
      // Mock database response
      (mockDb.select as any).mockResolvedValueOnce([{
        po: {
          id: 'po1',
          poNumber: 'PO-001',
          createdAt: Date.now()
        },
        supplier: 'Test Supplier',
        totalOrderedQuantity: 100,
        totalAllocatedQuantity: 80
      }]);

      const result = await analyticsService.getVarianceReport('tenant_123');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle specific PO ID', async () => {
      // Mock database response
      (mockDb.select as any).mockResolvedValueOnce([{
        po: {
          id: 'po1',
          poNumber: 'PO-001',
          createdAt: Date.now()
        },
        supplier: 'Test Supplier',
        totalOrderedQuantity: 100,
        totalAllocatedQuantity: 100
      }]);

      const result = await analyticsService.getVarianceReport('tenant_123', 'po1');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getTrendData', () => {
    it('should return trend data for different periods', async () => {
      // Mock database response
      (mockDb.select as any).mockResolvedValueOnce([{
        period: '2024-01',
        totalAllocations: 10,
        totalQuantity: 100,
        totalValue: 1000,
        averageAllocationSize: 10
      }]);

      const result = await analyticsService.getTrendData('tenant_123', 'monthly');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle different period types', async () => {
      const periods: Array<'daily' | 'weekly' | 'monthly'> = ['daily', 'weekly', 'monthly'];
      
      for (const period of periods) {
        // Mock database response
        (mockDb.select as any).mockResolvedValueOnce([{
          period: '2024-01-01',
          totalAllocations: 5,
          totalQuantity: 50,
          totalValue: 500,
          averageAllocationSize: 10
        }]);

        const result = await analyticsService.getTrendData('tenant_123', period);
        
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      }
    });
  });

  describe('getTopPerformingLocations', () => {
    it('should return top performing locations', async () => {
      // Mock getLocationPatterns method
      vi.spyOn(analyticsService, 'getLocationPatterns').mockResolvedValueOnce([
        {
          locationId: 'loc1',
          locationName: 'Location 1',
          locationType: 'RESTAURANT',
          totalAllocations: 10,
          totalQuantityAllocated: 100,
          totalValueAllocated: 1000,
          averageAllocationSize: 10,
          allocationFrequency: 2,
          topProductCategories: [],
          statusDistribution: [],
          efficiencyMetrics: {
            onTimeDeliveryRate: 95,
            averageProcessingTime: 2,
            utilizationRate: 90
          }
        },
        {
          locationId: 'loc2',
          locationName: 'Location 2',
          locationType: 'RESTAURANT',
          totalAllocations: 5,
          totalQuantityAllocated: 50,
          totalValueAllocated: 500,
          averageAllocationSize: 10,
          allocationFrequency: 1,
          topProductCategories: [],
          statusDistribution: [],
          efficiencyMetrics: {
            onTimeDeliveryRate: 85,
            averageProcessingTime: 3,
            utilizationRate: 80
          }
        }
      ]);

      const result = await analyticsService.getTopPerformingLocations('tenant_123', 5);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
      // Should be sorted by efficiency (utilization rate)
      if (result.length > 1) {
        expect(result[0].efficiencyMetrics.utilizationRate).toBeGreaterThanOrEqual(
          result[1].efficiencyMetrics.utilizationRate
        );
      }
    });
  });

  describe('getAllocationDistributionAnalysis', () => {
    it('should return distribution analysis', async () => {
      // Mock database responses for total count
      (mockDb.select as any).mockResolvedValueOnce([{ total: 100 }]);
      
      // Mock database responses for distributions
      (mockDb.select as any).mockResolvedValueOnce([{
        locationId: 'loc1',
        locationName: 'Location 1',
        count: 50,
        percentage: 50
      }]);
      
      (mockDb.select as any).mockResolvedValueOnce([{
        productId: 'prod1',
        productName: 'Product 1',
        count: 30,
        percentage: 30
      }]);
      
      (mockDb.select as any).mockResolvedValueOnce([{
        status: 'PENDING',
        count: 60,
        percentage: 60
      }]);

      const result = await analyticsService.getAllocationDistributionAnalysis('tenant_123');
      
      expect(result).toBeDefined();
      expect(result.byLocation).toBeDefined();
      expect(result.byProduct).toBeDefined();
      expect(result.byStatus).toBeDefined();
      expect(Array.isArray(result.byLocation)).toBe(true);
      expect(Array.isArray(result.byProduct)).toBe(true);
      expect(Array.isArray(result.byStatus)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      (mockDb.select as any).mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(analyticsService.getEfficiencyMetrics('tenant_123')).rejects.toThrow('Database connection failed');
    });

    it('should validate required parameters', async () => {
      // Test with empty tenant ID
      await expect(analyticsService.getEfficiencyMetrics('')).rejects.toThrow();
    });
  });
});