import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, sql } from 'drizzle-orm';
import { 
  allocations,
  allocationAuditLog,
  allocationTemplates,
  poItems,
  purchaseOrders,
  locations,
  users,
  products,
  Allocation,
  NewAllocation,
  AllocationTemplate,
  NewAllocationTemplate,
  NewAllocationAuditLog,
  AllocationStatus,
  AllocationStatusType,
  AllocationAuditAction,
  AllocationAuditActionType,
  POStatus,
  POItem,
  Location,
  Product
} from '../db';
import { generateId, getCurrentTimestamp } from '../utils';
import { createAllocationAuditService, AllocationAuditService } from './allocation-audit';

// Core allocation interfaces as defined in the design document
export interface CreateAllocationRequest {
  poItemId: string;
  targetLocationId: string;
  quantityAllocated: number;
  notes?: string;
}

export interface UpdateAllocationRequest {
  quantityAllocated?: number;
  quantityReceived?: number;
  notes?: string;
}

export interface AllocationFilters {
  status?: AllocationStatusType;
  locationId?: string;
  poId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface AllocationMatrix {
  poId: string;
  lineItems: Array<{
    poItemId: string;
    productName: string;
    quantityOrdered: number;
    allocations: Allocation[];
    totalAllocated: number;
    unallocatedQuantity: number;
  }>;
  totalAllocations: number;
  allocationSummary: LocationAllocationSummary[];
}

export interface LocationAllocationSummary {
  locationId: string;
  locationName: string;
  totalAllocatedItems: number;
  totalAllocatedValue: number;
  allocationCount: number;
}

export interface BulkAllocationRequest {
  poId: string;
  strategy: BulkAllocationStrategy;
  allocations: BulkAllocationInput[];
  validateOnly?: boolean;
}

export interface BulkAllocationStrategy {
  type: 'PERCENTAGE_SPLIT' | 'EQUAL_DISTRIBUTION' | 'TEMPLATE_BASED' | 'CUSTOM';
  parameters: {
    locationPercentages?: Record<string, number>; // locationId -> percentage
    templateId?: string;
    customRules?: AllocationRule[];
  };
}

export interface BulkAllocationInput {
  poItemId: string;
  locationAllocations: Array<{
    locationId: string;
    quantity: number;
  }>;
}

export interface BulkAllocationResult {
  success: boolean;
  createdAllocations: Allocation[];
  failedAllocations: Array<{
    input: BulkAllocationInput;
    errors: string[];
  }>;
  summary: {
    totalProcessed: number;
    successCount: number;
    failureCount: number;
  };
}

export interface AllocationRule {
  locationId: string;
  percentage?: number;
  fixedQuantity?: number;
  priority?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AllocationConstraints {
  maxQuantityPerLocation?: number;
  minQuantityPerLocation?: number;
  allowedLocations?: string[];
  requireFullAllocation?: boolean;
  preventOverAllocation: boolean; // Always true
}

export interface AllocationService {
  createAllocation(request: CreateAllocationRequest, tenantId: string, createdBy: string): Promise<Allocation>;
  updateAllocation(allocationId: string, updates: UpdateAllocationRequest, tenantId: string, updatedBy: string): Promise<Allocation>;
  deleteAllocation(allocationId: string, tenantId: string, deletedBy: string): Promise<void>;
  getAllocationsForPO(poId: string, tenantId: string): Promise<AllocationMatrix>;
  getAllocationsForLocation(locationId: string, tenantId: string, filters?: AllocationFilters): Promise<Allocation[]>;
  getAllocationsByStatus(status: AllocationStatusType, tenantId: string, filters?: AllocationFilters): Promise<Allocation[]>;
  bulkAllocate(request: BulkAllocationRequest, tenantId: string, createdBy: string): Promise<BulkAllocationResult>;
  validateAllocationConstraints(poItemId: string, allocations: CreateAllocationRequest[], tenantId: string): Promise<ValidationResult>;
  updateAllocationStatus(allocationId: string, status: AllocationStatusType, tenantId: string, updatedBy: string): Promise<Allocation>;
  getAllocation(allocationId: string, tenantId: string): Promise<Allocation | null>;
  createAllocationTemplate(name: string, description: string, templateData: any, tenantId: string, createdBy: string): Promise<AllocationTemplate>;
  getAllocationTemplates(tenantId: string): Promise<AllocationTemplate[]>;
  getAllocationTemplate(templateId: string, tenantId: string): Promise<AllocationTemplate | null>;
  applyAllocationTemplate(poId: string, templateId: string, tenantId: string, createdBy: string): Promise<BulkAllocationResult>;
}

export class AllocationServiceImpl implements AllocationService {
  private auditService: AllocationAuditService;

  constructor(private db: DrizzleD1Database) {
    this.auditService = createAllocationAuditService(db);
  }

  /**
   * Create a new allocation for a PO line item
   * Requirements: 1.1, 1.5, 2.1
   */
  async createAllocation(request: CreateAllocationRequest, tenantId: string, createdBy: string): Promise<Allocation> {
    if (!request.poItemId || !request.targetLocationId || !request.quantityAllocated || request.quantityAllocated <= 0) {
      throw new Error('PO item ID, target location ID, and positive quantity are required');
    }

    // Validate PO item exists and belongs to tenant
    const poItemWithPO = await this.validatePOItemAccess(request.poItemId, tenantId);
    
    // Validate location exists and belongs to tenant
    await this.validateLocationAccess(request.targetLocationId, tenantId);
    
    // Validate user exists and belongs to tenant
    await this.validateUserAccess(createdBy, tenantId);

    // Validate PO is in APPROVED status (only approved POs can be allocated)
    if (poItemWithPO.purchaseOrder.status !== POStatus.APPROVED) {
      throw new Error('Can only allocate items from approved purchase orders');
    }

    // Check for existing allocation to same location (unique constraint)
    const existingAllocation = await this.db
      .select()
      .from(allocations)
      .where(and(
        eq(allocations.poItemId, request.poItemId),
        eq(allocations.targetLocationId, request.targetLocationId),
        eq(allocations.tenantId, tenantId)
      ))
      .limit(1);

    if (existingAllocation.length > 0) {
      throw new Error('Allocation already exists for this PO item and location');
    }

    // Validate allocation constraints (over-allocation prevention)
    const validationResult = await this.validateAllocationConstraints(
      request.poItemId, 
      [request], 
      tenantId
    );

    if (!validationResult.valid) {
      throw new Error(`Allocation validation failed: ${validationResult.errors.join(', ')}`);
    }

    // Create the allocation
    const currentTime = getCurrentTimestamp();
    const newAllocation: NewAllocation = {
      id: `alloc_${generateId()}`,
      tenantId,
      poItemId: request.poItemId,
      targetLocationId: request.targetLocationId,
      quantityAllocated: request.quantityAllocated,
      quantityReceived: 0,
      status: AllocationStatus.PENDING,
      notes: request.notes || null,
      createdBy,
      createdAt: currentTime,
      updatedAt: currentTime,
    };

    const [createdAllocation] = await this.db
      .insert(allocations)
      .values(newAllocation)
      .returning();

    if (!createdAllocation) {
      throw new Error('Failed to create allocation');
    }

    // Log allocation creation in audit trail
    await this.auditService.logAllocationAudit({
      tenantId,
      allocationId: createdAllocation.id,
      action: AllocationAuditAction.CREATED,
      oldValues: null,
      newValues: createdAllocation,
      performedBy: createdBy,
      notes: 'Allocation created'
    });

    return createdAllocation;
  }

  /**
   * Update an existing allocation
   * Requirements: 6.1, 6.4
   */
  async updateAllocation(allocationId: string, updates: UpdateAllocationRequest, tenantId: string, updatedBy: string): Promise<Allocation> {
    if (!allocationId) {
      throw new Error('Allocation ID is required');
    }

    // Get existing allocation
    const existingAllocation = await this.getAllocation(allocationId, tenantId);
    if (!existingAllocation) {
      throw new Error('Allocation not found');
    }

    // Validate user access
    await this.validateUserAccess(updatedBy, tenantId);

    // Check if allocation can be modified (only PENDING allocations can be modified for quantity/notes)
    // But quantityReceived can be updated for SHIPPED allocations too
    if (updates.quantityAllocated !== undefined || updates.notes !== undefined) {
      if (existingAllocation.status !== AllocationStatus.PENDING) {
        throw new Error('Can only modify quantity and notes for allocations in PENDING status');
      }
    }

    // quantityReceived can be updated for SHIPPED allocations
    if (updates.quantityReceived !== undefined) {
      if (existingAllocation.status !== AllocationStatus.SHIPPED && existingAllocation.status !== AllocationStatus.PENDING) {
        throw new Error('Can only update quantity received for allocations in PENDING or SHIPPED status');
      }
      
      if (updates.quantityReceived < 0) {
        throw new Error('Quantity received cannot be negative');
      }
      
      if (updates.quantityReceived > existingAllocation.quantityAllocated) {
        throw new Error('Quantity received cannot exceed quantity allocated');
      }
    }

    // If quantity is being updated, validate constraints
    if (updates.quantityAllocated !== undefined) {
      if (updates.quantityAllocated <= 0) {
        throw new Error('Quantity allocated must be positive');
      }

      // Create a mock request for validation
      const mockRequest: CreateAllocationRequest = {
        poItemId: existingAllocation.poItemId,
        targetLocationId: existingAllocation.targetLocationId,
        quantityAllocated: updates.quantityAllocated,
      };

      const validationResult = await this.validateAllocationConstraints(
        existingAllocation.poItemId,
        [mockRequest],
        tenantId,
        allocationId // Exclude current allocation from validation
      );

      if (!validationResult.valid) {
        throw new Error(`Allocation validation failed: ${validationResult.errors.join(', ')}`);
      }
    }

    // Update the allocation
    const currentTime = getCurrentTimestamp();
    const updateData: Partial<NewAllocation> = {
      updatedAt: currentTime,
    };

    if (updates.quantityAllocated !== undefined) {
      updateData.quantityAllocated = updates.quantityAllocated;
    }
    if (updates.quantityReceived !== undefined) {
      updateData.quantityReceived = updates.quantityReceived;
    }
    if (updates.notes !== undefined) {
      updateData.notes = updates.notes;
    }

    const [updatedAllocation] = await this.db
      .update(allocations)
      .set(updateData)
      .where(and(
        eq(allocations.id, allocationId),
        eq(allocations.tenantId, tenantId)
      ))
      .returning();

    if (!updatedAllocation) {
      throw new Error('Failed to update allocation');
    }

    // Log allocation update in audit trail
    await this.auditService.logAllocationAudit({
      tenantId,
      allocationId: updatedAllocation.id,
      action: AllocationAuditAction.UPDATED,
      oldValues: existingAllocation,
      newValues: updatedAllocation,
      performedBy: updatedBy,
      notes: 'Allocation updated'
    });

    return updatedAllocation;
  }

  /**
   * Delete an allocation
   * Requirements: 6.1, 6.4
   */
  async deleteAllocation(allocationId: string, tenantId: string, deletedBy: string): Promise<void> {
    if (!allocationId) {
      throw new Error('Allocation ID is required');
    }

    // Get existing allocation
    const existingAllocation = await this.getAllocation(allocationId, tenantId);
    if (!existingAllocation) {
      throw new Error('Allocation not found');
    }

    // Validate user access
    await this.validateUserAccess(deletedBy, tenantId);

    // Check if allocation can be deleted (only PENDING allocations can be deleted)
    if (existingAllocation.status !== AllocationStatus.PENDING) {
      throw new Error('Can only delete allocations in PENDING status');
    }

    // Delete the allocation
    await this.db
      .delete(allocations)
      .where(and(
        eq(allocations.id, allocationId),
        eq(allocations.tenantId, tenantId)
      ));

    // Log allocation deletion in audit trail
    await this.auditService.logAllocationAudit({
      tenantId,
      allocationId,
      action: AllocationAuditAction.DELETED,
      oldValues: existingAllocation,
      newValues: null,
      performedBy: deletedBy,
      notes: 'Allocation deleted'
    });
  }

  /**
   * Get allocation matrix for a purchase order
   * Requirements: 1.3, 1.4, 3.1, 3.2
   */
  async getAllocationsForPO(poId: string, tenantId: string): Promise<AllocationMatrix> {
    if (!poId) {
      throw new Error('Purchase order ID is required');
    }

    // Validate PO exists and belongs to tenant
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

    // Get PO line items with products and allocations
    const poItemsWithAllocations = await this.db
      .select({
        poItem: poItems,
        product: products,
        allocation: allocations,
        location: locations,
      })
      .from(poItems)
      .leftJoin(products, eq(poItems.productId, products.id))
      .leftJoin(allocations, and(
        eq(allocations.poItemId, poItems.id),
        eq(allocations.tenantId, tenantId)
      ))
      .leftJoin(locations, eq(allocations.targetLocationId, locations.id))
      .where(eq(poItems.poId, poId));

    // Group by PO item
    const itemMap = new Map<string, {
      poItem: POItem;
      product: Product;
      allocations: Array<Allocation & { location?: Location }>;
    }>();

    for (const row of poItemsWithAllocations) {
      const key = row.poItem.id;
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          poItem: row.poItem,
          product: row.product!,
          allocations: []
        });
      }

      if (row.allocation) {
        const allocationWithLocation = {
          ...row.allocation,
          ...(row.location && { location: row.location })
        };
        itemMap.get(key)!.allocations.push(allocationWithLocation);
      }
    }

    // Build allocation matrix
    const lineItems = Array.from(itemMap.values()).map(({ poItem, product, allocations: itemAllocations }) => {
      const totalAllocated = itemAllocations.reduce((sum, alloc) => sum + alloc.quantityAllocated, 0);
      const unallocatedQuantity = poItem.quantityOrdered - totalAllocated;

      return {
        poItemId: poItem.id,
        productName: product.name,
        quantityOrdered: poItem.quantityOrdered,
        allocations: itemAllocations,
        totalAllocated,
        unallocatedQuantity
      };
    });

    // Calculate allocation summary by location
    const locationSummaryMap = new Map<string, LocationAllocationSummary>();
    
    for (const lineItem of lineItems) {
      for (const allocation of lineItem.allocations) {
        const locationId = allocation.targetLocationId;
        const locationName = (allocation as any).location?.name || 'Unknown Location';
        
        if (!locationSummaryMap.has(locationId)) {
          locationSummaryMap.set(locationId, {
            locationId,
            locationName,
            totalAllocatedItems: 0,
            totalAllocatedValue: 0,
            allocationCount: 0
          });
        }

        const summary = locationSummaryMap.get(locationId)!;
        summary.totalAllocatedItems += allocation.quantityAllocated;
        summary.allocationCount += 1;
        
        // Calculate value based on PO item unit price
        const poItem = itemMap.get(allocation.poItemId)?.poItem;
        if (poItem) {
          summary.totalAllocatedValue += allocation.quantityAllocated * poItem.unitPriceCents;
        }
      }
    }

    const totalAllocations = lineItems.reduce((sum, item) => sum + item.totalAllocated, 0);

    return {
      poId,
      lineItems,
      totalAllocations,
      allocationSummary: Array.from(locationSummaryMap.values())
    };
  }

  /**
   * Get allocations for a specific location
   * Requirements: 5.1, 5.4
   */
  async getAllocationsForLocation(locationId: string, tenantId: string, filters?: AllocationFilters): Promise<Allocation[]> {
    if (!locationId) {
      throw new Error('Location ID is required');
    }

    // Validate location access
    await this.validateLocationAccess(locationId, tenantId);

    let query = this.db
      .select()
      .from(allocations)
      .where(and(
        eq(allocations.targetLocationId, locationId),
        eq(allocations.tenantId, tenantId)
      ));

    // Apply filters
    if (filters?.status) {
      const allocationsWithStatus = await this.db
        .select()
        .from(allocations)
        .where(and(
          eq(allocations.targetLocationId, locationId),
          eq(allocations.tenantId, tenantId),
          eq(allocations.status, filters.status)
        ))
        .orderBy(desc(allocations.createdAt))
        .limit(filters?.limit || 100)
        .offset(filters?.offset || 0);

      return allocationsWithStatus;
    }

    if (filters?.poId) {
      // Need to join with poItems to filter by PO
      const allocationsWithPO = await this.db
        .select({ allocation: allocations })
        .from(allocations)
        .innerJoin(poItems, eq(allocations.poItemId, poItems.id))
        .where(and(
          eq(allocations.targetLocationId, locationId),
          eq(allocations.tenantId, tenantId),
          eq(poItems.poId, filters.poId),
          ...(filters.status ? [eq(allocations.status, filters.status)] : [])
        ))
        .orderBy(desc(allocations.createdAt))
        .limit(filters?.limit || 100)
        .offset(filters?.offset || 0);

      return allocationsWithPO.map(row => row.allocation);
    }

    const result = await query
      .orderBy(desc(allocations.createdAt))
      .limit(filters?.limit || 100)
      .offset(filters?.offset || 0);

    return result;
  }

  /**
   * Get allocations by status with optional filtering
   * Requirements: 4.2, 4.3, 4.5
   */
  async getAllocationsByStatus(status: AllocationStatusType, tenantId: string, filters?: AllocationFilters): Promise<Allocation[]> {
    if (!status) {
      throw new Error('Status is required');
    }

    // Validate status is valid
    const validStatuses: AllocationStatusType[] = ['PENDING', 'SHIPPED', 'RECEIVED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Valid statuses are: ${validStatuses.join(', ')}`);
    }

    let baseQuery = this.db
      .select()
      .from(allocations)
      .where(and(
        eq(allocations.tenantId, tenantId),
        eq(allocations.status, status)
      ));

    // Apply additional filters
    if (filters?.locationId) {
      const allocationsWithLocation = await this.db
        .select()
        .from(allocations)
        .where(and(
          eq(allocations.tenantId, tenantId),
          eq(allocations.status, status),
          eq(allocations.targetLocationId, filters.locationId)
        ))
        .orderBy(desc(allocations.createdAt))
        .limit(filters?.limit || 100)
        .offset(filters?.offset || 0);

      return allocationsWithLocation;
    }

    if (filters?.poId) {
      // Need to join with poItems to filter by PO
      const allocationsWithPO = await this.db
        .select({ allocation: allocations })
        .from(allocations)
        .innerJoin(poItems, eq(allocations.poItemId, poItems.id))
        .where(and(
          eq(allocations.tenantId, tenantId),
          eq(allocations.status, status),
          eq(poItems.poId, filters.poId)
        ))
        .orderBy(desc(allocations.createdAt))
        .limit(filters?.limit || 100)
        .offset(filters?.offset || 0);

      return allocationsWithPO.map(row => row.allocation);
    }

    // Apply date filters if provided
    if (filters?.dateFrom || filters?.dateTo) {
      const conditions = [
        eq(allocations.tenantId, tenantId),
        eq(allocations.status, status)
      ];

      if (filters.dateFrom) {
        conditions.push(sql`${allocations.createdAt} >= ${filters.dateFrom.getTime()}`);
      }

      if (filters.dateTo) {
        conditions.push(sql`${allocations.createdAt} <= ${filters.dateTo.getTime()}`);
      }

      const allocationsWithDateFilter = await this.db
        .select()
        .from(allocations)
        .where(and(...conditions))
        .orderBy(desc(allocations.createdAt))
        .limit(filters?.limit || 100)
        .offset(filters?.offset || 0);

      return allocationsWithDateFilter;
    }

    // Default query without additional filters
    const result = await baseQuery
      .orderBy(desc(allocations.createdAt))
      .limit(filters?.limit || 100)
      .offset(filters?.offset || 0);

    return result;
  }

  /**
   * Validate allocation constraints
   * Requirements: 2.1, 2.2
   */
  async validateAllocationConstraints(
    poItemId: string, 
    newAllocations: CreateAllocationRequest[], 
    tenantId: string,
    excludeAllocationId?: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Get PO item details
    const poItemData = await this.validatePOItemAccess(poItemId, tenantId);
    const quantityOrdered = poItemData.poItem.quantityOrdered;

    // Get existing allocations for this PO item
    const existingAllocations = await this.db
      .select()
      .from(allocations)
      .where(and(
        eq(allocations.poItemId, poItemId),
        eq(allocations.tenantId, tenantId),
        ...(excludeAllocationId ? [sql`${allocations.id} != ${excludeAllocationId}`] : [])
      ));

    // Calculate total existing allocated quantity
    const existingTotalAllocated = existingAllocations.reduce(
      (sum, alloc) => sum + alloc.quantityAllocated, 
      0
    );

    // Calculate total new allocated quantity
    const newTotalAllocated = newAllocations.reduce(
      (sum, alloc) => sum + alloc.quantityAllocated, 
      0
    );

    // Check for over-allocation
    const totalAllocated = existingTotalAllocated + newTotalAllocated;
    if (totalAllocated > quantityOrdered) {
      errors.push(
        `Total allocation (${totalAllocated}) exceeds ordered quantity (${quantityOrdered}) by ${totalAllocated - quantityOrdered}`
      );
    }

    // Validate individual allocations
    for (const allocation of newAllocations) {
      if (allocation.quantityAllocated <= 0) {
        errors.push('Allocation quantity must be positive');
      }

      // Check for duplicate location allocations in the new allocations
      const duplicateLocations = newAllocations.filter(
        a => a.targetLocationId === allocation.targetLocationId
      );
      if (duplicateLocations.length > 1) {
        errors.push(`Duplicate allocation for location ${allocation.targetLocationId}`);
      }

      // Check if location already has an allocation
      const existingLocationAllocation = existingAllocations.find(
        a => a.targetLocationId === allocation.targetLocationId
      );
      if (existingLocationAllocation) {
        errors.push(`Location ${allocation.targetLocationId} already has an allocation`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Update allocation status
   * Requirements: 4.1, 4.2, 4.3
   */
  async updateAllocationStatus(allocationId: string, status: AllocationStatusType, tenantId: string, updatedBy: string): Promise<Allocation> {
    if (!allocationId || !status) {
      throw new Error('Allocation ID and status are required');
    }

    // Get existing allocation
    const existingAllocation = await this.getAllocation(allocationId, tenantId);
    if (!existingAllocation) {
      throw new Error('Allocation not found');
    }

    // Validate user access
    await this.validateUserAccess(updatedBy, tenantId);

    // Validate status transition
    this.validateStatusTransition(existingAllocation.status as AllocationStatusType, status);

    // Update the allocation status
    const currentTime = getCurrentTimestamp();
    const [updatedAllocation] = await this.db
      .update(allocations)
      .set({
        status,
        updatedAt: currentTime,
      })
      .where(and(
        eq(allocations.id, allocationId),
        eq(allocations.tenantId, tenantId)
      ))
      .returning();

    if (!updatedAllocation) {
      throw new Error('Failed to update allocation status');
    }

    // Log status change in audit trail
    await this.auditService.logAllocationAudit({
      tenantId,
      allocationId: updatedAllocation.id,
      action: AllocationAuditAction.STATUS_CHANGED,
      oldValues: { status: existingAllocation.status },
      newValues: { status: updatedAllocation.status },
      performedBy: updatedBy,
      notes: `Status changed from ${existingAllocation.status} to ${status}`
    });

    return updatedAllocation;
  }

  /**
   * Get a single allocation
   */
  async getAllocation(allocationId: string, tenantId: string): Promise<Allocation | null> {
    if (!allocationId) {
      throw new Error('Allocation ID is required');
    }

    const [allocation] = await this.db
      .select()
      .from(allocations)
      .where(and(
        eq(allocations.id, allocationId),
        eq(allocations.tenantId, tenantId)
      ))
      .limit(1);

    return allocation || null;
  }

  /**
   * Bulk allocation operations
   * Requirements: 7.1, 7.3, 7.5
   */
  async bulkAllocate(request: BulkAllocationRequest, tenantId: string, createdBy: string): Promise<BulkAllocationResult> {
    if (!request.poId || !request.strategy || !request.allocations || request.allocations.length === 0) {
      throw new Error('PO ID, strategy, and allocations are required');
    }

    // Validate user access
    await this.validateUserAccess(createdBy, tenantId);

    // Validate PO exists and is approved
    const [po] = await this.db
      .select()
      .from(purchaseOrders)
      .where(and(
        eq(purchaseOrders.id, request.poId),
        eq(purchaseOrders.tenantId, tenantId)
      ))
      .limit(1);

    if (!po) {
      throw new Error('Purchase order not found');
    }

    if (po.status !== POStatus.APPROVED) {
      throw new Error('Can only allocate items from approved purchase orders');
    }

    const createdAllocations: Allocation[] = [];
    const failedAllocations: Array<{
      input: BulkAllocationInput;
      errors: string[];
    }> = [];

    // If validateOnly is true, just validate without creating
    if (request.validateOnly) {
      for (const allocationInput of request.allocations) {
        const errors = await this.validateBulkAllocationInput(allocationInput, tenantId);
        if (errors.length > 0) {
          failedAllocations.push({
            input: allocationInput,
            errors
          });
        }
      }

      return {
        success: failedAllocations.length === 0,
        createdAllocations: [],
        failedAllocations,
        summary: {
          totalProcessed: request.allocations.length,
          successCount: request.allocations.length - failedAllocations.length,
          failureCount: failedAllocations.length
        }
      };
    }

    // Process each allocation input
    for (const allocationInput of request.allocations) {
      try {
        // Validate the allocation input
        const errors = await this.validateBulkAllocationInput(allocationInput, tenantId);
        if (errors.length > 0) {
          failedAllocations.push({
            input: allocationInput,
            errors
          });
          continue;
        }

        // Create allocations for each location
        for (const locationAllocation of allocationInput.locationAllocations) {
          try {
            const createRequest: CreateAllocationRequest = {
              poItemId: allocationInput.poItemId,
              targetLocationId: locationAllocation.locationId,
              quantityAllocated: locationAllocation.quantity,
              notes: `Bulk allocation via ${request.strategy.type} strategy`
            };

            const allocation = await this.createAllocation(createRequest, tenantId, createdBy);
            createdAllocations.push(allocation);
          } catch (error) {
            failedAllocations.push({
              input: allocationInput,
              errors: [error instanceof Error ? error.message : 'Unknown error creating allocation']
            });
          }
        }
      } catch (error) {
        failedAllocations.push({
          input: allocationInput,
          errors: [error instanceof Error ? error.message : 'Unknown error processing allocation input']
        });
      }
    }

    return {
      success: failedAllocations.length === 0,
      createdAllocations,
      failedAllocations,
      summary: {
        totalProcessed: request.allocations.length,
        successCount: createdAllocations.length,
        failureCount: failedAllocations.length
      }
    };
  }

  /**
   * Create allocation template
   * Requirements: 7.2
   */
  async createAllocationTemplate(
    name: string,
    description: string,
    templateData: any,
    tenantId: string,
    createdBy: string
  ): Promise<AllocationTemplate> {
    if (!name || !templateData) {
      throw new Error('Template name and data are required');
    }

    // Validate user access
    await this.validateUserAccess(createdBy, tenantId);

    // Check for existing template with same name
    const [existingTemplate] = await this.db
      .select()
      .from(allocationTemplates)
      .where(and(
        eq(allocationTemplates.tenantId, tenantId),
        eq(allocationTemplates.name, name)
      ))
      .limit(1);

    if (existingTemplate) {
      throw new Error('Template with this name already exists');
    }

    const currentTime = getCurrentTimestamp();
    const newTemplate: NewAllocationTemplate = {
      id: `template_${generateId()}`,
      tenantId,
      name,
      description: description || null,
      templateData,
      createdBy,
      createdAt: currentTime,
      updatedAt: currentTime,
    };

    const [createdTemplate] = await this.db
      .insert(allocationTemplates)
      .values(newTemplate)
      .returning();

    if (!createdTemplate) {
      throw new Error('Failed to create allocation template');
    }

    return createdTemplate;
  }

  /**
   * Get allocation templates for tenant
   * Requirements: 7.2
   */
  async getAllocationTemplates(tenantId: string): Promise<AllocationTemplate[]> {
    const templates = await this.db
      .select()
      .from(allocationTemplates)
      .where(eq(allocationTemplates.tenantId, tenantId))
      .orderBy(desc(allocationTemplates.createdAt));

    return templates;
  }

  /**
   * Get allocation template by ID
   * Requirements: 7.2
   */
  async getAllocationTemplate(templateId: string, tenantId: string): Promise<AllocationTemplate | null> {
    const [template] = await this.db
      .select()
      .from(allocationTemplates)
      .where(and(
        eq(allocationTemplates.id, templateId),
        eq(allocationTemplates.tenantId, tenantId)
      ))
      .limit(1);

    return template || null;
  }

  /**
   * Apply allocation template to PO
   * Requirements: 7.2, 7.4
   */
  async applyAllocationTemplate(
    poId: string,
    templateId: string,
    tenantId: string,
    createdBy: string
  ): Promise<BulkAllocationResult> {
    // Get the template
    const template = await this.getAllocationTemplate(templateId, tenantId);
    if (!template) {
      throw new Error('Allocation template not found');
    }

    // Get PO items
    const poItemsData = await this.db
      .select()
      .from(poItems)
      .innerJoin(purchaseOrders, eq(poItems.poId, purchaseOrders.id))
      .where(and(
        eq(poItems.poId, poId),
        eq(purchaseOrders.tenantId, tenantId)
      ));

    if (poItemsData.length === 0) {
      throw new Error('No PO items found for this purchase order');
    }

    // Parse template data and create bulk allocation request
    const templateRules = template.templateData as {
      locationPercentages?: Record<string, number>;
      locationFixedAmounts?: Record<string, number>;
      rules?: AllocationRule[];
    };

    const bulkAllocations: BulkAllocationInput[] = [];

    // Apply template rules to each PO item
    for (const { po_items: poItem } of poItemsData) {
      const locationAllocations: Array<{ locationId: string; quantity: number }> = [];

      if (templateRules.locationPercentages) {
        // Apply percentage-based allocation
        for (const [locationId, percentage] of Object.entries(templateRules.locationPercentages)) {
          const quantity = Math.floor((poItem.quantityOrdered * percentage) / 100);
          if (quantity > 0) {
            locationAllocations.push({ locationId, quantity });
          }
        }
      } else if (templateRules.locationFixedAmounts) {
        // Apply fixed amount allocation
        for (const [locationId, fixedAmount] of Object.entries(templateRules.locationFixedAmounts)) {
          const quantity = Math.min(fixedAmount, poItem.quantityOrdered);
          if (quantity > 0) {
            locationAllocations.push({ locationId, quantity });
          }
        }
      } else if (templateRules.rules) {
        // Apply custom rules
        for (const rule of templateRules.rules) {
          let quantity = 0;
          if (rule.percentage) {
            quantity = Math.floor((poItem.quantityOrdered * rule.percentage) / 100);
          } else if (rule.fixedQuantity) {
            quantity = Math.min(rule.fixedQuantity, poItem.quantityOrdered);
          }
          
          if (quantity > 0) {
            locationAllocations.push({ locationId: rule.locationId, quantity });
          }
        }
      }

      if (locationAllocations.length > 0) {
        bulkAllocations.push({
          poItemId: poItem.id,
          locationAllocations
        });
      }
    }

    // Create bulk allocation request
    const bulkRequest: BulkAllocationRequest = {
      poId,
      strategy: {
        type: 'TEMPLATE_BASED',
        parameters: {
          templateId
        }
      },
      allocations: bulkAllocations
    };

    return this.bulkAllocate(bulkRequest, tenantId, createdBy);
  }

  // Private helper methods

  private async validateBulkAllocationInput(input: BulkAllocationInput, tenantId: string): Promise<string[]> {
    const errors: string[] = [];

    if (!input.poItemId) {
      errors.push('PO item ID is required');
      return errors;
    }

    if (!input.locationAllocations || input.locationAllocations.length === 0) {
      errors.push('At least one location allocation is required');
      return errors;
    }

    // Validate PO item exists
    try {
      await this.validatePOItemAccess(input.poItemId, tenantId);
    } catch (error) {
      errors.push(`Invalid PO item: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return errors;
    }

    // Validate each location allocation
    for (const locationAllocation of input.locationAllocations) {
      if (!locationAllocation.locationId) {
        errors.push('Location ID is required for all allocations');
        continue;
      }

      if (!locationAllocation.quantity || locationAllocation.quantity <= 0) {
        errors.push(`Quantity must be positive for location ${locationAllocation.locationId}`);
        continue;
      }

      // Validate location exists
      try {
        await this.validateLocationAccess(locationAllocation.locationId, tenantId);
      } catch (error) {
        errors.push(`Invalid location ${locationAllocation.locationId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Validate allocation constraints for this PO item
    if (errors.length === 0) {
      const createRequests: CreateAllocationRequest[] = input.locationAllocations.map(loc => ({
        poItemId: input.poItemId,
        targetLocationId: loc.locationId,
        quantityAllocated: loc.quantity
      }));

      const validationResult = await this.validateAllocationConstraints(
        input.poItemId,
        createRequests,
        tenantId
      );

      if (!validationResult.valid) {
        errors.push(...validationResult.errors);
      }
    }

    return errors;
  }

  private async validatePOItemAccess(poItemId: string, tenantId: string) {
    const [poItemWithPO] = await this.db
      .select({
        poItem: poItems,
        purchaseOrder: purchaseOrders
      })
      .from(poItems)
      .innerJoin(purchaseOrders, eq(poItems.poId, purchaseOrders.id))
      .where(and(
        eq(poItems.id, poItemId),
        eq(purchaseOrders.tenantId, tenantId)
      ))
      .limit(1);

    if (!poItemWithPO) {
      throw new Error('PO item not found in this organization');
    }

    return poItemWithPO;
  }

  private async validateLocationAccess(locationId: string, tenantId: string) {
    const [location] = await this.db
      .select()
      .from(locations)
      .where(and(
        eq(locations.id, locationId),
        eq(locations.tenantId, tenantId)
      ))
      .limit(1);

    if (!location) {
      throw new Error('Location not found in this organization');
    }

    return location;
  }

  private async validateUserAccess(userId: string, tenantId: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);

    if (!user) {
      throw new Error('User not found in this organization');
    }

    return user;
  }

  private validateStatusTransition(currentStatus: AllocationStatusType, newStatus: AllocationStatusType) {
    const validTransitions: Record<AllocationStatusType, AllocationStatusType[]> = {
      [AllocationStatus.PENDING]: [AllocationStatus.SHIPPED, AllocationStatus.CANCELLED],
      [AllocationStatus.SHIPPED]: [AllocationStatus.RECEIVED, AllocationStatus.CANCELLED],
      [AllocationStatus.RECEIVED]: [], // Terminal state
      [AllocationStatus.CANCELLED]: [], // Terminal state
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }
}

// Factory function for creating allocation service
export function createAllocationService(db: DrizzleD1Database): AllocationService {
  return new AllocationServiceImpl(db);
}