import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
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
  createUnallocatedInventoryService,
  UnallocatedAllocationRequest
} from '../services/unallocated-inventory';
import { extractAuditContext } from '../services/audit';

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
}

// Validation schemas
const unallocatedQuerySchema = z.object({
  poId: z.string().optional(),
  productId: z.string().optional(),
  minUnallocatedQuantity: z.coerce.number().int().min(1).optional(),
  minUnallocatedPercentage: z.coerce.number().min(0).max(100).optional(),
  dateFrom: z.string().datetime('Invalid date format').optional(),
  dateTo: z.string().datetime('Invalid date format').optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const summaryQuerySchema = z.object({
  dateFrom: z.string().datetime('Invalid date format').optional(),
  dateTo: z.string().datetime('Invalid date format').optional(),
});

const allocateUnallocatedSchema = z.object({
  targetLocationId: z.string().min(1, 'Target location ID is required'),
  quantityToAllocate: z.number().int().min(1, 'Quantity to allocate must be at least 1'),
  notes: z.string().optional(),
});

const assignToCentralSchema = z.object({
  centralWarehouseId: z.string().min(1, 'Central warehouse ID is required'),
  reason: z.enum(['AUTO_ASSIGNMENT', 'MANUAL_ASSIGNMENT']).optional().default('MANUAL_ASSIGNMENT'),
});

const configUpdateSchema = z.object({
  centralWarehouseId: z.string().optional(),
  autoAssignUnallocated: z.boolean().optional(),
  unallocatedThresholdPercentage: z.number().min(0).max(100).optional(),
  notificationSettings: z.object({
    notifyOnHighUnallocated: z.boolean().optional(),
    highUnallocatedThreshold: z.number().min(0).max(100).optional(),
    notificationRecipients: z.array(z.string()).optional(),
  }).optional(),
});

// Initialize unallocated inventory router
const unallocatedInventory = new Hono<{ Bindings: Env }>();

// Apply authentication and context to all routes
unallocatedInventory.use('*', authenticate());
unallocatedInventory.use('*', injectTenantContext());
unallocatedInventory.use('*', injectAuditService());
unallocatedInventory.use('*', injectAuthorizationService());

/**
 * GET /purchase-orders/:id/unallocated - Get unallocated items for a specific PO
 * Requirements: 3.4, 3.5
 * 
 * This endpoint demonstrates:
 * - Unallocated quantity tracking for specific PO
 * - Real-time calculation of unallocated quantities
 * - Tenant isolation
 */
unallocatedInventory.get('/purchase-orders/:id/unallocated',
  requirePurchaseOrderAccess('read'),
  async (c) => {
    const authContext = getAuthContext(c);
    const poId = c.req.param('id');
    
    if (!poId) {
      return c.json({ error: 'Purchase order ID is required' }, 400);
    }
    
    try {
      const db = drizzle(c.env.DB);
      const unallocatedService = createUnallocatedInventoryService(db);
      
      // Get unallocated items for the PO
      const unallocatedItems = await unallocatedService.getUnallocatedForPO(poId, authContext.tenant_id);
      
      // Calculate summary statistics
      const totalUnallocatedQuantity = unallocatedItems.reduce((sum, item) => sum + item.unallocatedQuantity, 0);
      const totalUnallocatedValueCents = unallocatedItems.reduce((sum, item) => sum + item.unallocatedValueCents, 0);
      const averageUnallocatedPercentage = unallocatedItems.length > 0 
        ? unallocatedItems.reduce((sum, item) => sum + item.unallocatedPercentage, 0) / unallocatedItems.length 
        : 0;
      
      return c.json({
        poId,
        summary: {
          totalItems: unallocatedItems.length,
          totalUnallocatedQuantity,
          totalUnallocatedValueCents,
          averageUnallocatedPercentage: Math.round(averageUnallocatedPercentage * 100) / 100,
        },
        unallocatedItems: unallocatedItems.map(item => ({
          poItemId: item.poItemId,
          productId: item.productId,
          productName: item.productName,
          quantityOrdered: item.quantityOrdered,
          quantityAllocated: item.quantityAllocated,
          unallocatedQuantity: item.unallocatedQuantity,
          unallocatedPercentage: Math.round(item.unallocatedPercentage * 100) / 100,
          unitPriceCents: item.unitPriceCents,
          unallocatedValueCents: item.unallocatedValueCents,
          createdAt: item.createdAt,
        })),
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * POST /unallocated/:poItemId/allocate - Allocate unallocated quantity to a location
 * Requirements: 3.4, 3.5
 * 
 * This endpoint demonstrates:
 * - Manual allocation of unallocated quantities
 * - Validation of allocation requests
 * - Audit logging for unallocated allocations
 */
unallocatedInventory.post('/unallocated/:poItemId/allocate',
  requirePurchaseOrderAccess('write'),
  validateBody(allocateUnallocatedSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const poItemId = c.req.param('poItemId');
    
    if (!poItemId) {
      return c.json({ error: 'PO item ID is required' }, 400);
    }
    
    try {
      const validatedData = getValidatedBody<{
        targetLocationId: string;
        quantityToAllocate: number;
        notes?: string;
      }>(c);
      
      const db = drizzle(c.env.DB);
      const unallocatedService = createUnallocatedInventoryService(db);
      
      // Create allocation request
      const allocationRequest: UnallocatedAllocationRequest = {
        poItemId,
        targetLocationId: validatedData.targetLocationId,
        quantityToAllocate: validatedData.quantityToAllocate,
        notes: validatedData.notes,
      };
      
      // Allocate the unallocated quantity
      const result = await unallocatedService.allocateUnallocatedQuantity(
        allocationRequest,
        authContext.tenant_id,
        authContext.user_id
      );
      
      if (result.success) {
        // Log successful allocation
        await auditService.logSensitiveOperation('UNALLOCATED_QUANTITY_ALLOCATED', {
          ...auditContext,
          tenantId: authContext.tenant_id,
          userId: authContext.user_id,
          resource: `Unallocated quantity allocated: ${validatedData.quantityToAllocate} units from PO item ${poItemId} to location ${validatedData.targetLocationId}`
        });
        
        return c.json({
          success: true,
          allocationId: result.allocationId,
          quantityAllocated: validatedData.quantityToAllocate,
          remainingUnallocated: result.remainingUnallocated,
          message: 'Unallocated quantity successfully allocated'
        }, 201);
      } else {
        return c.json({
          success: false,
          errors: result.errors,
          remainingUnallocated: result.remainingUnallocated,
        }, 400);
      }
      
    } catch (error) {
      // Log failed allocation
      await auditService.logSensitiveOperation('UNALLOCATED_ALLOCATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Unallocated allocation failed for PO item ${poItemId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /locations/:id/unallocated-inventory - Get unallocated inventory for a location
 * Requirements: 3.4, 3.5
 * 
 * This endpoint demonstrates:
 * - Location-specific unallocated inventory view
 * - Potential allocation opportunities for locations
 * - Location-based access control
 */
unallocatedInventory.get('/locations/:id/unallocated-inventory',
  requirePurchaseOrderAccess('read'),
  async (c) => {
    const authContext = getAuthContext(c);
    const locationId = c.req.param('id');
    
    if (!locationId) {
      return c.json({ error: 'Location ID is required' }, 400);
    }
    
    try {
      const db = drizzle(c.env.DB);
      const unallocatedService = createUnallocatedInventoryService(db);
      
      // Get unallocated inventory for the location
      const locationInventory = await unallocatedService.getUnallocatedForLocation(
        locationId,
        authContext.tenant_id
      );
      
      return c.json({
        locationId: locationInventory.locationId,
        locationName: locationInventory.locationName,
        summary: {
          totalItems: locationInventory.unallocatedItems.length,
          totalUnallocatedQuantity: locationInventory.totalUnallocatedQuantity,
          totalUnallocatedValueCents: locationInventory.totalUnallocatedValueCents,
        },
        availableForAllocation: locationInventory.unallocatedItems.map(item => ({
          poItemId: item.poItemId,
          poId: item.poId,
          poNumber: item.poNumber,
          productId: item.productId,
          productName: item.productName,
          unallocatedQuantity: item.unallocatedQuantity,
          unallocatedPercentage: Math.round(item.unallocatedPercentage * 100) / 100,
          unitPriceCents: item.unitPriceCents,
          unallocatedValueCents: item.unallocatedValueCents,
        })),
      });
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return c.json({
          error: 'Not Found',
          message: 'Location not found or access denied'
        }, 404);
      }
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /unallocated-inventory - Get all unallocated inventory for tenant
 * Requirements: 3.1, 3.3
 * 
 * This endpoint demonstrates:
 * - Comprehensive unallocated inventory overview
 * - Filtering and pagination
 * - Summary statistics
 */
unallocatedInventory.get('/unallocated-inventory',
  requirePurchaseOrderAccess('read'),
  validateQuery(unallocatedQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      poId?: string;
      productId?: string;
      minUnallocatedQuantity?: number;
      minUnallocatedPercentage?: number;
      dateFrom?: string;
      dateTo?: string;
      limit: number;
      offset: number;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const unallocatedService = createUnallocatedInventoryService(db);
      
      // Build filters
      const filters: any = {
        limit: query.limit,
        offset: query.offset,
      };
      
      if (query.poId) filters.poId = query.poId;
      if (query.productId) filters.productId = query.productId;
      if (query.minUnallocatedQuantity) filters.minUnallocatedQuantity = query.minUnallocatedQuantity;
      if (query.minUnallocatedPercentage) filters.minUnallocatedPercentage = query.minUnallocatedPercentage;
      if (query.dateFrom) filters.dateFrom = new Date(query.dateFrom);
      if (query.dateTo) filters.dateTo = new Date(query.dateTo);
      
      // Get unallocated items
      const unallocatedItems = await unallocatedService.getUnallocatedItems(authContext.tenant_id, filters);
      
      return c.json({
        unallocatedItems: unallocatedItems.map(item => ({
          poItemId: item.poItemId,
          poId: item.poId,
          poNumber: item.poNumber,
          productId: item.productId,
          productName: item.productName,
          quantityOrdered: item.quantityOrdered,
          quantityAllocated: item.quantityAllocated,
          unallocatedQuantity: item.unallocatedQuantity,
          unallocatedPercentage: Math.round(item.unallocatedPercentage * 100) / 100,
          unitPriceCents: item.unitPriceCents,
          unallocatedValueCents: item.unallocatedValueCents,
          createdAt: item.createdAt,
        })),
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total: unallocatedItems.length,
        },
        filters: {
          poId: query.poId,
          productId: query.productId,
          minUnallocatedQuantity: query.minUnallocatedQuantity,
          minUnallocatedPercentage: query.minUnallocatedPercentage,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
        },
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /unallocated-inventory/summary - Get unallocated inventory summary
 * Requirements: 3.3, 3.5
 * 
 * This endpoint demonstrates:
 * - High-level unallocated inventory statistics
 * - Dashboard-ready summary data
 * - Date range filtering for reporting
 */
unallocatedInventory.get('/unallocated-inventory/summary',
  requirePurchaseOrderAccess('read'),
  validateQuery(summaryQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      dateFrom?: string;
      dateTo?: string;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const unallocatedService = createUnallocatedInventoryService(db);
      
      // Build date range if provided
      let dateRange: { from: Date; to: Date } | undefined;
      if (query.dateFrom && query.dateTo) {
        dateRange = {
          from: new Date(query.dateFrom),
          to: new Date(query.dateTo),
        };
      }
      
      // Get summary statistics
      const summary = await unallocatedService.getUnallocatedSummary(authContext.tenant_id, dateRange);
      
      return c.json({
        summary: {
          totalItems: summary.totalItems,
          totalUnallocatedQuantity: summary.totalUnallocatedQuantity,
          totalUnallocatedValueCents: summary.totalUnallocatedValueCents,
          averageUnallocatedPercentage: Math.round(summary.averageUnallocatedPercentage * 100) / 100,
        },
        breakdown: {
          itemsByCategory: summary.itemsByCategory,
          topUnallocatedItems: summary.topUnallocatedItems.slice(0, 5).map(item => ({
            poItemId: item.poItemId,
            poNumber: item.poNumber,
            productName: item.productName,
            unallocatedQuantity: item.unallocatedQuantity,
            unallocatedValueCents: item.unallocatedValueCents,
            unallocatedPercentage: Math.round(item.unallocatedPercentage * 100) / 100,
          })),
        },
        dateRange: dateRange ? {
          from: dateRange.from.toISOString(),
          to: dateRange.to.toISOString(),
        } : null,
        generatedAt: new Date().toISOString(),
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * POST /unallocated/:poItemId/assign-central - Assign unallocated quantity to central warehouse
 * Requirements: 3.3, 3.4
 * 
 * This endpoint demonstrates:
 * - Central warehouse assignment functionality
 * - Automatic handling of unallocated inventory
 * - Audit logging for central assignments
 */
unallocatedInventory.post('/unallocated/:poItemId/assign-central',
  requirePurchaseOrderAccess('write'),
  validateBody(assignToCentralSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const poItemId = c.req.param('poItemId');
    
    if (!poItemId) {
      return c.json({ error: 'PO item ID is required' }, 400);
    }
    
    try {
      const validatedData = getValidatedBody<{
        centralWarehouseId: string;
        reason: 'AUTO_ASSIGNMENT' | 'MANUAL_ASSIGNMENT';
      }>(c);
      
      const db = drizzle(c.env.DB);
      const unallocatedService = createUnallocatedInventoryService(db);
      
      // Assign to central warehouse
      const assignment = await unallocatedService.assignToCentralWarehouse(
        poItemId,
        validatedData.centralWarehouseId,
        authContext.tenant_id,
        authContext.user_id,
        validatedData.reason
      );
      
      // Log assignment
      await auditService.logSensitiveOperation('UNALLOCATED_ASSIGNED_TO_CENTRAL', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Unallocated quantity assigned to central warehouse: ${assignment.quantityAssigned} units from PO item ${poItemId} (${assignment.assignmentReason})`
      });
      
      return c.json({
        success: true,
        assignment: {
          poItemId: assignment.poItemId,
          centralWarehouseId: assignment.centralWarehouseId,
          quantityAssigned: assignment.quantityAssigned,
          assignmentReason: assignment.assignmentReason,
          assignedAt: assignment.assignedAt,
          assignedBy: assignment.assignedBy,
        },
        message: 'Unallocated quantity successfully assigned to central warehouse'
      }, 201);
      
    } catch (error) {
      // Log failed assignment
      await auditService.logSensitiveOperation('CENTRAL_ASSIGNMENT_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Central warehouse assignment failed for PO item ${poItemId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * POST /unallocated-inventory/process-auto-assignments - Process automatic assignments
 * Requirements: 3.3, 3.4
 * 
 * This endpoint demonstrates:
 * - Bulk automatic assignment processing
 * - Tenant configuration-based automation
 * - System-triggered assignment operations
 */
unallocatedInventory.post('/unallocated-inventory/process-auto-assignments',
  requirePurchaseOrderAccess('write'),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    
    try {
      const db = drizzle(c.env.DB);
      const unallocatedService = createUnallocatedInventoryService(db);
      
      // Process automatic assignments
      const assignments = await unallocatedService.processAutoAssignments(authContext.tenant_id);
      
      // Log bulk assignment operation
      await auditService.logSensitiveOperation('AUTO_ASSIGNMENTS_PROCESSED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Processed ${assignments.length} automatic assignments to central warehouse`
      });
      
      return c.json({
        success: true,
        processedAssignments: assignments.length,
        assignments: assignments.map(assignment => ({
          poItemId: assignment.poItemId,
          centralWarehouseId: assignment.centralWarehouseId,
          quantityAssigned: assignment.quantityAssigned,
          assignmentReason: assignment.assignmentReason,
          assignedAt: assignment.assignedAt,
        })),
        message: `Successfully processed ${assignments.length} automatic assignments`
      });
      
    } catch (error) {
      // Log failed processing
      await auditService.logSensitiveOperation('AUTO_ASSIGNMENT_PROCESSING_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Auto-assignment processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

export default unallocatedInventory;