/**
 * Allocation Status Management API Tests
 * 
 * Tests for the status management endpoints: ship, receive, and status queries.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';

// Mock the database and services
vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn(() => mockDb)
}));

vi.mock('../services/allocation-status-manager', () => ({
  createAllocationStatusManager: vi.fn(() => mockStatusManager)
}));

vi.mock('../services/allocation', () => ({
  createAllocationService: vi.fn(() => mockAllocationService)
}));

// Mock middleware
vi.mock('../middleware/auth', () => ({
  authenticate: () => vi.fn((c, next) => next()),
  injectTenantContext: () => vi.fn((c, next) => next()),
  injectAuditService: () => vi.fn((c, next) => next()),
  injectAuthorizationService: () => vi.fn((c, next) => next()),
  getAuthContext: vi.fn(() => ({
    user_id: 'user_1',
    tenant_id: 'tenant_1'
  })),
  getAuditService: vi.fn(() => mockAuditService),
  requirePurchaseOrderAccess: () => vi.fn((c, next) => next())
}));

vi.mock('../middleware/error', () => ({
  validateBody: () => vi.fn((c, next) => next()),
  validateQuery: () => vi.fn((c, next) => next()),
  getValidatedBody: vi.fn((c) => {
    // Return different mock data based on the request body or path
    const path = c.req.path;
    if (path.includes('/ship')) {
      return { reason: 'Manual shipping', metadata: { carrier: 'FedEx' } };
    } else if (path.includes('/receive')) {
      // For the test that shouldn't update quantity, return without quantityReceived
      if (path.includes('alloc_1') && !c.req.raw.body) {
        return { reason: 'Delivery confirmed' };
      }
      return { quantityReceived: 45, reason: 'Delivery confirmed', metadata: { deliveryDate: '2024-01-15' } };
    }
    return {};
  }),
  getValidatedQuery: vi.fn((c) => {
    const url = new URL(c.req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const locationId = url.searchParams.get('locationId');
    
    const query: any = { limit, offset };
    if (locationId) {
      query.locationId = locationId;
    }
    return query;
  })
}));

vi.mock('../services/audit', () => ({
  extractAuditContext: vi.fn(() => ({}))
}));

// Mock services
const mockStatusManager = {
  transitionStatus: vi.fn()
};

const mockAllocationService = {
  updateAllocation: vi.fn(),
  getAllocationsByStatus: vi.fn()
};

const mockAuditService = {
  logSensitiveOperation: vi.fn()
};

const mockDb = {};

// Import the routes after mocking
import allocations from './allocations';

describe('Allocation Status Management API', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    
    // Mock the environment
    app.use('*', async (c, next) => {
      c.env = { DB: mockDb };
      await next();
    });
    
    app.route('/allocations', allocations);
  });

  describe('POST /allocations/:id/ship', () => {
    it('should ship an allocation successfully', async () => {
      // Mock successful status transition
      mockStatusManager.transitionStatus.mockResolvedValue({
        success: true,
        allocationId: 'alloc_1',
        fromStatus: 'PENDING',
        toStatus: 'SHIPPED',
        errors: [],
        warnings: []
      });

      const response = await app.request('/allocations/alloc_1/ship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Manual shipping',
          metadata: { carrier: 'FedEx' }
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Allocation shipped successfully');
      expect(data.allocationId).toBe('alloc_1');
      expect(data.fromStatus).toBe('PENDING');
      expect(data.toStatus).toBe('SHIPPED');
      
      expect(mockStatusManager.transitionStatus).toHaveBeenCalledWith(
        'alloc_1',
        'SHIPPED',
        'user_1',
        'Manual shipping'
      );
    });

    it('should handle shipping failures', async () => {
      // Mock failed status transition
      mockStatusManager.transitionStatus.mockResolvedValue({
        success: false,
        allocationId: 'alloc_1',
        fromStatus: 'RECEIVED',
        toStatus: 'SHIPPED',
        errors: ['Invalid transition from RECEIVED to SHIPPED'],
        warnings: []
      });

      const response = await app.request('/allocations/alloc_1/ship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Attempted shipping'
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Failed to ship allocation');
      expect(data.details).toContain('Invalid transition from RECEIVED to SHIPPED');
    });

    it('should require allocation ID', async () => {
      const response = await app.request('/allocations//ship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(404); // Route not found due to empty ID
    });
  });

  describe('POST /allocations/:id/receive', () => {
    it('should receive an allocation successfully', async () => {
      // Mock successful allocation update
      mockAllocationService.updateAllocation.mockResolvedValue({
        id: 'alloc_1',
        quantityReceived: 45
      });

      // Mock successful status transition
      mockStatusManager.transitionStatus.mockResolvedValue({
        success: true,
        allocationId: 'alloc_1',
        fromStatus: 'SHIPPED',
        toStatus: 'RECEIVED',
        errors: [],
        warnings: []
      });

      const response = await app.request('/allocations/alloc_1/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantityReceived: 45,
          reason: 'Delivery confirmed',
          metadata: { deliveryDate: '2024-01-15' }
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Allocation received successfully');
      expect(data.allocationId).toBe('alloc_1');
      expect(data.fromStatus).toBe('SHIPPED');
      expect(data.toStatus).toBe('RECEIVED');
      expect(data.quantityReceived).toBe(45);
      
      expect(mockAllocationService.updateAllocation).toHaveBeenCalledWith(
        'alloc_1',
        { quantityReceived: 45 },
        'tenant_1',
        'user_1'
      );
      
      expect(mockStatusManager.transitionStatus).toHaveBeenCalledWith(
        'alloc_1',
        'RECEIVED',
        'user_1',
        'Delivery confirmed'
      );
    });

    it('should receive allocation without quantity update', async () => {
      // Mock successful status transition
      mockStatusManager.transitionStatus.mockResolvedValue({
        success: true,
        allocationId: 'alloc_1',
        fromStatus: 'SHIPPED',
        toStatus: 'RECEIVED',
        errors: [],
        warnings: []
      });

      // Override the getValidatedBody mock for this specific test
      const { getValidatedBody } = await import('../middleware/error');
      vi.mocked(getValidatedBody).mockReturnValueOnce({
        reason: 'Delivery confirmed'
        // No quantityReceived field
      });

      const response = await app.request('/allocations/alloc_1/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Delivery confirmed'
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Allocation received successfully');
      
      // Should not call updateAllocation when no quantityReceived provided
      expect(mockAllocationService.updateAllocation).not.toHaveBeenCalled();
      
      expect(mockStatusManager.transitionStatus).toHaveBeenCalledWith(
        'alloc_1',
        'RECEIVED',
        'user_1',
        'Delivery confirmed'
      );
    });

    it('should handle receiving failures', async () => {
      // Mock failed status transition
      mockStatusManager.transitionStatus.mockResolvedValue({
        success: false,
        allocationId: 'alloc_1',
        fromStatus: 'PENDING',
        toStatus: 'RECEIVED',
        errors: ['Allocations can only be received after being shipped'],
        warnings: []
      });

      const response = await app.request('/allocations/alloc_1/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Attempted receiving'
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Failed to receive allocation');
      expect(data.details).toContain('Allocations can only be received after being shipped');
    });
  });

  describe('GET /allocations/status/:status', () => {
    it('should get allocations by status', async () => {
      const mockAllocations = [
        {
          id: 'alloc_1',
          poItemId: 'po_item_1',
          targetLocationId: 'loc_1',
          quantityAllocated: 50,
          quantityReceived: 0,
          status: 'PENDING',
          notes: null,
          createdBy: 'user_1',
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: 'alloc_2',
          poItemId: 'po_item_2',
          targetLocationId: 'loc_2',
          quantityAllocated: 30,
          quantityReceived: 0,
          status: 'PENDING',
          notes: 'Rush order',
          createdBy: 'user_1',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      mockAllocationService.getAllocationsByStatus.mockResolvedValue(mockAllocations);

      const response = await app.request('/allocations/status/PENDING?limit=10&offset=0');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('PENDING');
      expect(data.allocations).toHaveLength(2);
      expect(data.allocations[0].id).toBe('alloc_1');
      expect(data.allocations[1].id).toBe('alloc_2');
      expect(data.pagination.limit).toBe(10);
      expect(data.pagination.offset).toBe(0);
      
      expect(mockAllocationService.getAllocationsByStatus).toHaveBeenCalledWith(
        'PENDING',
        'tenant_1',
        expect.objectContaining({
          status: 'PENDING',
          limit: 10,
          offset: 0
        })
      );
    });

    it('should filter allocations by location', async () => {
      const mockAllocations = [
        {
          id: 'alloc_1',
          poItemId: 'po_item_1',
          targetLocationId: 'loc_1',
          quantityAllocated: 50,
          quantityReceived: 50,
          status: 'RECEIVED',
          notes: null,
          createdBy: 'user_1',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ];

      mockAllocationService.getAllocationsByStatus.mockResolvedValue(mockAllocations);

      const response = await app.request('/allocations/status/RECEIVED?locationId=loc_1');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('RECEIVED');
      expect(data.allocations).toHaveLength(1);
      
      expect(mockAllocationService.getAllocationsByStatus).toHaveBeenCalledWith(
        'RECEIVED',
        'tenant_1',
        expect.objectContaining({
          status: 'RECEIVED',
          locationId: 'loc_1'
        })
      );
    });

    it('should reject invalid status', async () => {
      const response = await app.request('/allocations/status/INVALID_STATUS');

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid status');
      expect(data.validStatuses).toContain('PENDING');
      expect(data.validStatuses).toContain('SHIPPED');
      expect(data.validStatuses).toContain('RECEIVED');
      expect(data.validStatuses).toContain('CANCELLED');
    });

    it('should handle empty results', async () => {
      mockAllocationService.getAllocationsByStatus.mockResolvedValue([]);

      const response = await app.request('/allocations/status/CANCELLED');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('CANCELLED');
      expect(data.allocations).toHaveLength(0);
    });
  });
});