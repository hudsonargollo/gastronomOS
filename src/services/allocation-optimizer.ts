/**
 * Allocation Optimizer Service
 * 
 * Provides smart allocation suggestions, rebalancing capabilities, and conflict resolution
 * for the distributed allocation system. Implements requirements 7.1 for allocation optimization.
 */

import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, asc, sql, sum, count, avg, inArray } from 'drizzle-orm';
import { 
  allocations,
  poItems,
  purchaseOrders,
  locations,
  products,
  users,
  Allocation,
  Location,
  POItem,
  Product,
  AllocationStatusType
} from '../db/schema';

// Optimization interfaces
export interface AllocationSuggestion {
  poItemId: string;
  productName: string;
  totalQuantity: number;
  currentAllocations: Array<{
    locationId: string;
    locationName: string;
    currentQuantity: number;
    suggestedQuantity: number;
    reason: string;
  }>;
  unallocatedQuantity: number;
  suggestedAllocations: Array<{
    locationId: string;
    locationName: string;
    suggestedQuantity: number;
    confidence: number; // 0-100
    reasoning: string[];
  }>;
  optimizationScore: number; // 0-100, higher is better
}

export interface RebalancingRecommendation {
  poId: string;
  poNumber: string;
  currentEfficiency: number;
  projectedEfficiency: number;
  rebalancingActions: Array<{
    type: 'INCREASE' | 'DECREASE' | 'REDISTRIBUTE';
    allocationId: string;
    locationId: string;
    locationName: string;
    currentQuantity: number;
    suggestedQuantity: number;
    impact: number; // Expected efficiency improvement
    reasoning: string;
  }>;
  totalImpact: number;
  implementationComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface AllocationConflict {
  type: 'OVER_ALLOCATION' | 'UNDER_UTILIZATION' | 'LOCATION_CAPACITY' | 'DEMAND_MISMATCH';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  poItemId: string;
  productName: string;
  description: string;
  affectedLocations: Array<{
    locationId: string;
    locationName: string;
    issue: string;
    currentQuantity: number;
    recommendedQuantity: number;
  }>;
  resolutionOptions: Array<{
    action: string;
    description: string;
    impact: number;
    complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
}

export interface OptimizationStrategy {
  name: string;
  description: string;
  parameters: {
    prioritizeUtilization?: boolean;
    minimizeWaste?: boolean;
    balanceDistribution?: boolean;
    considerHistoricalDemand?: boolean;
    locationCapacityWeight?: number; // 0-1
    demandPredictionWeight?: number; // 0-1
    costOptimizationWeight?: number; // 0-1
  };
}

export interface LocationDemandPattern {
  locationId: string;
  locationName: string;
  productId: string;
  productName: string;
  averageDemand: number;
  demandVariability: number;
  seasonalityFactor: number;
  utilizationRate: number;
  lastOrderDate?: Date;
  predictedDemand: number;
}

export interface OptimizationResult {
  success: boolean;
  optimizationScore: number;
  improvementPercentage: number;
  suggestedAllocations: AllocationSuggestion[];
  rebalancingRecommendations: RebalancingRecommendation[];
  conflictsResolved: AllocationConflict[];
  summary: {
    totalItemsOptimized: number;
    totalQuantityOptimized: number;
    estimatedEfficiencyGain: number;
    implementationComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

export interface IAllocationOptimizerService {
  generateSmartSuggestions(
    tenantId: string, 
    poId: string, 
    strategy?: OptimizationStrategy
  ): Promise<AllocationSuggestion[]>;
  
  analyzeRebalancingOpportunities(
    tenantId: string, 
    poId?: string
  ): Promise<RebalancingRecommendation[]>;
  
  detectAllocationConflicts(
    tenantId: string, 
    poId?: string
  ): Promise<AllocationConflict[]>;
  
  optimizeAllocationDistribution(
    tenantId: string, 
    poId: string, 
    strategy: OptimizationStrategy
  ): Promise<OptimizationResult>;
  
  getLocationDemandPatterns(
    tenantId: string, 
    locationIds?: string[], 
    productIds?: string[]
  ): Promise<LocationDemandPattern[]>;
  
  validateOptimizationFeasibility(
    tenantId: string, 
    suggestions: AllocationSuggestion[]
  ): Promise<{ feasible: boolean; issues: string[] }>;
}

export class AllocationOptimizerService implements IAllocationOptimizerService {
  constructor(private db: DrizzleD1Database) {}

  /**
   * Generate smart allocation suggestions based on historical data and demand patterns
   * Requirements: 7.1
   */
  async generateSmartSuggestions(
    tenantId: string, 
    poId: string, 
    strategy: OptimizationStrategy = this.getDefaultStrategy()
  ): Promise<AllocationSuggestion[]> {
    // Get PO items that need allocation suggestions
    const poItemsData = await this.db
      .select({
        poItem: poItems,
        product: products,
        totalAllocated: sql<number>`COALESCE(SUM(${allocations.quantityAllocated}), 0)`
      })
      .from(poItems)
      .innerJoin(products, eq(poItems.productId, products.id))
      .leftJoin(allocations, eq(allocations.poItemId, poItems.id))
      .where(eq(poItems.poId, poId))
      .groupBy(poItems.id, products.id);

    // Get available locations for this tenant
    const availableLocations = await this.db
      .select()
      .from(locations)
      .where(eq(locations.tenantId, tenantId));

    // Get demand patterns for optimization
    const demandPatterns = await this.getLocationDemandPatterns(
      tenantId,
      availableLocations.map(l => l.id),
      poItemsData.map(item => item.product.id)
    );

    const suggestions: AllocationSuggestion[] = [];

    for (const itemData of poItemsData) {
      const unallocatedQuantity = itemData.poItem.quantityOrdered - itemData.totalAllocated;
      
      if (unallocatedQuantity <= 0) continue; // Skip fully allocated items

      // Get current allocations for this item
      const currentAllocations = await this.db
        .select({
          allocation: allocations,
          location: locations
        })
        .from(allocations)
        .innerJoin(locations, eq(allocations.targetLocationId, locations.id))
        .where(eq(allocations.poItemId, itemData.poItem.id));

      // Generate suggestions based on demand patterns and strategy
      const suggestedAllocations = await this.generateLocationSuggestions(
        itemData.poItem,
        itemData.product,
        unallocatedQuantity,
        availableLocations,
        demandPatterns,
        strategy
      );

      // Calculate optimization score
      const optimizationScore = this.calculateOptimizationScore(
        suggestedAllocations,
        demandPatterns,
        strategy
      );

      suggestions.push({
        poItemId: itemData.poItem.id,
        productName: itemData.product.name,
        totalQuantity: itemData.poItem.quantityOrdered,
        currentAllocations: currentAllocations.map(ca => ({
          locationId: ca.location.id,
          locationName: ca.location.name,
          currentQuantity: ca.allocation.quantityAllocated,
          suggestedQuantity: ca.allocation.quantityAllocated, // Keep current for now
          reason: 'Existing allocation'
        })),
        unallocatedQuantity,
        suggestedAllocations,
        optimizationScore
      });
    }

    return suggestions.sort((a, b) => b.optimizationScore - a.optimizationScore);
  }

  /**
   * Analyze rebalancing opportunities for existing allocations
   * Requirements: 7.1
   */
  async analyzeRebalancingOpportunities(
    tenantId: string, 
    poId?: string
  ): Promise<RebalancingRecommendation[]> {
    const conditions = [eq(purchaseOrders.tenantId, tenantId)];
    if (poId) {
      conditions.push(eq(purchaseOrders.id, poId));
    }

    // Get POs with their allocations
    const posWithAllocations = await this.db
      .select({
        po: purchaseOrders,
        poItem: poItems,
        allocation: allocations,
        location: locations,
        product: products
      })
      .from(purchaseOrders)
      .innerJoin(poItems, eq(poItems.poId, purchaseOrders.id))
      .innerJoin(allocations, eq(allocations.poItemId, poItems.id))
      .innerJoin(locations, eq(allocations.targetLocationId, locations.id))
      .innerJoin(products, eq(poItems.productId, products.id))
      .where(and(...conditions, eq(allocations.status, 'PENDING'))) // Only pending allocations can be rebalanced
      .orderBy(purchaseOrders.id);

    // Group by PO
    const poGroups = this.groupByPO(posWithAllocations);
    const recommendations: RebalancingRecommendation[] = [];

    for (const [poId, poData] of poGroups.entries()) {
      const currentEfficiency = await this.calculateCurrentEfficiency(poId, tenantId);
      
      // Analyze each PO for rebalancing opportunities
      const rebalancingActions = await this.identifyRebalancingActions(
        poData,
        tenantId
      );

      if (rebalancingActions.length === 0) continue;

      // Calculate projected efficiency after rebalancing
      const projectedEfficiency = await this.calculateProjectedEfficiency(
        poId,
        rebalancingActions,
        tenantId
      );

      const totalImpact = projectedEfficiency - currentEfficiency;
      
      if (totalImpact > 5) { // Only recommend if improvement is significant (>5%)
        recommendations.push({
          poId,
          poNumber: poData[0].po.poNumber || 'N/A',
          currentEfficiency,
          projectedEfficiency,
          rebalancingActions,
          totalImpact,
          implementationComplexity: this.assessImplementationComplexity(rebalancingActions)
        });
      }
    }

    return recommendations.sort((a, b) => b.totalImpact - a.totalImpact);
  }

  /**
   * Detect allocation conflicts and issues
   * Requirements: 7.1
   */
  async detectAllocationConflicts(
    tenantId: string, 
    poId?: string
  ): Promise<AllocationConflict[]> {
    const conflicts: AllocationConflict[] = [];

    // Check for over-allocation conflicts
    const overAllocations = await this.detectOverAllocations(tenantId, poId);
    conflicts.push(...overAllocations);

    // Check for under-utilization conflicts
    const underUtilizations = await this.detectUnderUtilizations(tenantId, poId);
    conflicts.push(...underUtilizations);

    // Check for location capacity conflicts
    const capacityConflicts = await this.detectCapacityConflicts(tenantId, poId);
    conflicts.push(...capacityConflicts);

    // Check for demand mismatch conflicts
    const demandMismatches = await this.detectDemandMismatches(tenantId, poId);
    conflicts.push(...demandMismatches);

    return conflicts.sort((a, b) => {
      const severityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Optimize allocation distribution for a purchase order
   * Requirements: 7.1
   */
  async optimizeAllocationDistribution(
    tenantId: string, 
    poId: string, 
    strategy: OptimizationStrategy
  ): Promise<OptimizationResult> {
    // Generate smart suggestions
    const suggestions = await this.generateSmartSuggestions(tenantId, poId, strategy);
    
    // Analyze rebalancing opportunities
    const rebalancingRecommendations = await this.analyzeRebalancingOpportunities(tenantId, poId);
    
    // Detect and resolve conflicts
    const conflicts = await this.detectAllocationConflicts(tenantId, poId);
    
    // Calculate overall optimization metrics
    const currentScore = await this.calculateCurrentOptimizationScore(tenantId, poId);
    const projectedScore = this.calculateProjectedOptimizationScore(suggestions, rebalancingRecommendations);
    
    const improvementPercentage = currentScore > 0 
      ? ((projectedScore - currentScore) / currentScore) * 100 
      : 0;

    // Validate feasibility
    const feasibilityCheck = await this.validateOptimizationFeasibility(tenantId, suggestions);

    return {
      success: feasibilityCheck.feasible,
      optimizationScore: projectedScore,
      improvementPercentage,
      suggestedAllocations: suggestions,
      rebalancingRecommendations,
      conflictsResolved: conflicts,
      summary: {
        totalItemsOptimized: suggestions.length,
        totalQuantityOptimized: suggestions.reduce((sum, s) => sum + s.unallocatedQuantity, 0),
        estimatedEfficiencyGain: improvementPercentage,
        implementationComplexity: this.assessOverallComplexity(suggestions, rebalancingRecommendations)
      }
    };
  }

  /**
   * Get location demand patterns for optimization
   * Requirements: 7.1
   */
  async getLocationDemandPatterns(
    tenantId: string, 
    locationIds?: string[], 
    productIds?: string[]
  ): Promise<LocationDemandPattern[]> {
    const conditions = [eq(allocations.tenantId, tenantId)];
    
    if (locationIds?.length) {
      conditions.push(inArray(allocations.targetLocationId, locationIds));
    }
    
    if (productIds?.length) {
      conditions.push(inArray(products.id, productIds));
    }

    // Get historical allocation data for demand pattern analysis
    const historicalData = await this.db
      .select({
        locationId: locations.id,
        locationName: locations.name,
        productId: products.id,
        productName: products.name,
        totalAllocated: sum(allocations.quantityAllocated),
        totalReceived: sum(allocations.quantityReceived),
        allocationCount: count(allocations.id),
        avgAllocation: avg(allocations.quantityAllocated),
        lastAllocation: sql<number>`MAX(${allocations.createdAt})`
      })
      .from(allocations)
      .innerJoin(locations, eq(allocations.targetLocationId, locations.id))
      .innerJoin(poItems, eq(allocations.poItemId, poItems.id))
      .innerJoin(products, eq(poItems.productId, products.id))
      .where(and(...conditions))
      .groupBy(locations.id, locations.name, products.id, products.name);

    const patterns: LocationDemandPattern[] = [];

    for (const data of historicalData) {
      const utilizationRate = data.totalAllocated > 0 
        ? (data.totalReceived / data.totalAllocated) * 100 
        : 0;

      // Simple demand prediction based on historical average
      const predictedDemand = data.avgAllocation * 1.1; // 10% buffer

      // Calculate demand variability (simplified)
      const demandVariability = Math.min(50, Math.abs(data.avgAllocation - data.totalAllocated / Math.max(1, data.allocationCount)) / Math.max(1, data.avgAllocation) * 100);

      patterns.push({
        locationId: data.locationId,
        locationName: data.locationName,
        productId: data.productId,
        productName: data.productName,
        averageDemand: data.avgAllocation || 0,
        demandVariability,
        seasonalityFactor: 1.0, // Placeholder - would calculate from seasonal data
        utilizationRate,
        lastOrderDate: data.lastAllocation ? new Date(data.lastAllocation) : undefined,
        predictedDemand
      });
    }

    return patterns;
  }

  /**
   * Validate optimization feasibility
   * Requirements: 7.1
   */
  async validateOptimizationFeasibility(
    tenantId: string, 
    suggestions: AllocationSuggestion[]
  ): Promise<{ feasible: boolean; issues: string[] }> {
    const issues: string[] = [];

    for (const suggestion of suggestions) {
      // Check if total suggested allocations don't exceed available quantity
      const totalSuggested = suggestion.suggestedAllocations.reduce(
        (sum, sa) => sum + sa.suggestedQuantity, 
        0
      );
      
      const currentTotal = suggestion.currentAllocations.reduce(
        (sum, ca) => sum + ca.currentQuantity, 
        0
      );

      if (totalSuggested + currentTotal > suggestion.totalQuantity) {
        issues.push(`Over-allocation detected for ${suggestion.productName}: suggested ${totalSuggested + currentTotal} but only ${suggestion.totalQuantity} available`);
      }

      // Check if locations exist and are accessible
      for (const suggestedAllocation of suggestion.suggestedAllocations) {
        const locationExists = await this.db
          .select({ id: locations.id })
          .from(locations)
          .where(and(
            eq(locations.id, suggestedAllocation.locationId),
            eq(locations.tenantId, tenantId)
          ))
          .limit(1);

        if (locationExists.length === 0) {
          issues.push(`Location ${suggestedAllocation.locationId} not found or not accessible`);
        }
      }

      // Check for negative quantities
      for (const suggestedAllocation of suggestion.suggestedAllocations) {
        if (suggestedAllocation.suggestedQuantity <= 0) {
          issues.push(`Invalid quantity ${suggestedAllocation.suggestedQuantity} suggested for location ${suggestedAllocation.locationId}`);
        }
      }
    }

    return {
      feasible: issues.length === 0,
      issues
    };
  }

  // Private helper methods

  private getDefaultStrategy(): OptimizationStrategy {
    return {
      name: 'Balanced Optimization',
      description: 'Balances utilization, waste minimization, and distribution',
      parameters: {
        prioritizeUtilization: true,
        minimizeWaste: true,
        balanceDistribution: true,
        considerHistoricalDemand: true,
        locationCapacityWeight: 0.3,
        demandPredictionWeight: 0.4,
        costOptimizationWeight: 0.3
      }
    };
  }

  private async generateLocationSuggestions(
    poItem: POItem,
    product: Product,
    unallocatedQuantity: number,
    availableLocations: Location[],
    demandPatterns: LocationDemandPattern[],
    strategy: OptimizationStrategy
  ) {
    const suggestions = [];

    // Get demand patterns for this product
    const productDemandPatterns = demandPatterns.filter(dp => dp.productId === product.id);

    for (const location of availableLocations) {
      const demandPattern = productDemandPatterns.find(dp => dp.locationId === location.id);
      
      if (!demandPattern && !strategy.parameters.balanceDistribution) {
        continue; // Skip locations with no historical demand unless balancing
      }

      const suggestedQuantity = this.calculateSuggestedQuantity(
        unallocatedQuantity,
        demandPattern,
        strategy,
        availableLocations.length
      );

      if (suggestedQuantity > 0) {
        const confidence = this.calculateConfidence(demandPattern, strategy);
        const reasoning = this.generateReasoning(demandPattern, strategy, suggestedQuantity);

        suggestions.push({
          locationId: location.id,
          locationName: location.name,
          suggestedQuantity,
          confidence,
          reasoning
        });
      }
    }

    // Normalize suggestions to not exceed unallocated quantity
    const totalSuggested = suggestions.reduce((sum, s) => sum + s.suggestedQuantity, 0);
    if (totalSuggested > unallocatedQuantity) {
      const scaleFactor = unallocatedQuantity / totalSuggested;
      suggestions.forEach(s => {
        s.suggestedQuantity = Math.floor(s.suggestedQuantity * scaleFactor);
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  private calculateSuggestedQuantity(
    unallocatedQuantity: number,
    demandPattern: LocationDemandPattern | undefined,
    strategy: OptimizationStrategy,
    totalLocations: number
  ): number {
    if (!demandPattern) {
      // If no historical data, distribute evenly if balancing is enabled
      return strategy.parameters.balanceDistribution 
        ? Math.floor(unallocatedQuantity / totalLocations)
        : 0;
    }

    // Base suggestion on predicted demand
    let suggestedQuantity = demandPattern.predictedDemand;

    // Apply strategy weights
    if (strategy.parameters.demandPredictionWeight) {
      suggestedQuantity *= strategy.parameters.demandPredictionWeight;
    }

    // Adjust for utilization rate
    if (strategy.parameters.prioritizeUtilization && demandPattern.utilizationRate > 0) {
      suggestedQuantity *= (demandPattern.utilizationRate / 100);
    }

    // Cap at unallocated quantity
    return Math.min(Math.floor(suggestedQuantity), unallocatedQuantity);
  }

  private calculateConfidence(
    demandPattern: LocationDemandPattern | undefined,
    strategy: OptimizationStrategy
  ): number {
    if (!demandPattern) return 30; // Low confidence for locations without history

    let confidence = 50; // Base confidence

    // Increase confidence based on utilization rate
    confidence += (demandPattern.utilizationRate / 100) * 30;

    // Decrease confidence based on demand variability
    confidence -= (demandPattern.demandVariability / 100) * 20;

    // Increase confidence if we have recent data
    if (demandPattern.lastOrderDate) {
      const daysSinceLastOrder = (Date.now() - demandPattern.lastOrderDate.getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceLastOrder < 30) {
        confidence += 10;
      }
    }

    return Math.max(0, Math.min(100, confidence));
  }

  private generateReasoning(
    demandPattern: LocationDemandPattern | undefined,
    strategy: OptimizationStrategy,
    suggestedQuantity: number
  ): string[] {
    const reasoning = [];

    if (!demandPattern) {
      reasoning.push('No historical demand data available');
      if (strategy.parameters.balanceDistribution) {
        reasoning.push('Suggested for balanced distribution across locations');
      }
      return reasoning;
    }

    if (demandPattern.utilizationRate > 80) {
      reasoning.push(`High utilization rate (${demandPattern.utilizationRate.toFixed(1)}%)`);
    }

    if (demandPattern.averageDemand > 0) {
      reasoning.push(`Historical average demand: ${demandPattern.averageDemand.toFixed(1)} units`);
    }

    if (demandPattern.demandVariability < 20) {
      reasoning.push('Consistent demand pattern');
    } else if (demandPattern.demandVariability > 50) {
      reasoning.push('Variable demand pattern - conservative allocation');
    }

    if (demandPattern.lastOrderDate) {
      const daysSinceLastOrder = (Date.now() - demandPattern.lastOrderDate.getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceLastOrder < 7) {
        reasoning.push('Recent allocation activity');
      }
    }

    return reasoning;
  }

  private calculateOptimizationScore(
    suggestedAllocations: any[],
    demandPatterns: LocationDemandPattern[],
    strategy: OptimizationStrategy
  ): number {
    if (suggestedAllocations.length === 0) return 0;

    let score = 0;
    let totalWeight = 0;

    // Score based on confidence levels
    const avgConfidence = suggestedAllocations.reduce((sum, sa) => sum + sa.confidence, 0) / suggestedAllocations.length;
    score += avgConfidence * 0.4;
    totalWeight += 0.4;

    // Score based on demand pattern coverage
    const locationsWithDemand = demandPatterns.length;
    const locationsWithSuggestions = suggestedAllocations.length;
    const coverageScore = locationsWithDemand > 0 ? (locationsWithSuggestions / locationsWithDemand) * 100 : 50;
    score += coverageScore * 0.3;
    totalWeight += 0.3;

    // Score based on strategy alignment
    if (strategy.parameters.balanceDistribution) {
      const distributionBalance = this.calculateDistributionBalance(suggestedAllocations);
      score += distributionBalance * 0.3;
      totalWeight += 0.3;
    }

    return totalWeight > 0 ? score / totalWeight : 0;
  }

  private calculateDistributionBalance(suggestedAllocations: any[]): number {
    if (suggestedAllocations.length <= 1) return 100;

    const quantities = suggestedAllocations.map(sa => sa.suggestedQuantity);
    const avg = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
    const variance = quantities.reduce((sum, q) => sum + Math.pow(q - avg, 2), 0) / quantities.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower standard deviation = better balance
    const balanceScore = Math.max(0, 100 - (stdDev / avg) * 100);
    return balanceScore;
  }

  private groupByPO(data: any[]): Map<string, any[]> {
    const groups = new Map();
    for (const item of data) {
      const poId = item.po.id;
      if (!groups.has(poId)) {
        groups.set(poId, []);
      }
      groups.get(poId).push(item);
    }
    return groups;
  }

  private async calculateCurrentEfficiency(poId: string, tenantId: string): Promise<number> {
    // Simplified efficiency calculation based on allocation utilization
    const [result] = await this.db
      .select({
        totalAllocated: sum(allocations.quantityAllocated),
        totalReceived: sum(allocations.quantityReceived),
        totalOrdered: sum(poItems.quantityOrdered)
      })
      .from(allocations)
      .innerJoin(poItems, eq(allocations.poItemId, poItems.id))
      .where(and(
        eq(poItems.poId, poId),
        eq(allocations.tenantId, tenantId)
      ));

    if (!result.totalOrdered || result.totalOrdered === 0) return 0;

    const allocationRate = (result.totalAllocated / result.totalOrdered) * 100;
    const utilizationRate = result.totalAllocated > 0 ? (result.totalReceived / result.totalAllocated) * 100 : 0;

    return (allocationRate + utilizationRate) / 2;
  }

  private async identifyRebalancingActions(poData: any[], tenantId: string) {
    // Simplified rebalancing logic - identify over/under allocated locations
    const actions = [];
    
    // Group by location to analyze allocation patterns
    const locationGroups = new Map();
    for (const item of poData) {
      const locationId = item.location.id;
      if (!locationGroups.has(locationId)) {
        locationGroups.set(locationId, []);
      }
      locationGroups.get(locationId).push(item);
    }

    // Analyze each location for rebalancing opportunities
    for (const [locationId, items] of locationGroups.entries()) {
      const totalAllocated = items.reduce((sum: number, item: any) => sum + item.allocation.quantityAllocated, 0);
      const totalReceived = items.reduce((sum: number, item: any) => sum + item.allocation.quantityReceived, 0);
      const utilizationRate = totalAllocated > 0 ? (totalReceived / totalAllocated) * 100 : 0;

      // If utilization is very low, suggest reducing allocation
      if (utilizationRate < 50 && totalAllocated > 10) {
        const suggestedReduction = Math.floor(totalAllocated * 0.3);
        actions.push({
          type: 'DECREASE' as const,
          allocationId: items[0].allocation.id,
          locationId,
          locationName: items[0].location.name,
          currentQuantity: totalAllocated,
          suggestedQuantity: totalAllocated - suggestedReduction,
          impact: 15, // Estimated efficiency improvement
          reasoning: `Low utilization rate (${utilizationRate.toFixed(1)}%) suggests over-allocation`
        });
      }

      // If utilization is very high, suggest increasing allocation
      if (utilizationRate > 90 && totalAllocated < 100) {
        const suggestedIncrease = Math.floor(totalAllocated * 0.2);
        actions.push({
          type: 'INCREASE' as const,
          allocationId: items[0].allocation.id,
          locationId,
          locationName: items[0].location.name,
          currentQuantity: totalAllocated,
          suggestedQuantity: totalAllocated + suggestedIncrease,
          impact: 10, // Estimated efficiency improvement
          reasoning: `High utilization rate (${utilizationRate.toFixed(1)}%) suggests under-allocation`
        });
      }
    }

    return actions;
  }

  private async calculateProjectedEfficiency(
    poId: string,
    rebalancingActions: any[],
    tenantId: string
  ): Promise<number> {
    const currentEfficiency = await this.calculateCurrentEfficiency(poId, tenantId);
    
    // Estimate improvement based on rebalancing actions
    const totalImpact = rebalancingActions.reduce((sum, action) => sum + action.impact, 0);
    
    return Math.min(100, currentEfficiency + totalImpact);
  }

  private assessImplementationComplexity(actions: any[]): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (actions.length <= 2) return 'LOW';
    if (actions.length <= 5) return 'MEDIUM';
    return 'HIGH';
  }

  private async detectOverAllocations(tenantId: string, poId?: string): Promise<AllocationConflict[]> {
    const conditions = [eq(allocations.tenantId, tenantId)];
    if (poId) {
      conditions.push(eq(poItems.poId, poId));
    }

    // Find items where total allocations exceed ordered quantity
    const overAllocatedItems = await this.db
      .select({
        poItem: poItems,
        product: products,
        totalAllocated: sum(allocations.quantityAllocated),
        orderedQuantity: poItems.quantityOrdered
      })
      .from(poItems)
      .innerJoin(products, eq(poItems.productId, products.id))
      .innerJoin(allocations, eq(allocations.poItemId, poItems.id))
      .where(and(...conditions))
      .groupBy(poItems.id, products.id)
      .having(sql`SUM(${allocations.quantityAllocated}) > ${poItems.quantityOrdered}`);

    const conflicts: AllocationConflict[] = [];

    for (const item of overAllocatedItems) {
      const overAllocation = item.totalAllocated - item.orderedQuantity;
      
      conflicts.push({
        type: 'OVER_ALLOCATION',
        severity: overAllocation > item.orderedQuantity * 0.1 ? 'HIGH' : 'MEDIUM',
        poItemId: item.poItem.id,
        productName: item.product.name,
        description: `Total allocated quantity (${item.totalAllocated}) exceeds ordered quantity (${item.orderedQuantity}) by ${overAllocation} units`,
        affectedLocations: [], // Would populate with specific location details
        resolutionOptions: [
          {
            action: 'Reduce allocations proportionally',
            description: 'Reduce all allocations by the same percentage to fit within ordered quantity',
            impact: 80,
            complexity: 'LOW'
          },
          {
            action: 'Remove newest allocations',
            description: 'Remove the most recently created allocations until within limits',
            impact: 70,
            complexity: 'MEDIUM'
          }
        ]
      });
    }

    return conflicts;
  }

  private async detectUnderUtilizations(tenantId: string, poId?: string): Promise<AllocationConflict[]> {
    // Simplified implementation - would analyze utilization rates
    return [];
  }

  private async detectCapacityConflicts(tenantId: string, poId?: string): Promise<AllocationConflict[]> {
    // Simplified implementation - would check location capacity constraints
    return [];
  }

  private async detectDemandMismatches(tenantId: string, poId?: string): Promise<AllocationConflict[]> {
    // Simplified implementation - would compare allocations to predicted demand
    return [];
  }

  private async calculateCurrentOptimizationScore(tenantId: string, poId: string): Promise<number> {
    return await this.calculateCurrentEfficiency(poId, tenantId);
  }

  private calculateProjectedOptimizationScore(
    suggestions: AllocationSuggestion[],
    rebalancingRecommendations: RebalancingRecommendation[]
  ): number {
    const avgSuggestionScore = suggestions.length > 0 
      ? suggestions.reduce((sum, s) => sum + s.optimizationScore, 0) / suggestions.length 
      : 0;

    const avgRebalancingImpact = rebalancingRecommendations.length > 0
      ? rebalancingRecommendations.reduce((sum, r) => sum + r.projectedEfficiency, 0) / rebalancingRecommendations.length
      : 0;

    return (avgSuggestionScore + avgRebalancingImpact) / 2;
  }

  private assessOverallComplexity(
    suggestions: AllocationSuggestion[],
    rebalancingRecommendations: RebalancingRecommendation[]
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    const totalActions = suggestions.length + rebalancingRecommendations.length;
    
    if (totalActions <= 3) return 'LOW';
    if (totalActions <= 8) return 'MEDIUM';
    return 'HIGH';
  }
}

/**
 * Factory function to create AllocationOptimizerService instance
 */
export function createAllocationOptimizerService(db: DrizzleD1Database): IAllocationOptimizerService {
  return new AllocationOptimizerService(db);
}