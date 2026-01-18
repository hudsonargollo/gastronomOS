/**
 * Allocation Utilities Tests
 * 
 * Tests for allocation calculation utilities, summations, and optimizations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the schema imports before importing the AllocationUtilities
vi.mock('../db/schema', () => ({
  poItems: {
    id: 'mocked_po_items_id',
    poId: 'mocked_po_id',
    quantityOrdered: 'mocked_quantity_ordered'
  },
  allocations: {
    id: 'mocked_allocations_id',
    poItemId: 'mocked_po_item_id',
    tenantId: 'mocked_tenant_id',
    targetLocationId: 'mocked_target_location_id',
    quantityAllocated: 'mocked_quantity_allocated'
  },
  locations: {
    id: 'mocked_locations_id',
    tenantId: 'mocked_tenant_id',
    name: 'mocked_name'
  }
}));

// Mock drizzle-orm functions
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ field, value, type: 'eq' })),
  and: vi.fn((...conditions) => ({ conditions, type: 'and' })),
  sum: vi.fn((field) => ({ field, type: 'sum' })),
  count: vi.fn((field) => ({ field, type: 'count' }))
}));

import { 
  AllocationUtilities, 
  type IAllocationUtilities,
  type AllocationSummary,
  type AllocationTotals,
  type UnallocatedAnalysis,
  type BalanceOptimizationResult,
  type LocationEfficiencyMetrics,
  type AllocationRecommendation
} from './allocation-utilities';

// Mock database
const mockDb = {
  select: vi.fn()
} as any;

// Mock data
const mockPOItem = {
  id: 'po_item_1',
  poId: 'po_1',
  productId: 'product_1',
  quantityOrdered: 100
};

const mockAllocations = [
  {
    id: 'alloc_1',
    targetLocationId: 'loc_1',
    quantityAllocated: 30,
    locationName: 'Location 1'
  },
  {
    id: 'alloc_2',
    targetLocationId: 'loc_2',
    quantityAllocated: 40,
    locationName: 'Location 2'
  }
];

const mockLocation = {
  id: 'loc_1',
  tenantId: 'tenant_1',
  name: 'Test Location',
  type: 'RESTAURANT',
  address: '123 Main St'
};

describe('AllocationUtilities', () => {
  let allocationUtilities: IAllocationUtilities;

  beforeEach(() => {
    vi.clearAllMocks();
    allocationUtilities = new AllocationUtilities(mockDb);
  });

  describe('calculateAllocationSummary', () => {
    it('should calculate allocation summary correctly', async () => {
      // Mock PO item query
      const mockLimit = vi.fn().mockResolvedValue([mockPOItem]);
      const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });

      // Mock allocations query
      const mockWhere2 = vi.fn().mockResolvedValue(mockAllocations);
      const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere2 });
      const mockFrom2 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });

      mockDb.select
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 });

      const result = await allocationUtilities.calculateAllocationSummary('po_item_1', 'tenant_1');

      expect(result.poItemId).toBe('po_item_1');
      expect(result.totalAllocated).toBe(70); // 30 + 40
      expect(result.unallocatedQuantity).toBe(30); // 100 - 70
      expect(result.allocationCount).toBe(2);
      expect(result.averageAllocation).toBe(35); // 70 / 2
      expect(result.locationDistribution).toHaveLength(2);
      expect(result.locationDistribution[0]?.percentageOfTotal).toBeCloseTo(42.86, 1); // 30/70 * 100
    });

    it('should handle PO item with no allocations', async () => {
      // Mock PO item query
      const mockLimit = vi.fn().mockResolvedValue([mockPOItem]);
      const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });

      // Mock empty allocations query
      const mockWhere2 = vi.fn().mockResolvedValue([]);
      const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere2 });
      const mockFrom2 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });

      mockDb.select
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 });

      const result = await allocationUtilities.calculateAllocationSummary('po_item_1', 'tenant_1');

      expect(result.totalAllocated).toBe(0);
      expect(result.unallocatedQuantity).toBe(100);
      expect(result.allocationCount).toBe(0);
      expect(result.averageAllocation).toBe(0);
      expect(result.locationDistribution).toHaveLength(0);
    });

    it('should throw error for non-existent PO item', async () => {
      // Mock empty PO item query
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      await expect(
        allocationUtilities.calculateAllocationSummary('non_existent', 'tenant_1')
      ).rejects.toThrow('PO item not found');
    });
  });

  describe('calculateAllocationTotals', () => {
    it('should calculate allocation totals for PO', async () => {
      const mockPOItems = [
        { id: 'po_item_1', quantityOrdered: 100 },
        { id: 'po_item_2', quantityOrdered: 50 }
      ];

      // Mock PO items query
      const mockWhere1 = vi.fn().mockResolvedValue(mockPOItems);
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });

      // Mock unique locations query
      const mockWhere2 = vi.fn().mockResolvedValue([
        { locationId: 'loc_1' },
        { locationId: 'loc_2' },
        { locationId: 'loc_1' } // Duplicate to test uniqueness
      ]);
      const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere2 });
      const mockFrom2 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });

      // Mock allocation totals for each PO item
      const mockWhere3 = vi.fn().mockResolvedValue([{ totalAllocated: 70 }]);
      const mockFrom3 = vi.fn().mockReturnValue({ where: mockWhere3 });

      const mockWhere4 = vi.fn().mockResolvedValue([{ totalAllocated: 30 }]);
      const mockFrom4 = vi.fn().mockReturnValue({ where: mockWhere4 });

      mockDb.select
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 })
        .mockReturnValueOnce({ from: mockFrom3 })
        .mockReturnValueOnce({ from: mockFrom4 });

      const result = await allocationUtilities.calculateAllocationTotals('po_1', 'tenant_1');

      expect(result.totalQuantityOrdered).toBe(150); // 100 + 50
      expect(result.totalQuantityAllocated).toBe(100); // 70 + 30
      expect(result.totalUnallocated).toBe(50); // 150 - 100
      expect(result.allocationEfficiency).toBeCloseTo(66.67, 1); // 100/150 * 100
      expect(result.locationCount).toBe(2); // Unique locations
    });

    it('should handle PO with no items', async () => {
      // Mock empty PO items query
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const result = await allocationUtilities.calculateAllocationTotals('empty_po', 'tenant_1');

      expect(result.totalQuantityOrdered).toBe(0);
      expect(result.totalQuantityAllocated).toBe(0);
      expect(result.totalUnallocated).toBe(0);
      expect(result.allocationEfficiency).toBe(0);
      expect(result.locationCount).toBe(0);
      expect(result.averageAllocationPerLocation).toBe(0);
    });
  });

  describe('analyzeUnallocatedQuantities', () => {
    it('should analyze unallocated quantities and provide recommendations', async () => {
      const mockPOItems = [
        { id: 'po_item_1', productId: 'product_1', quantityOrdered: 100 },
        { id: 'po_item_2', productId: 'product_2', quantityOrdered: 50 }
      ];

      // Mock PO items query
      const mockWhere = vi.fn().mockResolvedValue(mockPOItems);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      // Mock calculateAllocationSummary calls
      const mockSummary1: AllocationSummary = {
        poItemId: 'po_item_1',
        totalAllocated: 70,
        unallocatedQuantity: 30,
        allocationCount: 2,
        averageAllocation: 35,
        locationDistribution: [
          { locationId: 'loc_1', locationName: 'Location 1', quantityAllocated: 30, percentageOfTotal: 42.86 },
          { locationId: 'loc_2', locationName: 'Location 2', quantityAllocated: 40, percentageOfTotal: 57.14 }
        ]
      };

      const mockSummary2: AllocationSummary = {
        poItemId: 'po_item_2',
        totalAllocated: 50,
        unallocatedQuantity: 0,
        allocationCount: 1,
        averageAllocation: 50,
        locationDistribution: [
          { locationId: 'loc_1', locationName: 'Location 1', quantityAllocated: 50, percentageOfTotal: 100 }
        ]
      };

      // Spy on calculateAllocationSummary method
      const calculateSummarySpy = vi.spyOn(allocationUtilities, 'calculateAllocationSummary')
        .mockResolvedValueOnce(mockSummary1)
        .mockResolvedValueOnce(mockSummary2);

      const result = await allocationUtilities.analyzeUnallocatedQuantities('po_1', 'tenant_1');

      expect(result).toHaveLength(1); // Only po_item_1 has unallocated quantity
      expect(result[0]?.poItemId).toBe('po_item_1');
      expect(result[0]?.unallocatedQuantity).toBe(30);
      expect(result[0]?.unallocatedPercentage).toBe(30);
      expect(result[0]?.suggestedActions).toBeDefined();
      expect(result[0]?.suggestedActions.length).toBeGreaterThan(0);

      calculateSummarySpy.mockRestore();
    });
  });

  describe('optimizeAllocationBalance', () => {
    it('should optimize allocation balance', async () => {
      const mockSummary: AllocationSummary = {
        poItemId: 'po_item_1',
        totalAllocated: 100,
        unallocatedQuantity: 0,
        allocationCount: 3,
        averageAllocation: 33.33,
        locationDistribution: [
          { locationId: 'loc_1', locationName: 'Location 1', quantityAllocated: 10, percentageOfTotal: 10 },
          { locationId: 'loc_2', locationName: 'Location 2', quantityAllocated: 50, percentageOfTotal: 50 },
          { locationId: 'loc_3', locationName: 'Location 3', quantityAllocated: 40, percentageOfTotal: 40 }
        ]
      };

      // Spy on calculateAllocationSummary method
      const calculateSummarySpy = vi.spyOn(allocationUtilities, 'calculateAllocationSummary')
        .mockResolvedValue(mockSummary);

      const result = await allocationUtilities.optimizeAllocationBalance('po_item_1', 'tenant_1');

      expect(result.currentBalance).toBeDefined();
      expect(result.currentBalance.isBalanced).toBe(false); // High variance
      expect(result.optimizedAllocations).toBeDefined();
      expect(result.improvementScore).toBeGreaterThan(0);
      expect(result.recommendations).toBeDefined();

      calculateSummarySpy.mockRestore();
    });

    it('should handle empty allocations', async () => {
      const mockSummary: AllocationSummary = {
        poItemId: 'po_item_1',
        totalAllocated: 0,
        unallocatedQuantity: 100,
        allocationCount: 0,
        averageAllocation: 0,
        locationDistribution: []
      };

      // Spy on calculateAllocationSummary method
      const calculateSummarySpy = vi.spyOn(allocationUtilities, 'calculateAllocationSummary')
        .mockResolvedValue(mockSummary);

      const result = await allocationUtilities.optimizeAllocationBalance('po_item_1', 'tenant_1');

      expect(result.currentBalance.isBalanced).toBe(true);
      expect(result.optimizedAllocations).toHaveLength(0);
      expect(result.improvementScore).toBe(0);
      expect(result.balanceAchieved).toBe(true);

      calculateSummarySpy.mockRestore();
    });
  });

  describe('calculateLocationEfficiency', () => {
    it('should calculate location efficiency metrics', async () => {
      // Mock location query
      const mockLimit = vi.fn().mockResolvedValue([mockLocation]);
      const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });

      // Mock allocation stats query
      const mockWhere2 = vi.fn().mockResolvedValue([{
        totalAllocations: 5,
        totalQuantityAllocated: 150
      }]);
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

      // Mock unique POs query
      const mockWhere3 = vi.fn().mockResolvedValue([
        { poId: 'po_1' },
        { poId: 'po_2' },
        { poId: 'po_1' } // Duplicate to test uniqueness
      ]);
      const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere3 });
      const mockFrom3 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });

      mockDb.select
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 })
        .mockReturnValueOnce({ from: mockFrom3 });

      const result = await allocationUtilities.calculateLocationEfficiency('loc_1', 'tenant_1');

      expect(result.locationId).toBe('loc_1');
      expect(result.locationName).toBe('Test Location');
      expect(result.totalAllocations).toBe(5);
      expect(result.totalQuantityAllocated).toBe(150);
      expect(result.averageAllocationSize).toBe(30); // 150 / 5
      expect(result.allocationFrequency).toBe(2.5); // 5 allocations / 2 unique POs
      expect(result.utilizationRate).toBe(75); // Placeholder value
    });

    it('should throw error for non-existent location', async () => {
      // Mock empty location query
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      await expect(
        allocationUtilities.calculateLocationEfficiency('non_existent', 'tenant_1')
      ).rejects.toThrow('Location not found');
    });
  });

  describe('generateAllocationRecommendations', () => {
    it('should generate recommendations for unallocated inventory', async () => {
      const mockUnallocatedAnalyses: UnallocatedAnalysis[] = [
        {
          poItemId: 'po_item_1',
          productName: 'Product 1',
          quantityOrdered: 100,
          quantityAllocated: 70,
          unallocatedQuantity: 30,
          unallocatedPercentage: 30,
          suggestedActions: []
        }
      ];

      const mockTotals: AllocationTotals = {
        totalQuantityOrdered: 100,
        totalQuantityAllocated: 70,
        totalUnallocated: 30,
        allocationEfficiency: 70,
        locationCount: 2,
        averageAllocationPerLocation: 35
      };

      // Spy on methods
      const analyzeUnallocatedSpy = vi.spyOn(allocationUtilities, 'analyzeUnallocatedQuantities')
        .mockResolvedValue(mockUnallocatedAnalyses);
      const calculateTotalsSpy = vi.spyOn(allocationUtilities, 'calculateAllocationTotals')
        .mockResolvedValue(mockTotals);

      const result = await allocationUtilities.generateAllocationRecommendations('po_1', 'tenant_1');

      expect(result).toHaveLength(2); // Unallocated + efficiency recommendations
      expect(result[0]?.type).toBe('EFFICIENCY_GAIN');
      expect(result[0]?.title).toContain('Unallocated Inventory');
      expect(result[1]?.type).toBe('BALANCE_IMPROVEMENT');
      expect(result[1]?.title).toContain('Allocation Efficiency');

      analyzeUnallocatedSpy.mockRestore();
      calculateTotalsSpy.mockRestore();
    });

    it('should handle PO with no recommendations needed', async () => {
      const mockUnallocatedAnalyses: UnallocatedAnalysis[] = [];
      const mockTotals: AllocationTotals = {
        totalQuantityOrdered: 100,
        totalQuantityAllocated: 95,
        totalUnallocated: 5,
        allocationEfficiency: 95,
        locationCount: 2,
        averageAllocationPerLocation: 47.5
      };

      // Spy on methods
      const analyzeUnallocatedSpy = vi.spyOn(allocationUtilities, 'analyzeUnallocatedQuantities')
        .mockResolvedValue(mockUnallocatedAnalyses);
      const calculateTotalsSpy = vi.spyOn(allocationUtilities, 'calculateAllocationTotals')
        .mockResolvedValue(mockTotals);

      const result = await allocationUtilities.generateAllocationRecommendations('po_1', 'tenant_1');

      expect(result).toHaveLength(0); // No recommendations needed for high efficiency

      analyzeUnallocatedSpy.mockRestore();
      calculateTotalsSpy.mockRestore();
    });
  });
});