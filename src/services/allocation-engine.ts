/**
 * Allocation Engine Service
 * 
 * Provides mathematical allocation calculations and optimization for the distributed allocation system.
 * Implements requirements 1.4, 3.1, 7.1 for the allocation system.
 */

import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, sum } from 'drizzle-orm';
import { 
  allocations,
  poItems,
  locations,
  AllocationStatus
} from '../db/schema';

// Type definitions for the entities we need
export interface POItem {
  id: string;
  poId: string;
  productId: string;
  quantityOrdered: number;
  unitPriceCents: number;
  lineTotalCents: number;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Location {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  address: string;
  createdAt: number;
}

export interface Allocation {
  id: string;
  tenantId: string;
  poItemId: string;
  targetLocationId: string;
  quantityAllocated: number;
  quantityReceived: number;
  status: string;
  notes: string | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

// Core allocation engine interfaces as defined in the design document
export interface AllocationStrategy {
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'TEMPLATE' | 'MANUAL';
  parameters: Record<string, any>;
}

export interface AllocationPlan {
  allocations: PlannedAllocation[];
  unallocatedQuantity: number;
  feasible: boolean;
  optimizationScore: number;
}

export interface PlannedAllocation {
  poItemId: string;
  targetLocationId: string;
  quantityAllocated: number;
  confidence: number; // 0-1 score indicating allocation confidence
}

export interface MathValidationResult {
  valid: boolean;
  totalAllocated: number;
  remainingQuantity: number;
  overAllocation?: number;
  errors: string[];
}

export interface AllocationInput {
  poItemId: string;
  targetLocationId: string;
  quantityAllocated: number;
}

export interface LocationPercentage {
  locationId: string;
  percentage: number; // 0-100
}

export interface DistributionResult {
  distributions: Array<{
    locationId: string;
    allocatedQuantity: number;
    percentage: number;
  }>;
  totalDistributed: number;
  remainingQuantity: number;
  distributionAccuracy: number; // How close to requested percentages
}

export interface AllocationConstraints {
  maxQuantityPerLocation?: number;
  minQuantityPerLocation?: number;
  allowedLocations?: string[];
  requireFullAllocation?: boolean;
  preventOverAllocation: boolean; // Always true
}

export interface OptimizationResult {
  optimizedAllocations: Allocation[];
  improvementScore: number;
  changes: Array<{
    allocationId: string;
    oldQuantity: number;
    newQuantity: number;
    reason: string;
  }>;
  feasible: boolean;
}

// Allocation engine service interface
export interface IAllocationEngine {
  calculateOptimalAllocation(
    poItems: POItem[], 
    locations: Location[], 
    strategy: AllocationStrategy
  ): Promise<AllocationPlan>;
  
  validateAllocationMath(
    poItemId: string, 
    existingAllocations: Allocation[], 
    newAllocation: AllocationInput
  ): Promise<MathValidationResult>;
  
  distributeByPercentage(
    totalQuantity: number, 
    locationPercentages: LocationPercentage[]
  ): DistributionResult;
  
  optimizeAllocationBalance(
    currentAllocations: Allocation[], 
    constraints: AllocationConstraints
  ): Promise<OptimizationResult>;

  calculateUnallocatedQuantity(poItemId: string, tenantId: string): Promise<number>;
  
  validateDistributionAccuracy(
    requestedDistribution: LocationPercentage[],
    actualDistribution: DistributionResult
  ): number;
}

export class AllocationEngine implements IAllocationEngine {
  constructor(private db: DrizzleD1Database) {}

  /**
   * Calculate optimal allocation plan based on strategy
   * Requirements: 1.4, 3.1, 7.1
   */
  async calculateOptimalAllocation(
    poItems: POItem[], 
    locations: Location[], 
    strategy: AllocationStrategy
  ): Promise<AllocationPlan> {
    if (!poItems.length || !locations.length) {
      return {
        allocations: [],
        unallocatedQuantity: 0,
        feasible: false,
        optimizationScore: 0
      };
    }

    const allocations: PlannedAllocation[] = [];
    let totalUnallocated = 0;
    let totalOptimizationScore = 0;

    for (const poItem of poItems) {
      const itemPlan = await this.calculateItemAllocation(poItem, locations, strategy);
      allocations.push(...itemPlan.allocations);
      totalUnallocated += itemPlan.unallocatedQuantity;
      totalOptimizationScore += itemPlan.optimizationScore;
    }

    const avgOptimizationScore = poItems.length > 0 ? totalOptimizationScore / poItems.length : 0;
    const feasible = this.validatePlanFeasibility(allocations, poItems);

    return {
      allocations,
      unallocatedQuantity: totalUnallocated,
      feasible,
      optimizationScore: avgOptimizationScore
    };
  }

  /**
   * Validate mathematical constraints for allocation
   * Requirements: 1.4, 2.1, 2.2
   */
  async validateAllocationMath(
    poItemId: string, 
    existingAllocations: Allocation[], 
    newAllocation: AllocationInput
  ): Promise<MathValidationResult> {
    const errors: string[] = [];

    // Get PO item details
    const poItemResult = await this.db
      .select()
      .from(poItems)
      .where(eq(poItems.id, poItemId))
      .limit(1);

    if (poItemResult.length === 0) {
      return {
        valid: false,
        totalAllocated: 0,
        remainingQuantity: 0,
        errors: ['PO item not found']
      };
    }

    const poItem = poItemResult[0];
    const orderedQuantity = poItem.quantityOrdered;

    // Calculate current total allocated
    const currentTotalAllocated = existingAllocations
      .filter(alloc => alloc.poItemId === poItemId)
      .reduce((sum, alloc) => sum + alloc.quantityAllocated, 0);

    // Calculate new total with proposed allocation
    const newTotalAllocated = currentTotalAllocated + newAllocation.quantityAllocated;

    // Validate quantity constraints
    if (newAllocation.quantityAllocated <= 0) {
      errors.push('Allocation quantity must be greater than zero');
    }

    if (newTotalAllocated > orderedQuantity) {
      const overAllocation = newTotalAllocated - orderedQuantity;
      errors.push(`Over-allocation detected: ${overAllocation} units exceed ordered quantity`);
      
      return {
        valid: false,
        totalAllocated: newTotalAllocated,
        remainingQuantity: orderedQuantity - newTotalAllocated,
        overAllocation,
        errors
      };
    }

    const remainingQuantity = orderedQuantity - newTotalAllocated;

    return {
      valid: errors.length === 0,
      totalAllocated: newTotalAllocated,
      remainingQuantity,
      errors
    };
  }

  /**
   * Distribute quantity by percentage across locations
   * Requirements: 7.1, 7.2
   */
  distributeByPercentage(
    totalQuantity: number, 
    locationPercentages: LocationPercentage[]
  ): DistributionResult {
    if (totalQuantity <= 0) {
      return {
        distributions: [],
        totalDistributed: 0,
        remainingQuantity: 0,
        distributionAccuracy: 0
      };
    }

    // Validate percentages sum to 100 or less
    const totalPercentage = locationPercentages.reduce((sum, lp) => sum + lp.percentage, 0);
    
    if (totalPercentage > 100) {
      throw new Error(`Total percentage (${totalPercentage}%) exceeds 100%`);
    }

    const distributions = locationPercentages.map(lp => {
      // Calculate allocation quantity, rounding down to avoid over-allocation
      const allocatedQuantity = Math.floor((lp.percentage / 100) * totalQuantity);
      
      return {
        locationId: lp.locationId,
        allocatedQuantity,
        percentage: lp.percentage
      };
    });

    const totalDistributed = distributions.reduce((sum, d) => sum + d.allocatedQuantity, 0);
    const remainingQuantity = totalQuantity - totalDistributed;

    // Calculate distribution accuracy (how close we got to requested percentages)
    const distributionAccuracy = this.calculateDistributionAccuracy(
      locationPercentages,
      distributions,
      totalQuantity
    );

    return {
      distributions,
      totalDistributed,
      remainingQuantity,
      distributionAccuracy
    };
  }

  /**
   * Optimize allocation balance across locations
   * Requirements: 3.1, 7.1
   */
  async optimizeAllocationBalance(
    currentAllocations: Allocation[], 
    constraints: AllocationConstraints
  ): Promise<OptimizationResult> {
    const changes: OptimizationResult['changes'] = [];
    const optimizedAllocations = [...currentAllocations];
    
    // Group allocations by PO item
    const allocationsByItem = new Map<string, Allocation[]>();
    currentAllocations.forEach(alloc => {
      if (!allocationsByItem.has(alloc.poItemId)) {
        allocationsByItem.set(alloc.poItemId, []);
      }
      allocationsByItem.get(alloc.poItemId)!.push(alloc);
    });

    let totalImprovementScore = 0;
    let feasible = true;

    // Optimize each PO item's allocations
    for (const [poItemId, itemAllocations] of allocationsByItem) {
      const itemOptimization = await this.optimizeItemAllocations(
        poItemId, 
        itemAllocations, 
        constraints
      );
      
      if (!itemOptimization.feasible) {
        feasible = false;
      }
      
      totalImprovementScore += itemOptimization.improvementScore;
      changes.push(...itemOptimization.changes);
      
      // Apply optimizations to the result set
      itemOptimization.changes.forEach(change => {
        const allocIndex = optimizedAllocations.findIndex(a => a.id === change.allocationId);
        if (allocIndex >= 0) {
          optimizedAllocations[allocIndex] = {
            ...optimizedAllocations[allocIndex],
            quantityAllocated: change.newQuantity
          };
        }
      });
    }

    const avgImprovementScore = allocationsByItem.size > 0 
      ? totalImprovementScore / allocationsByItem.size 
      : 0;

    return {
      optimizedAllocations,
      improvementScore: avgImprovementScore,
      changes,
      feasible
    };
  }

  /**
   * Calculate unallocated quantity for a PO item
   * Requirements: 3.1, 3.2
   */
  async calculateUnallocatedQuantity(poItemId: string, tenantId: string): Promise<number> {
    // Get PO item details
    const poItemResult = await this.db
      .select()
      .from(poItems)
      .where(eq(poItems.id, poItemId))
      .limit(1);

    if (poItemResult.length === 0) {
      throw new Error('PO item not found');
    }

    const poItem = poItemResult[0];
    const orderedQuantity = poItem.quantityOrdered;

    // Get total allocated quantity
    const allocationsResult = await this.db
      .select({ totalAllocated: sum(allocations.quantityAllocated) })
      .from(allocations)
      .where(and(
        eq(allocations.poItemId, poItemId),
        eq(allocations.tenantId, tenantId)
      ));

    const totalAllocated = allocationsResult[0]?.totalAllocated || 0;
    return Math.max(0, orderedQuantity - totalAllocated);
  }

  /**
   * Validate distribution accuracy against requested percentages
   * Requirements: 7.2, 7.4
   */
  validateDistributionAccuracy(
    requestedDistribution: LocationPercentage[],
    actualDistribution: DistributionResult
  ): number {
    if (requestedDistribution.length === 0 || actualDistribution.distributions.length === 0) {
      return 0;
    }

    let totalAccuracyScore = 0;
    let validComparisons = 0;

    requestedDistribution.forEach(requested => {
      const actual = actualDistribution.distributions.find(d => d.locationId === requested.locationId);
      if (actual && actualDistribution.totalDistributed > 0) {
        const actualPercentage = (actual.allocatedQuantity / actualDistribution.totalDistributed) * 100;
        const accuracyScore = Math.max(0, 100 - Math.abs(requested.percentage - actualPercentage));
        totalAccuracyScore += accuracyScore;
        validComparisons++;
      }
    });

    return validComparisons > 0 ? totalAccuracyScore / validComparisons : 0;
  }

  // Private helper methods

  private async calculateItemAllocation(
    poItem: POItem, 
    locations: Location[], 
    strategy: AllocationStrategy
  ): Promise<AllocationPlan> {
    const allocations: PlannedAllocation[] = [];
    
    switch (strategy.type) {
      case 'PERCENTAGE':
        return this.calculatePercentageAllocation(poItem, locations, strategy.parameters);
      
      case 'FIXED_AMOUNT':
        return this.calculateFixedAmountAllocation(poItem, locations, strategy.parameters);
      
      case 'TEMPLATE':
        return this.calculateTemplateAllocation(poItem, locations, strategy.parameters);
      
      case 'MANUAL':
      default:
        // For manual strategy, return empty plan for user to fill
        return {
          allocations: [],
          unallocatedQuantity: poItem.quantityOrdered,
          feasible: true,
          optimizationScore: 0
        };
    }
  }

  private async calculatePercentageAllocation(
    poItem: POItem, 
    locations: Location[], 
    parameters: Record<string, any>
  ): Promise<AllocationPlan> {
    const locationPercentages = parameters.locationPercentages as Record<string, number> || {};
    
    const percentageDistribution: LocationPercentage[] = locations
      .filter(loc => locationPercentages[loc.id] > 0)
      .map(loc => ({
        locationId: loc.id,
        percentage: locationPercentages[loc.id]
      }));

    const distribution = this.distributeByPercentage(poItem.quantityOrdered, percentageDistribution);
    
    const allocations: PlannedAllocation[] = distribution.distributions.map(d => ({
      poItemId: poItem.id,
      targetLocationId: d.locationId,
      quantityAllocated: d.allocatedQuantity,
      confidence: distribution.distributionAccuracy / 100
    }));

    return {
      allocations,
      unallocatedQuantity: distribution.remainingQuantity,
      feasible: true,
      optimizationScore: distribution.distributionAccuracy
    };
  }

  private async calculateFixedAmountAllocation(
    poItem: POItem, 
    locations: Location[], 
    parameters: Record<string, any>
  ): Promise<AllocationPlan> {
    const locationAmounts = parameters.locationAmounts as Record<string, number> || {};
    const allocations: PlannedAllocation[] = [];
    let totalAllocated = 0;

    for (const location of locations) {
      const amount = locationAmounts[location.id];
      if (amount && amount > 0) {
        allocations.push({
          poItemId: poItem.id,
          targetLocationId: location.id,
          quantityAllocated: amount,
          confidence: 1.0 // Fixed amounts have high confidence
        });
        totalAllocated += amount;
      }
    }

    const unallocatedQuantity = Math.max(0, poItem.quantityOrdered - totalAllocated);
    const feasible = totalAllocated <= poItem.quantityOrdered;
    const optimizationScore = feasible ? 100 : 0;

    return {
      allocations,
      unallocatedQuantity,
      feasible,
      optimizationScore
    };
  }

  private async calculateTemplateAllocation(
    poItem: POItem, 
    locations: Location[], 
    parameters: Record<string, any>
  ): Promise<AllocationPlan> {
    // Template-based allocation would load from allocation_templates table
    // For now, return empty plan as templates aren't implemented yet
    return {
      allocations: [],
      unallocatedQuantity: poItem.quantityOrdered,
      feasible: true,
      optimizationScore: 0
    };
  }

  private validatePlanFeasibility(allocations: PlannedAllocation[], poItems: POItem[]): boolean {
    // Group allocations by PO item and validate constraints
    const allocationsByItem = new Map<string, number>();
    
    allocations.forEach(alloc => {
      const current = allocationsByItem.get(alloc.poItemId) || 0;
      allocationsByItem.set(alloc.poItemId, current + alloc.quantityAllocated);
    });

    // Check that no item is over-allocated
    for (const poItem of poItems) {
      const totalAllocated = allocationsByItem.get(poItem.id) || 0;
      if (totalAllocated > poItem.quantityOrdered) {
        return false;
      }
    }

    return true;
  }

  private calculateDistributionAccuracy(
    requested: LocationPercentage[],
    actual: Array<{ locationId: string; allocatedQuantity: number; percentage: number }>,
    totalQuantity: number
  ): number {
    if (requested.length === 0 || actual.length === 0 || totalQuantity === 0) {
      return 0;
    }

    let totalAccuracy = 0;
    let validComparisons = 0;

    requested.forEach(req => {
      const act = actual.find(a => a.locationId === req.locationId);
      if (act) {
        const actualPercentage = (act.allocatedQuantity / totalQuantity) * 100;
        const accuracy = Math.max(0, 100 - Math.abs(req.percentage - actualPercentage));
        totalAccuracy += accuracy;
        validComparisons++;
      }
    });

    return validComparisons > 0 ? totalAccuracy / validComparisons : 0;
  }

  private async optimizeItemAllocations(
    poItemId: string, 
    itemAllocations: Allocation[], 
    constraints: AllocationConstraints
  ): Promise<{
    improvementScore: number;
    changes: Array<{
      allocationId: string;
      oldQuantity: number;
      newQuantity: number;
      reason: string;
    }>;
    feasible: boolean;
  }> {
    // Simple optimization: ensure allocations respect min/max constraints
    const changes: Array<{
      allocationId: string;
      oldQuantity: number;
      newQuantity: number;
      reason: string;
    }> = [];

    let improvementScore = 100; // Start with perfect score
    let feasible = true;

    for (const allocation of itemAllocations) {
      let newQuantity = allocation.quantityAllocated;
      let changed = false;

      // Apply minimum quantity constraint
      if (constraints.minQuantityPerLocation && newQuantity < constraints.minQuantityPerLocation) {
        newQuantity = constraints.minQuantityPerLocation;
        changed = true;
      }

      // Apply maximum quantity constraint
      if (constraints.maxQuantityPerLocation && newQuantity > constraints.maxQuantityPerLocation) {
        newQuantity = constraints.maxQuantityPerLocation;
        changed = true;
        improvementScore -= 10; // Penalty for constraint violation
      }

      if (changed) {
        changes.push({
          allocationId: allocation.id,
          oldQuantity: allocation.quantityAllocated,
          newQuantity,
          reason: 'Applied quantity constraints'
        });
      }
    }

    return {
      improvementScore: Math.max(0, improvementScore),
      changes,
      feasible
    };
  }
}

/**
 * Factory function to create AllocationEngine instance
 */
export function createAllocationEngine(db: DrizzleD1Database): IAllocationEngine {
  return new AllocationEngine(db);
}