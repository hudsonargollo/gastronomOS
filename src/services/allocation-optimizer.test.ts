/**
 * Allocation Optimizer Service Tests
 * 
 * Tests for allocation optimization functionality including smart suggestions,
 * rebalancing, and conflict resolution. Implements requirements 7.1.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAllocationOptimizerService, AllocationOptimizerService } from './allocation-optimizer';
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
  having: vi.fn().mockReturnThis(),
} as unknown as DrizzleD1Database;

describe('AllocationOptimizerService', () => {
  let optimizerService: AllocationOptimizerService;

  beforeEach(() => {
    vi.clearAllMocks();
    optimizerService = new AllocationOptimizerService(mockDb);
  });

  describe('Service Creation', () => {
    it('should create service instance', () => {
      expect(optimizerService).toBeInstanceOf(AllocationOptimizerService);
    });

    it('should create service via factory function', () => {
      const service = createAllocationOptimizerService(mockDb);
      expect(service).toBeDefined();
    });
  });

  describe('generateSmartSuggestions', () => {
    it('should validate required parameters', async () => {
      await expect(optimizerService.generateSmartSuggestions('', 'po1')).rejects.toThrow();
      await expect(optimizerService.generateSmartSuggestions('tenant1', '')).rejects.toThrow();
    });

    it('should generate suggestions for unallocated items', async () => {
      // Mock database responses
      (mockDb.select as any).mockResolvedValueOnce([
        {
          poItem: { id: 'item1', quantityOrdered: 100, poId: 'po1' },
          product: { id: 'prod1', name: 'Product 1' },
          totalAllocated: 60
        }
      ]);

      (mockDb.select as any).mockResolvedValueOnce([
        { id: 'loc1', name: 'Location 1', tenantId: 'tenant1' }
      ]);

      // Mock getLocationDemandPatterns
      vi.spyOn(optimizerService, 'getLocationDemandPatterns').mockResolvedValueOnce([
        {
          locationId: 'loc1',
          locationName: 'Location 1',
          productId: 'prod1',
          productName: 'Product 1',
          averageDemand: 20,
          demandVariability: 15,
          seasonalityFactor: 1.0,
          utilizationRate: 85,
          predictedDemand: 22
        }
      ]);

      (mockDb.select as any).mockResolvedValueOnce([]); // Current allocations

      const result = await optimizerService.generateSmartSuggestions('tenant1', 'po1');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle items with no unallocated quantity', async () => {
      // Mock database responses for fully allocated items
      (mockDb.select as any).mockResolvedValueOnce([
        {
          poItem: { id: 'item1', quantityOrdered: 100, poId: 'po1' },
          product: { id: 'prod1', name: 'Product 1' },
          totalAllocated: 100 // Fully allocated
        }
      ]);

      (mockDb.select as any).mockResolvedValueOnce([
        { id: 'loc1', name: 'Location 1', tenantId: 'tenant1' }
      ]);

      vi.spyOn(optimizerService, 'getLocationDemandPatterns').mockResolvedValueOnce([]);

      const result = await optimizerService.generateSmartSuggestions('tenant1', 'po1');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0); // No suggestions for fully allocated items
    });
  });

  describe('analyzeRebalancingOpportunities', () => {
    it('should analyze rebalancing opportunities', async () => {
      // Mock database response
      (mockDb.select as any).mockResolvedValueOnce([
        {
          po: { id: 'po1', poNumber: 'PO-001' },
          poItem: { id: 'item1', quantityOrdered: 100 },
          allocation: { id: 'alloc1', quantityAllocated: 50, quantityReceived: 20, status: 'PENDING' },
          location: { id: 'loc1', name: 'Location 1' },
          product: { id: 'prod1', name: 'Product 1' }
        }
      ]);

      const result = await optimizerService.analyzeRebalancingOpportunities('tenant1');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by PO ID when provided', async () => {
      // Mock database response
      (mockDb.select as any).mockResolvedValueOnce([]);

      const result = await optimizerService.analyzeRebalancingOpportunities('tenant1', 'po1');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('detectAllocationConflicts', () => {
    it('should detect allocation conflicts', async () => {
      const result = await optimizerService.detectAllocationConflicts('tenant1');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle specific PO ID', async () => {
      const result = await optimizerService.detectAllocationConflicts('tenant1', 'po1');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('optimizeAllocationDistribution', () => {
    it('should optimize allocation distribution', async () => {
      const strategy = {
        name: 'Test Strategy',
        description: 'Test optimization strategy',
        parameters: {
          prioritizeUtilization: true,
          minimizeWaste: true,
          balanceDistribution: true,
          considerHistoricalDemand: true,
          locationCapacityWeight: 0.3,
          demandPredictionWeight: 0.4,
          costOptimizationWeight: 0.3
        }
      };

      // Mock the individual methods
      vi.spyOn(optimizerService, 'generateSmartSuggestions').mockResolvedValueOnce([]);
      vi.spyOn(optimizerService, 'analyzeRebalancingOpportunities').mockResolvedValueOnce([]);
      vi.spyOn(optimizerService, 'detectAllocationConflicts').mockResolvedValueOnce([]);
      vi.spyOn(optimizerService, 'validateOptimizationFeasibility').mockResolvedValueOnce({
        feasible: true,
        issues: []
      });

      const result = await optimizerService.optimizeAllocationDistribution('tenant1', 'po1', strategy);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.suggestedAllocations).toBeDefined();
      expect(result.rebalancingRecommendations).toBeDefined();
      expect(result.conflictsResolved).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it('should handle infeasible optimizations', async () => {
      const strategy = {
        name: 'Test Strategy',
        description: 'Test optimization strategy',
        parameters: {
          prioritizeUtilization: true,
          minimizeWaste: true,
          balanceDistribution: true,
          considerHistoricalDemand: true,
          locationCapacityWeight: 0.3,
          demandPredictionWeight: 0.4,
          costOptimizationWeight: 0.3
        }
      };

      // Mock the individual methods
      vi.spyOn(optimizerService, 'generateSmartSuggestions').mockResolvedValueOnce([]);
      vi.spyOn(optimizerService, 'analyzeRebalancingOpportunities').mockResolvedValueOnce([]);
      vi.spyOn(optimizerService, 'detectAllocationConflicts').mockResolvedValueOnce([]);
      vi.spyOn(optimizerService, 'validateOptimizationFeasibility').mockResolvedValueOnce({
        feasible: false,
        issues: ['Over-allocation detected']
      });

      const result = await optimizerService.optimizeAllocationDistribution('tenant1', 'po1', strategy);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });
  });

  describe('getLocationDemandPatterns', () => {
    it('should return demand patterns', async () => {
      // Mock database response
      (mockDb.select as any).mockResolvedValueOnce([
        {
          locationId: 'loc1',
          locationName: 'Location 1',
          productId: 'prod1',
          productName: 'Product 1',
          totalAllocated: 100,
          totalReceived: 80,
          allocationCount: 5,
          avgAllocation: 20,
          lastAllocation: Date.now()
        }
      ]);

      const result = await optimizerService.getLocationDemandPatterns('tenant1');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by location and product IDs', async () => {
      // Mock database response
      (mockDb.select as any).mockResolvedValueOnce([]);

      const result = await optimizerService.getLocationDemandPatterns(
        'tenant1',
        ['loc1', 'loc2'],
        ['prod1', 'prod2']
      );
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('validateOptimizationFeasibility', () => {
    it('should validate feasible suggestions', async () => {
      const suggestions = [
        {
          poItemId: 'item1',
          productName: 'Product 1',
          totalQuantity: 100,
          currentAllocations: [
            {
              locationId: 'loc1',
              locationName: 'Location 1',
              currentQuantity: 50,
              suggestedQuantity: 50,
              reason: 'Existing allocation'
            }
          ],
          unallocatedQuantity: 50,
          suggestedAllocations: [
            {
              locationId: 'loc2',
              locationName: 'Location 2',
              suggestedQuantity: 30,
              confidence: 80,
              reasoning: ['High utilization rate']
            }
          ],
          optimizationScore: 85
        }
      ];

      // Mock location existence check
      (mockDb.select as any).mockResolvedValueOnce([{ id: 'loc2' }]);

      const result = await optimizerService.validateOptimizationFeasibility('tenant1', suggestions);
      
      expect(result).toBeDefined();
      expect(result.feasible).toBe(true);
      expect(result.issues).toBeDefined();
      expect(Array.isArray(result.issues)).toBe(true);
    });

    it('should detect over-allocation issues', async () => {
      const suggestions = [
        {
          poItemId: 'item1',
          productName: 'Product 1',
          totalQuantity: 100,
          currentAllocations: [
            {
              locationId: 'loc1',
              locationName: 'Location 1',
              currentQuantity: 60,
              suggestedQuantity: 60,
              reason: 'Existing allocation'
            }
          ],
          unallocatedQuantity: 40,
          suggestedAllocations: [
            {
              locationId: 'loc2',
              locationName: 'Location 2',
              suggestedQuantity: 50, // This would cause over-allocation
              confidence: 80,
              reasoning: ['High utilization rate']
            }
          ],
          optimizationScore: 85
        }
      ];

      const result = await optimizerService.validateOptimizationFeasibility('tenant1', suggestions);
      
      expect(result).toBeDefined();
      expect(result.feasible).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should detect non-existent locations', async () => {
      const suggestions = [
        {
          poItemId: 'item1',
          productName: 'Product 1',
          totalQuantity: 100,
          currentAllocations: [],
          unallocatedQuantity: 100,
          suggestedAllocations: [
            {
              locationId: 'nonexistent',
              locationName: 'Non-existent Location',
              suggestedQuantity: 50,
              confidence: 80,
              reasoning: ['High utilization rate']
            }
          ],
          optimizationScore: 85
        }
      ];

      // Mock location not found
      (mockDb.select as any).mockResolvedValueOnce([]);

      const result = await optimizerService.validateOptimizationFeasibility('tenant1', suggestions);
      
      expect(result).toBeDefined();
      expect(result.feasible).toBe(false);
      expect(result.issues.some(issue => issue.includes('not found'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      (mockDb.select as any).mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(optimizerService.generateSmartSuggestions('tenant1', 'po1')).rejects.toThrow('Database connection failed');
    });

    it('should validate required parameters', async () => {
      await expect(optimizerService.generateSmartSuggestions('', 'po1')).rejects.toThrow();
      await expect(optimizerService.analyzeRebalancingOpportunities('')).rejects.toThrow();
      await expect(optimizerService.detectAllocationConflicts('')).rejects.toThrow();
    });
  });
});