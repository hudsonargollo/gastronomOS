import { Context, MiddlewareHandler } from 'hono';
import { IJWTService, ExtendedJWTClaims } from '../services/jwt';
import { AuthContext } from '../types';
import { UserRole } from '../db/schema';
import { ITenantService } from '../services/tenant';
import { IAuthorizationService, Permission } from '../services/authorization';
import { IAuditService, extractAuditContext } from '../services/audit';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { drizzle } from 'drizzle-orm/d1';

// Extend Hono Variables to include auth context and services
declare module 'hono' {
  interface ContextVariableMap {
    authContext: AuthContext;
    jwtClaims: ExtendedJWTClaims;
    tenantService: ITenantService;
    authorizationService: IAuthorizationService;
    auditService: IAuditService;
    db: DrizzleD1Database;
    tenantId: string;
    jwtService: IJWTService;
  }
}

/**
 * Authentication middleware that validates JWT tokens and injects user context
 */
export function authenticate(): MiddlewareHandler {
  return async (c: Context, next) => {
    const auditContext = extractAuditContext(c);
    
    try {
      // Extract JWT from Authorization header
      const authHeader = c.req.header('Authorization');
      
      if (!authHeader) {
        // Log failed authentication attempt
        const auditService: IAuditService | undefined = c.get('auditService');
        if (auditService) {
          await auditService.logAuthenticationEvent('LOGIN_FAILED', {
            ...auditContext,
            resource: 'Missing Authorization header'
          });
        }
        
        return c.json({
          error: 'Unauthorized',
          message: 'Authorization header is required'
        }, 401);
      }

      // Check for Bearer token format
      if (!authHeader.startsWith('Bearer ')) {
        // Log failed authentication attempt
        const auditService: IAuditService | undefined = c.get('auditService');
        if (auditService) {
          await auditService.logAuthenticationEvent('LOGIN_FAILED', {
            ...auditContext,
            resource: 'Invalid Authorization header format'
          });
        }
        
        return c.json({
          error: 'Unauthorized',
          message: 'Authorization header must use Bearer token format'
        }, 401);
      }

      // Extract the token
      const token = authHeader.substring(7).trim(); // Remove 'Bearer ' prefix and trim whitespace
      
      if (!token) {
        // Log failed authentication attempt
        const auditService: IAuditService | undefined = c.get('auditService');
        if (auditService) {
          await auditService.logAuthenticationEvent('LOGIN_FAILED', {
            ...auditContext,
            resource: 'Empty JWT token'
          });
        }
        
        return c.json({
          error: 'Unauthorized',
          message: 'JWT token is required'
        }, 401);
      }

      // Get JWT service from context
      const jwtService: IJWTService = c.get('jwtService');
      
      if (!jwtService) {
        return c.json({
          error: 'Internal Server Error',
          message: 'JWT service not available'
        }, 500);
      }

      // Validate token and extract claims
      let claims: ExtendedJWTClaims;
      try {
        claims = await jwtService.verify(token);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Token validation failed';
        
        // Log failed authentication attempt
        const auditService: IAuditService | undefined = c.get('auditService');
        if (auditService) {
          await auditService.logAuthenticationEvent('LOGIN_FAILED', {
            ...auditContext,
            resource: `JWT validation failed: ${errorMessage}`
          });
        }
        
        return c.json({
          error: 'Unauthorized',
          message: `Invalid JWT token: ${errorMessage}`
        }, 401);
      }

      // Create auth context from JWT claims
      const authContext: AuthContext = {
        user_id: claims.sub,
        tenant_id: claims.tenant_id,
        role: claims.role,
        ...(claims.location_id && { location_id: claims.location_id })
      };

      // Log successful authentication
      const auditService: IAuditService | undefined = c.get('auditService');
      if (auditService) {
        await auditService.logAuthenticationEvent('LOGIN', {
          ...auditContext,
          tenantId: authContext.tenant_id,
          userId: authContext.user_id,
          resource: 'JWT authentication successful'
        });
      }

      // Inject auth context and claims into Hono context
      c.set('authContext', authContext);
      c.set('jwtClaims', claims);

      // Continue to next middleware
      return await next();
    } catch (error) {
      // Handle unexpected errors
      console.error('Authentication middleware error:', error);
      
      // Log authentication error
      const auditService: IAuditService | undefined = c.get('auditService');
      if (auditService) {
        await auditService.logAuthenticationEvent('LOGIN_FAILED', {
          ...auditContext,
          resource: `Authentication middleware error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
      
      return c.json({
        error: 'Internal Server Error',
        message: 'Internal authentication error'
      }, 500);
    }
  };
}

/**
 * Authorization middleware that requires specific roles
 */
export function requireRole(allowedRoles: UserRole[]): MiddlewareHandler {
  return async (c: Context, next) => {
    const auditContext = extractAuditContext(c);
    
    try {
      // Get auth context (should be set by authenticate middleware)
      const authContext: AuthContext | undefined = c.get('authContext');
      
      if (!authContext) {
        // Log access denied
        const auditService: IAuditService | undefined = c.get('auditService');
        if (auditService) {
          await auditService.logAuthorizationEvent('ACCESS_DENIED', {
            ...auditContext,
            resource: 'Role authorization - no auth context'
          });
        }
        
        return c.json({
          error: 'Unauthorized',
          message: 'Authentication required'
        }, 401);
      }

      // Check if user role is in allowed roles
      if (!allowedRoles.includes(authContext.role)) {
        // Log access denied
        const auditService: IAuditService | undefined = c.get('auditService');
        if (auditService) {
          await auditService.logAuthorizationEvent('ACCESS_DENIED', {
            ...auditContext,
            tenantId: authContext.tenant_id,
            userId: authContext.user_id,
            resource: `Role authorization failed - required: ${allowedRoles.join(', ')}, actual: ${authContext.role}`
          });
        }
        
        return c.json({
          error: 'Forbidden',
          message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
        }, 403);
      }

      // Log successful authorization
      const auditService: IAuditService | undefined = c.get('auditService');
      if (auditService) {
        await auditService.logSensitiveOperation('PERMISSION_GRANTED', {
          ...auditContext,
          tenantId: authContext.tenant_id,
          userId: authContext.user_id,
          resource: `Role authorization granted - role: ${authContext.role}`
        });
      }

      // Continue to next middleware
      return await next();
    } catch (error) {
      // Handle unexpected errors
      console.error('Authorization middleware error:', error);
      
      // Log authorization error
      const auditService: IAuditService | undefined = c.get('auditService');
      if (auditService) {
        await auditService.logAuthorizationEvent('ACCESS_DENIED', {
          ...auditContext,
          resource: `Authorization middleware error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
      
      return c.json({
        error: 'Internal Server Error',
        message: 'Internal authorization error'
      }, 500);
    }
  };
}

/**
 * Location authorization middleware that requires location access
 */
export function requireLocation(): MiddlewareHandler {
  return async (c: Context, next) => {
    const auditContext = extractAuditContext(c);
    
    try {
      // Get auth context (should be set by authenticate middleware)
      const authContext: AuthContext | undefined = c.get('authContext');
      
      if (!authContext) {
        // Log access denied
        const auditService: IAuditService | undefined = c.get('auditService');
        if (auditService) {
          await auditService.logAuthorizationEvent('ACCESS_DENIED', {
            ...auditContext,
            resource: 'Location authorization - no auth context'
          });
        }
        
        return c.json({
          error: 'Unauthorized',
          message: 'Authentication required'
        }, 401);
      }

      // Extract location_id from request (could be path param, query param, or body)
      const pathLocationId = c.req.param('locationId');
      const queryLocationId = c.req.query('location_id');
      
      let requestedLocationId: string | undefined;
      
      // Try to get location from path params first, then query params
      if (pathLocationId) {
        requestedLocationId = pathLocationId;
      } else if (queryLocationId) {
        requestedLocationId = queryLocationId;
      }

      // If no location is requested, allow access (for tenant-wide operations)
      if (!requestedLocationId) {
        return await next();
      }

      // If user has no location restriction (location_id is null/undefined), allow access
      // This typically applies to ADMIN users who can access all locations
      if (!authContext.location_id) {
        // Log successful authorization for unrestricted access
        const auditService: IAuditService | undefined = c.get('auditService');
        if (auditService) {
          await auditService.logSensitiveOperation('PERMISSION_GRANTED', {
            ...auditContext,
            tenantId: authContext.tenant_id,
            userId: authContext.user_id,
            resource: `Location access granted - unrestricted user accessing location: ${requestedLocationId}`
          });
        }
        
        return await next();
      }

      // Check if user's location matches requested location
      if (authContext.location_id !== requestedLocationId) {
        // Log access denied
        const auditService: IAuditService | undefined = c.get('auditService');
        if (auditService) {
          await auditService.logAuthorizationEvent('ACCESS_DENIED', {
            ...auditContext,
            tenantId: authContext.tenant_id,
            userId: authContext.user_id,
            resource: `Location access denied - user location: ${authContext.location_id}, requested: ${requestedLocationId}`
          });
        }
        
        return c.json({
          error: 'Forbidden',
          message: `Access denied. You can only access location: ${authContext.location_id}`
        }, 403);
      }

      // Log successful location authorization
      const auditService: IAuditService | undefined = c.get('auditService');
      if (auditService) {
        await auditService.logSensitiveOperation('PERMISSION_GRANTED', {
          ...auditContext,
          tenantId: authContext.tenant_id,
          userId: authContext.user_id,
          resource: `Location access granted - location: ${requestedLocationId}`
        });
      }

      // Continue to next middleware
      return await next();
    } catch (error) {
      // Handle unexpected errors
      console.error('Location authorization middleware error:', error);
      
      // Log authorization error
      const auditService: IAuditService | undefined = c.get('auditService');
      if (auditService) {
        await auditService.logAuthorizationEvent('ACCESS_DENIED', {
          ...auditContext,
          resource: `Location authorization error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
      
      return c.json({
        error: 'Internal Server Error',
        message: 'Internal location authorization error'
      }, 500);
    }
  };
}

/**
 * Helper function to get auth context from Hono context
 */
export function getAuthContext(c: Context): AuthContext {
  const authContext: AuthContext | undefined = c.get('authContext');
  
  if (!authContext) {
    throw new Error('Authentication required');
  }
  
  return authContext;
}

/**
 * Helper function to get JWT claims from Hono context
 */
export function getJWTClaims(c: Context): ExtendedJWTClaims {
  const jwtClaims: ExtendedJWTClaims | undefined = c.get('jwtClaims');
  
  if (!jwtClaims) {
    throw new Error('Authentication required');
  }
  
  return jwtClaims;
}

/**
 * Tenant context middleware that extracts tenant_id from JWT and injects tenant service
 * Requirements: 3.1, 3.4
 */
export function injectTenantContext(): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      // Get auth context (should be set by authenticate middleware)
      const authContext: AuthContext | undefined = c.get('authContext');
      
      if (!authContext) {
        return c.json({
          error: 'Unauthorized',
          message: 'Authentication required for tenant context'
        }, 401);
      }

      // Get database connection from environment
      const db = drizzle(c.env.DB);
      c.set('db', db);

      // Create tenant service instance
      const { createTenantService } = await import('../services/tenant');
      const tenantService = createTenantService(db);
      c.set('tenantService', tenantService);

      // Validate that the tenant exists and user has access
      const hasAccess = await tenantService.validateTenantAccess(
        authContext.tenant_id, 
        authContext.user_id
      );

      if (!hasAccess) {
        return c.json({
          error: 'Forbidden',
          message: 'Access denied to tenant resources'
        }, 403);
      }

      // Continue to next middleware
      return await next();
    } catch (error) {
      console.error('Tenant context middleware error:', error);
      return c.json({
        error: 'Internal Server Error',
        message: 'Internal tenant context error'
      }, 500);
    }
  };
}

/**
 * Helper function to get tenant service from Hono context
 */
export function getTenantService(c: Context): ITenantService {
  const tenantService: ITenantService | undefined = c.get('tenantService');
  
  if (!tenantService) {
    throw new Error('Tenant service not available');
  }
  
  return tenantService;
}

/**
 * Helper function to get database connection from Hono context
 */
export function getDatabase(c: Context): DrizzleD1Database {
  const db: DrizzleD1Database | undefined = c.get('db');
  
  if (!db) {
    throw new Error('Database connection not available');
  }
  
  return db;
}

/**
 * Middleware that ensures all database operations are tenant-scoped
 * This wraps the tenant service's withTenantContext method
 * Requirements: 3.1, 3.2, 3.5
 */
export function ensureTenantIsolation(): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      const authContext = getAuthContext(c);

      // Store the tenant ID for easy access in route handlers
      c.set('tenantId', authContext.tenant_id);

      return await next();
    } catch (error) {
      console.error('Tenant isolation middleware error:', error);
      return c.json({
        error: 'Internal Server Error',
        message: 'Tenant isolation error'
      }, 500);
    }
  };
}

/**
 * Middleware that injects the audit service into the context
 * Requirements: 8.1, 8.2, 8.3
 */
export function injectAuditService(): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      // Get database connection (should be set by injectTenantContext middleware)
      const db: DrizzleD1Database | undefined = c.get('db');
      
      if (!db) {
        return c.json({
          error: 'Internal Server Error',
          message: 'Database connection not available'
        }, 500);
      }

      // Create audit service instance
      const { createAuditService } = await import('../services/audit');
      const auditService = createAuditService(db);
      c.set('auditService', auditService);

      return await next();
    } catch (error) {
      console.error('Audit service injection error:', error);
      return c.json({
        error: 'Internal Server Error',
        message: 'Audit service initialization error'
      }, 500);
    }
  };
}

/**
 * Middleware that injects the authorization service into the context
 * Requirements: 7.2, 7.3, 7.4
 */
export function injectAuthorizationService(): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      // Get database connection (should be set by injectTenantContext middleware)
      const db: DrizzleD1Database | undefined = c.get('db');
      
      if (!db) {
        return c.json({
          error: 'Internal Server Error',
          message: 'Database connection not available'
        }, 500);
      }

      // Create authorization service instance
      const { createAuthorizationService } = await import('../services/authorization');
      const authorizationService = createAuthorizationService(db);
      c.set('authorizationService', authorizationService);

      return await next();
    } catch (error) {
      console.error('Authorization service injection error:', error);
      return c.json({
        error: 'Internal Server Error',
        message: 'Authorization service initialization error'
      }, 500);
    }
  };
}

/**
 * Enhanced role-based authorization middleware using AuthorizationService
 * Requirements: 7.2, 4.2
 */
export function requireRoleWithService(allowedRoles: UserRole[]): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      // Get auth context and authorization service
      const authContext = getAuthContext(c);
      const authorizationService = getAuthorizationService(c);

      // Validate each role using the authorization service
      const hasValidRole = allowedRoles.some(role => 
        authorizationService.validateRole(role) && authContext.role === role
      );

      if (!hasValidRole) {
        return c.json({
          error: 'Forbidden',
          message: `Access denied. Required roles: ${allowedRoles.join(', ')}`
        }, 403);
      }

      return await next();
    } catch (error) {
      console.error('Enhanced role authorization error:', error);
      return c.json({
        error: 'Internal Server Error',
        message: 'Role authorization error'
      }, 500);
    }
  };
}

/**
 * Permission-based authorization middleware
 * Requirements: 7.2, 4.2
 */
export function requirePermission(permission: Permission): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      const authContext = getAuthContext(c);
      const authorizationService = getAuthorizationService(c);

      // Check if user's role has the required permission
      const hasPermission = authorizationService.hasPermission(authContext.role, permission);

      if (!hasPermission) {
        return c.json({
          error: 'Forbidden',
          message: `Access denied. Required permission: ${permission.action} on ${permission.resource}`
        }, 403);
      }

      return await next();
    } catch (error) {
      console.error('Permission authorization error:', error);
      return c.json({
        error: 'Internal Server Error',
        message: 'Permission authorization error'
      }, 500);
    }
  };
}

/**
 * Location-specific authorization middleware using AuthorizationService
 * Requirements: 7.3, 5.1, 5.2
 */
export function requireLocationAccess(): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      const authContext = getAuthContext(c);
      const authorizationService = getAuthorizationService(c);

      // Extract location_id from request (path param, query param, or body)
      const pathLocationId = c.req.param('locationId');
      const queryLocationId = c.req.query('location_id');
      
      let requestedLocationId: string | undefined;
      
      if (pathLocationId) {
        requestedLocationId = pathLocationId;
      } else if (queryLocationId) {
        requestedLocationId = queryLocationId;
      }

      // If no location is requested, allow access (for tenant-wide operations)
      if (!requestedLocationId) {
        return await next();
      }

      // Check location access using authorization service
      const canAccess = await authorizationService.canAccessLocation(
        authContext.user_id,
        authContext.tenant_id,
        requestedLocationId
      );

      if (!canAccess) {
        return c.json({
          error: 'Forbidden',
          message: `Access denied to location: ${requestedLocationId}`
        }, 403);
      }

      return await next();
    } catch (error) {
      console.error('Location authorization error:', error);
      return c.json({
        error: 'Internal Server Error',
        message: 'Location authorization error'
      }, 500);
    }
  };
}

/**
 * Resource and action authorization middleware with optional location check
 * Requirements: 7.2, 7.3, 4.2, 5.1, 5.2
 */
export function requireResourceAccess(resource: string, action: string): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      const authContext = getAuthContext(c);
      const authorizationService = getAuthorizationService(c);

      // Extract location_id from request if present
      const pathLocationId = c.req.param('locationId');
      const queryLocationId = c.req.query('location_id');
      const requestedLocationId = pathLocationId || queryLocationId;

      // Check if user can perform the action on the resource at the location
      const canPerform = await authorizationService.canPerformAction(
        authContext.user_id,
        authContext.tenant_id,
        resource,
        action,
        requestedLocationId
      );

      if (!canPerform) {
        const locationMsg = requestedLocationId ? ` at location ${requestedLocationId}` : '';
        return c.json({
          error: 'Forbidden',
          message: `Access denied. Cannot ${action} ${resource}${locationMsg}`
        }, 403);
      }

      return await next();
    } catch (error) {
      console.error('Resource authorization error:', error);
      return c.json({
        error: 'Internal Server Error',
        message: 'Resource authorization error'
      }, 500);
    }
  };
}

/**
 * User management authorization middleware
 * Requirements: 4.3, 4.4, 4.5
 */
export function requireUserManagement(): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      const authContext = getAuthContext(c);
      const authorizationService = getAuthorizationService(c);

      // Check if user can manage users
      const canManage = authorizationService.canManageUsers(authContext.role);

      if (!canManage) {
        return c.json({
          error: 'Forbidden',
          message: 'Access denied. User management permission required'
        }, 403);
      }

      return await next();
    } catch (error) {
      console.error('User management authorization error:', error);
      return c.json({
        error: 'Internal Server Error',
        message: 'User management authorization error'
      }, 500);
    }
  };
}

/**
 * Order approval authorization middleware
 * Requirements: 4.3, 4.4
 */
export function requireOrderApproval(): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      const authContext = getAuthContext(c);
      const authorizationService = getAuthorizationService(c);

      // Check if user can approve orders
      const canApprove = authorizationService.canApproveOrders(authContext.role);

      if (!canApprove) {
        return c.json({
          error: 'Forbidden',
          message: 'Access denied. Order approval permission required'
        }, 403);
      }

      return await next();
    } catch (error) {
      console.error('Order approval authorization error:', error);
      return c.json({
        error: 'Internal Server Error',
        message: 'Order approval authorization error'
      }, 500);
    }
  };
}

/**
 * Helper function to get authorization service from Hono context
 */
export function getAuthorizationService(c: Context): IAuthorizationService {
  const authorizationService: IAuthorizationService | undefined = c.get('authorizationService');
  
  if (!authorizationService) {
    throw new Error('Authorization service not available');
  }
  
  return authorizationService;
}

/**
 * Helper function to get audit service from Hono context
 */
export function getAuditService(c: Context): IAuditService {
  const auditService: IAuditService | undefined = c.get('auditService');
  
  if (!auditService) {
    throw new Error('Audit service not available');
  }
  
  return auditService;
}

/**
 * Purchase order authorization middleware
 * Checks if user can perform specific actions on purchase orders
 * Requirements: 7, 8
 */
export function requirePurchaseOrderAccess(action: 'read' | 'write' | 'approve' | 'receive' | 'cancel'): MiddlewareHandler {
  return async (c: Context, next) => {
    const auditContext = extractAuditContext(c);
    
    try {
      const authContext = getAuthContext(c);
      const authorizationService = getAuthorizationService(c);
      const auditService = getAuditService(c);

      // Extract PO ID from path parameters
      const poId = c.req.param('id') || c.req.param('poId');
      
      if (!poId) {
        // If no specific PO ID, just check role-based permission
        const hasPermission = authorizationService.hasPermission(authContext.role, {
          resource: 'purchase_orders',
          action
        });

        if (!hasPermission) {
          await auditService.logAuthorizationEvent('ACCESS_DENIED', {
            ...auditContext,
            tenantId: authContext.tenant_id,
            userId: authContext.user_id,
            resource: `Purchase order ${action} permission denied - insufficient role permissions`
          });

          return c.json({
            error: 'Forbidden',
            message: `Access denied. Cannot ${action} purchase orders`
          }, 403);
        }

        await auditService.logSensitiveOperation('PERMISSION_GRANTED', {
          ...auditContext,
          tenantId: authContext.tenant_id,
          userId: authContext.user_id,
          resource: `Purchase order ${action} permission granted`
        });

        return await next();
      }

      // Check specific PO access
      const canAccess = await authorizationService.canAccessPurchaseOrder(
        authContext.user_id,
        authContext.tenant_id,
        poId,
        action
      );

      if (!canAccess) {
        await auditService.logAuthorizationEvent('ACCESS_DENIED', {
          ...auditContext,
          tenantId: authContext.tenant_id,
          userId: authContext.user_id,
          resource: `Purchase order access denied - PO: ${poId}, action: ${action}`
        });

        return c.json({
          error: 'Forbidden',
          message: `Access denied. Cannot ${action} purchase order ${poId}`
        }, 403);
      }

      await auditService.logSensitiveOperation('PERMISSION_GRANTED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Purchase order access granted - PO: ${poId}, action: ${action}`
      });

      return await next();
    } catch (error) {
      console.error('Purchase order authorization error:', error);
      
      const auditService: IAuditService | undefined = c.get('auditService');
      if (auditService) {
        await auditService.logAuthorizationEvent('ACCESS_DENIED', {
          ...auditContext,
          resource: `Purchase order authorization error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
      
      return c.json({
        error: 'Internal Server Error',
        message: 'Purchase order authorization error'
      }, 500);
    }
  };
}

/**
 * Supplier authorization middleware
 * Checks if user can perform specific actions on suppliers
 * Requirements: 7, 8
 */
export function requireSupplierAccess(action: 'read' | 'write' | 'delete'): MiddlewareHandler {
  return async (c: Context, next) => {
    const auditContext = extractAuditContext(c);
    
    try {
      const authContext = getAuthContext(c);
      const authorizationService = getAuthorizationService(c);
      const auditService = getAuditService(c);

      // Extract supplier ID from path parameters
      const supplierId = c.req.param('id') || c.req.param('supplierId');
      
      if (!supplierId) {
        // If no specific supplier ID, just check role-based permission
        const hasPermission = authorizationService.hasPermission(authContext.role, {
          resource: 'suppliers',
          action
        });

        if (!hasPermission) {
          await auditService.logAuthorizationEvent('ACCESS_DENIED', {
            ...auditContext,
            tenantId: authContext.tenant_id,
            userId: authContext.user_id,
            resource: `Supplier ${action} permission denied - insufficient role permissions`
          });

          return c.json({
            error: 'Forbidden',
            message: `Access denied. Cannot ${action} suppliers`
          }, 403);
        }

        await auditService.logSensitiveOperation('PERMISSION_GRANTED', {
          ...auditContext,
          tenantId: authContext.tenant_id,
          userId: authContext.user_id,
          resource: `Supplier ${action} permission granted`
        });

        return await next();
      }

      // Check specific supplier access
      const canAccess = await authorizationService.canAccessSupplier(
        authContext.user_id,
        authContext.tenant_id,
        supplierId,
        action
      );

      if (!canAccess) {
        await auditService.logAuthorizationEvent('ACCESS_DENIED', {
          ...auditContext,
          tenantId: authContext.tenant_id,
          userId: authContext.user_id,
          resource: `Supplier access denied - Supplier: ${supplierId}, action: ${action}`
        });

        return c.json({
          error: 'Forbidden',
          message: `Access denied. Cannot ${action} supplier ${supplierId}`
        }, 403);
      }

      await auditService.logSensitiveOperation('PERMISSION_GRANTED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Supplier access granted - Supplier: ${supplierId}, action: ${action}`
      });

      return await next();
    } catch (error) {
      console.error('Supplier authorization error:', error);
      
      const auditService: IAuditService | undefined = c.get('auditService');
      if (auditService) {
        await auditService.logAuthorizationEvent('ACCESS_DENIED', {
          ...auditContext,
          resource: `Supplier authorization error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
      
      return c.json({
        error: 'Internal Server Error',
        message: 'Supplier authorization error'
      }, 500);
    }
  };
}

/**
 * Purchase order approval workflow authorization middleware
 * Ensures only authorized users can approve purchase orders
 * Requirements: 7, 8
 */
export function requirePurchaseOrderApproval(): MiddlewareHandler {
  return async (c: Context, next) => {
    const auditContext = extractAuditContext(c);
    
    try {
      const authContext = getAuthContext(c);
      const authorizationService = getAuthorizationService(c);
      const auditService = getAuditService(c);

      // Check if user can approve orders
      const canApprove = authorizationService.canApproveOrders(authContext.role);

      if (!canApprove) {
        await auditService.logAuthorizationEvent('ACCESS_DENIED', {
          ...auditContext,
          tenantId: authContext.tenant_id,
          userId: authContext.user_id,
          resource: 'Purchase order approval permission denied'
        });

        return c.json({
          error: 'Forbidden',
          message: 'Access denied. Purchase order approval permission required'
        }, 403);
      }

      await auditService.logSensitiveOperation('PERMISSION_GRANTED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: 'Purchase order approval permission granted'
      });

      return await next();
    } catch (error) {
      console.error('Purchase order approval authorization error:', error);
      
      const auditService: IAuditService | undefined = c.get('auditService');
      if (auditService) {
        await auditService.logAuthorizationEvent('ACCESS_DENIED', {
          ...auditContext,
          resource: `Purchase order approval authorization error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
      
      return c.json({
        error: 'Internal Server Error',
        message: 'Purchase order approval authorization error'
      }, 500);
    }
  };
}

/**
 * Purchase order receiving authorization middleware
 * Ensures only authorized users can receive purchase orders
 * Requirements: 7, 8
 */
export function requirePurchaseOrderReceiving(): MiddlewareHandler {
  return async (c: Context, next) => {
    const auditContext = extractAuditContext(c);
    
    try {
      const authContext = getAuthContext(c);
      const authorizationService = getAuthorizationService(c);
      const auditService = getAuditService(c);

      // Check if user can receive orders
      const canReceive = authorizationService.canReceiveOrders(authContext.role);

      if (!canReceive) {
        await auditService.logAuthorizationEvent('ACCESS_DENIED', {
          ...auditContext,
          tenantId: authContext.tenant_id,
          userId: authContext.user_id,
          resource: 'Purchase order receiving permission denied'
        });

        return c.json({
          error: 'Forbidden',
          message: 'Access denied. Purchase order receiving permission required'
        }, 403);
      }

      await auditService.logSensitiveOperation('PERMISSION_GRANTED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: 'Purchase order receiving permission granted'
      });

      return await next();
    } catch (error) {
      console.error('Purchase order receiving authorization error:', error);
      
      const auditService: IAuditService | undefined = c.get('auditService');
      if (auditService) {
        await auditService.logAuthorizationEvent('ACCESS_DENIED', {
          ...auditContext,
          resource: `Purchase order receiving authorization error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
      
      return c.json({
        error: 'Internal Server Error',
        message: 'Purchase order receiving authorization error'
      }, 500);
    }
  };
}

/**
 * Supplier management authorization middleware
 * Ensures only authorized users can manage suppliers
 * Requirements: 7, 8
 */
export function requireSupplierManagement(): MiddlewareHandler {
  return async (c: Context, next) => {
    const auditContext = extractAuditContext(c);
    
    try {
      const authContext = getAuthContext(c);
      const authorizationService = getAuthorizationService(c);
      const auditService = getAuditService(c);

      // Check if user can manage suppliers
      const canManage = authorizationService.canManageSuppliers(authContext.role);

      if (!canManage) {
        await auditService.logAuthorizationEvent('ACCESS_DENIED', {
          ...auditContext,
          tenantId: authContext.tenant_id,
          userId: authContext.user_id,
          resource: 'Supplier management permission denied'
        });

        return c.json({
          error: 'Forbidden',
          message: 'Access denied. Supplier management permission required'
        }, 403);
      }

      await auditService.logSensitiveOperation('PERMISSION_GRANTED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: 'Supplier management permission granted'
      });

      return await next();
    } catch (error) {
      console.error('Supplier management authorization error:', error);
      
      const auditService: IAuditService | undefined = c.get('auditService');
      if (auditService) {
        await auditService.logAuthorizationEvent('ACCESS_DENIED', {
          ...auditContext,
          resource: `Supplier management authorization error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
      
      return c.json({
        error: 'Internal Server Error',
        message: 'Supplier management authorization error'
      }, 500);
    }
  };
}

/**
 * Price history access authorization middleware
 * Ensures only authorized users can view price history
 * Requirements: 7, 8
 */
export function requirePriceHistoryAccess(): MiddlewareHandler {
  return async (c: Context, next) => {
    const auditContext = extractAuditContext(c);
    
    try {
      const authContext = getAuthContext(c);
      const authorizationService = getAuthorizationService(c);
      const auditService = getAuditService(c);

      // Check if user can view price history
      const canView = authorizationService.canViewPriceHistory(authContext.role);

      if (!canView) {
        await auditService.logAuthorizationEvent('ACCESS_DENIED', {
          ...auditContext,
          tenantId: authContext.tenant_id,
          userId: authContext.user_id,
          resource: 'Price history access permission denied'
        });

        return c.json({
          error: 'Forbidden',
          message: 'Access denied. Price history access permission required'
        }, 403);
      }

      await auditService.logSensitiveOperation('PERMISSION_GRANTED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: 'Price history access permission granted'
      });

      return await next();
    } catch (error) {
      console.error('Price history authorization error:', error);
      
      const auditService: IAuditService | undefined = c.get('auditService');
      if (auditService) {
        await auditService.logAuthorizationEvent('ACCESS_DENIED', {
          ...auditContext,
          resource: `Price history authorization error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
      
      return c.json({
        error: 'Internal Server Error',
        message: 'Price history authorization error'
      }, 500);
    }
  };
}