import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';
import { 
  authenticate, 
  injectTenantContext,
  getAuthContext,
  requireRole
} from '../middleware/auth';
import { validateQuery, getValidatedQuery } from '../middleware/error';
import { createAuditLogger } from '../services/audit-logger';
import { createInventoryConsumptionTracker } from '../services/inventory-consumption-tracker';

/**
 * Comprehensive Audit Routes
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 * 
 * Provides API endpoints for comprehensive audit logging including:
 * - Order state transitions
 * - Payment transactions
 * - Inventory consumption
 * - Audit trail reports
 * - Compliance reporting
 */

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
}

// Validation schemas
const auditQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  action: z.string().optional(),
  userId: z.string().optional(),
  userType: z.enum(['waiter', 'kitchen', 'cashier', 'manager', 'system', 'customer']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const auditReportSchema = z.object({
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  entityTypes: z.string().optional(), // Comma-separated list
  format: z.enum(['json', 'csv']).optional().default('json'),
});

const consumptionReportSchema = z.object({
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  locationId: z.string().optional(),
  format: z.enum(['json', 'csv']).optional().default('json'),
});

// Initialize comprehensive audit router
const comprehensiveAudit = new Hono<{ Bindings: Env }>();

// Apply authentication and context to all routes
comprehensiveAudit.use('*', authenticate());
comprehensiveAudit.use('*', injectTenantContext());

/**
 * GET /audit/logs - Query audit logs with filtering
 * Requirements: 9.5
 */
comprehensiveAudit.get('/audit/logs',
  requireRole(['ADMIN', 'MANAGER']),
  validateQuery(auditQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      entityType?: string;
      entityId?: string;
      action?: string;
      userId?: string;
      userType?: 'waiter' | 'kitchen' | 'cashier' | 'manager' | 'system' | 'customer';
      dateFrom?: string;
      dateTo?: string;
      limit: number;
      offset: number;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const auditLogger = createAuditLogger(db);
      
      const logs = await auditLogger.queryAuditLogs({
        tenantId: authContext.tenant_id,
        entityType: query.entityType,
        entityId: query.entityId,
        action: query.action,
        userId: query.userId,
        userType: query.userType,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
        limit: query.limit,
        offset: query.offset,
      });
      
      return c.json({
        logs: logs.map(log => ({
          id: log.id,
          entityType: log.entityType,
          entityId: log.entityId,
          action: log.action,
          oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
          newValue: log.newValue ? JSON.parse(log.newValue) : null,
          userId: log.userId,
          userType: log.userType,
          timestamp: log.timestamp,
          timestampISO: new Date(log.timestamp).toISOString(),
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          metadata: log.metadata ? JSON.parse(log.metadata) : null,
        })),
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total: logs.length,
        },
      });
      
    } catch (error) {
      throw error;
    }
  }
);

/**
 * GET /audit/trail-report - Generate audit trail report
 * Requirements: 9.5
 */
comprehensiveAudit.get('/audit/trail-report',
  requireRole(['ADMIN', 'MANAGER']),
  validateQuery(auditReportSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      dateFrom: string;
      dateTo: string;
      entityTypes?: string;
      format: 'json' | 'csv';
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const auditLogger = createAuditLogger(db);
      
      const dateFrom = new Date(query.dateFrom);
      const dateTo = new Date(query.dateTo);
      const entityTypes = query.entityTypes ? query.entityTypes.split(',') : undefined;
      
      const report = await auditLogger.generateAuditTrailReport(
        authContext.tenant_id,
        dateFrom,
        dateTo,
        entityTypes
      );
      
      if (query.format === 'csv') {
        const csv = await auditLogger.exportAuditLogsToCSV(
          authContext.tenant_id,
          dateFrom,
          dateTo
        );
        
        const timestamp = new Date().toISOString().split('T')[0];
        c.header('Content-Type', 'text/csv; charset=utf-8');
        c.header('Content-Disposition', `attachment; filename="audit-trail-${timestamp}.csv"`);
        
        return c.text(csv);
      }
      
      return c.json({
        report: {
          logs: report.logs.map(log => ({
            id: log.id,
            entityType: log.entityType,
            entityId: log.entityId,
            action: log.action,
            oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
            newValue: log.newValue ? JSON.parse(log.newValue) : null,
            userId: log.userId,
            userType: log.userType,
            timestamp: log.timestamp,
            timestampISO: new Date(log.timestamp).toISOString(),
          })),
          total: report.total,
          summary: report.summary,
        },
        filters: {
          dateFrom: dateFrom.toISOString(),
          dateTo: dateTo.toISOString(),
          entityTypes,
        },
        generatedAt: new Date().toISOString(),
      });
      
    } catch (error) {
      throw error;
    }
  }
);

/**
 * GET /audit/statistics - Get audit statistics
 * Requirements: 9.5
 */
comprehensiveAudit.get('/audit/statistics',
  requireRole(['ADMIN', 'MANAGER']),
  validateQuery(auditReportSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      dateFrom: string;
      dateTo: string;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const auditLogger = createAuditLogger(db);
      
      const dateFrom = new Date(query.dateFrom);
      const dateTo = new Date(query.dateTo);
      
      const stats = await auditLogger.getAuditStatistics(
        authContext.tenant_id,
        dateFrom,
        dateTo
      );
      
      return c.json({
        statistics: stats,
        dateRange: {
          from: dateFrom.toISOString(),
          to: dateTo.toISOString(),
        },
        generatedAt: new Date().toISOString(),
      });
      
    } catch (error) {
      throw error;
    }
  }
);

/**
 * GET /audit/inventory-consumption/:orderId - Get consumption records for an order
 * Requirements: 9.2
 */
comprehensiveAudit.get('/audit/inventory-consumption/:orderId',
  requireRole(['ADMIN', 'MANAGER', 'KITCHEN']),
  async (c) => {
    const authContext = getAuthContext(c);
    const orderId = c.req.param('orderId');
    
    try {
      const db = drizzle(c.env.DB);
      const tracker = createInventoryConsumptionTracker(db);
      
      const consumptions = await tracker.getOrderConsumptions(
        authContext.tenant_id,
        orderId
      );
      
      return c.json({
        orderId,
        consumptions: consumptions.map(c => ({
          id: c.id,
          productId: c.productId,
          locationId: c.locationId,
          quantityConsumed: c.quantityConsumed,
          unit: c.unit,
          consumedAt: c.consumedAt,
          consumedAtISO: new Date(c.consumedAt).toISOString(),
          reversedAt: c.reversedAt,
          reversedAtISO: c.reversedAt ? new Date(c.reversedAt).toISOString() : null,
          reversedBy: c.reversedBy,
          notes: c.notes,
        })),
        total: consumptions.length,
      });
      
    } catch (error) {
      throw error;
    }
  }
);

/**
 * GET /audit/inventory-consumption/report - Generate consumption report
 * Requirements: 9.2
 */
comprehensiveAudit.get('/audit/inventory-consumption/report',
  requireRole(['ADMIN', 'MANAGER']),
  validateQuery(consumptionReportSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      dateFrom: string;
      dateTo: string;
      locationId?: string;
      format: 'json' | 'csv';
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const tracker = createInventoryConsumptionTracker(db);
      
      const dateFrom = new Date(query.dateFrom);
      const dateTo = new Date(query.dateTo);
      
      if (query.format === 'csv') {
        const csv = await tracker.exportConsumptionsToCSV(
          authContext.tenant_id,
          dateFrom,
          dateTo
        );
        
        const timestamp = new Date().toISOString().split('T')[0];
        c.header('Content-Type', 'text/csv; charset=utf-8');
        c.header('Content-Disposition', `attachment; filename="consumption-report-${timestamp}.csv"`);
        
        return c.text(csv);
      }
      
      const report = await tracker.generateConsumptionReport(
        authContext.tenant_id,
        dateFrom,
        dateTo,
        query.locationId
      );
      
      return c.json({
        report: {
          consumptions: report.consumptions.map(c => ({
            id: c.id,
            orderId: c.orderId,
            productId: c.productId,
            locationId: c.locationId,
            quantityConsumed: c.quantityConsumed,
            unit: c.unit,
            consumedAt: c.consumedAt,
            consumedAtISO: new Date(c.consumedAt).toISOString(),
            reversedAt: c.reversedAt,
            reversedAtISO: c.reversedAt ? new Date(c.reversedAt).toISOString() : null,
            reversedBy: c.reversedBy,
            notes: c.notes,
          })),
          total: report.total,
          summary: report.summary,
        },
        filters: {
          dateFrom: dateFrom.toISOString(),
          dateTo: dateTo.toISOString(),
          locationId: query.locationId,
        },
        generatedAt: new Date().toISOString(),
      });
      
    } catch (error) {
      throw error;
    }
  }
);

/**
 * GET /audit/inventory-consumption/location/:locationId/stats - Get location consumption stats
 * Requirements: 9.2
 */
comprehensiveAudit.get('/audit/inventory-consumption/location/:locationId/stats',
  requireRole(['ADMIN', 'MANAGER']),
  validateQuery(consumptionReportSchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const locationId = c.req.param('locationId');
    const query = getValidatedQuery<{
      dateFrom: string;
      dateTo: string;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const tracker = createInventoryConsumptionTracker(db);
      
      const dateFrom = new Date(query.dateFrom);
      const dateTo = new Date(query.dateTo);
      
      const stats = await tracker.getLocationConsumptionStats(
        authContext.tenant_id,
        locationId,
        dateFrom,
        dateTo
      );
      
      return c.json({
        locationId,
        statistics: stats,
        dateRange: {
          from: dateFrom.toISOString(),
          to: dateTo.toISOString(),
        },
        generatedAt: new Date().toISOString(),
      });
      
    } catch (error) {
      throw error;
    }
  }
);

export default comprehensiveAudit;
