import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc } from 'drizzle-orm';
import { authAuditLog, AuthAuditLog, NewAuthAuditLog } from '../db';
import * as schema from '../db';
import { generateId } from '../utils';

// Audit context interface for capturing request information
export interface AuditContext {
  tenantId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
}

// Audit service interface as defined in the design document
export interface IAuditService {
  logAuthenticationEvent(
    eventType: 'LOGIN' | 'LOGIN_FAILED',
    context: AuditContext
  ): Promise<void>;
  
  logAuthorizationEvent(
    eventType: 'ACCESS_DENIED' | 'PERMISSION_GRANTED',
    context: AuditContext
  ): Promise<void>;
  
  logSensitiveOperation(
    eventType: string,
    context: AuditContext
  ): Promise<void>;
  
  getAuditLogs(
    tenantId: string,
    options?: {
      userId?: string;
      eventType?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<AuthAuditLog[]>;
}

export class AuditService implements IAuditService {
  constructor(private db: DrizzleD1Database<typeof schema>) {}

  /**
   * Log authentication events (login success/failure)
   * Requirements: 8.1, 8.2
   */
  async logAuthenticationEvent(
    eventType: 'LOGIN' | 'LOGIN_FAILED',
    context: AuditContext
  ): Promise<void> {
    await this.createAuditLogEntry(eventType, context);
  }

  /**
   * Log authorization decisions and access control events
   * Requirements: 8.3
   */
  async logAuthorizationEvent(
    eventType: 'ACCESS_DENIED' | 'PERMISSION_GRANTED',
    context: AuditContext
  ): Promise<void> {
    await this.createAuditLogEntry(eventType, context);
  }

  /**
   * Log sensitive operations (user creation, role changes, etc.)
   * Requirements: 8.4
   */
  async logSensitiveOperation(
    eventType: string,
    context: AuditContext
  ): Promise<void> {
    await this.createAuditLogEntry(eventType, context);
  }

  /**
   * Core method to create immutable audit log entries
   * Requirements: 8.5 - Ensure audit logs are immutable from application layer
   */
  private async createAuditLogEntry(
    eventType: string,
    context: AuditContext
  ): Promise<void> {
    try {
      const auditEntry: NewAuthAuditLog = {
        id: generateId(),
        tenantId: context.tenantId || null,
        userId: context.userId || null,
        eventType,
        resource: context.resource || null,
        ipAddress: context.ipAddress || null,
        userAgent: context.userAgent || null,
        createdAt: Date.now(),
      };

      // Insert audit log entry - this is an append-only operation
      // No update or delete operations are provided to ensure immutability
      await this.db
        .insert(authAuditLog)
        .values(auditEntry);

    } catch (error) {
      // Critical: Audit logging failures should not break the main application flow
      // but should be logged to system monitoring
      console.error('Failed to create audit log entry:', {
        eventType,
        context,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // In a production system, this would be sent to external monitoring
      // For now, we continue execution to not break the main flow
    }
  }

  /**
   * Retrieve audit logs for a tenant (admin access only)
   * This method enforces tenant isolation for audit log access
   */
  async getAuditLogs(
    tenantId: string,
    options: {
      userId?: string;
      eventType?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<AuthAuditLog[]> {
    if (!tenantId) {
      throw new Error('Tenant ID is required for audit log access');
    }

    const { userId, eventType, limit = 100, offset = 0 } = options;

    // Build conditions array
    const conditions = [eq(authAuditLog.tenantId, tenantId)];

    if (userId) {
      conditions.push(eq(authAuditLog.userId, userId));
    }

    if (eventType) {
      conditions.push(eq(authAuditLog.eventType, eventType));
    }

    // Execute query with combined conditions
    const results = await this.db
      .select()
      .from(authAuditLog)
      .where(and(...conditions))
      .orderBy(desc(authAuditLog.createdAt))
      .limit(limit)
      .offset(offset);

    return results;
  }

  /**
   * Get audit log statistics for a tenant (for admin dashboard)
   */
  async getAuditStats(tenantId: string): Promise<{
    totalEvents: number;
    loginAttempts: number;
    failedLogins: number;
    accessDenials: number;
  }> {
    if (!tenantId) {
      throw new Error('Tenant ID is required for audit statistics');
    }

    const allLogs = await this.db
      .select()
      .from(authAuditLog)
      .where(eq(authAuditLog.tenantId, tenantId));

    const stats = {
      totalEvents: allLogs.length,
      loginAttempts: allLogs.filter(log => log.eventType === 'LOGIN').length,
      failedLogins: allLogs.filter(log => log.eventType === 'LOGIN_FAILED').length,
      accessDenials: allLogs.filter(log => log.eventType === 'ACCESS_DENIED').length,
    };

    return stats;
  }
}

/**
 * Factory function to create AuditService instance
 */
export function createAuditService(db: DrizzleD1Database<typeof schema>): IAuditService {
  return new AuditService(db);
}

/**
 * Helper function to extract audit context from Hono request
 */
export function extractAuditContext(c: any): AuditContext {
  const authContext = c.get('auth');
  const request = c.req;

  return {
    tenantId: authContext?.tenant_id,
    userId: authContext?.user_id,
    ipAddress: request.header('cf-connecting-ip') || request.header('x-forwarded-for') || 'unknown',
    userAgent: request.header('user-agent') || 'unknown',
    resource: `${request.method} ${request.path}`,
  };
}