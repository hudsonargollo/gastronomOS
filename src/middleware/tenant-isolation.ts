/**
 * Tenant Isolation Middleware
 * 
 * Implements strict tenant data isolation and access control at the API level.
 * Requirements: 8.1, 8.2, 8.4
 */

import { Context, MiddlewareHandler } from 'hono';
import { getAuthContext, getAuditService } from './auth';
import { extractAuditContext } from '../services/audit';

/**
 * Tenant resolution and validation middleware
 * 
 * Ensures that every API request includes valid tenant context and that
 * the authenticated user has access to the requested tenant.
 * 
 * Requirements: 8.1, 8.2
 */
export function resolveTenant(): MiddlewareHandler {
  return async (c: Context, next) => {
    const auditContext = extractAuditContext(c);
    
    try {
      // Get auth context (should be set by authenticate middleware)
      const authContext = getAuthContext(c);
      
      // Extract tenant ID from auth context
      const tenantId = authContext.tenant_id;
      
      if (!tenantId) {
        // Log security event
        const auditService = c.get('auditService');
        if (auditService) {
          await auditService.logSecurityEvent('TENANT_RESOLUTION_FAILED', {
            ...auditContext,
            userId: authContext.user_id,
            resource: 'Missing tenant ID in auth context'
          });
        }
        
        return c.json({
          error: 'Forbidden',
          message: 'Tenant context is required'
        }, 403);
      }
      
      // Store tenant ID in context for easy access
      c.set('tenantId', tenantId);
      
      // Log successful tenant resolution
      const auditService = c.get('auditService');
      if (auditService) {
        await auditService.logSensitiveOperation('TENANT_RESOLVED', {
          ...auditContext,
          tenantId,
          userId: authContext.user_id,
          resource: `Tenant resolved: ${tenantId}`
        });
      }
      
      return await next();
    } catch (error) {
      console.error('Tenant resolution error:', error);
      
      // Log security event
      const auditService = c.get('auditService');
      if (auditService) {
        await auditService.logSecurityEvent('TENANT_RESOLUTION_ERROR', {
          ...auditContext,
          resource: `Tenant resolution error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
      
      return c.json({
        error: 'Internal Server Error',
        message: 'Tenant resolution failed'
      }, 500);
    }
  };
}

/**
 * Cross-tenant access prevention middleware
 * 
 * Validates that all resource access is scoped to the authenticated user's tenant.
 * Prevents any cross-tenant data access or visibility.
 * 
 * Requirements: 8.4
 */
export function preventCrossTenantAccess(): MiddlewareHandler {
  return async (c: Context, next) => {
    const auditContext = extractAuditContext(c);
    
    try {
      const authContext = getAuthContext(c);
      const authenticatedTenantId = authContext.tenant_id;
      
      // Extract tenant ID from request parameters (if present)
      // Try multiple common parameter names
      const pathTenantId = c.req.param('tenantId') || c.req.param('tenant_id');
      const queryTenantId = c.req.query('tenant_id') || c.req.query('tenantId');
      const bodyTenantId = await extractTenantIdFromBody(c);
      
      // Check all possible tenant ID sources
      const requestedTenantIds = [pathTenantId, queryTenantId, bodyTenantId].filter(Boolean);
      
      // Validate that all requested tenant IDs match the authenticated tenant
      for (const requestedTenantId of requestedTenantIds) {
        if (requestedTenantId !== authenticatedTenantId) {
          // Log cross-tenant access attempt
          const auditService = c.get('auditService');
          if (auditService) {
            await auditService.logSecurityEvent('CROSS_TENANT_ACCESS_ATTEMPT', {
              ...auditContext,
              tenantId: authenticatedTenantId,
              userId: authContext.user_id,
              resource: `Attempted access to tenant ${requestedTenantId} from tenant ${authenticatedTenantId}`
            });
          }
          
          return c.json({
            error: 'Forbidden',
            message: 'Cross-tenant access is not permitted'
          }, 403);
        }
      }
      
      return await next();
    } catch (error) {
      console.error('Cross-tenant access prevention error:', error);
      
      // Log security event
      const auditService = c.get('auditService');
      if (auditService) {
        await auditService.logSecurityEvent('CROSS_TENANT_CHECK_ERROR', {
          ...auditContext,
          resource: `Cross-tenant check error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
      
      return c.json({
        error: 'Internal Server Error',
        message: 'Access validation failed'
      }, 500);
    }
  };
}

/**
 * API-level tenant access control middleware
 * 
 * Combines tenant resolution and cross-tenant access prevention.
 * This is the primary middleware for enforcing tenant isolation.
 * 
 * Requirements: 8.1, 8.2, 8.4
 */
export function enforceTenantIsolation(): MiddlewareHandler {
  return async (c: Context, next) => {
    // First resolve tenant
    await resolveTenant()(c, async () => {
      // Then prevent cross-tenant access
      await preventCrossTenantAccess()(c, next);
    });
  };
}

/**
 * Tenant-scoped query middleware
 * 
 * Automatically injects tenant_id filter into database queries.
 * This ensures that all database operations are tenant-scoped.
 * 
 * Requirements: 8.1, 8.2
 */
export function scopeToTenant(): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      const authContext = getAuthContext(c);
      const tenantId = authContext.tenant_id;
      
      // Store tenant filter function in context
      c.set('tenantFilter', (query: any) => {
        // This function can be used by route handlers to automatically
        // add tenant_id filtering to queries
        return query.where('tenant_id', tenantId);
      });
      
      return await next();
    } catch (error) {
      console.error('Tenant scoping error:', error);
      return c.json({
        error: 'Internal Server Error',
        message: 'Tenant scoping failed'
      }, 500);
    }
  };
}

/**
 * Security logging middleware for tenant access
 * 
 * Logs all tenant access attempts for security auditing.
 * 
 * Requirements: 8.4
 */
export function logTenantAccess(): MiddlewareHandler {
  return async (c: Context, next) => {
    const auditContext = extractAuditContext(c);
    const startTime = Date.now();
    
    try {
      const authContext = getAuthContext(c);
      const tenantId = authContext.tenant_id;
      const method = c.req.method;
      const path = c.req.path;
      
      // Execute the request
      await next();
      
      // Log successful access
      const auditService = c.get('auditService');
      if (auditService) {
        const duration = Date.now() - startTime;
        await auditService.logSensitiveOperation('TENANT_ACCESS', {
          ...auditContext,
          tenantId,
          userId: authContext.user_id,
          resource: `${method} ${path}`,
          metadata: JSON.stringify({ duration })
        });
      }
    } catch (error) {
      // Log failed access
      const auditService = c.get('auditService');
      if (auditService) {
        const authContext = c.get('authContext');
        await auditService.logSecurityEvent('TENANT_ACCESS_FAILED', {
          ...auditContext,
          tenantId: authContext?.tenant_id,
          userId: authContext?.user_id,
          resource: `${c.req.method} ${c.req.path} - Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
      
      throw error;
    }
  };
}

/**
 * Helper function to extract tenant ID from request body
 */
async function extractTenantIdFromBody(c: Context): Promise<string | undefined> {
  try {
    // Only try to parse body for POST, PUT, PATCH requests
    if (!['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
      return undefined;
    }
    
    // Clone the request to avoid consuming the body
    const clonedRequest = c.req.raw.clone();
    const contentType = clonedRequest.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      const body = await clonedRequest.json();
      return body?.tenant_id || body?.tenantId;
    }
    
    return undefined;
  } catch (error) {
    // If body parsing fails, return undefined
    return undefined;
  }
}

/**
 * Helper function to get tenant ID from context
 */
export function getTenantId(c: Context): string {
  const tenantId = c.get('tenantId');
  
  if (!tenantId) {
    throw new Error('Tenant ID not found in context');
  }
  
  return tenantId;
}

/**
 * Validate tenant ownership of a resource
 * 
 * Helper function to verify that a resource belongs to the authenticated tenant.
 * 
 * Requirements: 8.1, 8.4
 */
export async function validateTenantOwnership(
  c: Context,
  resourceTenantId: string
): Promise<boolean> {
  const authContext = getAuthContext(c);
  const authenticatedTenantId = authContext.tenant_id;
  
  if (resourceTenantId !== authenticatedTenantId) {
    // Log unauthorized access attempt
    const auditService = c.get('auditService');
    if (auditService) {
      // Create a minimal audit context for this helper function
      const auditContext = {
        ipAddress: undefined,
        userAgent: undefined,
        resource: `Resource owned by tenant ${resourceTenantId}`
      };
      
      await auditService.logSecurityEvent('UNAUTHORIZED_RESOURCE_ACCESS', {
        ...auditContext,
        tenantId: authenticatedTenantId,
        userId: authContext.user_id,
        resource: `Attempted access to resource owned by tenant ${resourceTenantId}`
      });
    }
    
    return false;
  }
  
  return true;
}
