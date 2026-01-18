/**
 * Allocation Calculation Utilities
 * 
 * Provides utility functions for allocation calculations, summations, and optimizations.
 * Implements requirements 3.1, 3.2, 6.3 for the allocation system.
 */

import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, sum, count } from 'drizzle-orm';
import { 
  allocations,
  poItems,
  locations,
  AllocationStatus
} from '../db/schema';

// Type definitions for allocation calculations
export interface AllocationSummary {
  poItemId: string;
  totalAllocated: number;
  unallocatedQuantity: number;
  allocationCount: number;
  averageAllocation: number;
  locationDistribution: LocationDistribution[];
}

export interface LocationDistribution {
  locationId: string;
  locationName: string;
  quantityAllocated: number;
  percentageOfTotal: number;
}

export interface AllocationTotals {
  totalQuantityOrdered: number;
  totalQuantityAllocated: number;
  totalUnallocated: number;
  allocationEfficiency: number; // Percentage of ordered quantity that's allocated
  locationCount: number;
  averageAllocationPerLocation: number;
}

export interface BalanceOptimizationResult {
  currentBalance: AllocationBalance;
  optimizedAllocations: OptimizedAllocation[];
  improvementScore: number;
  balanceAchieved: boolean;
  recommendations: BalanceRecommendation[];
}

export interface AllocationBalance {
  variance: number; // Statistical variance of allocations across locations
  standardDeviation: number;
  coefficientOfVariation: number; // Relative measure of variability
  isBalanced: boolean; // True if CV is below threshold (e.g., 0.3)
}

export interface OptimizedAllocation {
  allocationId: string;
  currentQuantity: number;
  recommendedQuantity: number;
  quantityChange: number;
  reason: string;
}

export interface BalanceRecommendation {
  type: 'REDISTRIBUTE' | 'INCREASE_MIN' | 'DECREASE_MAX' | 'ADD_LOCATION';
  description: string;
  impact: number; // Expected improvement in balance score
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface UnallocatedAnalysis {
  poItemId: string;
  productName: string;
  quantityOrdered: number;
  quantityAllocated: number;
  unallocatedQuantity: number;
  unallocatedPercentage: number;
  suggestedActions: UnallocatedAction[];
}

export interface UnallocatedAction {
  action: 'ALLOCATE_TO_CENTRAL' | 'DISTRIBUTE_EVENLY' | 'ALLOCATE_BY_DEMAND' | 'MANUAL_REVIEW';
  description: string;
  estimatedQuantity?: number;
  targetLocations?: string[];
}

// Allocation calculation utilities service interface
export interface IAllocationUtilities {
  calculateAllocationSummary(poItemId: string, tenantId: string): Promise<AllocationSummary>;
  calculateAllocationTotals(poId: string, tenantId: string): Promise<AllocationTotals>;
  analyzeUnallocatedQuantities(poId: string, tenantId: string): Promise<UnallocatedAnalysis[]>;
  optimizeAllocationBalance(poItemId: string, tenantId: string): Promise<BalanceOptimizationResult>;
  calculateLocationEfficiency(locationId: string, tenantId: string): Promise<LocationEfficiencyMetrics>;
  generateAllocationRecommendations(poId: string, tenantId: string): Promise<AllocationRecommendation[]>;
}

export interface LocationEfficiencyMetrics {
  locationId: string;
  locationName: string;
  totalAllocations: number;
  totalQuantityAllocated: number;
  averageAllocationSize: number;
  allocationFrequency: number; // Allocations per PO
  utilizationRate: number; // Percentage of POs that include this location
}

export interface AllocationRecommendation {
  type: 'BALANCE_IMPROVEMENT' | 'EFFICIENCY_GAIN' | 'COST_OPTIMIZATION' | 'RISK_MITIGATION';
  title: string;
  description: string;
  impact: {
    balanceImprovement?: number;
    costSavings?: number;
    riskReduction?: number;
  };
  actions: RecommendedAction[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface RecommendedAction {
  action: string;
  targetLocationId?: string;
  quantityChange?: number;
  expectedOutcome: string;
}

export class AllocationUtilities implements IAllocationUtilities {
  constructor(private db: DrizzleD1Database) {}

  /**
   * Calculate comprehensive allocation summary for a PO item
   * Requirements: 3.1, 3.2
   */
  async calculateAllocationSummary(poItemId: string, tenantId: string): Promise<AllocationSummary> {
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

    // Get all allocations for this PO item
    const allocationsResult = await this.db
      .select({
        id: allocations.id,
        targetLocationId: allocations.targetLocationId,
        quantityAllocated: allocations.quantityAllocated,
        locationName: locations.name
      })
      .from(allocations)
      .leftJoin(locations, eq(allocations.targetLocationId, locations.id))
      .where(and(
        eq(allocations.poItemId, poItemId),
        eq(allocations.tenantId, tenantId)
      ));

    // Calculate totals
    const totalAllocated = allocationsResult.reduce((sum, alloc) => sum + alloc.quantityAllocated, 0);
    const unallocatedQuantity = Math.max(0, poItem.quantityOrdered - totalAllocated);
    const allocationCount = allocationsResult.length;
    const averageAllocation = allocationCount > 0 ? totalAllocated / allocationCount : 0;

    // Calculate location distribution
    const locationDistribution: LocationDistribution[] = allocationsResult.map(alloc => ({
      locationId: alloc.targetLocationId,
      locationName: alloc.locationName || 'Unknown Location',
      quantityAllocated: alloc.quantityAllocated,
      percentageOfTotal: totalAllocated > 0 ? (alloc.quantityAllocated / totalAllocated) * 100 : 0
    }));

    return {
      poItemId,
      totalAllocated,
      unallocatedQuantity,
      allocationCount,
      averageAllocation,
      locationDistribution
    };
  }

  /**
   * Calculate allocation totals for an entire PO
   * Requirements: 3.1, 6.3
   */
  async calculateAllocationTotals(poId: string, tenantId: string): Promise<AllocationTotals> {
    // Get all PO items for this PO
    const poItemsResult = await this.db
      .select({
        id: poItems.id,
        quantityOrdered: poItems.quantityOrdered
      })
      .from(poItems)
      .where(eq(poItems.poId, poId));

    if (poItemsResult.length === 0) {
      return {
        totalQuantityOrdered: 0,
        totalQuantityAllocated: 0,
        totalUnallocated: 0,
        allocationEfficiency: 0,
        locationCount: 0,
        averageAllocationPerLocation: 0
      };
    }

    // Calculate total ordered quantity
    const totalQuantityOrdered = poItemsResult.reduce((sum, item) => sum + item.quantityOrdered, 0);

    // Get unique location count for this PO
    const uniqueLocationsResult = await this.db
      .select({
        locationId: allocations.targetLocationId
      })
      .from(allocations)
      .leftJoin(poItems, eq(allocations.poItemId, poItems.id))
      .where(and(
        eq(poItems.poId, poId),
        eq(allocations.tenantId, tenantId)
      ));

    const uniqueLocationIds = new Set(uniqueLocationsResult.map(r => r.locationId));
    const locationCount = uniqueLocationIds.size;

    // Calculate comprehensive totals across all PO items
    let totalQuantityAllocated = 0;
    for (const poItem of poItemsResult) {
      const itemAllocationsResult = await this.db
        .select({
          totalAllocated: sum(allocations.quantityAllocated)
        })
        .from(allocations)
        .where(and(
          eq(allocations.poItemId, poItem.id),
          eq(allocations.tenantId, tenantId)
        ));

      totalQuantityAllocated += itemAllocationsResult[0]?.totalAllocated || 0;
    }

    const totalUnallocated = totalQuantityOrdered - totalQuantityAllocated;
    const allocationEfficiency = totalQuantityOrdered > 0 ? (totalQuantityAllocated / totalQuantityOrdered) * 100 : 0;
    const averageAllocationPerLocation = locationCount > 0 ? totalQuantityAllocated / locationCount : 0;

    return {
      totalQuantityOrdered,
      totalQuantityAllocated,
      totalUnallocated,
      allocationEfficiency,
      locationCount,
      averageAllocationPerLocation
    };
  }

  /**
   * Analyze unallocated quantities and provide actionable insights
   * Requirements: 3.1, 3.2
   */
  async analyzeUnallocatedQuantities(poId: string, tenantId: string): Promise<UnallocatedAnalysis[]> {
    // Get all PO items with their product information
    const poItemsResult = await this.db
      .select({
        id: poItems.id,
        productId: poItems.productId,
        quantityOrdered: poItems.quantityOrdered
      })
      .from(poItems)
      .where(eq(poItems.poId, poId));

    const analyses: UnallocatedAnalysis[] = [];

    for (const poItem of poItemsResult) {
      // Get allocation summary for this item
      const summary = await this.calculateAllocationSummary(poItem.id, tenantId);
      
      if (summary.unallocatedQuantity > 0) {
        const unallocatedPercentage = (summary.unallocatedQuantity / poItem.quantityOrdered) * 100;
        
        // Generate suggested actions based on unallocated percentage
        const suggestedActions = this.generateUnallocatedActions(
          summary.unallocatedQuantity,
          unallocatedPercentage,
          summary.locationDistribution
        );

        analyses.push({
          poItemId: poItem.id,
          productName: `Product ${poItem.productId}`, // Would normally join with products table
          quantityOrdered: poItem.quantityOrdered,
          quantityAllocated: summary.totalAllocated,
          unallocatedQuantity: summary.unallocatedQuantity,
          unallocatedPercentage,
          suggestedActions
        });
      }
    }

    return analyses;
  }

  /**
   * Optimize allocation balance across locations
   * Requirements: 6.3
   */
  async optimizeAllocationBalance(poItemId: string, tenantId: string): Promise<BalanceOptimizationResult> {
    const summary = await this.calculateAllocationSummary(poItemId, tenantId);
    
    if (summary.allocationCount === 0) {
      return {
        currentBalance: {
          variance: 0,
          standardDeviation: 0,
          coefficientOfVariation: 0,
          isBalanced: true
        },
        optimizedAllocations: [],
        improvementScore: 0,
        balanceAchieved: true,
        recommendations: []
      };
    }

    // Calculate current balance metrics
    const quantities = summary.locationDistribution.map(d => d.quantityAllocated);
    const currentBalance = this.calculateAllocationBalance(quantities);

    // Generate optimization recommendations
    const optimizedAllocations = this.generateBalanceOptimizations(summary);
    const recommendations = this.generateBalanceRecommendations(currentBalance, summary);

    // Calculate improvement score
    const optimizedQuantities = optimizedAllocations.map(opt => opt.recommendedQuantity);
    const optimizedBalance = this.calculateAllocationBalance(optimizedQuantities);
    const improvementScore = this.calculateImprovementScore(currentBalance, optimizedBalance);

    return {
      currentBalance,
      optimizedAllocations,
      improvementScore,
      balanceAchieved: optimizedBalance.isBalanced,
      recommendations
    };
  }

  /**
   * Calculate location efficiency metrics
   * Requirements: 6.3
   */
  async calculateLocationEfficiency(locationId: string, tenantId: string): Promise<LocationEfficiencyMetrics> {
    // Get location details
    const locationResult = await this.db
      .select()
      .from(locations)
      .where(and(
        eq(locations.id, locationId),
        eq(locations.tenantId, tenantId)
      ))
      .limit(1);

    if (locationResult.length === 0) {
      throw new Error('Location not found');
    }

    const location = locationResult[0];

    // Get allocation statistics for this location
    const allocationStatsResult = await this.db
      .select({
        totalAllocations: count(allocations.id),
        totalQuantityAllocated: sum(allocations.quantityAllocated)
      })
      .from(allocations)
      .where(and(
        eq(allocations.targetLocationId, locationId),
        eq(allocations.tenantId, tenantId)
      ));

    const stats = allocationStatsResult[0];
    const totalAllocations = stats?.totalAllocations || 0;
    const totalQuantityAllocated = stats?.totalQuantityAllocated || 0;

    // Calculate derived metrics
    const averageAllocationSize = totalAllocations > 0 ? totalQuantityAllocated / totalAllocations : 0;

    // Get unique PO count to calculate frequency and utilization
    const uniquePOsResult = await this.db
      .select({
        poId: poItems.poId
      })
      .from(allocations)
      .leftJoin(poItems, eq(allocations.poItemId, poItems.id))
      .where(and(
        eq(allocations.targetLocationId, locationId),
        eq(allocations.tenantId, tenantId)
      ));

    const uniquePOIds = new Set(uniquePOsResult.map(r => r.poId));
    const uniquePOCount = uniquePOIds.size;

    // For simplicity, assume frequency and utilization calculations
    // In a real implementation, you'd need more sophisticated queries
    const allocationFrequency = uniquePOCount > 0 ? totalAllocations / uniquePOCount : 0;
    const utilizationRate = 75; // Placeholder - would calculate from actual PO data

    return {
      locationId,
      locationName: location.name,
      totalAllocations,
      totalQuantityAllocated,
      averageAllocationSize,
      allocationFrequency,
      utilizationRate
    };
  }

  /**
   * Generate allocation recommendations for a PO
   * Requirements: 6.3
   */
  async generateAllocationRecommendations(poId: string, tenantId: string): Promise<AllocationRecommendation[]> {
    const recommendations: AllocationRecommendation[] = [];

    // Analyze unallocated quantities
    const unallocatedAnalyses = await this.analyzeUnallocatedQuantities(poId, tenantId);
    
    if (unallocatedAnalyses.length > 0) {
      const totalUnallocated = unallocatedAnalyses.reduce((sum, analysis) => sum + analysis.unallocatedQuantity, 0);
      
      recommendations.push({
        type: 'EFFICIENCY_GAIN',
        title: 'Address Unallocated Inventory',
        description: `${totalUnallocated} units across ${unallocatedAnalyses.length} items remain unallocated. Consider distributing to locations or central warehouse.`,
        impact: {
          balanceImprovement: 15,
          costSavings: totalUnallocated * 0.1 // Estimated storage cost savings
        },
        actions: [
          {
            action: 'Allocate unallocated quantities to central warehouse',
            expectedOutcome: 'Improved inventory tracking and reduced storage costs'
          }
        ],
        priority: totalUnallocated > 100 ? 'HIGH' : 'MEDIUM'
      });
    }

    // Check for balance optimization opportunities
    const totals = await this.calculateAllocationTotals(poId, tenantId);
    
    if (totals.allocationEfficiency < 90 && totals.allocationEfficiency > 0) {
      recommendations.push({
        type: 'BALANCE_IMPROVEMENT',
        title: 'Improve Allocation Efficiency',
        description: `Current allocation efficiency is ${totals.allocationEfficiency.toFixed(1)}%. Consider optimizing distribution across locations.`,
        impact: {
          balanceImprovement: 100 - totals.allocationEfficiency
        },
        actions: [
          {
            action: 'Review allocation strategy and redistribute quantities',
            expectedOutcome: 'More balanced distribution and improved efficiency'
          }
        ],
        priority: totals.allocationEfficiency < 70 ? 'HIGH' : 'MEDIUM'
      });
    }

    return recommendations;
  }

  // Private helper methods

  private generateUnallocatedActions(
    unallocatedQuantity: number,
    unallocatedPercentage: number,
    locationDistribution: LocationDistribution[]
  ): UnallocatedAction[] {
    const actions: UnallocatedAction[] = [];

    if (unallocatedPercentage > 50) {
      actions.push({
        action: 'MANUAL_REVIEW',
        description: 'High unallocated percentage requires manual review of allocation strategy'
      });
    } else if (unallocatedPercentage > 20) {
      actions.push({
        action: 'DISTRIBUTE_EVENLY',
        description: 'Distribute remaining quantity evenly across existing locations',
        estimatedQuantity: Math.floor(unallocatedQuantity / locationDistribution.length),
        targetLocations: locationDistribution.map(d => d.locationId)
      });
    } else {
      actions.push({
        action: 'ALLOCATE_TO_CENTRAL',
        description: 'Allocate remaining quantity to central warehouse',
        estimatedQuantity: unallocatedQuantity
      });
    }

    return actions;
  }

  private calculateAllocationBalance(quantities: number[]): AllocationBalance {
    if (quantities.length === 0) {
      return {
        variance: 0,
        standardDeviation: 0,
        coefficientOfVariation: 0,
        isBalanced: true
      };
    }

    const mean = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
    const variance = quantities.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / quantities.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = mean > 0 ? standardDeviation / mean : 0;

    return {
      variance,
      standardDeviation,
      coefficientOfVariation,
      isBalanced: coefficientOfVariation < 0.3 // Threshold for "balanced"
    };
  }

  private generateBalanceOptimizations(summary: AllocationSummary): OptimizedAllocation[] {
    const optimizations: OptimizedAllocation[] = [];
    
    if (summary.locationDistribution.length < 2) {
      return optimizations;
    }

    const targetQuantity = summary.averageAllocation;
    
    summary.locationDistribution.forEach((location, index) => {
      const deviation = location.quantityAllocated - targetQuantity;
      
      if (Math.abs(deviation) > targetQuantity * 0.2) { // 20% deviation threshold
        const recommendedQuantity = Math.round(targetQuantity);
        const quantityChange = recommendedQuantity - location.quantityAllocated;
        
        optimizations.push({
          allocationId: `alloc_${index}`, // Would use actual allocation ID
          currentQuantity: location.quantityAllocated,
          recommendedQuantity,
          quantityChange,
          reason: deviation > 0 ? 'Reduce over-allocation' : 'Increase under-allocation'
        });
      }
    });

    return optimizations;
  }

  private generateBalanceRecommendations(
    balance: AllocationBalance,
    summary: AllocationSummary
  ): BalanceRecommendation[] {
    const recommendations: BalanceRecommendation[] = [];

    if (!balance.isBalanced) {
      if (balance.coefficientOfVariation > 0.5) {
        recommendations.push({
          type: 'REDISTRIBUTE',
          description: 'High variability detected. Consider redistributing quantities more evenly across locations.',
          impact: 30,
          priority: 'HIGH'
        });
      } else {
        recommendations.push({
          type: 'REDISTRIBUTE',
          description: 'Moderate imbalance detected. Minor adjustments could improve distribution.',
          impact: 15,
          priority: 'MEDIUM'
        });
      }
    }

    return recommendations;
  }

  private calculateImprovementScore(current: AllocationBalance, optimized: AllocationBalance): number {
    if (current.coefficientOfVariation === 0) return 0;
    
    const improvement = (current.coefficientOfVariation - optimized.coefficientOfVariation) / current.coefficientOfVariation;
    return Math.max(0, Math.min(100, improvement * 100));
  }
}

/**
 * Factory function to create AllocationUtilities instance
 */
export function createAllocationUtilities(db: DrizzleD1Database): IAllocationUtilities {
  return new AllocationUtilities(db);
}