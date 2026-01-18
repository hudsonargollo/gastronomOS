import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, sql } from 'drizzle-orm';
import { 
  allocations,
  poItems,
  purchaseOrders,
  locations,
  users,
  AllocationStatusType
} from '../db/schema';

// Constraint validation interfaces as defined in the design document
export interface AllocationInput {
  poItemId: string;
  targetLocationId: string;
  quantityAllocated: number;
}

export interface AllocationContext {
  tenantId: string;
  userId: string;
  userRole: string;
  userLocationId?: string;
  excludeAllocationId?: string; // For updates, exclude current allocation from validation
}

export interface AllocationConstraints {
  maxQuantityPerLocation?: number;
  minQuantityPerLocation?: number;
  allowedLocations?: string[];
  requireFullAllocation?: boolean;
  preventOverAllocation: boolean; // Always true
}

export interface ConstraintResult {
  valid: boolean;
  violations: ConstraintViolation[];
  warnings: ConstraintWarning[];
}

export interface ConstraintViolation {
  type: 'QUANTITY_EXCEEDED' | 'LOCATION_ACCESS' | 'STATUS_INVALID' | 'BUSINESS_RULE';
  message: string;
  field?: string;
  currentValue?: any;
  allowedValue?: any;
}

export interface ConstraintWarning {
  type: 'PERFORMANCE' | 'BUSINESS_LOGIC' | 'DATA_QUALITY';
  message: string;
  field?: string;
}

export interface QuantityConstraintResult {
  valid: boolean;
  totalAllocated: number;
  remainingQuantity: number;
  overAllocation?: number;
  violations: ConstraintViolation[];
}

export interface AccessConstraintResult {
  valid: boolean;
  hasAccess: boolean;
  violations: ConstraintViolation[];
}

export interface StatusConstraintResult {
  valid: boolean;
  currentStatus: AllocationStatusType;
  allowedOperations: AllocationOperation[];
  violations: ConstraintViolation[];
}

export type AllocationOperation = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';

export interface ConstraintSolver {
  validateConstraints(allocation: AllocationInput, context: AllocationContext): Promise<ConstraintResult>;
  checkQuantityConstraints(poItemId: string, allocations: AllocationInput[], context: AllocationContext): Promise<QuantityConstraintResult>;
  validateLocationAccess(userId: string, locationId: string, tenantId: string): Promise<AccessConstraintResult>;
  enforceStatusConstraints(allocationId: string, operation: AllocationOperation, tenantId: string): Promise<StatusConstraintResult>;
}

export class ConstraintSolverImpl implements ConstraintSolver {
  constructor(private db: DrizzleD1Database) {}

  /**
   * Validate all constraints for an allocation
   * Requirements: 2.1, 2.2, 2.3, 2.4
   */
  async validateConstraints(allocation: AllocationInput, context: AllocationContext): Promise<ConstraintResult> {
    const violations: ConstraintViolation[] = [];
    const warnings: ConstraintWarning[] = [];

    // 1. Validate quantity constraints
    const quantityResult = await this.checkQuantityConstraints(
      allocation.poItemId, 
      [allocation], 
      context
    );
    violations.push(...quantityResult.violations);

    // 2. Validate location access constraints
    const accessResult = await this.validateLocationAccess(
      context.userId, 
      allocation.targetLocationId, 
      context.tenantId
    );
    violations.push(...accessResult.violations);

    // 3. Validate business rule constraints
    const businessRuleViolations = await this.validateBusinessRules(allocation, context);
    violations.push(...businessRuleViolations);

    // 4. Add performance warnings for large allocations
    if (allocation.quantityAllocated > 10000) {
      warnings.push({
        type: 'PERFORMANCE',
        message: 'Large allocation quantity may impact system performance',
        field: 'quantityAllocated'
      });
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings
    };
  }

  /**
   * Check quantity constraints to prevent over-allocation
   * Requirements: 2.1, 2.2
   */
  async checkQuantityConstraints(
    poItemId: string, 
    newAllocations: AllocationInput[], 
    context: AllocationContext
  ): Promise<QuantityConstraintResult> {
    const violations: ConstraintViolation[] = [];

    // Get PO item details
    const [poItemWithPO] = await this.db
      .select({
        poItem: poItems,
        purchaseOrder: purchaseOrders
      })
      .from(poItems)
      .innerJoin(purchaseOrders, eq(poItems.poId, purchaseOrders.id))
      .where(and(
        eq(poItems.id, poItemId),
        eq(purchaseOrders.tenantId, context.tenantId)
      ))
      .limit(1);

    if (!poItemWithPO) {
      violations.push({
        type: 'BUSINESS_RULE',
        message: 'PO item not found in this organization',
        field: 'poItemId',
        currentValue: poItemId
      });
      return {
        valid: false,
        totalAllocated: 0,
        remainingQuantity: 0,
        violations
      };
    }

    const quantityOrdered = poItemWithPO.poItem.quantityOrdered;

    // Get existing allocations for this PO item
    let existingAllocations: any[] = [];
    
    if (context.excludeAllocationId) {
      existingAllocations = await this.db
        .select()
        .from(allocations)
        .where(and(
          eq(allocations.poItemId, poItemId),
          eq(allocations.tenantId, context.tenantId),
          sql`${allocations.id} != ${context.excludeAllocationId}`
        ));
    } else {
      existingAllocations = await this.db
        .select()
        .from(allocations)
        .where(and(
          eq(allocations.poItemId, poItemId),
          eq(allocations.tenantId, context.tenantId)
        ));
    }

    const existingTotalAllocated = existingAllocations.reduce(
      (sum, alloc) => sum + alloc.quantityAllocated, 
      0
    );

    const newTotalAllocated = newAllocations.reduce(
      (sum, alloc) => sum + alloc.quantityAllocated, 
      0
    );

    const totalAllocated = existingTotalAllocated + newTotalAllocated;

    // Check for over-allocation
    if (totalAllocated > quantityOrdered) {
      const overAllocation = totalAllocated - quantityOrdered;
      violations.push({
        type: 'QUANTITY_EXCEEDED',
        message: `Total allocation (${totalAllocated}) exceeds ordered quantity (${quantityOrdered}) by ${overAllocation}`,
        field: 'quantityAllocated',
        currentValue: totalAllocated,
        allowedValue: quantityOrdered
      });

      return {
        valid: false,
        totalAllocated,
        remainingQuantity: quantityOrdered - totalAllocated,
        overAllocation,
        violations
      };
    }

    // Check for duplicate location allocations in new allocations
    const locationCounts = new Map<string, number>();
    for (const allocation of newAllocations) {
      const count = locationCounts.get(allocation.targetLocationId) || 0;
      locationCounts.set(allocation.targetLocationId, count + 1);
      
      if (count > 0) {
        violations.push({
          type: 'BUSINESS_RULE',
          message: `Duplicate allocation for location ${allocation.targetLocationId}`,
          field: 'targetLocationId',
          currentValue: allocation.targetLocationId
        });
      }
    }

    // Check if locations already have allocations (only for new allocations, not updates)
    if (!context.excludeAllocationId) {
      for (const allocation of newAllocations) {
        const existingLocationAllocation = existingAllocations.find(
          a => a.targetLocationId === allocation.targetLocationId
        );
        if (existingLocationAllocation) {
          violations.push({
            type: 'BUSINESS_RULE',
            message: `Location ${allocation.targetLocationId} already has an allocation`,
            field: 'targetLocationId',
            currentValue: allocation.targetLocationId
          });
        }
      }
    }

    return {
      valid: violations.length === 0,
      totalAllocated,
      remainingQuantity: quantityOrdered - totalAllocated,
      violations
    };
  }

  /**
   * Validate location access constraints
   * Requirements: 2.3, 5.1, 5.2, 5.3, 5.4
   */
  async validateLocationAccess(userId: string, locationId: string, tenantId: string): Promise<AccessConstraintResult> {
    const violations: ConstraintViolation[] = [];

    // Get user details
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);

    if (!user) {
      violations.push({
        type: 'LOCATION_ACCESS',
        message: 'User not found in this organization',
        field: 'userId',
        currentValue: userId
      });
      return {
        valid: false,
        hasAccess: false,
        violations
      };
    }

    // Get location details
    const [location] = await this.db
      .select()
      .from(locations)
      .where(and(
        eq(locations.id, locationId),
        eq(locations.tenantId, tenantId)
      ))
      .limit(1);

    if (!location) {
      violations.push({
        type: 'LOCATION_ACCESS',
        message: 'Location not found in this organization',
        field: 'locationId',
        currentValue: locationId
      });
      return {
        valid: false,
        hasAccess: false,
        violations
      };
    }

    // Check location access based on user role and location assignment
    const hasAccess = this.checkUserLocationAccess(user, location);

    if (!hasAccess) {
      violations.push({
        type: 'LOCATION_ACCESS',
        message: `User does not have access to location ${location.name}`,
        field: 'targetLocationId',
        currentValue: locationId,
        allowedValue: user.locationId || 'user assigned locations'
      });
    }

    return {
      valid: hasAccess,
      hasAccess,
      violations
    };
  }

  /**
   * Enforce status-based constraints for allocation operations
   * Requirements: 2.4, 6.1, 6.4
   */
  async enforceStatusConstraints(allocationId: string, operation: AllocationOperation, tenantId: string): Promise<StatusConstraintResult> {
    const violations: ConstraintViolation[] = [];

    // Get allocation details
    const [allocation] = await this.db
      .select()
      .from(allocations)
      .where(and(
        eq(allocations.id, allocationId),
        eq(allocations.tenantId, tenantId)
      ))
      .limit(1);

    if (!allocation) {
      violations.push({
        type: 'STATUS_INVALID',
        message: 'Allocation not found',
        field: 'allocationId',
        currentValue: allocationId
      });
      return {
        valid: false,
        currentStatus: 'PENDING' as AllocationStatusType,
        allowedOperations: [],
        violations
      };
    }

    const currentStatus = allocation.status as AllocationStatusType;
    const allowedOperations = this.getAllowedOperations(currentStatus);

    // Check if the requested operation is allowed for the current status
    if (!allowedOperations.includes(operation)) {
      violations.push({
        type: 'STATUS_INVALID',
        message: `Operation ${operation} is not allowed for allocation in ${currentStatus} status`,
        field: 'status',
        currentValue: currentStatus,
        allowedValue: allowedOperations.join(', ')
      });
    }

    return {
      valid: violations.length === 0,
      currentStatus,
      allowedOperations,
      violations
    };
  }

  // Private helper methods

  private async validateBusinessRules(allocation: AllocationInput, context: AllocationContext): Promise<ConstraintViolation[]> {
    const violations: ConstraintViolation[] = [];

    // Validate positive quantity
    if (allocation.quantityAllocated <= 0) {
      violations.push({
        type: 'BUSINESS_RULE',
        message: 'Allocation quantity must be positive',
        field: 'quantityAllocated',
        currentValue: allocation.quantityAllocated,
        allowedValue: 'positive number'
      });
    }

    // Validate PO is in approved status
    const [poItemWithPO] = await this.db
      .select({
        poItem: poItems,
        purchaseOrder: purchaseOrders
      })
      .from(poItems)
      .innerJoin(purchaseOrders, eq(poItems.poId, purchaseOrders.id))
      .where(and(
        eq(poItems.id, allocation.poItemId),
        eq(purchaseOrders.tenantId, context.tenantId)
      ))
      .limit(1);

    if (poItemWithPO && poItemWithPO.purchaseOrder.status !== 'APPROVED') {
      violations.push({
        type: 'BUSINESS_RULE',
        message: 'Can only allocate items from approved purchase orders',
        field: 'poItemId',
        currentValue: poItemWithPO.purchaseOrder.status,
        allowedValue: 'APPROVED'
      });
    }

    return violations;
  }

  private checkUserLocationAccess(user: any, location: any): boolean {
    // ADMIN users have access to all locations
    if (user.role === 'ADMIN') {
      return true;
    }

    // MANAGER users have access to all locations (business rule)
    if (user.role === 'MANAGER') {
      return true;
    }

    // STAFF users only have access to their assigned location
    if (user.role === 'STAFF') {
      return user.locationId === location.id;
    }

    // Default deny
    return false;
  }

  private getAllowedOperations(status: AllocationStatusType): AllocationOperation[] {
    switch (status) {
      case 'PENDING':
        return ['UPDATE', 'DELETE', 'STATUS_CHANGE'];
      case 'SHIPPED':
        return ['STATUS_CHANGE']; // Can only change to RECEIVED or CANCELLED
      case 'RECEIVED':
        return []; // Terminal state - no operations allowed
      case 'CANCELLED':
        return []; // Terminal state - no operations allowed
      default:
        return [];
    }
  }
}

// Factory function for creating constraint solver
export function createConstraintSolver(db: DrizzleD1Database): ConstraintSolver {
  return new ConstraintSolverImpl(db);
}