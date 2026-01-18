import { z } from 'zod';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { authAuditLog, type NewAuthAuditLog } from '../db/schema';

/**
 * Comprehensive Audit Logging Service
 * Requirements: 8.5, 9.4
 */

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId?: string;
  eventType: string;
  resource?: string;
  action?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  createdAt: number;
}

export interface AuditQueryOptions {
  tenantId: string;
  userId?: string;
  eventType?: string;
  resource?: string;
  action?: string;
  dateFrom?: Date;
  dateTo?: Date;
  ipAddress?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AuditSummary {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByUser: Record<string, number>;
  eventsByResource: Record<string, number>;
  recentActivity: AuditLogEntry[];
  suspiciousActivity: AuditLogEntry[];
}

/**
 * Audit event types
 */
export const AuditEventTypes = {
  // Authentication events
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  PASSWORD_RESET: 'PASSWORD_RESET',
  
  // Authorization events
  ACCESS_GRANTED: 'ACCESS_GRANTED',
  ACCESS_DENIED: 'ACCESS_DENIED',
  PERMISSION_CHANGE: 'PERMISSION_CHANGE',
  
  // CRUD operations
  CREATE: 'CREATE',
  READ: 'READ',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  BULK_CREATE: 'BULK_CREATE',
  BULK_UPDATE: 'BULK_UPDATE',
  BULK_DELETE: 'BULK_DELETE',
  
  // Data operations
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
  BACKUP: 'BACKUP',
  RESTORE: 'RESTORE',
  
  // System events
  SYSTEM_START: 'SYSTEM_START',
  SYSTEM_STOP: 'SYSTEM_STOP',
  CONFIGURATION_CHANGE: 'CONFIGURATION_CHANGE',
  
  // Security events
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  BRUTE_FORCE_ATTEMPT: 'BRUTE_FORCE_ATTEMPT',
  
  // Business events
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_APPROVED: 'ORDER_APPROVED',
  TRANSFER_INITIATED: 'TRANSFER_INITIATED',
  ALLOCATION_CREATED: 'ALLOCATION_CREATED',
} as const;

export type AuditEventType = typeof AuditEventTypes[keyof typeof AuditEventTypes];

/**
 * Audit validation schemas
 */
export const auditLogSchema = z.object({
  eventType: z.string().min(1),
  resource: z.string().optional(),
  action: z.string().optional(),
  oldValues: z.record(z.any()).optional(),
  newValues: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

export const auditQuerySchema = z.object({
  userId: z.string().optional(),
  eventType: z.string().optional(),
  resource: z.string().optional(),
  action: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  ipAddress: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Comprehensive Audit Service
 */
export class ComprehensiveAuditService {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Log an audit event
   */
  async logEvent(
    tenantId: string,
    eventType: AuditEventType,
    options: {
      userId?: string;
      resource?: string;
      action?: string;
      oldValues?: Record<string, any>;
      newValues?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      requestId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    try {
      const auditEntry: NewAuthAuditLog = {
        id: crypto.randomUUID(),
        tenantId,
        userId: options.userId,
        eventType,
        resource: options.resource,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        createdAt: Date.now(),
      };

      await this.db.insert(authAuditLog).values(auditEntry);

      // Log to console for development/debugging
      console.log('Audit Event:', {
        eventType,
        tenantId,
        userId: options.userId,
        resource: options.resource,
        action: options.action,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Log authentication events
   */
  async logAuthEvent(
    eventType: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOGOUT',
    tenantId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent(tenantId, eventType, {
      userId,
      resource: 'authentication',
      ipAddress,
      userAgent,
      metadata,
    });
  }

  /**
   * Log CRUD operations
   */
  async logCrudOperation(
    operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE',
    tenantId: string,
    userId: string,
    resource: string,
    resourceId: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent(tenantId, operation, {
      userId,
      resource: `${resource}:${resourceId}`,
      action: operation.toLowerCase(),
      oldValues,
      newValues,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log bulk operations
   */
  async logBulkOperation(
    operation: 'BULK_CREATE' | 'BULK_UPDATE' | 'BULK_DELETE',
    tenantId: string,
    userId: string,
    resource: string,
    metadata: {
      recordIds?: string[];
      recordCount: number;
      filters?: Record<string, any>;
      [key: string]: any;
    },
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent(tenantId, operation, {
      userId,
      resource,
      action: operation.toLowerCase().replace('bulk_', ''),
      metadata,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log security events
   */
  async logSecurityEvent(
    eventType: 'SUSPICIOUS_ACTIVITY' | 'RATE_LIMIT_EXCEEDED' | 'INVALID_TOKEN' | 'BRUTE_FORCE_ATTEMPT',
    tenantId: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logEvent(tenantId, eventType, {
      userId,
      resource: 'security',
      ipAddress,
      userAgent,
      metadata,
    });
  }

  /**
   * Log data export/import events
   */
  async logDataOperation(
    operation: 'EXPORT' | 'IMPORT' | 'BACKUP' | 'RESTORE',
    tenantId: string,
    userId: string,
    resource: string,
    metadata: {
      format?: string;
      recordCount?: number;
      fileSize?: number;
      filters?: Record<string, any>;
      [key: string]: any;
    },
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent(tenantId, operation, {
      userId,
      resource,
      action: operation.toLowerCase(),
      metadata,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Query audit logs with filtering and pagination
   */
  async queryAuditLogs(options: AuditQueryOptions): Promise<{
    logs: AuditLogEntry[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        tenantId,
        userId,
        eventType,
        resource,
        dateFrom,
        dateTo,
        ipAddress,
        page = 1,
        limit = 50,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = options;

      // Build query conditions
      const conditions = [eq(authAuditLog.tenantId, tenantId)];

      if (userId) {
        conditions.push(eq(authAuditLog.userId, userId));
      }

      if (eventType) {
        conditions.push(eq(authAuditLog.eventType, eventType));
      }

      if (resource) {
        conditions.push(eq(authAuditLog.resource, resource));
      }

      if (ipAddress) {
        conditions.push(eq(authAuditLog.ipAddress, ipAddress));
      }

      if (dateFrom) {
        conditions.push(gte(authAuditLog.createdAt, dateFrom.getTime()));
      }

      if (dateTo) {
        conditions.push(lte(authAuditLog.createdAt, dateTo.getTime()));
      }

      // Build query
      let query = this.db
        .select()
        .from(authAuditLog)
        .where(and(...conditions));

      // Apply sorting
      const sortColumn = authAuditLog[sortBy as keyof typeof authAuditLog] || authAuditLog.createdAt;
      query = query.orderBy(sortOrder === 'asc' ? sortColumn : desc(sortColumn));

      // Apply pagination
      const offset = (page - 1) * limit;
      query = query.limit(limit).offset(offset);

      // Execute query
      const logs = await query;

      // Get total count
      const countQuery = this.db
        .select({ count: authAuditLog.id })
        .from(authAuditLog)
        .where(and(...conditions));
      
      const countResult = await countQuery;
      const total = countResult.length;

      return {
        logs: logs.map(this.mapAuditLogEntry),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Error querying audit logs:', error);
      throw error;
    }
  }

  /**
   * Generate audit summary for a tenant
   */
  async generateAuditSummary(
    tenantId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<AuditSummary> {
    try {
      const conditions = [eq(authAuditLog.tenantId, tenantId)];

      if (dateFrom) {
        conditions.push(gte(authAuditLog.createdAt, dateFrom.getTime()));
      }

      if (dateTo) {
        conditions.push(lte(authAuditLog.createdAt, dateTo.getTime()));
      }

      // Get all logs for the period
      const logs = await this.db
        .select()
        .from(authAuditLog)
        .where(and(...conditions))
        .orderBy(desc(authAuditLog.createdAt));

      // Calculate statistics
      const eventsByType: Record<string, number> = {};
      const eventsByUser: Record<string, number> = {};
      const eventsByResource: Record<string, number> = {};
      const suspiciousActivity: AuditLogEntry[] = [];

      logs.forEach((log: any) => {
        // Count by event type
        eventsByType[log.eventType] = (eventsByType[log.eventType] || 0) + 1;

        // Count by user
        if (log.userId) {
          eventsByUser[log.userId] = (eventsByUser[log.userId] || 0) + 1;
        }

        // Count by resource
        if (log.resource) {
          eventsByResource[log.resource] = (eventsByResource[log.resource] || 0) + 1;
        }

        // Identify suspicious activity
        if (this.isSuspiciousActivity(log)) {
          suspiciousActivity.push(this.mapAuditLogEntry(log));
        }
      });

      return {
        totalEvents: logs.length,
        eventsByType,
        eventsByUser,
        eventsByResource,
        recentActivity: logs.slice(0, 20).map(this.mapAuditLogEntry),
        suspiciousActivity: suspiciousActivity.slice(0, 10),
      };
    } catch (error) {
      console.error('Error generating audit summary:', error);
      throw error;
    }
  }

  /**
   * Detect suspicious activity patterns
   */
  async detectSuspiciousActivity(
    tenantId: string,
    timeWindowHours = 24
  ): Promise<{
    suspiciousIPs: string[];
    suspiciousUsers: string[];
    suspiciousPatterns: Array<{
      pattern: string;
      count: number;
      description: string;
    }>;
  }> {
    try {
      const dateFrom = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
      
      const logs = await this.db
        .select()
        .from(authAuditLog)
        .where(
          and(
            eq(authAuditLog.tenantId, tenantId),
            gte(authAuditLog.createdAt, dateFrom.getTime())
          )
        );

      const suspiciousIPs: string[] = [];
      const suspiciousUsers: string[] = [];
      const suspiciousPatterns: Array<{
        pattern: string;
        count: number;
        description: string;
      }> = [];

      // Analyze patterns
      const ipFailures: Record<string, number> = {};
      const userFailures: Record<string, number> = {};
      const eventCounts: Record<string, number> = {};

      logs.forEach((log: any) => {
        // Count login failures by IP
        if (log.eventType === 'LOGIN_FAILURE' && log.ipAddress) {
          ipFailures[log.ipAddress] = (ipFailures[log.ipAddress] || 0) + 1;
        }

        // Count login failures by user
        if (log.eventType === 'LOGIN_FAILURE' && log.userId) {
          userFailures[log.userId] = (userFailures[log.userId] || 0) + 1;
        }

        // Count all events
        eventCounts[log.eventType] = (eventCounts[log.eventType] || 0) + 1;
      });

      // Identify suspicious IPs (more than 10 failed logins)
      Object.entries(ipFailures).forEach(([ip, count]) => {
        if (count > 10) {
          suspiciousIPs.push(ip);
          suspiciousPatterns.push({
            pattern: 'BRUTE_FORCE_IP',
            count,
            description: `IP ${ip} had ${count} failed login attempts`,
          });
        }
      });

      // Identify suspicious users (more than 5 failed logins)
      Object.entries(userFailures).forEach(([userId, count]) => {
        if (count > 5) {
          suspiciousUsers.push(userId);
          suspiciousPatterns.push({
            pattern: 'BRUTE_FORCE_USER',
            count,
            description: `User ${userId} had ${count} failed login attempts`,
          });
        }
      });

      // Check for unusual activity spikes
      const totalEvents = logs.length;
      const avgEventsPerHour = totalEvents / timeWindowHours;
      
      if (avgEventsPerHour > 1000) {
        suspiciousPatterns.push({
          pattern: 'HIGH_ACTIVITY',
          count: totalEvents,
          description: `Unusually high activity: ${totalEvents} events in ${timeWindowHours} hours`,
        });
      }

      return {
        suspiciousIPs,
        suspiciousUsers,
        suspiciousPatterns,
      };
    } catch (error) {
      console.error('Error detecting suspicious activity:', error);
      throw error;
    }
  }

  /**
   * Clean up old audit logs based on retention policy
   */
  async cleanupOldLogs(
    tenantId: string,
    retentionDays = 365
  ): Promise<{ deletedCount: number }> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      
      // Get count of logs to be deleted
      const logsToDelete = await this.db
        .select({ count: authAuditLog.id })
        .from(authAuditLog)
        .where(
          and(
            eq(authAuditLog.tenantId, tenantId),
            lte(authAuditLog.createdAt, cutoffDate.getTime())
          )
        );

      const deletedCount = logsToDelete.length;

      // Delete old logs
      if (deletedCount > 0) {
        await this.db
          .delete(authAuditLog)
          .where(
            and(
              eq(authAuditLog.tenantId, tenantId),
              lte(authAuditLog.createdAt, cutoffDate.getTime())
            )
          );

        // Log the cleanup operation
        await this.logEvent(tenantId, 'SYSTEM_MAINTENANCE', {
          resource: 'audit_logs',
          action: 'cleanup',
          metadata: {
            deletedCount,
            retentionDays,
            cutoffDate: cutoffDate.toISOString(),
          },
        });
      }

      return { deletedCount };
    } catch (error) {
      console.error('Error cleaning up audit logs:', error);
      throw error;
    }
  }

  /**
   * Map database audit log to AuditLogEntry
   */
  private mapAuditLogEntry(log: any): AuditLogEntry {
    return {
      id: log.id,
      tenantId: log.tenantId,
      userId: log.userId,
      eventType: log.eventType,
      resource: log.resource,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
    };
  }

  /**
   * Check if an audit log entry represents suspicious activity
   */
  private isSuspiciousActivity(log: any): boolean {
    const suspiciousEventTypes = [
      'LOGIN_FAILURE',
      'ACCESS_DENIED',
      'SUSPICIOUS_ACTIVITY',
      'RATE_LIMIT_EXCEEDED',
      'INVALID_TOKEN',
      'BRUTE_FORCE_ATTEMPT',
    ];

    return suspiciousEventTypes.includes(log.eventType);
  }
}

/**
 * Audit utilities
 */
export const auditUtils = {
  /**
   * Format audit log entry for display
   */
  formatAuditEntry(entry: AuditLogEntry): string {
    const timestamp = new Date(entry.createdAt).toLocaleString();
    const user = entry.userId || 'System';
    const resource = entry.resource || 'Unknown';
    
    return `[${timestamp}] ${user} performed ${entry.eventType} on ${resource}`;
  },

  /**
   * Get event type description
   */
  getEventTypeDescription(eventType: string): string {
    const descriptions: Record<string, string> = {
      LOGIN_SUCCESS: 'User logged in successfully',
      LOGIN_FAILURE: 'User login failed',
      LOGOUT: 'User logged out',
      CREATE: 'Created new record',
      UPDATE: 'Updated existing record',
      DELETE: 'Deleted record',
      EXPORT: 'Exported data',
      IMPORT: 'Imported data',
      SUSPICIOUS_ACTIVITY: 'Suspicious activity detected',
      RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
    };
    
    return descriptions[eventType] || eventType;
  },

  /**
   * Determine event severity
   */
  getEventSeverity(eventType: string): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      LOGIN_SUCCESS: 'low',
      LOGOUT: 'low',
      READ: 'low',
      CREATE: 'medium',
      UPDATE: 'medium',
      DELETE: 'high',
      BULK_DELETE: 'high',
      LOGIN_FAILURE: 'medium',
      ACCESS_DENIED: 'medium',
      SUSPICIOUS_ACTIVITY: 'critical',
      BRUTE_FORCE_ATTEMPT: 'critical',
      RATE_LIMIT_EXCEEDED: 'high',
    };
    
    return severityMap[eventType] || 'medium';
  },
};