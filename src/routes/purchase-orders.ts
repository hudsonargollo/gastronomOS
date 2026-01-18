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
  requirePurchaseOrderAccess,
  requirePurchaseOrderApproval,
  requirePurchaseOrderReceiving
} from '../middleware/auth';
import { validateBody, validateQuery, getValidatedBody, getValidatedQuery } from '../middleware/error';
import { createPurchaseOrderService, POLineItemRequest, BulkPOTemplate, BulkLineItemImport, BulkApprovalRequest } from '../services/purchase-order';
import { POStatusType } from '../db/schema';
import { extractAuditContext } from '../services/audit';

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
}

// Validation schemas
const createPOSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  notes: z.string().optional(),
});

const addLineItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantityOrdered: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPriceCents: z.number().int().min(1, 'Unit price must be at least 1 cent'),
  notes: z.string().optional(),
});

const updateLineItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required').optional(),
  quantityOrdered: z.number().int().min(1, 'Quantity must be at least 1').optional(),
  unitPriceCents: z.number().int().min(1, 'Unit price must be at least 1 cent').optional(),
  notes: z.string().optional(),
});

const listPOsQuerySchema = z.object({
  status: z.enum(['DRAFT', 'APPROVED', 'RECEIVED', 'CANCELLED']).optional(),
  supplierId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const receivePOSchema = z.object({
  receivedItems: z.array(z.object({
    poItemId: z.string().min(1, 'PO item ID is required'),
    quantityReceived: z.number().int().min(0, 'Quantity received must be non-negative'),
    variance: z.string().optional(),
    notes: z.string().optional(),
  })).min(1, 'At least one received item is required'),
  receivedDate: z.string().datetime('Invalid date format'),
});

const cancelPOSchema = z.object({
  reason: z.string().min(1, 'Reason is required for cancellation').optional(),
});

// Bulk operations schemas
const bulkPOTemplateSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  notes: z.string().optional(),
  items: z.array(addLineItemSchema).min(1, 'At least one item is required'),
});

const createBulkPOsSchema = z.object({
  templates: z.array(bulkPOTemplateSchema).min(1, 'At least one template is required').max(50, 'Maximum 50 templates allowed'),
});

const addBulkLineItemsSchema = z.object({
  items: z.array(addLineItemSchema).min(1, 'At least one item is required').max(100, 'Maximum 100 items allowed'),
});

const bulkApprovalSchema = z.object({
  poIds: z.array(z.string().min(1)).min(1, 'At least one PO ID is required').max(50, 'Maximum 50 POs allowed'),
  reason: z.string().optional(),
});

// Initialize purchase orders router
const purchaseOrders = new Hono<{ Bindings: Env }>();

// Apply authentication and context to all routes
purchaseOrders.use('*', authenticate());
purchaseOrders.use('*', injectTenantContext());
purchaseOrders.use('*', injectAuditService());
purchaseOrders.use('*', injectAuthorizationService());

/**
 * POST /purchase-orders - Create a new purchase order draft (ADMIN and MANAGER only)
 * Requirements: 2.1
 * 
 * This endpoint demonstrates:
 * - Role-based authorization for PO creation
 * - Purchase order draft creation
 * - Audit logging for PO management
 * - Tenant isolation for PO data
 */
purchaseOrders.post('/', 
  requirePurchaseOrderAccess('write'),
  validateBody(createPOSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    
    try {
      const validatedData = getValidatedBody<{ supplierId: string; notes?: string }>(c);
      
      // Create purchase order service
      const db = drizzle(c.env.DB);
      const poService = createPurchaseOrderService(db);
      
      // Create the purchase order draft
      const newPO = await poService.createDraft(
        validatedData.supplierId,
        authContext.tenant_id,
        authContext.user_id
      );
      
      // Log PO creation
      await auditService.logSensitiveOperation('PO_CREATED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Purchase Order created: ${newPO.id}`
      });
      
      // Return PO info
      return c.json({
        id: newPO.id,
        supplierId: newPO.supplierId,
        status: newPO.status,
        totalCostCents: newPO.totalCostCents,
        createdBy: newPO.createdBy,
        createdAt: newPO.createdAt,
        updatedAt: newPO.updatedAt,
        message: 'Purchase order draft created successfully'
      }, 201);
      
    } catch (error) {
      // Log failed PO creation
      await auditService.logSensitiveOperation('PO_CREATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Purchase Order creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /purchase-orders - List purchase orders with filtering and pagination
 * Requirements: 2.1, 2.3
 * 
 * This endpoint demonstrates:
 * - Tenant-scoped PO listing
 * - Status and supplier filtering
 * - Pagination support
 * - Role-based access (all authenticated users can view POs)
 */
purchaseOrders.get('/',
  requirePurchaseOrderAccess('read'),
  validateQuery(listPOsQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      status?: POStatusType;
      supplierId?: string;
      limit: number;
      offset: number;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const poService = createPurchaseOrderService(db);
      
      // Get purchase orders with filtering and pagination
      const result = await poService.listPurchaseOrders(authContext.tenant_id, {
        ...(query.status && { status: query.status }),
        ...(query.supplierId && { supplierId: query.supplierId }),
        limit: query.limit,
        offset: query.offset,
      });
      
      // Return PO list with items and supplier info
      return c.json({
        purchaseOrders: result.purchaseOrders.map(po => ({
          id: po.id,
          supplierId: po.supplierId,
          supplier: po.supplier,
          poNumber: po.poNumber,
          status: po.status,
          totalCostCents: po.totalCostCents,
          itemCount: po.items.length,
          createdBy: po.createdBy,
          approvedBy: po.approvedBy,
          approvedAt: po.approvedAt,
          receivedBy: po.receivedBy,
          receivedAt: po.receivedAt,
          createdAt: po.createdAt,
          updatedAt: po.updatedAt,
          // Include first few items for preview
          items: po.items.slice(0, 3).map(item => ({
            id: item.id,
            productId: item.productId,
            quantityOrdered: item.quantityOrdered,
            unitPriceCents: item.unitPriceCents,
            lineTotalCents: item.lineTotalCents,
          })),
        })),
        total: result.total,
        limit: query.limit,
        offset: query.offset,
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /purchase-orders/:poId - Get purchase order details with all line items
 * Requirements: 2.1, 2.2
 * 
 * This endpoint demonstrates:
 * - Individual PO retrieval with complete details
 * - Tenant isolation
 * - Line item details and calculations
 */
purchaseOrders.get('/:poId', 
  requirePurchaseOrderAccess('read'),
  async (c) => {
  const authContext = getAuthContext(c);
  const poId = c.req.param('poId');
  
  try {
    const db = drizzle(c.env.DB);
    const poService = createPurchaseOrderService(db);
    
    const po = await poService.getPOWithItems(poId, authContext.tenant_id);
    
    if (!po) {
      return c.json({
        error: 'Not Found',
        message: 'Purchase order not found'
      }, 404);
    }
    
    // Return complete PO details
    return c.json({
      id: po.id,
      supplierId: po.supplierId,
      supplier: po.supplier,
      poNumber: po.poNumber,
      status: po.status,
      totalCostCents: po.totalCostCents,
      createdBy: po.createdBy,
      approvedBy: po.approvedBy,
      approvedAt: po.approvedAt,
      receivedBy: po.receivedBy,
      receivedAt: po.receivedAt,
      notes: po.notes,
      createdAt: po.createdAt,
      updatedAt: po.updatedAt,
      items: po.items.map(item => ({
        id: item.id,
        productId: item.productId,
        quantityOrdered: item.quantityOrdered,
        unitPriceCents: item.unitPriceCents,
        quantityReceived: item.quantityReceived,
        lineTotalCents: item.lineTotalCents,
        notes: item.notes,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    });
    
  } catch (error) {
    throw error; // Let error middleware handle it
  }
});

/**
 * POST /purchase-orders/:poId/items - Add line item to purchase order
 * Requirements: 2.1, 2.2
 * 
 * This endpoint demonstrates:
 * - Line item management for draft POs
 * - Product validation and pricing
 * - Automatic total calculation
 * - Role-based authorization for PO modifications
 */
purchaseOrders.post('/:poId/items',
  requirePurchaseOrderAccess('write'),
  validateBody(addLineItemSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const poId = c.req.param('poId');
    
    try {
      const itemData = getValidatedBody<POLineItemRequest>(c);
      
      const db = drizzle(c.env.DB);
      const poService = createPurchaseOrderService(db);
      
      // Add line item to PO
      const newItem = await poService.addLineItem(poId, authContext.tenant_id, itemData);
      
      // Log line item addition
      await auditService.logSensitiveOperation('PO_ITEM_ADDED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Line item added to PO ${poId}: Product ${itemData.productId}`
      });
      
      return c.json({
        id: newItem.id,
        poId: newItem.poId,
        productId: newItem.productId,
        quantityOrdered: newItem.quantityOrdered,
        unitPriceCents: newItem.unitPriceCents,
        lineTotalCents: newItem.lineTotalCents,
        notes: newItem.notes,
        createdAt: newItem.createdAt,
        updatedAt: newItem.updatedAt,
        message: 'Line item added successfully'
      }, 201);
      
    } catch (error) {
      // Log failed line item addition
      await auditService.logSensitiveOperation('PO_ITEM_ADD_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Line item addition failed for PO ${poId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * PUT /purchase-orders/:poId/items/:itemId - Update line item in purchase order
 * Requirements: 2.1, 2.2
 * 
 * This endpoint demonstrates:
 * - Line item updates for draft POs
 * - Quantity and price modifications
 * - Automatic total recalculation
 * - Role-based authorization for PO modifications
 */
purchaseOrders.put('/:poId/items/:itemId',
  requirePurchaseOrderAccess('write'),
  validateBody(updateLineItemSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const poId = c.req.param('poId');
    const itemId = c.req.param('itemId');
    
    try {
      const updates = getValidatedBody<Partial<POLineItemRequest>>(c);
      
      const db = drizzle(c.env.DB);
      const poService = createPurchaseOrderService(db);
      
      // Update line item
      const updatedItem = await poService.updateLineItem(itemId, authContext.tenant_id, updates);
      
      // Log line item update
      await auditService.logSensitiveOperation('PO_ITEM_UPDATED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Line item updated in PO ${poId}: Item ${itemId}`
      });
      
      return c.json({
        id: updatedItem.id,
        poId: updatedItem.poId,
        productId: updatedItem.productId,
        quantityOrdered: updatedItem.quantityOrdered,
        unitPriceCents: updatedItem.unitPriceCents,
        lineTotalCents: updatedItem.lineTotalCents,
        notes: updatedItem.notes,
        createdAt: updatedItem.createdAt,
        updatedAt: updatedItem.updatedAt,
        message: 'Line item updated successfully'
      });
      
    } catch (error) {
      // Log failed line item update
      await auditService.logSensitiveOperation('PO_ITEM_UPDATE_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Line item update failed for PO ${poId}, Item ${itemId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * DELETE /purchase-orders/:poId/items/:itemId - Remove line item from purchase order
 * Requirements: 2.1
 * 
 * This endpoint demonstrates:
 * - Line item removal for draft POs
 * - Automatic total recalculation
 * - Role-based authorization for PO modifications
 */
purchaseOrders.delete('/:poId/items/:itemId',
  requirePurchaseOrderAccess('write'),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const poId = c.req.param('poId');
    const itemId = c.req.param('itemId');
    
    try {
      const db = drizzle(c.env.DB);
      const poService = createPurchaseOrderService(db);
      
      // Remove line item
      await poService.removeLineItem(itemId, authContext.tenant_id);
      
      // Log line item removal
      await auditService.logSensitiveOperation('PO_ITEM_REMOVED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Line item removed from PO ${poId}: Item ${itemId}`
      });
      
      return c.json({
        message: 'Line item removed successfully'
      });
      
    } catch (error) {
      // Log failed line item removal
      await auditService.logSensitiveOperation('PO_ITEM_REMOVAL_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Line item removal failed for PO ${poId}, Item ${itemId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * POST /purchase-orders/:poId/approve - Approve purchase order using state machine
 * Requirements: 2.4, 2.5
 * 
 * This endpoint demonstrates:
 * - PO approval workflow using state machine
 * - Role-based authorization for approvals
 * - State transition validation and logging
 * - PO number generation on approval
 */
purchaseOrders.post('/:poId/approve',
  requirePurchaseOrderAccess('approve'),
  requirePurchaseOrderApproval(),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const poId = c.req.param('poId');
    
    try {
      const db = drizzle(c.env.DB);
      const poService = createPurchaseOrderService(db);
      
      // Approve PO using state machine
      const approvedPO = await poService.approvePO(poId, authContext.tenant_id, authContext.user_id);
      
      // Log PO approval
      await auditService.logSensitiveOperation('PO_APPROVED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Purchase Order approved: ${poId}, PO Number: ${approvedPO.poNumber}`
      });
      
      return c.json({
        id: approvedPO.id,
        poNumber: approvedPO.poNumber,
        status: approvedPO.status,
        approvedBy: approvedPO.approvedBy,
        approvedAt: approvedPO.approvedAt,
        updatedAt: approvedPO.updatedAt,
        message: 'Purchase order approved successfully'
      });
      
    } catch (error) {
      // Log failed PO approval
      await auditService.logSensitiveOperation('PO_APPROVAL_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Purchase Order approval failed for ${poId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * POST /purchase-orders/:poId/receive - Receive purchase order using state machine
 * Requirements: 2.5
 * 
 * This endpoint demonstrates:
 * - PO receiving workflow using state machine
 * - Line item quantity receiving with variance tracking
 * - Role-based authorization for receiving
 * - State transition validation and logging
 */
purchaseOrders.post('/:poId/receive',
  requirePurchaseOrderAccess('receive'),
  requirePurchaseOrderReceiving(),
  validateBody(receivePOSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const poId = c.req.param('poId');
    
    try {
      const receivingData = getValidatedBody<{
        receivedItems: Array<{
          poItemId: string;
          quantityReceived: number;
          variance?: string;
          notes?: string;
        }>;
        receivedDate: string;
      }>(c);
      
      const db = drizzle(c.env.DB);
      const poService = createPurchaseOrderService(db);
      
      // Convert receiving data to service format
      const serviceReceivingData = {
        receivedItems: receivingData.receivedItems,
        receivedDate: new Date(receivingData.receivedDate),
        receivedBy: authContext.user_id,
      };
      
      // Receive PO using state machine
      const receivedPO = await poService.receivePO(poId, authContext.tenant_id, serviceReceivingData);
      
      // Log PO receiving
      await auditService.logSensitiveOperation('PO_RECEIVED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Purchase Order received: ${poId}, PO Number: ${receivedPO.poNumber}, Items: ${receivingData.receivedItems.length}`
      });
      
      return c.json({
        id: receivedPO.id,
        poNumber: receivedPO.poNumber,
        status: receivedPO.status,
        receivedBy: receivedPO.receivedBy,
        receivedAt: receivedPO.receivedAt,
        updatedAt: receivedPO.updatedAt,
        itemsReceived: receivingData.receivedItems.length,
        message: 'Purchase order received successfully'
      });
      
    } catch (error) {
      // Log failed PO receiving
      await auditService.logSensitiveOperation('PO_RECEIVING_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Purchase Order receiving failed for ${poId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * POST /purchase-orders/:poId/cancel - Cancel purchase order using state machine
 * Requirements: 2.4, 2.5
 * 
 * This endpoint demonstrates:
 * - PO cancellation workflow using state machine
 * - Optional reason requirement for approved PO cancellations
 * - Role-based authorization for cancellations
 * - State transition validation and logging
 */
purchaseOrders.post('/:poId/cancel',
  requirePurchaseOrderAccess('cancel'),
  validateBody(cancelPOSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const poId = c.req.param('poId');
    
    try {
      const cancelData = getValidatedBody<{ reason?: string }>(c);
      
      const db = drizzle(c.env.DB);
      const poService = createPurchaseOrderService(db);
      
      // Cancel PO using state machine
      const cancelledPO = await poService.cancelPO(
        poId, 
        authContext.tenant_id, 
        authContext.user_id,
        cancelData.reason
      );
      
      // Log PO cancellation
      await auditService.logSensitiveOperation('PO_CANCELLED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Purchase Order cancelled: ${poId}, PO Number: ${cancelledPO.poNumber || 'N/A'}, Reason: ${cancelData.reason || 'No reason provided'}`
      });
      
      return c.json({
        id: cancelledPO.id,
        poNumber: cancelledPO.poNumber,
        status: cancelledPO.status,
        updatedAt: cancelledPO.updatedAt,
        reason: cancelData.reason,
        message: 'Purchase order cancelled successfully'
      });
      
    } catch (error) {
      // Log failed PO cancellation
      await auditService.logSensitiveOperation('PO_CANCELLATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Purchase Order cancellation failed for ${poId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * POST /purchase-orders/bulk/create - Create multiple purchase orders from templates
 * Requirements: 2.3
 * 
 * This endpoint demonstrates:
 * - Bulk PO creation from templates
 * - Batch processing with error handling
 * - Role-based authorization for bulk operations
 * - Comprehensive result reporting
 */
purchaseOrders.post('/bulk/create',
  requirePurchaseOrderAccess('write'),
  validateBody(createBulkPOsSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    
    try {
      const requestData = getValidatedBody<{
        templates: Array<{
          supplierId: string;
          notes?: string;
          items: POLineItemRequest[];
        }>;
      }>(c);
      
      const db = drizzle(c.env.DB);
      const poService = createPurchaseOrderService(db);
      
      // Create bulk POs from templates
      const result = await poService.createBulkPOsFromTemplates(
        requestData.templates,
        authContext.tenant_id,
        authContext.user_id
      );
      
      // Log bulk PO creation
      await auditService.logSensitiveOperation('BULK_PO_CREATED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Bulk PO creation: ${result.summary.successful} successful, ${result.summary.failed} failed`
      });
      
      return c.json({
        ...result,
        message: `Bulk PO creation completed: ${result.summary.successful} successful, ${result.summary.failed} failed`
      }, 201);
      
    } catch (error) {
      // Log failed bulk PO creation
      await auditService.logSensitiveOperation('BULK_PO_CREATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Bulk PO creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * POST /purchase-orders/:poId/bulk/items - Add multiple line items to a purchase order
 * Requirements: 2.3
 * 
 * This endpoint demonstrates:
 * - Bulk line item import
 * - CSV/Excel-like data processing
 * - Batch error handling and reporting
 * - Role-based authorization for bulk modifications
 */
purchaseOrders.post('/:poId/bulk/items',
  requirePurchaseOrderAccess('write'),
  validateBody(addBulkLineItemsSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const poId = c.req.param('poId');
    
    try {
      const requestData = getValidatedBody<{
        items: POLineItemRequest[];
      }>(c);
      
      const db = drizzle(c.env.DB);
      const poService = createPurchaseOrderService(db);
      
      // Add bulk line items
      const result = await poService.addBulkLineItems(
        poId,
        authContext.tenant_id,
        requestData.items
      );
      
      // Log bulk line item addition
      await auditService.logSensitiveOperation('BULK_ITEMS_ADDED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Bulk items added to PO ${poId}: ${result.summary.successful} successful, ${result.summary.failed} failed`
      });
      
      return c.json({
        ...result,
        message: `Bulk line items added: ${result.summary.successful} successful, ${result.summary.failed} failed`
      }, 201);
      
    } catch (error) {
      // Log failed bulk line item addition
      await auditService.logSensitiveOperation('BULK_ITEMS_ADD_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Bulk items addition failed for PO ${poId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * POST /purchase-orders/bulk/approve - Approve multiple purchase orders
 * Requirements: 2.3
 * 
 * This endpoint demonstrates:
 * - Bulk PO approval workflow
 * - Batch state machine transitions
 * - Role-based authorization for bulk approvals
 * - Comprehensive error handling and reporting
 */
purchaseOrders.post('/bulk/approve',
  requirePurchaseOrderAccess('approve'),
  requirePurchaseOrderApproval(),
  validateBody(bulkApprovalSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    
    try {
      const requestData = getValidatedBody<{
        poIds: string[];
        reason?: string;
      }>(c);
      
      const db = drizzle(c.env.DB);
      const poService = createPurchaseOrderService(db);
      
      // Bulk approve POs
      const result = await poService.bulkApprovePOs(
        {
          poIds: requestData.poIds,
          approverId: authContext.user_id,
          reason: requestData.reason,
        },
        authContext.tenant_id
      );
      
      // Log bulk PO approval
      await auditService.logSensitiveOperation('BULK_PO_APPROVED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Bulk PO approval: ${result.summary.successful} successful, ${result.summary.failed} failed`
      });
      
      return c.json({
        ...result,
        message: `Bulk PO approval completed: ${result.summary.successful} successful, ${result.summary.failed} failed`
      });
      
    } catch (error) {
      // Log failed bulk PO approval
      await auditService.logSensitiveOperation('BULK_PO_APPROVAL_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Bulk PO approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /purchase-orders/:id/allocations - Get allocation matrix for a purchase order
 * Requirements: 1.3, 1.4, 3.1, 3.2
 * 
 * This endpoint demonstrates:
 * - Allocation matrix calculation
 * - Unallocated quantity tracking
 * - Location-based allocation summaries
 */
purchaseOrders.get('/:id/allocations',
  requirePurchaseOrderAccess('read'),
  async (c) => {
    const authContext = getAuthContext(c);
    const poId = c.req.param('id');
    
    if (!poId) {
      return c.json({ error: 'Purchase order ID is required' }, 400);
    }
    
    try {
      const db = drizzle(c.env.DB);
      
      // Import allocation service here to avoid circular dependencies
      const { createAllocationService } = await import('../services/allocation');
      const allocationService = createAllocationService(db);
      
      // Get allocation matrix for the PO
      const allocationMatrix = await allocationService.getAllocationsForPO(poId, authContext.tenant_id);
      
      return c.json(allocationMatrix);
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

export default purchaseOrders;