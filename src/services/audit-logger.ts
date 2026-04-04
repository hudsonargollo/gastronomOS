import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, gte, lte, inArray } from 'drizzle-orm';
import { auditLogs, AuditLog, NewAuditLog } from '../db/schema';
import * as schema from '../db/schema';
import { generateId } from '../utils';

/**
 * Comprehensive Audit Logger Service
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 * 
 * This service provides comprehensive audit logging for all system operations
 * including order state transitions, payment transactions, and inventory consumption.
 * All audit logs are immutable and include timestamp and user identification.
 */

export type UserType = 'waiter' | 'kitchen' | 'cashier' | 'manager' | 'system' | 'customer';

export interface AuditLogContext {
  tenantId: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: any;
  newValue?: any;
  userId?: string;
  userType: UserType;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface AuditLogQuery {
  tenantId: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  userId?: string;
  userType?: UserType;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditTrailReport {
  logs: AuditLog[];
  total: number;
  summary: {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByAction: Record<string, number>;
    eventsByUser: Record<string, number>;
  };
}

export class AuditLogger {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  /**
   * Log an audit event
   * Requirements: 9.1, 9.2, 9.3
   * 
   * Creates an immutable audit log entry for any system operation.
   * All entries include timestamp and user identification.
   */
  async logEvent(context: AuditLogContext): Promise<void> {
    try {
      const auditEntry: NewAuditLog = {
        id: `audit_${generateId()}`,
        tenantId: context.tenantId,
        entityType: context.entityType,
        entityId: context.entityId,
        action: context.action,
        oldValue: context.oldValue ? JSON.stringify(context.oldValue) : null,
        newValue: context.newValue ? JSON.stringify(context.newValue) : null,
        userId: context.userId || null,
        userType: context.userType,
        timestamp: Date.now(),
        ipAddress: context.ipAddress || null,
        userAgent: context.userAgent || null,
        metadata: context.metadata ? JSON.stringify(context.metadata) : null,
      };

      // Insert audit log entry - this is an append-only operation
      // No update or delete operations are provided to ensure immutability (Requirement 9.4)
      await this.db.insert(auditLogs).values(auditEntry);

    } catch (error) {
      // Critical: Audit logging failures should not break the main application flow
      // but should be logged to system monitoring
      console.error('Failed to create audit log entry:', {
        context,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // In a production system, this would be sent to external monitoring
      // For now, we continue execution to not break the main flow
    }
  }

  /**
   * Log order state transition
   * Requirements: 9.1, 9.2
   */
  async logOrderStateChange(
    tenantId: string,
    orderId: string,
    fromState: string,
    toState: string,
    userId: string,
    userType: UserType,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent({
      tenantId,
      entityType: 'order',
      entityId: orderId,
      action: 'STATE_CHANGE',
      oldValue: { state: fromState },
      newValue: { state: toState },
      userId,
      userType,
      ipAddress,
      userAgent,
      metadata: {
        transition: `${fromState} -> ${toState}`,
      },
    });
  }

  /**
   * Log payment transaction
   * Requirements: 9.1, 9.2
   */
  async logPaymentTransaction(
    tenantId: string,
    paymentId: string,
    orderId: string,
    action: 'CREATE' | 'UPDATE' | 'COMPLETE' | 'FAIL' | 'CANCEL',
    paymentData: any,
    userId: string,
    userType: UserType,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent({
      tenantId,
      entityType: 'payment',
      entityId: paymentId,
      action,
      newValue: paymentData,
      userId,
      userType,
      ipAddress,
      userAgent,
      metadata: {
        orderId,
        method: paymentData.method,
        amount: paymentData.amount,
        status: paymentData.status,
      },
    });
  }

  /**
   * Log inventory consumption
   * Requirements: 9.2
   */
  async logInventoryConsumption(
    tenantId: string,
    consumptionId: string,
    orderId: string,
    productId: string,
    quantityConsumed: number,
    unit: string,
    userId: string,
    userType: UserType
  ): Promise<void> {
    await this.logEvent({
      tenantId,
      entityType: 'inventory_consumption',
      entityId: consumptionId,
      action: 'CONSUME',
      newValue: {
        orderId,
        productId,
        quantityConsumed,
        unit,
      },
      userId,
      userType,
      metadata: {
        orderId,
        productId,
      },
    });
  }

  /**
   * Log inventory consumption reversal
   * Requirements: 9.2
   */
  async logInventoryConsumptionReversal(
    tenantId: string,
    consumptionId: string,
    orderId: string,
    reason: string,
    userId: string,
    userType: UserType
  ): Promise<void> {
    await this.logEvent({
      tenantId,
      entityType: 'inventory_consumption',
      entityId: consumptionId,
      action: 'REVERSE',
      newValue: { reversed: true, reason },
      userId,
      userType,
      metadata: {
        orderId,
        reason,
      },
    });
  }

  /**
   * Log commission calculation
   * Requirements: 9.1
   */
  async logCommissionCalculation(
    tenantId: string,
    commissionId: string,
    orderId: string,
    waiterId: string,
    commissionAmount: number,
    userId: string,
    userType: UserType
  ): Promise<void> {
    await this.logEvent({
      tenantId,
      entityType: 'commission',
      entityId: commissionId,
      action: 'CALCULATE',
      newValue: {
        orderId,
        waiterId,
        commissionAmount,
      },
      userId,
      userType,
      metadata: {
        orderId,
        waiterId,
      },
    });
  }

  /**
   * Log menu item availability change
   * Requirements: 9.1
   */
  async logMenuAvailabilityChange(
    tenantId: string,
    menuItemId: string,
    oldAvailability: boolean,
    newAvailability: boolean,
    reason: string,
    userId: string,
    userType: UserType
  ): Promise<void> {
    await this.logEvent({
      tenantId,
      entityType: 'menu_item',
      entityId: menuItemId,
      action: 'AVAILABILITY_CHANGE',
      oldValue: { available: oldAvailability },
      newValue: { available: newAvailability },
      userId,
      userType,
      metadata: {
        reason,
      },
    });
  }

  /**
   * Query audit logs with filtering
   * Requirements: 9.5
   */
  async queryAuditLogs(query: AuditLogQuery): Promise<AuditLog[]> {
    const {
      tenantId,
      entityType,
      entityId,
      action,
      userId,
      userType,
      dateFrom,
      dateTo,
      limit = 100,
      offset = 0,
    } = query;

    // Build conditions array
    const conditions = [eq(auditLogs.tenantId, tenantId)];

    if (entityType) {
      conditions.push(eq(auditLogs.entityType, entityType));
    }

    if (entityId) {
      conditions.push(eq(auditLogs.entityId, entityId));
    }

    if (action) {
      conditions.push(eq(auditLogs.action, action));
    }

    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }

    if (userType) {
      conditions.push(eq(auditLogs.userType, userType));
    }

    if (dateFrom) {
      conditions.push(gte(auditLogs.timestamp, dateFrom.getTime()));
    }

    if (dateTo) {
      conditions.push(lte(auditLogs.timestamp, dateTo.getTime()));
    }

    // Execute query with combined conditions
    const results = await this.db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit)
      .offset(offset);

    return results;
  }

  /**
   * Generate audit trail report for specified date range
   * Requirements: 9.5
   */
  async generateAuditTrailReport(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date,
    entityTypes?: string[]
  ): Promise<AuditTrailReport> {
    const conditions = [
      eq(auditLogs.tenantId, tenantId),
      gte(auditLogs.timestamp, dateFrom.getTime()),
      lte(auditLogs.timestamp, dateTo.getTime()),
    ];

    if (entityTypes && entityTypes.length > 0) {
      conditions.push(inArray(auditLogs.entityType, entityTypes));
    }

    const logs = await this.db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.timestamp));

    // Calculate summary statistics
    const eventsByType: Record<string, number> = {};
    const eventsByAction: Record<string, number> = {};
    const eventsByUser: Record<string, number> = {};

    logs.forEach(log => {
      eventsByType[log.entityType] = (eventsByType[log.entityType] || 0) + 1;
      eventsByAction[log.action] = (eventsByAction[log.action] || 0) + 1;
      if (log.userId) {
        eventsByUser[log.userId] = (eventsByUser[log.userId] || 0) + 1;
      }
    });

    return {
      logs,
      total: logs.length,
      summary: {
        totalEvents: logs.length,
        eventsByType,
        eventsByAction,
        eventsByUser,
      },
    };
  }

  /**
   * Export audit logs to CSV format for compliance reporting
   * Requirements: 9.5
   */
  async exportAuditLogsToCSV(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<string> {
    const logs = await this.queryAuditLogs({
      tenantId,
      dateFrom,
      dateTo,
      limit: 10000, // Large limit for export
    });

    // CSV header
    const header = [
      'Timestamp',
      'Entity Type',
      'Entity ID',
      'Action',
      'User ID',
      'User Type',
      'Old Value',
      'New Value',
      'IP Address',
      'User Agent',
    ].join(',');

    // CSV rows
    const rows = logs.map(log => {
      const timestamp = new Date(log.timestamp).toISOString();
      const oldValue = log.oldValue ? log.oldValue.replace(/"/g, '""') : '';
      const newValue = log.newValue ? log.newValue.replace(/"/g, '""') : '';
      const userAgent = log.userAgent ? log.userAgent.replace(/"/g, '""') : '';

      return [
        timestamp,
        log.entityType,
        log.entityId,
        log.action,
        log.userId || '',
        log.userType,
        `"${oldValue}"`,
        `"${newValue}"`,
        log.ipAddress || '',
        `"${userAgent}"`,
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  /**
   * Get audit log statistics for compliance dashboard
   * Requirements: 9.5
   */
  async getAuditStatistics(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<{
    totalEvents: number;
    orderStateChanges: number;
    paymentTransactions: number;
    inventoryConsumptions: number;
    eventsByDay: Record<string, number>;
  }> {
    const logs = await this.queryAuditLogs({
      tenantId,
      dateFrom,
      dateTo,
      limit: 100000, // Large limit for statistics
    });

    const eventsByDay: Record<string, number> = {};

    logs.forEach(log => {
      const date = new Date(log.timestamp).toISOString().split('T')[0];
      eventsByDay[date] = (eventsByDay[date] || 0) + 1;
    });

    return {
      totalEvents: logs.length,
      orderStateChanges: logs.filter(log => log.entityType === 'order' && log.action === 'STATE_CHANGE').length,
      paymentTransactions: logs.filter(log => log.entityType === 'payment').length,
      inventoryConsumptions: logs.filter(log => log.entityType === 'inventory_consumption').length,
      eventsByDay,
    };
  }
}

/**
 * Factory function to create AuditLogger instance
 */
export function createAuditLogger(db: DrizzleD1Database<typeof schema>): AuditLogger {
  return new AuditLogger(db);
}
