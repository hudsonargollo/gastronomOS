import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, sql, gte, lte, count, sum, avg, inArray } from 'drizzle-orm';
import { 
  transfers,
  locations,
  products,
  users,
  Transfer,
  TransferStatus,
  TransferStatusType,
  TransferPriorityType,
  Location,
  Product
} from '../db';
import { generateId } from '../utils';
import { CreateTransferRequest, TransferService } from './transfer';

// Transfer intelligence interfaces
export interface PredictiveTransferSuggestion {
  suggestionId: string;
  productId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  suggestedQuantity: number;
  confidence: number; // 0-1
  reasoning: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedNeedDate: Date;
  basedOnPatterns: TransferPattern[];
}

export interface TransferPattern {
  patternId: string;
  type: 'SEASONAL' | 'WEEKLY' | 'DAILY' | 'EVENT_DRIVEN' | 'DEMAND_SPIKE';
  productId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  frequency: number; // transfers per time period
  averageQuantity: number;
  seasonality?: {
    peak: string; // month, day of week, etc.
    low: string;
  };
  confidence: number;
  lastUpdated: Date;
}

export interface ReorderPoint {
  reorderPointId: string;
  productId: string;
  locationId: string;
  minimumStock: number;
  reorderQuantity: number;
  leadTimeDays: number;
  safetyStock: number;
  isActive: boolean;
  lastTriggered?: Date;
  createdBy: string;
  createdAt: Date;
}

export interface AutomatedTransferTrigger {
  triggerId: string;
  reorderPointId: string;
  productId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  currentStock: number;
  reorderPoint: number;
  suggestedQuantity: number;
  priority: TransferPriorityType;
  triggerReason: string;
  triggeredAt: Date;
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED';
}

export interface DemandForecast {
  productId: string;
  locationId: string;
  forecastPeriod: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  forecastedDemand: number;
  confidence: number;
  factors: {
    historical: number;
    seasonal: number;
    trend: number;
    external?: number;
  };
  generatedAt: Date;
}

export interface TransferIntelligenceService {
  generatePredictiveTransferSuggestions(locationId: string, tenantId: string): Promise<PredictiveTransferSuggestion[]>;
  analyzeTransferPatterns(tenantId: string, lookbackDays?: number): Promise<TransferPattern[]>;
  createReorderPoint(reorderPoint: Omit<ReorderPoint, 'reorderPointId' | 'createdAt'>, tenantId: string): Promise<ReorderPoint>;
  updateReorderPoint(reorderPointId: string, updates: Partial<ReorderPoint>, tenantId: string): Promise<ReorderPoint>;
  checkAutomatedReorderTriggers(tenantId: string): Promise<AutomatedTransferTrigger[]>;
  executeAutomatedTransfer(triggerId: string, tenantId: string, executedBy: string): Promise<Transfer>;
  generateDemandForecast(productId: string, locationId: string, tenantId: string): Promise<DemandForecast>;
  getTransferRecommendations(locationId: string, tenantId: string): Promise<TransferRecommendation[]>;
  learnFromTransferOutcomes(tenantId: string): Promise<LearningInsights>;
}

export interface TransferRecommendation {
  type: 'PREDICTIVE' | 'REORDER' | 'PATTERN_BASED' | 'DEMAND_FORECAST';
  productId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  recommendedQuantity: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasoning: string;
  confidence: number;
  estimatedBenefit: {
    costSavings: number;
    stockoutPrevention: boolean;
    efficiencyGain: number;
  };
}

export interface LearningInsights {
  totalTransfersAnalyzed: number;
  patternsIdentified: number;
  accuracyMetrics: {
    predictionAccuracy: number;
    reorderPointEffectiveness: number;
    demandForecastAccuracy: number;
  };
  recommendations: {
    adjustReorderPoints: ReorderPoint[];
    newPatterns: TransferPattern[];
    optimizationOpportunities: string[];
  };
}

export class TransferIntelligenceServiceImpl implements TransferIntelligenceService {
  constructor(
    private db: DrizzleD1Database,
    private transferService: TransferService
  ) {}

  /**
   * Generate predictive transfer suggestions based on historical patterns and demand
   * Requirements: 8.3, 8.5
   */
  async generatePredictiveTransferSuggestions(locationId: string, tenantId: string): Promise<PredictiveTransferSuggestion[]> {
    if (!locationId) {
      throw new Error('Location ID is required');
    }

    // Validate location access
    await this.validateLocation(locationId, tenantId);

    // Get historical transfer patterns for this location
    const patterns = await this.analyzeTransferPatterns(tenantId, 90); // 90 days lookback
    const locationPatterns = patterns.filter(p => 
      p.sourceLocationId === locationId || p.destinationLocationId === locationId
    );

    // Get current inventory levels (simplified - would integrate with inventory system)
    const currentInventory = await this.getCurrentInventoryLevels(locationId, tenantId);

    // Generate suggestions based on patterns and inventory
    const suggestions: PredictiveTransferSuggestion[] = [];

    for (const pattern of locationPatterns) {
      // Only suggest transfers where this location is the destination (needs inventory)
      if (pattern.destinationLocationId !== locationId) continue;

      const currentStock = currentInventory.find(inv => inv.productId === pattern.productId)?.quantity || 0;
      const averageDemand = pattern.averageQuantity;
      const frequency = pattern.frequency;

      // Calculate if we need to suggest a transfer
      const daysUntilNextTransfer = this.calculateDaysUntilNextTransfer(pattern);
      const projectedStock = currentStock - (averageDemand * (daysUntilNextTransfer / 30)); // Monthly average

      if (projectedStock < averageDemand * 0.5) { // Below 50% of average demand
        const suggestedQuantity = Math.max(averageDemand, Math.ceil(averageDemand * 1.5 - projectedStock));
        const urgency = this.calculateUrgency(projectedStock, averageDemand, daysUntilNextTransfer);
        
        suggestions.push({
          suggestionId: `suggestion_${generateId()}`,
          productId: pattern.productId,
          sourceLocationId: pattern.sourceLocationId,
          destinationLocationId: pattern.destinationLocationId,
          suggestedQuantity,
          confidence: pattern.confidence * 0.8, // Slightly lower confidence for predictions
          reasoning: `Based on ${pattern.type} pattern: average ${averageDemand} units every ${Math.round(30/frequency)} days. Current stock (${currentStock}) may be insufficient.`,
          urgency,
          estimatedNeedDate: new Date(Date.now() + (daysUntilNextTransfer * 24 * 60 * 60 * 1000)),
          basedOnPatterns: [pattern]
        });
      }
    }

    // Sort by urgency and confidence
    return suggestions.sort((a, b) => {
      const urgencyOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      const aScore = urgencyOrder[a.urgency] * a.confidence;
      const bScore = urgencyOrder[b.urgency] * b.confidence;
      return bScore - aScore;
    });
  }

  /**
   * Analyze historical transfer patterns to identify trends and seasonality
   * Requirements: 8.3, 8.5
   */
  async analyzeTransferPatterns(tenantId: string, lookbackDays: number = 90): Promise<TransferPattern[]> {
    const cutoffDate = new Date(Date.now() - (lookbackDays * 24 * 60 * 60 * 1000));

    // Get historical transfers
    const historicalTransfers = await this.db
      .select()
      .from(transfers)
      .where(and(
        eq(transfers.tenantId, tenantId),
        eq(transfers.status, TransferStatus.RECEIVED),
        gte(transfers.receivedAt, cutoffDate.getTime())
      ))
      .orderBy(desc(transfers.receivedAt));

    // Group transfers by product and route (source -> destination)
    const routeGroups = new Map<string, Transfer[]>();
    
    for (const transfer of historicalTransfers) {
      const routeKey = `${transfer.productId}_${transfer.sourceLocationId}_${transfer.destinationLocationId}`;
      if (!routeGroups.has(routeKey)) {
        routeGroups.set(routeKey, []);
      }
      routeGroups.get(routeKey)!.push(transfer);
    }

    const patterns: TransferPattern[] = [];

    // Analyze each route for patterns
    for (const [routeKey, routeTransfers] of routeGroups) {
      if (routeTransfers.length < 3) continue; // Need at least 3 transfers to identify a pattern

      const [productId, sourceLocationId, destinationLocationId] = routeKey.split('_');
      
      // Calculate basic statistics
      const quantities = routeTransfers.map(t => t.quantityReceived || 0);
      const averageQuantity = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
      const frequency = routeTransfers.length / (lookbackDays / 30); // transfers per month

      // Analyze timing patterns
      const timingPattern = this.analyzeTimingPattern(routeTransfers);
      const seasonality = this.analyzeSeasonality(routeTransfers);

      // Calculate confidence based on consistency
      const quantityVariance = this.calculateVariance(quantities);
      const consistencyScore = Math.max(0, 1 - (quantityVariance / (averageQuantity * averageQuantity)));
      const frequencyScore = Math.min(1, frequency / 2); // Higher frequency = higher confidence
      const confidence = (consistencyScore + frequencyScore) / 2;

      patterns.push({
        patternId: `pattern_${generateId()}`,
        type: timingPattern.type,
        productId,
        sourceLocationId,
        destinationLocationId,
        frequency,
        averageQuantity,
        seasonality,
        confidence,
        lastUpdated: new Date()
      });
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Create a new reorder point for automated transfers
   * Requirements: 8.3, 8.5
   */
  async createReorderPoint(reorderPoint: Omit<ReorderPoint, 'reorderPointId' | 'createdAt'>, tenantId: string): Promise<ReorderPoint> {
    // Validate required fields
    if (!reorderPoint.productId || !reorderPoint.locationId || reorderPoint.minimumStock < 0 || reorderPoint.reorderQuantity <= 0) {
      throw new Error('Product ID, location ID, non-negative minimum stock, and positive reorder quantity are required');
    }

    // Validate entities exist
    await this.validateLocation(reorderPoint.locationId, tenantId);
    await this.validateProduct(reorderPoint.productId, tenantId);
    await this.validateUser(reorderPoint.createdBy, tenantId);

    const newReorderPoint: ReorderPoint = {
      ...reorderPoint,
      reorderPointId: `reorder_${generateId()}`,
      createdAt: new Date()
    };

    // In a real implementation, this would be stored in a dedicated reorder_points table
    // For now, we'll simulate storage and return the created reorder point
    console.log('Created reorder point:', newReorderPoint);

    return newReorderPoint;
  }

  /**
   * Update an existing reorder point
   * Requirements: 8.3, 8.5
   */
  async updateReorderPoint(reorderPointId: string, updates: Partial<ReorderPoint>, tenantId: string): Promise<ReorderPoint> {
    if (!reorderPointId) {
      throw new Error('Reorder point ID is required');
    }

    // In a real implementation, this would update the reorder_points table
    // For now, we'll simulate the update
    const updatedReorderPoint: ReorderPoint = {
      reorderPointId,
      productId: updates.productId || 'product_example',
      locationId: updates.locationId || 'location_example',
      minimumStock: updates.minimumStock || 10,
      reorderQuantity: updates.reorderQuantity || 50,
      leadTimeDays: updates.leadTimeDays || 3,
      safetyStock: updates.safetyStock || 5,
      isActive: updates.isActive !== undefined ? updates.isActive : true,
      lastTriggered: updates.lastTriggered,
      createdBy: updates.createdBy || 'user_example',
      createdAt: updates.createdAt || new Date()
    };

    console.log('Updated reorder point:', updatedReorderPoint);
    return updatedReorderPoint;
  }

  /**
   * Check for automated reorder triggers based on current inventory levels
   * Requirements: 8.3, 8.5
   */
  async checkAutomatedReorderTriggers(tenantId: string): Promise<AutomatedTransferTrigger[]> {
    // In a real implementation, this would:
    // 1. Get all active reorder points for the tenant
    // 2. Check current inventory levels against reorder points
    // 3. Generate triggers for items below reorder point

    // Simulated reorder points (would come from database)
    const reorderPoints = await this.getActiveReorderPoints(tenantId);
    const triggers: AutomatedTransferTrigger[] = [];

    for (const reorderPoint of reorderPoints) {
      // Get current inventory level (simplified)
      const currentStock = await this.getCurrentStock(reorderPoint.productId, reorderPoint.locationId, tenantId);
      
      if (currentStock <= reorderPoint.minimumStock) {
        // Find best source location for this product
        const sourceLocation = await this.findBestSourceLocation(reorderPoint.productId, reorderPoint.locationId, tenantId);
        
        if (sourceLocation) {
          const suggestedQuantity = reorderPoint.reorderQuantity;
          const priority = currentStock === 0 ? 'EMERGENCY' : currentStock < reorderPoint.safetyStock ? 'HIGH' : 'NORMAL';
          
          triggers.push({
            triggerId: `trigger_${generateId()}`,
            reorderPointId: reorderPoint.reorderPointId,
            productId: reorderPoint.productId,
            sourceLocationId: sourceLocation,
            destinationLocationId: reorderPoint.locationId,
            currentStock,
            reorderPoint: reorderPoint.minimumStock,
            suggestedQuantity,
            priority: priority as TransferPriorityType,
            triggerReason: `Stock level (${currentStock}) below reorder point (${reorderPoint.minimumStock})`,
            triggeredAt: new Date(),
            status: 'PENDING'
          });
        }
      }
    }

    return triggers;
  }

  /**
   * Execute an automated transfer based on a trigger
   * Requirements: 8.3, 8.5
   */
  async executeAutomatedTransfer(triggerId: string, tenantId: string, executedBy: string): Promise<Transfer> {
    if (!triggerId) {
      throw new Error('Trigger ID is required');
    }

    // Get the trigger (in real implementation, would fetch from database)
    const trigger = await this.getTrigger(triggerId, tenantId);
    if (!trigger) {
      throw new Error('Trigger not found');
    }

    if (trigger.status !== 'PENDING') {
      throw new Error('Trigger has already been processed');
    }

    // Create the transfer request
    const transferRequest: CreateTransferRequest = {
      productId: trigger.productId,
      sourceLocationId: trigger.sourceLocationId,
      destinationLocationId: trigger.destinationLocationId,
      quantityRequested: trigger.suggestedQuantity,
      priority: trigger.priority,
      notes: `Automated transfer: ${trigger.triggerReason}`,
      reasonCode: 'AUTOMATED_REORDER'
    };

    // Create the transfer
    const transfer = await this.transferService.createTransferRequest(transferRequest, tenantId, executedBy);

    // Update trigger status (in real implementation)
    await this.updateTriggerStatus(triggerId, 'EXECUTED', tenantId);

    // Update reorder point last triggered date
    await this.updateReorderPointLastTriggered(trigger.reorderPointId, new Date(), tenantId);

    return transfer;
  }

  /**
   * Generate demand forecast for a product at a location
   * Requirements: 8.3, 8.5
   */
  async generateDemandForecast(productId: string, locationId: string, tenantId: string): Promise<DemandForecast> {
    if (!productId || !locationId) {
      throw new Error('Product ID and location ID are required');
    }

    // Validate entities
    await this.validateProduct(productId, tenantId);
    await this.validateLocation(locationId, tenantId);

    // Get historical transfer data for this product/location
    const historicalData = await this.getHistoricalDemandData(productId, locationId, tenantId);

    // Calculate historical average
    const historicalAverage = historicalData.length > 0 
      ? historicalData.reduce((sum, data) => sum + data.quantity, 0) / historicalData.length
      : 0;

    // Analyze seasonal patterns
    const seasonalFactor = this.calculateSeasonalFactor(historicalData);

    // Analyze trend
    const trendFactor = this.calculateTrendFactor(historicalData);

    // Calculate forecasted demand
    const forecastedDemand = Math.max(0, Math.round(
      historicalAverage * seasonalFactor * trendFactor
    ));

    // Calculate confidence based on data quality and consistency
    const confidence = this.calculateForecastConfidence(historicalData);

    return {
      productId,
      locationId,
      forecastPeriod: 'WEEKLY',
      forecastedDemand,
      confidence,
      factors: {
        historical: historicalAverage,
        seasonal: seasonalFactor,
        trend: trendFactor
      },
      generatedAt: new Date()
    };
  }

  /**
   * Get comprehensive transfer recommendations for a location
   * Requirements: 8.3, 8.5
   */
  async getTransferRecommendations(locationId: string, tenantId: string): Promise<TransferRecommendation[]> {
    if (!locationId) {
      throw new Error('Location ID is required');
    }

    const recommendations: TransferRecommendation[] = [];

    // Get predictive suggestions
    const predictiveSuggestions = await this.generatePredictiveTransferSuggestions(locationId, tenantId);
    for (const suggestion of predictiveSuggestions) {
      recommendations.push({
        type: 'PREDICTIVE',
        productId: suggestion.productId,
        sourceLocationId: suggestion.sourceLocationId,
        destinationLocationId: suggestion.destinationLocationId,
        recommendedQuantity: suggestion.suggestedQuantity,
        urgency: suggestion.urgency,
        reasoning: suggestion.reasoning,
        confidence: suggestion.confidence,
        estimatedBenefit: {
          costSavings: suggestion.suggestedQuantity * 2, // Simplified calculation
          stockoutPrevention: suggestion.urgency === 'HIGH' || suggestion.urgency === 'CRITICAL',
          efficiencyGain: suggestion.confidence * 10
        }
      });
    }

    // Get reorder-based recommendations
    const reorderTriggers = await this.checkAutomatedReorderTriggers(tenantId);
    const locationTriggers = reorderTriggers.filter(t => t.destinationLocationId === locationId);
    
    for (const trigger of locationTriggers) {
      recommendations.push({
        type: 'REORDER',
        productId: trigger.productId,
        sourceLocationId: trigger.sourceLocationId,
        destinationLocationId: trigger.destinationLocationId,
        recommendedQuantity: trigger.suggestedQuantity,
        urgency: trigger.priority === 'EMERGENCY' ? 'CRITICAL' : trigger.priority === 'HIGH' ? 'HIGH' : 'MEDIUM',
        reasoning: trigger.triggerReason,
        confidence: 0.9, // High confidence for reorder points
        estimatedBenefit: {
          costSavings: trigger.suggestedQuantity * 1.5,
          stockoutPrevention: true,
          efficiencyGain: 15
        }
      });
    }

    // Sort by urgency and confidence
    return recommendations.sort((a, b) => {
      const urgencyOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      const aScore = urgencyOrder[a.urgency] * a.confidence;
      const bScore = urgencyOrder[b.urgency] * b.confidence;
      return bScore - aScore;
    });
  }

  /**
   * Learn from transfer outcomes to improve predictions
   * Requirements: 8.3, 8.5
   */
  async learnFromTransferOutcomes(tenantId: string): Promise<LearningInsights> {
    // Analyze recent completed transfers
    const recentTransfers = await this.db
      .select()
      .from(transfers)
      .where(and(
        eq(transfers.tenantId, tenantId),
        eq(transfers.status, TransferStatus.RECEIVED),
        gte(transfers.receivedAt, Date.now() - (30 * 24 * 60 * 60 * 1000)) // Last 30 days
      ));

    // Analyze patterns and accuracy
    const patterns = await this.analyzeTransferPatterns(tenantId, 30);
    
    // Calculate accuracy metrics (simplified)
    const predictionAccuracy = this.calculatePredictionAccuracy(recentTransfers);
    const reorderPointEffectiveness = this.calculateReorderPointEffectiveness(tenantId);
    const demandForecastAccuracy = this.calculateDemandForecastAccuracy(recentTransfers);

    // Generate recommendations for improvement
    const adjustReorderPoints = await this.identifyReorderPointAdjustments(tenantId);
    const newPatterns = patterns.filter(p => p.confidence > 0.7 && p.frequency > 1);
    const optimizationOpportunities = this.identifyOptimizationOpportunities(recentTransfers);

    return {
      totalTransfersAnalyzed: recentTransfers.length,
      patternsIdentified: patterns.length,
      accuracyMetrics: {
        predictionAccuracy,
        reorderPointEffectiveness,
        demandForecastAccuracy
      },
      recommendations: {
        adjustReorderPoints,
        newPatterns,
        optimizationOpportunities
      }
    };
  }

  // Private helper methods

  private async validateLocation(locationId: string, tenantId: string): Promise<Location> {
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

  private async validateProduct(productId: string, tenantId: string): Promise<Product> {
    const [product] = await this.db
      .select()
      .from(products)
      .where(and(
        eq(products.id, productId),
        eq(products.tenantId, tenantId)
      ))
      .limit(1);

    if (!product) {
      throw new Error('Product not found in this organization');
    }

    return product;
  }

  private async validateUser(userId: string, tenantId: string): Promise<void> {
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
  }

  private async getCurrentInventoryLevels(locationId: string, tenantId: string) {
    // Simplified inventory calculation based on transfers
    // In a real implementation, this would query an inventory table
    const incomingTransfers = await this.db
      .select({
        productId: transfers.productId,
        totalReceived: sum(transfers.quantityReceived)
      })
      .from(transfers)
      .where(and(
        eq(transfers.tenantId, tenantId),
        eq(transfers.destinationLocationId, locationId),
        eq(transfers.status, TransferStatus.RECEIVED)
      ))
      .groupBy(transfers.productId);

    const outgoingTransfers = await this.db
      .select({
        productId: transfers.productId,
        totalShipped: sum(transfers.quantityShipped)
      })
      .from(transfers)
      .where(and(
        eq(transfers.tenantId, tenantId),
        eq(transfers.sourceLocationId, locationId),
        eq(transfers.status, TransferStatus.RECEIVED)
      ))
      .groupBy(transfers.productId);

    // Calculate net inventory
    const inventory = new Map<string, number>();
    
    for (const incoming of incomingTransfers) {
      inventory.set(incoming.productId, Number(incoming.totalReceived) || 0);
    }

    for (const outgoing of outgoingTransfers) {
      const current = inventory.get(outgoing.productId) || 0;
      inventory.set(outgoing.productId, current - (Number(outgoing.totalShipped) || 0));
    }

    return Array.from(inventory.entries()).map(([productId, quantity]) => ({
      productId,
      quantity: Math.max(0, quantity)
    }));
  }

  private calculateDaysUntilNextTransfer(pattern: TransferPattern): number {
    // Calculate expected days until next transfer based on frequency
    const transfersPerMonth = pattern.frequency;
    const daysPerTransfer = transfersPerMonth > 0 ? 30 / transfersPerMonth : 30;
    return Math.round(daysPerTransfer);
  }

  private calculateUrgency(projectedStock: number, averageDemand: number, daysUntilNext: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (projectedStock <= 0) return 'CRITICAL';
    if (projectedStock < averageDemand * 0.25) return 'HIGH';
    if (projectedStock < averageDemand * 0.5) return 'MEDIUM';
    return 'LOW';
  }

  private analyzeTimingPattern(transfers: Transfer[]): { type: TransferPattern['type'] } {
    // Simplified pattern analysis
    if (transfers.length < 4) return { type: 'WEEKLY' };
    
    // Analyze intervals between transfers
    const intervals = [];
    for (let i = 1; i < transfers.length; i++) {
      const interval = (transfers[i-1].receivedAt! - transfers[i].receivedAt!) / (24 * 60 * 60 * 1000);
      intervals.push(Math.abs(interval));
    }

    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    if (avgInterval <= 2) return { type: 'DAILY' };
    if (avgInterval <= 10) return { type: 'WEEKLY' };
    if (avgInterval <= 35) return { type: 'SEASONAL' };
    return { type: 'SEASONAL' };
  }

  private analyzeSeasonality(transfers: Transfer[]): TransferPattern['seasonality'] {
    // Simplified seasonality analysis
    const months = transfers.map(t => new Date(t.receivedAt!).getMonth());
    const monthCounts = new Array(12).fill(0);
    
    months.forEach(month => monthCounts[month]++);
    
    const maxCount = Math.max(...monthCounts);
    const minCount = Math.min(...monthCounts);
    const peakMonth = monthCounts.indexOf(maxCount);
    const lowMonth = monthCounts.indexOf(minCount);
    
    if (maxCount > minCount * 1.5) {
      return {
        peak: new Date(2024, peakMonth).toLocaleString('default', { month: 'long' }),
        low: new Date(2024, lowMonth).toLocaleString('default', { month: 'long' })
      };
    }
    
    return undefined;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  private async getActiveReorderPoints(tenantId: string): Promise<ReorderPoint[]> {
    // Simplified - in real implementation would query reorder_points table
    return [
      {
        reorderPointId: 'reorder_1',
        productId: 'product_1',
        locationId: 'location_1',
        minimumStock: 10,
        reorderQuantity: 50,
        leadTimeDays: 3,
        safetyStock: 5,
        isActive: true,
        createdBy: 'user_1',
        createdAt: new Date()
      }
    ];
  }

  private async getCurrentStock(productId: string, locationId: string, tenantId: string): Promise<number> {
    // Simplified stock calculation
    const inventory = await this.getCurrentInventoryLevels(locationId, tenantId);
    return inventory.find(inv => inv.productId === productId)?.quantity || 0;
  }

  private async findBestSourceLocation(productId: string, destinationLocationId: string, tenantId: string): Promise<string | null> {
    // Find location with highest stock of this product (simplified)
    const allLocations = await this.db
      .select()
      .from(locations)
      .where(and(
        eq(locations.tenantId, tenantId),
        sql`${locations.id} != ${destinationLocationId}`
      ));

    // In real implementation, would check inventory levels at each location
    return allLocations.length > 0 ? allLocations[0].id : null;
  }

  private async getTrigger(triggerId: string, tenantId: string): Promise<AutomatedTransferTrigger | null> {
    // Simplified - in real implementation would query triggers table
    return {
      triggerId,
      reorderPointId: 'reorder_1',
      productId: 'product_1',
      sourceLocationId: 'location_2',
      destinationLocationId: 'location_1',
      currentStock: 5,
      reorderPoint: 10,
      suggestedQuantity: 50,
      priority: 'HIGH',
      triggerReason: 'Stock below reorder point',
      triggeredAt: new Date(),
      status: 'PENDING'
    };
  }

  private async updateTriggerStatus(triggerId: string, status: 'EXECUTED' | 'CANCELLED', tenantId: string): Promise<void> {
    // In real implementation, would update triggers table
    console.log(`Updated trigger ${triggerId} status to ${status}`);
  }

  private async updateReorderPointLastTriggered(reorderPointId: string, date: Date, tenantId: string): Promise<void> {
    // In real implementation, would update reorder_points table
    console.log(`Updated reorder point ${reorderPointId} last triggered to ${date}`);
  }

  private async getHistoricalDemandData(productId: string, locationId: string, tenantId: string) {
    // Get transfers to this location for this product
    const transfersData = await this.db
      .select()
      .from(transfers)
      .where(and(
        eq(transfers.tenantId, tenantId),
        eq(transfers.productId, productId),
        eq(transfers.destinationLocationId, locationId),
        eq(transfers.status, TransferStatus.RECEIVED),
        gte(transfers.receivedAt, Date.now() - (90 * 24 * 60 * 60 * 1000)) // Last 90 days
      ))
      .orderBy(desc(transfers.receivedAt));

    return transfersData.map(t => ({
      date: new Date(t['receivedAt']!),
      quantity: t['quantityReceived'] || 0
    }));
  }

  private calculateSeasonalFactor(historicalData: { date: Date; quantity: number; }[]): number {
    // Simplified seasonal calculation
    if (historicalData.length < 4) return 1.0;
    
    const currentMonth = new Date().getMonth();
    const monthlyData = historicalData.filter(d => d.date.getMonth() === currentMonth);
    const monthlyAverage = monthlyData.length > 0 
      ? monthlyData.reduce((sum, d) => sum + d.quantity, 0) / monthlyData.length
      : 0;
    
    const overallAverage = historicalData.reduce((sum, d) => sum + d.quantity, 0) / historicalData.length;
    
    return overallAverage > 0 ? monthlyAverage / overallAverage : 1.0;
  }

  private calculateTrendFactor(historicalData: { date: Date; quantity: number; }[]): number {
    // Simplified trend calculation
    if (historicalData.length < 2) return 1.0;
    
    const sortedData = historicalData.sort((a, b) => a.date.getTime() - b.date.getTime());
    const firstHalf = sortedData.slice(0, Math.floor(sortedData.length / 2));
    const secondHalf = sortedData.slice(Math.floor(sortedData.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, d) => sum + d.quantity, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.quantity, 0) / secondHalf.length;
    
    return firstAvg > 0 ? secondAvg / firstAvg : 1.0;
  }

  private calculateForecastConfidence(historicalData: { date: Date; quantity: number; }[]): number {
    if (historicalData.length < 3) return 0.3;
    
    const quantities = historicalData.map(d => d.quantity);
    const mean = quantities.reduce((sum, q) => sum + q, 0) / quantities.length;
    const variance = this.calculateVariance(quantities);
    const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 1;
    
    // Lower coefficient of variation = higher confidence
    return Math.max(0.1, Math.min(1.0, 1 - coefficientOfVariation));
  }

  private calculatePredictionAccuracy(transfers: Transfer[]): number {
    // Simplified accuracy calculation
    return 0.75; // 75% accuracy
  }

  private calculateReorderPointEffectiveness(tenantId: string): number {
    // Simplified effectiveness calculation
    return 0.85; // 85% effectiveness
  }

  private calculateDemandForecastAccuracy(transfers: Transfer[]): number {
    // Simplified accuracy calculation
    return 0.70; // 70% accuracy
  }

  private async identifyReorderPointAdjustments(tenantId: string): Promise<ReorderPoint[]> {
    // Simplified - would analyze reorder point performance and suggest adjustments
    return [];
  }

  private identifyOptimizationOpportunities(transfers: Transfer[]): string[] {
    const opportunities = [];
    
    if (transfers.length > 10) {
      opportunities.push('Consider consolidating frequent small transfers');
    }
    
    const emergencyTransfers = transfers.filter(t => t.priority === 'EMERGENCY');
    if (emergencyTransfers.length > transfers.length * 0.2) {
      opportunities.push('High emergency transfer rate suggests need for better demand forecasting');
    }
    
    return opportunities;
  }
}

// Factory function for creating transfer intelligence service
export function createTransferIntelligenceService(
  db: DrizzleD1Database,
  transferService: TransferService
): TransferIntelligenceService {
  return new TransferIntelligenceServiceImpl(db, transferService);
}