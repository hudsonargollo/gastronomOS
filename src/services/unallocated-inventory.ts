/**
 * Unallocated Inventory Management Service
 * 
 * Manages unallocated quantities, central warehouse auto-assignment, and manual allocation
 * of previously unallocated quantities. Implements requirements 3.1, 3.3, 3.4, 3.5.
 */

import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, sum, sql } from 'drizzle-orm';
import { 
  allocations,
  poItems,
  purchaseOrders,
  locations,
  users,
  products,
  AllocationStatus,
  POStatus
} from '../db/schema';
import { generateId, getCurrentTimestamp } from '../utils';
import { createAllocationService, CreateAllocationRequest } from './allocation';

// Type definitions for unallocated inventory management
export interface UnallocatedItem {
  poItemId: string;
  poId: string;
  poNumber: string;
  productId: string;
  productName: string;
  quantityOrdered: number;
  quantityAllocated: number;
  unallocatedQuantity: number;
  unallocatedPercentage: number;
  unitPriceCents: number;
  unallocatedValueCents: number;
  createdAt: number;
}

export interface UnallocatedSummary {
  totalItems: number;
  totalUnallocatedQuantity: number;
  totalUnallocatedValueCents: number;
  averageUnallocatedPercentage: number;
  itemsByCategory: Array<{
    category: string;
    itemCount: number;
    unallocatedQuantity: number;
    unallocatedValueCents: number;
  }>;
  topUnallocatedItems: UnallocatedItem[];
}

export interface CentralWarehouseAssignment {
  poItemId: string;
  centralWarehouseId: string;
  quantityAssigned: number;
  assignmentReason: 'AUTO_ASSIGNMENT' | 'MANUAL_ASSIGNMENT' | 'TENANT_CONFIG';
  assignedAt: number;
  assignedBy: string;
}

export interface UnallocatedAllocationRequest {
  poItemId: string;
  targetLocationId: string;
  quantityToAllocate: number;
  notes?: string;
}

export interface UnallocatedAllocationResult {
  success: boolean;
  allocationId?: string;
  remainingUnallocated: number;
  errors: string[];
}

export interface LocationUnallocatedInventory {
  locationId: string;
  locationName: string;
  unallocatedItems: UnallocatedItem[];
  totalUnallocatedQuantity: number;
  totalUnallocatedValueCents: number;
}

export interface TenantUnallocatedConfig {
  tenantId: string;
  centralWarehouseId?: string;
  autoAssignUnallocated: boolean;
  unallocatedThresholdPercentage: number; // Auto-assign if unallocated % exceeds this
  notificationSettings: {
    notifyOnHighUnallocated: boolean;
    highUnallocatedThreshold: number;
    notificationRecipients: string[];
  };
}

// Unallocated inventory service interface
export interface IUnallocatedInventoryService {
  getUnallocatedItems(tenantId: string, filters?: UnallocatedFilters): Promise<UnallocatedItem[]>;
  getUnallocatedSummary(tenantId: string, dateRange?: { from: Date; to: Date }): Promise<UnallocatedSummary>;
  getUnallocatedForPO(poId: string, tenantId: string): Promise<UnallocatedItem[]>;
  getUnallocatedForLocation(locationId: string, tenantId: string): Promise<LocationUnallocatedInventory>;
  
  assignToCentralWarehouse(
    poItemId: string, 
    centralWarehouseId: string, 
    tenantId: string, 
    assignedBy: string,
    reason?: 'AUTO_ASSIGNMENT' | 'MANUAL_ASSIGNMENT'
  ): Promise<CentralWarehouseAssignment>;
  
  allocateUnallocatedQuantity(
    request: UnallocatedAllocationRequest,
    tenantId: string,
    allocatedBy: string
  ): Promise<UnallocatedAllocationResult>;
  
  processAutoAssignments(tenantId: string): Promise<CentralWarehouseAssignment[]>;
  
  getTenantUnallocatedConfig(tenantId: string): Promise<TenantUnallocatedConfig>;
  updateTenantUnallocatedConfig(tenantId: string, config: Partial<TenantUnallocatedConfig>): Promise<TenantUnallocatedConfig>;
}

export interface UnallocatedFilters {
  poId?: string;
  productId?: string;
  minUnallocatedQuantity?: number;
  minUnallocatedPercentage?: number;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export class UnallocatedInventoryService implements IUnallocatedInventoryService {
  constructor(private db: DrizzleD1Database) {}

  /**
   * Get all unallocated items for a tenant with filtering
   * Requirements: 3.1, 3.3
   */
  async getUnallocatedItems(tenantId: string, filters?: UnallocatedFilters): Promise<UnallocatedItem[]> {
    // Build base query to get PO items with their allocation totals
    let query = this.db
      .select({
        poItem: poItems,
        purchaseOrder: purchaseOrders,
        product: products,
        totalAllocated: sql<number>`COALESCE(SUM(${allocations.quantityAllocated}), 0)`.as('totalAllocated')
      })
      .from(poItems)
      .innerJoin(purchaseOrders, eq(poItems.poId, purchaseOrders.id))
      .innerJoin(products, eq(poItems.productId, products.id))
      .leftJoin(allocations, and(
        eq(allocations.poItemId, poItems.id),
        eq(allocations.tenantId, tenantId)
      ))
      .where(and(
        eq(purchaseOrders.tenantId, tenantId),
        eq(purchaseOrders.status, POStatus.APPROVED) // Only approved POs
      ))
      .groupBy(poItems.id, purchaseOrders.id, products.id);

    // Apply filters
    const conditions = [
      eq(purchaseOrders.tenantId, tenantId),
      eq(purchaseOrders.status, POStatus.APPROVED)
    ];

    if (filters?.poId) {
      conditions.push(eq(purchaseOrders.id, filters.poId));
    }

    if (filters?.productId) {
      conditions.push(eq(products.id, filters.productId));
    }

    if (filters?.dateFrom) {
      conditions.push(sql`${purchaseOrders.createdAt} >= ${filters.dateFrom.getTime()}`);
    }

    if (filters?.dateTo) {
      conditions.push(sql`${purchaseOrders.createdAt} <= ${filters.dateTo.getTime()}`);
    }

    const results = await this.db
      .select({
        poItem: poItems,
        purchaseOrder: purchaseOrders,
        product: products,
        totalAllocated: sql<number>`COALESCE(SUM(${allocations.quantityAllocated}), 0)`.as('totalAllocated')
      })
      .from(poItems)
      .innerJoin(purchaseOrders, eq(poItems.poId, purchaseOrders.id))
      .innerJoin(products, eq(poItems.productId, products.id))
      .leftJoin(allocations, and(
        eq(allocations.poItemId, poItems.id),
        eq(allocations.tenantId, tenantId)
      ))
      .where(and(...conditions))
      .groupBy(poItems.id, purchaseOrders.id, products.id)
      .limit(filters?.limit || 100)
      .offset(filters?.offset || 0);

    // Filter and transform results to only include items with unallocated quantities
    const unallocatedItems: UnallocatedItem[] = [];

    for (const result of results) {
      const quantityOrdered = result.poItem.quantityOrdered;
      const quantityAllocated = result.totalAllocated || 0;
      const unallocatedQuantity = quantityOrdered - quantityAllocated;

      // Only include items that have unallocated quantities
      if (unallocatedQuantity > 0) {
        const unallocatedPercentage = (unallocatedQuantity / quantityOrdered) * 100;
        const unallocatedValueCents = unallocatedQuantity * result.poItem.unitPriceCents;

        // Apply additional filters
        if (filters?.minUnallocatedQuantity && unallocatedQuantity < filters.minUnallocatedQuantity) {
          continue;
        }

        if (filters?.minUnallocatedPercentage && unallocatedPercentage < filters.minUnallocatedPercentage) {
          continue;
        }

        unallocatedItems.push({
          poItemId: result.poItem.id,
          poId: result.purchaseOrder.id,
          poNumber: result.purchaseOrder.poNumber || `PO-${result.purchaseOrder.id.slice(-8)}`,
          productId: result.product.id,
          productName: result.product.name,
          quantityOrdered,
          quantityAllocated,
          unallocatedQuantity,
          unallocatedPercentage,
          unitPriceCents: result.poItem.unitPriceCents,
          unallocatedValueCents,
          createdAt: result.poItem.createdAt
        });
      }
    }

    return unallocatedItems;
  }

  /**
   * Get summary statistics for unallocated inventory
   * Requirements: 3.3, 3.5
   */
  async getUnallocatedSummary(tenantId: string, dateRange?: { from: Date; to: Date }): Promise<UnallocatedSummary> {
    const filters: UnallocatedFilters = {};
    if (dateRange) {
      filters.dateFrom = dateRange.from;
      filters.dateTo = dateRange.to;
    }

    const unallocatedItems = await this.getUnallocatedItems(tenantId, filters);

    if (unallocatedItems.length === 0) {
      return {
        totalItems: 0,
        totalUnallocatedQuantity: 0,
        totalUnallocatedValueCents: 0,
        averageUnallocatedPercentage: 0,
        itemsByCategory: [],
        topUnallocatedItems: []
      };
    }

    // Calculate totals
    const totalItems = unallocatedItems.length;
    const totalUnallocatedQuantity = unallocatedItems.reduce((sum, item) => sum + item.unallocatedQuantity, 0);
    const totalUnallocatedValueCents = unallocatedItems.reduce((sum, item) => sum + item.unallocatedValueCents, 0);
    const averageUnallocatedPercentage = unallocatedItems.reduce((sum, item) => sum + item.unallocatedPercentage, 0) / totalItems;

    // Group by product category (simplified - would normally join with product categories)
    const categoryMap = new Map<string, {
      itemCount: number;
      unallocatedQuantity: number;
      unallocatedValueCents: number;
    }>();

    unallocatedItems.forEach(item => {
      const category = 'General'; // Simplified - would use actual product category
      const existing = categoryMap.get(category) || {
        itemCount: 0,
        unallocatedQuantity: 0,
        unallocatedValueCents: 0
      };

      existing.itemCount++;
      existing.unallocatedQuantity += item.unallocatedQuantity;
      existing.unallocatedValueCents += item.unallocatedValueCents;

      categoryMap.set(category, existing);
    });

    const itemsByCategory = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      ...data
    }));

    // Get top 10 unallocated items by value
    const topUnallocatedItems = unallocatedItems
      .sort((a, b) => b.unallocatedValueCents - a.unallocatedValueCents)
      .slice(0, 10);

    return {
      totalItems,
      totalUnallocatedQuantity,
      totalUnallocatedValueCents,
      averageUnallocatedPercentage,
      itemsByCategory,
      topUnallocatedItems
    };
  }

  /**
   * Get unallocated items for a specific purchase order
   * Requirements: 3.1, 3.2
   */
  async getUnallocatedForPO(poId: string, tenantId: string): Promise<UnallocatedItem[]> {
    return this.getUnallocatedItems(tenantId, { poId });
  }

  /**
   * Get unallocated inventory that could be assigned to a specific location
   * Requirements: 3.4, 3.5
   */
  async getUnallocatedForLocation(locationId: string, tenantId: string): Promise<LocationUnallocatedInventory> {
    // Validate location exists
    const [location] = await this.db
      .select()
      .from(locations)
      .where(and(
        eq(locations.id, locationId),
        eq(locations.tenantId, tenantId)
      ))
      .limit(1);

    if (!location) {
      throw new Error('Location not found');
    }

    // Get all unallocated items for the tenant
    const unallocatedItems = await this.getUnallocatedItems(tenantId);

    // Calculate totals
    const totalUnallocatedQuantity = unallocatedItems.reduce((sum, item) => sum + item.unallocatedQuantity, 0);
    const totalUnallocatedValueCents = unallocatedItems.reduce((sum, item) => sum + item.unallocatedValueCents, 0);

    return {
      locationId,
      locationName: location.name,
      unallocatedItems,
      totalUnallocatedQuantity,
      totalUnallocatedValueCents
    };
  }

  /**
   * Assign unallocated quantity to central warehouse
   * Requirements: 3.3, 3.4
   */
  async assignToCentralWarehouse(
    poItemId: string, 
    centralWarehouseId: string, 
    tenantId: string, 
    assignedBy: string,
    reason: 'AUTO_ASSIGNMENT' | 'MANUAL_ASSIGNMENT' = 'MANUAL_ASSIGNMENT'
  ): Promise<CentralWarehouseAssignment> {
    // Get unallocated quantity for this PO item
    const unallocatedItems = await this.getUnallocatedItems(tenantId, { limit: 1000 });
    const targetItem = unallocatedItems.find(item => item.poItemId === poItemId);

    if (!targetItem) {
      throw new Error('No unallocated quantity found for this PO item');
    }

    if (targetItem.unallocatedQuantity <= 0) {
      throw new Error('No unallocated quantity available for assignment');
    }

    // Validate central warehouse location exists
    const [centralWarehouse] = await this.db
      .select()
      .from(locations)
      .where(and(
        eq(locations.id, centralWarehouseId),
        eq(locations.tenantId, tenantId)
      ))
      .limit(1);

    if (!centralWarehouse) {
      throw new Error('Central warehouse location not found');
    }

    // Create allocation for the unallocated quantity
    const allocationService = createAllocationService(this.db);
    
    const allocationRequest: CreateAllocationRequest = {
      poItemId,
      targetLocationId: centralWarehouseId,
      quantityAllocated: targetItem.unallocatedQuantity,
      notes: `${reason === 'AUTO_ASSIGNMENT' ? 'Automatic' : 'Manual'} assignment to central warehouse`
    };

    await allocationService.createAllocation(allocationRequest, tenantId, assignedBy);

    const assignment: CentralWarehouseAssignment = {
      poItemId,
      centralWarehouseId,
      quantityAssigned: targetItem.unallocatedQuantity,
      assignmentReason: reason,
      assignedAt: getCurrentTimestamp(),
      assignedBy
    };

    return assignment;
  }

  /**
   * Allocate specific quantity from unallocated inventory to a location
   * Requirements: 3.4, 3.5
   */
  async allocateUnallocatedQuantity(
    request: UnallocatedAllocationRequest,
    tenantId: string,
    allocatedBy: string
  ): Promise<UnallocatedAllocationResult> {
    try {
      // Get current unallocated quantity
      const unallocatedItems = await this.getUnallocatedItems(tenantId, { limit: 1000 });
      const targetItem = unallocatedItems.find(item => item.poItemId === request.poItemId);

      if (!targetItem) {
        return {
          success: false,
          remainingUnallocated: 0,
          errors: ['No unallocated quantity found for this PO item']
        };
      }

      if (request.quantityToAllocate <= 0) {
        return {
          success: false,
          remainingUnallocated: targetItem.unallocatedQuantity,
          errors: ['Quantity to allocate must be positive']
        };
      }

      if (request.quantityToAllocate > targetItem.unallocatedQuantity) {
        return {
          success: false,
          remainingUnallocated: targetItem.unallocatedQuantity,
          errors: [`Requested quantity (${request.quantityToAllocate}) exceeds unallocated quantity (${targetItem.unallocatedQuantity})`]
        };
      }

      // Create the allocation
      const allocationService = createAllocationService(this.db);
      
      const allocationRequest: CreateAllocationRequest = {
        poItemId: request.poItemId,
        targetLocationId: request.targetLocationId,
        quantityAllocated: request.quantityToAllocate,
        notes: request.notes || 'Allocation from unallocated inventory'
      };

      const allocation = await allocationService.createAllocation(allocationRequest, tenantId, allocatedBy);

      const remainingUnallocated = targetItem.unallocatedQuantity - request.quantityToAllocate;

      return {
        success: true,
        allocationId: allocation.id,
        remainingUnallocated,
        errors: []
      };

    } catch (error) {
      return {
        success: false,
        remainingUnallocated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    }
  }

  /**
   * Process automatic assignments based on tenant configuration
   * Requirements: 3.3, 3.4
   */
  async processAutoAssignments(tenantId: string): Promise<CentralWarehouseAssignment[]> {
    const config = await this.getTenantUnallocatedConfig(tenantId);
    
    if (!config.autoAssignUnallocated || !config.centralWarehouseId) {
      return [];
    }

    // Get items that exceed the threshold for auto-assignment
    const unallocatedItems = await this.getUnallocatedItems(tenantId, {
      minUnallocatedPercentage: config.unallocatedThresholdPercentage
    });

    const assignments: CentralWarehouseAssignment[] = [];

    for (const item of unallocatedItems) {
      try {
        const assignment = await this.assignToCentralWarehouse(
          item.poItemId,
          config.centralWarehouseId,
          tenantId,
          'system', // System user for auto-assignments
          'AUTO_ASSIGNMENT'
        );
        assignments.push(assignment);
      } catch (error) {
        console.error(`Failed to auto-assign item ${item.poItemId}:`, error);
        // Continue with other items
      }
    }

    return assignments;
  }

  /**
   * Get tenant configuration for unallocated inventory management
   * Requirements: 3.3
   */
  async getTenantUnallocatedConfig(tenantId: string): Promise<TenantUnallocatedConfig> {
    // In a real implementation, this would be stored in a configuration table
    // For now, return default configuration
    return {
      tenantId,
      centralWarehouseId: undefined, // Would be configured per tenant
      autoAssignUnallocated: false,
      unallocatedThresholdPercentage: 20, // Auto-assign if >20% unallocated
      notificationSettings: {
        notifyOnHighUnallocated: true,
        highUnallocatedThreshold: 50, // Notify if >50% unallocated
        notificationRecipients: []
      }
    };
  }

  /**
   * Update tenant configuration for unallocated inventory management
   * Requirements: 3.3
   */
  async updateTenantUnallocatedConfig(
    tenantId: string, 
    config: Partial<TenantUnallocatedConfig>
  ): Promise<TenantUnallocatedConfig> {
    // In a real implementation, this would update a configuration table
    // For now, return the updated configuration
    const currentConfig = await this.getTenantUnallocatedConfig(tenantId);
    
    return {
      ...currentConfig,
      ...config,
      tenantId // Ensure tenant ID is not overwritten
    };
  }
}

/**
 * Factory function to create UnallocatedInventoryService instance
 */
export function createUnallocatedInventoryService(db: DrizzleD1Database): IUnallocatedInventoryService {
  return new UnallocatedInventoryService(db);
}