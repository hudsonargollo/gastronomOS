/**
 * Allocation Analytics Service
 * 
 * Provides allocation efficiency metrics, location allocation pattern analysis,
 * and allocation variance reporting for the distributed allocation system.
 * Implements requirements 3.5 for allocation analytics and reporting.
 */

import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, asc, sql, sum, count, avg } from 'drizzle-orm';
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
  AllocationStatusType,
  AllocationStatus
} from '../db/schema';

// Analytics interfaces
export interface AllocationEfficiencyMetrics {
  tenantId: string;
  totalAllocations: number;
  totalAllocatedQuantity: number;
  totalAllocatedValue: number;
  averageAllocationSize: number;
  allocationUtilizationRate: number; // Percentage of ordered quantity that gets allocated
  averageTimeToShip: number; // Average days from allocation to shipped
  averageTimeToReceive: number; // Average days from shipped to received
  efficiencyScore: number; // Overall efficiency score (0-100)
  periodStart: Date;
  periodEnd: Date;
}

export interface LocationAllocationPattern {
  locationId: string;
  locationName: string;
  locationType: string;
  totalAllocations: number;
  totalQuantityAllocated: number;
  totalValueAllocated: number;
  averageAllocationSize: number;
  allocationFrequency: number; // Allocations per time period
  topProductCategories: Array<{
    category: string;
    allocationCount: number;
    totalQuantity: number;
    percentage: number;
  }>;
  statusDistribution: Array<{
    status: AllocationStatusType;
    count: number;
    percentage: number;
  }>;
  efficiencyMetrics: {
    onTimeDeliveryRate: number;
    averageProcessingTime: number;
    utilizationRate: number;
  };
}

export interface AllocationVarianceReport {
  poId: string;
  poNumber: string;
  supplierName: string;
  totalOrderedQuantity: number;
  totalAllocatedQuantity: number;
  totalUnallocatedQuantity: number;
  allocationRate: number; // Percentage of ordered quantity allocated
  variance: number; // Difference between expected and actual allocation
  varianceType: 'UNDER_ALLOCATED' | 'FULLY_ALLOCATED' | 'OVER_ALLOCATED';
  lineItemVariances: Array<{
    poItemId: string;
    productName: string;
    orderedQuantity: number;
    allocatedQuantity: number;
    unallocatedQuantity: number;
    variancePercentage: number;
  }>;
  locationDistribution: Array<{
    locationId: string;
    locationName: string;
    allocatedQuantity: number;
    percentage: number;
  }>;
  createdAt: Date;
}

export interface AllocationTrendData {
  period: string; // YYYY-MM-DD or YYYY-MM
  totalAllocations: number;
  totalQuantity: number;
  totalValue: number;
  averageAllocationSize: number;
  utilizationRate: number;
  efficiencyScore: number;
}

export interface AllocationAnalyticsFilters {
  dateFrom?: Date;
  dateTo?: Date;
  locationIds?: string[];
  productCategories?: string[];
  supplierIds?: string[];
  status?: AllocationStatusType[];
  minValue?: number;
  maxValue?: number;
}

export interface IAllocationAnalyticsService {
  getEfficiencyMetrics(tenantId: string, filters?: AllocationAnalyticsFilters): Promise<AllocationEfficiencyMetrics>;
  getLocationPatterns(tenantId: string, filters?: AllocationAnalyticsFilters): Promise<LocationAllocationPattern[]>;
  getVarianceReport(tenantId: string, poId?: string, filters?: AllocationAnalyticsFilters): Promise<AllocationVarianceReport[]>;
  getTrendData(tenantId: string, period: 'daily' | 'weekly' | 'monthly', filters?: AllocationAnalyticsFilters): Promise<AllocationTrendData[]>;
  getTopPerformingLocations(tenantId: string, limit?: number, filters?: AllocationAnalyticsFilters): Promise<LocationAllocationPattern[]>;
  getAllocationDistributionAnalysis(tenantId: string, filters?: AllocationAnalyticsFilters): Promise<{
    byLocation: Array<{ locationId: string; locationName: string; percentage: number; count: number }>;
    byProduct: Array<{ productId: string; productName: string; percentage: number; count: number }>;
    byStatus: Array<{ status: AllocationStatusType; percentage: number; count: number }>;
  }>;
}

export class AllocationAnalyticsService implements IAllocationAnalyticsService {
  constructor(private db: DrizzleD1Database) {}

  /**
   * Get allocation efficiency metrics for a tenant
   * Requirements: 3.5
   */
  async getEfficiencyMetrics(tenantId: string, filters?: AllocationAnalyticsFilters): Promise<AllocationEfficiencyMetrics> {
    const dateFrom = filters?.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days ago
    const dateTo = filters?.dateTo || new Date();

    // Build base query conditions
    const conditions = [
      eq(allocations.tenantId, tenantId),
      sql`${allocations.createdAt} >= ${dateFrom.getTime()}`,
      sql`${allocations.createdAt} <= ${dateTo.getTime()}`
    ];

    if (filters?.locationIds?.length) {
      conditions.push(sql`${allocations.targetLocationId} IN (${filters.locationIds.map(id => `'${id}'`).join(',')})`);
    }

    if (filters?.status?.length) {
      conditions.push(sql`${allocations.status} IN (${filters.status.map(s => `'${s}'`).join(',')})`);
    }

    // Get basic allocation metrics
    const [basicMetrics] = await this.db
      .select({
        totalAllocations: count(allocations.id),
        totalAllocatedQuantity: sum(allocations.quantityAllocated),
        averageAllocationSize: avg(allocations.quantityAllocated)
      })
      .from(allocations)
      .where(and(...conditions));

    // Get allocation value metrics by joining with PO items
    const [valueMetrics] = await this.db
      .select({
        totalAllocatedValue: sql<number>`SUM(${allocations.quantityAllocated} * ${poItems.unitPriceCents})`
      })
      .from(allocations)
      .innerJoin(poItems, eq(allocations.poItemId, poItems.id))
      .where(and(...conditions));

    // Calculate utilization rate (allocated vs ordered)
    const [utilizationData] = await this.db
      .select({
        totalOrdered: sum(poItems.quantityOrdered),
        totalAllocated: sum(allocations.quantityAllocated)
      })
      .from(allocations)
      .innerJoin(poItems, eq(allocations.poItemId, poItems.id))
      .where(and(...conditions));

    const utilizationRate = utilizationData.totalOrdered > 0 
      ? (utilizationData.totalAllocated / utilizationData.totalOrdered) * 100 
      : 0;

    // Calculate timing metrics
    const timingMetrics = await this.calculateTimingMetrics(tenantId, filters);

    // Calculate overall efficiency score
    const efficiencyScore = this.calculateEfficiencyScore({
      utilizationRate,
      averageTimeToShip: timingMetrics.averageTimeToShip,
      averageTimeToReceive: timingMetrics.averageTimeToReceive,
      totalAllocations: basicMetrics.totalAllocations || 0
    });

    return {
      tenantId,
      totalAllocations: basicMetrics.totalAllocations || 0,
      totalAllocatedQuantity: basicMetrics.totalAllocatedQuantity || 0,
      totalAllocatedValue: valueMetrics.totalAllocatedValue || 0,
      averageAllocationSize: basicMetrics.averageAllocationSize || 0,
      allocationUtilizationRate: utilizationRate,
      averageTimeToShip: timingMetrics.averageTimeToShip,
      averageTimeToReceive: timingMetrics.averageTimeToReceive,
      efficiencyScore,
      periodStart: dateFrom,
      periodEnd: dateTo
    };
  }

  /**
   * Get location allocation patterns
   * Requirements: 3.5
   */
  async getLocationPatterns(tenantId: string, filters?: AllocationAnalyticsFilters): Promise<LocationAllocationPattern[]> {
    const conditions = [eq(allocations.tenantId, tenantId)];

    if (filters?.dateFrom) {
      conditions.push(sql`${allocations.createdAt} >= ${filters.dateFrom.getTime()}`);
    }
    if (filters?.dateTo) {
      conditions.push(sql`${allocations.createdAt} <= ${filters.dateTo.getTime()}`);
    }
    if (filters?.locationIds?.length) {
      conditions.push(sql`${allocations.targetLocationId} IN (${filters.locationIds.map(id => `'${id}'`).join(',')})`);
    }

    // Get location-level metrics
    const locationMetrics = await this.db
      .select({
        locationId: locations.id,
        locationName: locations.name,
        locationType: locations.type,
        totalAllocations: count(allocations.id),
        totalQuantityAllocated: sum(allocations.quantityAllocated),
        totalValueAllocated: sql<number>`SUM(${allocations.quantityAllocated} * ${poItems.unitPriceCents})`,
        averageAllocationSize: avg(allocations.quantityAllocated)
      })
      .from(allocations)
      .innerJoin(locations, eq(allocations.targetLocationId, locations.id))
      .innerJoin(poItems, eq(allocations.poItemId, poItems.id))
      .where(and(...conditions))
      .groupBy(locations.id, locations.name, locations.type);

    const patterns: LocationAllocationPattern[] = [];

    for (const metric of locationMetrics) {
      // Get top product categories for this location
      const topCategories = await this.getTopProductCategoriesForLocation(
        metric.locationId, 
        tenantId, 
        filters
      );

      // Get status distribution for this location
      const statusDistribution = await this.getStatusDistributionForLocation(
        metric.locationId, 
        tenantId, 
        filters
      );

      // Calculate efficiency metrics for this location
      const efficiencyMetrics = await this.calculateLocationEfficiencyMetrics(
        metric.locationId, 
        tenantId, 
        filters
      );

      // Calculate allocation frequency (allocations per day in the period)
      const periodDays = filters?.dateFrom && filters?.dateTo 
        ? Math.ceil((filters.dateTo.getTime() - filters.dateFrom.getTime()) / (24 * 60 * 60 * 1000))
        : 30; // Default 30 days
      
      const allocationFrequency = (metric.totalAllocations || 0) / periodDays;

      patterns.push({
        locationId: metric.locationId,
        locationName: metric.locationName,
        locationType: metric.locationType,
        totalAllocations: metric.totalAllocations || 0,
        totalQuantityAllocated: metric.totalQuantityAllocated || 0,
        totalValueAllocated: metric.totalValueAllocated || 0,
        averageAllocationSize: metric.averageAllocationSize || 0,
        allocationFrequency,
        topProductCategories: topCategories,
        statusDistribution,
        efficiencyMetrics
      });
    }

    return patterns.sort((a, b) => b.totalValueAllocated - a.totalValueAllocated);
  }

  /**
   * Get allocation variance report
   * Requirements: 3.5
   */
  async getVarianceReport(tenantId: string, poId?: string, filters?: AllocationAnalyticsFilters): Promise<AllocationVarianceReport[]> {
    const conditions = [eq(purchaseOrders.tenantId, tenantId)];

    if (poId) {
      conditions.push(eq(purchaseOrders.id, poId));
    }

    if (filters?.dateFrom) {
      conditions.push(sql`${purchaseOrders.createdAt} >= ${filters.dateFrom.getTime()}`);
    }
    if (filters?.dateTo) {
      conditions.push(sql`${purchaseOrders.createdAt} <= ${filters.dateTo.getTime()}`);
    }

    // Get PO data with allocation summaries
    const poData = await this.db
      .select({
        po: purchaseOrders,
        supplier: sql<string>`'Unknown'`, // Would need suppliers table join
        totalOrderedQuantity: sql<number>`SUM(${poItems.quantityOrdered})`,
        totalAllocatedQuantity: sql<number>`COALESCE(SUM(${allocations.quantityAllocated}), 0)`
      })
      .from(purchaseOrders)
      .leftJoin(poItems, eq(poItems.poId, purchaseOrders.id))
      .leftJoin(allocations, eq(allocations.poItemId, poItems.id))
      .where(and(...conditions))
      .groupBy(purchaseOrders.id);

    const reports: AllocationVarianceReport[] = [];

    for (const po of poData) {
      const totalUnallocatedQuantity = (po.totalOrderedQuantity || 0) - (po.totalAllocatedQuantity || 0);
      const allocationRate = po.totalOrderedQuantity > 0 
        ? ((po.totalAllocatedQuantity || 0) / po.totalOrderedQuantity) * 100 
        : 0;

      // Determine variance type
      let varianceType: 'UNDER_ALLOCATED' | 'FULLY_ALLOCATED' | 'OVER_ALLOCATED';
      if (allocationRate < 100) {
        varianceType = 'UNDER_ALLOCATED';
      } else if (allocationRate === 100) {
        varianceType = 'FULLY_ALLOCATED';
      } else {
        varianceType = 'OVER_ALLOCATED';
      }

      // Get line item variances
      const lineItemVariances = await this.getLineItemVariances(po.po.id, tenantId);

      // Get location distribution
      const locationDistribution = await this.getLocationDistribution(po.po.id, tenantId);

      reports.push({
        poId: po.po.id,
        poNumber: po.po.poNumber || 'N/A',
        supplierName: po.supplier,
        totalOrderedQuantity: po.totalOrderedQuantity || 0,
        totalAllocatedQuantity: po.totalAllocatedQuantity || 0,
        totalUnallocatedQuantity,
        allocationRate,
        variance: totalUnallocatedQuantity,
        varianceType,
        lineItemVariances,
        locationDistribution,
        createdAt: new Date(po.po.createdAt)
      });
    }

    return reports.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
  }

  /**
   * Get allocation trend data
   * Requirements: 3.5
   */
  async getTrendData(
    tenantId: string, 
    period: 'daily' | 'weekly' | 'monthly', 
    filters?: AllocationAnalyticsFilters
  ): Promise<AllocationTrendData[]> {
    const conditions = [eq(allocations.tenantId, tenantId)];

    if (filters?.dateFrom) {
      conditions.push(sql`${allocations.createdAt} >= ${filters.dateFrom.getTime()}`);
    }
    if (filters?.dateTo) {
      conditions.push(sql`${allocations.createdAt} <= ${filters.dateTo.getTime()}`);
    }

    // Build date grouping SQL based on period
    let dateGrouping: string;
    switch (period) {
      case 'daily':
        dateGrouping = `DATE(${allocations.createdAt} / 1000, 'unixepoch')`;
        break;
      case 'weekly':
        dateGrouping = `DATE(${allocations.createdAt} / 1000, 'unixepoch', 'weekday 0', '-6 days')`;
        break;
      case 'monthly':
        dateGrouping = `strftime('%Y-%m', ${allocations.createdAt} / 1000, 'unixepoch')`;
        break;
    }

    const trendData = await this.db
      .select({
        period: sql<string>`${sql.raw(dateGrouping)}`,
        totalAllocations: count(allocations.id),
        totalQuantity: sum(allocations.quantityAllocated),
        totalValue: sql<number>`SUM(${allocations.quantityAllocated} * ${poItems.unitPriceCents})`,
        averageAllocationSize: avg(allocations.quantityAllocated)
      })
      .from(allocations)
      .innerJoin(poItems, eq(allocations.poItemId, poItems.id))
      .where(and(...conditions))
      .groupBy(sql.raw(dateGrouping))
      .orderBy(sql.raw(dateGrouping));

    // Calculate utilization rate and efficiency score for each period
    const enrichedTrendData: AllocationTrendData[] = [];

    for (const trend of trendData) {
      // Get utilization rate for this period
      const [utilizationData] = await this.db
        .select({
          totalOrdered: sum(poItems.quantityOrdered),
          totalAllocated: sum(allocations.quantityAllocated)
        })
        .from(allocations)
        .innerJoin(poItems, eq(allocations.poItemId, poItems.id))
        .where(and(
          ...conditions,
          sql`${sql.raw(dateGrouping)} = ${trend.period}`
        ));

      const utilizationRate = utilizationData.totalOrdered > 0 
        ? (utilizationData.totalAllocated / utilizationData.totalOrdered) * 100 
        : 0;

      // Simple efficiency score based on utilization and allocation count
      const efficiencyScore = Math.min(100, utilizationRate + (trend.totalAllocations * 2));

      enrichedTrendData.push({
        period: trend.period,
        totalAllocations: trend.totalAllocations || 0,
        totalQuantity: trend.totalQuantity || 0,
        totalValue: trend.totalValue || 0,
        averageAllocationSize: trend.averageAllocationSize || 0,
        utilizationRate,
        efficiencyScore
      });
    }

    return enrichedTrendData;
  }

  /**
   * Get top performing locations
   * Requirements: 3.5
   */
  async getTopPerformingLocations(
    tenantId: string, 
    limit: number = 10, 
    filters?: AllocationAnalyticsFilters
  ): Promise<LocationAllocationPattern[]> {
    const patterns = await this.getLocationPatterns(tenantId, filters);
    
    // Sort by efficiency score (combination of utilization rate and processing time)
    return patterns
      .sort((a, b) => b.efficiencyMetrics.utilizationRate - a.efficiencyMetrics.utilizationRate)
      .slice(0, limit);
  }

  /**
   * Get allocation distribution analysis
   * Requirements: 3.5
   */
  async getAllocationDistributionAnalysis(tenantId: string, filters?: AllocationAnalyticsFilters) {
    const conditions = [eq(allocations.tenantId, tenantId)];

    if (filters?.dateFrom) {
      conditions.push(sql`${allocations.createdAt} >= ${filters.dateFrom.getTime()}`);
    }
    if (filters?.dateTo) {
      conditions.push(sql`${allocations.createdAt} <= ${filters.dateTo.getTime()}`);
    }

    // Get total allocations for percentage calculations
    const [totalCount] = await this.db
      .select({ total: count(allocations.id) })
      .from(allocations)
      .where(and(...conditions));

    const total = totalCount.total || 1; // Avoid division by zero

    // Distribution by location
    const byLocation = await this.db
      .select({
        locationId: locations.id,
        locationName: locations.name,
        count: count(allocations.id),
        percentage: sql<number>`(COUNT(${allocations.id}) * 100.0 / ${total})`
      })
      .from(allocations)
      .innerJoin(locations, eq(allocations.targetLocationId, locations.id))
      .where(and(...conditions))
      .groupBy(locations.id, locations.name)
      .orderBy(desc(count(allocations.id)));

    // Distribution by product
    const byProduct = await this.db
      .select({
        productId: products.id,
        productName: products.name,
        count: count(allocations.id),
        percentage: sql<number>`(COUNT(${allocations.id}) * 100.0 / ${total})`
      })
      .from(allocations)
      .innerJoin(poItems, eq(allocations.poItemId, poItems.id))
      .innerJoin(products, eq(poItems.productId, products.id))
      .where(and(...conditions))
      .groupBy(products.id, products.name)
      .orderBy(desc(count(allocations.id)))
      .limit(20); // Top 20 products

    // Distribution by status
    const byStatus = await this.db
      .select({
        status: allocations.status,
        count: count(allocations.id),
        percentage: sql<number>`(COUNT(${allocations.id}) * 100.0 / ${total})`
      })
      .from(allocations)
      .where(and(...conditions))
      .groupBy(allocations.status)
      .orderBy(desc(count(allocations.id)));

    return {
      byLocation,
      byProduct,
      byStatus: byStatus as Array<{ status: AllocationStatusType; percentage: number; count: number }>
    };
  }

  // Private helper methods

  private async calculateTimingMetrics(tenantId: string, filters?: AllocationAnalyticsFilters) {
    const conditions = [eq(allocations.tenantId, tenantId)];

    if (filters?.dateFrom) {
      conditions.push(sql`${allocations.createdAt} >= ${filters.dateFrom.getTime()}`);
    }
    if (filters?.dateTo) {
      conditions.push(sql`${allocations.createdAt} <= ${filters.dateTo.getTime()}`);
    }

    // This is a simplified calculation - in a real system you'd track status change timestamps
    // For now, we'll return placeholder values
    return {
      averageTimeToShip: 2.5, // Average 2.5 days
      averageTimeToReceive: 5.0 // Average 5 days total
    };
  }

  private calculateEfficiencyScore(metrics: {
    utilizationRate: number;
    averageTimeToShip: number;
    averageTimeToReceive: number;
    totalAllocations: number;
  }): number {
    // Weighted efficiency score calculation
    const utilizationWeight = 0.4;
    const speedWeight = 0.3;
    const volumeWeight = 0.3;

    const utilizationScore = Math.min(100, metrics.utilizationRate);
    const speedScore = Math.max(0, 100 - (metrics.averageTimeToShip * 10)); // Penalty for slow shipping
    const volumeScore = Math.min(100, metrics.totalAllocations * 2); // Bonus for volume

    return (
      utilizationScore * utilizationWeight +
      speedScore * speedWeight +
      volumeScore * volumeWeight
    );
  }

  private async getTopProductCategoriesForLocation(
    locationId: string, 
    tenantId: string, 
    filters?: AllocationAnalyticsFilters
  ) {
    const conditions = [
      eq(allocations.tenantId, tenantId),
      eq(allocations.targetLocationId, locationId)
    ];

    if (filters?.dateFrom) {
      conditions.push(sql`${allocations.createdAt} >= ${filters.dateFrom.getTime()}`);
    }
    if (filters?.dateTo) {
      conditions.push(sql`${allocations.createdAt} <= ${filters.dateTo.getTime()}`);
    }

    const categories = await this.db
      .select({
        category: products.category,
        allocationCount: count(allocations.id),
        totalQuantity: sum(allocations.quantityAllocated)
      })
      .from(allocations)
      .innerJoin(poItems, eq(allocations.poItemId, poItems.id))
      .innerJoin(products, eq(poItems.productId, products.id))
      .where(and(...conditions))
      .groupBy(products.category)
      .orderBy(desc(count(allocations.id)))
      .limit(5);

    // Calculate percentages
    const totalAllocations = categories.reduce((sum, cat) => sum + (cat.allocationCount || 0), 0);

    return categories.map(cat => ({
      category: cat.category || 'Uncategorized',
      allocationCount: cat.allocationCount || 0,
      totalQuantity: cat.totalQuantity || 0,
      percentage: totalAllocations > 0 ? ((cat.allocationCount || 0) / totalAllocations) * 100 : 0
    }));
  }

  private async getStatusDistributionForLocation(
    locationId: string, 
    tenantId: string, 
    filters?: AllocationAnalyticsFilters
  ) {
    const conditions = [
      eq(allocations.tenantId, tenantId),
      eq(allocations.targetLocationId, locationId)
    ];

    if (filters?.dateFrom) {
      conditions.push(sql`${allocations.createdAt} >= ${filters.dateFrom.getTime()}`);
    }
    if (filters?.dateTo) {
      conditions.push(sql`${allocations.createdAt} <= ${filters.dateTo.getTime()}`);
    }

    const statusData = await this.db
      .select({
        status: allocations.status,
        count: count(allocations.id)
      })
      .from(allocations)
      .where(and(...conditions))
      .groupBy(allocations.status);

    const totalCount = statusData.reduce((sum, status) => sum + (status.count || 0), 0);

    return statusData.map(status => ({
      status: status.status as AllocationStatusType,
      count: status.count || 0,
      percentage: totalCount > 0 ? ((status.count || 0) / totalCount) * 100 : 0
    }));
  }

  private async calculateLocationEfficiencyMetrics(
    locationId: string, 
    tenantId: string, 
    filters?: AllocationAnalyticsFilters
  ) {
    // Simplified efficiency metrics - in a real system you'd track more detailed timing data
    const conditions = [
      eq(allocations.tenantId, tenantId),
      eq(allocations.targetLocationId, locationId)
    ];

    if (filters?.dateFrom) {
      conditions.push(sql`${allocations.createdAt} >= ${filters.dateFrom.getTime()}`);
    }
    if (filters?.dateTo) {
      conditions.push(sql`${allocations.createdAt} <= ${filters.dateTo.getTime()}`);
    }

    const [metrics] = await this.db
      .select({
        totalAllocations: count(allocations.id),
        receivedAllocations: sql<number>`SUM(CASE WHEN ${allocations.status} = 'RECEIVED' THEN 1 ELSE 0 END)`,
        totalAllocated: sum(allocations.quantityAllocated),
        totalReceived: sum(allocations.quantityReceived)
      })
      .from(allocations)
      .where(and(...conditions));

    const onTimeDeliveryRate = metrics.totalAllocations > 0 
      ? (metrics.receivedAllocations / metrics.totalAllocations) * 100 
      : 0;

    const utilizationRate = metrics.totalAllocated > 0 
      ? (metrics.totalReceived / metrics.totalAllocated) * 100 
      : 0;

    return {
      onTimeDeliveryRate,
      averageProcessingTime: 3.5, // Placeholder - would calculate from actual timestamps
      utilizationRate
    };
  }

  private async getLineItemVariances(poId: string, tenantId: string) {
    const lineItems = await this.db
      .select({
        poItemId: poItems.id,
        productName: products.name,
        orderedQuantity: poItems.quantityOrdered,
        allocatedQuantity: sql<number>`COALESCE(SUM(${allocations.quantityAllocated}), 0)`
      })
      .from(poItems)
      .innerJoin(products, eq(poItems.productId, products.id))
      .leftJoin(allocations, eq(allocations.poItemId, poItems.id))
      .where(eq(poItems.poId, poId))
      .groupBy(poItems.id, products.name, poItems.quantityOrdered);

    return lineItems.map(item => {
      const unallocatedQuantity = item.orderedQuantity - item.allocatedQuantity;
      const variancePercentage = item.orderedQuantity > 0 
        ? (unallocatedQuantity / item.orderedQuantity) * 100 
        : 0;

      return {
        poItemId: item.poItemId,
        productName: item.productName,
        orderedQuantity: item.orderedQuantity,
        allocatedQuantity: item.allocatedQuantity,
        unallocatedQuantity,
        variancePercentage
      };
    });
  }

  private async getLocationDistribution(poId: string, tenantId: string) {
    const distribution = await this.db
      .select({
        locationId: locations.id,
        locationName: locations.name,
        allocatedQuantity: sum(allocations.quantityAllocated)
      })
      .from(allocations)
      .innerJoin(poItems, eq(allocations.poItemId, poItems.id))
      .innerJoin(locations, eq(allocations.targetLocationId, locations.id))
      .where(and(
        eq(poItems.poId, poId),
        eq(allocations.tenantId, tenantId)
      ))
      .groupBy(locations.id, locations.name);

    const totalAllocated = distribution.reduce((sum, loc) => sum + (loc.allocatedQuantity || 0), 0);

    return distribution.map(loc => ({
      locationId: loc.locationId,
      locationName: loc.locationName,
      allocatedQuantity: loc.allocatedQuantity || 0,
      percentage: totalAllocated > 0 ? ((loc.allocatedQuantity || 0) / totalAllocated) * 100 : 0
    }));
  }
}

/**
 * Factory function to create AllocationAnalyticsService instance
 */
export function createAllocationAnalyticsService(db: DrizzleD1Database): IAllocationAnalyticsService {
  return new AllocationAnalyticsService(db);
}