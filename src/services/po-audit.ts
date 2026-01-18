import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, sql } from 'drizzle-orm';
import { 
  poAuditLog, 
  purchaseOrders,
  users,
  POAuditLog, 
  NewPOAuditLog,
  POAuditAction,
  POAuditActionType
} from '../db/schema';
import { generateId, getCurrentTimestamp } from '../utils';

// Audit context interface for capturing PO operation information
export interface POAuditContext {
  tenantId: string;
  userId: string;
  poId: string;
  action: POAuditActionType;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
}

// PO audit service interface as defined in the design document
export interface IPOAuditService {
  logPOCreation(context: POAuditContext): Promise<void>;
  logItemAdded(context: POAuditContext): Promise<void>;
  logItemUpdated(context: POAuditContext): Promise<void>;
  logItemRemoved(context: POAuditContext): Promise<void>;
  logPOApproval(context: POAuditContext): Promise<void>;
  logPOReceived(context: POAuditContext): Promise<void>;
  logPOCancelled(context: POAuditContext): Promise<void>;
  
  getPOAuditTrail(
    poId: string,
    tenantId: string,
    options?: {
      action?: POAuditActionType;
      userId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<POAuditLogWithUser[]>;
  
  getComplianceReport(
    tenantId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      action?: POAuditActionType;
      userId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ auditLogs: POAuditLogWithUser[]; total: number }>;
}

// Extended audit log type with user information
export interface POAuditLogWithUser extends POAuditLog {
  performedByUser?: {
    id: string;
    email: string;
    role: string;
  };
}

export class POAuditService implements IPOAuditService {
  constructor(private db: DrizzleD1Database) {}

  /**
   * Log purchase order creation
   * Requirements: 2.9
   */
  async logPOCreation(context: POAuditContext): Promise<void> {
    await this.createAuditLogEntry({
      ...context,
      action: POAuditAction.CREATED,
    });
  }

  /**
   * Log line item addition to purchase order
   * Requirements: 2.9
   */
  async logItemAdded(context: POAuditContext): Promise<void> {
    await this.createAuditLogEntry({
      ...context,
      action: POAuditAction.ITEM_ADDED,
    });
  }

  /**
   * Log line item updates in purchase order
   * Requirements: 2.9
   */
  async logItemUpdated(context: POAuditContext): Promise<void> {
    await this.createAuditLogEntry({
      ...context,
      action: POAuditAction.ITEM_UPDATED,
    });
  }

  /**
   * Log line item removal from purchase order
   * Requirements: 2.9
   */
  async logItemRemoved(context: POAuditContext): Promise<void> {
    await this.createAuditLogEntry({
      ...context,
      action: POAuditAction.ITEM_REMOVED,
    });
  }

  /**
   * Log purchase order approval
   * Requirements: 2.9
   */
  async logPOApproval(context: POAuditContext): Promise<void> {
    await this.createAuditLogEntry({
      ...context,
      action: POAuditAction.APPROVED,
    });
  }

  /**
   * Log purchase order receiving
   * Requirements: 2.9
   */
  async logPOReceived(context: POAuditContext): Promise<void> {
    await this.createAuditLogEntry({
      ...context,
      action: POAuditAction.RECEIVED,
    });
  }

  /**
   * Log purchase order cancellation
   * Requirements: 2.9
   */
  async logPOCancelled(context: POAuditContext): Promise<void> {
    await this.createAuditLogEntry({
      ...context,
      action: POAuditAction.CANCELLED,
    });
  }

  /**
   * Core method to create immutable audit log entries for purchase orders
   * Requirements: 2.9 - Ensure audit logs are immutable from application layer
   */
  private async createAuditLogEntry(context: POAuditContext): Promise<void> {
    try {
      // Verify the purchase order exists and belongs to the tenant
      const [po] = await this.db
        .select({ id: purchaseOrders.id })
        .from(purchaseOrders)
        .where(and(
          eq(purchaseOrders.id, context.poId),
          eq(purchaseOrders.tenantId, context.tenantId)
        ))
        .limit(1);

      if (!po) {
        throw new Error(`Purchase order ${context.poId} not found in tenant ${context.tenantId}`);
      }

      // Verify the user exists and belongs to the tenant
      const [user] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.id, context.userId),
          eq(users.tenantId, context.tenantId)
        ))
        .limit(1);

      if (!user) {
        throw new Error(`User ${context.userId} not found in tenant ${context.tenantId}`);
      }

      const auditEntry: NewPOAuditLog = {
        id: `poa_${generateId()}`,
        tenantId: context.tenantId,
        poId: context.poId,
        action: context.action,
        oldValues: context.oldValues ? JSON.stringify(context.oldValues) : null,
        newValues: context.newValues ? JSON.stringify(context.newValues) : null,
        performedBy: context.userId,
        performedAt: getCurrentTimestamp(),
        notes: context.notes || null,
      };

      // Insert audit log entry - this is an append-only operation
      // No update or delete operations are provided to ensure immutability
      await this.db
        .insert(poAuditLog)
        .values(auditEntry);

    } catch (error) {
      // Critical: Audit logging failures should not break the main application flow
      // but should be logged to system monitoring
      console.error('Failed to create PO audit log entry:', {
        context,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // In a production system, this would be sent to external monitoring
      // For now, we continue execution to not break the main flow
    }
  }

  /**
   * Retrieve audit trail for a specific purchase order
   * This method enforces tenant isolation for audit log access
   * Requirements: 2.9
   */
  async getPOAuditTrail(
    poId: string,
    tenantId: string,
    options: {
      action?: POAuditActionType;
      userId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<POAuditLogWithUser[]> {
    if (!poId || !tenantId) {
      throw new Error('Purchase order ID and tenant ID are required for audit trail access');
    }

    const { action, userId, limit = 100, offset = 0 } = options;

    // Verify the purchase order exists and belongs to the tenant
    const [po] = await this.db
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(and(
        eq(purchaseOrders.id, poId),
        eq(purchaseOrders.tenantId, tenantId)
      ))
      .limit(1);

    if (!po) {
      throw new Error('Purchase order not found or access denied');
    }

    // Build query with tenant and PO isolation
    let whereConditions = [
      eq(poAuditLog.tenantId, tenantId),
      eq(poAuditLog.poId, poId)
    ];

    // Add optional filters
    if (action) {
      whereConditions.push(eq(poAuditLog.action, action));
    }

    if (userId) {
      whereConditions.push(eq(poAuditLog.performedBy, userId));
    }

    const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

    // Get audit logs with user information
    const results = await this.db
      .select({
        auditLog: poAuditLog,
        user: {
          id: users.id,
          email: users.email,
          role: users.role,
        },
      })
      .from(poAuditLog)
      .innerJoin(users, eq(poAuditLog.performedBy, users.id))
      .where(whereClause)
      .orderBy(desc(poAuditLog.performedAt))
      .limit(limit)
      .offset(offset);

    // Transform results to include user information
    return results.map(result => ({
      ...result.auditLog,
      performedByUser: result.user,
    }));
  }

  /**
   * Get comprehensive compliance report for purchase order audit logs
   * Requirements: 2.9
   */
  async getComplianceReport(
    tenantId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      action?: POAuditActionType;
      userId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ auditLogs: POAuditLogWithUser[]; total: number }> {
    if (!tenantId) {
      throw new Error('Tenant ID is required for compliance report access');
    }

    const { 
      startDate, 
      endDate, 
      action, 
      userId, 
      limit = 100, 
      offset = 0 
    } = options;

    // Build base query with tenant isolation
    let whereConditions = [eq(poAuditLog.tenantId, tenantId)];

    // Add date range filters
    if (startDate) {
      whereConditions.push(sql`${poAuditLog.performedAt} >= ${startDate.getTime()}`);
    }

    if (endDate) {
      whereConditions.push(sql`${poAuditLog.performedAt} <= ${endDate.getTime()}`);
    }

    // Add optional filters
    if (action) {
      whereConditions.push(eq(poAuditLog.action, action));
    }

    if (userId) {
      whereConditions.push(eq(poAuditLog.performedBy, userId));
    }

    const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

    // Get audit logs with user information
    const auditLogs = await this.db
      .select({
        auditLog: poAuditLog,
        user: {
          id: users.id,
          email: users.email,
          role: users.role,
        },
      })
      .from(poAuditLog)
      .innerJoin(users, eq(poAuditLog.performedBy, users.id))
      .where(whereClause)
      .orderBy(desc(poAuditLog.performedAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(poAuditLog)
      .where(whereClause);

    // Transform results to include user information
    const auditLogsWithUser: POAuditLogWithUser[] = auditLogs.map(result => ({
      ...result.auditLog,
      performedByUser: result.user,
    }));

    return {
      auditLogs: auditLogsWithUser,
      total: countResult?.count || 0,
    };
  }

  /**
   * Get audit statistics for a tenant (for admin dashboard)
   * Requirements: 2.9
   */
  async getAuditStats(tenantId: string, dateRange?: { startDate: Date; endDate: Date }): Promise<{
    totalEvents: number;
    createdPOs: number;
    approvedPOs: number;
    receivedPOs: number;
    cancelledPOs: number;
    itemChanges: number;
    topUsers: Array<{ userId: string; email: string; eventCount: number }>;
  }> {
    if (!tenantId) {
      throw new Error('Tenant ID is required for audit statistics');
    }

    // Build date filter if provided
    let whereConditions = [eq(poAuditLog.tenantId, tenantId)];
    
    if (dateRange) {
      whereConditions.push(sql`${poAuditLog.performedAt} >= ${dateRange.startDate.getTime()}`);
      whereConditions.push(sql`${poAuditLog.performedAt} <= ${dateRange.endDate.getTime()}`);
    }

    const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

    // Get all audit logs for the tenant within date range
    const allLogs = await this.db
      .select({
        auditLog: poAuditLog,
        user: {
          id: users.id,
          email: users.email,
        },
      })
      .from(poAuditLog)
      .innerJoin(users, eq(poAuditLog.performedBy, users.id))
      .where(whereClause);

    // Calculate statistics
    const stats = {
      totalEvents: allLogs.length,
      createdPOs: allLogs.filter(log => log.auditLog.action === POAuditAction.CREATED).length,
      approvedPOs: allLogs.filter(log => log.auditLog.action === POAuditAction.APPROVED).length,
      receivedPOs: allLogs.filter(log => log.auditLog.action === POAuditAction.RECEIVED).length,
      cancelledPOs: allLogs.filter(log => log.auditLog.action === POAuditAction.CANCELLED).length,
      itemChanges: allLogs.filter(log => 
        [POAuditAction.ITEM_ADDED, POAuditAction.ITEM_UPDATED, POAuditAction.ITEM_REMOVED]
          .includes(log.auditLog.action as POAuditActionType)
      ).length,
      topUsers: [] as Array<{ userId: string; email: string; eventCount: number }>,
    };

    // Calculate top users by activity
    const userActivity = allLogs.reduce((acc, log) => {
      const userId = log.auditLog.performedBy;
      const email = log.user.email;
      
      if (!acc[userId]) {
        acc[userId] = { userId, email, eventCount: 0 };
      }
      acc[userId].eventCount++;
      
      return acc;
    }, {} as Record<string, { userId: string; email: string; eventCount: number }>);

    stats.topUsers = Object.values(userActivity)
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10); // Top 10 most active users

    return stats;
  }
}

/**
 * Factory function to create POAuditService instance
 */
export function createPOAuditService(db: DrizzleD1Database): IPOAuditService {
  return new POAuditService(db);
}

/**
 * Helper function to extract PO audit context from Hono request
 */
export function extractPOAuditContext(
  c: any,
  poId: string,
  action: POAuditActionType,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>,
  notes?: string
): POAuditContext {
  const authContext = c.get('auth');
  const request = c.req;

  return {
    tenantId: authContext?.tenant_id,
    userId: authContext?.user_id,
    poId,
    action,
    oldValues,
    newValues,
    notes,
    ipAddress: request.header('cf-connecting-ip') || request.header('x-forwarded-for') || 'unknown',
    userAgent: request.header('user-agent') || 'unknown',
  };
}