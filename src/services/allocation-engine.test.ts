/**
 * Allocation Engine Tests
 * 
 * Tests for the allocation engine mathematical calculations and optimization.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the schema imports before importing the AllocationEngine
vi.mock('../db/schema', () => ({
  poItems: {
    id: 'mocked_po_items_id',
    quantityOrdered: 'mocked_quantity_ordered'
  },
  allocations: {
    id: 'mocked_allocations_id',
    poItemId: 'mocked_po_item_id',
    tenantId: 'mocked_tenant_id',
    quantityAllocated: 'mocked_quantity_allocated'
  },
  locations: {
    id: 'mocked_locations_id'
  }
}));

// Mock drizzle-orm functions
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ field, value, type: 'eq' })),
  and: vi.fn((...conditions) => ({ conditions, type: 'and' })),
  sum: vi.fn((field) => ({ field, type: 'sum' }))
}));

import { AllocationEngine, type IAllocationEngine, type AllocationStrategy, type LocationPercentage, type POItem, type Location, type Allocation } from './allocation-engine';

// Mock database with proper Drizzle query builder pattern
const mockDb = {
  select: vi.fn()
} as any;

// Mock data
const mockPOItem: POItem = {
  id: 'po_item_1',
  poId: 'po_1',
  productId: 'product_1',
  quantityOrdered: 100,
  unitPriceCents: 1000,
  lineTotalCents: 100000,
  notes: null,
  createdAt: Date.now(),
  updatedAt: Date.now()
};

const mockLocations: Location[] = [
  {
    id: 'loc_1',
    tenantId: 'tenant_1',
    name: 'Location 1',
    type: 'RESTAURANT',
    address: '123 Main St',
    createdAt: Date.now()
  },
  {
    id: 'loc_2',
    tenantId: 'tenant_1',
    name: 'Location 2',
    type: 'RESTAURANT',
    address: '456 Oak Ave',
    createdAt: Date.now()
  }
];

const mockAllocations: Allocation[] = [
  {
    id: 'alloc_1',
    tenantId: 'tenant_1',
    poItemId: 'po_item_1',
    targetLocationId: 'loc_1',
    quantityAllocated: 30,
    quantityReceived: 0,
    status: 'PENDING',
    notes: null,
    createdBy: 'user_1',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

describe('AllocationEngine', () => {
  let allocationEngine: IAllocationEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    allocationEngine = new AllocationEngine(mockDb);
  });

  describe('distributeByPercentage', () => {
    it('should distribute quantity by percentage correctly', () => {
      const totalQuantity = 100;
      const locationPercentages: LocationPercentage[] = [
        { locationId: 'loc_1', percentage: 60 },
        { locationId: 'loc_2', percentage: 40 }
      ];

      const result = allocationEngine.distributeByPercentage(totalQuantity, locationPercentages);

      expect(result.distributions).toHaveLength(2);
      expect(result.distributions[0]).toEqual({
        locationId: 'loc_1',
        allocatedQuantity: 60,
        percentage: 60
      });
      expect(result.distributions[1]).toEqual({
        locationId: 'loc_2',
        allocatedQuantity: 40,
        percentage: 40
      });
      expect(result.totalDistributed).toBe(100);
      expect(result.remainingQuantity).toBe(0);
      expect(result.distributionAccuracy).toBeGreaterThan(95);
    });

    it('should handle partial percentage distribution', () => {
      const totalQuantity = 100;
      const locationPercentages: LocationPercentage[] = [
        { locationId: 'loc_1', percentage: 30 },
        { locationId: 'loc_2', percentage: 25 }
      ];

      const result = allocationEngine.distributeByPercentage(totalQuantity, locationPercentages);

      expect(result.totalDistributed).toBe(55);
      expect(result.remainingQuantity).toBe(45);
      expect(result.distributions).toHaveLength(2);
    });

    it('should handle rounding down to prevent over-allocation', () => {
      const totalQuantity = 100;
      const locationPercentages: LocationPercentage[] = [
        { locationId: 'loc_1', percentage: 33.33 },
        { locationId: 'loc_2', percentage: 33.33 },
        { locationId: 'loc_3', percentage: 33.34 }
      ];

      const result = allocationEngine.distributeByPercentage(totalQuantity, locationPercentages);

      // Should round down to prevent over-allocation
      expect(result.totalDistributed).toBeLessThanOrEqual(100);
      expect(result.remainingQuantity).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for percentages over 100%', () => {
      const totalQuantity = 100;
      const locationPercentages: LocationPercentage[] = [
        { locationId: 'loc_1', percentage: 60 },
        { locationId: 'loc_2', percentage: 50 }
      ];

      expect(() => {
        allocationEngine.distributeByPercentage(totalQuantity, locationPercentages);
      }).toThrow('Total percentage (110%) exceeds 100%');
    });

    it('should return empty result for zero quantity', () => {
      const totalQuantity = 0;
      const locationPercentages: LocationPercentage[] = [
        { locationId: 'loc_1', percentage: 50 }
      ];

      const result = allocationEngine.distributeByPercentage(totalQuantity, locationPercentages);

      expect(result.distributions).toHaveLength(0);
      expect(result.totalDistributed).toBe(0);
      expect(result.remainingQuantity).toBe(0);
      expect(result.distributionAccuracy).toBe(0);
    });
  });

  describe('validateAllocationMath', () => {
    it('should validate allocation within ordered quantity', async () => {
      // Mock the database query chain
      const mockLimit = vi.fn().mockResolvedValue([mockPOItem]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const newAllocation = {
        poItemId: 'po_item_1',
        targetLocationId: 'loc_2',
        quantityAllocated: 50
      };

      const result = await allocationEngine.validateAllocationMath(
        'po_item_1',
        mockAllocations,
        newAllocation
      );

      expect(result.valid).toBe(true);
      expect(result.totalAllocated).toBe(80); // 30 existing + 50 new
      expect(result.remainingQuantity).toBe(20); // 100 - 80
      expect(result.errors).toHaveLength(0);
    });

    it('should detect over-allocation', async () => {
      // Mock the database query chain
      const mockLimit = vi.fn().mockResolvedValue([mockPOItem]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const newAllocation = {
        poItemId: 'po_item_1',
        targetLocationId: 'loc_2',
        quantityAllocated: 80 // Would exceed 100 total
      };

      const result = await allocationEngine.validateAllocationMath(
        'po_item_1',
        mockAllocations,
        newAllocation
      );

      expect(result.valid).toBe(false);
      expect(result.totalAllocated).toBe(110); // 30 existing + 80 new
      expect(result.overAllocation).toBe(10); // 110 - 100
      expect(result.errors).toContain('Over-allocation detected: 10 units exceed ordered quantity');
    });

    it('should reject zero or negative quantities', async () => {
      // Mock the database query chain
      const mockLimit = vi.fn().mockResolvedValue([mockPOItem]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const newAllocation = {
        poItemId: 'po_item_1',
        targetLocationId: 'loc_2',
        quantityAllocated: 0
      };

      const result = await allocationEngine.validateAllocationMath(
        'po_item_1',
        mockAllocations,
        newAllocation
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Allocation quantity must be greater than zero');
    });

    it('should handle non-existent PO item', async () => {
      // Mock empty result for non-existent PO item
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      mockDb.select.mockReturnValue({ from: mockFrom });

      const newAllocation = {
        poItemId: 'non_existent',
        targetLocationId: 'loc_1',
        quantityAllocated: 10
      };

      const result = await allocationEngine.validateAllocationMath(
        'non_existent',
        [],
        newAllocation
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('PO item not found');
    });
  });

  describe('calculateOptimalAllocation', () => {
    it('should return empty plan for no items or locations', async () => {
      const strategy: AllocationStrategy = { type: 'MANUAL', parameters: {} };

      const result = await allocationEngine.calculateOptimalAllocation([], [], strategy);

      expect(result.allocations).toHaveLength(0);
      expect(result.unallocatedQuantity).toBe(0);
      expect(result.feasible).toBe(false);
      expect(result.optimizationScore).toBe(0);
    });

    it('should calculate percentage-based allocation', async () => {
      const strategy: AllocationStrategy = {
        type: 'PERCENTAGE',
        parameters: {
          locationPercentages: {
            'loc_1': 60,
            'loc_2': 40
          }
        }
      };

      const result = await allocationEngine.calculateOptimalAllocation(
        [mockPOItem],
        mockLocations,
        strategy
      );

      expect(result.allocations).toHaveLength(2);
      expect(result.allocations[0]?.quantityAllocated).toBe(60);
      expect(result.allocations[1]?.quantityAllocated).toBe(40);
      expect(result.feasible).toBe(true);
      expect(result.optimizationScore).toBeGreaterThan(0);
    });

    it('should calculate fixed amount allocation', async () => {
      const strategy: AllocationStrategy = {
        type: 'FIXED_AMOUNT',
        parameters: {
          locationAmounts: {
            'loc_1': 30,
            'loc_2': 50
          }
        }
      };

      const result = await allocationEngine.calculateOptimalAllocation(
        [mockPOItem],
        mockLocations,
        strategy
      );

      expect(result.allocations).toHaveLength(2);
      expect(result.allocations[0]?.quantityAllocated).toBe(30);
      expect(result.allocations[1]?.quantityAllocated).toBe(50);
      expect(result.unallocatedQuantity).toBe(20); // 100 - 80
      expect(result.feasible).toBe(true);
    });

    it('should detect infeasible fixed amount allocation', async () => {
      const strategy: AllocationStrategy = {
        type: 'FIXED_AMOUNT',
        parameters: {
          locationAmounts: {
            'loc_1': 60,
            'loc_2': 50 // Total 110 > 100 ordered
          }
        }
      };

      const result = await allocationEngine.calculateOptimalAllocation(
        [mockPOItem],
        mockLocations,
        strategy
      );

      expect(result.feasible).toBe(false);
      expect(result.optimizationScore).toBe(0);
    });
  });

  describe('calculateUnallocatedQuantity', () => {
    it('should calculate unallocated quantity correctly', async () => {
      // Mock PO item query
      const mockLimit1 = vi.fn().mockResolvedValue([mockPOItem]);
      const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit1 });
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });

      // Mock allocations sum query
      const mockWhere2 = vi.fn().mockResolvedValue([{ totalAllocated: 30 }]);
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

      mockDb.select
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 });

      const result = await allocationEngine.calculateUnallocatedQuantity('po_item_1', 'tenant_1');

      expect(result).toBe(70); // 100 ordered - 30 allocated
    });

    it('should return zero for fully allocated items', async () => {
      // Mock PO item query
      const mockLimit1 = vi.fn().mockResolvedValue([mockPOItem]);
      const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit1 });
      const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });

      // Mock full allocation
      const mockWhere2 = vi.fn().mockResolvedValue([{ totalAllocated: 100 }]);
      const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

      mockDb.select
        .mockReturnValueOnce({ from: mockFrom1 })
        .mockReturnValueOnce({ from: mockFrom2 });

      const result = await allocationEngine.calculateUnallocatedQuantity('po_item_1', 'tenant_1');

      expect(result).toBe(0);
    });
  });

  describe('validateDistributionAccuracy', () => {
    it('should calculate perfect accuracy for exact distribution', () => {
      const requested: LocationPercentage[] = [
        { locationId: 'loc_1', percentage: 60 },
        { locationId: 'loc_2', percentage: 40 }
      ];

      const actual = {
        distributions: [
          { locationId: 'loc_1', allocatedQuantity: 60, percentage: 60 },
          { locationId: 'loc_2', allocatedQuantity: 40, percentage: 40 }
        ],
        totalDistributed: 100,
        remainingQuantity: 0,
        distributionAccuracy: 100
      };

      const accuracy = allocationEngine.validateDistributionAccuracy(requested, actual);

      expect(accuracy).toBe(100);
    });

    it('should calculate lower accuracy for imperfect distribution', () => {
      const requested: LocationPercentage[] = [
        { locationId: 'loc_1', percentage: 60 },
        { locationId: 'loc_2', percentage: 40 }
      ];

      const actual = {
        distributions: [
          { locationId: 'loc_1', allocatedQuantity: 50, percentage: 50 }, // 10% off
          { locationId: 'loc_2', allocatedQuantity: 50, percentage: 50 }  // 10% off
        ],
        totalDistributed: 100,
        remainingQuantity: 0,
        distributionAccuracy: 90
      };

      const accuracy = allocationEngine.validateDistributionAccuracy(requested, actual);

      expect(accuracy).toBe(90); // 100 - 10 average deviation
    });

    it('should return zero for empty distributions', () => {
      const requested: LocationPercentage[] = [];
      const actual = {
        distributions: [],
        totalDistributed: 0,
        remainingQuantity: 0,
        distributionAccuracy: 0
      };

      const accuracy = allocationEngine.validateDistributionAccuracy(requested, actual);

      expect(accuracy).toBe(0);
    });
  });
});