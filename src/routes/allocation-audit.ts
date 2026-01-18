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
import { createAllocationAuditService } from '../services/allocation-audit';
import { AllocationAuditActionType } from '../db';

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
}

// Validation schemas
const auditTrailQuerySchema = z.object({
  action: z.enum(['CREATED', 'UPDATED', 'DELETED', 'STATUS_CHANGED']).optional(),
  performedBy: z.string().optional(),
  dateFrom: z.string().datetime('Invalid date format').optional(),
  dateTo: z.string().datetime('Invalid date format').optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const complianceReportQuerySchema = z.object({
  dateFrom: z.string().datetime('Invalid start date format'),
  dateTo: z.string().datetime('Invalid end date format'),
  action: z.enum(['CREATED', 'UPDATED', 'DELETED', 'STATUS_CHANGED']).optional(),
  performedBy: z.string().optional(),
  locationId: z.string().optional(),
  poId: z.string().optional(),
  format: z.enum(['json', 'csv']).optional().default('json'),
});

const auditSummaryQuerySchema = z.object({
  dateFrom: z.string().datetime('Invalid start date format').optional(),
  dateTo: z.string().datetime('Invalid end date format').optional(),
});

const exportQuerySchema = z.object({
  action: z.enum(['CREATED', 'UPDATED', 'DELETED', 'STATUS_CHANGED']).optional(),
  performedBy: z.string().optional(),
  dateFrom: z.string().datetime('Invalid date format').optional(),
  dateTo: z.string().datetime('Invalid date format').optional(),
  locationId: z.string().optional(),
  poId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional().default(1000),
  offset: z.coerce.number().int().min(0).optional().default(0),
  format: z.enum(['json', 'csv']).optional().default('json'),
});

// Initialize allocation audit router
const allocationAudit = new Hono<{ Bindings: Env }>();

// Apply authentication and context to all routes
allocationAudit.use('*', authenticate());
allocationAudit.use('*', injectTenantContext());
allocationAudit.use('*', injectAuditService());
allocationAudit.use('*', injectAuthorizationService());

/**
 * GET /allocations/:id/audit-trail - Get audit trail for specific allocation
 * Requirements: 6.5
 * 
 * This endpoint provides:
 * - Complete audit trail retrieval for a specific allocation
 * - Tenant isolation for audit data
 * - Filtering by action type and user
 * - Pagination support for large audit trails
 * - Role-based access (ADMIN and MANAGER only)
 */
allocationAudit.get('/allocations/:id/audit-trail',
  requireRole(['ADMIN', 'MANAGER']),
  validateQuery(auditTrailQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const allocationId = c.req.param('id');
    const query = getValidatedQuery<{
      action?: AllocationAuditActionType;
      performedBy?: string;
      dateFrom?: string;
      dateTo?: string;
      limit: number;
      offset: number;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const auditService = createAllocationAuditService(db);
      
      // Build filters from query parameters
      const filters: any = {
        limit: query.limit,
        offset: query.offset,
      };
      
      if (query.action) {
        filters.action = query.action;
      }
      
      if (query.performedBy) {
        filters.performedBy = query.performedBy;
      }
      
      if (query.dateFrom) {
        filters.dateFrom = new Date(query.dateFrom);
      }
      
      if (query.dateTo) {
        filters.dateTo = new Date(query.dateTo);
      }
      
      // Get audit trail for the specific allocation
      const auditTrail = await auditService.getAuditTrail(
        allocationId,
        authContext.tenant_id,
        filters
      );
      
      // Return audit trail with enriched user and allocation information
      return c.json({
        allocationId,
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
          performedAtISO: new Date(entry.performedAt).toISOString(),
          oldValues: entry.oldValues,
          newValues: entry.newValues,
          notes: entry.notes,
          allocation: entry.allocation ? {
            id: entry.allocation.id,
            targetLocationName: entry.allocation.targetLocationName,
            productName: entry.allocation.productName,
            poNumber: entry.allocation.poNumber,
          } : null,
        })),
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total: auditTrail.length,
        },
        filters: {
          action: query.action,
          performedBy: query.performedBy,
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
        },
      });
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return c.json({
          error: 'Not Found',
          message: 'Allocation not found or access denied'
        }, 404);
      }
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /audit/allocations - Get compliance report for all allocation audit logs
 * Requirements: 6.5
 * 
 * This endpoint provides:
 * - Comprehensive compliance reporting across all allocations
 * - Date range filtering for compliance periods
 * - Action type, user, location, and PO filtering
 * - Export capabilities (JSON and CSV formats)
 * - Pagination for large datasets
 * - Role-based access (ADMIN only)
 */
allocationAudit.get('/audit/allocations',
  requireRole(['ADMIN']),
  validateQuery(complianceReportQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      dateFrom: string;
      dateTo: string;
      action?: AllocationAuditActionType;
      performedBy?: string;
      locationId?: string;
      poId?: string;
      format: 'json' | 'csv';
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const auditService = createAllocationAuditService(db);
      
      // Parse date range (required for compliance reports)
      const dateRange = {
        from: new Date(query.dateFrom),
        to: new Date(query.dateTo),
      };
      
      // Generate comprehensive compliance report
      const report = await auditService.generateComplianceReport(
        authContext.tenant_id,
        dateRange,
        authContext.user_id
      );
      
      // Apply additional filters to the audit trail
      let filteredAuditTrail = report.auditTrail;
      
      if (query.action) {
        filteredAuditTrail = filteredAuditTrail.filter(entry => entry.action === query.action);
      }
      
      if (query.performedBy) {
        filteredAuditTrail = filteredAuditTrail.filter(entry => entry.performedBy === query.performedBy);
      }
      
      if (query.locationId) {
        filteredAuditTrail = filteredAuditTrail.filter(entry => 
          entry.allocation?.targetLocationName && 
          entry.allocation.id.includes(query.locationId!)
        );
      }
      
      if (query.poId) {
        filteredAuditTrail = filteredAuditTrail.filter(entry => 
          entry.allocation?.poNumber && 
          entry.allocation.poNumber.includes(query.poId!)
        );
      }
      
      // Format response based on requested format
      if (query.format === 'csv') {
        // Generate CSV format for export
        const csvHeaders = [
          'Audit ID',
          'Allocation ID',
          'Action',
          'Performed By',
          'User Email',
          'User Role',
          'Performed At (UTC)',
          'Location Name',
          'Product Name',
          'PO Number',
          'Old Values',
          'New Values',
          'Notes'
        ].join(',');
        
        const csvRows = filteredAuditTrail.map(entry => [
          entry.id,
          entry.allocationId,
          entry.action,
          entry.performedBy,
          entry.performedByUser?.email || '',
          entry.performedByUser?.role || '',
          new Date(entry.performedAt).toISOString(),
          entry.allocation?.targetLocationName || '',
          entry.allocation?.productName || '',
          entry.allocation?.poNumber || '',
          entry.oldValues ? `"${JSON.stringify(entry.oldValues).replace(/"/g, '""')}"` : '',
          entry.newValues ? `"${JSON.stringify(entry.newValues).replace(/"/g, '""')}"` : '',
          entry.notes ? `"${entry.notes.replace(/"/g, '""')}"` : ''
        ].join(','));
        
        const csvContent = [csvHeaders, ...csvRows].join('\n');
        
        // Set CSV headers
        const timestamp = new Date().toISOString().split('T')[0];
        c.header('Content-Type', 'text/csv; charset=utf-8');
        c.header('Content-Disposition', `attachment; filename="allocation-audit-report-${timestamp}.csv"`);
        
        return c.text(csvContent);
      }
      
      // Return JSON format
      return c.json({
        complianceReport: {
          reportId: report.reportId,
          generatedAt: report.generatedAt,
          generatedBy: report.generatedBy,
          dateRange: {
            from: report.dateRange.from.toISOString(),
            to: report.dateRange.to.toISOString(),
          },
          summary: report.summary,
          auditTrail: filteredAuditTrail.map(entry => ({
            id: entry.id,
            allocationId: entry.allocationId,
            action: entry.action,
            performedBy: entry.performedBy,
            performedByUser: entry.performedByUser ? {
              id: entry.performedByUser.id,
              email: entry.performedByUser.email,
              role: entry.performedByUser.role,
            } : null,
            performedAt: entry.performedAt,
            performedAtISO: new Date(entry.performedAt).toISOString(),
            oldValues: entry.oldValues,
            newValues: entry.newValues,
            notes: entry.notes,
            allocation: entry.allocation ? {
              id: entry.allocation.id,
              targetLocationName: entry.allocation.targetLocationName,
              productName: entry.allocation.productName,
              poNumber: entry.allocation.poNumber,
            } : null,
          })),
          integrityChecks: report.integrityChecks,
        },
        filters: {
          dateFrom: query.dateFrom,
          dateTo: query.dateTo,
          action: query.action,
          performedBy: query.performedBy,
          locationId: query.locationId,
          poId: query.poId,
        },
        generatedAt: new Date().toISOString(),
      });
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('required')) {
        return c.json({
          error: 'Bad Request',
          message: error.message
        }, 400);
      }
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /audit/allocations/summary - Get audit summary statistics for dashboard
 * Requirements: 6.5
 * 
 * This endpoint provides:
 * - Audit statistics for admin dashboard
 * - Activity metrics and trends
 * - Top user activity tracking
 * - Date range filtering for statistics
 * - Role-based access (ADMIN and MANAGER only)
 */
allocationAudit.get('/audit/allocations/summary',
  requireRole(['ADMIN', 'MANAGER']),
  validateQuery(auditSummaryQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      dateFrom?: string;
      dateTo?: string;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const auditService = createAllocationAuditService(db);
      
      // Parse date range if provided
      let dateRange: { from: Date; to: Date } | undefined;
      
      if (query.dateFrom && query.dateTo) {
        dateRange = {
          from: new Date(query.dateFrom),
          to: new Date(query.dateTo),
        };
      }
      
      // Get audit summary statistics
      const summary = await auditService.getAuditSummary(
        authContext.tenant_id,
        dateRange
      );
      
      return c.json({
        summary: {
          totalEvents: summary.totalEvents,
          allocationActivity: {
            created: summary.eventsByAction.CREATED,
            updated: summary.eventsByAction.UPDATED,
            deleted: summary.eventsByAction.DELETED,
            statusChanged: summary.eventsByAction.STATUS_CHANGED,
          },
          topUsers: summary.eventsByUser.map(user => ({
            userId: user.userId,
            email: user.userEmail,
            eventCount: user.eventCount,
            percentage: summary.totalEvents > 0 ? Math.round((user.eventCount / summary.totalEvents) * 100) : 0,
          })),
          recentActivity: summary.recentActivity.map(entry => ({
            id: entry.id,
            allocationId: entry.allocationId,
            action: entry.action,
            performedBy: entry.performedBy,
            performedByUser: entry.performedByUser ? {
              email: entry.performedByUser.email,
              role: entry.performedByUser.role,
            } : null,
            performedAt: entry.performedAt,
            performedAtISO: new Date(entry.performedAt).toISOString(),
            allocation: entry.allocation ? {
              targetLocationName: entry.allocation.targetLocationName,
              productName: entry.allocation.productName,
              poNumber: entry.allocation.poNumber,
            } : null,
          })),
        },
        dateRange: dateRange ? {
          from: dateRange.from.toISOString(),
          to: dateRange.to.toISOString(),
        } : null,
        generatedAt: new Date().toISOString(),
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /audit/allocations/export - Export allocation audit data in various formats
 * Requirements: 6.5
 * 
 * This endpoint provides:
 * - Bulk audit data export capabilities
 * - Multiple export formats (JSON, CSV)
 * - Large dataset handling with pagination
 * - Comprehensive filtering options
 * - Role-based access (ADMIN only)
 */
allocationAudit.get('/audit/allocations/export',
  requireRole(['ADMIN']),
  validateQuery(exportQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      action?: AllocationAuditActionType;
      performedBy?: string;
      dateFrom?: string;
      dateTo?: string;
      locationId?: string;
      poId?: string;
      limit: number;
      offset: number;
      format: 'json' | 'csv';
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const auditService = createAllocationAuditService(db);
      
      // Build filters from query parameters
      const filters: any = {
        limit: query.limit,
        offset: query.offset,
      };
      
      if (query.action) {
        filters.action = query.action;
      }
      
      if (query.performedBy) {
        filters.performedBy = query.performedBy;
      }
      
      if (query.dateFrom) {
        filters.dateFrom = new Date(query.dateFrom);
      }
      
      if (query.dateTo) {
        filters.dateTo = new Date(query.dateTo);
      }
      
      if (query.locationId) {
        filters.locationId = query.locationId;
      }
      
      if (query.poId) {
        filters.poId = query.poId;
      }
      
      // Export audit data using the service
      const exportData = await auditService.exportAuditData(
        authContext.tenant_id,
        filters,
        query.format
      );
      
      const timestamp = new Date().toISOString().split('T')[0];
      
      if (query.format === 'csv') {
        // Set CSV headers for download
        c.header('Content-Type', 'text/csv; charset=utf-8');
        c.header('Content-Disposition', `attachment; filename="allocation-audit-export-${timestamp}.csv"`);
        c.header('Cache-Control', 'no-cache');
        
        return c.text(exportData);
      }
      
      // JSON export format
      c.header('Content-Type', 'application/json; charset=utf-8');
      c.header('Content-Disposition', `attachment; filename="allocation-audit-export-${timestamp}.json"`);
      c.header('Cache-Control', 'no-cache');
      
      return c.text(exportData);
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /audit/allocations/integrity - Check audit trail integrity
 * Requirements: 6.5
 * 
 * This endpoint provides:
 * - Data integrity validation for audit trails
 * - Orphaned audit log detection
 * - Missing audit log identification
 * - Consistency checks across allocation and audit data
 * - Role-based access (ADMIN only)
 */
allocationAudit.get('/audit/allocations/integrity',
  requireRole(['ADMIN']),
  validateQuery(auditSummaryQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      dateFrom?: string;
      dateTo?: string;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const auditService = createAllocationAuditService(db);
      
      // Default to last 30 days if no date range provided
      const dateRange = {
        from: query.dateFrom ? new Date(query.dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        to: query.dateTo ? new Date(query.dateTo) : new Date(),
      };
      
      // Generate compliance report to get integrity checks
      const report = await auditService.generateComplianceReport(
        authContext.tenant_id,
        dateRange,
        authContext.user_id
      );
      
      return c.json({
        integrityCheck: {
          checkId: `integrity_${Date.now()}`,
          tenantId: authContext.tenant_id,
          checkedAt: new Date().toISOString(),
          checkedBy: authContext.user_id,
          dateRange: {
            from: dateRange.from.toISOString(),
            to: dateRange.to.toISOString(),
          },
          results: {
            orphanedAuditLogs: report.integrityChecks.orphanedAuditLogs,
            missingAuditLogs: report.integrityChecks.missingAuditLogs,
            dataConsistencyIssues: report.integrityChecks.dataConsistencyIssues,
            totalAllocationsChecked: report.summary.totalAllocations,
            totalAuditEventsChecked: report.summary.totalAuditEvents,
          },
          status: report.integrityChecks.dataConsistencyIssues.length === 0 ? 'HEALTHY' : 'ISSUES_FOUND',
          recommendations: report.integrityChecks.dataConsistencyIssues.length > 0 ? [
            'Review orphaned audit logs and consider cleanup',
            'Investigate missing audit logs for compliance',
            'Run integrity checks regularly to maintain data quality'
          ] : [
            'Audit trail integrity is maintained',
            'Continue regular monitoring'
          ],
        },
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

export default allocationAudit;