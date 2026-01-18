import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, sql, gte, lte, count, sum, avg } from 'drizzle-orm';
import { 
  purchaseOrders, 
  poItems, 
  suppliers,
  products,
  priceHistory,
  POStatus
} from '../db/schema';

// Analytics interfaces
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface SpendAnalysisBySupplier {
  supplierId: string;
  supplierName: string;
  totalSpendCents: number;
  orderCount: number;
  averageOrderValueCents: number;
  lastOrderDate: Date | null;
  percentageOfTotalSpend: number;
}

export interface SpendAnalysisByCategory {
  category: string;
  totalSpendCents: number;
  orderCount: number;
  averageOrderValueCents: number;
  percentageOfTotalSpend: number;
}

export interface POPerformanceMetrics {
  totalPOs: number;
  draftPOs: number;
  approvedPOs: number;
  receivedPOs: number;
  cancelledPOs: number;
  averageApprovalTimeDays: number;
  averageReceivingTimeDays: number;
  totalSpendCents: number;
  averageOrderValueCents: number;
}

export interface PurchasingTrendData {
  period: string; // YYYY-MM format
  totalSpendCents: number;
  orderCount: number;
  averageOrderValueCents: number;
  uniqueSuppliers: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  totalQuantityOrdered: number;
  totalSpendCents: number;
  orderCount: number;
  averageUnitPriceCents: number;
}

export interface SupplierPerformance {
  supplierId: string;
  supplierName: string;
  totalOrders: number;
  onTimeDeliveryRate: number; // Percentage
  averageOrderValueCents: number;
  totalSpendCents: number;
  lastOrderDate: Date | null;
}

export interface PurchasingAnalyticsService {
  getSpendAnalysisBySupplier(tenantId: string, dateRange: DateRange): Promise<SpendAnalysisBySupplier[]>;
  getSpendAnalysisByCategory(tenantId: string, dateRange: DateRange): Promise<SpendAnalysisByCategory[]>;
  getPOPerformanceMetrics(tenantId: string, dateRange: DateRange): Promise<POPerformanceMetrics>;
  getPurchasingTrends(tenantId: string, dateRange: DateRange): Promise<PurchasingTrendData[]>;
  getTopProducts(tenantId: string, dateRange: DateRange, limit?: number): Promise<TopProduct[]>;
  getSupplierPerformance(tenantId: string, dateRange: DateRange): Promise<SupplierPerformance[]>;
}

export class PurchasingAnalyticsServiceImpl implements PurchasingAnalyticsService {
  constructor(private db: DrizzleD1Database) {}

  /**
   * Get spend analysis by supplier
   * Requirements: 2.6
   */
  async getSpendAnalysisBySupplier(tenantId: string, dateRange: DateRange): Promise<SpendAnalysisBySupplier[]> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const startTimestamp = Math.floor(dateRange.startDate.getTime() / 1000);
    const endTimestamp = Math.floor(dateRange.endDate.getTime() / 1000);

    // Get spend data by supplier
    const spendData = await this.db
      .select({
        supplierId: suppliers.id,
        supplierName: suppliers.name,
        totalSpendCents: sql<number>`COALESCE(SUM(${purchaseOrders.totalCostCents}), 0)`,
        orderCount: sql<number>`COUNT(${purchaseOrders.id})`,
        averageOrderValueCents: sql<number>`COALESCE(AVG(${purchaseOrders.totalCostCents}), 0)`,
        lastOrderDate: sql<number>`MAX(${purchaseOrders.createdAt})`,
      })
      .from(suppliers)
      .leftJoin(purchaseOrders, and(
        eq(purchaseOrders.supplierId, suppliers.id),
        eq(purchaseOrders.status, POStatus.RECEIVED),
        gte(purchaseOrders.createdAt, startTimestamp),
        lte(purchaseOrders.createdAt, endTimestamp)
      ))
      .where(eq(suppliers.tenantId, tenantId))
      .groupBy(suppliers.id, suppliers.name)
      .orderBy(desc(sql`COALESCE(SUM(${purchaseOrders.totalCostCents}), 0)`));

    // Calculate total spend for percentage calculation
    const totalSpend = spendData.reduce((sum, item) => sum + item.totalSpendCents, 0);

    return spendData.map(item => ({
      supplierId: item.supplierId,
      supplierName: item.supplierName,
      totalSpendCents: item.totalSpendCents,
      orderCount: item.orderCount,
      averageOrderValueCents: Math.round(item.averageOrderValueCents),
      lastOrderDate: item.lastOrderDate ? new Date(item.lastOrderDate * 1000) : null,
      percentageOfTotalSpend: totalSpend > 0 ? (item.totalSpendCents / totalSpend) * 100 : 0,
    }));
  }

  /**
   * Get spend analysis by product category
   * Requirements: 2.6
   */
  async getSpendAnalysisByCategory(tenantId: string, dateRange: DateRange): Promise<SpendAnalysisByCategory[]> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const startTimestamp = Math.floor(dateRange.startDate.getTime() / 1000);
    const endTimestamp = Math.floor(dateRange.endDate.getTime() / 1000);

    // Get spend data by product category
    const spendData = await this.db
      .select({
        category: sql<string>`COALESCE(${products.category}, 'Uncategorized')`,
        totalSpendCents: sql<number>`COALESCE(SUM(${poItems.lineTotalCents}), 0)`,
        orderCount: sql<number>`COUNT(DISTINCT ${purchaseOrders.id})`,
        averageOrderValueCents: sql<number>`COALESCE(AVG(${purchaseOrders.totalCostCents}), 0)`,
      })
      .from(products)
      .innerJoin(poItems, eq(poItems.productId, products.id))
      .innerJoin(purchaseOrders, and(
        eq(purchaseOrders.id, poItems.poId),
        eq(purchaseOrders.status, POStatus.RECEIVED),
        gte(purchaseOrders.createdAt, startTimestamp),
        lte(purchaseOrders.createdAt, endTimestamp)
      ))
      .where(eq(products.tenantId, tenantId))
      .groupBy(sql`COALESCE(${products.category}, 'Uncategorized')`)
      .orderBy(desc(sql`COALESCE(SUM(${poItems.lineTotalCents}), 0)`));

    // Calculate total spend for percentage calculation
    const totalSpend = spendData.reduce((sum, item) => sum + item.totalSpendCents, 0);

    return spendData.map(item => ({
      category: item.category,
      totalSpendCents: item.totalSpendCents,
      orderCount: item.orderCount,
      averageOrderValueCents: Math.round(item.averageOrderValueCents),
      percentageOfTotalSpend: totalSpend > 0 ? (item.totalSpendCents / totalSpend) * 100 : 0,
    }));
  }

  /**
   * Get purchase order performance metrics
   * Requirements: 2.6
   */
  async getPOPerformanceMetrics(tenantId: string, dateRange: DateRange): Promise<POPerformanceMetrics> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const startTimestamp = Math.floor(dateRange.startDate.getTime() / 1000);
    const endTimestamp = Math.floor(dateRange.endDate.getTime() / 1000);

    // Get PO counts by status
    const statusCounts = await this.db
      .select({
        status: purchaseOrders.status,
        count: sql<number>`COUNT(*)`,
        totalSpend: sql<number>`COALESCE(SUM(${purchaseOrders.totalCostCents}), 0)`,
        averageValue: sql<number>`COALESCE(AVG(${purchaseOrders.totalCostCents}), 0)`,
      })
      .from(purchaseOrders)
      .where(and(
        eq(purchaseOrders.tenantId, tenantId),
        gte(purchaseOrders.createdAt, startTimestamp),
        lte(purchaseOrders.createdAt, endTimestamp)
      ))
      .groupBy(purchaseOrders.status);

    // Get timing metrics for approved and received POs
    const timingMetrics = await this.db
      .select({
        averageApprovalTime: sql<number>`
          COALESCE(AVG(
            CASE 
              WHEN ${purchaseOrders.approvedAt} IS NOT NULL 
              THEN (${purchaseOrders.approvedAt} - ${purchaseOrders.createdAt}) / 86400.0
              ELSE NULL 
            END
          ), 0)
        `,
        averageReceivingTime: sql<number>`
          COALESCE(AVG(
            CASE 
              WHEN ${purchaseOrders.receivedAt} IS NOT NULL AND ${purchaseOrders.approvedAt} IS NOT NULL
              THEN (${purchaseOrders.receivedAt} - ${purchaseOrders.approvedAt}) / 86400.0
              ELSE NULL 
            END
          ), 0)
        `,
      })
      .from(purchaseOrders)
      .where(and(
        eq(purchaseOrders.tenantId, tenantId),
        gte(purchaseOrders.createdAt, startTimestamp),
        lte(purchaseOrders.createdAt, endTimestamp)
      ));

    // Aggregate the results
    const metrics = {
      totalPOs: 0,
      draftPOs: 0,
      approvedPOs: 0,
      receivedPOs: 0,
      cancelledPOs: 0,
      totalSpendCents: 0,
      averageOrderValueCents: 0,
      averageApprovalTimeDays: timingMetrics[0]?.averageApprovalTime || 0,
      averageReceivingTimeDays: timingMetrics[0]?.averageReceivingTime || 0,
    };

    for (const statusCount of statusCounts) {
      metrics.totalPOs += statusCount.count;
      metrics.totalSpendCents += statusCount.totalSpend;

      switch (statusCount.status) {
        case POStatus.DRAFT:
          metrics.draftPOs = statusCount.count;
          break;
        case POStatus.APPROVED:
          metrics.approvedPOs = statusCount.count;
          break;
        case POStatus.RECEIVED:
          metrics.receivedPOs = statusCount.count;
          break;
        case POStatus.CANCELLED:
          metrics.cancelledPOs = statusCount.count;
          break;
      }
    }

    metrics.averageOrderValueCents = metrics.totalPOs > 0 
      ? Math.round(metrics.totalSpendCents / metrics.totalPOs) 
      : 0;

    return metrics;
  }

  /**
   * Get purchasing trends over time
   * Requirements: 2.6
   */
  async getPurchasingTrends(tenantId: string, dateRange: DateRange): Promise<PurchasingTrendData[]> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const startTimestamp = Math.floor(dateRange.startDate.getTime() / 1000);
    const endTimestamp = Math.floor(dateRange.endDate.getTime() / 1000);

    // Get monthly trends
    const trends = await this.db
      .select({
        period: sql<string>`strftime('%Y-%m', datetime(${purchaseOrders.createdAt}, 'unixepoch'))`,
        totalSpendCents: sql<number>`COALESCE(SUM(${purchaseOrders.totalCostCents}), 0)`,
        orderCount: sql<number>`COUNT(${purchaseOrders.id})`,
        averageOrderValueCents: sql<number>`COALESCE(AVG(${purchaseOrders.totalCostCents}), 0)`,
        uniqueSuppliers: sql<number>`COUNT(DISTINCT ${purchaseOrders.supplierId})`,
      })
      .from(purchaseOrders)
      .where(and(
        eq(purchaseOrders.tenantId, tenantId),
        eq(purchaseOrders.status, POStatus.RECEIVED),
        gte(purchaseOrders.createdAt, startTimestamp),
        lte(purchaseOrders.createdAt, endTimestamp)
      ))
      .groupBy(sql`strftime('%Y-%m', datetime(${purchaseOrders.createdAt}, 'unixepoch'))`)
      .orderBy(sql`strftime('%Y-%m', datetime(${purchaseOrders.createdAt}, 'unixepoch'))`);

    return trends.map(trend => ({
      period: trend.period,
      totalSpendCents: trend.totalSpendCents,
      orderCount: trend.orderCount,
      averageOrderValueCents: Math.round(trend.averageOrderValueCents),
      uniqueSuppliers: trend.uniqueSuppliers,
    }));
  }

  /**
   * Get top products by spend or quantity
   * Requirements: 2.6
   */
  async getTopProducts(tenantId: string, dateRange: DateRange, limit: number = 20): Promise<TopProduct[]> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const startTimestamp = Math.floor(dateRange.startDate.getTime() / 1000);
    const endTimestamp = Math.floor(dateRange.endDate.getTime() / 1000);

    const topProducts = await this.db
      .select({
        productId: products.id,
        productName: products.name,
        totalQuantityOrdered: sql<number>`COALESCE(SUM(${poItems.quantityOrdered}), 0)`,
        totalSpendCents: sql<number>`COALESCE(SUM(${poItems.lineTotalCents}), 0)`,
        orderCount: sql<number>`COUNT(DISTINCT ${purchaseOrders.id})`,
        averageUnitPriceCents: sql<number>`COALESCE(AVG(${poItems.unitPriceCents}), 0)`,
      })
      .from(products)
      .innerJoin(poItems, eq(poItems.productId, products.id))
      .innerJoin(purchaseOrders, and(
        eq(purchaseOrders.id, poItems.poId),
        eq(purchaseOrders.status, POStatus.RECEIVED),
        gte(purchaseOrders.createdAt, startTimestamp),
        lte(purchaseOrders.createdAt, endTimestamp)
      ))
      .where(eq(products.tenantId, tenantId))
      .groupBy(products.id, products.name)
      .orderBy(desc(sql`COALESCE(SUM(${poItems.lineTotalCents}), 0)`))
      .limit(limit);

    return topProducts.map(product => ({
      productId: product.productId,
      productName: product.productName,
      totalQuantityOrdered: product.totalQuantityOrdered,
      totalSpendCents: product.totalSpendCents,
      orderCount: product.orderCount,
      averageUnitPriceCents: Math.round(product.averageUnitPriceCents),
    }));
  }

  /**
   * Get supplier performance metrics
   * Requirements: 2.6
   */
  async getSupplierPerformance(tenantId: string, dateRange: DateRange): Promise<SupplierPerformance[]> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const startTimestamp = Math.floor(dateRange.startDate.getTime() / 1000);
    const endTimestamp = Math.floor(dateRange.endDate.getTime() / 1000);

    const performance = await this.db
      .select({
        supplierId: suppliers.id,
        supplierName: suppliers.name,
        totalOrders: sql<number>`COUNT(${purchaseOrders.id})`,
        totalSpendCents: sql<number>`COALESCE(SUM(${purchaseOrders.totalCostCents}), 0)`,
        averageOrderValueCents: sql<number>`COALESCE(AVG(${purchaseOrders.totalCostCents}), 0)`,
        lastOrderDate: sql<number>`MAX(${purchaseOrders.createdAt})`,
        // Simplified on-time delivery rate (assumes all received orders are on-time for now)
        onTimeDeliveries: sql<number>`COUNT(CASE WHEN ${purchaseOrders.status} = 'RECEIVED' THEN 1 END)`,
      })
      .from(suppliers)
      .leftJoin(purchaseOrders, and(
        eq(purchaseOrders.supplierId, suppliers.id),
        gte(purchaseOrders.createdAt, startTimestamp),
        lte(purchaseOrders.createdAt, endTimestamp)
      ))
      .where(eq(suppliers.tenantId, tenantId))
      .groupBy(suppliers.id, suppliers.name)
      .orderBy(desc(sql`COALESCE(SUM(${purchaseOrders.totalCostCents}), 0)`));

    return performance.map(perf => ({
      supplierId: perf.supplierId,
      supplierName: perf.supplierName,
      totalOrders: perf.totalOrders,
      onTimeDeliveryRate: perf.totalOrders > 0 ? (perf.onTimeDeliveries / perf.totalOrders) * 100 : 0,
      averageOrderValueCents: Math.round(perf.averageOrderValueCents),
      totalSpendCents: perf.totalSpendCents,
      lastOrderDate: perf.lastOrderDate ? new Date(perf.lastOrderDate * 1000) : null,
    }));
  }
}

/**
 * Factory function to create PurchasingAnalyticsService instance
 */
export function createPurchasingAnalyticsService(db: DrizzleD1Database): PurchasingAnalyticsService {
  return new PurchasingAnalyticsServiceImpl(db);
}