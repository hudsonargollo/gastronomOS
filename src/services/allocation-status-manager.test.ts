/**
 * Allocation Status Manager Tests
 * 
 * Tests for allocation status transitions, propagation, and operation controls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the schema imports before importing the AllocationStatusManager
vi.mock('../db/schema', () => ({
  allocations: {
    id: 'mocked_allocations_id',
    status: 'mocked_status',
    updatedAt: 'mocked_updated_at',
    tenantId: 'mocked_tenant_id',
    quantityAllocated: 'mocked_quantity_allocated'
  },
  allocationAuditLog: {
    id: 'mocked_audit_id',
    tenantId: 'mocked_tenant_id',
    allocationId: 'mocked_allocation_id',
    action: 'mocked_action',
    oldValues: 'mocked_old_values',
    newValues: 'mocked_new_values',
    performedBy: 'mocked_performed_by',
    performedAt: 'mocked_performed_at',
    notes: 'mocked_notes'
  },
  poItems: {
    id: 'mocked_po_items_id',
    poId: 'mocked_po_id'
  },
  purchaseOrders: {
    id: 'mocked_purchase_orders_id'
  },
  AllocationStatus: {
    PENDING: 'PENDING',
    SHIPPED: 'SHIPPED',
    RECEIVED: 'RECEIVED',
    CANCELLED: 'CANCELLED'
  },
  POStatus: {
    DRAFT: 'DRAFT',
    APPROVED: 'APPROVED',
    RECEIVED: 'RECEIVED',
    CANCELLED: 'CANCELLED'
  }
}));

// Mock drizzle-orm functions
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ field, value, type: 'eq' })),
  and: vi.fn((...conditions) => ({ conditions, type: 'and' })),
  inArray: vi.fn((field, values) => ({ field, values, type: 'inArray' }))
}));

// Mock utils
vi.mock('../utils', () => ({
  generateId: vi.fn(() => 'mock_id_123')
}));

import { 
  AllocationStatusManager, 
  type IAllocationStatusManager,
  type AllocationStatusType,
  type AllocationOperation,
  type StatusTransitionResult,
  type BulkStatusTransitionResult,
  type StatusPropagationResult,
  type AllocationStatusValidation,
  type StatusBasedOperationControl
} from './allocation-status-manager';

// Mock database with more robust query chain handling
const createMockDb = () => {
  const mockDb = {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn()
  } as any;

  // Helper to create a complete query chain mock
  const createQueryChain = (result: any) => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(result),
        orderBy: vi.fn().mockResolvedValue(result)
      }),
      leftJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(result)
      })
    })
  });

  const createUpdateChain = () => ({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined)
    })
  });

  const createInsertChain = () => ({
    values: vi.fn().mockResolvedValue(undefined)
  });

  return {
    mockDb,
    createQueryChain,
    createUpdateChain,
    createInsertChain
  };
};

// Mock data
const mockAllocation = {
  id: 'alloc_1',
  tenantId: 'tenant_1',
  poItemId: 'po_item_1',
  targetLocationId: 'loc_1',
  quantityAllocated: 50,
  quantityReceived: 0,
  status: 'PENDING',
  notes: null,
  createdBy: 'user_1',
  createdAt: Date.now(),
  updatedAt: Date.now()
};

const mockAuditLog = {
  id: 'audit_1',
  tenantId: 'tenant_1',
  allocationId: 'alloc_1',
  action: 'STATUS_CHANGED',
  oldValues: '{"status":"PENDING"}',
  newValues: '{"status":"SHIPPED","reason":"PO shipped"}',
  performedBy: 'user_1',
  performedAt: Date.now(),
  notes: 'PO shipped'
};

describe('AllocationStatusManager', () => {
  let statusManager: IAllocationStatusManager;
  let mockDb: any;
  let createQueryChain: any;
  let createUpdateChain: any;
  let createInsertChain: any;

  beforeEach(() => {
    vi.clearAllMocks();
    const dbMocks = createMockDb();
    mockDb = dbMocks.mockDb;
    createQueryChain = dbMocks.createQueryChain;
    createUpdateChain = dbMocks.createUpdateChain;
    createInsertChain = dbMocks.createInsertChain;
    
    statusManager = new AllocationStatusManager(mockDb);
  });

  describe('transitionStatus', () => {
    it('should successfully transition from PENDING to SHIPPED', async () => {
      // Mock allocation query
      mockDb.select.mockReturnValue(createQueryChain([mockAllocation]));
      mockDb.update.mockReturnValue(createUpdateChain());
      mockDb.insert.mockReturnValue(createInsertChain());

      const result = await statusManager.transitionStatus('alloc_1', 'SHIPPED', 'user_1', 'Manual ship');

      expect(result.success).toBe(true);
      expect(result.allocationId).toBe('alloc_1');
      expect(result.fromStatus).toBe('PENDING');
      expect(result.toStatus).toBe('SHIPPED');
      expect(result.errors).toHaveLength(0);
    });

    it('should fail transition for invalid status change', async () => {
      const mockAllocationReceived = { ...mockAllocation, status: 'RECEIVED' };
      
      mockDb.select.mockReturnValue(createQueryChain([mockAllocationReceived]));

      const result = await statusManager.transitionStatus('alloc_1', 'PENDING', 'user_1');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid transition');
    });

    it('should fail for non-existent allocation', async () => {
      mockDb.select.mockReturnValue(createQueryChain([]));

      const result = await statusManager.transitionStatus('non_existent', 'SHIPPED', 'user_1');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Allocation not found');
    });
  });

  describe('bulkTransitionStatus', () => {
    it('should handle bulk status transitions', async () => {
      const mockAllocation1 = { ...mockAllocation, id: 'alloc_1' };
      const mockAllocation2 = { ...mockAllocation, id: 'alloc_2' };

      // Mock successful transitions for both allocations
      mockDb.select
        .mockReturnValueOnce(createQueryChain([mockAllocation1]))  // First allocation
        .mockReturnValueOnce(createQueryChain([mockAllocation1]))  // First audit
        .mockReturnValueOnce(createQueryChain([mockAllocation2]))  // Second allocation
        .mockReturnValueOnce(createQueryChain([mockAllocation2])); // Second audit
      
      mockDb.update.mockReturnValue(createUpdateChain());
      mockDb.insert.mockReturnValue(createInsertChain());

      const result = await statusManager.bulkTransitionStatus(
        ['alloc_1', 'alloc_2'], 
        'SHIPPED', 
        'user_1', 
        'Bulk ship'
      );

      expect(result.success).toBe(true);
      expect(result.summary.totalProcessed).toBe(2);
      expect(result.summary.successCount).toBe(2);
      expect(result.summary.failureCount).toBe(0);
      expect(result.successfulTransitions).toHaveLength(2);
      expect(result.failedTransitions).toHaveLength(0);
    });

    it('should handle partial failures in bulk operations', async () => {
      const mockAllocation1 = { ...mockAllocation, id: 'alloc_1' };
      
      // Mock one successful, one failed
      mockDb.select
        .mockReturnValueOnce(createQueryChain([mockAllocation1]))  // First allocation (success)
        .mockReturnValueOnce(createQueryChain([mockAllocation1]))  // First audit (success)
        .mockReturnValueOnce(createQueryChain([]));                // Second allocation (failure)
      
      mockDb.update.mockReturnValue(createUpdateChain());
      mockDb.insert.mockReturnValue(createInsertChain());

      const result = await statusManager.bulkTransitionStatus(
        ['alloc_1', 'non_existent'], 
        'SHIPPED', 
        'user_1'
      );

      expect(result.success).toBe(false);
      expect(result.summary.totalProcessed).toBe(2);
      expect(result.summary.successCount).toBe(1);
      expect(result.summary.failureCount).toBe(1);
      expect(result.successfulTransitions).toHaveLength(1);
      expect(result.failedTransitions).toHaveLength(1);
    });
  });

  describe('propagateStatusFromPO', () => {
    it('should propagate PO cancellation to allocations', async () => {
      const mockAllocations = [
        { id: 'alloc_1', status: 'PENDING', poItemId: 'po_item_1' },
        { id: 'alloc_2', status: 'SHIPPED', poItemId: 'po_item_2' }
      ];

      const mockAllocation1 = { ...mockAllocation, id: 'alloc_1', status: 'PENDING' };
      const mockAllocation2 = { ...mockAllocation, id: 'alloc_2', status: 'SHIPPED' };

      // Mock allocations query for PO, then individual allocation queries
      mockDb.select
        .mockReturnValueOnce(createQueryChain(mockAllocations))    // PO allocations query
        .mockReturnValueOnce(createQueryChain([mockAllocation1]))  // First allocation
        .mockReturnValueOnce(createQueryChain([mockAllocation1]))  // First audit
        .mockReturnValueOnce(createQueryChain([mockAllocation2]))  // Second allocation
        .mockReturnValueOnce(createQueryChain([mockAllocation2])); // Second audit
      
      mockDb.update.mockReturnValue(createUpdateChain());
      mockDb.insert.mockReturnValue(createInsertChain());

      const result = await statusManager.propagateStatusFromPO('po_1', 'CANCELLED', 'user_1');

      expect(result.poId).toBe('po_1');
      expect(result.affectedAllocations).toHaveLength(2);
      expect(result.statusChanges).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle PO approval without status changes', async () => {
      const mockAllocations = [
        { id: 'alloc_1', status: 'PENDING', poItemId: 'po_item_1' }
      ];

      mockDb.select.mockReturnValue(createQueryChain(mockAllocations));

      const result = await statusManager.propagateStatusFromPO('po_1', 'APPROVED', 'user_1');

      expect(result.poId).toBe('po_1');
      expect(result.affectedAllocations).toHaveLength(0);
      expect(result.statusChanges).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateStatusTransition', () => {
    it('should validate allowed transitions', async () => {
      mockDb.select.mockReturnValue(createQueryChain([mockAllocation]));

      const result = await statusManager.validateStatusTransition('alloc_1', 'SHIPPED');

      expect(result.valid).toBe(true);
      expect(result.currentStatus).toBe('PENDING');
      expect(result.allowedTransitions).toContain('SHIPPED');
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid transitions', async () => {
      const mockReceivedAllocation = { ...mockAllocation, status: 'RECEIVED' };
      
      mockDb.select.mockReturnValue(createQueryChain([mockReceivedAllocation]));

      const result = await statusManager.validateStatusTransition('alloc_1', 'PENDING');

      expect(result.valid).toBe(false);
      expect(result.currentStatus).toBe('RECEIVED');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate business rules for receiving', async () => {
      mockDb.select.mockReturnValue(createQueryChain([mockAllocation]));

      const result = await statusManager.validateStatusTransition('alloc_1', 'RECEIVED');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Allocations can only be received after being shipped');
    });
  });

  describe('checkOperationPermissions', () => {
    it('should allow quantity updates for PENDING allocations', async () => {
      mockDb.select.mockReturnValue(createQueryChain([mockAllocation]));

      const result = await statusManager.checkOperationPermissions('alloc_1', 'UPDATE_QUANTITY');

      expect(result.allowed).toBe(true);
      expect(result.operation).toBe('UPDATE_QUANTITY');
      expect(result.reason).toContain('allowed');
    });

    it('should block quantity updates for SHIPPED allocations', async () => {
      const mockShippedAllocation = { ...mockAllocation, status: 'SHIPPED' };
      
      mockDb.select.mockReturnValue(createQueryChain([mockShippedAllocation]));

      const result = await statusManager.checkOperationPermissions('alloc_1', 'UPDATE_QUANTITY');

      expect(result.allowed).toBe(false);
      expect(result.operation).toBe('UPDATE_QUANTITY');
      expect(result.reason).toContain('not allowed');
    });

    it('should allow receiving for SHIPPED allocations', async () => {
      const mockShippedAllocation = { ...mockAllocation, status: 'SHIPPED' };
      
      mockDb.select.mockReturnValue(createQueryChain([mockShippedAllocation]));

      const result = await statusManager.checkOperationPermissions('alloc_1', 'RECEIVE');

      expect(result.allowed).toBe(true);
      expect(result.operation).toBe('RECEIVE');
    });
  });

  describe('getValidTransitions', () => {
    it('should return correct transitions for PENDING status', () => {
      const transitions = statusManager.getValidTransitions('PENDING');
      
      expect(transitions).toContain('SHIPPED');
      expect(transitions).toContain('CANCELLED');
      expect(transitions).not.toContain('RECEIVED');
    });

    it('should return correct transitions for SHIPPED status', () => {
      const transitions = statusManager.getValidTransitions('SHIPPED');
      
      expect(transitions).toContain('RECEIVED');
      expect(transitions).toContain('CANCELLED');
      expect(transitions).not.toContain('PENDING');
    });

    it('should return empty transitions for terminal states', () => {
      const receivedTransitions = statusManager.getValidTransitions('RECEIVED');
      const cancelledTransitions = statusManager.getValidTransitions('CANCELLED');
      
      expect(receivedTransitions).toHaveLength(0);
      expect(cancelledTransitions).toHaveLength(0);
    });
  });

  describe('getStatusHistory', () => {
    it('should return status history for allocation', async () => {
      const mockAuditLogs = [
        {
          ...mockAuditLog,
          oldValues: '{"status":"PENDING"}',
          newValues: '{"status":"SHIPPED","reason":"Manual ship"}',
          performedAt: Date.now() - 1000
        },
        {
          ...mockAuditLog,
          id: 'audit_2',
          oldValues: '{"status":"SHIPPED"}',
          newValues: '{"status":"RECEIVED","reason":"Delivery confirmed"}',
          performedAt: Date.now()
        }
      ];

      mockDb.select.mockReturnValue(createQueryChain(mockAuditLogs));

      const result = await statusManager.getStatusHistory('alloc_1');

      expect(result).toHaveLength(2);
      expect(result[0]?.fromStatus).toBe('PENDING');
      expect(result[0]?.toStatus).toBe('SHIPPED');
      expect(result[1]?.fromStatus).toBe('SHIPPED');
      expect(result[1]?.toStatus).toBe('RECEIVED');
    });

    it('should handle empty status history', async () => {
      mockDb.select.mockReturnValue(createQueryChain([]));

      const result = await statusManager.getStatusHistory('alloc_1');

      expect(result).toHaveLength(0);
    });
  });
});