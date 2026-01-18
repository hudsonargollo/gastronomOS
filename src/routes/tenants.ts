import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';
import { 
  authenticate, 
  requireRole, 
  injectTenantContext,
  injectAuditService,
  getAuthContext,
  getTenantService,
  getAuditService
} from '../middleware/auth';
import { validateBody, getValidatedBody } from '../middleware/error';
import { createTenantService } from '../services/tenant';
import { UserRole } from '../db/schema';
import { CreateTenantRequest } from '../types';
import { extractAuditContext } from '../services/audit';

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
}

// Validation schemas
const createTenantSchema = z.object({
  name: z.string().min(1, 'Tenant name is required').max(100, 'Tenant name too long'),
  slug: z.string()
    .min(3, 'Tenant slug must be at least 3 characters')
    .max(50, 'Tenant slug too long')
    .regex(/^[a-z0-9-]+$/, 'Tenant slug must contain only lowercase letters, numbers, and hyphens'),
  settings: z.record(z.any()).optional(),
});

const updateTenantSettingsSchema = z.object({
  settings: z.record(z.any()),
});

// Initialize tenants router
const tenants = new Hono<{ Bindings: Env }>();

// Apply authentication and tenant context to all routes
tenants.use('*', authenticate());
tenants.use('*', injectTenantContext());
tenants.use('*', injectAuditService());

/**
 * POST /tenants - Create a new tenant (ADMIN only)
 * Requirements: 1.1, 1.2, 1.3, 1.4
 * 
 * This endpoint demonstrates:
 * - Role-based authorization (ADMIN only)
 * - Input validation with Zod
 * - Audit logging for sensitive operations
 * - Proper error handling
 */
tenants.post('/', 
  requireRole(['ADMIN']),
  validateBody(createTenantSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    
    try {
      const validatedData = getValidatedBody<CreateTenantRequest>(c);
      
      // Create tenant service (not using tenant context since we're creating a new tenant)
      const db = drizzle(c.env.DB);
      const tenantService = createTenantService(db);
      
      // Create the tenant
      const newTenant = await tenantService.createTenant(validatedData);
      
      // Log tenant creation
      await auditService.logSensitiveOperation('TENANT_CREATED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Tenant created: ${newTenant.name} (${newTenant.slug})`
      });
      
      // Return tenant info (excluding sensitive settings)
      return c.json({
        id: newTenant.id,
        name: newTenant.name,
        slug: newTenant.slug,
        createdAt: newTenant.createdAt,
      }, 201);
      
    } catch (error) {
      // Log failed tenant creation
      await auditService.logSensitiveOperation('TENANT_CREATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Tenant creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /tenants/current - Get current tenant information
 * Requirements: 1.4, 7.1
 * 
 * This endpoint demonstrates:
 * - Authenticated access (any role)
 * - Tenant context usage
 * - Safe data exposure (no sensitive information)
 */
tenants.get('/current', async (c) => {
  const authContext = getAuthContext(c);
  const tenantService = getTenantService(c);
  
  try {
    const tenant = await tenantService.getTenant(authContext.tenant_id);
    
    if (!tenant) {
      return c.json({
        error: 'Not Found',
        message: 'Tenant not found'
      }, 404);
    }
    
    // Return basic tenant info (exclude sensitive settings)
    return c.json({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      createdAt: tenant.createdAt,
    });
    
  } catch (error) {
    throw error; // Let error middleware handle it
  }
});

/**
 * PUT /tenants/current/settings - Update tenant settings (ADMIN only)
 * Requirements: 1.3, 4.3
 * 
 * This endpoint demonstrates:
 * - Role-based authorization (ADMIN only)
 * - Tenant-scoped operations
 * - Settings management
 * - Audit logging for configuration changes
 */
tenants.put('/current/settings',
  requireRole(['ADMIN']),
  validateBody(updateTenantSettingsSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const tenantService = getTenantService(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    
    try {
      const { settings } = getValidatedBody<{ settings: Record<string, any> }>(c);
      
      // Update tenant settings
      const updatedTenant = await tenantService.updateTenantSettings(
        authContext.tenant_id, 
        settings
      );
      
      // Log settings update
      await auditService.logSensitiveOperation('TENANT_SETTINGS_UPDATED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Tenant settings updated for: ${updatedTenant.name}`
      });
      
      return c.json({
        id: updatedTenant.id,
        name: updatedTenant.name,
        slug: updatedTenant.slug,
        createdAt: updatedTenant.createdAt,
        message: 'Settings updated successfully'
      });
      
    } catch (error) {
      // Log failed settings update
      await auditService.logSensitiveOperation('TENANT_SETTINGS_UPDATE_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Tenant settings update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /tenants/current/locations - Get all locations for current tenant
 * Requirements: 5.4, 7.1
 * 
 * This endpoint demonstrates:
 * - Tenant-scoped data access
 * - Location listing for tenant context
 * - Role-based access (ADMIN and MANAGER can see all locations)
 */
tenants.get('/current/locations',
  requireRole(['ADMIN', 'MANAGER']),
  async (c) => {
    const authContext = getAuthContext(c);
    const tenantService = getTenantService(c);
    
    try {
      const locations = await tenantService.getTenantLocations(authContext.tenant_id);
      
      return c.json({
        locations: locations.map(location => ({
          id: location.id,
          name: location.name,
          type: location.type,
          address: location.address,
          createdAt: location.createdAt,
        })),
        total: locations.length,
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /tenants/current/users/count - Get user count for current tenant (ADMIN only)
 * Requirements: 4.3, 7.1
 * 
 * This endpoint demonstrates:
 * - ADMIN-only access
 * - Tenant-scoped statistics
 * - Simple data aggregation
 */
tenants.get('/current/users/count',
  requireRole(['ADMIN']),
  async (c) => {
    const authContext = getAuthContext(c);
    const tenantService = getTenantService(c);
    
    try {
      const userCount = await tenantService.getTenantUserCount(authContext.tenant_id);
      
      return c.json({
        userCount,
        tenantId: authContext.tenant_id,
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

export default tenants;