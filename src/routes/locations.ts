import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { 
  authenticate, 
  requireRole, 
  requireLocationAccess,
  injectTenantContext,
  injectAuditService,
  injectAuthorizationService,
  getAuthContext,
  getAuditService
} from '../middleware/auth';
import { validateBody, validateQuery, getValidatedBody, getValidatedQuery } from '../middleware/error';
import { locations, users, UserRole } from '../db/schema';
import { extractAuditContext } from '../services/audit';
import { generateLocationId } from '../utils';

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
}

// Validation schemas
const createLocationSchema = z.object({
  name: z.string().min(1, 'Location name is required').max(100, 'Location name too long'),
  type: z.enum(['COMMISSARY', 'RESTAURANT', 'POP_UP'], {
    errorMap: () => ({ message: 'Type must be COMMISSARY, RESTAURANT, or POP_UP' })
  }),
  address: z.string().max(500, 'Address too long').optional(),
});

const updateLocationSchema = z.object({
  name: z.string().min(1, 'Location name is required').max(100, 'Location name too long').optional(),
  type: z.enum(['COMMISSARY', 'RESTAURANT', 'POP_UP'], {
    errorMap: () => ({ message: 'Type must be COMMISSARY, RESTAURANT, or POP_UP' })
  }).optional(),
  address: z.string().max(500, 'Address too long').optional(),
});

const locationInventoryQuerySchema = z.object({
  category: z.string().optional(),
  lowStock: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined).refine(val => val === undefined || (val > 0 && val <= 100), {
    message: 'Limit must be between 1 and 100'
  }),
});

// Initialize locations router
const locationsRouter = new Hono<{ Bindings: Env }>();

// Apply authentication and context to all routes
locationsRouter.use('*', authenticate());
locationsRouter.use('*', injectTenantContext());
locationsRouter.use('*', injectAuditService());
locationsRouter.use('*', injectAuthorizationService());

/**
 * POST /locations - Create a new location (ADMIN only)
 * Requirements: 1.1, 4.3
 * 
 * This endpoint demonstrates:
 * - ADMIN-only location creation
 * - Tenant-scoped location management
 * - Audit logging for location creation
 */
locationsRouter.post('/', 
  requireRole([UserRole.ADMIN]),
  validateBody(createLocationSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    
    try {
      const validatedData = getValidatedBody<{
        name: string;
        type: 'COMMISSARY' | 'RESTAURANT' | 'POP_UP';
        address?: string;
      }>(c);
      
      const db = drizzle(c.env.DB);
      
      // Create new location
      const newLocation = {
        id: generateLocationId(),
        tenantId: authContext.tenant_id,
        name: validatedData.name,
        type: validatedData.type,
        address: validatedData.address || null,
        createdAt: Math.floor(Date.now() / 1000),
      };
      
      const [createdLocation] = await db
        .insert(locations)
        .values(newLocation)
        .returning();
      
      if (!createdLocation) {
        throw new Error('Failed to create location');
      }
      
      // Log location creation
      await auditService.logSensitiveOperation('LOCATION_CREATED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Location created: ${createdLocation.name} (${createdLocation.type})`
      });
      
      return c.json({
        id: createdLocation.id,
        name: createdLocation.name,
        type: createdLocation.type,
        address: createdLocation.address,
        createdAt: createdLocation.createdAt,
      }, 201);
      
    } catch (error) {
      // Log failed location creation
      await auditService.logSensitiveOperation('LOCATION_CREATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Location creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /locations - List all locations (ADMIN and MANAGER only)
 * Requirements: 5.4, 7.1
 * 
 * This endpoint demonstrates:
 * - Role-based access to location listing
 * - Tenant-scoped location queries
 */
locationsRouter.get('/',
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  async (c) => {
    const authContext = getAuthContext(c);
    
    try {
      const db = drizzle(c.env.DB);
      
      // Get all locations for the tenant
      const tenantLocations = await db
        .select()
        .from(locations)
        .where(eq(locations.tenantId, authContext.tenant_id));
      
      return c.json({
        locations: tenantLocations.map(location => ({
          id: location.id,
          name: location.name,
          type: location.type,
          address: location.address,
          createdAt: location.createdAt,
        })),
        total: tenantLocations.length,
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /locations/:locationId - Get specific location details
 * Requirements: 5.1, 5.2, 7.3
 * 
 * This endpoint demonstrates:
 * - Location-specific access control
 * - Users can only access their assigned location (unless ADMIN)
 * - Location-scoped data retrieval
 */
locationsRouter.get('/:locationId',
  requireLocationAccess(),
  async (c) => {
    const authContext = getAuthContext(c);
    const locationId = c.req.param('locationId');
    
    try {
      const db = drizzle(c.env.DB);
      
      // Get location details (already validated by requireLocationAccess middleware)
      const [location] = await db
        .select()
        .from(locations)
        .where(and(
          eq(locations.id, locationId),
          eq(locations.tenantId, authContext.tenant_id)
        ))
        .limit(1);
      
      if (!location) {
        return c.json({
          error: 'Not Found',
          message: 'Location not found'
        }, 404);
      }
      
      return c.json({
        id: location.id,
        name: location.name,
        type: location.type,
        address: location.address,
        createdAt: location.createdAt,
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * PUT /locations/:locationId - Update location details (ADMIN only)
 * Requirements: 4.3, 5.1
 * 
 * This endpoint demonstrates:
 * - ADMIN-only location management
 * - Location-specific updates
 * - Audit logging for location changes
 */
locationsRouter.put('/:locationId',
  requireRole([UserRole.ADMIN]),
  validateBody(updateLocationSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const locationId = c.req.param('locationId');
    
    try {
      const updates = getValidatedBody<{
        name?: string;
        type?: 'COMMISSARY' | 'RESTAURANT' | 'POP_UP';
        address?: string;
      }>(c);
      
      const db = drizzle(c.env.DB);
      
      // Check if location exists and belongs to tenant
      const [existingLocation] = await db
        .select()
        .from(locations)
        .where(and(
          eq(locations.id, locationId),
          eq(locations.tenantId, authContext.tenant_id)
        ))
        .limit(1);
      
      if (!existingLocation) {
        return c.json({
          error: 'Not Found',
          message: 'Location not found'
        }, 404);
      }
      
      // Update location
      const [updatedLocation] = await db
        .update(locations)
        .set(updates)
        .where(and(
          eq(locations.id, locationId),
          eq(locations.tenantId, authContext.tenant_id)
        ))
        .returning();
      
      if (!updatedLocation) {
        throw new Error('Failed to update location');
      }
      
      // Log location update
      await auditService.logSensitiveOperation('LOCATION_UPDATED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Location updated: ${updatedLocation.name} (${updatedLocation.type})`
      });
      
      return c.json({
        id: updatedLocation.id,
        name: updatedLocation.name,
        type: updatedLocation.type,
        address: updatedLocation.address,
        createdAt: updatedLocation.createdAt,
        message: 'Location updated successfully'
      });
      
    } catch (error) {
      // Log failed location update
      await auditService.logSensitiveOperation('LOCATION_UPDATE_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Location update failed for ${locationId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /locations/:locationId/users - Get users assigned to a location (ADMIN and MANAGER only)
 * Requirements: 5.1, 5.2, 4.3, 4.4
 * 
 * This endpoint demonstrates:
 * - Location-scoped user queries
 * - Role-based access to user information
 * - Location-based user management
 */
locationsRouter.get('/:locationId/users',
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  requireLocationAccess(),
  async (c) => {
    const authContext = getAuthContext(c);
    const locationId = c.req.param('locationId');
    
    try {
      const db = drizzle(c.env.DB);
      
      // Get users assigned to this location
      const locationUsers = await db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(and(
          eq(users.tenantId, authContext.tenant_id),
          eq(users.locationId, locationId)
        ));
      
      return c.json({
        users: locationUsers,
        locationId,
        total: locationUsers.length,
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /locations/:locationId/inventory - Get inventory for a location (mock endpoint)
 * Requirements: 5.1, 5.2, 7.3
 * 
 * This endpoint demonstrates:
 * - Location-scoped inventory access
 * - Query parameter validation
 * - Location-based data filtering
 * - Role-based access (all roles can view inventory)
 */
locationsRouter.get('/:locationId/inventory',
  requireLocationAccess(),
  validateQuery(locationInventoryQuerySchema),
  async (c) => {
    const locationId = c.req.param('locationId');
    const query = getValidatedQuery<{
      category?: string;
      lowStock?: boolean;
      limit?: number;
    }>(c);
    
    try {
      // This is a mock endpoint to demonstrate location-scoped access
      // In a real implementation, this would query an inventory table
      
      // Mock inventory data
      let mockInventory = [
        {
          id: 'inv_001',
          locationId,
          name: 'Tomatoes',
          category: 'vegetables',
          quantity: 50,
          unit: 'lbs',
          lowStockThreshold: 20,
          isLowStock: false,
        },
        {
          id: 'inv_002',
          locationId,
          name: 'Ground Beef',
          category: 'meat',
          quantity: 15,
          unit: 'lbs',
          lowStockThreshold: 25,
          isLowStock: true,
        },
        {
          id: 'inv_003',
          locationId,
          name: 'Flour',
          category: 'dry_goods',
          quantity: 100,
          unit: 'lbs',
          lowStockThreshold: 30,
          isLowStock: false,
        },
      ];
      
      // Apply filters
      if (query.category) {
        mockInventory = mockInventory.filter(item => item.category === query.category);
      }
      
      if (query.lowStock) {
        mockInventory = mockInventory.filter(item => item.isLowStock);
      }
      
      // Apply limit
      const limit = query.limit || 20;
      const limitedInventory = mockInventory.slice(0, limit);
      
      return c.json({
        inventory: limitedInventory,
        locationId,
        total: mockInventory.length,
        filters: {
          category: query.category,
          lowStock: query.lowStock,
        },
        message: 'This is a mock endpoint demonstrating location-scoped access'
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * POST /locations/:locationId/inventory/:itemId/update - Update inventory item (STAFF and above)
 * Requirements: 4.5, 5.1, 5.2, 7.3
 * 
 * This endpoint demonstrates:
 * - Location-scoped inventory updates
 * - Role-based write access (STAFF can update inventory)
 * - Location access validation
 * - Audit logging for inventory changes
 */
locationsRouter.post('/:locationId/inventory/:itemId/update',
  requireRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]),
  requireLocationAccess(),
  validateBody(z.object({
    quantity: z.number().min(0, 'Quantity must be non-negative'),
    notes: z.string().max(500, 'Notes too long').optional(),
  })),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const locationId = c.req.param('locationId');
    const itemId = c.req.param('itemId');
    
    try {
      const { quantity, notes } = getValidatedBody<{
        quantity: number;
        notes?: string;
      }>(c);
      
      // This is a mock endpoint to demonstrate location-scoped updates
      // In a real implementation, this would update an inventory table
      
      // Log inventory update
      await auditService.logSensitiveOperation('INVENTORY_UPDATED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Inventory updated at location ${locationId}: item ${itemId} quantity set to ${quantity}`
      });
      
      return c.json({
        itemId,
        locationId,
        quantity,
        notes,
        updatedBy: authContext.user_id,
        updatedAt: new Date().toISOString(),
        message: 'Inventory updated successfully (mock endpoint)'
      });
      
    } catch (error) {
      // Log failed inventory update
      await auditService.logSensitiveOperation('INVENTORY_UPDATE_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Inventory update failed at location ${locationId} for item ${itemId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * DELETE /locations/:locationId - Delete location (ADMIN only)
 * Requirements: 4.3
 * 
 * This endpoint demonstrates:
 * - ADMIN-only destructive operations
 * - Location deletion with proper validation
 * - Audit logging for location deletion
 */
locationsRouter.delete('/:locationId',
  requireRole([UserRole.ADMIN]),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    const locationId = c.req.param('locationId');
    
    try {
      const db = drizzle(c.env.DB);
      
      // Check if location exists and belongs to tenant
      const [existingLocation] = await db
        .select()
        .from(locations)
        .where(and(
          eq(locations.id, locationId),
          eq(locations.tenantId, authContext.tenant_id)
        ))
        .limit(1);
      
      if (!existingLocation) {
        return c.json({
          error: 'Not Found',
          message: 'Location not found'
        }, 404);
      }
      
      // Check if any users are assigned to this location
      const [assignedUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.tenantId, authContext.tenant_id),
          eq(users.locationId, locationId)
        ))
        .limit(1);
      
      if (assignedUser) {
        return c.json({
          error: 'Conflict',
          message: 'Cannot delete location with assigned users. Please reassign users first.'
        }, 409);
      }
      
      // Delete location
      await db
        .delete(locations)
        .where(and(
          eq(locations.id, locationId),
          eq(locations.tenantId, authContext.tenant_id)
        ));
      
      // Log location deletion
      await auditService.logSensitiveOperation('LOCATION_DELETED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Location deleted: ${existingLocation.name} (${existingLocation.type})`
      });
      
      return c.json({
        message: 'Location deleted successfully'
      });
      
    } catch (error) {
      // Log failed location deletion
      await auditService.logSensitiveOperation('LOCATION_DELETION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Location deletion failed for ${locationId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

export default locationsRouter;