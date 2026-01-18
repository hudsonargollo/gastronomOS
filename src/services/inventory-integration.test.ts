import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { InventoryIntegrationServiceImpl, Transfer } from './inventory-integration';

// Mock the database schema imports
vi.mock('../db/schema', () => ({
  inventoryReservations: {
    productId: 'productId',
    locationId: 'locationId',
    releasedAt: 'releasedAt',
    expiresAt: 'expiresAt',
    id: 'id',
    quantityReserved: 'quantityReserved'
  }
}));

// Mock the database
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
} as unknown as DrizzleD1Database;

describe('InventoryIntegrationService', () => {
  let service: InventoryIntegrationServiceImpl;
  let mockTransfer: Transfer;

  beforeEach(() => {
    service = new InventoryIntegrationServiceImpl(mockDb);
    mockTransfer = {
      id: 'transfer_123',
      tenantId: 'tenant_123',
      productId: 'product_123',
      sourceLocationId: 'location_source',
      destinationLocationId: 'location_dest',
      quantityRequested: 100,
      quantityShipped: 0,
      quantityReceived: 0,
      status: 'APPROVED',
      priority: 'NORMAL',
      requestedBy: 'user_123',
      approvedBy: 'user_456',
      approvedAt: Date.now(),
      shippedBy: null,
      shippedAt: null,
      receivedBy: null,
      receivedAt: null,
      cancelledBy: null,
      cancelledAt: null,
      cancellationReason: null,
      varianceReason: null,
      notes: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  describe('acquireInventoryLock', () => {
    it('should acquire a lock successfully', async () => {
      const lock = await service.acquireInventoryLock(
        'location_123',
        'product_123',
        'user_123',
        10000,
        1
      );

      expect(lock).toBeDefined();
      expect(lock.locationId).toBe('location_123');
      expect(lock.productId).toBe('product_123');
      expect(lock.lockedBy).toBe('user_123');
      expect(lock.priority).toBe(1);
    });

    it('should throw error when trying to acquire already locked inventory', async () => {
      // First lock
      await service.acquireInventoryLock(
        'location_123',
        'product_123',
        'user_123',
        10000,
        1
      );

      // Second lock should fail
      await expect(
        service.acquireInventoryLock(
          'location_123',
          'product_123',
          'user_456',
          1000, // Short timeout
          1
        )
      ).rejects.toThrow('Timeout waiting for inventory lock');
    });
  });

  describe('acquireMultipleInventoryLocks', () => {
    it('should acquire multiple locks in sorted order', async () => {
      const lockRequests = [
        { locationId: 'location_b', productId: 'product_123' },
        { locationId: 'location_a', productId: 'product_123' },
      ];

      const locks = await service.acquireMultipleInventoryLocks(
        lockRequests,
        'user_123',
        10000,
        1
      );

      expect(locks).toHaveLength(2);
      // Should be sorted by key (location_a comes before location_b)
      expect(locks[0].locationId).toBe('location_a');
      expect(locks[1].locationId).toBe('location_b');
    });
  });

  describe('checkInventoryAvailability', () => {
    it('should return availability information', async () => {
      // Mock database response for reservations
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      } as any);

      const availability = await service.checkInventoryAvailability(
        'product_123',
        'location_123'
      );

      expect(availability).toBeDefined();
      expect(availability.currentQuantity).toBe(0); // Default for new record
      expect(availability.availableQuantity).toBe(0);
      expect(availability.reservedQuantity).toBe(0);
      expect(availability.inTransitQuantity).toBe(0);
    });
  });

  describe('detectDeadlocks', () => {
    it('should detect no deadlocks in empty system', async () => {
      const result = await service.detectDeadlocks();
      
      expect(result.hasDeadlock).toBe(false);
      expect(result.cycle).toBeUndefined();
      expect(result.victimLockId).toBeUndefined();
    });
  });

  describe('cleanupExpiredLocks', () => {
    it('should clean up expired locks', async () => {
      // Create a lock that will expire immediately
      const lock = await service.acquireInventoryLock(
        'location_123',
        'product_123',
        'user_123',
        1, // 1ms timeout
        1
      );

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const cleanedCount = await service.cleanupExpiredLocks();
      expect(cleanedCount).toBe(1);
    });
  });

  describe('executeWithIsolation', () => {
    it('should execute operation successfully', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await service.executeWithIsolation(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('deadlock detected'))
        .mockResolvedValue('success');
      
      const result = await service.executeWithIsolation(operation, {
        level: 'READ_COMMITTED',
        lockTimeout: 5000,
        retryAttempts: 2,
        retryDelay: 10
      });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
});