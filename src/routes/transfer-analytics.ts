/**
 * Transfer Analytics API Routes
 * 
 * Provides analytics endpoints for transfer monitoring and insights.
 * Implements requirements 8.3, 8.5 for the transfer system.
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { createTransferAnalyticsService, ITransferAnalyticsService, DateRange, AnalyticsOptions } from '../services/transfer-analytics';
import { createAuditService, IAuditService, extractAuditContext } from '../services/audit';
import { createErrorResponse } from '../utils';
import { z } from 'zod';

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
  JWT_SECRET: string;
}

// Extend Hono context with services
type Variables = {
  analyticsService: ITransferAnalyticsService;
  auditService: IAuditService;
  authContext?: {
    user_id: string;
    tenant_id: string;
    role: string;
    location_id?: string;
  };
};

// Validation schemas
const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format')
}).refine(data => new Date(data.startDate) <= new Date(data.endDate), {
  message: 'Start date must be before or equal to end date'
});

const analyticsOptionsSchema = z.object({
  includePatternAnalysis: z.boolean().optional(),
  includePerformanceMetrics: z.boolean().optional(),
  includeShrinkageAnalysis: z.boolean().optional(),
  includeTrends: z.boolean().optional(),
  trendGranularity: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  limit: z.number().min(1).max(100).optional()
}).optional();

// Initialize analytics router
const analytics = new Hono<{ Bindings: Env; Variables: Variables }>();

// Service initialization middleware
analytics.use('*', async (c, next) => {
  try {
    const db = drizzle(c.env.DB, { schema });
    const analyticsService = createTransferAnalyticsService(db as any);
    const auditService = createAuditService(db);
    
    c.set('analyticsService', analyticsService);
    c.set('auditService', auditService);
    
    return await next();
  } catch (error) {
    console.error('Transfer analytics service initialization error:', error);
    return c.json(createErrorResponse(
      'Service Error',
      'Failed to initialize transfer analytics services',
      'SERVICE_INIT_ERROR'
    ), 500);
  }
});

// Authentication middleware (placeholder - would use actual auth middleware)
analytics.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(createErrorResponse(
      'Authentication Required',
      'Valid authentication token is required',
      'AUTH_REQUIRED'
    ), 401);
  }

  // Mock auth context - replace with actual JWT verification
  c.set('authContext', {
    user_id: 'mock-user-id',
    tenant_id: 'mock-tenant-id',
    role: 'MANAGER'
  });

  return await next();
});

/**
 * GET /analytics/transfers - Get comprehensive transfer analytics
 * Requirements: 8.1, 8.2, 8.4 - Transfer metrics and performance data
 */
analytics.get('/transfers', async (c) => {
  const auditContext = extractAuditContext(c);
  const auditService = c.get('auditService');
  const authContext = c.get('authContext');
  
  if (!authContext) {
    return c.json(createErrorResponse(
      'Authentication Required',
      'User authentication is required',
      'AUTH_REQUIRED'
    ), 401);
  }

  try {
    // Parse and validate query parameters
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const includePatternAnalysis = c.req.query('includePatternAnalysis') === 'true';
    const includePerformanceMetrics = c.req.query('includePerformanceMetrics') === 'true';
    const includeShrinkageAnalysis = c.req.query('includeShrinkageAnalysis') === 'true';
    const includeTrends = c.req.query('includeTrends') === 'true';
    const trendGranularity = c.req.query('trendGranularity') as 'DAILY' | 'WEEKLY' | 'MONTHLY' || 'DAILY';
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 30;

    // Validate date range
    if (!startDate || !endDate) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Both startDate and endDate query parameters are required',
        'MISSING_DATE_RANGE'
      ), 400);
    }

    const dateRangeValidation = dateRangeSchema.safeParse({ startDate, endDate });
    if (!dateRangeValidation.success) {
      return c.json(createErrorResponse(
        'Validation Error',
        dateRangeValidation.error.errors[0].message,
        'INVALID_DATE_RANGE'
      ), 400);
    }

    // Validate analytics options
    const optionsValidation = analyticsOptionsSchema.safeParse({
      includePatternAnalysis,
      includePerformanceMetrics,
      includeShrinkageAnalysis,
      includeTrends,
      trendGranularity,
      limit
    });

    if (!optionsValidation.success) {
      return c.json(createErrorResponse(
        'Validation Error',
        optionsValidation.error.errors[0].message,
        'INVALID_OPTIONS'
      ), 400);
    }

    const dateRange: DateRange = {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    };

    const options: AnalyticsOptions = {
      includePatternAnalysis: includePatternAnalysis || undefined,
      includePerformanceMetrics: includePerformanceMetrics || undefined,
      includeShrinkageAnalysis: includeShrinkageAnalysis || undefined,
      includeTrends: includeTrends || undefined,
      trendGranularity: trendGranularity || undefined,
      limit: limit || undefined
    };

    // Get analytics data
    const analyticsService = c.get('analyticsService');
    const analytics = await analyticsService.getTransferAnalytics(
      authContext.tenant_id,
      dateRange,
      options
    );

    // Audit the analytics access
    await auditService.logSensitiveOperation('ANALYTICS_ACCESS', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: 'transfer_analytics'
    });

    return c.json({
      success: true,
      data: analytics,
      metadata: {
        dateRange: { startDate, endDate },
        options,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Transfer analytics error:', error);
    
    // Audit the error
    await auditService.logSensitiveOperation('ANALYTICS_ERROR', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: 'transfer_analytics'
    });

    return c.json(createErrorResponse(
      'Analytics Error',
      'Failed to generate transfer analytics',
      'ANALYTICS_ERROR'
    ), 500);
  }
});

/**
 * GET /analytics/shrinkage - Get transfer shrinkage analysis
 * Requirements: 8.1, 8.2, 8.4 - Variance analysis and shrinkage reporting
 */
analytics.get('/shrinkage', async (c) => {
  const auditContext = extractAuditContext(c);
  const auditService = c.get('auditService');
  const authContext = c.get('authContext');
  
  if (!authContext) {
    return c.json(createErrorResponse(
      'Authentication Required',
      'User authentication is required',
      'AUTH_REQUIRED'
    ), 401);
  }

  try {
    // Parse and validate query parameters
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    // Validate date range
    if (!startDate || !endDate) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Both startDate and endDate query parameters are required',
        'MISSING_DATE_RANGE'
      ), 400);
    }

    const dateRangeValidation = dateRangeSchema.safeParse({ startDate, endDate });
    if (!dateRangeValidation.success) {
      return c.json(createErrorResponse(
        'Validation Error',
        dateRangeValidation.error.errors[0].message,
        'INVALID_DATE_RANGE'
      ), 400);
    }

    const dateRange: DateRange = {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    };

    // Get shrinkage analysis
    const analyticsService = c.get('analyticsService');
    const shrinkageAnalysis = await analyticsService.getShrinkageAnalysis(
      authContext.tenant_id,
      dateRange
    );

    // Audit the shrinkage analysis access
    await auditService.logSensitiveOperation('ANALYTICS_ACCESS', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: 'shrinkage_analysis'
    });

    return c.json({
      success: true,
      data: shrinkageAnalysis,
      metadata: {
        dateRange: { startDate, endDate },
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Shrinkage analysis error:', error);
    
    // Audit the error
    await auditService.logSensitiveOperation('ANALYTICS_ERROR', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: 'shrinkage_analysis'
    });

    return c.json(createErrorResponse(
      'Analytics Error',
      'Failed to generate shrinkage analysis',
      'SHRINKAGE_ANALYSIS_ERROR'
    ), 500);
  }
});

/**
 * GET /analytics/patterns - Get transfer pattern analysis
 * Requirements: 8.3, 8.5 - Transfer pattern analysis and optimization insights
 */
analytics.get('/patterns', async (c) => {
  const auditContext = extractAuditContext(c);
  const auditService = c.get('auditService');
  const authContext = c.get('authContext');
  
  if (!authContext) {
    return c.json(createErrorResponse(
      'Authentication Required',
      'User authentication is required',
      'AUTH_REQUIRED'
    ), 401);
  }

  try {
    // Parse and validate query parameters
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    // Validate date range
    if (!startDate || !endDate) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Both startDate and endDate query parameters are required',
        'MISSING_DATE_RANGE'
      ), 400);
    }

    const dateRangeValidation = dateRangeSchema.safeParse({ startDate, endDate });
    if (!dateRangeValidation.success) {
      return c.json(createErrorResponse(
        'Validation Error',
        dateRangeValidation.error.errors[0].message,
        'INVALID_DATE_RANGE'
      ), 400);
    }

    const dateRange: DateRange = {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    };

    // Get pattern analysis
    const analyticsService = c.get('analyticsService');
    const patternAnalysis = await analyticsService.getTransferPatterns(
      authContext.tenant_id,
      dateRange
    );

    // Audit the pattern analysis access
    await auditService.logSensitiveOperation('ANALYTICS_ACCESS', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: 'pattern_analysis'
    });

    return c.json({
      success: true,
      data: patternAnalysis,
      metadata: {
        dateRange: { startDate, endDate },
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Pattern analysis error:', error);
    
    // Audit the error
    await auditService.logSensitiveOperation('ANALYTICS_ERROR', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: 'pattern_analysis'
    });

    return c.json(createErrorResponse(
      'Analytics Error',
      'Failed to generate pattern analysis',
      'PATTERN_ANALYSIS_ERROR'
    ), 500);
  }
});

/**
 * GET /analytics/performance - Get transfer performance metrics
 * Requirements: 8.2, 8.4 - Performance metrics and bottleneck analysis
 */
analytics.get('/performance', async (c) => {
  const auditContext = extractAuditContext(c);
  const auditService = c.get('auditService');
  const authContext = c.get('authContext');
  
  if (!authContext) {
    return c.json(createErrorResponse(
      'Authentication Required',
      'User authentication is required',
      'AUTH_REQUIRED'
    ), 401);
  }

  try {
    // Parse and validate query parameters
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    // Validate date range
    if (!startDate || !endDate) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Both startDate and endDate query parameters are required',
        'MISSING_DATE_RANGE'
      ), 400);
    }

    const dateRangeValidation = dateRangeSchema.safeParse({ startDate, endDate });
    if (!dateRangeValidation.success) {
      return c.json(createErrorResponse(
        'Validation Error',
        dateRangeValidation.error.errors[0].message,
        'INVALID_DATE_RANGE'
      ), 400);
    }

    const dateRange: DateRange = {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    };

    // Get performance metrics
    const analyticsService = c.get('analyticsService');
    const performanceMetrics = await analyticsService.getPerformanceMetrics(
      authContext.tenant_id,
      dateRange
    );

    // Audit the performance metrics access
    await auditService.logSensitiveOperation('ANALYTICS_ACCESS', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: 'performance_metrics'
    });

    return c.json({
      success: true,
      data: performanceMetrics,
      metadata: {
        dateRange: { startDate, endDate },
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Performance metrics error:', error);
    
    // Audit the error
    await auditService.logSensitiveOperation('ANALYTICS_ERROR', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: 'performance_metrics'
    });

    return c.json(createErrorResponse(
      'Analytics Error',
      'Failed to generate performance metrics',
      'PERFORMANCE_METRICS_ERROR'
    ), 500);
  }
});

/**
 * GET /analytics/suggestions - Get improvement suggestions based on analytics
 * Requirements: 8.5 - Optimization recommendations and insights
 */
analytics.get('/suggestions', async (c) => {
  const auditContext = extractAuditContext(c);
  const auditService = c.get('auditService');
  const authContext = c.get('authContext');
  
  if (!authContext) {
    return c.json(createErrorResponse(
      'Authentication Required',
      'User authentication is required',
      'AUTH_REQUIRED'
    ), 401);
  }

  try {
    // Parse and validate query parameters
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    // Validate date range
    if (!startDate || !endDate) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Both startDate and endDate query parameters are required',
        'MISSING_DATE_RANGE'
      ), 400);
    }

    const dateRangeValidation = dateRangeSchema.safeParse({ startDate, endDate });
    if (!dateRangeValidation.success) {
      return c.json(createErrorResponse(
        'Validation Error',
        dateRangeValidation.error.errors[0].message,
        'INVALID_DATE_RANGE'
      ), 400);
    }

    const dateRange: DateRange = {
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    };

    // Get improvement suggestions
    const analyticsService = c.get('analyticsService');
    const suggestions = await analyticsService.generateImprovementSuggestions(
      authContext.tenant_id,
      dateRange
    );

    // Get bottlenecks for additional context
    const bottlenecks = await analyticsService.identifyBottlenecks(
      authContext.tenant_id,
      dateRange
    );

    // Audit the suggestions access
    await auditService.logSensitiveOperation('ANALYTICS_ACCESS', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: 'improvement_suggestions'
    });

    return c.json({
      success: true,
      data: {
        suggestions,
        bottlenecks,
        summary: {
          totalSuggestions: suggestions.length,
          totalBottlenecks: bottlenecks.length,
          highPriorityIssues: bottlenecks.filter(b => b.severity === 'HIGH').length,
          mediumPriorityIssues: bottlenecks.filter(b => b.severity === 'MEDIUM').length,
          lowPriorityIssues: bottlenecks.filter(b => b.severity === 'LOW').length
        }
      },
      metadata: {
        dateRange: { startDate, endDate },
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Improvement suggestions error:', error);
    
    // Audit the error
    await auditService.logSensitiveOperation('ANALYTICS_ERROR', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: 'improvement_suggestions'
    });

    return c.json(createErrorResponse(
      'Analytics Error',
      'Failed to generate improvement suggestions',
      'SUGGESTIONS_ERROR'
    ), 500);
  }
});

export default analytics;