import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';
import { 
  authenticate, 
  injectTenantContext,
  injectAuditService,
  injectAuthorizationService,
  getAuthContext,
  requireRole
} from '../middleware/auth';
import { validateQuery, getValidatedQuery } from '../middleware/error';
import { createPOAuditService } from '../services/po-audit';
import { POAuditActionType } from '../db/schema';

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
}

// Validation schemas
const auditTrailQuerySchema = z.object({
  action: z.enum(['CREATED', 'ITEM_ADDED', 'ITEM_UPDATED', 'ITEM_REMOVED', 'APPROVED', 'RECEIVED', 'CANCELLED']).optional(),
  userId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const complianceReportQuerySchema = z.object({
  startDate: z.string().datetime('Invalid start date format').optional(),
  endDate: z.string().datetime('Invalid end date format').optional(),
  action: z.enum(['CREATED', 'ITEM_ADDED', 'ITEM_UPDATED', 'ITEM_REMOVED', 'APPROVED', 'RECEIVED', 'CANCELLED']).optional(),
  userId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
  format: z.enum(['json', 'csv']).optional().default('json'),
});

const auditStatsQuerySchema = z.object({
  startDate: z.string().datetime('Invalid start date format').optional(),
  endDate: z.string().datetime('Invalid end date format').optional(),
});

// Initialize audit router
const audit = new Hono<{ Bindings: Env }>();

// Apply authentication and context to all routes
audit.use('*', authenticate());
audit.use('*', injectTenantContext());
audit.use('*', injectAuditService());
audit.use('*', injectAuthorizationService());

/**
 * GET /purchase-orders/:poId/audit-trail - Get audit trail for specific purchase order
 * Requirements: 2.9
 * 
 * This endpoint demonstrates:
 * - Complete audit trail retrieval for a specific PO
 * - Tenant isolation for audit data
 * - Filtering by action type and user
 * - Pagination support for large audit trails
 * - Role-based access (ADMIN and MANAGER only)
 */
audit.get('/purchase-orders/:poId/audit-trail',
  requireRole(['ADMIN', 'MANAGER']),
  validateQuery(auditTrailQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const poId = c.req.param('poId');
    const query = getValidatedQuery<{
      action?: POAuditActionType;
      userId?: string;
      limit: number;
      offset: number;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const auditService = createPOAuditService(db);
      
      // Get audit trail for the specific purchase order
      const auditTrail = await auditService.getPOAuditTrail(
        poId,
        authContext.tenant_id,
        {
          ...(query.action && { action: query.action }),
          ...(query.userId && { userId: query.userId }),
          limit: query.limit,
          offset: query.offset,
        }
      );
      
      // Return audit trail with user information
      return c.json({
        poId,
        auditTrail: auditTrail.map(entry => ({
          id: entry.id,
          action: entry.action,
          performedBy: entry.performedBy,
          performedByUser: entry.performedByUser ? {
            id: entry.performedByUser.id,
            email: entry.performedByUser.email,
            role: entry.performedByUser.role,
          } : null,
          performedAt: entry.performedAt,
          oldValues: entry.oldValues ? JSON.parse(entry.oldValues) : null,
          newValues: entry.newValues ? JSON.parse(entry.newValues) : null,
          notes: entry.notes,
        })),
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total: auditTrail.length,
        },
      });
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return c.json({
          error: 'Not Found',
          message: 'Purchase order not found or access denied'
        }, 404);
      }
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /audit/purchase-orders - Get compliance report for all purchase order audit logs
 * Requirements: 2.9
 * 
 * This endpoint demonstrates:
 * - Comprehensive compliance reporting across all POs
 * - Date range filtering for compliance periods
 * - Action type and user filtering
 * - Export capabilities (JSON and CSV formats)
 * - Pagination for large datasets
 * - Role-based access (ADMIN only)
 */
audit.get('/audit/purchase-orders',
  requireRole(['ADMIN']),
  validateQuery(complianceReportQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      startDate?: string;
      endDate?: string;
      action?: POAuditActionType;
      userId?: string;
      limit: number;
      offset: number;
      format: 'json' | 'csv';
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const auditService = createPOAuditService(db);
      
      // Parse date filters
      const options: any = {
        limit: query.limit,
        offset: query.offset,
      };
      
      if (query.startDate) {
        options.startDate = new Date(query.startDate);
      }
      
      if (query.endDate) {
        options.endDate = new Date(query.endDate);
      }
      
      if (query.action) {
        options.action = query.action;
      }
      
      if (query.userId) {
        options.userId = query.userId;
      }
      
      // Get compliance report
      const report = await auditService.getComplianceReport(
        authContext.tenant_id,
        options
      );
      
      // Format response based on requested format
      if (query.format === 'csv') {
        // Generate CSV format for export
        const csvHeaders = [
          'ID',
          'PO ID',
          'Action',
          'Performed By',
          'User Email',
          'User Role',
          'Performed At',
          'Old Values',
          'New Values',
          'Notes'
        ].join(',');
        
        const csvRows = report.auditLogs.map(entry => [
          entry.id,
          entry.poId,
          entry.action,
          entry.performedBy,
          entry.performedByUser?.email || '',
          entry.performedByUser?.role || '',
          new Date(entry.performedAt).toISOString(),
          entry.oldValues ? `"${entry.oldValues.replace(/"/g, '""')}"` : '',
          entry.newValues ? `"${entry.newValues.replace(/"/g, '""')}"` : '',
          entry.notes ? `"${entry.notes.replace(/"/g, '""')}"` : ''
        ].join(','));
        
        const csvContent = [csvHeaders, ...csvRows].join('\n');
        
        // Set CSV headers
        c.header('Content-Type', 'text/csv');
        c.header('Content-Disposition', `attachment; filename="po-audit-report-${new Date().toISOString().split('T')[0]}.csv"`);
        
        return c.text(csvContent);
      }
      
      // Return JSON format
      return c.json({
        complianceReport: {
          auditLogs: report.auditLogs.map(entry => ({
            id: entry.id,
            poId: entry.poId,
            action: entry.action,
            performedBy: entry.performedBy,
            performedByUser: entry.performedByUser ? {
              id: entry.performedByUser.id,
              email: entry.performedByUser.email,
              role: entry.performedByUser.role,
            } : null,
            performedAt: entry.performedAt,
            oldValues: entry.oldValues ? JSON.parse(entry.oldValues) : null,
            newValues: entry.newValues ? JSON.parse(entry.newValues) : null,
            notes: entry.notes,
          })),
          total: report.total,
        },
        filters: {
          startDate: query.startDate,
          endDate: query.endDate,
          action: query.action,
          userId: query.userId,
        },
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total: report.total,
        },
        generatedAt: new Date().toISOString(),
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /audit/purchase-orders/stats - Get audit statistics for dashboard
 * Requirements: 2.9
 * 
 * This endpoint demonstrates:
 * - Audit statistics for admin dashboard
 * - Activity metrics and trends
 * - Top user activity tracking
 * - Date range filtering for statistics
 * - Role-based access (ADMIN and MANAGER only)
 */
audit.get('/audit/purchase-orders/stats',
  requireRole(['ADMIN', 'MANAGER']),
  validateQuery(auditStatsQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      startDate?: string;
      endDate?: string;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const auditService = createPOAuditService(db);
      
      // Parse date range if provided
      let dateRange: { startDate: Date; endDate: Date } | undefined;
      
      if (query.startDate && query.endDate) {
        dateRange = {
          startDate: new Date(query.startDate),
          endDate: new Date(query.endDate),
        };
      }
      
      // Get audit statistics
      const stats = await auditService.getAuditStats(
        authContext.tenant_id,
        dateRange
      );
      
      return c.json({
        statistics: {
          totalEvents: stats.totalEvents,
          purchaseOrderActivity: {
            created: stats.createdPOs,
            approved: stats.approvedPOs,
            received: stats.receivedPOs,
            cancelled: stats.cancelledPOs,
          },
          lineItemActivity: {
            changes: stats.itemChanges,
          },
          topUsers: stats.topUsers.map(user => ({
            userId: user.userId,
            email: user.email,
            eventCount: user.eventCount,
            percentage: stats.totalEvents > 0 ? Math.round((user.eventCount / stats.totalEvents) * 100) : 0,
          })),
        },
        dateRange: dateRange ? {
          startDate: dateRange.startDate.toISOString(),
          endDate: dateRange.endDate.toISOString(),
        } : null,
        generatedAt: new Date().toISOString(),
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /audit/purchase-orders/export - Export audit data in various formats
 * Requirements: 2.9
 * 
 * This endpoint demonstrates:
 * - Bulk audit data export capabilities
 * - Multiple export formats (JSON, CSV)
 * - Large dataset handling with streaming
 * - Comprehensive filtering options
 * - Role-based access (ADMIN only)
 */
audit.get('/audit/purchase-orders/export',
  requireRole(['ADMIN']),
  validateQuery(complianceReportQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      startDate?: string;
      endDate?: string;
      action?: POAuditActionType;
      userId?: string;
      limit: number;
      offset: number;
      format: 'json' | 'csv';
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const auditService = createPOAuditService(db);
      
      // For exports, use a larger limit to get more data
      const exportLimit = Math.min(query.limit, 10000); // Cap at 10k records for performance
      
      // Parse date filters
      const options: any = {
        limit: exportLimit,
        offset: query.offset,
      };
      
      if (query.startDate) {
        options.startDate = new Date(query.startDate);
      }
      
      if (query.endDate) {
        options.endDate = new Date(query.endDate);
      }
      
      if (query.action) {
        options.action = query.action;
      }
      
      if (query.userId) {
        options.userId = query.userId;
      }
      
      // Get audit data for export
      const report = await auditService.getComplianceReport(
        authContext.tenant_id,
        options
      );
      
      const timestamp = new Date().toISOString().split('T')[0];
      
      if (query.format === 'csv') {
        // Generate comprehensive CSV export
        const csvHeaders = [
          'Audit ID',
          'Purchase Order ID',
          'Action Type',
          'Performed By User ID',
          'User Email',
          'User Role',
          'Performed At (UTC)',
          'Performed At (Local)',
          'Old Values (JSON)',
          'New Values (JSON)',
          'Notes',
          'Tenant ID'
        ].join(',');
        
        const csvRows = report.auditLogs.map(entry => {
          const performedAtUTC = new Date(entry.performedAt).toISOString();
          const performedAtLocal = new Date(entry.performedAt).toLocaleString();
          
          return [
            entry.id,
            entry.poId,
            entry.action,
            entry.performedBy,
            entry.performedByUser?.email || '',
            entry.performedByUser?.role || '',
            performedAtUTC,
            performedAtLocal,
            entry.oldValues ? `"${entry.oldValues.replace(/"/g, '""')}"` : '',
            entry.newValues ? `"${entry.newValues.replace(/"/g, '""')}"` : '',
            entry.notes ? `"${entry.notes.replace(/"/g, '""')}"` : '',
            entry.tenantId
          ].join(',');
        });
        
        const csvContent = [csvHeaders, ...csvRows].join('\n');
        
        // Set CSV headers for download
        c.header('Content-Type', 'text/csv; charset=utf-8');
        c.header('Content-Disposition', `attachment; filename="po-audit-export-${timestamp}.csv"`);
        c.header('Cache-Control', 'no-cache');
        
        return c.text(csvContent);
      }
      
      // JSON export format
      const jsonExport = {
        exportMetadata: {
          generatedAt: new Date().toISOString(),
          tenantId: authContext.tenant_id,
          exportedBy: authContext.user_id,
          filters: {
            startDate: query.startDate,
            endDate: query.endDate,
            action: query.action,
            userId: query.userId,
          },
          recordCount: report.auditLogs.length,
          totalRecords: report.total,
        },
        auditLogs: report.auditLogs.map(entry => ({
          id: entry.id,
          tenantId: entry.tenantId,
          poId: entry.poId,
          action: entry.action,
          performedBy: entry.performedBy,
          performedByUser: entry.performedByUser ? {
            id: entry.performedByUser.id,
            email: entry.performedByUser.email,
            role: entry.performedByUser.role,
          } : null,
          performedAt: entry.performedAt,
          performedAtISO: new Date(entry.performedAt).toISOString(),
          oldValues: entry.oldValues ? JSON.parse(entry.oldValues) : null,
          newValues: entry.newValues ? JSON.parse(entry.newValues) : null,
          notes: entry.notes,
        })),
      };
      
      // Set JSON headers for download
      c.header('Content-Type', 'application/json; charset=utf-8');
      c.header('Content-Disposition', `attachment; filename="po-audit-export-${timestamp}.json"`);
      c.header('Cache-Control', 'no-cache');
      
      return c.json(jsonExport);
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

export default audit;