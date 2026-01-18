/**
 * Purchase Order Allocation Integration Service
 * 
 * Handles integration between the purchase order system and allocation system.
 * Manages PO status changes, allocation cleanup, and allocation-PO linking.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, sql } from 'drizzle-orm';
import { 
  allocations,
  purchaseOrders,
  poItems,
  users,
  POItem,
  AllocationStatus,
  POStatus,
  POStatusType,
  AllocationStatusType
} from '../db';
import { createAllocationService, AllocationService } from './allocation';

export interface POAllocationSummary {
  poId: string;
  poNumber: string | null;
  poStatus: POStatusType;
  totalLineItems: number;
  totalAllocatedItems: number;
  totalUnallocatedItems: number;
  allocationsByStatus: Record<AllocationStatusType, number>;
  allocationCompleteness: number; // Percentage of items allocated
}

export interface AllocationCleanupResult {
  deletedAllocations: number;
  cancelledAllocations: number;
  affectedLocations: string[];
  cleanupReason: string;
}

export interface AutoAllocationRequest {
  poId: string;
  strategy: 'EQUAL_DISTRIBUTION' | 'PERCENTAGE_BASED' | 'TEMPLATE_BASED';
  parameters?: {
    locationIds?: string[];
    locationPercentages?: Record<string, number>;
    templateId?: string;
  };
}

export interface AutoAllocationResult {
  success: boolean;
  allocationsCreated: number;
  totalQuantityAllocated: number;
  unallocatedQuantity: number;
  errors: string[];
}

export interface POStatusChangeContext {
  poId: string;
  oldStatus: POStatusType;
  newStatus: POStatusType;
  changedBy: string;
  tenantId: string;
  reason?: string;
}

export interface POAllocationIntegrationService {
  // PO-Allocation linking and summary
  getPOAllocationSummary(poId: string, tenantId: string): Promise<POAllocationSummary>;
  
  // PO status change handling
  handlePOStatusChange(context: POStatusChangeContext): Promise<void>;
  
  // Allocation cleanup operations
  cleanupAllocationsOnPOModification(poId: string, tenantId: string, modifiedBy: string, reason: string): Promise<AllocationCleanupResult>;
  
  // Auto-allocation features
  autoAllocatePO(request: AutoAllocationRequest, tenantId: string, createdBy: string): Promise<AutoAllocationResult>;
  
  // Validation and constraints
  validatePOForAllocation(poId: string, tenantId: string): Promise<{ valid: boolean; errors: string[] }>;
  
  // Integration utilities
  syncAllocationStatusWithPO(poId: string, tenantId: string): Promise<void>;
  getUnallocatedPOItems(poId: string, tenantId: string): Promise<Array<POItem & { unallocatedQuantity: number }>>;
}

export class POAllocationIntegrationServiceImpl implements POAllocationIntegrationService {
  private allocationService: AllocationService;

  constructor(private db: DrizzleD1Database) {
    this.allocationService = createAllocationService(db);
  }

  /**
   * Get comprehensive allocation summary for a purchase order
   * Requirements: 8.1, 8.2
   */
  async getPOAllocationSummary(poId: string, tenantId: string): Promise<POAllocationSummary> {
    if (!poId || !tenantId) {
      throw new Error('PO ID and tenant ID are required');
    }

    // Get PO details
    const [po] = await this.db
      .select()
      .from(purchaseOrders)
      .where(and(
        eq(purchaseOrders.id, poId),
        eq(purchaseOrders.tenantId, tenantId)
      ))
      .limit(1);

    if (!po) {
      throw new Error('Purchase order not found');
    }

    // Get PO line items
    const poLineItems = await this.db
      .select()
      .from(poItems)
      .where(eq(poItems.poId, poId));

    // Get all allocations for this PO
    const poAllocations = await this.db
      .select({
        allocation: allocations,
        poItem: poItems
      })
      .from(allocations)
      .innerJoin(poItems, eq(allocations.poItemId, poItems.id))
      .where(and(
        eq(poItems.poId, poId),
        eq(allocations.tenantId, tenantId)
      ));

    // Calculate allocation statistics
    const totalLineItems = poLineItems.length;
    const allocatedItemIds = new Set(poAllocations.map(a => a.allocation.poItemId));
    const totalAllocatedItems = allocatedItemIds.size;
    const totalUnallocatedItems = totalLineItems - totalAllocatedItems;

    // Count allocations by status
    const allocationsByStatus: Record<AllocationStatusType, number> = {
      [AllocationStatus.PENDING]: 0,
      [AllocationStatus.SHIPPED]: 0,
      [AllocationStatus.RECEIVED]: 0,
      [AllocationStatus.CANCELLED]: 0,
    };

    for (const { allocation } of poAllocations) {
      allocationsByStatus[allocation.status as AllocationStatusType]++;
    }

    // Calculate allocation completeness percentage
    const allocationCompleteness = totalLineItems > 0 
      ? Math.round((totalAllocatedItems / totalLineItems) * 100) 
      : 0;

    return {
      poId,
      poNumber: po.poNumber,
      poStatus: po.status as POStatusType,
      totalLineItems,
      totalAllocatedItems,
      totalUnallocatedItems,
      allocationsByStatus,
      allocationCompleteness
    };
  }

  /**
   * Handle PO status changes and propagate to allocations
   * Requirements: 8.1, 8.4
   */
  async handlePOStatusChange(context: POStatusChangeContext): Promise<void> {
    const { poId, oldStatus, newStatus, changedBy, tenantId, reason } = context;

    // Validate user access
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.id, changedBy),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);

    if (!user) {
      throw new Error('User not found in this organization');
    }

    // Get all allocations for this PO
    const poAllocations = await this.db
      .select({
        allocation: allocations,
        poItem: poItems
      })
      .from(allocations)
      .innerJoin(poItems, eq(allocations.poItemId, poItems.id))
      .where(and(
        eq(poItems.poId, poId),
        eq(allocations.tenantId, tenantId)
      ));

    // Handle different status transitions
    switch (newStatus) {
      case POStatus.CANCELLED:
        // Cancel all pending and shipped allocations
        await this.cancelAllocationsForPO(poId, tenantId, changedBy, reason || 'PO cancelled');
        break;

      case POStatus.RECEIVED:
        // Update pending allocations to shipped, then to received
        await this.updatePendingAllocationsToShipped(poId, tenantId, changedBy);
        await this.updateShippedAllocationsToReceived(poId, tenantId, changedBy);
        break;

      case POStatus.DRAFT:
        // If PO is reverted to draft from approved, clean up allocations
        if (oldStatus === POStatus.APPROVED) {
          await this.cleanupAllocationsOnPOModification(
            poId, 
            tenantId, 
            changedBy, 
            'PO reverted to draft status'
          );
        }
        break;
    }

    // Log the status change handling
    console.log(`Handled PO status change for ${poId}: ${oldStatus} -> ${newStatus}, affected ${poAllocations.length} allocations`);
    
    // Log audit trail for PO status change handling
    // Note: This would typically use a PO audit service, but we're logging allocation-related impacts
    console.log(`PO allocation integration: Status change processed for PO ${poId}`);
  }

  /**
   * Clean up allocations when PO is modified
   * Requirements: 8.2, 8.3
   */
  async cleanupAllocationsOnPOModification(
    poId: string, 
    tenantId: string, 
    modifiedBy: string, 
    reason: string
  ): Promise<AllocationCleanupResult> {
    if (!poId || !tenantId || !modifiedBy) {
      throw new Error('PO ID, tenant ID, and modified by user ID are required');
    }

    // Get all allocations for this PO
    const poAllocations = await this.db
      .select({
        allocation: allocations,
        poItem: poItems
      })
      .from(allocations)
      .innerJoin(poItems, eq(allocations.poItemId, poItems.id))
      .where(and(
        eq(poItems.poId, poId),
        eq(allocations.tenantId, tenantId)
      ));

    let deletedAllocations = 0;
    let cancelledAllocations = 0;
    const affectedLocations = new Set<string>();

    for (const { allocation } of poAllocations) {
      affectedLocations.add(allocation.targetLocationId);

      if (allocation.status === AllocationStatus.PENDING) {
        // Delete pending allocations
        await this.allocationService.deleteAllocation(allocation.id, tenantId, modifiedBy);
        deletedAllocations++;
      } else if (allocation.status === AllocationStatus.SHIPPED) {
        // Cancel shipped allocations
        await this.allocationService.updateAllocationStatus(
          allocation.id, 
          AllocationStatus.CANCELLED, 
          tenantId, 
          modifiedBy
        );
        cancelledAllocations++;
      }
      // Leave received allocations as-is (they're already completed)
    }

    return {
      deletedAllocations,
      cancelledAllocations,
      affectedLocations: Array.from(affectedLocations),
      cleanupReason: reason
    };
  }

  /**
   * Auto-allocate PO items based on strategy
   * Requirements: 8.2, 8.4
   */
  async autoAllocatePO(
    request: AutoAllocationRequest, 
    tenantId: string, 
    createdBy: string
  ): Promise<AutoAllocationResult> {
    const { poId, strategy, parameters } = request;

    // Validate PO for allocation
    const validation = await this.validatePOForAllocation(poId, tenantId);
    if (!validation.valid) {
      return {
        success: false,
        allocationsCreated: 0,
        totalQuantityAllocated: 0,
        unallocatedQuantity: 0,
        errors: validation.errors
      };
    }

    // Get unallocated PO items
    const unallocatedItems = await this.getUnallocatedPOItems(poId, tenantId);
    
    if (unallocatedItems.length === 0) {
      return {
        success: true,
        allocationsCreated: 0,
        totalQuantityAllocated: 0,
        unallocatedQuantity: 0,
        errors: ['No unallocated items found']
      };
    }

    let allocationsCreated = 0;
    let totalQuantityAllocated = 0;
    let remainingUnallocated = 0;
    const errors: string[] = [];

    try {
      switch (strategy) {
        case 'EQUAL_DISTRIBUTION':
          const result = await this.autoAllocateEqualDistribution(
            unallocatedItems, 
            parameters?.locationIds || [], 
            tenantId, 
            createdBy
          );
          allocationsCreated = result.allocationsCreated;
          totalQuantityAllocated = result.totalQuantityAllocated;
          remainingUnallocated = result.unallocatedQuantity;
          errors.push(...result.errors);
          break;

        case 'PERCENTAGE_BASED':
          if (!parameters?.locationPercentages) {
            errors.push('Location percentages are required for percentage-based allocation');
            break;
          }
          const percentResult = await this.autoAllocatePercentageBased(
            unallocatedItems,
            parameters.locationPercentages,
            tenantId,
            createdBy
          );
          allocationsCreated = percentResult.allocationsCreated;
          totalQuantityAllocated = percentResult.totalQuantityAllocated;
          remainingUnallocated = percentResult.unallocatedQuantity;
          errors.push(...percentResult.errors);
          break;

        case 'TEMPLATE_BASED':
          if (!parameters?.templateId) {
            errors.push('Template ID is required for template-based allocation');
            break;
          }
          const templateResult = await this.allocationService.applyAllocationTemplate(
            poId,
            parameters.templateId,
            tenantId,
            createdBy
          );
          allocationsCreated = templateResult.createdAllocations.length;
          totalQuantityAllocated = templateResult.createdAllocations.reduce(
            (sum, alloc) => sum + alloc.quantityAllocated, 0
          );
          // Calculate remaining unallocated after template application
          const updatedUnallocated = await this.getUnallocatedPOItems(poId, tenantId);
          remainingUnallocated = updatedUnallocated.reduce(
            (sum, item) => sum + item.unallocatedQuantity, 0
          );
          if (templateResult.failedAllocations.length > 0) {
            errors.push(...templateResult.failedAllocations.flatMap(f => f.errors));
          }
          break;

        default:
          errors.push(`Unsupported allocation strategy: ${strategy}`);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error during auto-allocation');
    }

    return {
      success: errors.length === 0,
      allocationsCreated,
      totalQuantityAllocated,
      unallocatedQuantity: remainingUnallocated,
      errors
    };
  }

  /**
   * Validate that a PO can be allocated
   * Requirements: 8.1, 8.3
   */
  async validatePOForAllocation(poId: string, tenantId: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check if PO exists
    const [po] = await this.db
      .select()
      .from(purchaseOrders)
      .where(and(
        eq(purchaseOrders.id, poId),
        eq(purchaseOrders.tenantId, tenantId)
      ))
      .limit(1);

    if (!po) {
      errors.push('Purchase order not found');
      return { valid: false, errors };
    }

    // Check if PO is in APPROVED status
    if (po.status !== POStatus.APPROVED) {
      errors.push(`Purchase order must be approved for allocation. Current status: ${po.status}`);
    }

    // Check if PO has line items
    const poLineItems = await this.db
      .select()
      .from(poItems)
      .where(eq(poItems.poId, poId));

    if (poLineItems.length === 0) {
      errors.push('Purchase order has no line items to allocate');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Sync allocation status with PO status
   * Requirements: 8.1, 8.4
   */
  async syncAllocationStatusWithPO(poId: string, tenantId: string): Promise<void> {
    // Get PO status
    const [po] = await this.db
      .select()
      .from(purchaseOrders)
      .where(and(
        eq(purchaseOrders.id, poId),
        eq(purchaseOrders.tenantId, tenantId)
      ))
      .limit(1);

    if (!po) {
      throw new Error('Purchase order not found');
    }

    // Get all allocations for this PO
    const poAllocations = await this.db
      .select({
        allocation: allocations,
        poItem: poItems
      })
      .from(allocations)
      .innerJoin(poItems, eq(allocations.poItemId, poItems.id))
      .where(and(
        eq(poItems.poId, poId),
        eq(allocations.tenantId, tenantId)
      ));

    // Sync status based on PO status
    for (const { allocation } of poAllocations) {
      let targetStatus: AllocationStatusType | null = null;

      switch (po.status) {
        case POStatus.RECEIVED:
          if (allocation.status === AllocationStatus.PENDING) {
            targetStatus = AllocationStatus.SHIPPED;
          } else if (allocation.status === AllocationStatus.SHIPPED) {
            targetStatus = AllocationStatus.RECEIVED;
          }
          break;
        case POStatus.CANCELLED:
          if (allocation.status === AllocationStatus.PENDING || allocation.status === AllocationStatus.SHIPPED) {
            targetStatus = AllocationStatus.CANCELLED;
          }
          break;
      }

      if (targetStatus && targetStatus !== allocation.status) {
        await this.allocationService.updateAllocationStatus(
          allocation.id,
          targetStatus,
          tenantId,
          'system' // System-initiated sync
        );
      }
    }
  }

  /**
   * Get unallocated PO items with quantities
   * Requirements: 3.1, 3.3, 3.4
   */
  async getUnallocatedPOItems(poId: string, tenantId: string): Promise<Array<POItem & { unallocatedQuantity: number }>> {
    // Get all PO items
    const poLineItems = await this.db
      .select()
      .from(poItems)
      .where(eq(poItems.poId, poId));

    const unallocatedItems: Array<POItem & { unallocatedQuantity: number }> = [];

    for (const poItem of poLineItems) {
      // Get total allocated quantity for this item
      const [allocationSum] = await this.db
        .select({
          totalAllocated: sql<number>`COALESCE(SUM(${allocations.quantityAllocated}), 0)`
        })
        .from(allocations)
        .where(and(
          eq(allocations.poItemId, poItem.id),
          eq(allocations.tenantId, tenantId)
        ));

      const totalAllocated = allocationSum?.totalAllocated || 0;
      const unallocatedQuantity = poItem.quantityOrdered - totalAllocated;

      if (unallocatedQuantity > 0) {
        unallocatedItems.push({
          ...poItem,
          unallocatedQuantity
        });
      }
    }

    return unallocatedItems;
  }

  // Private helper methods

  private async cancelAllocationsForPO(poId: string, tenantId: string, cancelledBy: string, _reason: string): Promise<void> {
    const poAllocations = await this.db
      .select({
        allocation: allocations,
        poItem: poItems
      })
      .from(allocations)
      .innerJoin(poItems, eq(allocations.poItemId, poItems.id))
      .where(and(
        eq(poItems.poId, poId),
        eq(allocations.tenantId, tenantId),
        sql`${allocations.status} IN ('PENDING', 'SHIPPED')`
      ));

    for (const { allocation } of poAllocations) {
      await this.allocationService.updateAllocationStatus(
        allocation.id,
        AllocationStatus.CANCELLED,
        tenantId,
        cancelledBy
      );
    }
  }

  private async updatePendingAllocationsToShipped(poId: string, tenantId: string, updatedBy: string): Promise<void> {
    const pendingAllocations = await this.db
      .select({
        allocation: allocations,
        poItem: poItems
      })
      .from(allocations)
      .innerJoin(poItems, eq(allocations.poItemId, poItems.id))
      .where(and(
        eq(poItems.poId, poId),
        eq(allocations.tenantId, tenantId),
        eq(allocations.status, AllocationStatus.PENDING)
      ));

    for (const { allocation } of pendingAllocations) {
      await this.allocationService.updateAllocationStatus(
        allocation.id,
        AllocationStatus.SHIPPED,
        tenantId,
        updatedBy
      );
    }
  }

  private async updateShippedAllocationsToReceived(poId: string, tenantId: string, updatedBy: string): Promise<void> {
    const shippedAllocations = await this.db
      .select({
        allocation: allocations,
        poItem: poItems
      })
      .from(allocations)
      .innerJoin(poItems, eq(allocations.poItemId, poItems.id))
      .where(and(
        eq(poItems.poId, poId),
        eq(allocations.tenantId, tenantId),
        eq(allocations.status, AllocationStatus.SHIPPED)
      ));

    for (const { allocation } of shippedAllocations) {
      await this.allocationService.updateAllocationStatus(
        allocation.id,
        AllocationStatus.RECEIVED,
        tenantId,
        updatedBy
      );
    }
  }

  private async autoAllocateEqualDistribution(
    unallocatedItems: Array<POItem & { unallocatedQuantity: number }>,
    locationIds: string[],
    tenantId: string,
    createdBy: string
  ): Promise<AutoAllocationResult> {
    if (locationIds.length === 0) {
      return {
        success: false,
        allocationsCreated: 0,
        totalQuantityAllocated: 0,
        unallocatedQuantity: 0,
        errors: ['No locations specified for equal distribution']
      };
    }

    let allocationsCreated = 0;
    let totalQuantityAllocated = 0;
    const errors: string[] = [];

    for (const item of unallocatedItems) {
      const quantityPerLocation = Math.floor(item.unallocatedQuantity / locationIds.length);
      
      if (quantityPerLocation > 0) {
        for (const locationId of locationIds) {
          try {
            await this.allocationService.createAllocation({
              poItemId: item.id,
              targetLocationId: locationId,
              quantityAllocated: quantityPerLocation,
              notes: 'Auto-allocated via equal distribution'
            }, tenantId, createdBy);
            
            allocationsCreated++;
            totalQuantityAllocated += quantityPerLocation;
          } catch (error) {
            errors.push(`Failed to allocate ${quantityPerLocation} to location ${locationId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
    }

    // Calculate remaining unallocated
    const updatedUnallocated = await this.getUnallocatedPOItems(
      unallocatedItems[0]?.poId || '', 
      tenantId
    );
    const remainingUnallocated = updatedUnallocated.reduce(
      (sum, item) => sum + item.unallocatedQuantity, 0
    );

    return {
      success: errors.length === 0,
      allocationsCreated,
      totalQuantityAllocated,
      unallocatedQuantity: remainingUnallocated,
      errors
    };
  }

  private async autoAllocatePercentageBased(
    unallocatedItems: Array<POItem & { unallocatedQuantity: number }>,
    locationPercentages: Record<string, number>,
    tenantId: string,
    createdBy: string
  ): Promise<AutoAllocationResult> {
    // Validate percentages sum to 100 or less
    const totalPercentage = Object.values(locationPercentages).reduce((sum, pct) => sum + pct, 0);
    if (totalPercentage > 100) {
      return {
        success: false,
        allocationsCreated: 0,
        totalQuantityAllocated: 0,
        unallocatedQuantity: 0,
        errors: [`Total percentages (${totalPercentage}%) exceed 100%`]
      };
    }

    let allocationsCreated = 0;
    let totalQuantityAllocated = 0;
    const errors: string[] = [];

    for (const item of unallocatedItems) {
      for (const [locationId, percentage] of Object.entries(locationPercentages)) {
        const quantity = Math.floor((item.unallocatedQuantity * percentage) / 100);
        
        if (quantity > 0) {
          try {
            await this.allocationService.createAllocation({
              poItemId: item.id,
              targetLocationId: locationId,
              quantityAllocated: quantity,
              notes: `Auto-allocated via percentage distribution (${percentage}%)`
            }, tenantId, createdBy);
            
            allocationsCreated++;
            totalQuantityAllocated += quantity;
          } catch (error) {
            errors.push(`Failed to allocate ${quantity} (${percentage}%) to location ${locationId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
    }

    // Calculate remaining unallocated
    const updatedUnallocated = await this.getUnallocatedPOItems(
      unallocatedItems[0]?.poId || '', 
      tenantId
    );
    const remainingUnallocated = updatedUnallocated.reduce(
      (sum, item) => sum + item.unallocatedQuantity, 0
    );

    return {
      success: errors.length === 0,
      allocationsCreated,
      totalQuantityAllocated,
      unallocatedQuantity: remainingUnallocated,
      errors
    };
  }
}

// Factory function for creating PO allocation integration service
export function createPOAllocationIntegrationService(db: DrizzleD1Database): POAllocationIntegrationService {
  return new POAllocationIntegrationServiceImpl(db);
}