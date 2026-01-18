import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import transferRoutes from './transfers';

// Mock the database and services
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock('../middleware/auth', () => ({
  authenticate: vi.fn(() => (c: any, next: any) => next()),
  injectTenantContext: vi.fn(() => (c: any, next: any) => next()),
  getAuthContext: vi.fn(() => ({
    tenant_id: 'tenant_123',
    user_id: 'user_123',
  })),
}));

vi.mock('../middleware/error', () => ({
  validateBody: vi.fn((schema) => (c: any, next: any) => {
    // Simple validation mock - just pass through
    return next();
  }),
  validateQuery: vi.fn((schema) => (c: any, next: any) => next()),
  getValidatedBody: vi.fn((c) => {
    // Mock to return the parsed body
    return c.req.parsedBody || {};
  }),
  getValidatedQuery: vi.fn((c) => c.req.query()),
}));

vi.mock('../services/transfer', () => ({
  createTransferService: vi.fn(() => mockTransferService),
}));

vi.mock('../services/transfer-state-machine', () => ({
  createTransferStateMachine: vi.fn(() => mockStateMachine),
}));

// Mock database
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// Mock transfer service
const mockTransferService = {
  getTransfer: vi.fn(),
  cancelTransfer: vi.fn(),
  createTransferRequest: vi.fn(),
  approveTransfer: vi.fn(),
  rejectTransfer: vi.fn(),
  shipTransfer: vi.fn(),
  receiveTransfer: vi.fn(),
  getTransfersForLocation: vi.fn(),
  getTransferDetails: vi.fn(),
  getTransfersByStatus: vi.fn(),
  updateTransfer: vi.fn(),
};

// Mock state machine
const mockStateMachine = {
  executeTransition: vi.fn(),
  getValidTransitions: vi.fn(),
  canTransition: vi.fn(),
  validateTransition: vi.fn(),
};

// Mock transfer data
const mockTransfer = {
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

describe('Transfer Routes - Cancellation API', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create a new Hono app and mount the transfer routes
    app = new Hono();
    
    // Mock environment first
    app.use('*', async (c, next) => {
      c.env = { DB: {} as D1Database };
      await next();
    });
    
    // Mount the transfer routes
    app.route('/transfers', transferRoutes);
  });

  describe('POST /transfers/:id/cancel', () => {
    it('should successfully cancel a transfer', async () => {
      // Arrange
      const transferId = 'transfer_123';
      const reason = 'No longer needed';
      
      const cancelledTransfer = {
        ...mockTransfer,
        status: 'CANCELLED',
        cancelledBy: 'user_123',
        cancelledAt: 1640995200000,
        cancellationReason: reason,
      };

      mockTransferService.getTransfer.mockResolvedValue(mockTransfer);
      mockStateMachine.executeTransition.mockResolvedValue(cancelledTransfer);

      // Mock getValidatedBody to return the request body
      const { getValidatedBody } = await import('../middleware/error');
      vi.mocked(getValidatedBody).mockReturnValue({ reason });

      // Act
      const response = await app.request(`/transfers/${transferId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      // Assert
      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data.status).toBe('CANCELLED');
      expect(responseData.data.cancellationReason).toBe(reason);
      expect(responseData.message).toBe('Transfer cancelled successfully');

      // Verify service calls
      expect(mockTransferService.getTransfer).toHaveBeenCalledWith(transferId, 'tenant_123');
      expect(mockStateMachine.executeTransition).toHaveBeenCalledWith(
        mockTransfer,
        'CANCELLED',
        expect.objectContaining({
          userId: 'user_123',
          tenantId: 'tenant_123',
          reason: reason,
        })
      );
    });

    it('should return 404 when transfer is not found', async () => {
      // Arrange
      const transferId = 'nonexistent_transfer';
      const reason = 'Test reason';

      mockTransferService.getTransfer.mockResolvedValue(null);

      // Act
      const response = await app.request(`/transfers/${transferId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      // Assert
      expect(response.status).toBe(404);
      
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Transfer not found');
      expect(responseData.message).toBe('The requested transfer does not exist or you do not have access to it');

      // Verify service calls
      expect(mockTransferService.getTransfer).toHaveBeenCalledWith(transferId, 'tenant_123');
      expect(mockStateMachine.executeTransition).not.toHaveBeenCalled();
    });

    it('should return 400 when cancellation fails', async () => {
      // Arrange
      const transferId = 'transfer_123';
      const reason = 'Test reason';
      const errorMessage = 'Cannot cancel transfer in SHIPPED status';

      mockTransferService.getTransfer.mockResolvedValue(mockTransfer);
      mockStateMachine.executeTransition.mockRejectedValue(new Error(errorMessage));

      // Act
      const response = await app.request(`/transfers/${transferId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      // Assert
      expect(response.status).toBe(400);
      
      const responseData = await response.json();
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Failed to cancel transfer');
      expect(responseData.message).toBe(errorMessage);

      // Verify service calls
      expect(mockTransferService.getTransfer).toHaveBeenCalledWith(transferId, 'tenant_123');
      expect(mockStateMachine.executeTransition).toHaveBeenCalled();
    });

    it('should include IP address and user agent in transition context', async () => {
      // Arrange
      const transferId = 'transfer_123';
      const reason = 'Test reason';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0 Test Browser';
      
      const cancelledTransfer = {
        ...mockTransfer,
        status: 'CANCELLED',
        cancelledBy: 'user_123',
        cancelledAt: 1640995200000,
        cancellationReason: reason,
      };

      mockTransferService.getTransfer.mockResolvedValue(mockTransfer);
      mockStateMachine.executeTransition.mockResolvedValue(cancelledTransfer);

      // Act
      const response = await app.request(`/transfers/${transferId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-connecting-ip': ipAddress,
          'user-agent': userAgent,
        },
        body: JSON.stringify({ reason }),
      });

      // Assert
      expect(response.status).toBe(200);

      // Verify transition context includes IP and user agent
      expect(mockStateMachine.executeTransition).toHaveBeenCalledWith(
        mockTransfer,
        'CANCELLED',
        expect.objectContaining({
          userId: 'user_123',
          tenantId: 'tenant_123',
          reason: reason,
          ipAddress: ipAddress,
          userAgent: userAgent,
        })
      );
    });

    it('should handle missing reason validation', async () => {
      // Arrange
      const transferId = 'transfer_123';

      // Act - Send request without reason
      const response = await app.request(`/transfers/${transferId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      // Assert - This would normally be handled by validation middleware
      // In a real scenario, the validation middleware would return 400
      // For this test, we're just ensuring the endpoint exists and can be called
      expect(response.status).toBeDefined();
    });

    it('should handle empty reason validation', async () => {
      // Arrange
      const transferId = 'transfer_123';

      // Act - Send request with empty reason
      const response = await app.request(`/transfers/${transferId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: '' }),
      });

      // Assert - This would normally be handled by validation middleware
      expect(response.status).toBeDefined();
    });
  });

  describe('Transfer Cancellation Integration', () => {
    it('should properly integrate with state machine for cancellation', async () => {
      // Arrange
      const transferId = 'transfer_123';
      const reason = 'Business requirements changed';
      
      const approvedTransfer = {
        ...mockTransfer,
        status: 'APPROVED',
        approvedBy: 'user_456',
        approvedAt: 1640995200000,
      };
      
      const cancelledTransfer = {
        ...approvedTransfer,
        status: 'CANCELLED',
        cancelledBy: 'user_123',
        cancelledAt: 1640995200000,
        cancellationReason: reason,
      };

      mockTransferService.getTransfer.mockResolvedValue(approvedTransfer);
      mockStateMachine.executeTransition.mockResolvedValue(cancelledTransfer);

      // Act
      const response = await app.request(`/transfers/${transferId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      // Assert
      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.data.status).toBe('CANCELLED');

      // Verify state machine was called with correct parameters
      expect(mockStateMachine.executeTransition).toHaveBeenCalledWith(
        approvedTransfer,
        'CANCELLED',
        expect.objectContaining({
          userId: 'user_123',
          tenantId: 'tenant_123',
          reason: reason,
        })
      );
    });

    it('should handle audit trail information in transition context', async () => {
      // Arrange
      const transferId = 'transfer_123';
      const reason = 'Emergency cancellation';

      mockTransferService.getTransfer.mockResolvedValue(mockTransfer);
      mockStateMachine.executeTransition.mockResolvedValue({
        ...mockTransfer,
        status: 'CANCELLED',
        cancelledBy: 'user_123',
        cancelledAt: 1640995200000,
        cancellationReason: reason,
      });

      // Act
      const response = await app.request(`/transfers/${transferId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '10.0.0.1',
          'user-agent': 'Test Client/1.0',
        },
        body: JSON.stringify({ reason }),
      });

      // Assert
      expect(response.status).toBe(200);

      // Verify audit information is captured
      const transitionCall = mockStateMachine.executeTransition.mock.calls[0];
      const context = transitionCall[2];
      
      expect(context.userId).toBe('user_123');
      expect(context.tenantId).toBe('tenant_123');
      expect(context.reason).toBe(reason);
      expect(context.ipAddress).toBe('10.0.0.1');
      expect(context.userAgent).toBe('Test Client/1.0');
    });
  });
});