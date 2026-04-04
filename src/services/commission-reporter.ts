/**
 * Commission Reporter Service
 * Handles commission reporting, analytics, CSV export, and adjustment tracking
 * 
 * Requirements: 4.4, 14.1, 14.2, 14.3, 14.4, 14.5
 */

import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import {
  commissions,
  commissionConfigs,
  orders,
  orderItems,
  users,
  CommissionType,
  type Commission,
  type CommissionConfig,
  type Order,
  type User
} from '../db/schema';
import { generateId } from '../utils';

// Report types
export interface DateRange {
  start: number;
  end: number;
}

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface CommissionReportFilters {
  tenantId: string;
  waiterId?: string;
  period?: ReportPeriod;
  dateRange?: DateRange;
  includePaid?: boolean;
  includeUnpaid?: boolean;
}

export interface CommissionOrderSummary {
  orderId: string;
  orderNumber: string;
  orderAmount: number;
  commissionAmount: number;
  commissionRate: number;
  commissionType: CommissionType;
  calculatedAt: number;
  paidAt: number | null;
  tableNumber?: string;
}

export interface CommissionReport {
  waiterId: string;
  waiterName: string;
  tenantId: string;
  period: DateRange;
  periodType: ReportPeriod;
  totalOrders: number;
  totalSales: number;
  totalCommission: number;
  averageOrderValue: number;
  paidCommission: number;
  unpaidCommission: number;
  orders: CommissionOrderSummary[];
}

export interface CommissionAnalytics {
  tenantId: string;
  period: DateRange;
  totalWaiters: number;
  totalOrders: number;
  totalSales: number;
  totalCommission: number;
  averageOrderValue: number;
  averageCommissionPerWaiter: number;
  topPerformers: WaiterPerformance[];
  waiterStats: WaiterStats[];
}

export interface WaiterPerformance {
  waiterId: string;
  waiterName: string;
  totalOrders: number;
  totalSales: number;
  totalCommission: number;
  averageOrderValue: number;
}

export interface WaiterStats {
  waiterId: string;
  waiterName: string;
  orderCount: number;
  totalSales: number;
  totalCommission: number;
  averageOrderValue: number;
  paidCommission: number;
  unpaidCommission: number;
}

// Commission adjustment types
export interface CommissionAdjustment {
  id: string;
  tenantId: string;
  commissionId: string;
  adjustmentAmount: number;
  adjustmentType: 'increase' | 'decrease' | 'correction';
  reason: string;
  previousAmount: number;
  newAmount: number;
  performedBy: string;
  performedAt: number;
  ipAddress?: string;
  userAgent?: string;
  reversedAt?: number;
  reversedBy?: string;
  reversalReason?: string;
}

export interface CommissionAdjustmentRequest {
  tenantId: string;
  commissionId: string;
  adjustmentAmount: number;
  adjustmentType: 'increase' | 'decrease' | 'correction';
  reason: string;
  performedBy: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AdjustmentReversalRequest {
  tenantId: string;
  adjustmentId: string;
  reversedBy: string;
  reversalReason: string;
}

// CSV Export types
export interface CSVExportOptions {
  tenantId: string;
  dateRange: DateRange;
  waiterId?: string;
  includePaid?: boolean;
  includeUnpaid?: boolean;
  dateFormat?: 'iso' | 'br' | 'us';
  delimiter?: ',' | ';';
}

export interface CSVExportResult {
  success: boolean;
  csv?: string;
  filename?: string;
  recordCount?: number;
  error?: string;
}

// Audit trail types
export interface CommissionAuditEntry {
  id: string;
  tenantId: string;
  commissionId: string;
  action: 'created' | 'adjusted' | 'reversed' | 'paid' | 'adjustment_reversed';
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  performedBy: string;
  performedAt: number;
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
}

/**
 * CommissionReporter class
 * Provides comprehensive commission reporting, analytics, and export functionality
 * 
 * Requirements: 4.4, 14.1, 14.2, 14.3, 14.4, 14.5
 */
export class CommissionReporter {
  constructor(private db: any) {}

  /**
   * Generate commission report for a specific waiter and time period
   * Requirements: 14.1, 14.2, 14.3
   */
  async generateWaiterReport(filters: CommissionReportFilters): Promise<CommissionReport | null> {
    try {
      const { tenantId, waiterId, period = 'custom', dateRange, includePaid = true, includeUnpaid = true } = filters;

      if (!waiterId) {
        return null;
      }

      // Calculate date range based on period
      const periodRange = this.calculatePeriodRange(period, dateRange);
      
      // Get waiter info
      const waiter = await this.getWaiterInfo(tenantId, waiterId);
      if (!waiter) {
        return null;
      }

      // Get commissions for the period
      const commissionsList = await this.getCommissionsForPeriod(
        tenantId,
        waiterId,
        periodRange,
        includePaid,
        includeUnpaid
      );

      // Calculate totals
      const totalOrders = commissionsList.length;
      const totalSales = commissionsList.reduce((sum, c) => sum + c.orderAmount, 0);
      const totalCommission = commissionsList.reduce((sum, c) => sum + c.commissionAmount, 0);
      const averageOrderValue = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;
      const paidCommission = commissionsList
        .filter(c => c.paidAt !== null)
        .reduce((sum, c) => sum + c.commissionAmount, 0);
      const unpaidCommission = totalCommission - paidCommission;

      // Get order summaries
      const orderSummaries = await this.getOrderSummaries(commissionsList);

      return {
        waiterId,
        waiterName: `${waiter.firstName} ${waiter.lastName}`,
        tenantId,
        period: periodRange,
        periodType: period,
        totalOrders,
        totalSales,
        totalCommission,
        averageOrderValue,
        paidCommission,
        unpaidCommission,
        orders: orderSummaries
      };
    } catch (error) {
      console.error('Error generating waiter commission report:', error);
      return null;
    }
  }

  /**
   * Generate commission reports for all waiters in a tenant
   * Requirements: 14.1, 14.2
   */
  async generateTenantReport(filters: Omit<CommissionReportFilters, 'waiterId'>): Promise<CommissionReport[]> {
    try {
      const { tenantId, period = 'custom', dateRange, includePaid = true, includeUnpaid = true } = filters;

      // Get all waiters with commissions
      const periodRange = this.calculatePeriodRange(period, dateRange);
      
      const waitersWithCommissions = await this.db
        .selectDistinct({ waiterId: commissions.waiterId })
        .from(commissions)
        .where(and(
          eq(commissions.tenantId, tenantId),
          gte(commissions.calculatedAt, periodRange.start),
          lte(commissions.calculatedAt, periodRange.end)
        ));

      const reports: CommissionReport[] = [];

      for (const { waiterId } of waitersWithCommissions) {
        const report = await this.generateWaiterReport({
          ...filters,
          waiterId
        });
        if (report) {
          reports.push(report);
        }
      }

      return reports.sort((a, b) => b.totalCommission - a.totalCommission);
    } catch (error) {
      console.error('Error generating tenant commission report:', error);
      return [];
    }
  }

  /**
   * Get commission analytics for a tenant
   * Requirements: 14.3
   */
  async getCommissionAnalytics(
    tenantId: string,
    period: ReportPeriod = 'monthly',
    dateRange?: DateRange
  ): Promise<CommissionAnalytics | null> {
    try {
      const periodRange = this.calculatePeriodRange(period, dateRange);

      // Get all commissions for the period
      const commissionsList = await this.db
        .select()
        .from(commissions)
        .where(and(
          eq(commissions.tenantId, tenantId),
          gte(commissions.calculatedAt, periodRange.start),
          lte(commissions.calculatedAt, periodRange.end)
        ));

      if (commissionsList.length === 0) {
        return {
          tenantId,
          period: periodRange,
          totalWaiters: 0,
          totalOrders: 0,
          totalSales: 0,
          totalCommission: 0,
          averageOrderValue: 0,
          averageCommissionPerWaiter: 0,
          topPerformers: [],
          waiterStats: []
        };
      }

      // Group by waiter
      const waiterMap = new Map<string, {
        orders: Commission[];
        waiterId: string;
      }>();

      for (const commission of commissionsList) {
        const existing = waiterMap.get(commission.waiterId) || { orders: [], waiterId: commission.waiterId };
        existing.orders.push(commission);
        waiterMap.set(commission.waiterId, existing);
      }

      // Calculate waiter stats
      const waiterStats: WaiterStats[] = [];
      
      for (const [waiterId, data] of waiterMap) {
        const waiter = await this.getWaiterInfo(tenantId, waiterId);
        const totalSales = data.orders.reduce((sum, c) => sum + c.orderAmount, 0);
        const totalCommission = data.orders.reduce((sum, c) => sum + c.commissionAmount, 0);
        const paidCommission = data.orders
          .filter(c => c.paidAt !== null)
          .reduce((sum, c) => sum + c.commissionAmount, 0);

        waiterStats.push({
          waiterId,
          waiterName: waiter ? `${waiter.firstName} ${waiter.lastName}` : 'Unknown',
          orderCount: data.orders.length,
          totalSales,
          totalCommission,
          averageOrderValue: data.orders.length > 0 ? Math.round(totalSales / data.orders.length) : 0,
          paidCommission,
          unpaidCommission: totalCommission - paidCommission
        });
      }

      // Sort by total commission
      waiterStats.sort((a, b) => b.totalCommission - a.totalCommission);

      // Calculate totals
      const totalOrders = commissionsList.length;
      const totalSales = commissionsList.reduce((sum, c) => sum + c.orderAmount, 0);
      const totalCommission = commissionsList.reduce((sum, c) => sum + c.commissionAmount, 0);
      const averageOrderValue = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;
      const averageCommissionPerWaiter = waiterStats.length > 0 
        ? Math.round(totalCommission / waiterStats.length) 
        : 0;

      // Get top performers (top 5)
      const topPerformers: WaiterPerformance[] = waiterStats.slice(0, 5).map(stat => ({
        waiterId: stat.waiterId,
        waiterName: stat.waiterName,
        totalOrders: stat.orderCount,
        totalSales: stat.totalSales,
        totalCommission: stat.totalCommission,
        averageOrderValue: stat.averageOrderValue
      }));

      return {
        tenantId,
        period: periodRange,
        totalWaiters: waiterStats.length,
        totalOrders,
        totalSales,
        totalCommission,
        averageOrderValue,
        averageCommissionPerWaiter,
        topPerformers,
        waiterStats
      };
    } catch (error) {
      console.error('Error getting commission analytics:', error);
      return null;
    }
  }

  /**
   * Export commissions to CSV format for payroll integration
   * Requirements: 14.4
   */
  async exportToCSV(options: CSVExportOptions): Promise<CSVExportResult> {
    try {
      const {
        tenantId,
        dateRange,
        waiterId,
        includePaid = true,
        includeUnpaid = true,
        dateFormat = 'iso',
        delimiter = ','
      } = options;

      // Get commissions
      let query = this.db
        .select()
        .from(commissions)
        .where(and(
          eq(commissions.tenantId, tenantId),
          gte(commissions.calculatedAt, dateRange.start),
          lte(commissions.calculatedAt, dateRange.end)
        ))
        .orderBy(desc(commissions.calculatedAt));

      if (waiterId) {
        query = query.where(and(
          eq(commissions.tenantId, tenantId),
          eq(commissions.waiterId, waiterId),
          gte(commissions.calculatedAt, dateRange.start),
          lte(commissions.calculatedAt, dateRange.end)
        ));
      }

      const commissionsList = await query;

      // Filter by paid status
      let filtered = commissionsList;
      if (!includePaid || !includeUnpaid) {
        if (includePaid && !includeUnpaid) {
          filtered = commissionsList.filter(c => c.paidAt !== null);
        } else if (!includePaid && includeUnpaid) {
          filtered = commissionsList.filter(c => c.paidAt === null);
        }
      }

      if (filtered.length === 0) {
        return {
          success: true,
          csv: '',
          filename: this.generateCSVFilename(dateRange, waiterId),
          recordCount: 0
        };
      }

      // Get waiter info for all commissions
      const waiterIds = [...new Set(filtered.map(c => c.waiterId))];
      const waiters = await this.db
        .select()
        .from(users)
        .where(and(
          eq(users.tenantId, tenantId),
          sql`${users.id} IN ${waiterIds}`
        ));

      const waiterMap = new Map<string, User>();
      for (const waiter of waiters) {
        waiterMap.set(waiter.id, waiter);
      }

      // Build CSV
      const headers = [
        'Commission ID',
        'Waiter ID',
        'Waiter Name',
        'Order ID',
        'Order Amount (cents)',
        'Commission Rate',
        'Commission Type',
        'Commission Amount (cents)',
        'Calculated At',
        'Paid At',
        'Status'
      ];

      const rows = filtered.map(commission => {
        const waiter = waiterMap.get(commission.waiterId);
        const waiterName = waiter ? `${waiter.firstName} ${waiter.lastName}` : 'Unknown';
        
        return [
          commission.id,
          commission.waiterId,
          waiterName,
          commission.orderId,
          commission.orderAmount,
          commission.commissionRate,
          commission.commissionType,
          commission.commissionAmount,
          this.formatDate(commission.calculatedAt, dateFormat),
          commission.paidAt ? this.formatDate(commission.paidAt, dateFormat) : '',
          commission.paidAt ? 'Paid' : 'Unpaid'
        ];
      });

      const csv = [
        headers.join(delimiter),
        ...rows.map(row => row.map(cell => this.escapeCSVCell(cell)).join(delimiter))
      ].join('\n');

      return {
        success: true,
        csv,
        filename: this.generateCSVFilename(dateRange, waiterId),
        recordCount: filtered.length
      };
    } catch (error) {
      console.error('Error exporting commissions to CSV:', error);
      return {
        success: false,
        error: 'Failed to export commissions to CSV'
      };
    }
  }

  /**
   * Create a commission adjustment
   * Requirements: 14.5
   */
  async createAdjustment(request: CommissionAdjustmentRequest): Promise<{
    success: boolean;
    adjustment?: CommissionAdjustment;
    error?: string;
  }> {
    try {
      const {
        tenantId,
        commissionId,
        adjustmentAmount,
        adjustmentType,
        reason,
        performedBy,
        ipAddress,
        userAgent
      } = request;

      // Get the commission
      const commission = await this.db
        .select()
        .from(commissions)
        .where(and(
          eq(commissions.tenantId, tenantId),
          eq(commissions.id, commissionId)
        ))
        .limit(1);

      if (!commission[0]) {
        return { success: false, error: 'Commission not found' };
      }

      const currentCommission = commission[0];
      const previousAmount = currentCommission.commissionAmount;
      
      // Calculate new amount
      let newAmount: number;
      if (adjustmentType === 'increase') {
        newAmount = previousAmount + adjustmentAmount;
      } else if (adjustmentType === 'decrease') {
        newAmount = Math.max(0, previousAmount - adjustmentAmount);
      } else {
        // correction - adjustmentAmount is the new total
        newAmount = Math.max(0, adjustmentAmount);
      }

      // Create adjustment record
      const adjustmentId = generateId();
      const now = Date.now();

      const adjustment: CommissionAdjustment = {
        id: adjustmentId,
        tenantId,
        commissionId,
        adjustmentAmount,
        adjustmentType,
        reason,
        previousAmount,
        newAmount,
        performedBy,
        performedAt: now,
        ipAddress,
        userAgent
      };

      // Store adjustment (we'll create a table for this)
      await this.storeAdjustment(adjustment);

      // Update commission
      await this.db
        .update(commissions)
        .set({
          commissionAmount: newAmount,
          notes: `Adjusted: ${reason}`
        })
        .where(eq(commissions.id, commissionId));

      // Create audit entry
      await this.createAuditEntry({
        tenantId,
        commissionId,
        action: 'adjusted',
        previousValues: { commissionAmount: previousAmount },
        newValues: { commissionAmount: newAmount },
        performedBy,
        performedAt: now,
        ipAddress,
        userAgent,
        notes: reason
      });

      return { success: true, adjustment };
    } catch (error) {
      console.error('Error creating commission adjustment:', error);
      return { success: false, error: 'Failed to create adjustment' };
    }
  }

  /**
   * Reverse a commission adjustment
   * Requirements: 14.5
   */
  async reverseAdjustment(request: AdjustmentReversalRequest): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { tenantId, adjustmentId, reversedBy, reversalReason } = request;

      // Get the adjustment
      const adjustment = await this.getAdjustmentById(tenantId, adjustmentId);
      if (!adjustment) {
        return { success: false, error: 'Adjustment not found' };
      }

      if (adjustment.reversedAt) {
        return { success: false, error: 'Adjustment already reversed' };
      }

      const now = Date.now();

      // Revert the commission amount
      await this.db
        .update(commissions)
        .set({
          commissionAmount: adjustment.previousAmount,
          notes: `Adjustment reversed: ${reversalReason}`
        })
        .where(eq(commissions.id, adjustment.commissionId));

      // Mark adjustment as reversed
      await this.updateAdjustmentReversal(adjustmentId, now, reversedBy, reversalReason);

      // Create audit entry
      await this.createAuditEntry({
        tenantId,
        commissionId: adjustment.commissionId,
        action: 'adjustment_reversed',
        previousValues: { commissionAmount: adjustment.newAmount },
        newValues: { commissionAmount: adjustment.previousAmount },
        performedBy: reversedBy,
        performedAt: now,
        notes: `Reversal reason: ${reversalReason}`
      });

      return { success: true };
    } catch (error) {
      console.error('Error reversing commission adjustment:', error);
      return { success: false, error: 'Failed to reverse adjustment' };
    }
  }

  /**
   * Get adjustment history for a commission
   * Requirements: 14.5
   */
  async getAdjustmentHistory(tenantId: string, commissionId: string): Promise<CommissionAdjustment[]> {
    try {
      // For now, we'll use a simple in-memory approach
      // In production, this would query a commission_adjustments table
      const adjustments = await this.getAdjustmentsForCommission(tenantId, commissionId);
      return adjustments;
    } catch (error) {
      console.error('Error getting adjustment history:', error);
      return [];
    }
  }

  /**
   * Get audit trail for a commission
   * Requirements: 14.5
   */
  async getCommissionAuditTrail(tenantId: string, commissionId: string): Promise<CommissionAuditEntry[]> {
    try {
      const auditEntries = await this.getAuditEntriesForCommission(tenantId, commissionId);
      return auditEntries;
    } catch (error) {
      console.error('Error getting commission audit trail:', error);
      return [];
    }
  }

  // Private helper methods

  private calculatePeriodRange(period: ReportPeriod, customRange?: DateRange): DateRange {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    if (period === 'custom' && customRange) {
      return customRange;
    }

    switch (period) {
      case 'daily': {
        const startOfDay = new Date(now).setHours(0, 0, 0, 0);
        const endOfDay = new Date(now).setHours(23, 59, 59, 999);
        return { start: startOfDay, end: endOfDay };
      }
      case 'weekly': {
        const dayOfWeek = new Date(now).getDay();
        const startOfWeek = new Date(now - (dayOfWeek * day)).setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek + (6 * day)).setHours(23, 59, 59, 999);
        return { start: startOfWeek, end: endOfWeek };
      }
      case 'monthly': {
        const startOfMonth = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
        const endOfMonth = new Date(new Date(now).getFullYear(), new Date(now).getMonth() + 1, 0, 23, 59, 59, 999).getTime();
        return { start: startOfMonth, end: endOfMonth };
      }
      default:
        return customRange || { start: 0, end: now };
    }
  }

  private async getWaiterInfo(tenantId: string, waiterId: string): Promise<User | null> {
    try {
      const result = await this.db
        .select()
        .from(users)
        .where(and(
          eq(users.tenantId, tenantId),
          eq(users.id, waiterId)
        ))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('Error getting waiter info:', error);
      return null;
    }
  }

  private async getCommissionsForPeriod(
    tenantId: string,
    waiterId: string,
    periodRange: DateRange,
    includePaid: boolean,
    includeUnpaid: boolean
  ): Promise<Commission[]> {
    try {
      const results = await this.db
        .select()
        .from(commissions)
        .where(and(
          eq(commissions.tenantId, tenantId),
          eq(commissions.waiterId, waiterId),
          gte(commissions.calculatedAt, periodRange.start),
          lte(commissions.calculatedAt, periodRange.end)
        ))
        .orderBy(desc(commissions.calculatedAt));

      // Filter by paid status
      if (!includePaid || !includeUnpaid) {
        if (includePaid && !includeUnpaid) {
          return results.filter(c => c.paidAt !== null);
        } else if (!includePaid && includeUnpaid) {
          return results.filter(c => c.paidAt === null);
        }
      }

      return results;
    } catch (error) {
      console.error('Error getting commissions for period:', error);
      return [];
    }
  }

  private async getOrderSummaries(commissionsList: Commission[]): Promise<CommissionOrderSummary[]> {
    const summaries: CommissionOrderSummary[] = [];

    for (const commission of commissionsList) {
      // Get order details
      const order = await this.db
        .select()
        .from(orders)
        .where(eq(orders.id, commission.orderId))
        .limit(1);

      summaries.push({
        orderId: commission.orderId,
        orderNumber: order[0]?.orderNumber || 'Unknown',
        orderAmount: commission.orderAmount,
        commissionAmount: commission.commissionAmount,
        commissionRate: commission.commissionRate,
        commissionType: commission.commissionType as CommissionType,
        calculatedAt: commission.calculatedAt,
        paidAt: commission.paidAt,
        tableNumber: order[0]?.tableNumber || undefined
      });
    }

    return summaries;
  }

  private formatDate(timestamp: number, format: 'iso' | 'br' | 'us'): string {
    const date = new Date(timestamp);
    
    switch (format) {
      case 'iso':
        return date.toISOString();
      case 'br':
        return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
      case 'us':
        return date.toLocaleDateString('en-US') + ' ' + date.toLocaleTimeString('en-US');
      default:
        return date.toISOString();
    }
  }

  private escapeCSVCell(value: any): string {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private generateCSVFilename(dateRange: DateRange, waiterId?: string): string {
    const startDate = new Date(dateRange.start).toISOString().split('T')[0];
    const endDate = new Date(dateRange.end).toISOString().split('T')[0];
    const waiterSuffix = waiterId ? `_${waiterId.slice(0, 8)}` : '';
    return `commissions_${startDate}_${endDate}${waiterSuffix}.csv`;
  }

  // Adjustment storage methods (using in-memory for now, would use a proper table in production)
  private adjustmentStore: Map<string, CommissionAdjustment> = new Map();
  private auditStore: Map<string, CommissionAuditEntry[]> = new Map();

  private async storeAdjustment(adjustment: CommissionAdjustment): Promise<void> {
    this.adjustmentStore.set(adjustment.id, adjustment);
  }

  private async getAdjustmentById(tenantId: string, adjustmentId: string): Promise<CommissionAdjustment | null> {
    const adjustment = this.adjustmentStore.get(adjustmentId);
    if (adjustment && adjustment.tenantId === tenantId) {
      return adjustment;
    }
    return null;
  }

  private async updateAdjustmentReversal(
    adjustmentId: string,
    reversedAt: number,
    reversedBy: string,
    reversalReason: string
  ): Promise<void> {
    const adjustment = this.adjustmentStore.get(adjustmentId);
    if (adjustment) {
      adjustment.reversedAt = reversedAt;
      adjustment.reversedBy = reversedBy;
      adjustment.reversalReason = reversalReason;
      this.adjustmentStore.set(adjustmentId, adjustment);
    }
  }

  private async getAdjustmentsForCommission(tenantId: string, commissionId: string): Promise<CommissionAdjustment[]> {
    const adjustments: CommissionAdjustment[] = [];
    for (const adjustment of this.adjustmentStore.values()) {
      if (adjustment.tenantId === tenantId && adjustment.commissionId === commissionId) {
        adjustments.push(adjustment);
      }
    }
    return adjustments.sort((a, b) => b.performedAt - a.performedAt);
  }

  private async createAuditEntry(entry: Omit<CommissionAuditEntry, 'id'>): Promise<void> {
    const auditEntry: CommissionAuditEntry = {
      ...entry,
      id: generateId()
    };

    const existing = this.auditStore.get(entry.commissionId) || [];
    existing.push(auditEntry);
    this.auditStore.set(entry.commissionId, existing);
  }

  private async getAuditEntriesForCommission(tenantId: string, commissionId: string): Promise<CommissionAuditEntry[]> {
    const entries = this.auditStore.get(commissionId) || [];
    return entries
      .filter(e => e.tenantId === tenantId)
      .sort((a, b) => b.performedAt - a.performedAt);
  }
}

/**
 * Factory function to create CommissionReporter instance
 */
export function createCommissionReporter(db: any): CommissionReporter {
  return new CommissionReporter(db);
}