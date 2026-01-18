import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { tenants, users, locations, Tenant, NewTenant, Location } from '../db/schema';
import { CreateTenantRequest } from '../types';
import { generateId } from '../utils';

// TenantService interface as defined in the design document
export interface ITenantService {
  createTenant(data: CreateTenantRequest): Promise<Tenant>;
  getTenant(tenantId: string): Promise<Tenant | null>;
  getTenantBySlug(slug: string): Promise<Tenant | null>;
  validateTenantAccess(tenantId: string, userId: string): Promise<boolean>;
  updateTenantSettings(tenantId: string, settings: Record<string, any>): Promise<Tenant>;
  getTenantLocations(tenantId: string): Promise<Location[]>;
  getTenantUserCount(tenantId: string): Promise<number>;
  
  // Core isolation method - wraps all database queries
  withTenantContext<T>(
    tenantId: string, 
    operation: (db: DrizzleD1Database) => Promise<T>
  ): Promise<T>;
}

export class TenantService implements ITenantService {
  constructor(private db: DrizzleD1Database) {}

  /**
   * Create a new tenant with proper validation
   * Requirements: 1.1, 1.2, 1.3, 1.4
   */
  async createTenant(data: CreateTenantRequest): Promise<Tenant> {
    // Validate tenant slug uniqueness (Requirement 1.2)
    const existingTenant = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, data.slug))
      .limit(1);

    if (existingTenant.length > 0) {
      throw new Error(`Tenant with slug '${data.slug}' already exists`);
    }

    // Validate tenant name is not empty
    if (!data.name.trim()) {
      throw new Error('Tenant name cannot be empty');
    }

    // Validate slug format (alphanumeric and hyphens only)
    if (!/^[a-z0-9-]+$/.test(data.slug)) {
      throw new Error('Tenant slug must contain only lowercase letters, numbers, and hyphens');
    }

    // Create new tenant record (Requirement 1.1)
    const newTenant: NewTenant = {
      id: generateId(),
      name: data.name.trim(),
      slug: data.slug.toLowerCase(),
      createdAt: Date.now(),
      settings: data.settings || null,
    };

    const [createdTenant] = await this.db
      .insert(tenants)
      .values(newTenant)
      .returning();

    if (!createdTenant) {
      throw new Error('Failed to create tenant');
    }

    return createdTenant;
  }

  /**
   * Get tenant by ID with basic metadata only
   * Requirements: 1.4
   */
  async getTenant(tenantId: string): Promise<Tenant | null> {
    if (!tenantId) {
      return null;
    }

    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return tenant || null;
  }

  /**
   * Validate that a user belongs to a specific tenant
   * Used for authorization checks
   */
  async validateTenantAccess(tenantId: string, userId: string): Promise<boolean> {
    if (!tenantId || !userId) {
      return false;
    }

    const [user] = await this.db
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);

    return !!user;
  }

  /**
   * Core tenant isolation wrapper - ensures all database operations are tenant-scoped
   * This is the critical method that enforces data isolation
   * Requirements: 3.1, 3.2, 3.5
   */
  async withTenantContext<T>(
    tenantId: string, 
    operation: (db: DrizzleD1Database) => Promise<T>
  ): Promise<T> {
    if (!tenantId) {
      throw new Error('Tenant ID is required for database operations');
    }

    // Verify tenant exists before allowing operations
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      throw new Error(`Tenant with ID '${tenantId}' not found`);
    }

    // Execute the operation with the database connection
    // The operation function is responsible for including tenant filtering
    // This wrapper provides the context and validation
    try {
      return await operation(this.db);
    } catch (error) {
      // Log the error with tenant context for audit purposes
      console.error(`Database operation failed for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get tenant by slug (useful for login flows)
   */
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    if (!slug) {
      return null;
    }

    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug.toLowerCase()))
      .limit(1);

    return tenant || null;
  }

  /**
   * Update tenant settings (admin only operation)
   */
  async updateTenantSettings(tenantId: string, settings: Record<string, any>): Promise<Tenant> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      throw new Error(`Tenant with ID '${tenantId}' not found`);
    }

    const [updatedTenant] = await this.db
      .update(tenants)
      .set({ 
        settings: settings,
      })
      .where(eq(tenants.id, tenantId))
      .returning();

    if (!updatedTenant) {
      throw new Error('Failed to update tenant settings');
    }

    return updatedTenant;
  }

  /**
   * List all locations for a tenant (used by location-scoped operations)
   */
  async getTenantLocations(tenantId: string): Promise<Location[]> {
    return await this.db
      .select()
      .from(locations)
      .where(eq(locations.tenantId, tenantId));
  }

  /**
   * Get users count for a tenant (for admin dashboard)
   */
  async getTenantUserCount(tenantId: string): Promise<number> {
    const result = await this.db
      .select({ count: users.id })
      .from(users)
      .where(eq(users.tenantId, tenantId));

    return result.length;
  }
}

/**
 * Factory function to create TenantService instance
 */
export function createTenantService(db: DrizzleD1Database): ITenantService {
  return new TenantService(db);
}