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
  requireSupplierAccess,
  requireSupplierManagement
} from '../middleware/auth';
import { validateBody, validateQuery, getValidatedBody, getValidatedQuery } from '../middleware/error';
import { createSupplierService, CreateSupplierRequest, UpdateSupplierRequest } from '../services/supplier';
import { extractAuditContext } from '../services/audit';

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
}

// Validation schemas
const createSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(100, 'Supplier name too long'),
  contactEmail: z.string().email('Invalid email format').optional(),
  contactPhone: z.string().max(50, 'Phone number too long').optional(),
  address: z.string().max(500, 'Address too long').optional(),
  paymentTerms: z.string().max(200, 'Payment terms too long').optional(),
});

const updateSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(100, 'Supplier name too long').optional(),
  contactEmail: z.string().email('Invalid email format').optional(),
  contactPhone: z.string().max(50, 'Phone number too long').optional(),
  address: z.string().max(500, 'Address too long').optional(),
  paymentTerms: z.string().max(200, 'Payment terms too long').optional(),
});

const listSuppliersQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined).refine(val => val === undefined || (val > 0 && val <= 100), {
    message: 'Limit must be between 1 and 100'
  }),
  offset: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined).refine(val => val === undefined || val >= 0, {
    message: 'Offset must be non-negative'
  }),
});

const supplierAnalyticsQuerySchema = z.object({
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
});

// Initialize suppliers router
const suppliers = new Hono<{ Bindings: Env }>();

// Apply authentication and context to all routes
suppliers.use('*', authenticate());
suppliers.use('*', injectTenantContext());
suppliers.use('*', injectAuditService());
suppliers.use('*', injectAuthorizationService());

/**
 * POST /suppliers - Create a new supplier (ADMIN and MANAGER only)
 * Requirements: 1.1, 1.2
 * 
 * This endpoint demonstrates:
 * - Role-based authorization for supplier management
 * - Supplier creation with proper validation
 * - Audit logging for supplier management
 * - Tenant isolation for supplier data
 */
suppliers.post('/', 
  requireSupplierAccess('write'),
  requireSupplierManagement(),
  validateBody(createSupplierSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    
    try {
      const validatedData = getValidatedBody<CreateSupplierRequest>(c);
      
      // Create supplier service
      const db = drizzle(c.env.DB);
      const supplierService = createSupplierService(db);
      
      // Create the supplier
      const newSupplier = await supplierService.createSupplier(authContext.tenant_id, validatedData);
      
      // Log supplier creation
      await auditService.logSensitiveOperation('SUPPLIER_CREATED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Supplier created: ${newSupplier.name}`
      });
      
      // Return supplier info
      return c.json({
        id: newSupplier.id,
        name: newSupplier.name,
        contactEmail: newSupplier.contactEmail,
        contactPhone: newSupplier.contactPhone,
        address: newSupplier.address,
        paymentTerms: newSupplier.paymentTerms,
        createdAt: newSupplier.createdAt,
        updatedAt: newSupplier.updatedAt,
      }, 201);
      
    } catch (error) {
      // Log failed supplier creation
      await auditService.logSensitiveOperation('SUPPLIER_CREATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Supplier creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /suppliers - List suppliers with search and pagination (ADMIN, MANAGER, STAFF)
 * Requirements: 1.2, 1.3
 * 
 * This endpoint demonstrates:
 * - Tenant-scoped supplier listing
 * - Search functionality
 * - Pagination support
 * - Role-based access (all authenticated users can view suppliers)
 */
suppliers.get('/',
  requireSupplierAccess('read'),
  validateQuery(listSuppliersQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      search?: string;
      limit?: number;
      offset?: number;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const supplierService = createSupplierService(db);
      
      // Get suppliers with search and pagination
      const result = await supplierService.listSuppliers(authContext.tenant_id, {
        search: query.search,
        limit: query.limit || 20,
        offset: query.offset || 0,
      });
      
      // Return supplier list
      return c.json({
        suppliers: result.suppliers.map(supplier => ({
          id: supplier.id,
          name: supplier.name,
          contactEmail: supplier.contactEmail,
          contactPhone: supplier.contactPhone,
          address: supplier.address,
          paymentTerms: supplier.paymentTerms,
          createdAt: supplier.createdAt,
          updatedAt: supplier.updatedAt,
        })),
        total: result.total,
        limit: query.limit || 20,
        offset: query.offset || 0,
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /suppliers/:supplierId - Get supplier details (ADMIN, MANAGER, STAFF)
 * Requirements: 1.2
 * 
 * This endpoint demonstrates:
 * - Individual supplier retrieval
 * - Tenant isolation
 * - Detailed supplier information
 */
suppliers.get('/:supplierId', 
  requireSupplierAccess('read'),
  async (c) => {
  const authContext = getAuthContext(c);
  const supplierId = c.req.param('supplierId');
  
  try {
    const db = drizzle(c.env.DB);
    const supplierService = createSupplierService(db);
    
    const supplier = await supplierService.getSupplier(authContext.tenant_id, supplierId);
    
    if (!supplier) {
      return c.json({
        error: 'Not Found',
        message: 'Supplier not found'
      }, 404);
    }
    
    // Return supplier details
    return c.json({
      id: supplier.id,
      name: supplier.name,
      contactEmail: supplier.contactEmail,
      contactPhone: supplier.contactPhone,
      address: supplier.address,
      paymentTerms: supplier.paymentTerms,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
    });
    
  } catch (error) {
    throw error; // Let error middleware handle it
  }
});

/**
 * PUT /suppliers/:supplierId - Update supplier information (ADMIN and MANAGER only)
 * Requirements: 1.2, 1.3
 * 
 * This endpoint demonstrates:
 * - Role-based authorization for supplier updates
 * - Supplier information updates
 * - Audit logging for supplier changes
 * - Tenant isolation
 */
suppliers.put('/:supplierId',
  requireSupplierAccess('write'),
  requireSupplierManagement(),
  validateBody(updateSupplierSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const supplierId = c.req.param('supplierId');
    
    try {
      const updates = getValidatedBody<UpdateSupplierRequest>(c);
      
      const db = drizzle(c.env.DB);
      const supplierService = createSupplierService(db);
      
      // Update supplier
      const updatedSupplier = await supplierService.updateSupplier(
        authContext.tenant_id,
        supplierId,
        updates
      );
      
      // Log supplier update
      await auditService.logSensitiveOperation('SUPPLIER_UPDATED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Supplier updated: ${updatedSupplier.name}`
      });
      
      return c.json({
        id: updatedSupplier.id,
        name: updatedSupplier.name,
        contactEmail: updatedSupplier.contactEmail,
        contactPhone: updatedSupplier.contactPhone,
        address: updatedSupplier.address,
        paymentTerms: updatedSupplier.paymentTerms,
        createdAt: updatedSupplier.createdAt,
        updatedAt: updatedSupplier.updatedAt,
        message: 'Supplier updated successfully'
      });
      
    } catch (error) {
      // Log failed supplier update
      await auditService.logSensitiveOperation('SUPPLIER_UPDATE_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Supplier update failed for ${supplierId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * DELETE /suppliers/:supplierId - Delete supplier (ADMIN only)
 * Requirements: 1.3
 * 
 * This endpoint demonstrates:
 * - ADMIN-only destructive operations
 * - Supplier deletion with business rule validation
 * - Audit logging for supplier deletion
 * - Tenant isolation
 */
suppliers.delete('/:supplierId',
  requireSupplierAccess('delete'),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const supplierId = c.req.param('supplierId');
    
    try {
      const db = drizzle(c.env.DB);
      const supplierService = createSupplierService(db);
      
      // Get supplier info before deletion for audit log
      const supplierToDelete = await supplierService.getSupplier(authContext.tenant_id, supplierId);
      if (!supplierToDelete) {
        return c.json({
          error: 'Not Found',
          message: 'Supplier not found'
        }, 404);
      }
      
      // Delete supplier
      const success = await supplierService.deleteSupplier(authContext.tenant_id, supplierId);
      
      if (!success) {
        return c.json({
          error: 'Internal Server Error',
          message: 'Failed to delete supplier'
        }, 500);
      }
      
      // Log supplier deletion
      await auditService.logSensitiveOperation('SUPPLIER_DELETED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Supplier deleted: ${supplierToDelete.name}`
      });
      
      return c.json({
        message: 'Supplier deleted successfully'
      });
      
    } catch (error) {
      // Log failed supplier deletion
      await auditService.logSensitiveOperation('SUPPLIER_DELETION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Supplier deletion failed for ${supplierId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /suppliers/:supplierId/analytics - Get supplier analytics (ADMIN and MANAGER only)
 * Requirements: 1.3
 * 
 * This endpoint demonstrates:
 * - Supplier analytics and reporting
 * - Date range filtering
 * - Business intelligence features
 * - Role-based access to analytics
 */
suppliers.get('/:supplierId/analytics',
  requireSupplierAccess('read'),
  validateQuery(supplierAnalyticsQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const supplierId = c.req.param('supplierId');
    const query = getValidatedQuery<{
      startDate?: Date;
      endDate?: Date;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const supplierService = createSupplierService(db);
      
      // Build date range if provided
      let dateRange;
      if (query.startDate && query.endDate) {
        dateRange = {
          startDate: query.startDate,
          endDate: query.endDate,
        };
      }
      
      // Get supplier analytics
      const analytics = await supplierService.getSupplierAnalytics(
        authContext.tenant_id,
        supplierId,
        dateRange
      );
      
      return c.json(analytics);
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

export default suppliers;