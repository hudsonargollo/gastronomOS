import { Context, MiddlewareHandler } from 'hono';
import { getAuthContext } from './auth';
import { createDemoSessionManager } from '../services/demo-session-manager';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

/**
 * Demo Security Middleware
 * 
 * Enforces security restrictions on demo accounts to prevent:
 * - User management operations
 * - Permanent data deletion
 * - Data export
 * - Admin panel access
 * 
 * Requirements: 8.5 - Add demo account security measures
 */

/**
 * Middleware to prevent demo accounts from modifying users
 */
export function preventDemoUserModification(): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      const authContext = getAuthContext(c);
      const db = drizzle(c.env.DB, { schema });
      const demoSessionManager = createDemoSessionManager(db as any);
      
      // Check if this is a demo account
      const isDemoTenant = demoSessionManager.isDemoTenant(authContext.tenant_id);
      
      if (isDemoTenant) {
        const restrictions = demoSessionManager.getSessionSecurityRestrictions();
        
        if (!restrictions.canModifyUsers) {
          return c.json({
            error: 'Forbidden',
            message: 'Demo accounts cannot create or modify users. This is a security restriction.',
            code: 'DEMO_RESTRICTION_USER_MODIFICATION'
          }, 403);
        }
      }
      
      return await next();
    } catch (error) {
      console.error('Demo security middleware error:', error);
      return c.json({
        error: 'Internal Server Error',
        message: 'Security check failed'
      }, 500);
    }
  };
}

/**
 * Middleware to prevent demo accounts from permanently deleting data
 */
export function preventDemoDataDeletion(): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      const authContext = getAuthContext(c);
      const db = drizzle(c.env.DB, { schema });
      const demoSessionManager = createDemoSessionManager(db as any);
      
      // Check if this is a demo account
      const isDemoTenant = demoSessionManager.isDemoTenant(authContext.tenant_id);
      
      if (isDemoTenant) {
        const restrictions = demoSessionManager.getSessionSecurityRestrictions();
        
        if (!restrictions.canDeleteData) {
          return c.json({
            error: 'Forbidden',
            message: 'Demo accounts cannot permanently delete data. Data will be reset automatically.',
            code: 'DEMO_RESTRICTION_DATA_DELETION'
          }, 403);
        }
      }
      
      return await next();
    } catch (error) {
      console.error('Demo security middleware error:', error);
      return c.json({
        error: 'Internal Server Error',
        message: 'Security check failed'
      }, 500);
    }
  };
}

/**
 * Middleware to prevent demo accounts from exporting data
 */
export function preventDemoDataExport(): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      const authContext = getAuthContext(c);
      const db = drizzle(c.env.DB, { schema });
      const demoSessionManager = createDemoSessionManager(db as any);
      
      // Check if this is a demo account
      const isDemoTenant = demoSessionManager.isDemoTenant(authContext.tenant_id);
      
      if (isDemoTenant) {
        const restrictions = demoSessionManager.getSessionSecurityRestrictions();
        
        if (!restrictions.canExportData) {
          return c.json({
            error: 'Forbidden',
            message: 'Demo accounts cannot export data. This is a security restriction.',
            code: 'DEMO_RESTRICTION_DATA_EXPORT'
          }, 403);
        }
      }
      
      return await next();
    } catch (error) {
      console.error('Demo security middleware error:', error);
      return c.json({
        error: 'Internal Server Error',
        message: 'Security check failed'
      }, 500);
    }
  };
}

/**
 * Middleware to prevent demo accounts from accessing admin panel
 */
export function preventDemoAdminAccess(): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      const authContext = getAuthContext(c);
      const db = drizzle(c.env.DB, { schema });
      const demoSessionManager = createDemoSessionManager(db as any);
      
      // Check if this is a demo account
      const isDemoTenant = demoSessionManager.isDemoTenant(authContext.tenant_id);
      
      if (isDemoTenant) {
        const restrictions = demoSessionManager.getSessionSecurityRestrictions();
        
        if (!restrictions.canAccessAdminPanel) {
          return c.json({
            error: 'Forbidden',
            message: 'Demo accounts cannot access admin features. This is a security restriction.',
            code: 'DEMO_RESTRICTION_ADMIN_ACCESS'
          }, 403);
        }
      }
      
      return await next();
    } catch (error) {
      console.error('Demo security middleware error:', error);
      return c.json({
        error: 'Internal Server Error',
        message: 'Security check failed'
      }, 500);
    }
  };
}

/**
 * General demo restriction middleware
 * Checks if the operation is allowed for demo accounts
 */
export function checkDemoRestrictions(restrictionType: 'users' | 'delete' | 'export' | 'admin'): MiddlewareHandler {
  switch (restrictionType) {
    case 'users':
      return preventDemoUserModification();
    case 'delete':
      return preventDemoDataDeletion();
    case 'export':
      return preventDemoDataExport();
    case 'admin':
      return preventDemoAdminAccess();
    default:
      return async (c: Context, next) => await next();
  }
}

/**
 * Middleware to add demo session info to response headers
 * Useful for frontend to display demo session warnings
 */
export function addDemoSessionHeaders(): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      const authContext = getAuthContext(c);
      const db = drizzle(c.env.DB, { schema });
      const demoSessionManager = createDemoSessionManager(db as any);
      
      // Check if this is a demo account
      const isDemoTenant = demoSessionManager.isDemoTenant(authContext.tenant_id);
      
      if (isDemoTenant) {
        const config = demoSessionManager.getConfig();
        
        // Add headers to inform frontend about demo session
        c.header('X-Demo-Session', 'true');
        c.header('X-Demo-Expiration-Hours', String(config.expirationSeconds / 3600));
        c.header('X-Demo-Reset-Interval-Hours', String(config.resetIntervalHours));
      }
      
      return await next();
    } catch (error) {
      // Don't fail the request if header addition fails
      console.error('Error adding demo session headers:', error);
      return await next();
    }
  };
}
