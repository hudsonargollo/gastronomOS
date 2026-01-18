import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { 
  TransferServiceImpl, 
  CreateTransferRequest, 
  ReceivingData,
  TransferStatusType,
  TransferPriorityType 
} from './transfer';
import { 
  Transfer, 
  TransferStatus, 
  TransferPriority,
  TransferAuditAction,
  User,
  Location,
  Product
} from '../db/schema';

// Mock the database schema imports
vi.mock('../db/schema', () => ({
  transfers: {
    id: 'id',
    tenantId: 'tenantId',
    productId: 'productId',
    sourceLocationId: 'sourceLocationId',
    destinationLocationId: 'destinationLocationId',
    quantityRequested: 'quantityRequested',
    quantityShipped: 'quantityShipped',
    quantityReceived: 'quantityReceived',
    status: 'status',
    priority: 'priority',
    requestedBy: 'requestedBy',
    approvedBy: 'approvedBy',
    approvedAt: 'approvedAt',
    shippedBy: 'shippedBy',
    shippedAt: 'shippedAt',
    receivedBy: 'receivedBy',
    receivedAt: 'receivedAt',
    cancelledBy: 'cancelledBy',
    cancelledAt: 'cancelledAt',
    cancellationReason: 'cancellationReason',
    varianceReason: 'varianceReason',
    notes: 'notes',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
  transferAuditLog: {
    id: 'id',
    tenantId: 'tenantId',
    transferId: 'transferId',
    action: 'action',
    oldStatus: 'oldStatus',
    newStatus: 'newStatus',
    oldValues: 'oldValues',
    newValues: 'newValues',
    performedBy: 'performedBy',
    performedAt: 'performedAt',
    notes: 'notes',
    ipAddress: 'ipAddress',
    userAgent: 'userAgent',
  },
  locations: {
    id: 'id',
    tenantId: 'tenantId',
    name: 'name',
    type: 'type',
    address: 'address',
    createdAt: 'createdAt',
  },
  users: {
    id: 'id',
    tenantId: 'tenantId',
    email: 'email',
    passwordHash: 'passwordHash',
    role: 'role',
    locationId: 'locationId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
  products: {
    id: 'id',
    tenantId: 'tenantId',
    name: 'name',
    description: 'description',
    category: 'category',
    unit: 'unit',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
  TransferStatus: {
    REQUESTED: 'REQUESTED',
    APPROVED: 'APPROVED',
    SHIPPED: 'SHIPPED',
    RECEIVED: 'RECEIVED',
    CANCELLED: 'CANCELLED',
  },
  TransferPriority: {
    NORMAL: 'NORMAL',
    HIGH: 'HIGH',
    EMERGENCY: 'EMERGENCY',
  },
  TransferAuditAction: {
    CREATED: 'CREATED',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    SHIPPED: 'SHIPPED',
    RECEIVED: 'RECEIVED',
    CANCELLED: 'CANCELLED',
  },
}));

// Mock utility functions
vi.mock('../utils', () => ({
  generateId: vi.fn(() => '123456789'),
  getCurrentTimestamp: vi.fn(() => 1640995200000), // Fixed timestamp for testing
}));

// Mock dynamic imports
vi.mock('./inventory-integration', () => ({
  createInventoryIntegrationService: vi.fn(() => ({
    executeTransferReceipt: vi.fn().mockResolvedValue({
      transactionId: 'txn_123',
      operations: [{ operationType: 'INCREMENT_ON_HAND' }],
      timestamp: new Date(),
      rollbackable: true,
    }),
    releaseInventoryReservation: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('./variance-reporting', () => ({
  createVarianceReportingService: vi.fn(() => ({
    triggerVarianceAlert: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock database
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
} as unknown as DrizzleD1Database;

describe('TransferService - Cancellation Logic', () => {
  let service: TransferServiceImpl;
  let mockTransfer: Transfer;
  let mockUser: User;
  let mockLocation: Location;
  let mockProduct: Product;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TransferServiceImpl(mockDb);
    
    mockUser = {
      id: 'user_123',
      tenantId: 'tenant_123',
      email: 'test@example.com',
      passwordHash: 'hash',
      role: 'MANAGER',
      locationId: 'location_source',
      createdAt: 1640995200000,
      updatedAt: 1640995200000,
    };

    mockLocation = {
      id: 'location_source',
      tenantId: 'tenant_123',
      name: 'Source Location',
      type: 'RESTAURANT',
      address: '123 Main St',
      createdAt: 1640995200000,
    };

    mockProduct = {
      id: 'product_123',
      tenantId: 'tenant_123',
      name: 'Test Product',
      description: 'A test product',
      category: 'Food',
      unit: 'EACH',
      createdAt: 1640995200000,
      updatedAt: 1640995200000,
    };

    mockTransfer = {
      id: 'transfer_123',
      tenantId: 'tenant_123',
      productId: 'product_123',
      sourceLocationId: 'location_source',
      destinationLocationId: 'location_dest',
      quantityRequested: 100,
      quantityShipped: 0,
      quantityReceived: 0,
      status: 'REQUESTED',
      priority: 'NORMAL',
      requestedBy: 'user_123',
      approvedBy: null,
      approvedAt: null,
      shippedBy: null,
      shippedAt: null,
      receivedBy: null,
      receivedAt: null,
      cancelledBy: null,
      cancelledAt: null,
      cancellationReason: null,
      varianceReason: null,
      notes: null,
      createdAt: 1640995200000,
      updatedAt: 1640995200000,
    };
  });

  describe('cancelTransfer', () => {
    beforeEach(() => {
      // Mock database queries for validation - create proper chain
      const mockSelectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser])
          })
        })
      };
      
      vi.mocked(mockDb.select).mockReturnValue(mockSelectChain as any);

      // Mock update operation - return dynamic values based on input
      const mockUpdateChain = {
        set: vi.fn().mockImplementation((updateData) => ({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{
              ...mockTransfer,
              ...updateData, // Use the actual update data
            }])
          })
        }))
      };
      
      vi.mocked(mockDb.update).mockReturnValue(mockUpdateChain as any);

      // Mock insert operation for audit log
      const mockInsertChain = {
        values: vi.fn().mockResolvedValue(undefined)
      };
      
      vi.mocked(mockDb.insert).mockReturnValue(mockInsertChain as any);
    });

    it('should successfully cancel a REQUESTED transfer', async () => {
      // Arrange
      const transferId = 'transfer_123';
      const cancellerId = 'user_123';
      const reason = 'No longer needed';

      // Mock getTransfer to return the transfer
      const getTransferSpy = vi.spyOn(service, 'getTransfer').mockResolvedValue(mockTransfer);

      // Act
      const result = await service.cancelTransfer(transferId, cancellerId, reason);

      // Assert
      expect(getTransferSpy).toHaveBeenCalledWith(transferId, '');
      expect(result.status).toBe('CANCELLED');
      expect(result.cancelledBy).toBe(cancellerId);
      expect(result.cancellationReason).toBe(reason);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled(); // Audit log
    });

    it('should successfully cancel an APPROVED transfer with inventory restoration', async () => {
      // Arrange
      const approvedTransfer = {
        ...mockTransfer,
        status: 'APPROVED' as TransferStatusType,
        approvedBy: 'user_456',
        approvedAt: 1640995200000,
      };
      
      const transferId = 'transfer_123';
      const cancellerId = 'user_123';
      const reason = 'Changed requirements';

      // Mock getTransfer to return approved transfer
      const getTransferSpy = vi.spyOn(service, 'getTransfer').mockResolvedValue(approvedTransfer);

      // Act
      const result = await service.cancelTransfer(transferId, cancellerId, reason);

      // Assert
      expect(getTransferSpy).toHaveBeenCalledWith(transferId, '');
      expect(result.status).toBe('CANCELLED');
      expect(result.cancelledBy).toBe(cancellerId);
      expect(result.cancellationReason).toBe(reason);
    });

    it('should throw error when transfer is not found', async () => {
      // Arrange
      const transferId = 'nonexistent_transfer';
      const cancellerId = 'user_123';
      const reason = 'Test reason';

      // Mock getTransfer to return null
      const getTransferSpy = vi.spyOn(service, 'getTransfer').mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.cancelTransfer(transferId, cancellerId, reason)
      ).rejects.toThrow('Transfer not found');

      expect(getTransferSpy).toHaveBeenCalledWith(transferId, '');
    });

    it('should throw error when trying to cancel SHIPPED transfer', async () => {
      // Arrange
      const shippedTransfer = {
        ...mockTransfer,
        status: 'SHIPPED' as TransferStatusType,
        shippedBy: 'user_456',
        shippedAt: 1640995200000,
        quantityShipped: 100,
      };
      
      const transferId = 'transfer_123';
      const cancellerId = 'user_123';
      const reason = 'Test reason';

      // Mock getTransfer to return shipped transfer
      const getTransferSpy = vi.spyOn(service, 'getTransfer').mockResolvedValue(shippedTransfer);

      // Act & Assert
      await expect(
        service.cancelTransfer(transferId, cancellerId, reason)
      ).rejects.toThrow('Cannot cancel transfer in SHIPPED status. Only REQUESTED or APPROVED transfers can be cancelled.');

      expect(getTransferSpy).toHaveBeenCalledWith(transferId, '');
    });

    it('should throw error when trying to cancel RECEIVED transfer', async () => {
      // Arrange
      const receivedTransfer = {
        ...mockTransfer,
        status: 'RECEIVED' as TransferStatusType,
        receivedBy: 'user_456',
        receivedAt: 1640995200000,
        quantityReceived: 95,
      };
      
      const transferId = 'transfer_123';
      const cancellerId = 'user_123';
      const reason = 'Test reason';

      // Mock getTransfer to return received transfer
      const getTransferSpy = vi.spyOn(service, 'getTransfer').mockResolvedValue(receivedTransfer);

      // Act & Assert
      await expect(
        service.cancelTransfer(transferId, cancellerId, reason)
      ).rejects.toThrow('Cannot cancel transfer in RECEIVED status. Only REQUESTED or APPROVED transfers can be cancelled.');

      expect(getTransferSpy).toHaveBeenCalledWith(transferId, '');
    });

    it('should throw error when trying to cancel already CANCELLED transfer', async () => {
      // Arrange
      const cancelledTransfer = {
        ...mockTransfer,
        status: 'CANCELLED' as TransferStatusType,
        cancelledBy: 'user_456',
        cancelledAt: 1640995200000,
        cancellationReason: 'Already cancelled',
      };
      
      const transferId = 'transfer_123';
      const cancellerId = 'user_123';
      const reason = 'Test reason';

      // Mock getTransfer to return cancelled transfer
      const getTransferSpy = vi.spyOn(service, 'getTransfer').mockResolvedValue(cancelledTransfer);

      // Act & Assert
      await expect(
        service.cancelTransfer(transferId, cancellerId, reason)
      ).rejects.toThrow('Cannot cancel transfer in CANCELLED status. Only REQUESTED or APPROVED transfers can be cancelled.');

      expect(getTransferSpy).toHaveBeenCalledWith(transferId, '');
    });

    it('should throw error when required parameters are missing', async () => {
      // Test missing transferId
      await expect(
        service.cancelTransfer('', 'user_123', 'reason')
      ).rejects.toThrow('Transfer ID, canceller ID, and reason are required');

      // Test missing cancellerId
      await expect(
        service.cancelTransfer('transfer_123', '', 'reason')
      ).rejects.toThrow('Transfer ID, canceller ID, and reason are required');

      // Test missing reason
      await expect(
        service.cancelTransfer('transfer_123', 'user_123', '')
      ).rejects.toThrow('Transfer ID, canceller ID, and reason are required');
    });

    it('should handle inventory restoration failure gracefully', async () => {
      // Arrange
      const approvedTransfer = {
        ...mockTransfer,
        status: 'APPROVED' as TransferStatusType,
        approvedBy: 'user_456',
        approvedAt: 1640995200000,
      };
      
      const transferId = 'transfer_123';
      const cancellerId = 'user_123';
      const reason = 'Test cancellation with inventory failure';

      // Mock getTransfer to return approved transfer
      const getTransferSpy = vi.spyOn(service, 'getTransfer').mockResolvedValue(approvedTransfer);

      // Mock inventory service to throw error
      const { createInventoryIntegrationService } = await import('./inventory-integration');
      const mockInventoryService = {
        releaseInventoryReservation: vi.fn().mockRejectedValue(new Error('Inventory service error')),
      };
      vi.mocked(createInventoryIntegrationService).mockReturnValue(mockInventoryService as any);

      // Act
      const result = await service.cancelTransfer(transferId, cancellerId, reason);

      // Assert - Should still succeed even if inventory restoration fails
      expect(result.status).toBe('CANCELLED');
      expect(result.cancelledBy).toBe(cancellerId);
      expect(result.cancellationReason).toBe(reason);
    });

    it('should send cancellation notifications', async () => {
      // Arrange
      const transferId = 'transfer_123';
      const cancellerId = 'user_456'; // Different from requester
      const reason = 'Manager decision';

      // Mock getTransfer to return the transfer
      const getTransferSpy = vi.spyOn(service, 'getTransfer').mockResolvedValue(mockTransfer);

      // Mock getLocation calls for notifications
      const getLocationSpy = vi.spyOn(service as any, 'getLocation')
        .mockResolvedValueOnce({ id: 'location_source', name: 'Source Location' })
        .mockResolvedValueOnce({ id: 'location_dest', name: 'Destination Location' });

      // Mock notification methods
      const sendLocationNotificationSpy = vi.spyOn(service as any, 'sendNotificationToLocation').mockResolvedValue(undefined);
      const sendUserNotificationSpy = vi.spyOn(service as any, 'sendNotificationToUser').mockResolvedValue(undefined);

      // Act
      const result = await service.cancelTransfer(transferId, cancellerId, reason);

      // Assert
      expect(result.status).toBe('CANCELLED');
      expect(sendLocationNotificationSpy).toHaveBeenCalledTimes(2); // Source and destination
      expect(sendUserNotificationSpy).toHaveBeenCalledTimes(1); // Original requester (since canceller is different)
    });
  });

  describe('canCancelTransfer', () => {
    it('should return true for REQUESTED status', () => {
      const result = (service as any).canCancelTransfer('REQUESTED');
      expect(result).toBe(true);
    });

    it('should return true for APPROVED status', () => {
      const result = (service as any).canCancelTransfer('APPROVED');
      expect(result).toBe(true);
    });

    it('should return false for SHIPPED status', () => {
      const result = (service as any).canCancelTransfer('SHIPPED');
      expect(result).toBe(false);
    });

    it('should return false for RECEIVED status', () => {
      const result = (service as any).canCancelTransfer('RECEIVED');
      expect(result).toBe(false);
    });

    it('should return false for CANCELLED status', () => {
      const result = (service as any).canCancelTransfer('CANCELLED');
      expect(result).toBe(false);
    });
  });

  describe('validateCancellationAuthorization', () => {
    beforeEach(() => {
      // Mock validateUserAccess to return the user
      vi.spyOn(service as any, 'validateUserAccess').mockResolvedValue(mockUser);
    });

    it('should allow original requester to cancel REQUESTED transfer', async () => {
      const requestedTransfer = {
        ...mockTransfer,
        status: 'REQUESTED' as TransferStatusType,
        requestedBy: 'user_123',
      };

      await expect(
        (service as any).validateCancellationAuthorization(requestedTransfer, 'user_123')
      ).resolves.not.toThrow();
    });

    it('should allow manager to cancel any cancellable transfer', async () => {
      const managerUser = {
        ...mockUser,
        role: 'MANAGER',
      };
      
      vi.spyOn(service as any, 'validateUserAccess').mockResolvedValue(managerUser);

      await expect(
        (service as any).validateCancellationAuthorization(mockTransfer, 'manager_123')
      ).resolves.not.toThrow();
    });

    it('should allow admin to cancel any cancellable transfer', async () => {
      const adminUser = {
        ...mockUser,
        role: 'ADMIN',
      };
      
      vi.spyOn(service as any, 'validateUserAccess').mockResolvedValue(adminUser);

      await expect(
        (service as any).validateCancellationAuthorization(mockTransfer, 'admin_123')
      ).resolves.not.toThrow();
    });

    it('should deny unauthorized user from cancelling transfer', async () => {
      const staffUser = {
        ...mockUser,
        role: 'STAFF',
        locationId: 'different_location',
      };
      
      vi.spyOn(service as any, 'validateUserAccess').mockResolvedValue(staffUser);

      await expect(
        (service as any).validateCancellationAuthorization(mockTransfer, 'staff_123')
      ).rejects.toThrow('Insufficient authorization to cancel transfer');
    });

    it('should allow source location manager to cancel APPROVED transfer', async () => {
      const approvedTransfer = {
        ...mockTransfer,
        status: 'APPROVED' as TransferStatusType,
        sourceLocationId: 'location_source',
      };

      const sourceLocationManager = {
        ...mockUser,
        role: 'STAFF',
        locationId: 'location_source',
      };
      
      vi.spyOn(service as any, 'validateUserAccess').mockResolvedValue(sourceLocationManager);

      await expect(
        (service as any).validateCancellationAuthorization(approvedTransfer, 'manager_123')
      ).resolves.not.toThrow();
    });
  });

  describe('generateCancellationAuditNotes', () => {
    it('should generate notes for REQUESTED transfer cancellation', () => {
      const notes = (service as any).generateCancellationAuditNotes(
        'User changed mind',
        false,
        'REQUESTED'
      );

      expect(notes).toBe('Transfer cancelled from REQUESTED status: User changed mind');
    });

    it('should generate notes for APPROVED transfer cancellation with successful inventory restoration', () => {
      const notes = (service as any).generateCancellationAuditNotes(
        'Business requirements changed',
        true,
        'APPROVED'
      );

      expect(notes).toBe('Transfer cancelled from APPROVED status: Business requirements changed. Inventory reservations released successfully');
    });

    it('should generate notes for APPROVED transfer cancellation with failed inventory restoration', () => {
      const notes = (service as any).generateCancellationAuditNotes(
        'Emergency cancellation',
        false,
        'APPROVED'
      );

      expect(notes).toBe('Transfer cancelled from APPROVED status: Emergency cancellation. Warning: Inventory restoration failed - manual reconciliation may be required');
    });
  });
});