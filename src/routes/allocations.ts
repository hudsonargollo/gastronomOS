import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { 
  authenticate, 
  injectTenantContext,
  injectAuditService,
  injectAuthorizationService,
  getAuthContext,
  getAuditService,
  requirePurchaseOrderAccess
} from '../middleware/auth';
import { validateBody, validateQuery, getValidatedBody, getValidatedQuery } from '../middleware/error';
import { 
  validateAllocationConstraints,
  validateAllocationUpdateConstraints,
  validateAllocationDeleteConstraints,
  validateAllocationStatusConstraints
} from '../middleware/constraint-validation';
import { 
  createAllocationService, 
  CreateAllocationRequest, 
  UpdateAllocationRequest,
  BulkAllocationRequest
} from '../services/allocation';
import { createAllocationStatusManager } from '../services/allocation-status-manager';
import { AllocationStatusType, users } from '../db/schema';
import { extractAuditContext } from '../services/audit';

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
}

// Validation schemas
const createAllocationSchema = z.object({
  poItemId: z.string().min(1, 'PO item ID is required'),
  targetLocationId: z.string().min(1, 'Target location ID is required'),
  quantityAllocated: z.number().int().min(1, 'Quantity allocated must be at least 1'),
  notes: z.string().optional(),
});

const updateAllocationSchema = z.object({
  quantityAllocated: z.number().int().min(1, 'Quantity allocated must be at least 1').optional(),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'SHIPPED', 'RECEIVED', 'CANCELLED'], {
    errorMap: () => ({ message: 'Status must be one of: PENDING, SHIPPED, RECEIVED, CANCELLED' })
  }),
});

const shipAllocationSchema = z.object({
  reason: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const receiveAllocationSchema = z.object({
  quantityReceived: z.number().int().min(0, 'Quantity received must be non-negative').optional(),
  reason: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const bulkAllocationSchema = z.object({
  poId: z.string().min(1, 'PO ID is required'),
  strategy: z.object({
    type: z.enum(['PERCENTAGE_SPLIT', 'EQUAL_DISTRIBUTION', 'TEMPLATE_BASED', 'CUSTOM'], {
      errorMap: () => ({ message: 'Strategy type must be one of: PERCENTAGE_SPLIT, EQUAL_DISTRIBUTION, TEMPLATE_BASED, CUSTOM' })
    }),
    parameters: z.object({
      locationPercentages: z.record(z.string(), z.number().min(0).max(100)).optional(),
      templateId: z.string().optional(),
      customRules: z.array(z.object({
        locationId: z.string(),
        percentage: z.number().min(0).max(100).optional(),
        fixedQuantity: z.number().int().min(1).optional(),
        priority: z.number().int().optional(),
      })).optional(),
    }),
  }),
  allocations: z.array(z.object({
    poItemId: z.string().min(1, 'PO item ID is required'),
    locationAllocations: z.array(z.object({
      locationId: z.string().min(1, 'Location ID is required'),
      quantity: z.number().int().min(1, 'Quantity must be at least 1'),
    })).min(1, 'At least one location allocation is required'),
  })).min(1, 'At least one allocation is required'),
  validateOnly: z.boolean().optional().default(false),
});

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  templateData: z.object({
    locationPercentages: z.record(z.string(), z.number().min(0).max(100)).optional(),
    locationFixedAmounts: z.record(z.string(), z.number().int().min(1)).optional(),
    rules: z.array(z.object({
      locationId: z.string(),
      percentage: z.number().min(0).max(100).optional(),
      fixedQuantity: z.number().int().min(1).optional(),
      priority: z.number().int().optional(),
    })).optional(),
  }),
});

const applyTemplateSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
});

const listAllocationsQuerySchema = z.object({
  status: z.enum(['PENDING', 'SHIPPED', 'RECEIVED', 'CANCELLED']).optional(),
  locationId: z.string().optional(),
  poId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// Initialize allocations router
const allocations = new Hono<{ Bindings: Env }>();

// Apply authentication and context to all routes
allocations.use('*', authenticate());
allocations.use('*', injectTenantContext());
allocations.use('*', injectAuditService());
allocations.use('*', injectAuthorizationService());

/**
 * POST /allocations - Create a new allocation
 * Requirements: 1.1, 1.5, 6.1
 * 
 * This endpoint demonstrates:
 * - Allocation creation with validation
 * - Over-allocation prevention
 * - Tenant isolation
 * - Audit logging
 * - Real-time constraint validation
 */
allocations.post('/', 
  requirePurchaseOrderAccess('write'),
  validateBody(createAllocationSchema),
  validateAllocationConstraints(), // Real-time constraint validation
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    
    try {
      const validatedData = getValidatedBody<CreateAllocationRequest>(c);
      
      // Create allocation service
      const db = drizzle(c.env.DB);
      const allocationService = createAllocationService(db);
      
      // Create the allocation
      const newAllocation = await allocationService.createAllocation(
        validatedData,
        authContext.tenant_id,
        authContext.user_id
      );
      
      // Log allocation creation
      await auditService.logSensitiveOperation('ALLOCATION_CREATED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Allocation created: ${newAllocation.id} for PO item ${validatedData.poItemId}`
      });
      
      // Return allocation info
      return c.json({
        id: newAllocation.id,
        poItemId: newAllocation.poItemId,
        targetLocationId: newAllocation.targetLocationId,
        quantityAllocated: newAllocation.quantityAllocated,
        quantityReceived: newAllocation.quantityReceived,
        status: newAllocation.status,
        notes: newAllocation.notes,
        createdBy: newAllocation.createdBy,
        createdAt: newAllocation.createdAt,
        updatedAt: newAllocation.updatedAt,
        message: 'Allocation created successfully'
      }, 201);
      
    } catch (error) {
      // Log failed allocation creation
      await auditService.logSensitiveOperation('ALLOCATION_CREATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Allocation creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /allocations/:id - Get a specific allocation
 * Requirements: 5.1, 5.4
 */
allocations.get('/:id',
  requirePurchaseOrderAccess('read'),
  async (c) => {
    const authContext = getAuthContext(c);
    const allocationId = c.req.param('id');
    
    if (!allocationId) {
      return c.json({ error: 'Allocation ID is required' }, 400);
    }
    
    try {
      const db = drizzle(c.env.DB);
      const allocationService = createAllocationService(db);
      
      // Get the allocation
      const allocation = await allocationService.getAllocation(allocationId, authContext.tenant_id);
      
      if (!allocation) {
        return c.json({ error: 'Allocation not found' }, 404);
      }
      
      return c.json({
        id: allocation.id,
        poItemId: allocation.poItemId,
        targetLocationId: allocation.targetLocationId,
        quantityAllocated: allocation.quantityAllocated,
        quantityReceived: allocation.quantityReceived,
        status: allocation.status,
        notes: allocation.notes,
        createdBy: allocation.createdBy,
        createdAt: allocation.createdAt,
        updatedAt: allocation.updatedAt,
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * PUT /allocations/:id - Update an allocation
 * Requirements: 6.1, 6.4
 * 
 * This endpoint demonstrates:
 * - Allocation modification with constraints
 * - Status-based modification rules
 * - Audit logging for changes
 * - Real-time constraint validation
 */
allocations.put('/:id',
  requirePurchaseOrderAccess('write'),
  validateBody(updateAllocationSchema),
  validateAllocationUpdateConstraints(), // Real-time constraint validation
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const allocationId = c.req.param('id');
    
    if (!allocationId) {
      return c.json({ error: 'Allocation ID is required' }, 400);
    }
    
    try {
      const validatedData = getValidatedBody<UpdateAllocationRequest>(c);
      
      // Create allocation service
      const db = drizzle(c.env.DB);
      const allocationService = createAllocationService(db);
      
      // Update the allocation
      const updatedAllocation = await allocationService.updateAllocation(
        allocationId,
        validatedData,
        authContext.tenant_id,
        authContext.user_id
      );
      
      // Log allocation update
      await auditService.logSensitiveOperation('ALLOCATION_UPDATED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Allocation updated: ${allocationId}`
      });
      
      // Return updated allocation info
      return c.json({
        id: updatedAllocation.id,
        poItemId: updatedAllocation.poItemId,
        targetLocationId: updatedAllocation.targetLocationId,
        quantityAllocated: updatedAllocation.quantityAllocated,
        quantityReceived: updatedAllocation.quantityReceived,
        status: updatedAllocation.status,
        notes: updatedAllocation.notes,
        createdBy: updatedAllocation.createdBy,
        createdAt: updatedAllocation.createdAt,
        updatedAt: updatedAllocation.updatedAt,
        message: 'Allocation updated successfully'
      });
      
    } catch (error) {
      // Log failed allocation update
      await auditService.logSensitiveOperation('ALLOCATION_UPDATE_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Allocation update failed for ${allocationId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * DELETE /allocations/:id - Delete an allocation
 * Requirements: 6.1, 6.4
 * 
 * This endpoint demonstrates:
 * - Allocation deletion with constraints
 * - Status-based deletion rules
 * - Audit logging for deletions
 * - Real-time constraint validation
 */
allocations.delete('/:id',
  requirePurchaseOrderAccess('write'),
  validateAllocationDeleteConstraints(), // Real-time constraint validation
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const allocationId = c.req.param('id');
    
    if (!allocationId) {
      return c.json({ error: 'Allocation ID is required' }, 400);
    }
    
    try {
      // Create allocation service
      const db = drizzle(c.env.DB);
      const allocationService = createAllocationService(db);
      
      // Delete the allocation
      await allocationService.deleteAllocation(
        allocationId,
        authContext.tenant_id,
        authContext.user_id
      );
      
      // Log allocation deletion
      await auditService.logSensitiveOperation('ALLOCATION_DELETED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Allocation deleted: ${allocationId}`
      });
      
      // Return success message
      return c.json({
        message: 'Allocation deleted successfully'
      });
      
    } catch (error) {
      // Log failed allocation deletion
      await auditService.logSensitiveOperation('ALLOCATION_DELETION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Allocation deletion failed for ${allocationId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * PUT /allocations/:id/status - Update allocation status
 * Requirements: 4.1, 4.2, 4.3
 * 
 * This endpoint demonstrates:
 * - Status transition management
 * - State machine enforcement
 * - Audit logging for status changes
 * - Real-time constraint validation
 */
allocations.put('/:id/status',
  requirePurchaseOrderAccess('write'),
  validateBody(updateStatusSchema),
  validateAllocationStatusConstraints(), // Real-time constraint validation
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const allocationId = c.req.param('id');
    
    if (!allocationId) {
      return c.json({ error: 'Allocation ID is required' }, 400);
    }
    
    try {
      const validatedData = getValidatedBody<{ status: AllocationStatusType }>(c);
      
      // Create allocation service
      const db = drizzle(c.env.DB);
      const allocationService = createAllocationService(db);
      
      // Update the allocation status
      const updatedAllocation = await allocationService.updateAllocationStatus(
        allocationId,
        validatedData.status,
        authContext.tenant_id,
        authContext.user_id
      );
      
      // Log status change
      await auditService.logSensitiveOperation('ALLOCATION_STATUS_CHANGED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Allocation status changed: ${allocationId} to ${validatedData.status}`
      });
      
      // Return updated allocation info
      return c.json({
        id: updatedAllocation.id,
        poItemId: updatedAllocation.poItemId,
        targetLocationId: updatedAllocation.targetLocationId,
        quantityAllocated: updatedAllocation.quantityAllocated,
        quantityReceived: updatedAllocation.quantityReceived,
        status: updatedAllocation.status,
        notes: updatedAllocation.notes,
        createdBy: updatedAllocation.createdBy,
        createdAt: updatedAllocation.createdAt,
        updatedAt: updatedAllocation.updatedAt,
        message: `Allocation status updated to ${validatedData.status}`
      });
      
    } catch (error) {
      // Log failed status update
      await auditService.logSensitiveOperation('ALLOCATION_STATUS_UPDATE_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Allocation status update failed for ${allocationId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * POST /allocations/:id/ship - Ship an allocation
 * Requirements: 4.2, 4.3, 4.5
 * 
 * This endpoint demonstrates:
 * - Allocation shipping with status transition
 * - Status validation and business rules
 * - Audit logging for shipping events
 */
allocations.post('/:id/ship',
  requirePurchaseOrderAccess('write'),
  validateBody(shipAllocationSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const allocationId = c.req.param('id');
    
    if (!allocationId) {
      return c.json({ error: 'Allocation ID is required' }, 400);
    }
    
    try {
      const validatedData = getValidatedBody<{ reason?: string; metadata?: Record<string, any> }>(c);
      
      // Create status manager
      const db = drizzle(c.env.DB);
      const statusManager = createAllocationStatusManager(db);
      
      // Transition to SHIPPED status
      const result = await statusManager.transitionStatus(
        allocationId,
        'SHIPPED',
        authContext.user_id,
        validatedData.reason || 'Allocation shipped'
      );
      
      if (!result.success) {
        return c.json({ 
          error: 'Failed to ship allocation',
          details: result.errors
        }, 400);
      }
      
      // Log shipping event
      await auditService.logSensitiveOperation('ALLOCATION_SHIPPED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Allocation shipped: ${allocationId}`
      });
      
      return c.json({
        message: 'Allocation shipped successfully',
        allocationId: result.allocationId,
        fromStatus: result.fromStatus,
        toStatus: result.toStatus,
        warnings: result.warnings
      });
      
    } catch (error) {
      // Log failed shipping
      await auditService.logSensitiveOperation('ALLOCATION_SHIPPING_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Allocation shipping failed for ${allocationId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * POST /allocations/:id/receive - Receive an allocation
 * Requirements: 4.2, 4.3, 4.5
 * 
 * This endpoint demonstrates:
 * - Allocation receiving with status transition
 * - Quantity received tracking
 * - Status validation and business rules
 * - Audit logging for receiving events
 */
allocations.post('/:id/receive',
  requirePurchaseOrderAccess('write'),
  validateBody(receiveAllocationSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const allocationId = c.req.param('id');
    
    if (!allocationId) {
      return c.json({ error: 'Allocation ID is required' }, 400);
    }
    
    try {
      const validatedData = getValidatedBody<{ 
        quantityReceived?: number; 
        reason?: string; 
        metadata?: Record<string, any> 
      }>(c);
      
      // Create services
      const db = drizzle(c.env.DB);
      const statusManager = createAllocationStatusManager(db);
      const allocationService = createAllocationService(db);
      
      // Update quantity received if provided
      if (validatedData.quantityReceived !== undefined) {
        await allocationService.updateAllocation(
          allocationId,
          { quantityReceived: validatedData.quantityReceived },
          authContext.tenant_id,
          authContext.user_id
        );
      }
      
      // Transition to RECEIVED status
      const result = await statusManager.transitionStatus(
        allocationId,
        'RECEIVED',
        authContext.user_id,
        validatedData.reason || 'Allocation received'
      );
      
      if (!result.success) {
        return c.json({ 
          error: 'Failed to receive allocation',
          details: result.errors
        }, 400);
      }
      
      // Log receiving event
      await auditService.logSensitiveOperation('ALLOCATION_RECEIVED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Allocation received: ${allocationId} (quantity: ${validatedData.quantityReceived || 'not specified'})`
      });
      
      return c.json({
        message: 'Allocation received successfully',
        allocationId: result.allocationId,
        fromStatus: result.fromStatus,
        toStatus: result.toStatus,
        quantityReceived: validatedData.quantityReceived,
        warnings: result.warnings
      });
      
    } catch (error) {
      // Log failed receiving
      await auditService.logSensitiveOperation('ALLOCATION_RECEIVING_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Allocation receiving failed for ${allocationId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /allocations/status/:status - Get allocations by status
 * Requirements: 4.2, 4.3, 4.5
 * 
 * This endpoint demonstrates:
 * - Status-based allocation queries
 * - Filtering and pagination
 * - Tenant isolation
 */
allocations.get('/status/:status',
  requirePurchaseOrderAccess('read'),
  validateQuery(listAllocationsQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const status = c.req.param('status') as AllocationStatusType;
    const query = getValidatedQuery<{
      locationId?: string;
      poId?: string;
      limit: number;
      offset: number;
    }>(c);
    
    // Validate status parameter
    const validStatuses: AllocationStatusType[] = ['PENDING', 'SHIPPED', 'RECEIVED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return c.json({ 
        error: 'Invalid status',
        validStatuses: validStatuses
      }, 400);
    }
    
    try {
      const db = drizzle(c.env.DB);
      const allocationService = createAllocationService(db);
      
      // Build filters
      const filters: any = {
        status: status,
        limit: query.limit,
        offset: query.offset,
      };
      
      if (query.locationId) {
        filters.locationId = query.locationId;
      }
      
      if (query.poId) {
        filters.poId = query.poId;
      }
      
      // Get allocations by status
      const allocationsResult = await allocationService.getAllocationsByStatus(
        status,
        authContext.tenant_id,
        filters
      );
      
      return c.json({
        status: status,
        allocations: allocationsResult.map(allocation => ({
          id: allocation.id,
          poItemId: allocation.poItemId,
          targetLocationId: allocation.targetLocationId,
          quantityAllocated: allocation.quantityAllocated,
          quantityReceived: allocation.quantityReceived,
          status: allocation.status,
          notes: allocation.notes,
          createdBy: allocation.createdBy,
          createdAt: allocation.createdAt,
          updatedAt: allocation.updatedAt,
        })),
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total: allocationsResult.length, // This would be improved with actual count in real implementation
        }
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /locations/:locationId/allocations - Get allocations for a specific location
 * Requirements: 5.1, 5.4
 * 
 * This endpoint demonstrates:
 * - Location-scoped allocation queries
 * - Filtering and pagination
 * - Location-based access control
 */
allocations.get('/locations/:locationId/allocations',
  requirePurchaseOrderAccess('read'),
  validateQuery(listAllocationsQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const locationId = c.req.param('locationId');
    const query = getValidatedQuery<{
      status?: AllocationStatusType;
      locationId?: string;
      poId?: string;
      limit: number;
      offset: number;
    }>(c);
    
    if (!locationId) {
      return c.json({ error: 'Location ID is required' }, 400);
    }
    
    try {
      const db = drizzle(c.env.DB);
      const allocationService = createAllocationService(db);
      
      // Get allocations for the location
      const filters: any = {
        limit: query.limit,
        offset: query.offset,
      };
      
      if (query.status) {
        filters.status = query.status;
      }
      
      if (query.poId) {
        filters.poId = query.poId;
      }
      
      const allocationsResult = await allocationService.getAllocationsForLocation(
        locationId,
        authContext.tenant_id,
        filters
      );
      
      return c.json({
        allocations: allocationsResult.map(allocation => ({
          id: allocation.id,
          poItemId: allocation.poItemId,
          targetLocationId: allocation.targetLocationId,
          quantityAllocated: allocation.quantityAllocated,
          quantityReceived: allocation.quantityReceived,
          status: allocation.status,
          notes: allocation.notes,
          createdBy: allocation.createdBy,
          createdAt: allocation.createdAt,
          updatedAt: allocation.updatedAt,
        })),
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total: allocationsResult.length, // This would be improved with actual count in real implementation
        }
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * POST /purchase-orders/:id/bulk-allocate - Bulk allocate PO items
 * Requirements: 7.1, 7.2
 * 
 * This endpoint demonstrates:
 * - Bulk allocation operations
 * - Multiple allocation strategies
 * - Validation-only mode
 * - Comprehensive error handling
 */
allocations.post('/purchase-orders/:id/bulk-allocate',
  requirePurchaseOrderAccess('write'),
  validateBody(bulkAllocationSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const poId = c.req.param('id');
    
    if (!poId) {
      return c.json({ error: 'Purchase order ID is required' }, 400);
    }
    
    try {
      const validatedData = getValidatedBody<BulkAllocationRequest>(c);
      
      // Ensure PO ID matches the URL parameter
      if (validatedData.poId !== poId) {
        return c.json({ error: 'PO ID in body must match URL parameter' }, 400);
      }
      
      // Create allocation service
      const db = drizzle(c.env.DB);
      const allocationService = createAllocationService(db);
      
      // Execute bulk allocation
      const result = await allocationService.bulkAllocate(
        validatedData,
        authContext.tenant_id,
        authContext.user_id
      );
      
      // Log bulk allocation operation
      await auditService.logSensitiveOperation('BULK_ALLOCATION_EXECUTED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Bulk allocation for PO ${poId}: ${result.summary.successCount} successful, ${result.summary.failureCount} failed`
      });
      
      // Return result
      return c.json({
        success: result.success,
        summary: result.summary,
        createdAllocations: result.createdAllocations.map(allocation => ({
          id: allocation.id,
          poItemId: allocation.poItemId,
          targetLocationId: allocation.targetLocationId,
          quantityAllocated: allocation.quantityAllocated,
          status: allocation.status,
        })),
        failedAllocations: result.failedAllocations,
        message: result.success 
          ? 'Bulk allocation completed successfully'
          : `Bulk allocation completed with ${result.summary.failureCount} failures`
      }, result.success ? 201 : 207); // 207 Multi-Status for partial success
      
    } catch (error) {
      // Log failed bulk allocation
      await auditService.logSensitiveOperation('BULK_ALLOCATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Bulk allocation failed for PO ${poId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * POST /allocation-templates - Create allocation template
 * Requirements: 7.2
 * 
 * This endpoint demonstrates:
 * - Template creation for reusable allocation patterns
 * - Template data validation
 * - Tenant isolation
 */
allocations.post('/allocation-templates',
  requirePurchaseOrderAccess('write'),
  validateBody(createTemplateSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    
    try {
      const validatedData = getValidatedBody<{
        name: string;
        description?: string;
        templateData: any;
      }>(c);
      
      // Create allocation service
      const db = drizzle(c.env.DB);
      const allocationService = createAllocationService(db);
      
      // Create the template
      const template = await allocationService.createAllocationTemplate(
        validatedData.name,
        validatedData.description || '',
        validatedData.templateData,
        authContext.tenant_id,
        authContext.user_id
      );
      
      // Log template creation
      await auditService.logSensitiveOperation('ALLOCATION_TEMPLATE_CREATED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Allocation template created: ${template.id} (${template.name})`
      });
      
      // Return template info
      return c.json({
        id: template.id,
        name: template.name,
        description: template.description,
        templateData: template.templateData,
        createdBy: template.createdBy,
        createdAt: template.createdAt,
        message: 'Allocation template created successfully'
      }, 201);
      
    } catch (error) {
      // Log failed template creation
      await auditService.logSensitiveOperation('ALLOCATION_TEMPLATE_CREATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Allocation template creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /allocation-templates - List allocation templates
 * Requirements: 7.2
 * 
 * This endpoint demonstrates:
 * - Template listing for tenant
 * - Template metadata retrieval
 */
allocations.get('/allocation-templates',
  requirePurchaseOrderAccess('read'),
  async (c) => {
    const authContext = getAuthContext(c);
    
    try {
      // Create allocation service
      const db = drizzle(c.env.DB);
      const allocationService = createAllocationService(db);
      
      // Get templates
      const templates = await allocationService.getAllocationTemplates(authContext.tenant_id);
      
      // Return templates
      return c.json({
        templates: templates.map(template => ({
          id: template.id,
          name: template.name,
          description: template.description,
          templateData: template.templateData,
          createdBy: template.createdBy,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
        }))
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /allocation-templates/:id - Get specific allocation template
 * Requirements: 7.2
 */
allocations.get('/allocation-templates/:id',
  requirePurchaseOrderAccess('read'),
  async (c) => {
    const authContext = getAuthContext(c);
    const templateId = c.req.param('id');
    
    if (!templateId) {
      return c.json({ error: 'Template ID is required' }, 400);
    }
    
    try {
      // Create allocation service
      const db = drizzle(c.env.DB);
      const allocationService = createAllocationService(db);
      
      // Get template
      const template = await allocationService.getAllocationTemplate(templateId, authContext.tenant_id);
      
      if (!template) {
        return c.json({ error: 'Allocation template not found' }, 404);
      }
      
      // Return template
      return c.json({
        id: template.id,
        name: template.name,
        description: template.description,
        templateData: template.templateData,
        createdBy: template.createdBy,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * POST /purchase-orders/:id/apply-template - Apply allocation template to PO
 * Requirements: 7.2, 7.4
 * 
 * This endpoint demonstrates:
 * - Template-based bulk allocation
 * - Template application to PO items
 * - Automatic allocation distribution
 */
allocations.post('/purchase-orders/:id/apply-template',
  requirePurchaseOrderAccess('write'),
  validateBody(applyTemplateSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const poId = c.req.param('id');
    
    if (!poId) {
      return c.json({ error: 'Purchase order ID is required' }, 400);
    }
    
    try {
      const validatedData = getValidatedBody<{ templateId: string }>(c);
      
      // Create allocation service
      const db = drizzle(c.env.DB);
      const allocationService = createAllocationService(db);
      
      // Apply template
      const result = await allocationService.applyAllocationTemplate(
        poId,
        validatedData.templateId,
        authContext.tenant_id,
        authContext.user_id
      );
      
      // Log template application
      await auditService.logSensitiveOperation('ALLOCATION_TEMPLATE_APPLIED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Template ${validatedData.templateId} applied to PO ${poId}: ${result.summary.successCount} successful, ${result.summary.failureCount} failed`
      });
      
      // Return result
      return c.json({
        success: result.success,
        summary: result.summary,
        createdAllocations: result.createdAllocations.map(allocation => ({
          id: allocation.id,
          poItemId: allocation.poItemId,
          targetLocationId: allocation.targetLocationId,
          quantityAllocated: allocation.quantityAllocated,
          status: allocation.status,
        })),
        failedAllocations: result.failedAllocations,
        message: result.success 
          ? 'Template applied successfully'
          : `Template applied with ${result.summary.failureCount} failures`
      }, result.success ? 201 : 207); // 207 Multi-Status for partial success
      
    } catch (error) {
      // Log failed template application
      await auditService.logSensitiveOperation('ALLOCATION_TEMPLATE_APPLICATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Template application failed for PO ${poId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /my-allocations - Get allocations for current user based on their location access
 * Requirements: 5.1, 5.4
 * 
 * This endpoint demonstrates:
 * - User-specific allocation filtering based on location access
 * - Location-scoped access control for STAFF users
 * - Multi-location access for ADMIN/MANAGER users
 */
allocations.get('/my-allocations',
  requirePurchaseOrderAccess('read'),
  validateQuery(listAllocationsQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      status?: AllocationStatusType;
      locationId?: string;
      poId?: string;
      limit: number;
      offset: number;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const allocationService = createAllocationService(db);
      
      // Get user details to determine location access
      const [user] = await db
        .select()
        .from(users)
        .where(and(
          eq(users.id, authContext.user_id),
          eq(users.tenantId, authContext.tenant_id)
        ))
        .limit(1);

      if (!user) {
        return c.json({ error: 'User not found' }, 404);
      }

      let allocationsResult: any[] = [];

      // Build filters, excluding undefined values
      const filters: any = {
        limit: query.limit,
        offset: query.offset,
      };
      
      if (query.status) {
        filters.status = query.status;
      }
      
      if (query.poId) {
        filters.poId = query.poId;
      }

      // ADMIN users can see all allocations (optionally filtered by location)
      if (user.role === 'ADMIN') {
        if (query.locationId) {
          // Filter by specific location if requested
          const locationFilters = { ...filters };
          allocationsResult = await allocationService.getAllocationsForLocation(
            query.locationId,
            authContext.tenant_id,
            locationFilters
          );
        } else {
          // Get all allocations by status or all statuses
          if (query.status) {
            allocationsResult = await allocationService.getAllocationsByStatus(
              query.status,
              authContext.tenant_id,
              filters
            );
          } else {
            // Get all allocations for the tenant (would need a new method, for now get by PENDING status)
            allocationsResult = await allocationService.getAllocationsByStatus(
              'PENDING',
              authContext.tenant_id,
              filters
            );
          }
        }
      }
      // MANAGER users can see all allocations (similar to ADMIN)
      else if (user.role === 'MANAGER') {
        if (query.locationId) {
          const locationFilters = { ...filters };
          allocationsResult = await allocationService.getAllocationsForLocation(
            query.locationId,
            authContext.tenant_id,
            locationFilters
          );
        } else {
          if (query.status) {
            allocationsResult = await allocationService.getAllocationsByStatus(
              query.status,
              authContext.tenant_id,
              filters
            );
          } else {
            allocationsResult = await allocationService.getAllocationsByStatus(
              'PENDING',
              authContext.tenant_id,
              filters
            );
          }
        }
      }
      // STAFF users can only see allocations for their assigned location
      else if (user.role === 'STAFF' && user.locationId) {
        allocationsResult = await allocationService.getAllocationsForLocation(
          user.locationId,
          authContext.tenant_id,
          filters
        );
      }
      // Users without location assignment or invalid role
      else {
        return c.json({
          error: 'Access Denied',
          message: 'User does not have location access or invalid role'
        }, 403);
      }
      
      return c.json({
        userRole: user.role,
        userLocationId: user.locationId,
        locationAccess: user.role === 'ADMIN' || user.role === 'MANAGER' ? 'ALL_LOCATIONS' : 'ASSIGNED_LOCATION',
        allocations: allocationsResult.map(allocation => ({
          id: allocation.id,
          poItemId: allocation.poItemId,
          targetLocationId: allocation.targetLocationId,
          quantityAllocated: allocation.quantityAllocated,
          quantityReceived: allocation.quantityReceived,
          status: allocation.status,
          notes: allocation.notes,
          createdBy: allocation.createdBy,
          createdAt: allocation.createdAt,
          updatedAt: allocation.updatedAt,
        })),
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total: allocationsResult.length,
        },
        filters: {
          status: query.status,
          locationId: query.locationId,
          poId: query.poId,
        },
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

// 404 handler for unmatched routes
allocations.all('*', (c) => {
  return c.json({ error: 'Allocation endpoint not found' }, 404);
});

export default allocations;