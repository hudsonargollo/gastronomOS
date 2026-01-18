import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, asc } from 'drizzle-orm';
import { users, locations, tenants, authAuditLog } from '../db/schema';

/**
 * Query Optimizer Service
 * 
 * Provides optimized query patterns and caching for common database operations.
 * Focuses on tenant-scoped queries with proper indexing utilization.
 * 
 * Requirements: 3.1, 5.2 - Optimize tenant-scoped query performance
 */

// Simple in-memory cache for frequently accessed data
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class QueryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  invalidate(keyPattern: string): void {
    // Remove all keys that match the pattern
    for (const key of this.cache.keys()) {
      if (key.includes(keyPattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export interface IQueryOptimizer {
  // Optimized tenant queries
  getTenantWithCache(tenantId: string): Promise<any>;
  getTenantUsersOptimized(tenantId: string, options?: {
    role?: string;
    locationId?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]>;
  
  // Optimized location queries
  getTenantLocationsOptimized(tenantId: string, type?: string): Promise<any[]>;
  getLocationUsersOptimized(tenantId: string, locationId: string): Promise<any[]>;
  
  // Optimized audit queries
  getRecentAuditLogsOptimized(tenantId: string, options?: {
    eventType?: string;
    userId?: string;
    limit?: number;
    hours?: number;
  }): Promise<any[]>;
  
  // Cache management
  invalidateTenantCache(tenantId: string): void;
  getCacheStats(): { size: number; hitRate: number };
}

export class QueryOptimizer implements IQueryOptimizer {
  private cache = new QueryCache();
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(private db: DrizzleD1Database) {}

  /**
   * Get tenant with caching for frequently accessed tenant data
   */
  async getTenantWithCache(tenantId: string): Promise<any> {
    const cacheKey = `tenant:${tenantId}`;
    
    // Try cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return cached;
    }

    this.cacheMisses++;

    // Query database with optimized index usage
    const [tenant] = await this.db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        createdAt: tenants.createdAt,
        settings: tenants.settings,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (tenant) {
      // Cache for 10 minutes (tenant data changes infrequently)
      this.cache.set(cacheKey, tenant, 10 * 60 * 1000);
    }

    return tenant || null;
  }

  /**
   * Optimized tenant users query with filtering and pagination
   * Uses composite indexes for efficient tenant + role/location filtering
   */
  async getTenantUsersOptimized(tenantId: string, options: {
    role?: string;
    locationId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<any[]> {
    const { role, locationId, limit = 50, offset = 0 } = options;

    // Build cache key based on parameters
    const cacheKey = `users:${tenantId}:${role || 'all'}:${locationId || 'all'}:${limit}:${offset}`;
    
    // Try cache first (shorter TTL for user data)
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return cached;
    }

    this.cacheMisses++;

    // Build optimized query using composite indexes
    let query = this.db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        locationId: users.locationId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.tenantId, tenantId));

    // Add role filter (uses user_tenant_role_idx composite index)
    if (role) {
      query = query.where(and(
        eq(users.tenantId, tenantId),
        eq(users.role, role)
      ));
    }

    // Add location filter (uses user_tenant_location_idx composite index)
    if (locationId) {
      query = query.where(and(
        eq(users.tenantId, tenantId),
        eq(users.locationId, locationId)
      ));
    }

    // Apply pagination and ordering
    const results = await query
      .orderBy(asc(users.email)) // Consistent ordering for pagination
      .limit(limit)
      .offset(offset);

    // Cache for 2 minutes (user data changes more frequently)
    this.cache.set(cacheKey, results, 2 * 60 * 1000);

    return results;
  }

  /**
   * Optimized tenant locations query with type filtering
   * Uses location_tenant_type_idx composite index
   */
  async getTenantLocationsOptimized(tenantId: string, type?: string): Promise<any[]> {
    const cacheKey = `locations:${tenantId}:${type || 'all'}`;
    
    // Try cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return cached;
    }

    this.cacheMisses++;

    let query = this.db
      .select({
        id: locations.id,
        name: locations.name,
        type: locations.type,
        address: locations.address,
        createdAt: locations.createdAt,
      })
      .from(locations)
      .where(eq(locations.tenantId, tenantId));

    // Add type filter if specified (uses location_tenant_type_idx)
    if (type) {
      query = query.where(and(
        eq(locations.tenantId, tenantId),
        eq(locations.type, type)
      ));
    }

    const results = await query.orderBy(asc(locations.name));

    // Cache for 5 minutes (location data changes infrequently)
    this.cache.set(cacheKey, results, 5 * 60 * 1000);

    return results;
  }

  /**
   * Get users for a specific location within a tenant
   * Uses user_tenant_location_idx composite index
   */
  async getLocationUsersOptimized(tenantId: string, locationId: string): Promise<any[]> {
    const cacheKey = `location-users:${tenantId}:${locationId}`;
    
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return cached;
    }

    this.cacheMisses++;

    // Use composite index for efficient filtering
    const results = await this.db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(
        eq(users.tenantId, tenantId),
        eq(users.locationId, locationId)
      ))
      .orderBy(asc(users.email));

    // Cache for 3 minutes
    this.cache.set(cacheKey, results, 3 * 60 * 1000);

    return results;
  }

  /**
   * Optimized recent audit logs query
   * Uses audit_tenant_created_at_idx and audit_tenant_event_type_idx composite indexes
   */
  async getRecentAuditLogsOptimized(tenantId: string, options: {
    eventType?: string;
    userId?: string;
    limit?: number;
    hours?: number;
  } = {}): Promise<any[]> {
    const { eventType, userId, limit = 100, hours = 24 } = options;
    
    const cacheKey = `audit:${tenantId}:${eventType || 'all'}:${userId || 'all'}:${limit}:${hours}`;
    
    // Shorter cache for audit logs (they change frequently)
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return cached;
    }

    this.cacheMisses++;

    // Calculate time threshold
    const timeThreshold = Date.now() - (hours * 60 * 60 * 1000);

    let query = this.db
      .select({
        id: authAuditLog.id,
        userId: authAuditLog.userId,
        eventType: authAuditLog.eventType,
        resource: authAuditLog.resource,
        ipAddress: authAuditLog.ipAddress,
        createdAt: authAuditLog.createdAt,
      })
      .from(authAuditLog)
      .where(and(
        eq(authAuditLog.tenantId, tenantId),
        // Use created_at index for time-based filtering
        // Note: In SQLite, we need to be careful with timestamp comparisons
      ));

    // Add event type filter (uses audit_tenant_event_type_idx)
    if (eventType) {
      query = query.where(and(
        eq(authAuditLog.tenantId, tenantId),
        eq(authAuditLog.eventType, eventType)
      ));
    }

    // Add user filter (uses audit_tenant_user_idx)
    if (userId) {
      query = query.where(and(
        eq(authAuditLog.tenantId, tenantId),
        eq(authAuditLog.userId, userId)
      ));
    }

    const results = await query
      .orderBy(desc(authAuditLog.createdAt)) // Most recent first
      .limit(limit);

    // Filter by time threshold in application layer for now
    // In production, you'd want to add a WHERE clause for createdAt
    const filteredResults = results.filter(log => log.createdAt >= timeThreshold);

    // Cache for 1 minute (audit data is time-sensitive)
    this.cache.set(cacheKey, filteredResults, 60 * 1000);

    return filteredResults;
  }

  /**
   * Invalidate all cached data for a tenant
   * Call this when tenant data changes
   */
  invalidateTenantCache(tenantId: string): void {
    this.cache.invalidate(tenantId);
  }

  /**
   * Get cache performance statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0;

    return {
      size: this.cache.size(),
      hitRate: Math.round(hitRate * 100) / 100, // Round to 2 decimal places
    };
  }

  /**
   * Clear all cache data (useful for testing or memory management)
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

/**
 * Factory function to create QueryOptimizer instance
 */
export function createQueryOptimizer(db: DrizzleD1Database): IQueryOptimizer {
  return new QueryOptimizer(db);
}

/**
 * Query optimization utilities
 */
export const QueryUtils = {
  /**
   * Build efficient tenant-scoped WHERE conditions
   */
  tenantScope: (tenantId: string) => eq(users.tenantId, tenantId),
  
  /**
   * Build efficient tenant + role WHERE conditions
   */
  tenantRoleScope: (tenantId: string, role: string) => and(
    eq(users.tenantId, tenantId),
    eq(users.role, role)
  ),
  
  /**
   * Build efficient tenant + location WHERE conditions
   */
  tenantLocationScope: (tenantId: string, locationId: string) => and(
    eq(users.tenantId, tenantId),
    eq(users.locationId, locationId)
  ),
  
  /**
   * Standard pagination parameters with sensible defaults
   */
  paginationDefaults: {
    limit: 50,
    maxLimit: 1000,
    defaultOffset: 0,
  },
  
  /**
   * Validate and sanitize pagination parameters
   */
  sanitizePagination: (limit?: number, offset?: number) => ({
    limit: Math.min(limit || QueryUtils.paginationDefaults.limit, QueryUtils.paginationDefaults.maxLimit),
    offset: Math.max(offset || QueryUtils.paginationDefaults.defaultOffset, 0),
  }),
};