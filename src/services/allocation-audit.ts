import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { 
  allocationAuditLog,
  allocations,
  users,
  locations,
  poItems,
  purchaseOrders,
  products,
  AllocationAuditLog,
  NewAllocationAuditLog,
  AllocationAuditActionType,
  AllocationAuditAction,
  Allocation,
  User,
  Location,
  POItem,
  PurchaseOrder,
  Product
} from '../db';
import * as schema from '../db';
import { generateId, getCurrentTimestamp } from '../utils';

// Audit trail interfaces as defined in the design document
export interface AllocationAuditEntry {
  id: string;
  tenantId: string;
  allocationId: string;
  action: AllocationAuditActionType;
  oldValues: any;
  newValues: any;
  performedBy: string;
  performedAt: number;
  notes?: string;
  // Enriched data for reporting
  performedByUser?: {
    id: string;
    email: string;
    role: string;
  };
  allocation?: {
    id: string;
    targetLocationName?: string;
    poItemId: string;
    productName?: string;
    poNumber?: string;
  };
}

export interface AuditTrailFilters {
  allocationId?: string;
  action?: AllocationAuditActionType;
  performedBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
  locationId?: string;
  poId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditTrailSummary {
  totalEvents: number;
  eventsByAction: Record<AllocationAuditActionType, number>;
  eventsByUser: Array<{
    userId: string;
    userEmail: string;
    eventCount: number;
  }>;
  recentActivity: AllocationAuditEntry[];
}

export interface ComplianceReport {
  reportId: string;
  tenantId: string;
  generatedAt: number;
  generatedBy: string;
  dateRange: {
    from: Date;
    to: Date;
  };
  summary: {
    totalAllocations: number;
    totalAuditEvents: number;
    allocationsCreated: number;
    allocationsModified: number;
    allocationsDeleted: number;
    statusChanges: number;
  };
  auditTrail: AllocationAuditEntry[];
  integrityChecks: {
    orphanedAuditLogs: number;
    missingAuditLogs: number;
    dataConsistencyIssues: string[];
  };
}

// Allocation audit service interface
export interface AllocationAuditService {
  logAllocationAudit(auditData: {
    tenantId: string;
    allocationId: string;
    action: AllocationAuditActionType;
    oldValues: any;
    newValues: any;
    performedBy: string;
    notes?: string;
  }): Promise<void>;
  
  getAuditTrail(
    allocationId: string,
    tenantId: string,
    filters?: Omit<AuditTrailFilters, 'allocationId'>
  ): Promise<AllocationAuditEntry[]>;
  
  getAuditTrailForTenant(
    tenantId: string,
    filters?: AuditTrailFilters
  ): Promise<AllocationAuditEntry[]>;
  
  getAuditSummary(
    tenantId: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<AuditTrailSummary>;
  
  generateComplianceReport(
    tenantId: string,
    dateRange: { from: Date; to: Date },
    generatedBy: string
  ): Promise<ComplianceReport>;
  
  exportAuditData(
    tenantId: string,
    filters?: AuditTrailFilters,
    format?: 'json' | 'csv'
  ): Promise<string>;
}

export class AllocationAuditServiceImpl implements AllocationAuditService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  /**
   * Log allocation audit event
   * Requirements: 4.4, 5.5, 6.2, 6.5
   */
  async logAllocationAudit(auditData: {
    tenantId: string;
    allocationId: string;
    action: AllocationAuditActionType;
    oldValues: any;
    newValues: any;
    performedBy: string;
    notes?: string;
  }): Promise<void> {
    try {
      const currentTime = getCurrentTimestamp();
      const auditLog: NewAllocationAuditLog = {
        id: `audit_${generateId()}`,
        tenantId: auditData.tenantId,
        allocationId: auditData.allocationId,
        action: auditData.action,
        oldValues: auditData.oldValues,
        newValues: auditData.newValues,
        performedBy: auditData.performedBy,
        performedAt: currentTime,
        notes: auditData.notes || null,
      };

      // Insert audit log entry - this is an append-only operation
      await this.db
        .insert(allocationAuditLog)
        .values(auditLog);

    } catch (error) {
      // Critical: Audit logging failures should not break the main application flow
      // but should be logged to system monitoring
      console.error('Failed to create allocation audit log entry:', {
        auditData,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // In a production system, this would be sent to external monitoring
      // For now, we continue execution to not break the main flow
    }
  }

  /**
   * Get complete audit trail for a specific allocation
   * Requirements: 6.5
   */
  async getAuditTrail(
    allocationId: string,
    tenantId: string,
    filters?: Omit<AuditTrailFilters, 'allocationId'>
  ): Promise<AllocationAuditEntry[]> {
    if (!allocationId || !tenantId) {
      throw new Error('Allocation ID and tenant ID are required');
    }

    // Build base conditions
    const conditions = [
      eq(allocationAuditLog.allocationId, allocationId),
      eq(allocationAuditLog.tenantId, tenantId)
    ];

    // Apply filters
    if (filters?.action) {
      conditions.push(eq(allocationAuditLog.action, filters.action));
    }

    if (filters?.performedBy) {
      conditions.push(eq(allocationAuditLog.performedBy, filters.performedBy));
    }

    if (filters?.dateFrom) {
      conditions.push(gte(allocationAuditLog.performedAt, filters.dateFrom.getTime()));
    }

    if (filters?.dateTo) {
      conditions.push(lte(allocationAuditLog.performedAt, filters.dateTo.getTime()));
    }

    // Get audit logs with enriched user data
    const auditLogs = await this.db
      .select({
        auditLog: allocationAuditLog,
        user: users,
      })
      .from(allocationAuditLog)
      .leftJoin(users, eq(allocationAuditLog.performedBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(allocationAuditLog.performedAt))
      .limit(filters?.limit || 100)
      .offset(filters?.offset || 0);

    // Get allocation details for context
    const [allocationDetails] = await this.db
      .select({
        allocation: allocations,
        location: locations,
        poItem: poItems,
        purchaseOrder: purchaseOrders,
        product: products,
      })
      .from(allocations)
      .leftJoin(locations, eq(allocations.targetLocationId, locations.id))
      .leftJoin(poItems, eq(allocations.poItemId, poItems.id))
      .leftJoin(purchaseOrders, eq(poItems.poId, purchaseOrders.id))
      .leftJoin(products, eq(poItems.productId, products.id))
      .where(and(
        eq(allocations.id, allocationId),
        eq(allocations.tenantId, tenantId)
      ))
      .limit(1);

    // Transform to audit entries with enriched data
    return auditLogs.map(({ auditLog: log, user }) => ({
      id: log.id,
      tenantId: log.tenantId,
      allocationId: log.allocationId,
      action: log.action as AllocationAuditActionType,
      oldValues: log.oldValues,
      newValues: log.newValues,
      performedBy: log.performedBy,
      performedAt: log.performedAt,
      notes: log.notes || undefined,
      performedByUser: user ? {
        id: user.id,
        email: user.email,
        role: user.role,
      } : undefined,
      allocation: allocationDetails ? {
        id: allocationDetails.allocation.id,
        targetLocationName: allocationDetails.location?.name,
        poItemId: allocationDetails.allocation.poItemId,
        productName: allocationDetails.product?.name,
        poNumber: allocationDetails.purchaseOrder?.poNumber || undefined,
      } : undefined,
    }));
  }

  /**
   * Get audit trail for entire tenant with filtering
   * Requirements: 6.5
   */
  async getAuditTrailForTenant(
    tenantId: string,
    filters?: AuditTrailFilters
  ): Promise<AllocationAuditEntry[]> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    // Build base conditions
    const conditions = [eq(allocationAuditLog.tenantId, tenantId)];

    // Apply filters
    if (filters?.allocationId) {
      conditions.push(eq(allocationAuditLog.allocationId, filters.allocationId));
    }

    if (filters?.action) {
      conditions.push(eq(allocationAuditLog.action, filters.action));
    }

    if (filters?.performedBy) {
      conditions.push(eq(allocationAuditLog.performedBy, filters.performedBy));
    }

    if (filters?.dateFrom) {
      conditions.push(gte(allocationAuditLog.performedAt, filters.dateFrom.getTime()));
    }

    if (filters?.dateTo) {
      conditions.push(lte(allocationAuditLog.performedAt, filters.dateTo.getTime()));
    }

    // Additional filtering by location or PO requires joins
    let query = this.db
      .select({
        auditLog: allocationAuditLog,
        user: users,
        allocation: allocations,
        location: locations,
        poItem: poItems,
        purchaseOrder: purchaseOrders,
        product: products,
      })
      .from(allocationAuditLog)
      .leftJoin(users, eq(allocationAuditLog.performedBy, users.id))
      .leftJoin(allocations, eq(allocationAuditLog.allocationId, allocations.id))
      .leftJoin(locations, eq(allocations.targetLocationId, locations.id))
      .leftJoin(poItems, eq(allocations.poItemId, poItems.id))
      .leftJoin(purchaseOrders, eq(poItems.poId, purchaseOrders.id))
      .leftJoin(products, eq(poItems.productId, products.id));

    // Apply location filter if specified
    if (filters?.locationId) {
      conditions.push(eq(locations.id, filters.locationId));
    }

    // Apply PO filter if specified
    if (filters?.poId) {
      conditions.push(eq(purchaseOrders.id, filters.poId));
    }

    const auditLogs = await query
      .where(and(...conditions))
      .orderBy(desc(allocationAuditLog.performedAt))
      .limit(filters?.limit || 100)
      .offset(filters?.offset || 0);

    // Transform to audit entries with enriched data
    return auditLogs.map(({ auditLog: log, user, allocation, location, poItem, purchaseOrder, product }) => ({
      id: log.id,
      tenantId: log.tenantId,
      allocationId: log.allocationId,
      action: log.action as AllocationAuditActionType,
      oldValues: log.oldValues,
      newValues: log.newValues,
      performedBy: log.performedBy,
      performedAt: log.performedAt,
      notes: log.notes || undefined,
      performedByUser: user ? {
        id: user.id,
        email: user.email,
        role: user.role,
      } : undefined,
      allocation: allocation ? {
        id: allocation.id,
        targetLocationName: location?.name,
        poItemId: allocation.poItemId,
        productName: product?.name,
        poNumber: purchaseOrder?.poNumber || undefined,
      } : undefined,
    }));
  }

  /**
   * Get audit summary statistics for tenant
   * Requirements: 6.5
   */
  async getAuditSummary(
    tenantId: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<AuditTrailSummary> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    // Build conditions for date range
    const conditions = [eq(allocationAuditLog.tenantId, tenantId)];
    
    if (dateRange?.from) {
      conditions.push(gte(allocationAuditLog.performedAt, dateRange.from.getTime()));
    }
    
    if (dateRange?.to) {
      conditions.push(lte(allocationAuditLog.performedAt, dateRange.to.getTime()));
    }

    // Get all audit logs for the period
    const auditLogs = await this.db
      .select({
        auditLog: allocationAuditLog,
        user: users,
      })
      .from(allocationAuditLog)
      .leftJoin(users, eq(allocationAuditLog.performedBy, users.id))
      .where(and(...conditions));

    // Calculate statistics
    const totalEvents = auditLogs.length;
    
    const eventsByAction: Record<AllocationAuditActionType, number> = {
      [AllocationAuditAction.CREATED]: 0,
      [AllocationAuditAction.UPDATED]: 0,
      [AllocationAuditAction.DELETED]: 0,
      [AllocationAuditAction.STATUS_CHANGED]: 0,
    };

    const userEventCounts = new Map<string, { email: string; count: number }>();

    for (const { auditLog: log, user } of auditLogs) {
      // Count by action
      eventsByAction[log.action as AllocationAuditActionType]++;

      // Count by user
      if (user) {
        const existing = userEventCounts.get(user.id) || { email: user.email, count: 0 };
        existing.count++;
        userEventCounts.set(user.id, existing);
      }
    }

    // Get recent activity (last 10 events)
    const recentActivity = await this.getAuditTrailForTenant(tenantId, {
      ...dateRange && { dateFrom: dateRange.from, dateTo: dateRange.to },
      limit: 10,
      offset: 0
    });

    return {
      totalEvents,
      eventsByAction,
      eventsByUser: Array.from(userEventCounts.entries()).map(([userId, data]) => ({
        userId,
        userEmail: data.email,
        eventCount: data.count,
      })),
      recentActivity,
    };
  }

  /**
   * Generate comprehensive compliance report
   * Requirements: 6.5
   */
  async generateComplianceReport(
    tenantId: string,
    dateRange: { from: Date; to: Date },
    generatedBy: string
  ): Promise<ComplianceReport> {
    if (!tenantId || !dateRange.from || !dateRange.to || !generatedBy) {
      throw new Error('Tenant ID, date range, and generated by user are required');
    }

    const reportId = `report_${generateId()}`;
    const generatedAt = getCurrentTimestamp();

    // Get all audit events in the date range
    const auditTrail = await this.getAuditTrailForTenant(tenantId, {
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
    });

    // Get all allocations in the date range for comparison
    const allocationsInRange = await this.db
      .select()
      .from(allocations)
      .where(and(
        eq(allocations.tenantId, tenantId),
        gte(allocations.createdAt, dateRange.from.getTime()),
        lte(allocations.createdAt, dateRange.to.getTime())
      ));

    // Calculate summary statistics
    const summary = {
      totalAllocations: allocationsInRange.length,
      totalAuditEvents: auditTrail.length,
      allocationsCreated: auditTrail.filter(e => e.action === AllocationAuditAction.CREATED).length,
      allocationsModified: auditTrail.filter(e => e.action === AllocationAuditAction.UPDATED).length,
      allocationsDeleted: auditTrail.filter(e => e.action === AllocationAuditAction.DELETED).length,
      statusChanges: auditTrail.filter(e => e.action === AllocationAuditAction.STATUS_CHANGED).length,
    };

    // Perform integrity checks
    const integrityChecks = await this.performIntegrityChecks(tenantId, dateRange);

    return {
      reportId,
      tenantId,
      generatedAt,
      generatedBy,
      dateRange,
      summary,
      auditTrail,
      integrityChecks,
    };
  }

  /**
   * Export audit data in specified format
   * Requirements: 6.5
   */
  async exportAuditData(
    tenantId: string,
    filters?: AuditTrailFilters,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const auditData = await this.getAuditTrailForTenant(tenantId, filters);

    if (format === 'csv') {
      return this.convertToCSV(auditData);
    }

    return JSON.stringify(auditData, null, 2);
  }

  // Private helper methods

  private async performIntegrityChecks(
    tenantId: string,
    dateRange: { from: Date; to: Date }
  ): Promise<{
    orphanedAuditLogs: number;
    missingAuditLogs: number;
    dataConsistencyIssues: string[];
  }> {
    const issues: string[] = [];

    // Check for orphaned audit logs (audit logs without corresponding allocations)
    const orphanedLogs = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(allocationAuditLog)
      .leftJoin(allocations, eq(allocationAuditLog.allocationId, allocations.id))
      .where(and(
        eq(allocationAuditLog.tenantId, tenantId),
        gte(allocationAuditLog.performedAt, dateRange.from.getTime()),
        lte(allocationAuditLog.performedAt, dateRange.to.getTime()),
        sql`${allocations.id} IS NULL`
      ));

    const orphanedCount = orphanedLogs[0]?.count || 0;

    // Check for allocations without creation audit logs
    const allocationsWithoutAudit = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(allocations)
      .leftJoin(allocationAuditLog, and(
        eq(allocations.id, allocationAuditLog.allocationId),
        eq(allocationAuditLog.action, AllocationAuditAction.CREATED)
      ))
      .where(and(
        eq(allocations.tenantId, tenantId),
        gte(allocations.createdAt, dateRange.from.getTime()),
        lte(allocations.createdAt, dateRange.to.getTime()),
        sql`${allocationAuditLog.id} IS NULL`
      ));

    const missingAuditCount = allocationsWithoutAudit[0]?.count || 0;

    if (orphanedCount > 0) {
      issues.push(`Found ${orphanedCount} orphaned audit log entries`);
    }

    if (missingAuditCount > 0) {
      issues.push(`Found ${missingAuditCount} allocations without creation audit logs`);
    }

    return {
      orphanedAuditLogs: orphanedCount,
      missingAuditLogs: missingAuditCount,
      dataConsistencyIssues: issues,
    };
  }

  private convertToCSV(auditData: AllocationAuditEntry[]): string {
    if (auditData.length === 0) {
      return 'No data available';
    }

    // CSV headers
    const headers = [
      'ID',
      'Allocation ID',
      'Action',
      'Performed By',
      'Performed By Email',
      'Performed At',
      'Location Name',
      'Product Name',
      'PO Number',
      'Old Values',
      'New Values',
      'Notes'
    ];

    // Convert data to CSV rows
    const rows = auditData.map(entry => [
      entry.id,
      entry.allocationId,
      entry.action,
      entry.performedBy,
      entry.performedByUser?.email || '',
      new Date(entry.performedAt).toISOString(),
      entry.allocation?.targetLocationName || '',
      entry.allocation?.productName || '',
      entry.allocation?.poNumber || '',
      JSON.stringify(entry.oldValues || {}),
      JSON.stringify(entry.newValues || {}),
      entry.notes || ''
    ]);

    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return csvContent;
  }
}

/**
 * Factory function to create AllocationAuditService instance
 */
export function createAllocationAuditService(db: DrizzleD1Database<typeof schema>): AllocationAuditService {
  return new AllocationAuditServiceImpl(db);
}