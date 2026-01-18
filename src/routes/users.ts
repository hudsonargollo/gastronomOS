import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';
import { 
  authenticate, 
  requireRole, 
  injectTenantContext,
  injectAuditService,
  injectAuthorizationService,
  getAuthContext,
  getAuditService,
  getAuthorizationService
} from '../middleware/auth';
import { validateBody, validateQuery, getValidatedBody, getValidatedQuery } from '../middleware/error';
import { createUserService } from '../services/user';
import { UserRole, UserRoleType } from '../db/schema';
import { RegisterUserRequest } from '../types';
import { extractAuditContext } from '../services/audit';

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
}

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF'], {
    errorMap: () => ({ message: 'Role must be ADMIN, MANAGER, or STAFF' })
  }),
  locationId: z.string().optional(),
});

const updateUserRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF'], {
    errorMap: () => ({ message: 'Role must be ADMIN, MANAGER, or STAFF' })
  }),
});

const updateUserLocationSchema = z.object({
  locationId: z.string().nullable(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

const listUsersQuerySchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF']).optional(),
  locationId: z.string().optional(),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined).refine(val => val === undefined || (val > 0 && val <= 100), {
    message: 'Limit must be between 1 and 100'
  }),
  offset: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined).refine(val => val === undefined || val >= 0, {
    message: 'Offset must be non-negative'
  }),
});

// Initialize users router
const users = new Hono<{ Bindings: Env }>();

// Apply authentication and context to all routes
users.use('*', authenticate());
users.use('*', injectTenantContext());
users.use('*', injectAuditService());
users.use('*', injectAuthorizationService());

/**
 * POST /users - Create a new user (ADMIN and MANAGER only)
 * Requirements: 2.1, 2.2, 4.3, 4.4
 * 
 * This endpoint demonstrates:
 * - Role-based authorization with hierarchy
 * - User creation with proper validation
 * - Audit logging for user management
 * - Role hierarchy enforcement (MANAGER can only create STAFF)
 */
users.post('/', 
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  validateBody(createUserSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    
    try {
      const validatedData = getValidatedBody<RegisterUserRequest>(c);
      
      // Check role hierarchy - MANAGER can only create STAFF users
      if (authContext.role === UserRole.MANAGER && validatedData.role !== UserRole.STAFF) {
        await auditService.logAuthorizationEvent('ACCESS_DENIED', {
          ...auditContext,
          tenantId: authContext.tenant_id,
          userId: authContext.user_id,
          resource: `Attempted to create ${validatedData.role} user - insufficient permissions`
        });
        
        return c.json({
          error: 'Forbidden',
          message: 'Managers can only create STAFF users'
        }, 403);
      }
      
      // Create user service
      const db = drizzle(c.env.DB);
      const userService = createUserService(db);
      
      // Create the user
      const newUser = await userService.registerUser(authContext.tenant_id, validatedData);
      
      // Log user creation
      await auditService.logSensitiveOperation('USER_CREATED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `User created: ${newUser.email} with role: ${newUser.role}`
      });
      
      // Return user info (excluding sensitive data)
      return c.json({
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        locationId: newUser.locationId,
        createdAt: newUser.createdAt,
      }, 201);
      
    } catch (error) {
      // Log failed user creation
      await auditService.logSensitiveOperation('USER_CREATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `User creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /users - List users in tenant (ADMIN and MANAGER only)
 * Requirements: 4.3, 4.4, 7.1
 * 
 * This endpoint demonstrates:
 * - Role-based access control
 * - Query parameter validation
 * - Pagination support
 * - Filtering by role and location
 */
users.get('/',
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  validateQuery(listUsersQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      role?: UserRoleType;
      locationId?: string;
      limit?: number;
      offset?: number;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const userService = createUserService(db);
      
      // Get all users in tenant
      const allUsers = await userService.getTenantUsers(authContext.tenant_id);
      
      // Apply filters
      let filteredUsers = allUsers;
      
      if (query.role) {
        filteredUsers = filteredUsers.filter(user => user.role === query.role);
      }
      
      if (query.locationId) {
        filteredUsers = filteredUsers.filter(user => user.locationId === query.locationId);
      }
      
      // Apply pagination
      const limit = query.limit || 20;
      const offset = query.offset || 0;
      const paginatedUsers = filteredUsers.slice(offset, offset + limit);
      
      // Return user list (excluding sensitive data)
      return c.json({
        users: paginatedUsers.map(user => ({
          id: user.id,
          email: user.email,
          role: user.role,
          locationId: user.locationId,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        })),
        total: filteredUsers.length,
        limit,
        offset,
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /users/me - Get current user information
 * Requirements: 7.1
 * 
 * This endpoint demonstrates:
 * - Self-service user information access
 * - Any authenticated user can access their own info
 */
users.get('/me', async (c) => {
  const authContext = getAuthContext(c);
  
  try {
    const db = drizzle(c.env.DB);
    const userService = createUserService(db);
    
    const user = await userService.getUserById(authContext.tenant_id, authContext.user_id);
    
    if (!user) {
      return c.json({
        error: 'Not Found',
        message: 'User not found'
      }, 404);
    }
    
    // Return user info (excluding sensitive data)
    return c.json({
      id: user.id,
      email: user.email,
      role: user.role,
      locationId: user.locationId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
    
  } catch (error) {
    throw error; // Let error middleware handle it
  }
});

/**
 * PUT /users/:userId/role - Update user role (ADMIN only, with hierarchy checks)
 * Requirements: 4.3, 4.4, 4.5
 * 
 * This endpoint demonstrates:
 * - ADMIN-only access
 * - User management with role hierarchy
 * - Audit logging for role changes
 * - Authorization service integration
 */
users.put('/:userId/role',
  requireRole([UserRole.ADMIN]),
  validateBody(updateUserRoleSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const authorizationService = getAuthorizationService(c);
    const auditContext = extractAuditContext(c);
    const userId = c.req.param('userId');
    
    try {
      const { role } = getValidatedBody<{ role: UserRoleType }>(c);
      
      // Check if the current user can manage the target user
      const canManage = await authorizationService.canManageUser(
        authContext.user_id,
        userId,
        authContext.tenant_id
      );
      
      if (!canManage) {
        await auditService.logAuthorizationEvent('ACCESS_DENIED', {
          ...auditContext,
          tenantId: authContext.tenant_id,
          userId: authContext.user_id,
          resource: `Attempted to update role for user ${userId} - insufficient permissions`
        });
        
        return c.json({
          error: 'Forbidden',
          message: 'Cannot manage this user'
        }, 403);
      }
      
      const db = drizzle(c.env.DB);
      const userService = createUserService(db);
      
      // Update user role
      const updatedUser = await userService.updateUserRole(
        authContext.tenant_id,
        userId,
        role
      );
      
      // Log role change
      await auditService.logSensitiveOperation('USER_ROLE_CHANGED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `User ${updatedUser.email} role changed to: ${role}`
      });
      
      return c.json({
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        locationId: updatedUser.locationId,
        updatedAt: updatedUser.updatedAt,
        message: 'Role updated successfully'
      });
      
    } catch (error) {
      // Log failed role update
      await auditService.logSensitiveOperation('USER_ROLE_UPDATE_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Role update failed for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * PUT /users/:userId/location - Update user location assignment (ADMIN and MANAGER only)
 * Requirements: 5.1, 5.2, 4.3, 4.4
 * 
 * This endpoint demonstrates:
 * - Location-based access control management
 * - Role-based authorization for user management
 * - Location assignment updates
 */
users.put('/:userId/location',
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  validateBody(updateUserLocationSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const authorizationService = getAuthorizationService(c);
    const auditContext = extractAuditContext(c);
    const userId = c.req.param('userId');
    
    try {
      const { locationId } = getValidatedBody<{ locationId: string | null }>(c);
      
      // Check if the current user can manage the target user
      const canManage = await authorizationService.canManageUser(
        authContext.user_id,
        userId,
        authContext.tenant_id
      );
      
      if (!canManage) {
        await auditService.logAuthorizationEvent('ACCESS_DENIED', {
          ...auditContext,
          tenantId: authContext.tenant_id,
          userId: authContext.user_id,
          resource: `Attempted to update location for user ${userId} - insufficient permissions`
        });
        
        return c.json({
          error: 'Forbidden',
          message: 'Cannot manage this user'
        }, 403);
      }
      
      const db = drizzle(c.env.DB);
      const userService = createUserService(db);
      
      // Update user location
      const updatedUser = await userService.updateUserLocation(
        authContext.tenant_id,
        userId,
        locationId
      );
      
      // Log location assignment change
      const locationMsg = locationId ? `assigned to location: ${locationId}` : 'removed from location assignment';
      await auditService.logSensitiveOperation('USER_LOCATION_CHANGED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `User ${updatedUser.email} ${locationMsg}`
      });
      
      return c.json({
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        locationId: updatedUser.locationId,
        updatedAt: updatedUser.updatedAt,
        message: 'Location assignment updated successfully'
      });
      
    } catch (error) {
      // Log failed location update
      await auditService.logSensitiveOperation('USER_LOCATION_UPDATE_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Location update failed for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * POST /users/me/change-password - Change current user's password
 * Requirements: 2.2, 7.1
 * 
 * This endpoint demonstrates:
 * - Self-service password management
 * - Secure password validation
 * - Current password verification
 */
users.post('/me/change-password',
  validateBody(changePasswordSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const auditContext = extractAuditContext(c);
    
    try {
      const { currentPassword, newPassword } = getValidatedBody<{
        currentPassword: string;
        newPassword: string;
      }>(c);
      
      const db = drizzle(c.env.DB);
      const userService = createUserService(db);
      
      // Change password (includes current password verification)
      const success = await userService.changePassword(
        authContext.tenant_id,
        authContext.user_id,
        currentPassword,
        newPassword
      );
      
      if (!success) {
        await auditService.logSensitiveOperation('PASSWORD_CHANGE_FAILED', {
          ...auditContext,
          tenantId: authContext.tenant_id,
          userId: authContext.user_id,
          resource: 'Password change failed - verification error'
        });
        
        return c.json({
          error: 'Bad Request',
          message: 'Password change failed'
        }, 400);
      }
      
      // Log successful password change
      await auditService.logSensitiveOperation('PASSWORD_CHANGED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: 'User password changed successfully'
      });
      
      return c.json({
        message: 'Password changed successfully'
      });
      
    } catch (error) {
      // Log failed password change
      await auditService.logSensitiveOperation('PASSWORD_CHANGE_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Password change failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * DELETE /users/:userId - Delete user (ADMIN only)
 * Requirements: 4.3
 * 
 * This endpoint demonstrates:
 * - ADMIN-only destructive operations
 * - User management with proper authorization
 * - Audit logging for user deletion
 */
users.delete('/:userId',
  requireRole([UserRole.ADMIN]),
  async (c) => {
    const authContext = getAuthContext(c);
    const auditService = getAuditService(c);
    const authorizationService = getAuthorizationService(c);
    const auditContext = extractAuditContext(c);
    const userId = c.req.param('userId');
    
    try {
      // Prevent self-deletion
      if (userId === authContext.user_id) {
        return c.json({
          error: 'Bad Request',
          message: 'Cannot delete your own account'
        }, 400);
      }
      
      // Check if the current user can manage the target user
      const canManage = await authorizationService.canManageUser(
        authContext.user_id,
        userId,
        authContext.tenant_id
      );
      
      if (!canManage) {
        await auditService.logAuthorizationEvent('ACCESS_DENIED', {
          ...auditContext,
          tenantId: authContext.tenant_id,
          userId: authContext.user_id,
          resource: `Attempted to delete user ${userId} - insufficient permissions`
        });
        
        return c.json({
          error: 'Forbidden',
          message: 'Cannot manage this user'
        }, 403);
      }
      
      const db = drizzle(c.env.DB);
      const userService = createUserService(db);
      
      // Get user info before deletion for audit log
      const userToDelete = await userService.getUserById(authContext.tenant_id, userId);
      if (!userToDelete) {
        return c.json({
          error: 'Not Found',
          message: 'User not found'
        }, 404);
      }
      
      // Delete user
      const success = await userService.deleteUser(authContext.tenant_id, userId);
      
      if (!success) {
        return c.json({
          error: 'Internal Server Error',
          message: 'Failed to delete user'
        }, 500);
      }
      
      // Log user deletion
      await auditService.logSensitiveOperation('USER_DELETED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `User deleted: ${userToDelete.email} (${userToDelete.role})`
      });
      
      return c.json({
        message: 'User deleted successfully'
      });
      
    } catch (error) {
      // Log failed user deletion
      await auditService.logSensitiveOperation('USER_DELETION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `User deletion failed for ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error; // Let error middleware handle it
    }
  }
);

export default users;