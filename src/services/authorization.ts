import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { users, locations, UserRoleType, UserRole } from '../db/schema';

// Permission interface as defined in the design document
export interface Permission {
  resource: string;    // e.g., 'purchase_orders', 'inventory', 'users'
  action: string;      // e.g., 'read', 'write', 'approve', 'delete'
}

// Authorization service interface
export interface IAuthorizationService {
  hasPermission(role: UserRoleType, permission: Permission): boolean;
  canAccessLocation(userId: string, tenantId: string, locationId: string): Promise<boolean>;
  getRolePermissions(role: UserRoleType): Permission[];
  validateRole(role: string): boolean;
  canManageUsers(role: UserRoleType): boolean;
  canApproveOrders(role: UserRoleType): boolean;
  canReceiveOrders(role: UserRoleType): boolean;
  canCancelOrders(role: UserRoleType): boolean;
  canManageSuppliers(role: UserRoleType): boolean;
  canViewPriceHistory(role: UserRoleType): boolean;
  canAccessAllLocations(role: UserRoleType): boolean;
  canManageUser(managerId: string, targetUserId: string, tenantId: string): Promise<boolean>;
  canPerformAction(
    userId: string,
    tenantId: string,
    resource: string,
    action: string,
    locationId?: string
  ): Promise<boolean>;
  canAccessPurchaseOrder(
    userId: string, 
    tenantId: string, 
    poId: string, 
    action: 'read' | 'write' | 'approve' | 'receive' | 'cancel'
  ): Promise<boolean>;
  canAccessSupplier(
    userId: string,
    tenantId: string,
    supplierId: string,
    action: 'read' | 'write' | 'delete'
  ): Promise<boolean>;
}

export class AuthorizationService implements IAuthorizationService {
  // Define permission sets for each role
  private readonly rolePermissions: Record<UserRoleType, Permission[]> = {
    [UserRole.ADMIN]: [
      // Full access to all resources and actions
      { resource: 'users', action: 'read' },
      { resource: 'users', action: 'write' },
      { resource: 'users', action: 'delete' },
      { resource: 'tenants', action: 'read' },
      { resource: 'tenants', action: 'write' },
      { resource: 'locations', action: 'read' },
      { resource: 'locations', action: 'write' },
      { resource: 'locations', action: 'delete' },
      { resource: 'inventory', action: 'read' },
      { resource: 'inventory', action: 'write' },
      { resource: 'inventory', action: 'delete' },
      { resource: 'purchase_orders', action: 'read' },
      { resource: 'purchase_orders', action: 'write' },
      { resource: 'purchase_orders', action: 'approve' },
      { resource: 'purchase_orders', action: 'receive' },
      { resource: 'purchase_orders', action: 'cancel' },
      { resource: 'purchase_orders', action: 'delete' },
      { resource: 'suppliers', action: 'read' },
      { resource: 'suppliers', action: 'write' },
      { resource: 'suppliers', action: 'delete' },
      { resource: 'price_history', action: 'read' },
      { resource: 'price_history', action: 'write' },
      { resource: 'reports', action: 'read' },
      { resource: 'audit_logs', action: 'read' },
    ],
    [UserRole.MANAGER]: [
      // Location management and inventory operations
      { resource: 'users', action: 'read' },
      { resource: 'users', action: 'write' }, // Can manage staff users
      { resource: 'locations', action: 'read' },
      { resource: 'locations', action: 'write' }, // Can manage assigned locations
      { resource: 'inventory', action: 'read' },
      { resource: 'inventory', action: 'write' },
      { resource: 'purchase_orders', action: 'read' },
      { resource: 'purchase_orders', action: 'write' },
      { resource: 'purchase_orders', action: 'approve' },
      { resource: 'purchase_orders', action: 'receive' },
      { resource: 'purchase_orders', action: 'cancel' },
      { resource: 'suppliers', action: 'read' },
      { resource: 'suppliers', action: 'write' },
      { resource: 'price_history', action: 'read' },
      { resource: 'reports', action: 'read' },
    ],
    [UserRole.STAFF]: [
      // Basic inventory viewing and updates
      { resource: 'inventory', action: 'read' },
      { resource: 'inventory', action: 'write' }, // Limited to basic updates
      { resource: 'purchase_orders', action: 'read' },
      { resource: 'purchase_orders', action: 'write' }, // Can create drafts
      { resource: 'suppliers', action: 'read' },
      { resource: 'price_history', action: 'read' },
      { resource: 'locations', action: 'read' }, // Can view location info
    ],
  };

  constructor(private db: DrizzleD1Database) {}

  /**
   * Check if a role has a specific permission
   * Requirements: 4.2, 7.2
   */
  hasPermission(role: UserRoleType, permission: Permission): boolean {
    if (!this.validateRole(role)) {
      return false;
    }

    const rolePerms = this.rolePermissions[role];
    return rolePerms.some(perm => 
      perm.resource === permission.resource && perm.action === permission.action
    );
  }

  /**
   * Check if a user can access a specific location
   * Requirements: 5.1, 5.2, 7.3
   */
  async canAccessLocation(userId: string, tenantId: string, locationId: string): Promise<boolean> {
    if (!userId || !tenantId || !locationId) {
      return false;
    }

    // Get user information
    const [user] = await this.db
      .select({
        role: users.role,
        locationId: users.locationId,
        tenantId: users.tenantId,
      })
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);

    if (!user) {
      return false; // User not found or not in tenant
    }

    // ADMIN users can access all locations within their tenant
    if (user.role === UserRole.ADMIN) {
      // Verify the location belongs to the tenant
      const [location] = await this.db
        .select({ id: locations.id })
        .from(locations)
        .where(and(
          eq(locations.id, locationId),
          eq(locations.tenantId, tenantId)
        ))
        .limit(1);

      return !!location;
    }

    // Users with no location assignment can access all locations (typically ADMIN/MANAGER)
    if (!user.locationId) {
      // Verify the location belongs to the tenant
      const [location] = await this.db
        .select({ id: locations.id })
        .from(locations)
        .where(and(
          eq(locations.id, locationId),
          eq(locations.tenantId, tenantId)
        ))
        .limit(1);

      return !!location;
    }

    // Location-scoped users can only access their assigned location
    return user.locationId === locationId;
  }

  /**
   * Get all permissions for a specific role
   * Requirements: 4.1, 4.3, 4.4, 4.5
   */
  getRolePermissions(role: UserRoleType): Permission[] {
    if (!this.validateRole(role)) {
      return [];
    }

    return [...this.rolePermissions[role]]; // Return a copy to prevent mutation
  }

  /**
   * Validate if a role is supported
   * Requirements: 4.1
   */
  validateRole(role: string): boolean {
    return Object.values(UserRole).includes(role as UserRoleType);
  }

  /**
   * Check if a role can manage users
   * Requirements: 4.3, 4.4
   */
  canManageUsers(role: UserRoleType): boolean {
    return this.hasPermission(role, { resource: 'users', action: 'write' });
  }

  /**
   * Check if a role can approve purchase orders
   * Requirements: 4.3, 4.4
   */
  canApproveOrders(role: UserRoleType): boolean {
    return this.hasPermission(role, { resource: 'purchase_orders', action: 'approve' });
  }

  /**
   * Check if a role can receive purchase orders
   * Requirements: 7, 8
   */
  canReceiveOrders(role: UserRoleType): boolean {
    return this.hasPermission(role, { resource: 'purchase_orders', action: 'receive' });
  }

  /**
   * Check if a role can cancel purchase orders
   * Requirements: 7, 8
   */
  canCancelOrders(role: UserRoleType): boolean {
    return this.hasPermission(role, { resource: 'purchase_orders', action: 'cancel' });
  }

  /**
   * Check if a role can manage suppliers
   * Requirements: 7, 8
   */
  canManageSuppliers(role: UserRoleType): boolean {
    return this.hasPermission(role, { resource: 'suppliers', action: 'write' });
  }

  /**
   * Check if a role can view price history
   * Requirements: 7, 8
   */
  canViewPriceHistory(role: UserRoleType): boolean {
    return this.hasPermission(role, { resource: 'price_history', action: 'read' });
  }

  /**
   * Check if a role can access all locations (not location-scoped)
   * Requirements: 4.3, 5.4
   */
  canAccessAllLocations(role: UserRoleType): boolean {
    // Only ADMIN users have unrestricted location access by default
    // MANAGER users may have location restrictions based on their assignment
    return role === UserRole.ADMIN;
  }

  /**
   * Check if a user can perform an action on a specific resource at a location
   * This combines role-based and location-based authorization
   * Requirements: 4.2, 5.1, 5.2, 7.2, 7.3
   */
  async canPerformAction(
    userId: string,
    tenantId: string,
    resource: string,
    action: string,
    locationId?: string
  ): Promise<boolean> {
    if (!userId || !tenantId || !resource || !action) {
      return false;
    }

    // Get user information
    const [user] = await this.db
      .select({
        role: users.role,
        locationId: users.locationId,
      })
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);

    if (!user) {
      return false; // User not found
    }

    // Check role-based permission
    const hasRolePermission = this.hasPermission(user.role as UserRoleType, { resource, action });
    if (!hasRolePermission) {
      return false;
    }

    // If no location is specified, role permission is sufficient
    if (!locationId) {
      return true;
    }

    // Check location-based access
    return await this.canAccessLocation(userId, tenantId, locationId);
  }

  /**
   * Get user's effective permissions considering their role and location assignment
   * Requirements: 4.2, 5.1, 5.2
   */
  async getUserEffectivePermissions(userId: string, tenantId: string): Promise<{
    permissions: Permission[];
    locationRestricted: boolean;
    assignedLocationId?: string;
  }> {
    if (!userId || !tenantId) {
      return { permissions: [], locationRestricted: false };
    }

    // Get user information
    const [user] = await this.db
      .select({
        role: users.role,
        locationId: users.locationId,
      })
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);

    if (!user) {
      return { permissions: [], locationRestricted: false };
    }

    const permissions = this.getRolePermissions(user.role as UserRoleType);
    const locationRestricted = !!user.locationId;

    const result: {
      permissions: Permission[];
      locationRestricted: boolean;
      assignedLocationId?: string;
    } = {
      permissions,
      locationRestricted,
    };

    if (user.locationId) {
      result.assignedLocationId = user.locationId;
    }

    return result;
  }

  /**
   * Check if a user can manage another user (role hierarchy)
   * Requirements: 4.3, 4.4, 4.5
   */
  async canManageUser(managerId: string, targetUserId: string, tenantId: string): Promise<boolean> {
    if (!managerId || !targetUserId || !tenantId) {
      return false;
    }

    // Users cannot manage themselves through this method
    if (managerId === targetUserId) {
      return false;
    }

    // Get both users' information
    const [manager, targetUser] = await Promise.all([
      this.db
        .select({ role: users.role })
        .from(users)
        .where(and(eq(users.id, managerId), eq(users.tenantId, tenantId)))
        .limit(1)
        .then(result => result[0]),
      this.db
        .select({ role: users.role })
        .from(users)
        .where(and(eq(users.id, targetUserId), eq(users.tenantId, tenantId)))
        .limit(1)
        .then(result => result[0])
    ]);

    if (!manager || !targetUser) {
      return false; // One or both users not found
    }

    const managerRole = manager.role as UserRoleType;
    const targetRole = targetUser.role as UserRoleType;

    // Check if manager has user management permissions
    if (!this.canManageUsers(managerRole)) {
      return false;
    }

    // Role hierarchy: ADMIN can manage everyone, MANAGER can manage STAFF
    if (managerRole === UserRole.ADMIN) {
      return true; // ADMIN can manage all users
    }

    if (managerRole === UserRole.MANAGER && targetRole === UserRole.STAFF) {
      return true; // MANAGER can manage STAFF
    }

    // MANAGER cannot manage other MANAGERs or ADMINs
    // STAFF cannot manage anyone (already filtered out by canManageUsers check)
    return false;
  }

  /**
   * Check if a user can access a specific purchase order
   * Combines role-based permissions with location-based access control
   * Requirements: 7, 8
   */
  async canAccessPurchaseOrder(
    userId: string, 
    tenantId: string, 
    poId: string, 
    action: 'read' | 'write' | 'approve' | 'receive' | 'cancel'
  ): Promise<boolean> {
    if (!userId || !tenantId || !poId || !action) {
      return false;
    }

    // Get user information
    const [user] = await this.db
      .select({
        role: users.role,
        locationId: users.locationId,
      })
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);

    if (!user) {
      return false; // User not found
    }

    // Check role-based permission for purchase orders
    const hasRolePermission = this.hasPermission(user.role as UserRoleType, { 
      resource: 'purchase_orders', 
      action 
    });

    if (!hasRolePermission) {
      return false;
    }

    // Import purchase order schema to check PO details
    const { purchaseOrders } = await import('../db/schema');

    // Get purchase order information to check tenant isolation
    const [po] = await this.db
      .select({
        tenantId: purchaseOrders.tenantId,
        createdBy: purchaseOrders.createdBy,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, poId))
      .limit(1);

    if (!po) {
      return false; // Purchase order not found
    }

    // Ensure tenant isolation - PO must belong to user's tenant
    if (po.tenantId !== tenantId) {
      return false;
    }

    // ADMIN users can access all POs within their tenant
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Users with no location restriction can access all POs in their tenant
    if (!user.locationId) {
      return true;
    }

    // For location-restricted users, they can access POs they created
    // or POs that don't have location restrictions
    if (po.createdBy === userId) {
      return true;
    }

    // Additional location-based logic could be added here if POs have location associations
    // For now, location-restricted users can access any PO in their tenant
    return true;
  }

  /**
   * Check if a user can access supplier information
   * Requirements: 7, 8
   */
  async canAccessSupplier(
    userId: string,
    tenantId: string,
    supplierId: string,
    action: 'read' | 'write' | 'delete'
  ): Promise<boolean> {
    if (!userId || !tenantId || !supplierId || !action) {
      return false;
    }

    // Get user information
    const [user] = await this.db
      .select({
        role: users.role,
      })
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);

    if (!user) {
      return false; // User not found
    }

    // Check role-based permission for suppliers
    const hasRolePermission = this.hasPermission(user.role as UserRoleType, { 
      resource: 'suppliers', 
      action 
    });

    if (!hasRolePermission) {
      return false;
    }

    // Import supplier schema to check supplier details
    const { suppliers } = await import('../db/schema');

    // Get supplier information to check tenant isolation
    const [supplier] = await this.db
      .select({
        tenantId: suppliers.tenantId,
      })
      .from(suppliers)
      .where(eq(suppliers.id, supplierId))
      .limit(1);

    if (!supplier) {
      return false; // Supplier not found
    }

    // Ensure tenant isolation - supplier must belong to user's tenant
    return supplier.tenantId === tenantId;
  }
}

/**
 * Factory function to create AuthorizationService instance
 */
export function createAuthorizationService(db: DrizzleD1Database): IAuthorizationService {
  return new AuthorizationService(db);
}