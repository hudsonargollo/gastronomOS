import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, sql, inArray, gte, lte, count, sum } from 'drizzle-orm';
import { 
  transfers,
  locations,
  Transfer,
  NewTransfer,
  TransferStatus,
  TransferStatusType,
  TransferPriorityType,
  Location
} from '../db';
import { generateId } from '../utils';
import { CreateTransferRequest, TransferService } from './transfer';

// Transfer optimization interfaces
export interface RouteOptimizationRequest {
  sourceLocationId: string;
  destinationLocationIds: string[];
  productId: string;
  totalQuantity: number;
  priority: TransferPriorityType;
  requestedBy: string;
  notes?: string;
}

export interface OptimizedRoute {
  routeId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  quantity: number;
  estimatedCost: number;
  estimatedTime: number; // in hours
  priority: number; // 1 = highest priority
}

export interface RouteOptimizationResult {
  optimizedRoutes: OptimizedRoute[];
  totalCost: number;
  totalTime: number;
  costSavings: number; // compared to individual transfers
  timeSavings: number; // compared to individual transfers
}

export interface BulkTransferRequest {
  transfers: CreateTransferRequest[];
  batchId?: string;
  scheduledFor?: Date;
  priority: TransferPriorityType;
  requestedBy: string;
  notes?: string;
}

export interface BulkTransferResult {
  batchId: string;
  createdTransfers: Transfer[];
  failedTransfers: {
    request: CreateTransferRequest;
    error: string;
  }[];
  totalRequested: number;
  totalCreated: number;
  estimatedProcessingTime: number;
}

export interface TransferBatch {
  batchId: string;
  tenantId: string;
  transferIds: string[];
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  scheduledFor: Date;
  createdBy: string;
  createdAt: Date;
  processedAt?: Date;
  notes?: string;
}

export interface SchedulingRequest {
  transfers: CreateTransferRequest[];
  scheduledFor: Date;
  priority: TransferPriorityType;
  requestedBy: string;
  batchSize?: number;
  notes?: string;
}

export interface SchedulingResult {
  scheduledBatches: TransferBatch[];
  totalTransfers: number;
  estimatedCompletionTime: Date;
  resourceUtilization: {
    locationId: string;
    utilizationPercentage: number;
  }[];
}

export interface TransferOptimizationService {
  optimizeTransferRoutes(request: RouteOptimizationRequest, tenantId: string): Promise<RouteOptimizationResult>;
  createBulkTransfers(request: BulkTransferRequest, tenantId: string): Promise<BulkTransferResult>;
  scheduleTransferBatch(request: SchedulingRequest, tenantId: string): Promise<SchedulingResult>;
  getOptimizationRecommendations(locationId: string, tenantId: string): Promise<OptimizationRecommendation[]>;
  analyzeBatchPerformance(batchId: string, tenantId: string): Promise<BatchPerformanceAnalysis>;
}

export interface OptimizationRecommendation {
  type: 'CONSOLIDATE' | 'RESCHEDULE' | 'ROUTE_CHANGE' | 'PRIORITY_ADJUSTMENT';
  description: string;
  potentialSavings: {
    cost: number;
    time: number;
  };
  affectedTransfers: string[];
  confidence: number; // 0-1
}

export interface BatchPerformanceAnalysis {
  batchId: string;
  totalTransfers: number;
  completedTransfers: number;
  averageProcessingTime: number;
  costEfficiency: number;
  timeEfficiency: number;
  recommendations: OptimizationRecommendation[];
}

export class TransferOptimizationServiceImpl implements TransferOptimizationService {
  constructor(
    private db: DrizzleD1Database,
    private transferService: TransferService
  ) {}

  /**
   * Optimize transfer routes for multiple destinations
   * Requirements: 8.3, 8.4
   */
  async optimizeTransferRoutes(request: RouteOptimizationRequest, tenantId: string): Promise<RouteOptimizationResult> {
    if (!request.sourceLocationId || !request.destinationLocationIds.length || !request.productId || request.totalQuantity <= 0) {
      throw new Error('Source location, destination locations, product, and positive quantity are required');
    }

    // Validate locations exist and belong to tenant
    const sourceLocation = await this.validateLocation(request.sourceLocationId, tenantId);
    const destinationLocations = await this.validateLocations(request.destinationLocationIds, tenantId);

    // Get historical transfer data for cost and time estimation
    const historicalData = await this.getHistoricalTransferData(
      request.sourceLocationId,
      request.destinationLocationIds,
      request.productId,
      tenantId
    );

    // Calculate optimal distribution based on demand patterns
    const demandAnalysis = await this.analyzeDemandPatterns(
      request.destinationLocationIds,
      request.productId,
      tenantId
    );

    // Generate optimized routes
    const optimizedRoutes = this.calculateOptimalRoutes(
      request,
      destinationLocations,
      historicalData,
      demandAnalysis
    );

    // Calculate baseline costs for comparison
    const baselineCosts = this.calculateBaselineCosts(request, destinationLocations, historicalData);

    const totalCost = optimizedRoutes.reduce((sum, route) => sum + route.estimatedCost, 0);
    const totalTime = Math.max(...optimizedRoutes.map(route => route.estimatedTime));
    const costSavings = baselineCosts.totalCost - totalCost;
    const timeSavings = baselineCosts.totalTime - totalTime;

    return {
      optimizedRoutes,
      totalCost,
      totalTime,
      costSavings: Math.max(0, costSavings),
      timeSavings: Math.max(0, timeSavings)
    };
  }

  /**
   * Create multiple transfers in bulk with optimization
   * Requirements: 8.3, 8.4
   */
  async createBulkTransfers(request: BulkTransferRequest, tenantId: string): Promise<BulkTransferResult> {
    if (!request.transfers.length) {
      throw new Error('At least one transfer request is required');
    }

    const batchId = request.batchId || `batch_${generateId()}`;
    const createdTransfers: Transfer[] = [];
    const failedTransfers: { request: CreateTransferRequest; error: string; }[] = [];

    // Validate all requests first
    const validationResults = await this.validateBulkRequests(request.transfers, tenantId);
    
    // Group transfers by optimization criteria
    const optimizedGroups = this.groupTransfersForOptimization(request.transfers, validationResults);

    // Process each group
    for (const group of optimizedGroups) {
      try {
        // Apply route optimization if multiple destinations from same source
        const optimizedRequests = await this.optimizeTransferGroup(group, tenantId);

        // Create transfers in the optimized order
        for (const transferRequest of optimizedRequests) {
          try {
            const transfer = await this.transferService.createTransferRequest(
              transferRequest,
              tenantId,
              request.requestedBy
            );
            
            // Add batch metadata to transfer notes
            const batchNotes = `Batch: ${batchId}${transferRequest.notes ? ` | ${transferRequest.notes}` : ''}`;
            await this.transferService.updateTransfer(
              transfer.id,
              { notes: batchNotes },
              tenantId,
              request.requestedBy
            );

            createdTransfers.push(transfer);
          } catch (error) {
            failedTransfers.push({
              request: transferRequest,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      } catch (error) {
        // If group optimization fails, add all transfers in group to failed list
        for (const transferRequest of group) {
          failedTransfers.push({
            request: transferRequest,
            error: `Group optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }
    }

    // Calculate estimated processing time based on transfer complexity
    const estimatedProcessingTime = this.calculateBatchProcessingTime(createdTransfers);

    return {
      batchId,
      createdTransfers,
      failedTransfers,
      totalRequested: request.transfers.length,
      totalCreated: createdTransfers.length,
      estimatedProcessingTime
    };
  }

  /**
   * Schedule transfer batches for optimal resource utilization
   * Requirements: 8.3, 8.4
   */
  async scheduleTransferBatch(request: SchedulingRequest, tenantId: string): Promise<SchedulingResult> {
    if (!request.transfers.length || !request.scheduledFor) {
      throw new Error('Transfer requests and scheduled time are required');
    }

    const batchSize = request.batchSize || 10; // Default batch size
    const scheduledBatches: TransferBatch[] = [];

    // Analyze current resource utilization
    const resourceUtilization = await this.analyzeResourceUtilization(tenantId, request.scheduledFor);

    // Group transfers into optimal batches
    const transferBatches = this.createOptimalBatches(request.transfers, batchSize, resourceUtilization);

    // Schedule each batch with optimal timing
    let currentScheduleTime = new Date(request.scheduledFor);
    
    for (let i = 0; i < transferBatches.length; i++) {
      const batch = transferBatches[i];
      const batchId = `batch_${generateId()}`;

      // Calculate optimal schedule time for this batch
      const optimalTime = this.calculateOptimalScheduleTime(
        currentScheduleTime,
        batch,
        resourceUtilization,
        tenantId
      );

      const transferBatch: TransferBatch = {
        batchId,
        tenantId,
        transferIds: [], // Will be populated when transfers are created
        status: 'PENDING',
        scheduledFor: optimalTime,
        createdBy: request.requestedBy,
        createdAt: new Date(),
        notes: request.notes
      };

      scheduledBatches.push(transferBatch);
      
      // Update schedule time for next batch (add processing buffer)
      currentScheduleTime = new Date(optimalTime.getTime() + (30 * 60 * 1000)); // 30 minute buffer
    }

    // Calculate estimated completion time
    const lastBatch = scheduledBatches[scheduledBatches.length - 1];
    const estimatedBatchDuration = this.estimateBatchDuration(transferBatches[transferBatches.length - 1]);
    const estimatedCompletionTime = new Date(lastBatch.scheduledFor.getTime() + estimatedBatchDuration);

    return {
      scheduledBatches,
      totalTransfers: request.transfers.length,
      estimatedCompletionTime,
      resourceUtilization
    };
  }

  /**
   * Get optimization recommendations for a location
   * Requirements: 8.3, 8.5
   */
  async getOptimizationRecommendations(locationId: string, tenantId: string): Promise<OptimizationRecommendation[]> {
    if (!locationId) {
      throw new Error('Location ID is required');
    }

    // Validate location access
    await this.validateLocation(locationId, tenantId);

    const recommendations: OptimizationRecommendation[] = [];

    // Analyze pending transfers for consolidation opportunities
    const consolidationRecs = await this.analyzeConsolidationOpportunities(locationId, tenantId);
    recommendations.push(...consolidationRecs);

    // Analyze transfer timing for rescheduling opportunities
    const rescheduleRecs = await this.analyzeReschedulingOpportunities(locationId, tenantId);
    recommendations.push(...rescheduleRecs);

    // Analyze route efficiency
    const routeRecs = await this.analyzeRouteEfficiency(locationId, tenantId);
    recommendations.push(...routeRecs);

    // Analyze priority adjustments
    const priorityRecs = await this.analyzePriorityOptimization(locationId, tenantId);
    recommendations.push(...priorityRecs);

    // Sort by potential savings (highest first)
    return recommendations.sort((a, b) => 
      (b.potentialSavings.cost + b.potentialSavings.time) - 
      (a.potentialSavings.cost + a.potentialSavings.time)
    );
  }

  /**
   * Analyze batch performance for optimization insights
   * Requirements: 8.4, 8.5
   */
  async analyzeBatchPerformance(batchId: string, tenantId: string): Promise<BatchPerformanceAnalysis> {
    if (!batchId) {
      throw new Error('Batch ID is required');
    }

    // Get all transfers in the batch
    const batchTransfers = await this.getBatchTransfers(batchId, tenantId);
    
    if (!batchTransfers.length) {
      throw new Error('Batch not found or contains no transfers');
    }

    const totalTransfers = batchTransfers.length;
    const completedTransfers = batchTransfers.filter(t => 
      t.status === TransferStatus.RECEIVED || t.status === TransferStatus.CANCELLED
    ).length;

    // Calculate average processing time
    const processingTimes = batchTransfers
      .filter(t => t.receivedAt && t.createdAt)
      .map(t => (t.receivedAt! - t.createdAt) / (1000 * 60 * 60)); // Convert to hours

    const averageProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;

    // Calculate efficiency metrics
    const costEfficiency = await this.calculateBatchCostEfficiency(batchTransfers);
    const timeEfficiency = await this.calculateBatchTimeEfficiency(batchTransfers);

    // Generate recommendations for future batches
    const recommendations = await this.generateBatchRecommendations(batchTransfers, tenantId);

    return {
      batchId,
      totalTransfers,
      completedTransfers,
      averageProcessingTime,
      costEfficiency,
      timeEfficiency,
      recommendations
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

  private async validateLocations(locationIds: string[], tenantId: string): Promise<Location[]> {
    const locationResults = await this.db
      .select()
      .from(locations)
      .where(and(
        inArray(locations.id, locationIds),
        eq(locations.tenantId, tenantId)
      ));

    if (locationResults.length !== locationIds.length) {
      throw new Error('One or more locations not found in this organization');
    }

    return locationResults;
  }

  private async getHistoricalTransferData(
    sourceLocationId: string,
    destinationLocationIds: string[],
    productId: string,
    tenantId: string
  ) {
    // Get historical transfer data for cost and time estimation
    const historicalTransfers = await this.db
      .select()
      .from(transfers)
      .where(and(
        eq(transfers.tenantId, tenantId),
        eq(transfers.sourceLocationId, sourceLocationId),
        inArray(transfers.destinationLocationId, destinationLocationIds),
        eq(transfers.productId, productId),
        eq(transfers.status, TransferStatus.RECEIVED)
      ))
      .orderBy(desc(transfers.receivedAt))
      .limit(100);

    return historicalTransfers.map(transfer => ({
      destinationLocationId: transfer.destinationLocationId,
      quantity: transfer.quantityReceived || 0,
      processingTime: transfer.receivedAt && transfer.createdAt 
        ? (transfer.receivedAt - transfer.createdAt) / (1000 * 60 * 60) // hours
        : 24, // default 24 hours
      estimatedCost: this.estimateTransferCost(transfer.quantityReceived || 0, transfer.sourceLocationId, transfer.destinationLocationId)
    }));
  }

  private async analyzeDemandPatterns(
    destinationLocationIds: string[],
    productId: string,
    tenantId: string
  ) {
    // Analyze recent transfer patterns to understand demand
    const recentTransfers = await this.db
      .select({
        destinationLocationId: transfers.destinationLocationId,
        totalQuantity: sum(transfers.quantityReceived),
        transferCount: count(transfers.id)
      })
      .from(transfers)
      .where(and(
        eq(transfers.tenantId, tenantId),
        inArray(transfers.destinationLocationId, destinationLocationIds),
        eq(transfers.productId, productId),
        eq(transfers.status, TransferStatus.RECEIVED),
        gte(transfers.receivedAt, Date.now() - (30 * 24 * 60 * 60 * 1000)) // Last 30 days
      ))
      .groupBy(transfers.destinationLocationId);

    return recentTransfers.map(data => ({
      destinationLocationId: data.destinationLocationId,
      averageQuantity: data.totalQuantity ? Number(data.totalQuantity) / Number(data.transferCount) : 0,
      frequency: Number(data.transferCount),
      demandScore: Number(data.totalQuantity) * Number(data.transferCount) // Simple demand scoring
    }));
  }

  private calculateOptimalRoutes(
    request: RouteOptimizationRequest,
    destinationLocations: Location[],
    historicalData: any[],
    demandAnalysis: any[]
  ): OptimizedRoute[] {
    const routes: OptimizedRoute[] = [];
    let remainingQuantity = request.totalQuantity;

    // Sort destinations by demand score (highest first)
    const sortedDestinations = destinationLocations
      .map(location => {
        const demand = demandAnalysis.find(d => d.destinationLocationId === location.id);
        const historical = historicalData.filter(h => h.destinationLocationId === location.id);
        
        return {
          location,
          demandScore: demand?.demandScore || 0,
          averageQuantity: demand?.averageQuantity || 0,
          averageProcessingTime: historical.length > 0 
            ? historical.reduce((sum, h) => sum + h.processingTime, 0) / historical.length
            : 24,
          averageCost: historical.length > 0
            ? historical.reduce((sum, h) => sum + h.estimatedCost, 0) / historical.length
            : this.estimateTransferCost(100, request.sourceLocationId, location.id)
        };
      })
      .sort((a, b) => b.demandScore - a.demandScore);

    // Distribute quantity based on demand and efficiency
    for (let i = 0; i < sortedDestinations.length && remainingQuantity > 0; i++) {
      const dest = sortedDestinations[i];
      
      // Calculate optimal quantity for this destination
      const totalDemand = sortedDestinations.reduce((sum, d) => sum + d.demandScore, 0);
      const demandRatio = totalDemand > 0 ? dest.demandScore / totalDemand : 1 / sortedDestinations.length;
      
      let quantity = Math.floor(request.totalQuantity * demandRatio);
      
      // Ensure we don't exceed remaining quantity
      quantity = Math.min(quantity, remainingQuantity);
      
      // Ensure minimum quantity of 1 if there's remaining quantity
      if (quantity === 0 && remainingQuantity > 0) {
        quantity = 1;
      }

      if (quantity > 0) {
        routes.push({
          routeId: `route_${generateId()}`,
          sourceLocationId: request.sourceLocationId,
          destinationLocationId: dest.location.id,
          quantity,
          estimatedCost: dest.averageCost * (quantity / 100), // Scale cost by quantity
          estimatedTime: dest.averageProcessingTime,
          priority: i + 1 // Priority based on demand score
        });

        remainingQuantity -= quantity;
      }
    }

    // If there's still remaining quantity, distribute it to the highest priority routes
    while (remainingQuantity > 0 && routes.length > 0) {
      const highestPriorityRoute = routes.find(r => r.priority === 1);
      if (highestPriorityRoute) {
        highestPriorityRoute.quantity += 1;
        remainingQuantity -= 1;
      } else {
        break;
      }
    }

    return routes;
  }

  private calculateBaselineCosts(
    request: RouteOptimizationRequest,
    destinationLocations: Location[],
    historicalData: any[]
  ) {
    // Calculate costs if transfers were done individually without optimization
    const equalQuantity = Math.floor(request.totalQuantity / destinationLocations.length);
    let totalCost = 0;
    let totalTime = 0;

    for (const location of destinationLocations) {
      const historical = historicalData.filter(h => h.destinationLocationId === location.id);
      const avgCost = historical.length > 0
        ? historical.reduce((sum, h) => sum + h.estimatedCost, 0) / historical.length
        : this.estimateTransferCost(equalQuantity, request.sourceLocationId, location.id);
      const avgTime = historical.length > 0
        ? historical.reduce((sum, h) => sum + h.processingTime, 0) / historical.length
        : 24;

      totalCost += avgCost;
      totalTime = Math.max(totalTime, avgTime); // Parallel processing
    }

    return { totalCost, totalTime };
  }

  private estimateTransferCost(quantity: number, sourceLocationId: string, destinationLocationId: string): number {
    // Simple cost estimation based on quantity and distance
    // In a real implementation, this would consider actual shipping costs, fuel, labor, etc.
    const baseCost = 10; // Base cost per transfer
    const quantityCost = quantity * 0.5; // Cost per unit
    const distanceFactor = 1.2; // Simplified distance factor
    
    return baseCost + quantityCost * distanceFactor;
  }

  private async validateBulkRequests(requests: CreateTransferRequest[], tenantId: string) {
    // Validate each request and return validation results
    const results = [];
    
    for (const request of requests) {
      try {
        // Basic validation
        if (!request.productId || !request.sourceLocationId || !request.destinationLocationId || request.quantityRequested <= 0) {
          results.push({ request, valid: false, error: 'Missing required fields or invalid quantity' });
          continue;
        }

        if (request.sourceLocationId === request.destinationLocationId) {
          results.push({ request, valid: false, error: 'Source and destination cannot be the same' });
          continue;
        }

        // Validate entities exist (simplified - in real implementation would batch these queries)
        results.push({ request, valid: true, error: null });
      } catch (error) {
        results.push({ 
          request, 
          valid: false, 
          error: error instanceof Error ? error.message : 'Validation failed' 
        });
      }
    }

    return results;
  }

  private groupTransfersForOptimization(
    requests: CreateTransferRequest[],
    validationResults: any[]
  ): CreateTransferRequest[][] {
    // Group transfers by source location and product for optimization
    const groups = new Map<string, CreateTransferRequest[]>();

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      const validation = validationResults[i];

      if (!validation.valid) continue;

      const groupKey = `${request.sourceLocationId}_${request.productId}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(request);
    }

    return Array.from(groups.values());
  }

  private async optimizeTransferGroup(group: CreateTransferRequest[], tenantId: string): Promise<CreateTransferRequest[]> {
    if (group.length <= 1) {
      return group;
    }

    // For groups with the same source and product, optimize by consolidating similar destinations
    const sourceLocationId = group[0].sourceLocationId;
    const productId = group[0].productId;
    
    // Group by destination and sum quantities
    const destinationGroups = new Map<string, CreateTransferRequest[]>();
    
    for (const request of group) {
      if (!destinationGroups.has(request.destinationLocationId)) {
        destinationGroups.set(request.destinationLocationId, []);
      }
      destinationGroups.get(request.destinationLocationId)!.push(request);
    }

    // Consolidate transfers to the same destination
    const optimizedRequests: CreateTransferRequest[] = [];
    
    for (const [destinationId, requests] of destinationGroups) {
      if (requests.length === 1) {
        optimizedRequests.push(requests[0]);
      } else {
        // Consolidate multiple requests to same destination
        const totalQuantity = requests.reduce((sum, req) => sum + req.quantityRequested, 0);
        const highestPriority = requests.reduce((highest, req) => 
          req.priority === 'EMERGENCY' ? 'EMERGENCY' : 
          req.priority === 'HIGH' || highest === 'HIGH' ? 'HIGH' : 'NORMAL'
        , 'NORMAL' as TransferPriorityType);

        const consolidatedNotes = requests
          .map(req => req.notes)
          .filter(note => note)
          .join('; ');

        optimizedRequests.push({
          productId,
          sourceLocationId,
          destinationLocationId: destinationId,
          quantityRequested: totalQuantity,
          priority: highestPriority,
          notes: consolidatedNotes || `Consolidated from ${requests.length} transfers`,
          reasonCode: 'BULK_OPTIMIZATION'
        });
      }
    }

    return optimizedRequests;
  }

  private calculateBatchProcessingTime(transfers: Transfer[]): number {
    // Estimate processing time based on transfer complexity
    const baseTimePerTransfer = 2; // 2 hours base processing time
    const complexityFactor = transfers.length > 10 ? 1.5 : 1.0; // More complex for larger batches
    const priorityFactor = transfers.some(t => t.priority === 'EMERGENCY') ? 0.5 : 1.0; // Faster for emergency
    
    return transfers.length * baseTimePerTransfer * complexityFactor * priorityFactor;
  }

  private async analyzeResourceUtilization(tenantId: string, scheduledTime: Date) {
    // Analyze current resource utilization around the scheduled time
    const timeWindow = 4 * 60 * 60 * 1000; // 4 hour window
    const startTime = new Date(scheduledTime.getTime() - timeWindow);
    const endTime = new Date(scheduledTime.getTime() + timeWindow);

    // Get all locations for the tenant
    const tenantLocations = await this.db
      .select()
      .from(locations)
      .where(eq(locations.tenantId, tenantId));

    const utilization = [];

    for (const location of tenantLocations) {
      // Count active transfers in the time window
      const [activeTransfers] = await this.db
        .select({ count: count(transfers.id) })
        .from(transfers)
        .where(and(
          eq(transfers.tenantId, tenantId),
          sql`(${transfers.sourceLocationId} = ${location.id} OR ${transfers.destinationLocationId} = ${location.id})`,
          inArray(transfers.status, [TransferStatus.APPROVED, TransferStatus.SHIPPED]),
          gte(transfers.createdAt, startTime.getTime()),
          lte(transfers.createdAt, endTime.getTime())
        ));

      // Simple utilization calculation (in real implementation would consider capacity)
      const maxCapacity = 20; // Assume max 20 concurrent transfers per location
      const utilizationPercentage = Math.min(100, (Number(activeTransfers.count) / maxCapacity) * 100);

      utilization.push({
        locationId: location.id,
        utilizationPercentage
      });
    }

    return utilization;
  }

  private createOptimalBatches(
    transfers: CreateTransferRequest[],
    batchSize: number,
    resourceUtilization: { locationId: string; utilizationPercentage: number; }[]
  ): CreateTransferRequest[][] {
    // Sort transfers by priority and resource utilization
    const sortedTransfers = transfers.sort((a, b) => {
      // Priority order: EMERGENCY > HIGH > NORMAL
      const priorityOrder: Record<string, number> = { EMERGENCY: 3, HIGH: 2, NORMAL: 1 };
      const aPriority = priorityOrder[a.priority] || 1;
      const bPriority = priorityOrder[b.priority] || 1;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      // Secondary sort by source location utilization (lower utilization first)
      const aUtilization = resourceUtilization.find(u => u.locationId === a.sourceLocationId)?.utilizationPercentage || 0;
      const bUtilization = resourceUtilization.find(u => u.locationId === b.sourceLocationId)?.utilizationPercentage || 0;
      
      return aUtilization - bUtilization;
    });

    // Create batches
    const batches: CreateTransferRequest[][] = [];
    for (let i = 0; i < sortedTransfers.length; i += batchSize) {
      batches.push(sortedTransfers.slice(i, i + batchSize));
    }

    return batches;
  }

  private calculateOptimalScheduleTime(
    baseTime: Date,
    batch: CreateTransferRequest[],
    resourceUtilization: { locationId: string; utilizationPercentage: number; }[],
    tenantId: string
  ): Date {
    // Find the location with highest utilization in this batch
    const maxUtilization = Math.max(...batch.map(transfer => 
      resourceUtilization.find(u => u.locationId === transfer.sourceLocationId)?.utilizationPercentage || 0
    ));

    // Delay scheduling if utilization is too high
    let delay = 0;
    if (maxUtilization > 80) {
      delay = 2 * 60 * 60 * 1000; // 2 hour delay for high utilization
    } else if (maxUtilization > 60) {
      delay = 1 * 60 * 60 * 1000; // 1 hour delay for medium utilization
    }

    return new Date(baseTime.getTime() + delay);
  }

  private estimateBatchDuration(batch: CreateTransferRequest[]): number {
    // Estimate how long a batch will take to complete
    const baseTimePerTransfer = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
    const parallelismFactor = 0.7; // Assume 70% can be processed in parallel
    
    return batch.length * baseTimePerTransfer * parallelismFactor;
  }

  private async analyzeConsolidationOpportunities(locationId: string, tenantId: string): Promise<OptimizationRecommendation[]> {
    // Find transfers that could be consolidated
    const pendingTransfers = await this.db
      .select()
      .from(transfers)
      .where(and(
        eq(transfers.tenantId, tenantId),
        eq(transfers.sourceLocationId, locationId),
        inArray(transfers.status, [TransferStatus.REQUESTED, TransferStatus.APPROVED])
      ));

    const recommendations: OptimizationRecommendation[] = [];
    
    // Group by destination and product
    const groups = new Map<string, Transfer[]>();
    for (const transfer of pendingTransfers) {
      const key = `${transfer.destinationLocationId}_${transfer.productId}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(transfer);
    }

    // Find groups with multiple transfers that could be consolidated
    for (const [key, groupTransfers] of groups) {
      if (groupTransfers.length > 1) {
        const totalQuantity = groupTransfers.reduce((sum, t) => sum + t.quantityRequested, 0);
        const estimatedSavings = groupTransfers.length * 5; // $5 savings per consolidated transfer
        
        recommendations.push({
          type: 'CONSOLIDATE',
          description: `Consolidate ${groupTransfers.length} transfers to same destination for same product`,
          potentialSavings: {
            cost: estimatedSavings,
            time: groupTransfers.length * 0.5 // 30 minutes saved per transfer
          },
          affectedTransfers: groupTransfers.map(t => t.id),
          confidence: 0.8
        });
      }
    }

    return recommendations;
  }

  private async analyzeReschedulingOpportunities(locationId: string, tenantId: string): Promise<OptimizationRecommendation[]> {
    // Analyze if transfers could be rescheduled for better efficiency
    // This is a simplified implementation
    return [];
  }

  private async analyzeRouteEfficiency(locationId: string, tenantId: string): Promise<OptimizationRecommendation[]> {
    // Analyze if there are more efficient routes
    // This is a simplified implementation
    return [];
  }

  private async analyzePriorityOptimization(locationId: string, tenantId: string): Promise<OptimizationRecommendation[]> {
    // Analyze if priority adjustments could improve efficiency
    // This is a simplified implementation
    return [];
  }

  private async getBatchTransfers(batchId: string, tenantId: string): Promise<Transfer[]> {
    // Get transfers that belong to a specific batch
    // In a real implementation, this would use a proper batch tracking table
    return await this.db
      .select()
      .from(transfers)
      .where(and(
        eq(transfers.tenantId, tenantId),
        sql`${transfers.notes} LIKE ${'%Batch: ' + batchId + '%'}`
      ));
  }

  private async calculateBatchCostEfficiency(transfers: Transfer[]): Promise<number> {
    // Calculate cost efficiency compared to individual transfers
    // This is a simplified calculation
    return 0.85; // 85% efficiency (15% savings)
  }

  private async calculateBatchTimeEfficiency(transfers: Transfer[]): Promise<number> {
    // Calculate time efficiency compared to individual transfers
    // This is a simplified calculation
    return 0.75; // 75% efficiency (25% time savings)
  }

  private async generateBatchRecommendations(transfers: Transfer[], tenantId: string): Promise<OptimizationRecommendation[]> {
    // Generate recommendations based on batch performance
    // This is a simplified implementation
    return [];
  }
}

// Factory function for creating transfer optimization service
export function createTransferOptimizationService(
  db: DrizzleD1Database,
  transferService: TransferService
): TransferOptimizationService {
  return new TransferOptimizationServiceImpl(db, transferService);
}