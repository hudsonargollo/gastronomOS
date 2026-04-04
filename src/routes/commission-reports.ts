/**
 * Commission Reports API Routes
 * Handles commission reporting, analytics, CSV export, and adjustment endpoints
 * 
 * Requirements: 4.4, 14.1, 14.2, 14.3, 14.4, 14.5
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { createCommissionReporter, type ReportPeriod, type DateRange } from '../services/commission-reporter';
import { createCommissionEngine } from '../services/commission-engine';
import { authenticate, injectTenantContext, requireRole } from '../middleware/auth';
import { UserRole } from '../db/schema';

const app = new Hono();

// Apply authentication and tenant context to all routes
app.use('*', authenticate());
app.use('*', injectTenantContext());

// Validation schemas
const dateRangeSchema = z.object({
  start: z.number().positive(),
  end: z.number().positive()
}).refine(data => data.start <= data.end, {
  message: 'Start date must be before or equal to end date'
});

const reportPeriodSchema = z.enum(['daily', 'weekly', 'monthly', 'custom']);

const waiterReportSchema = z.object({
  tenantId: z.string().min(1),
  waiterId: z.string().min(1),
  period: reportPeriodSchema.optional(),
  dateRange: dateRangeSchema.optional(),
  includePaid: z.boolean().optional(),
  includeUnpaid: z.boolean().optional()
});

const tenantReportSchema = z.object({
  tenantId: z.string().min(1),
  period: reportPeriodSchema.optional(),
  dateRange: dateRangeSchema.optional(),
  includePaid: z.boolean().optional(),
  includeUnpaid: z.boolean().optional()
});

const analyticsSchema = z.object({
  tenantId: z.string().min(1),
  period: reportPeriodSchema.optional(),
  dateRange: dateRangeSchema.optional()
});

const csvExportSchema = z.object({
  tenantId: z.string().min(1),
  dateRange: dateRangeSchema,
  waiterId: z.string().optional(),
  includePaid: z.boolean().optional(),
  includeUnpaid: z.boolean().optional(),
  dateFormat: z.enum(['iso', 'br', 'us']).optional(),
  delimiter: z.enum([',', ';']).optional()
});

const adjustmentSchema = z.object({
  tenantId: z.string().min(1),
  commissionId: z.string().min(1),
  adjustmentAmount: z.number().nonnegative(),
  adjustmentType: z.enum(['increase', 'decrease', 'correction']),
  reason: z.string().min(1),
  performedBy: z.string().min(1),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional()
});

const reversalSchema = z.object({
  tenantId: z.string().min(1),
  adjustmentId: z.string().min(1),
  reversedBy: z.string().min(1),
  reversalReason: z.string().min(1)
});

/**
 * GET /commission-reports/waiter/:waiterId
 * Generate commission report for a specific waiter
 * Requirements: 14.1, 14.2, 14.3
 */
app.get('/waiter/:waiterId', async (c) => {
  try {
    const db = c.get('db');
    const reporter = createCommissionReporter(db);
    
    const waiterId = c.req.param('waiterId');
    const tenantId = c.req.query('tenantId');
    const period = c.req.query('period') as ReportPeriod | undefined;
    const start = c.req.query('start');
    const end = c.req.query('end');
    const includePaid = c.req.query('includePaid') !== 'false';
    const includeUnpaid = c.req.query('includeUnpaid') !== 'false';

    if (!tenantId) {
      return c.json({ error: 'tenantId is required' }, 400);
    }

    let dateRange: DateRange | undefined;
    if (start && end) {
      dateRange = {
        start: parseInt(start),
        end: parseInt(end)
      };
    }

    const report = await reporter.generateWaiterReport({
      tenantId,
      waiterId,
      period,
      dateRange,
      includePaid,
      includeUnpaid
    });

    if (!report) {
      return c.json({ error: 'Waiter not found or no commissions for the specified period' }, 404);
    }

    return c.json({ success: true, report });
  } catch (error) {
    console.error('Error generating waiter report:', error);
    return c.json({ error: 'Failed to generate waiter report' }, 500);
  }
});

/**
 * GET /commission-reports/tenant/:tenantId
 * Generate commission reports for all waiters in a tenant
 * Requirements: 14.1, 14.2
 */
app.get('/tenant/:tenantId', async (c) => {
  try {
    const db = c.get('db');
    const reporter = createCommissionReporter(db);
    
    const tenantId = c.req.param('tenantId');
    const period = c.req.query('period') as ReportPeriod | undefined;
    const start = c.req.query('start');
    const end = c.req.query('end');
    const includePaid = c.req.query('includePaid') !== 'false';
    const includeUnpaid = c.req.query('includeUnpaid') !== 'false';

    let dateRange: DateRange | undefined;
    if (start && end) {
      dateRange = {
        start: parseInt(start),
        end: parseInt(end)
      };
    }

    const reports = await reporter.generateTenantReport({
      tenantId,
      period,
      dateRange,
      includePaid,
      includeUnpaid
    });

    return c.json({ 
      success: true, 
      reports,
      summary: {
        totalWaiters: reports.length,
        totalCommission: reports.reduce((sum, r) => sum + r.totalCommission, 0),
        totalSales: reports.reduce((sum, r) => sum + r.totalSales, 0),
        totalOrders: reports.reduce((sum, r) => sum + r.totalOrders, 0)
      }
    });
  } catch (error) {
    console.error('Error generating tenant report:', error);
    return c.json({ error: 'Failed to generate tenant report' }, 500);
  }
});

/**
 * GET /commission-reports/analytics/:tenantId
 * Get commission analytics for a tenant
 * Requirements: 14.3
 */
app.get('/analytics/:tenantId', async (c) => {
  try {
    const db = c.get('db');
    const reporter = createCommissionReporter(db);
    
    const tenantId = c.req.param('tenantId');
    const period = c.req.query('period') as ReportPeriod | undefined;
    const start = c.req.query('start');
    const end = c.req.query('end');

    let dateRange: DateRange | undefined;
    if (start && end) {
      dateRange = {
        start: parseInt(start),
        end: parseInt(end)
      };
    }

    const analytics = await reporter.getCommissionAnalytics(tenantId, period, dateRange);

    if (!analytics) {
      return c.json({ error: 'Failed to generate analytics' }, 500);
    }

    return c.json({ success: true, analytics });
  } catch (error) {
    console.error('Error getting commission analytics:', error);
    return c.json({ error: 'Failed to get commission analytics' }, 500);
  }
});

/**
 * POST /commission-reports/export/csv
 * Export commissions to CSV format for payroll integration
 * Requirements: 14.4
 */
app.post('/export/csv', async (c) => {
  try {
    const db = c.get('db');
    const reporter = createCommissionReporter(db);
    
    const body = await c.req.json();
    const validated = csvExportSchema.parse(body);

    const result = await reporter.exportToCSV(validated);

    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }

    // Set response headers for CSV download
    c.header('Content-Type', 'text/csv');
    c.header('Content-Disposition', `attachment; filename="${result.filename}"`);
    
    return c.text(result.csv || '');
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation error', details: error.errors }, 400);
    }
    return c.json({ error: 'Failed to export to CSV' }, 500);
  }
});

/**
 * POST /commission-reports/adjustments
 * Create a commission adjustment
 * Requirements: 14.5
 */
app.post('/adjustments', async (c) => {
  try {
    const db = c.get('db');
    const reporter = createCommissionReporter(db);
    
    const body = await c.req.json();
    const validated = adjustmentSchema.parse(body);

    const result = await reporter.createAdjustment(validated);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ 
      success: true, 
      adjustment: result.adjustment 
    }, 201);
  } catch (error) {
    console.error('Error creating adjustment:', error);
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation error', details: error.errors }, 400);
    }
    return c.json({ error: 'Failed to create adjustment' }, 500);
  }
});

/**
 * POST /commission-reports/adjustments/reverse
 * Reverse a commission adjustment
 * Requirements: 14.5
 */
app.post('/adjustments/reverse', async (c) => {
  try {
    const db = c.get('db');
    const reporter = createCommissionReporter(db);
    
    const body = await c.req.json();
    const validated = reversalSchema.parse(body);

    const result = await reporter.reverseAdjustment(validated);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error reversing adjustment:', error);
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation error', details: error.errors }, 400);
    }
    return c.json({ error: 'Failed to reverse adjustment' }, 500);
  }
});

/**
 * GET /commission-reports/adjustments/:commissionId
 * Get adjustment history for a commission
 * Requirements: 14.5
 */
app.get('/adjustments/:commissionId', async (c) => {
  try {
    const db = c.get('db');
    const reporter = createCommissionReporter(db);
    
    const commissionId = c.req.param('commissionId');
    const tenantId = c.req.query('tenantId');

    if (!tenantId) {
      return c.json({ error: 'tenantId is required' }, 400);
    }

    const adjustments = await reporter.getAdjustmentHistory(tenantId, commissionId);

    return c.json({ 
      success: true, 
      adjustments 
    });
  } catch (error) {
    console.error('Error getting adjustment history:', error);
    return c.json({ error: 'Failed to get adjustment history' }, 500);
  }
});

/**
 * GET /commission-reports/audit/:commissionId
 * Get audit trail for a commission
 * Requirements: 14.5
 */
app.get('/audit/:commissionId', async (c) => {
  try {
    const db = c.get('db');
    const reporter = createCommissionReporter(db);
    
    const commissionId = c.req.param('commissionId');
    const tenantId = c.req.query('tenantId');

    if (!tenantId) {
      return c.json({ error: 'tenantId is required' }, 400);
    }

    const auditTrail = await reporter.getCommissionAuditTrail(tenantId, commissionId);

    return c.json({ 
      success: true, 
      auditTrail 
    });
  } catch (error) {
    console.error('Error getting audit trail:', error);
    return c.json({ error: 'Failed to get audit trail' }, 500);
  }
});

/**
 * GET /commission-reports/summary/:tenantId
 * Get quick summary of commissions for a tenant
 * Requirements: 14.2, 14.3
 */
app.get('/summary/:tenantId', async (c) => {
  try {
    const db = c.get('db');
    const engine = createCommissionEngine(db);
    
    const tenantId = c.req.param('tenantId');
    const start = c.req.query('start');
    const end = c.req.query('end');

    const dateFrom = start ? parseInt(start) : undefined;
    const dateTo = end ? parseInt(end) : undefined;

    const commissions = await engine.getCommissionReport({
      tenantId,
      dateFrom,
      dateTo
    });

    const totalCommission = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
    const totalSales = commissions.reduce((sum, c) => sum + c.orderAmount, 0);
    const paidCommissions = commissions.filter(c => c.paidAt !== null);
    const unpaidCommissions = commissions.filter(c => c.paidAt === null);

    return c.json({
      success: true,
      summary: {
        totalOrders: commissions.length,
        totalSales,
        totalCommission,
        paidCommission: paidCommissions.reduce((sum, c) => sum + c.commissionAmount, 0),
        unpaidCommission: unpaidCommissions.reduce((sum, c) => sum + c.commissionAmount, 0),
        averageOrderValue: commissions.length > 0 ? Math.round(totalSales / commissions.length) : 0
      }
    });
  } catch (error) {
    console.error('Error getting commission summary:', error);
    return c.json({ error: 'Failed to get commission summary' }, 500);
  }
});

/**
 * GET /commission-reports/live/:waiterId
 * Get live commission data for waiter panel ticker
 * Requirements: 4.4
 */
app.get('/live/:waiterId', async (c) => {
  try {
    const db = c.get('db');
    const engine = createCommissionEngine(db);
    
    const waiterId = c.req.param('waiterId');
    const tenantId = c.req.query('tenantId');
    const startDate = c.req.query('startDate');

    if (!tenantId) {
      return c.json({ error: 'tenantId is required' }, 400);
    }

    const dateFrom = startDate ? parseInt(startDate) : undefined;

    const summary = await engine.getWaiterCommissionSummary(
      tenantId,
      waiterId,
      dateFrom,
      Date.now()
    );

    if (!summary) {
      return c.json({
        success: true,
        totalCommission: 0,
        orderCount: 0,
        commissions: []
      });
    }

    // Get recent commissions for the ticker
    const commissions = await engine.getWaiterCommissions(
      tenantId,
      waiterId,
      dateFrom,
      Date.now()
    );

    return c.json({
      success: true,
      totalCommission: summary.totalCommission,
      orderCount: summary.orderCount,
      commissions: commissions.slice(0, 10) // Last 10 commissions
    });
  } catch (error) {
    console.error('Error getting live commission data:', error);
    return c.json({ error: 'Failed to get live commission data' }, 500);
  }
});

export default app;