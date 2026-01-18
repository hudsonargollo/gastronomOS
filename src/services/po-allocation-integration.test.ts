/**
 * PO Allocation Integration Service Tests
 * 
 * Tests for the purchase order allocation integration service.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { 
  createPOAllocationIntegrationService, 
  POAllocationIntegrationService,
  AutoAllocationRequest 
} from './po-allocation-integration';
import { 
  purchaseOrders, 
  poItems, 
  allocations, 
  locations, 
  users, 
  products,
  suppliers,
  tenants,
  POStatus,
  AllocationStatus
} from '../db/schema';
import { generateId, getCurrentTimestamp } from '../utils';

// Mock D1 database
function createMockDb() {
  const mockDb = {
    select: () => mockDb,
    from: () => mockDb,
    where: () => mockDb,
    innerJoin: () => mockDb,
    leftJoin: () => mockDb,
    limit: () => mockDb,
    offset: () => mockDb,
    orderBy: () => mockDb,
    insert: () => mockDb,
    values: () => mockDb,
    returning: () => mockDb,
    update: () => mockDb,
    set: () => mockDb,
    delete: () => mockDb,
    execute: () => Promise.resolve([]),
  };
  return mockDb as any;
}

describe('POAllocationIntegrationService', () => {
  let service: POAllocationIntegrationService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = createPOAllocationIntegrationService(mockDb);
  });

  describe('Service Creation', () => {
    it('should create service instance', () => {
      expect(service).toBeDefined();
      expect(typeof service.getPOAllocationSummary).toBe('function');
      expect(typeof service.handlePOStatusChange).toBe('function');
      expect(typeof service.cleanupAllocationsOnPOModification).toBe('function');
      expect(typeof service.autoAllocatePO).toBe('function');
      expect(typeof service.validatePOForAllocation).toBe('function');
      expect(typeof service.syncAllocationStatusWithPO).toBe('function');
      expect(typeof service.getUnallocatedPOItems).toBe('function');
    });
  });

  describe('getPOAllocationSummary', () => {
    it('should require PO ID and tenant ID', async () => {
      await expect(service.getPOAllocationSummary('', 'tenant_123')).rejects.toThrow('PO ID and tenant ID are required');
      await expect(service.getPOAllocationSummary('po_123', '')).rejects.toThrow('PO ID and tenant ID are required');
    });

    it('should handle PO not found', async () => {
      // Mock empty result for PO query
      mockDb.execute = () => Promise.resolve([]);
      
      await expect(service.getPOAllocationSummary('po_123', 'tenant_123')).rejects.toThrow('Purchase order not found');
    });

    it('should calculate allocation summary correctly', async () => {
      const mockPO = {
        id: 'po_123',
        tenantId: 'tenant_123',
        poNumber: 'PO-001',
        status: POStatus.APPROVED
      };

      const mockPOItems = [
        { id: 'poi_1', poId: 'po_123', quantityOrdered: 100 },
        { id: 'poi_2', poId: 'po_123', quantityOrdered: 200 }
      ];

      const mockAllocations = [
        { 
          allocation: { 
            id: 'alloc_1', 
            poItemId: 'poi_1', 
            targetLocationId: 'loc_1', 
            quantityAllocated: 50, 
            status: AllocationStatus.PENDING,
            tenantId: 'tenant_123'
          },
          poItem: mockPOItems[0]
        }
      ];

      let queryCount = 0;
      mockDb.execute = () => {
        queryCount++;
        if (queryCount === 1) return Promise.resolve([mockPO]); // PO query
        if (queryCount === 2) return Promise.resolve(mockPOItems); // PO items query
        if (queryCount === 3) return Promise.resolve(mockAllocations); // Allocations query
        return Promise.resolve([]);
      };

      const summary = await service.getPOAllocationSummary('po_123', 'tenant_123');

      expect(summary).toEqual({
        poId: 'po_123',
        poNumber: 'PO-001',
        poStatus: POStatus.APPROVED,
        totalLineItems: 2,
        totalAllocatedItems: 1,
        totalUnallocatedItems: 1,
        allocationsByStatus: {
          [AllocationStatus.PENDING]: 1,
          [AllocationStatus.SHIPPED]: 0,
          [AllocationStatus.RECEIVED]: 0,
          [AllocationStatus.CANCELLED]: 0
        },
        allocationCompleteness: 50
      });
    });
  });

  describe('validatePOForAllocation', () => {
    it('should validate PO exists and is approved', async () => {
      const mockPO = {
        id: 'po_123',
        tenantId: 'tenant_123',
        status: POStatus.APPROVED
      };

      const mockPOItems = [
        { id: 'poi_1', poId: 'po_123', quantityOrdered: 100 }
      ];

      let queryCount = 0;
      mockDb.execute = () => {
        queryCount++;
        if (queryCount === 1) return Promise.resolve([mockPO]); // PO query
        if (queryCount === 2) return Promise.resolve(mockPOItems); // PO items query
        return Promise.resolve([]);
      };

      const validation = await service.validatePOForAllocation('po_123', 'tenant_123');

      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should reject non-approved PO', async () => {
      const mockPO = {
        id: 'po_123',
        tenantId: 'tenant_123',
        status: POStatus.DRAFT
      };

      mockDb.execute = () => Promise.resolve([mockPO]);

      const validation = await service.validatePOForAllocation('po_123', 'tenant_123');

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Purchase order must be approved for allocation. Current status: DRAFT');
    });

    it('should reject PO with no line items', async () => {
      const mockPO = {
        id: 'po_123',
        tenantId: 'tenant_123',
        status: POStatus.APPROVED
      };

      let queryCount = 0;
      mockDb.execute = () => {
        queryCount++;
        if (queryCount === 1) return Promise.resolve([mockPO]); // PO query
        if (queryCount === 2) return Promise.resolve([]); // Empty PO items query
        return Promise.resolve([]);
      };

      const validation = await service.validatePOForAllocation('po_123', 'tenant_123');

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Purchase order has no line items to allocate');
    });
  });

  describe('getUnallocatedPOItems', () => {
    it('should calculate unallocated quantities correctly', async () => {
      const mockPOItems = [
        { id: 'poi_1', poId: 'po_123', quantityOrdered: 100 },
        { id: 'poi_2', poId: 'po_123', quantityOrdered: 200 }
      ];

      let queryCount = 0;
      mockDb.execute = () => {
        queryCount++;
        if (queryCount === 1) return Promise.resolve(mockPOItems); // PO items query
        if (queryCount === 2) return Promise.resolve([{ totalAllocated: 30 }]); // Allocation sum for poi_1
        if (queryCount === 3) return Promise.resolve([{ totalAllocated: 0 }]); // Allocation sum for poi_2
        return Promise.resolve([]);
      };

      const unallocatedItems = await service.getUnallocatedPOItems('po_123', 'tenant_123');

      expect(unallocatedItems).toHaveLength(2);
      expect(unallocatedItems[0]).toEqual({
        ...mockPOItems[0],
        unallocatedQuantity: 70
      });
      expect(unallocatedItems[1]).toEqual({
        ...mockPOItems[1],
        unallocatedQuantity: 200
      });
    });

    it('should exclude fully allocated items', async () => {
      const mockPOItems = [
        { id: 'poi_1', poId: 'po_123', quantityOrdered: 100 },
        { id: 'poi_2', poId: 'po_123', quantityOrdered: 200 }
      ];

      let queryCount = 0;
      mockDb.execute = () => {
        queryCount++;
        if (queryCount === 1) return Promise.resolve(mockPOItems); // PO items query
        if (queryCount === 2) return Promise.resolve([{ totalAllocated: 100 }]); // Fully allocated poi_1
        if (queryCount === 3) return Promise.resolve([{ totalAllocated: 50 }]); // Partially allocated poi_2
        return Promise.resolve([]);
      };

      const unallocatedItems = await service.getUnallocatedPOItems('po_123', 'tenant_123');

      expect(unallocatedItems).toHaveLength(1);
      expect(unallocatedItems[0]).toEqual({
        ...mockPOItems[1],
        unallocatedQuantity: 150
      });
    });
  });

  describe('autoAllocatePO', () => {
    it('should validate request parameters', async () => {
      const invalidRequest: AutoAllocationRequest = {
        poId: 'po_123',
        strategy: 'EQUAL_DISTRIBUTION',
        parameters: {} // Missing locationIds
      };

      // Mock validation to pass
      mockDb.execute = () => Promise.resolve([
        { id: 'po_123', status: POStatus.APPROVED },
        [{ id: 'poi_1', quantityOrdered: 100 }]
      ]);

      const result = await service.autoAllocatePO(invalidRequest, 'tenant_123', 'user_123');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No locations specified for equal distribution');
    });

    it('should handle percentage-based allocation validation', async () => {
      const invalidRequest: AutoAllocationRequest = {
        poId: 'po_123',
        strategy: 'PERCENTAGE_BASED',
        parameters: {
          locationPercentages: {
            'loc_1': 60,
            'loc_2': 50 // Total > 100%
          }
        }
      };

      // Mock validation to pass
      mockDb.execute = () => Promise.resolve([
        { id: 'po_123', status: POStatus.APPROVED },
        [{ id: 'poi_1', quantityOrdered: 100 }]
      ]);

      const result = await service.autoAllocatePO(invalidRequest, 'tenant_123', 'user_123');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Total percentages (110%) exceed 100%');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.execute = () => Promise.reject(new Error('Database connection failed'));

      await expect(service.getPOAllocationSummary('po_123', 'tenant_123')).rejects.toThrow('Database connection failed');
    });

    it('should validate required parameters', async () => {
      await expect(service.validatePOForAllocation('', 'tenant_123')).rejects.toThrow();
      await expect(service.getUnallocatedPOItems('', 'tenant_123')).rejects.toThrow();
    });
  });

  describe('Integration Points', () => {
    it('should integrate with allocation service', () => {
      // Test that the service properly initializes allocation service
      expect(service).toBeDefined();
      // The actual integration is tested through the public methods
    });

    it('should integrate with audit service', () => {
      // Test that the service properly initializes audit service
      expect(service).toBeDefined();
      // The actual integration is tested through the public methods
    });
  });
});

describe('Factory Function', () => {
  it('should create service instance', () => {
    const mockDb = createMockDb();
    const service = createPOAllocationIntegrationService(mockDb);
    
    expect(service).toBeDefined();
    expect(typeof service.getPOAllocationSummary).toBe('function');
  });
});