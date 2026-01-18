import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { 
  priceHistory, 
  purchaseOrders,
  suppliers,
  products,
  poItems,
  PriceHistory, 
  NewPriceHistory,
  POItem
} from '../db/schema';
import { generateId, getCurrentTimestamp } from '../utils';

// Price History service interfaces as defined in the design document
export interface PriceSuggestion {
  suggestedPriceCents: number;
  lastPurchaseDate: Date;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  priceVariance?: number; // Percentage change from historical average
}

export interface PriceHistoryEntry {
  id: string;
  unitPriceCents: number;
  poId: string;
  recordedAt: number;
  poNumber?: string;
}

export interface PriceTrendAnalysis {
  averagePriceCents: number;
  priceVolatility: number;
  trendDirection: 'INCREASING' | 'DECREASING' | 'STABLE';
  dataPoints: number;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface PriceHistoryService {
  recordPriceHistory(poItem: POItem): Promise<void>;
  getSuggestedPrice(tenantId: string, supplierId: string, productId: string): Promise<PriceSuggestion | null>;
  getPriceHistory(tenantId: string, supplierId: string, productId: string, limit?: number): Promise<PriceHistoryEntry[]>;
  analyzePriceTrends(tenantId: string, productId: string, dateRange?: DateRange): Promise<PriceTrendAnalysis>;
}

export class PriceHistoryServiceImpl implements PriceHistoryService {
  constructor(private db: DrizzleD1Database) {}

  /**
   * Record price history for a PO line item when PO is approved
   * Requirements: 2.2, 2.6
   */
  async recordPriceHistory(poItem: POItem): Promise<void> {
    if (!poItem || !poItem.id || !poItem.poId || !poItem.productId || !poItem.unitPriceCents) {
      throw new Error('Invalid PO item data for price history recording');
    }

    // Get the purchase order to extract tenant and supplier info
    const [po] = await this.db
      .select({
        tenantId: purchaseOrders.tenantId,
        supplierId: purchaseOrders.supplierId,
        status: purchaseOrders.status,
        approvedAt: purchaseOrders.approvedAt,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, poItem.poId))
      .limit(1);

    if (!po) {
      throw new Error('Purchase order not found for price history recording');
    }

    // Only record price history for approved purchase orders
    if (po.status !== 'APPROVED') {
      throw new Error('Price history can only be recorded for approved purchase orders');
    }

    // Create price history record
    const currentTime = getCurrentTimestamp();
    const newPriceHistory: NewPriceHistory = {
      id: `ph_${generateId()}`,
      tenantId: po.tenantId,
      supplierId: po.supplierId,
      productId: poItem.productId,
      unitPriceCents: poItem.unitPriceCents,
      poId: poItem.poId,
      recordedAt: po.approvedAt || currentTime,
    };

    await this.db
      .insert(priceHistory)
      .values(newPriceHistory);
  }

  /**
   * Get suggested price based on historical data
   * Requirements: 2.2, 2.6
   */
  async getSuggestedPrice(
    tenantId: string, 
    supplierId: string, 
    productId: string
  ): Promise<PriceSuggestion | null> {
    if (!tenantId || !supplierId || !productId) {
      return null;
    }

    // Get recent price history for this supplier/product combination
    const recentPrices = await this.db
      .select({
        unitPriceCents: priceHistory.unitPriceCents,
        recordedAt: priceHistory.recordedAt,
        poNumber: purchaseOrders.poNumber,
      })
      .from(priceHistory)
      .innerJoin(purchaseOrders, eq(priceHistory.poId, purchaseOrders.id))
      .where(and(
        eq(priceHistory.tenantId, tenantId),
        eq(priceHistory.supplierId, supplierId),
        eq(priceHistory.productId, productId)
      ))
      .orderBy(desc(priceHistory.recordedAt))
      .limit(10); // Get last 10 price points

    if (recentPrices.length === 0) {
      return null;
    }

    // Use most recent price as suggestion
    const mostRecentPrice = recentPrices[0];
    const lastPurchaseDate = new Date(mostRecentPrice.recordedAt * 1000);

    // Calculate confidence based on data recency and consistency
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    
    if (recentPrices.length >= 3) {
      const prices = recentPrices.map(p => p.unitPriceCents);
      const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const variance = this.calculateVariance(prices, avgPrice);
      const coefficientOfVariation = Math.sqrt(variance) / avgPrice;

      // Determine confidence based on price consistency and data points
      if (coefficientOfVariation < 0.1 && recentPrices.length >= 5) {
        confidence = 'HIGH';
      } else if (coefficientOfVariation < 0.2 && recentPrices.length >= 3) {
        confidence = 'MEDIUM';
      }

      // Calculate price variance from historical average
      const priceVariance = ((mostRecentPrice.unitPriceCents - avgPrice) / avgPrice) * 100;

      return {
        suggestedPriceCents: mostRecentPrice.unitPriceCents,
        lastPurchaseDate,
        confidence,
        priceVariance: Math.round(priceVariance * 100) / 100, // Round to 2 decimal places
      };
    }

    return {
      suggestedPriceCents: mostRecentPrice.unitPriceCents,
      lastPurchaseDate,
      confidence,
    };
  }

  /**
   * Get price history for a supplier/product combination
   * Requirements: 2.2, 2.6
   */
  async getPriceHistory(
    tenantId: string, 
    supplierId: string, 
    productId: string, 
    limit: number = 20
  ): Promise<PriceHistoryEntry[]> {
    if (!tenantId || !supplierId || !productId) {
      return [];
    }

    // Validate limit
    if (limit <= 0 || limit > 100) {
      limit = 20;
    }

    const historyEntries = await this.db
      .select({
        id: priceHistory.id,
        unitPriceCents: priceHistory.unitPriceCents,
        poId: priceHistory.poId,
        recordedAt: priceHistory.recordedAt,
        poNumber: purchaseOrders.poNumber,
      })
      .from(priceHistory)
      .innerJoin(purchaseOrders, eq(priceHistory.poId, purchaseOrders.id))
      .where(and(
        eq(priceHistory.tenantId, tenantId),
        eq(priceHistory.supplierId, supplierId),
        eq(priceHistory.productId, productId)
      ))
      .orderBy(desc(priceHistory.recordedAt))
      .limit(limit);

    return historyEntries.map(entry => ({
      id: entry.id,
      unitPriceCents: entry.unitPriceCents,
      poId: entry.poId,
      recordedAt: entry.recordedAt,
      poNumber: entry.poNumber || undefined,
    }));
  }

  /**
   * Analyze price trends for a product across all suppliers
   * Requirements: 2.6
   */
  async analyzePriceTrends(
    tenantId: string, 
    productId: string, 
    dateRange?: DateRange
  ): Promise<PriceTrendAnalysis> {
    if (!tenantId || !productId) {
      throw new Error('Tenant ID and Product ID are required');
    }

    // Build base query
    let query = this.db
      .select({
        unitPriceCents: priceHistory.unitPriceCents,
        recordedAt: priceHistory.recordedAt,
      })
      .from(priceHistory)
      .where(and(
        eq(priceHistory.tenantId, tenantId),
        eq(priceHistory.productId, productId)
      ));

    // Apply date range filter if provided
    if (dateRange) {
      const startTimestamp = Math.floor(dateRange.startDate.getTime() / 1000);
      const endTimestamp = Math.floor(dateRange.endDate.getTime() / 1000);
      
      query = query.where(and(
        eq(priceHistory.tenantId, tenantId),
        eq(priceHistory.productId, productId),
        gte(priceHistory.recordedAt, startTimestamp),
        lte(priceHistory.recordedAt, endTimestamp)
      ));
    }

    const priceData = await query.orderBy(priceHistory.recordedAt);

    if (priceData.length === 0) {
      return {
        averagePriceCents: 0,
        priceVolatility: 0,
        trendDirection: 'STABLE',
        dataPoints: 0,
      };
    }

    // Calculate average price
    const prices = priceData.map(p => p.unitPriceCents);
    const averagePriceCents = prices.reduce((sum, price) => sum + price, 0) / prices.length;

    // Calculate price volatility (coefficient of variation)
    const variance = this.calculateVariance(prices, averagePriceCents);
    const standardDeviation = Math.sqrt(variance);
    const priceVolatility = averagePriceCents > 0 ? (standardDeviation / averagePriceCents) * 100 : 0;

    // Determine trend direction using linear regression
    let trendDirection: 'INCREASING' | 'DECREASING' | 'STABLE' = 'STABLE';
    
    if (priceData.length >= 3) {
      const slope = this.calculateTrendSlope(priceData);
      const slopeThreshold = averagePriceCents * 0.001; // 0.1% of average price
      
      if (slope > slopeThreshold) {
        trendDirection = 'INCREASING';
      } else if (slope < -slopeThreshold) {
        trendDirection = 'DECREASING';
      }
    }

    return {
      averagePriceCents: Math.round(averagePriceCents),
      priceVolatility: Math.round(priceVolatility * 100) / 100, // Round to 2 decimal places
      trendDirection,
      dataPoints: priceData.length,
    };
  }

  /**
   * Calculate variance for a set of prices
   */
  private calculateVariance(prices: number[], mean: number): number {
    if (prices.length <= 1) return 0;
    
    const squaredDifferences = prices.map(price => Math.pow(price - mean, 2));
    return squaredDifferences.reduce((sum, diff) => sum + diff, 0) / (prices.length - 1);
  }

  /**
   * Calculate trend slope using simple linear regression
   */
  private calculateTrendSlope(priceData: Array<{ unitPriceCents: number; recordedAt: number }>): number {
    if (priceData.length < 2) return 0;

    const n = priceData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = i; // Use index as x-coordinate for simplicity
      const y = priceData[i].unitPriceCents;
      
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    // Calculate slope: (n*sumXY - sumX*sumY) / (n*sumXX - sumX*sumX)
    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) return 0;
    
    return (n * sumXY - sumX * sumY) / denominator;
  }
}

/**
 * Factory function to create PriceHistoryService instance
 */
export function createPriceHistoryService(db: DrizzleD1Database): PriceHistoryService {
  return new PriceHistoryServiceImpl(db);
}