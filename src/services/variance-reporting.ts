import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, sql, gte, lte, count, sum, avg } from 'drizzle-orm';
import { 
  transfers,
  transferAuditLog,
  locations,
  products,
  users,
  Transfer,
  Location,
  Product,
  User,
  TransferStatus
} from '../db/schema';
import { getCurrentTimestamp } from '../utils';

// Variance reporting interfaces
export interface VarianceReport {
  transferId: string;
  productId: string;
  productName: string;
  sourceLocationId: string;
  sourceLocationName: string;
  destinationLocationId: string;
  destinationLocationName: string;
  quantityShipped: number;
  quantityReceived: number;
  varianceQuantity: number;
  variancePercentage: number;
  varianceReason: string | null;
  receivedAt: Date;
  receivedBy: string;
  receivedByName: string;
  priority: string;
  estimatedCostImpact?: number;
}

export interface VarianceAlert {
  id: string;
  transferId: string;
  alertType: 'HIGH_VARIANCE' | 'REPEATED_VARIANCE' | 'PATTERN_DETECTED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  varianceQuantity: number;
  variancePercentage: number;
  threshold: number;
  productId: string;
  locationId: string;
  createdAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface VarianceSummary {
  totalTransfers: number;
  transfersWithVariance: number;
  varianceRate: number;
  totalVarianceQuantity: number;
  averageVariancePercentage: number;
  topVarianceProducts: Array<{
    productId: string;
    productName: string;
    totalVariance: number;
    varianceCount: number;
    averageVariancePercentage: number;
  }>;
  topVarianceLocations: Array<{
    locationId: string;
    locationName: string;
    totalVariance: number;
    varianceCount: number;
    averageVariancePercentage: number;
  }>;
}

export interface VarianceFilters {
  dateFrom?: Date;
  dateTo?: Date;
  productId?: string;
  sourceLocationId?: string;
  destinationLocationId?: string;
  minVariancePercentage?: number;
  maxVariancePercentage?: number;
  minVarianceQuantity?: number;
  maxVarianceQuantity?: number;
  priority?: string;
  limit?: number;
  offset?: number;
}

export interface VarianceReasonCode {
  code: string;
  description: string;
  category: 'DAMAGE' | 'THEFT' | 'SPOILAGE' | 'MEASUREMENT_ERROR' | 'PACKAGING' | 'OTHER';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferences {
  userId: string;
  locationId?: string;
  enableVarianceAlerts: boolean;
  varianceThresholdPercentage: number;
  varianceThresholdQuantity: number;
  enableDailyReports: boolean;
  enableWeeklyReports: boolean;
  notificationMethods: ('EMAIL' | 'SMS' | 'IN_APP')[];
}

export interface VarianceReportingService {
  generateVarianceReport(tenantId: string, filters?: VarianceFilters): Promise<VarianceReport[]>;
  getVarianceSummary(tenantId: string, filters?: VarianceFilters): Promise<VarianceSummary>;
  createVarianceAlert(transferId: string, alertData: Omit<VarianceAlert, 'id' | 'createdAt' | 'acknowledged'>): Promise<VarianceAlert>;
  getVarianceAlerts(tenantId: string, filters?: { acknowledged?: boolean; severity?: string; limit?: number }): Promise<VarianceAlert[]>;
  acknowledgeVarianceAlert(alertId: string, acknowledgedBy: string): Promise<VarianceAlert>;
  getVarianceReasonCodes(): Promise<VarianceReasonCode[]>;
  addVarianceReasonCode(code: Omit<VarianceReasonCode, 'createdAt' | 'updatedAt'>): Promise<VarianceReasonCode>;
  updateVarianceReasonCode(code: string, updates: Partial<VarianceReasonCode>): Promise<VarianceReasonCode>;
  analyzeVariancePatterns(tenantId: string, filters?: VarianceFilters): Promise<{
    repeatedVarianceProducts: string[];
    highVarianceLocations: string[];
    varianceTrends: Array<{ date: string; varianceCount: number; averagePercentage: number }>;
  }>;
  triggerVarianceAlert(transfer: Transfer, variance: number, variancePercentage: number): Promise<void>;
  getNotificationPreferences(userId: string): Promise<NotificationPreferences | null>;
  updateNotificationPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences>;
}

export class VarianceReportingServiceImpl implements VarianceReportingService {
  // In-memory storage for alerts and reason codes (would be database tables in production)
  private varianceAlerts = new Map<string, VarianceAlert>();
  private varianceReasonCodes = new Map<string, VarianceReasonCode>();
  private notificationPreferences = new Map<string, NotificationPreferences>();

  constructor(private db: DrizzleD1Database) {
    this.initializeDefaultReasonCodes();
  }

  /**
   * Generate comprehensive variance report
   * Requirements: 5.3, 5.4
   */
  async generateVarianceReport(tenantId: string, filters?: VarianceFilters): Promise<VarianceReport[]> {
    // Build query conditions
    const conditions = [
      eq(transfers.tenantId, tenantId),
      eq(transfers.status, TransferStatus.RECEIVED),
      sql`${transfers.quantityReceived} < ${transfers.quantityShipped}` // Only transfers with variance
    ];

    if (filters?.dateFrom) {
      conditions.push(gte(transfers.receivedAt, filters.dateFrom.getTime()));
    }

    if (filters?.dateTo) {
      conditions.push(lte(transfers.receivedAt, filters.dateTo.getTime()));
    }

    if (filters?.productId) {
      conditions.push(eq(transfers.productId, filters.productId));
    }

    if (filters?.sourceLocationId) {
      conditions.push(eq(transfers.sourceLocationId, filters.sourceLocationId));
    }

    if (filters?.destinationLocationId) {
      conditions.push(eq(transfers.destinationLocationId, filters.destinationLocationId));
    }

    if (filters?.priority) {
      conditions.push(eq(transfers.priority, filters.priority));
    }

    // Execute query with joins to get related data
    const transfersWithVariance = await this.db
      .select({
        transfer: transfers,
        product: products,
        sourceLocation: locations,
        destinationLocation: locations,
        receivedByUser: users,
      })
      .from(transfers)
      .innerJoin(products, eq(transfers.productId, products.id))
      .innerJoin(locations, eq(transfers.sourceLocationId, locations.id))
      .innerJoin(locations, eq(transfers.destinationLocationId, locations.id))
      .leftJoin(users, eq(transfers.receivedBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(transfers.receivedAt))
      .limit(filters?.limit || 100)
      .offset(filters?.offset || 0);

    // Transform results into variance reports
    const varianceReports: VarianceReport[] = [];

    for (const row of transfersWithVariance) {
      const transfer = row.transfer;
      const quantityShipped = transfer.quantityShipped || 0;
      const quantityReceived = transfer.quantityReceived || 0;
      const varianceQuantity = quantityShipped - quantityReceived;
      const variancePercentage = quantityShipped > 0 ? (varianceQuantity / quantityShipped) * 100 : 0;

      // Apply variance filters
      if (filters?.minVariancePercentage && variancePercentage < filters.minVariancePercentage) {
        continue;
      }
      if (filters?.maxVariancePercentage && variancePercentage > filters.maxVariancePercentage) {
        continue;
      }
      if (filters?.minVarianceQuantity && varianceQuantity < filters.minVarianceQuantity) {
        continue;
      }
      if (filters?.maxVarianceQuantity && varianceQuantity > filters.maxVarianceQuantity) {
        continue;
      }

      // Get location names (need to handle the join properly)
      const sourceLocation = await this.getLocationById(transfer.sourceLocationId, tenantId);
      const destinationLocation = await this.getLocationById(transfer.destinationLocationId, tenantId);
      const receivedByUser = transfer.receivedBy ? await this.getUserById(transfer.receivedBy, tenantId) : null;

      varianceReports.push({
        transferId: transfer.id,
        productId: transfer.productId,
        productName: row.product.name,
        sourceLocationId: transfer.sourceLocationId,
        sourceLocationName: sourceLocation?.name || 'Unknown',
        destinationLocationId: transfer.destinationLocationId,
        destinationLocationName: destinationLocation?.name || 'Unknown',
        quantityShipped,
        quantityReceived,
        varianceQuantity,
        variancePercentage: Math.round(variancePercentage * 100) / 100, // Round to 2 decimal places
        varianceReason: transfer.varianceReason,
        receivedAt: new Date(transfer.receivedAt || 0),
        receivedBy: transfer.receivedBy || '',
        receivedByName: receivedByUser?.email || 'Unknown',
        priority: transfer.priority,
        // TODO: Calculate estimated cost impact based on product pricing
        estimatedCostImpact: undefined
      });
    }

    return varianceReports;
  }

  /**
   * Get variance summary statistics
   * Requirements: 5.3, 5.4
   */
  async getVarianceSummary(tenantId: string, filters?: VarianceFilters): Promise<VarianceSummary> {
    // Build base conditions
    const baseConditions = [
      eq(transfers.tenantId, tenantId),
      eq(transfers.status, TransferStatus.RECEIVED)
    ];

    if (filters?.dateFrom) {
      baseConditions.push(gte(transfers.receivedAt, filters.dateFrom.getTime()));
    }

    if (filters?.dateTo) {
      baseConditions.push(lte(transfers.receivedAt, filters.dateTo.getTime()));
    }

    // Get total transfers count
    const [totalTransfersResult] = await this.db
      .select({ count: count() })
      .from(transfers)
      .where(and(...baseConditions));

    const totalTransfers = totalTransfersResult.count;

    // Get transfers with variance
    const varianceConditions = [
      ...baseConditions,
      sql`${transfers.quantityReceived} < ${transfers.quantityShipped}`
    ];

    const [transfersWithVarianceResult] = await this.db
      .select({ 
        count: count(),
        totalVariance: sum(sql`${transfers.quantityShipped} - ${transfers.quantityReceived}`),
        avgVariancePercentage: avg(sql`CASE WHEN ${transfers.quantityShipped} > 0 THEN ((${transfers.quantityShipped} - ${transfers.quantityReceived}) * 100.0 / ${transfers.quantityShipped}) ELSE 0 END`)
      })
      .from(transfers)
      .where(and(...varianceConditions));

    const transfersWithVariance = transfersWithVarianceResult.count;
    const totalVarianceQuantity = transfersWithVarianceResult.totalVariance || 0;
    const averageVariancePercentage = transfersWithVarianceResult.avgVariancePercentage || 0;

    // Get top variance products
    const topVarianceProducts = await this.db
      .select({
        productId: transfers.productId,
        productName: products.name,
        totalVariance: sum(sql`${transfers.quantityShipped} - ${transfers.quantityReceived}`),
        varianceCount: count(),
        avgVariancePercentage: avg(sql`CASE WHEN ${transfers.quantityShipped} > 0 THEN ((${transfers.quantityShipped} - ${transfers.quantityReceived}) * 100.0 / ${transfers.quantityShipped}) ELSE 0 END`)
      })
      .from(transfers)
      .innerJoin(products, eq(transfers.productId, products.id))
      .where(and(...varianceConditions))
      .groupBy(transfers.productId, products.name)
      .orderBy(desc(sql`sum(${transfers.quantityShipped} - ${transfers.quantityReceived})`))
      .limit(10);

    // Get top variance locations (destination locations where variance occurs)
    const topVarianceLocations = await this.db
      .select({
        locationId: transfers.destinationLocationId,
        locationName: locations.name,
        totalVariance: sum(sql`${transfers.quantityShipped} - ${transfers.quantityReceived}`),
        varianceCount: count(),
        avgVariancePercentage: avg(sql`CASE WHEN ${transfers.quantityShipped} > 0 THEN ((${transfers.quantityShipped} - ${transfers.quantityReceived}) * 100.0 / ${transfers.quantityShipped}) ELSE 0 END`)
      })
      .from(transfers)
      .innerJoin(locations, eq(transfers.destinationLocationId, locations.id))
      .where(and(...varianceConditions))
      .groupBy(transfers.destinationLocationId, locations.name)
      .orderBy(desc(sql`sum(${transfers.quantityShipped} - ${transfers.quantityReceived})`))
      .limit(10);

    return {
      totalTransfers,
      transfersWithVariance,
      varianceRate: totalTransfers > 0 ? (transfersWithVariance / totalTransfers) * 100 : 0,
      totalVarianceQuantity,
      averageVariancePercentage: Math.round(averageVariancePercentage * 100) / 100,
      topVarianceProducts: topVarianceProducts.map(p => ({
        productId: p.productId,
        productName: p.productName,
        totalVariance: p.totalVariance || 0,
        varianceCount: p.varianceCount,
        averageVariancePercentage: Math.round((p.avgVariancePercentage || 0) * 100) / 100
      })),
      topVarianceLocations: topVarianceLocations.map(l => ({
        locationId: l.locationId,
        locationName: l.locationName,
        totalVariance: l.totalVariance || 0,
        varianceCount: l.varianceCount,
        averageVariancePercentage: Math.round((l.avgVariancePercentage || 0) * 100) / 100
      }))
    };
  }

  /**
   * Create a variance alert
   * Requirements: 5.3, 5.4
   */
  async createVarianceAlert(
    transferId: string, 
    alertData: Omit<VarianceAlert, 'id' | 'createdAt' | 'acknowledged'>
  ): Promise<VarianceAlert> {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const alert: VarianceAlert = {
      id: alertId,
      transferId,
      ...alertData,
      createdAt: new Date(),
      acknowledged: false
    };

    this.varianceAlerts.set(alertId, alert);
    
    // TODO: Trigger notification based on user preferences
    await this.sendVarianceNotification(alert);

    return alert;
  }

  /**
   * Get variance alerts with filtering
   * Requirements: 5.3, 5.4
   */
  async getVarianceAlerts(
    tenantId: string, 
    filters?: { acknowledged?: boolean; severity?: string; limit?: number }
  ): Promise<VarianceAlert[]> {
    let alerts = Array.from(this.varianceAlerts.values());

    // Apply filters
    if (filters?.acknowledged !== undefined) {
      alerts = alerts.filter(alert => alert.acknowledged === filters.acknowledged);
    }

    if (filters?.severity) {
      alerts = alerts.filter(alert => alert.severity === filters.severity);
    }

    // Sort by creation date (newest first)
    alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply limit
    if (filters?.limit) {
      alerts = alerts.slice(0, filters.limit);
    }

    return alerts;
  }

  /**
   * Acknowledge a variance alert
   * Requirements: 5.3, 5.4
   */
  async acknowledgeVarianceAlert(alertId: string, acknowledgedBy: string): Promise<VarianceAlert> {
    const alert = this.varianceAlerts.get(alertId);
    if (!alert) {
      throw new Error('Variance alert not found');
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    this.varianceAlerts.set(alertId, alert);
    return alert;
  }

  /**
   * Get available variance reason codes
   * Requirements: 5.3, 5.4
   */
  async getVarianceReasonCodes(): Promise<VarianceReasonCode[]> {
    return Array.from(this.varianceReasonCodes.values())
      .filter(code => code.isActive)
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  /**
   * Add a new variance reason code
   * Requirements: 5.3, 5.4
   */
  async addVarianceReasonCode(code: Omit<VarianceReasonCode, 'createdAt' | 'updatedAt'>): Promise<VarianceReasonCode> {
    if (this.varianceReasonCodes.has(code.code)) {
      throw new Error('Variance reason code already exists');
    }

    const reasonCode: VarianceReasonCode = {
      ...code,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.varianceReasonCodes.set(code.code, reasonCode);
    return reasonCode;
  }

  /**
   * Update an existing variance reason code
   * Requirements: 5.3, 5.4
   */
  async updateVarianceReasonCode(code: string, updates: Partial<VarianceReasonCode>): Promise<VarianceReasonCode> {
    const existingCode = this.varianceReasonCodes.get(code);
    if (!existingCode) {
      throw new Error('Variance reason code not found');
    }

    const updatedCode: VarianceReasonCode = {
      ...existingCode,
      ...updates,
      updatedAt: new Date()
    };

    this.varianceReasonCodes.set(code, updatedCode);
    return updatedCode;
  }

  /**
   * Analyze variance patterns for insights
   * Requirements: 5.3, 5.4
   */
  async analyzeVariancePatterns(tenantId: string, filters?: VarianceFilters): Promise<{
    repeatedVarianceProducts: string[];
    highVarianceLocations: string[];
    varianceTrends: Array<{ date: string; varianceCount: number; averagePercentage: number }>;
  }> {
    // Get products with repeated variance issues (more than 3 occurrences)
    const repeatedVarianceProducts = await this.db
      .select({
        productId: transfers.productId,
        varianceCount: count()
      })
      .from(transfers)
      .where(and(
        eq(transfers.tenantId, tenantId),
        eq(transfers.status, TransferStatus.RECEIVED),
        sql`${transfers.quantityReceived} < ${transfers.quantityShipped}`
      ))
      .groupBy(transfers.productId)
      .having(sql`count(*) > 3`)
      .orderBy(desc(count()));

    // Get locations with high variance rates (>10% of transfers have variance)
    const highVarianceLocations = await this.db
      .select({
        locationId: transfers.destinationLocationId,
        totalTransfers: count(),
        varianceTransfers: sum(sql`CASE WHEN ${transfers.quantityReceived} < ${transfers.quantityShipped} THEN 1 ELSE 0 END`)
      })
      .from(transfers)
      .where(and(
        eq(transfers.tenantId, tenantId),
        eq(transfers.status, TransferStatus.RECEIVED)
      ))
      .groupBy(transfers.destinationLocationId)
      .having(sql`(sum(CASE WHEN ${transfers.quantityReceived} < ${transfers.quantityShipped} THEN 1 ELSE 0 END) * 100.0 / count(*)) > 10`);

    // Get variance trends over time (daily aggregation for last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const varianceTrends = await this.db
      .select({
        date: sql`date(${transfers.receivedAt} / 1000, 'unixepoch')`,
        varianceCount: count(),
        avgVariancePercentage: avg(sql`CASE WHEN ${transfers.quantityShipped} > 0 THEN ((${transfers.quantityShipped} - ${transfers.quantityReceived}) * 100.0 / ${transfers.quantityShipped}) ELSE 0 END`)
      })
      .from(transfers)
      .where(and(
        eq(transfers.tenantId, tenantId),
        eq(transfers.status, TransferStatus.RECEIVED),
        sql`${transfers.quantityReceived} < ${transfers.quantityShipped}`,
        gte(transfers.receivedAt, thirtyDaysAgo.getTime())
      ))
      .groupBy(sql`date(${transfers.receivedAt} / 1000, 'unixepoch')`)
      .orderBy(sql`date(${transfers.receivedAt} / 1000, 'unixepoch')`);

    return {
      repeatedVarianceProducts: repeatedVarianceProducts.map(p => p.productId),
      highVarianceLocations: highVarianceLocations.map(l => l.locationId),
      varianceTrends: varianceTrends.map(t => ({
        date: t.date as string,
        varianceCount: t.varianceCount,
        averagePercentage: Math.round((t.avgVariancePercentage || 0) * 100) / 100
      }))
    };
  }

  /**
   * Trigger variance alert based on thresholds
   * Requirements: 5.3, 5.4
   */
  async triggerVarianceAlert(transfer: Transfer, variance: number, variancePercentage: number): Promise<void> {
    // Define alert thresholds
    const HIGH_VARIANCE_PERCENTAGE = 10; // 10%
    const CRITICAL_VARIANCE_PERCENTAGE = 25; // 25%
    const HIGH_VARIANCE_QUANTITY = 50; // 50 units

    let alertType: VarianceAlert['alertType'] = 'HIGH_VARIANCE';
    let severity: VarianceAlert['severity'] = 'LOW';
    let message = '';

    // Determine alert severity and message
    if (variancePercentage >= CRITICAL_VARIANCE_PERCENTAGE) {
      severity = 'CRITICAL';
      message = `Critical variance detected: ${variance} units (${variancePercentage.toFixed(2)}%) on transfer ${transfer.id}`;
    } else if (variancePercentage >= HIGH_VARIANCE_PERCENTAGE || variance >= HIGH_VARIANCE_QUANTITY) {
      severity = 'HIGH';
      message = `High variance detected: ${variance} units (${variancePercentage.toFixed(2)}%) on transfer ${transfer.id}`;
    } else if (variancePercentage >= 5) {
      severity = 'MEDIUM';
      message = `Moderate variance detected: ${variance} units (${variancePercentage.toFixed(2)}%) on transfer ${transfer.id}`;
    } else {
      severity = 'LOW';
      message = `Low variance detected: ${variance} units (${variancePercentage.toFixed(2)}%) on transfer ${transfer.id}`;
    }

    // Check for patterns (repeated variance for same product/location)
    const recentVariances = await this.getRecentVariancesForProduct(transfer.productId, transfer.destinationLocationId);
    if (recentVariances >= 3) {
      alertType = 'REPEATED_VARIANCE';
      severity = severity === 'LOW' ? 'MEDIUM' : severity;
      message += `. Pattern detected: ${recentVariances} recent variances for this product/location combination.`;
    }

    // Create the alert (transferId is passed as first parameter)
    await this.createVarianceAlert(transfer.id, {
      alertType,
      severity,
      message,
      varianceQuantity: variance,
      variancePercentage,
      threshold: variancePercentage >= HIGH_VARIANCE_PERCENTAGE ? HIGH_VARIANCE_PERCENTAGE : 5,
      productId: transfer.productId,
      locationId: transfer.destinationLocationId
    });
  }

  /**
   * Get notification preferences for a user
   * Requirements: 5.3, 5.4
   */
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
    return this.notificationPreferences.get(userId) || null;
  }

  /**
   * Update notification preferences for a user
   * Requirements: 5.3, 5.4
   */
  async updateNotificationPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const existing = this.notificationPreferences.get(userId) || {
      userId,
      enableVarianceAlerts: true,
      varianceThresholdPercentage: 5,
      varianceThresholdQuantity: 10,
      enableDailyReports: false,
      enableWeeklyReports: true,
      notificationMethods: ['IN_APP']
    };

    const updated: NotificationPreferences = {
      ...existing,
      ...preferences,
      userId // Ensure userId is not overwritten
    };

    this.notificationPreferences.set(userId, updated);
    return updated;
  }

  // Private helper methods

  private async getLocationById(locationId: string, tenantId: string): Promise<Location | null> {
    const [location] = await this.db
      .select()
      .from(locations)
      .where(and(
        eq(locations.id, locationId),
        eq(locations.tenantId, tenantId)
      ))
      .limit(1);

    return location || null;
  }

  private async getUserById(userId: string, tenantId: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);

    return user || null;
  }

  private async getRecentVariancesForProduct(productId: string, locationId: string): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [result] = await this.db
      .select({ count: count() })
      .from(transfers)
      .where(and(
        eq(transfers.productId, productId),
        eq(transfers.destinationLocationId, locationId),
        eq(transfers.status, TransferStatus.RECEIVED),
        sql`${transfers.quantityReceived} < ${transfers.quantityShipped}`,
        gte(transfers.receivedAt, thirtyDaysAgo.getTime())
      ));

    return result.count;
  }

  private async sendVarianceNotification(alert: VarianceAlert): Promise<void> {
    // TODO: Implement actual notification sending (email, SMS, push notifications)
    console.log(`Variance alert created: ${alert.severity} - ${alert.message}`);
    
    // In a real implementation, this would:
    // 1. Get users who should be notified based on location/role
    // 2. Check their notification preferences
    // 3. Send notifications via configured methods (email, SMS, etc.)
    // 4. Log notification attempts for audit purposes
  }

  private initializeDefaultReasonCodes(): void {
    const defaultCodes: VarianceReasonCode[] = [
      {
        code: 'DAMAGE',
        description: 'Product damaged during transport',
        category: 'DAMAGE',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        code: 'SPOILAGE',
        description: 'Product spoiled or expired',
        category: 'SPOILAGE',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        code: 'THEFT',
        description: 'Product stolen or missing',
        category: 'THEFT',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        code: 'MEASUREMENT_ERROR',
        description: 'Error in measurement or counting',
        category: 'MEASUREMENT_ERROR',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        code: 'PACKAGING_LOSS',
        description: 'Loss due to packaging issues',
        category: 'PACKAGING',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        code: 'OTHER',
        description: 'Other unspecified reason',
        category: 'OTHER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    defaultCodes.forEach(code => {
      this.varianceReasonCodes.set(code.code, code);
    });
  }
}

// Factory function for creating variance reporting service
export function createVarianceReportingService(db: DrizzleD1Database): VarianceReportingService {
  return new VarianceReportingServiceImpl(db);
}