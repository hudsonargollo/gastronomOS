import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POStateMachineImpl, TransitionContext } from './po-state-machine';
import { PONumberGenerator, createPONumberGenerator } from './po-number-generator';
import * as fc from 'fast-check';
import { PurchaseOrder } from '../db/schema';

// Mock the schema imports
vi.mock('../db/schema', () => ({
  purchaseOrders: {
    id: 'id',
    tenantId: 'tenant_id',
    poNumber: 'po_number',
  },
  poItems: {
    poId: 'po_id',
  },
  poAuditLog: {},
  PurchaseOrder: {},
  POStatusType: {},
  NewPOAuditLog: {},
}));

// Mock database for testing
const createMockDb = () => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  returning: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn(),
});

// Helper function to create test PO
const createTestPO = (overrides: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
  id: 'po_test_123',
  tenantId: 'tenant_123',
  supplierId: 'supplier_123',
  poNumber: null,
  status: 'DRAFT',
  totalCostCents: 10000,
  createdBy: 'user_123',
  approvedBy: null,
  approvedAt: null,
  receivedBy: null,
  receivedAt: null,
  notes: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

// Helper function to create test context
const createTestContext = (overrides: Partial<TransitionContext> = {}): TransitionContext => ({
  userId: 'user_123',
  tenantId: 'tenant_123',
  reason: undefined,
  metadata: undefined,
  ...overrides,
});

describe('POStateMachine', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let mockPONumberGenerator: { generatePONumber: ReturnType<typeof vi.fn> };
  let stateMachine: POStateMachineImpl;

  beforeEach(() => {
    mockDb = createMockDb();
    mockPONumberGenerator = {
      generatePONumber: vi.fn().mockResolvedValue('PO-2024-0001'),
    };
    stateMachine = new POStateMachineImpl(mockDb as any, mockPONumberGenerator as any);
  });

  describe('canTransition', () => {
    it('should allow valid transitions from DRAFT', () => {
      expect(stateMachine.canTransition('DRAFT', 'APPROVED')).toBe(true);
      expect(stateMachine.canTransition('DRAFT', 'CANCELLED')).toBe(true);
      expect(stateMachine.canTransition('DRAFT', 'RECEIVED')).toBe(false);
    });

    it('should allow valid transitions from APPROVED', () => {
      expect(stateMachine.canTransition('APPROVED', 'RECEIVED')).toBe(true);
      expect(stateMachine.canTransition('APPROVED', 'CANCELLED')).toBe(true);
      expect(stateMachine.canTransition('APPROVED', 'DRAFT')).toBe(false);
    });

    it('should not allow transitions from terminal states', () => {
      expect(stateMachine.canTransition('RECEIVED', 'CANCELLED')).toBe(false);
      expect(stateMachine.canTransition('CANCELLED', 'APPROVED')).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('should reject invalid transitions', async () => {
      const po = createTestPO({ status: 'DRAFT' });
      const context = createTestContext();

      const result = await stateMachine.validateTransition(po, 'RECEIVED', context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot transition from DRAFT to RECEIVED');
    });

    it('should reject transitions for wrong tenant', async () => {
      const po = createTestPO({ tenantId: 'tenant_123' });
      const context = createTestContext({ tenantId: 'tenant_456' });

      const result = await stateMachine.validateTransition(po, 'APPROVED', context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Purchase order does not belong to the specified tenant');
    });

    it('should validate approval transition requirements', async () => {
      const po = createTestPO({ status: 'DRAFT', totalCostCents: 0 });
      const context = createTestContext();

      // Mock no line items
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(mockSelect);

      const result = await stateMachine.validateTransition(po, 'APPROVED', context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot approve purchase order without line items');
    });

    it('should validate line item quantities and prices for approval', async () => {
      const po = createTestPO({ status: 'DRAFT', totalCostCents: 10000 });
      const context = createTestContext();

      // Mock line items with invalid data
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: 'item_1', quantityOrdered: 0, unitPriceCents: 1000 },
          { id: 'item_2', quantityOrdered: 5, unitPriceCents: -100 },
        ]),
      };
      mockDb.select.mockReturnValue(mockSelect);

      const result = await stateMachine.validateTransition(po, 'APPROVED', context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Line item item_1 has invalid quantity: 0');
      expect(result.errors).toContain('Line item item_2 has invalid unit price: -100');
    });

    it('should validate receiving transition requirements', async () => {
      const po = createTestPO({ status: 'DRAFT' });
      const context = createTestContext();

      const result = await stateMachine.validateTransition(po, 'RECEIVED', context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot transition from DRAFT to RECEIVED');
    });

    it('should require PO number for receiving', async () => {
      const po = createTestPO({ status: 'APPROVED', poNumber: null });
      const context = createTestContext();

      const result = await stateMachine.validateTransition(po, 'RECEIVED', context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Purchase order must have a PO number to be received');
    });

    it('should require reason for cancelling approved PO', async () => {
      const po = createTestPO({ status: 'APPROVED' });
      const context = createTestContext({ reason: undefined });

      const result = await stateMachine.validateTransition(po, 'CANCELLED', context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Reason is required when cancelling an approved purchase order');
    });

    it('should allow cancelling approved PO with reason', async () => {
      const po = createTestPO({ status: 'APPROVED' });
      const context = createTestContext({ reason: 'Supplier unavailable' });

      const result = await stateMachine.validateTransition(po, 'CANCELLED', context);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('executeTransition', () => {
    it('should execute DRAFT to APPROVED transition', async () => {
      const po = createTestPO({ status: 'DRAFT', totalCostCents: 10000 });
      const context = createTestContext();
      const updatedPO = { ...po, status: 'APPROVED', poNumber: 'PO-2024-0001', approvedBy: 'user_123', approvedAt: Date.now() };

      // Mock validation success
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: 'item_1', quantityOrdered: 5, unitPriceCents: 1000 },
        ]),
      };
      mockDb.select.mockReturnValue(mockSelect);

      // Mock database update
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([updatedPO]),
      };
      mockDb.update.mockReturnValue(mockUpdate);

      // Mock audit log insert
      const mockInsert = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.insert.mockReturnValue(mockInsert);

      const result = await stateMachine.executeTransition(po, 'APPROVED', context);

      expect(result.status).toBe('APPROVED');
      expect(result.poNumber).toBe('PO-2024-0001');
      expect(result.approvedBy).toBe('user_123');
      expect(mockPONumberGenerator.generatePONumber).toHaveBeenCalledWith('tenant_123');
    });

    it('should execute APPROVED to RECEIVED transition', async () => {
      const po = createTestPO({ status: 'APPROVED', poNumber: 'PO-2024-0001' });
      const context = createTestContext();
      const updatedPO = { ...po, status: 'RECEIVED', receivedBy: 'user_123', receivedAt: Date.now() };

      // Mock database update
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([updatedPO]),
      };
      mockDb.update.mockReturnValue(mockUpdate);

      // Mock audit log insert
      const mockInsert = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.insert.mockReturnValue(mockInsert);

      const result = await stateMachine.executeTransition(po, 'RECEIVED', context);

      expect(result.status).toBe('RECEIVED');
      expect(result.receivedBy).toBe('user_123');
      expect(result.receivedAt).toBeDefined();
    });

    it('should execute DRAFT to CANCELLED transition', async () => {
      const po = createTestPO({ status: 'DRAFT' });
      const context = createTestContext({ reason: 'No longer needed' });
      const updatedPO = { ...po, status: 'CANCELLED' };

      // Mock database update
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([updatedPO]),
      };
      mockDb.update.mockReturnValue(mockUpdate);

      // Mock audit log insert
      const mockInsert = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.insert.mockReturnValue(mockInsert);

      const result = await stateMachine.executeTransition(po, 'CANCELLED', context);

      expect(result.status).toBe('CANCELLED');
    });

    it('should throw error if validation fails', async () => {
      const po = createTestPO({ status: 'RECEIVED' });
      const context = createTestContext();

      await expect(
        stateMachine.executeTransition(po, 'CANCELLED', context)
      ).rejects.toThrow('Transition validation failed');
    });

    it('should throw error if database update fails', async () => {
      const po = createTestPO({ status: 'DRAFT', totalCostCents: 10000 });
      const context = createTestContext();

      // Mock validation success
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: 'item_1', quantityOrdered: 5, unitPriceCents: 1000 },
        ]),
      };
      mockDb.select.mockReturnValue(mockSelect);

      // Mock database update failure
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]), // No rows returned
      };
      mockDb.update.mockReturnValue(mockUpdate);

      await expect(
        stateMachine.executeTransition(po, 'APPROVED', context)
      ).rejects.toThrow('Failed to update purchase order status');
    });

    it('should log audit trail for state transitions', async () => {
      const po = createTestPO({ status: 'DRAFT', totalCostCents: 10000 });
      const context = createTestContext({ reason: 'Ready for approval' });
      const updatedPO = { ...po, status: 'APPROVED', poNumber: 'PO-2024-0001' };

      // Mock validation success
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: 'item_1', quantityOrdered: 5, unitPriceCents: 1000 },
        ]),
      };
      mockDb.select.mockReturnValue(mockSelect);

      // Mock database update
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([updatedPO]),
      };
      mockDb.update.mockReturnValue(mockUpdate);

      // Mock audit log insert
      const mockInsert = vi.fn().mockResolvedValue(undefined);
      const mockInsertChain = {
        values: mockInsert,
      };
      mockDb.insert.mockReturnValue(mockInsertChain);

      await stateMachine.executeTransition(po, 'APPROVED', context);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant_123',
          poId: 'po_test_123',
          action: 'APPROVED',
          performedBy: 'user_123',
          notes: 'Ready for approval',
        })
      );
    });
  });

  // Feature: centralized-purchasing, Property 3: State Machine Consistency
  // **Validates: Requirements 2.4, 2.5**
  describe('Property 3: State Machine Consistency', () => {
    it('should maintain state transition invariants for all valid state combinations', () => {
      fc.assert(fc.property(
        fc.constantFrom('DRAFT', 'APPROVED', 'RECEIVED', 'CANCELLED'),
        fc.constantFrom('DRAFT', 'APPROVED', 'RECEIVED', 'CANCELLED'),
        (fromState, toState) => {
          const canTransition = stateMachine.canTransition(fromState as any, toState as any);
          
          // Define expected valid transitions
          const validTransitions = {
            'DRAFT': ['APPROVED', 'CANCELLED'],
            'APPROVED': ['RECEIVED', 'CANCELLED'],
            'RECEIVED': [], // Terminal state
            'CANCELLED': [], // Terminal state
          };
          
          const expectedValid = validTransitions[fromState]?.includes(toState) || false;
          
          // The state machine should consistently return the same result for the same inputs
          expect(canTransition).toBe(expectedValid);
          
          // Verify idempotence - calling canTransition multiple times should return same result
          expect(stateMachine.canTransition(fromState as any, toState as any)).toBe(canTransition);
          expect(stateMachine.canTransition(fromState as any, toState as any)).toBe(canTransition);
        }
      ), { numRuns: 100 });
    });

    it('should ensure terminal states have no valid outgoing transitions', () => {
      fc.assert(fc.property(
        fc.constantFrom('RECEIVED', 'CANCELLED'),
        fc.constantFrom('DRAFT', 'APPROVED', 'RECEIVED', 'CANCELLED'),
        (terminalState, targetState) => {
          // Terminal states should never allow transitions to any other state
          const canTransition = stateMachine.canTransition(terminalState as any, targetState as any);
          expect(canTransition).toBe(false);
        }
      ), { numRuns: 100 });
    });

    it('should ensure non-terminal states have at least one valid outgoing transition', () => {
      fc.assert(fc.property(
        fc.constantFrom('DRAFT', 'APPROVED'),
        (nonTerminalState) => {
          const allStates = ['DRAFT', 'APPROVED', 'RECEIVED', 'CANCELLED'];
          
          // Non-terminal states should have at least one valid outgoing transition
          const hasValidTransition = allStates.some(targetState => 
            stateMachine.canTransition(nonTerminalState as any, targetState as any)
          );
          
          expect(hasValidTransition).toBe(true);
        }
      ), { numRuns: 100 });
    });
  });

  describe('PONumberGenerator Integration', () => {
    let mockDb: ReturnType<typeof createMockDb>;
    let generator: PONumberGenerator;

    beforeEach(() => {
      mockDb = createMockDb();
      generator = createPONumberGenerator(mockDb as any);
    });

    it('should create a PO number generator instance', () => {
      expect(generator).toBeDefined();
    });

    it('should generate PO numbers through state machine', async () => {
      // Mock empty database for PO number generation
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
        orderBy: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(mockSelect);

      const poNumber = await generator.generatePONumber('tenant_123');
      const currentYear = new Date().getFullYear();
      
      expect(poNumber).toBe(`PO-${currentYear}-0001`);
    });

    it('should validate PO number uniqueness', async () => {
      // Mock empty database (no existing PO)
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(mockSelect);

      const isValid = await generator.validatePONumber('PO-2024-0001', 'tenant_123');
      expect(isValid).toBe(true);
    });
  });
});