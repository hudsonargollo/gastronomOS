import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';
import { 
  authenticate, 
  injectTenantContext,
  getAuthContext
} from '../middleware/auth';
import { validateBody, validateQuery, getValidatedBody, getValidatedQuery } from '../middleware/error';
import { 
  createVarianceReportingService,
  VarianceFilters,
  VarianceReasonCode,
  NotificationPreferences
} from '../services/variance-reporting';

// Validation schemas
const varianceFiltersSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  productId: z.string().optional(),
  sourceLocationId: z.string().optional(),
  destinationLocationId: z.string().optional(),
  minVariancePercentage: z.number().min(0).max(100).optional(),
  maxVariancePercentage: z.number().min(0).max(100).optional(),
  minVarianceQuantity: z.number().min(0).optional(),
  maxVarianceQuantity: z.number().min(0).optional(),
  priority: z.enum(['NORMAL', 'HIGH', 'EMERGENCY']).optional(),
  limit: z.number().int().positive().max(1000).default(100).optional(),
  offset: z.number().int().min(0).default(0).optional(),
});

const alertFiltersSchema = z.object({
  acknowledged: z.boolean().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  limit: z.number().int().positive().max(100).default(50).optional(),
});

const acknowledgeAlertSchema = z.object({
  alertId: z.string().min(1, 'Alert ID is required'),
});

const addReasonCodeSchema = z.object({
  code: z.string().min(1).max(50, 'Code must be 1-50 characters'),
  description: z.string().min(1).max(200, 'Description must be 1-200 characters'),
  category: z.enum(['DAMAGE', 'THEFT', 'SPOILAGE', 'MEASUREMENT_ERROR', 'PACKAGING', 'OTHER']),
  isActive: z.boolean().default(true),
});

const updateReasonCodeSchema = z.object({
  description: z.string().min(1).max(200).optional(),
  category: z.enum(['DAMAGE', 'THEFT', 'SPOILAGE', 'MEASUREMENT_ERROR', 'PACKAGING', 'OTHER']).optional(),
  isActive: z.boolean().optional(),
});

const notificationPreferencesSchema = z.object({
  locationId: z.string().optional(),
  enableVarianceAlerts: z.boolean().optional(),
  varianceThresholdPercentage: z.number().min(0).max(100).optional(),
  varianceThresholdQuantity: z.number().min(0).optional(),
  enableDailyReports: z.boolean().optional(),
  enableWeeklyReports: z.boolean().optional(),
  notificationMethods: z.array(z.enum(['EMAIL', 'SMS', 'IN_APP'])).optional(),
});

const app = new Hono<{
  Bindings: {
    DB: D1Database;
  };
  Variables: {
    tenantId: string;
    userId: string;
    userRole: string;
  };
}>();

// Apply authentication middleware to all routes
app.use('*', authenticate());
app.use('*', injectTenantContext());

/**
 * GET /variance-reports - Generate variance report with filtering
 * Requirements: 5.3, 5.4
 */
app.get('/', validateQuery(varianceFiltersSchema), async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const varianceService = createVarianceReportingService(db);
    const { tenant_id } = getAuthContext(c);
    
    const filters = getValidatedQuery(c) as any;
    
    // Convert date strings to Date objects
    const varianceFilters: VarianceFilters = {
      ...filters,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
      dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
    };

    const varianceReport = await varianceService.generateVarianceReport(tenant_id, varianceFilters);

    return c.json({
      success: true,
      data: varianceReport,
      count: varianceReport.length,
      filters: varianceFilters
    });
  } catch (error) {
    console.error('Error generating variance report:', error);
    return c.json({
      success: false,
      error: 'Failed to generate variance report',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /variance-reports/summary - Get variance summary statistics
 * Requirements: 5.3, 5.4
 */
app.get('/summary', validateQuery(varianceFiltersSchema), async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const varianceService = createVarianceReportingService(db);
    const { tenant_id } = getAuthContext(c);
    
    const filters = getValidatedQuery(c) as any;
    
    // Convert date strings to Date objects
    const varianceFilters: VarianceFilters = {
      ...filters,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
      dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
    };

    const summary = await varianceService.getVarianceSummary(tenant_id, varianceFilters);

    return c.json({
      success: true,
      data: summary,
      filters: varianceFilters
    });
  } catch (error) {
    console.error('Error getting variance summary:', error);
    return c.json({
      success: false,
      error: 'Failed to get variance summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /variance-reports/patterns - Analyze variance patterns
 * Requirements: 5.3, 5.4
 */
app.get('/patterns', validateQuery(varianceFiltersSchema), async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const varianceService = createVarianceReportingService(db);
    const { tenant_id } = getAuthContext(c);
    
    const filters = getValidatedQuery(c) as any;
    
    // Convert date strings to Date objects
    const varianceFilters: VarianceFilters = {
      ...filters,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
      dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
    };

    const patterns = await varianceService.analyzeVariancePatterns(tenant_id, varianceFilters);

    return c.json({
      success: true,
      data: patterns,
      filters: varianceFilters
    });
  } catch (error) {
    console.error('Error analyzing variance patterns:', error);
    return c.json({
      success: false,
      error: 'Failed to analyze variance patterns',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /variance-reports/alerts - Get variance alerts
 * Requirements: 5.3, 5.4
 */
app.get('/alerts', validateQuery(alertFiltersSchema), async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const varianceService = createVarianceReportingService(db);
    const { tenant_id } = getAuthContext(c);
    
    const filters = getValidatedQuery(c) as {
      acknowledged?: boolean;
      severity?: string;
      limit?: number;
    };

    const alerts = await varianceService.getVarianceAlerts(tenant_id, filters);

    return c.json({
      success: true,
      data: alerts,
      count: alerts.length,
      filters
    });
  } catch (error) {
    console.error('Error getting variance alerts:', error);
    return c.json({
      success: false,
      error: 'Failed to get variance alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * POST /variance-reports/alerts/:alertId/acknowledge - Acknowledge a variance alert
 * Requirements: 5.3, 5.4
 */
app.post('/alerts/:alertId/acknowledge', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const varianceService = createVarianceReportingService(db);
    const { user_id } = getAuthContext(c);
    
    const alertId = c.req.param('alertId');
    
    const acknowledgedAlert = await varianceService.acknowledgeVarianceAlert(alertId, user_id);

    return c.json({
      success: true,
      data: acknowledgedAlert,
      message: 'Variance alert acknowledged successfully'
    });
  } catch (error) {
    console.error('Error acknowledging variance alert:', error);
    return c.json({
      success: false,
      error: 'Failed to acknowledge variance alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /variance-reports/reason-codes - Get variance reason codes
 * Requirements: 5.3, 5.4
 */
app.get('/reason-codes', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const varianceService = createVarianceReportingService(db);
    
    const reasonCodes = await varianceService.getVarianceReasonCodes();

    return c.json({
      success: true,
      data: reasonCodes,
      count: reasonCodes.length
    });
  } catch (error) {
    console.error('Error getting variance reason codes:', error);
    return c.json({
      success: false,
      error: 'Failed to get variance reason codes',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * POST /variance-reports/reason-codes - Add a new variance reason code
 * Requirements: 5.3, 5.4
 */
app.post('/reason-codes', validateBody(addReasonCodeSchema), async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const varianceService = createVarianceReportingService(db);
    
    const reasonCodeData = getValidatedBody(c) as Omit<VarianceReasonCode, 'createdAt' | 'updatedAt'>;
    
    const newReasonCode = await varianceService.addVarianceReasonCode(reasonCodeData);

    return c.json({
      success: true,
      data: newReasonCode,
      message: 'Variance reason code added successfully'
    }, 201);
  } catch (error) {
    console.error('Error adding variance reason code:', error);
    return c.json({
      success: false,
      error: 'Failed to add variance reason code',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * PUT /variance-reports/reason-codes/:code - Update a variance reason code
 * Requirements: 5.3, 5.4
 */
app.put('/reason-codes/:code', validateBody(updateReasonCodeSchema), async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const varianceService = createVarianceReportingService(db);
    
    const code = c.req.param('code');
    const updates = getValidatedBody(c) as Partial<VarianceReasonCode>;
    
    const updatedReasonCode = await varianceService.updateVarianceReasonCode(code, updates);

    return c.json({
      success: true,
      data: updatedReasonCode,
      message: 'Variance reason code updated successfully'
    });
  } catch (error) {
    console.error('Error updating variance reason code:', error);
    return c.json({
      success: false,
      error: 'Failed to update variance reason code',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /variance-reports/notifications/preferences - Get user notification preferences
 * Requirements: 5.3, 5.4
 */
app.get('/notifications/preferences', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const varianceService = createVarianceReportingService(db);
    const { user_id } = getAuthContext(c);
    
    const preferences = await varianceService.getNotificationPreferences(user_id);

    return c.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    return c.json({
      success: false,
      error: 'Failed to get notification preferences',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * PUT /variance-reports/notifications/preferences - Update user notification preferences
 * Requirements: 5.3, 5.4
 */
app.put('/notifications/preferences', validateBody(notificationPreferencesSchema), async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const varianceService = createVarianceReportingService(db);
    const { user_id } = getAuthContext(c);
    
    const preferences = getValidatedBody(c) as Partial<NotificationPreferences>;
    
    const updatedPreferences = await varianceService.updateNotificationPreferences(user_id, preferences);

    return c.json({
      success: true,
      data: updatedPreferences,
      message: 'Notification preferences updated successfully'
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return c.json({
      success: false,
      error: 'Failed to update notification preferences',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

export default app;