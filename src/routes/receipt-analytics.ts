/**
 * Receipt Analytics API Routes
 * 
 * Provides analytics endpoints for receipt processing monitoring and insights.
 * Implements requirements 10.3, 10.5 for the receipt scanning system.
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { createReceiptAnalyticsService, IReceiptAnalyticsService, DateRange, AnalyticsOptions } from '../services/receipt-analytics';
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
  analyticsService: IReceiptAnalyticsService;
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

// Initialize analytics router
const analytics = new Hono<{ Bindings: Env; Variables: Variables }>();

// Service initialization middleware
analytics.use('*', async (c, next) => {
  try {
    const db = drizzle(c.env.DB, { schema });
    const analyticsService = createReceiptAnalyticsService(db as any);
    const auditService = createAuditService(db);
    
    c.set('analyticsService', analyticsService);
    c.set('auditService', auditService);
    
    return await next();
  } catch (error) {
    console.error('Analytics service initialization error:', error);
    return c.json(createErrorResponse(
      'Service Error',
      'Failed to initialize analytics services',
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
 * GET /analytics/receipt-processing - Get comprehensive receipt processing analytics
 * Requirements: 10.3, 10.5 - Dashboard data with processing metrics
 */
analytics.get('/receipt-processing', async (c) => {
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
    // Parse query parameters
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const includeErrorAnalysis = c.req.query('includeErrorAnalysis') === 'true';
    const includePerformanceMetrics = c.req.query('includePerformanceMetrics') === 'true';
    const includeQualityMetrics = c.req.query('includeQualityMetrics') === 'true';
    const includeTrends = c.req.query('includeTrends') !== 'false'; // Default true
    const trendGranularity = c.req.query('trendGranularity') as 'HOURLY' | 'DAILY' | 'WEEKLY' || 'DAILY';
    const limit = parseInt(c.req.query('limit') || '30', 10);

    // Validate date range if provided
    let dateRange: DateRange;
    if (startDate && endDate) {
      const validatedDates = dateRangeSchema.parse({ startDate, endDate });
      dateRange = {
        startDate: new Date(validatedDates.startDate),
        endDate: new Date(validatedDates.endDate)
      };
    } else {
      // Default to last 30 days
      const endDateObj = new Date();
      const startDateObj = new Date();
      startDateObj.setDate(endDateObj.getDate() - 30);
      dateRange = {
        startDate: startDateObj,
        endDate: endDateObj
      };
    }

    // Validate analytics options
    const options: AnalyticsOptions = {};
    if (includeErrorAnalysis !== undefined) options.includeErrorAnalysis = includeErrorAnalysis;
    if (includePerformanceMetrics !== undefined) options.includePerformanceMetrics = includePerformanceMetrics;
    if (includeQualityMetrics !== undefined) options.includeQualityMetrics = includeQualityMetrics;
    if (includeTrends !== undefined) options.includeTrends = includeTrends;
    if (trendGranularity !== undefined) options.trendGranularity = trendGranularity;
    if (limit !== undefined) options.limit = limit;

    const analyticsService = c.get('analyticsService');
    
    // Get comprehensive analytics
    const analytics = await analyticsService.getProcessingAnalytics(
      authContext.tenant_id,
      dateRange,
      options
    );

    // Log analytics access
    await auditService.logSensitiveOperation('RECEIPT_ANALYTICS_DASHBOARD_ACCESSED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt processing analytics accessed: ${dateRange.startDate.toISOString().split('T')[0]} to ${dateRange.endDate.toISOString().split('T')[0]}`
    });

    return c.json({
      success: true,
      data: {
        ...analytics,
        metadata: {
          dateRange: {
            startDate: dateRange.startDate.toISOString().split('T')[0],
            endDate: dateRange.endDate.toISOString().split('T')[0]
          },
          options,
          generatedAt: new Date().toISOString()
        }
      },
      message: 'Receipt processing analytics retrieved successfully'
    }, 200);

  } catch (error) {
    console.error('Receipt processing analytics error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      await auditService.logSensitiveOperation('RECEIPT_ANALYTICS_VALIDATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Analytics validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      });
      
      return c.json(createErrorResponse(
        'Validation Error',
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        'VALIDATION_ERROR'
      ), 400);
    }

    // Log generic error
    await auditService.logSensitiveOperation('RECEIPT_ANALYTICS_DASHBOARD_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt processing analytics failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Analytics Failed',
      'Failed to retrieve receipt processing analytics',
      'ANALYTICS_ERROR'
    ), 500);
  }
});

/**
 * GET /analytics/parsing-accuracy - Get parsing accuracy and quality metrics
 * Requirements: 10.3 - Quality metrics for parsing effectiveness monitoring
 */
analytics.get('/parsing-accuracy', async (c) => {
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
    // Parse query parameters
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    // Validate date range if provided
    let dateRange: DateRange;
    if (startDate && endDate) {
      const validatedDates = dateRangeSchema.parse({ startDate, endDate });
      dateRange = {
        startDate: new Date(validatedDates.startDate),
        endDate: new Date(validatedDates.endDate)
      };
    } else {
      // Default to last 30 days
      const endDateObj = new Date();
      const startDateObj = new Date();
      startDateObj.setDate(endDateObj.getDate() - 30);
      dateRange = {
        startDate: startDateObj,
        endDate: endDateObj
      };
    }

    const analyticsService = c.get('analyticsService');
    
    // Get quality metrics focused on parsing accuracy
    const qualityMetrics = await analyticsService.getQualityMetrics(
      authContext.tenant_id,
      dateRange
    );

    // Get error analysis for parsing-specific insights
    const errorAnalysis = await analyticsService.getErrorAnalysis(
      authContext.tenant_id,
      dateRange
    );

    // Filter parsing-related errors
    const parsingErrors = errorAnalysis.commonErrors.filter(error => 
      error.errorType.includes('PARSING') || error.errorType.includes('TEXT')
    );

    const parsingStageErrors = errorAnalysis.errorsByStage.filter(stage => 
      stage.stage === 'PARSING'
    );

    const response = {
      ocrAccuracy: qualityMetrics.ocrAccuracy,
      parsingEffectiveness: qualityMetrics.parsingEffectiveness,
      parsingErrors: {
        commonParsingErrors: parsingErrors,
        parsingStageBreakdown: parsingStageErrors,
        suggestions: errorAnalysis.suggestions.filter(suggestion => 
          suggestion.toLowerCase().includes('parsing') || 
          suggestion.toLowerCase().includes('ocr') ||
          suggestion.toLowerCase().includes('accuracy')
        )
      },
      summary: {
        overallAccuracy: qualityMetrics.ocrAccuracy.avgConfidenceScore,
        parsingSuccessRate: qualityMetrics.parsingEffectiveness.vendorExtractionRate,
        improvementOpportunities: parsingErrors.length > 0 ? parsingErrors[0]?.suggestedFix : 'No major parsing issues detected'
      }
    };

    // Log quality metrics access
    await auditService.logSensitiveOperation('RECEIPT_PARSING_ACCURACY_ACCESSED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Parsing accuracy metrics accessed: ${dateRange.startDate.toISOString().split('T')[0]} to ${dateRange.endDate.toISOString().split('T')[0]}`
    });

    return c.json({
      success: true,
      data: {
        ...response,
        metadata: {
          dateRange: {
            startDate: dateRange.startDate.toISOString().split('T')[0],
            endDate: dateRange.endDate.toISOString().split('T')[0]
          },
          generatedAt: new Date().toISOString()
        }
      },
      message: 'Parsing accuracy metrics retrieved successfully'
    }, 200);

  } catch (error) {
    console.error('Parsing accuracy analytics error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      await auditService.logSensitiveOperation('PARSING_ACCURACY_VALIDATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Parsing accuracy validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      });
      
      return c.json(createErrorResponse(
        'Validation Error',
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        'VALIDATION_ERROR'
      ), 400);
    }

    // Log generic error
    await auditService.logSensitiveOperation('PARSING_ACCURACY_ANALYTICS_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Parsing accuracy analytics failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Analytics Failed',
      'Failed to retrieve parsing accuracy metrics',
      'ANALYTICS_ERROR'
    ), 500);
  }
});

/**
 * GET /analytics/processing-trends - Get processing performance trends and analysis
 * Requirements: 10.3 - Performance analysis for processing optimization
 */
analytics.get('/processing-trends', async (c) => {
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
    // Parse query parameters
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const granularity = c.req.query('granularity') as 'HOURLY' | 'DAILY' | 'WEEKLY' || 'DAILY';
    const limit = parseInt(c.req.query('limit') || '30', 10);

    // Validate date range if provided
    let dateRange: DateRange;
    if (startDate && endDate) {
      const validatedDates = dateRangeSchema.parse({ startDate, endDate });
      dateRange = {
        startDate: new Date(validatedDates.startDate),
        endDate: new Date(validatedDates.endDate)
      };
    } else {
      // Default to last 30 days
      const endDateObj = new Date();
      const startDateObj = new Date();
      startDateObj.setDate(endDateObj.getDate() - 30);
      dateRange = {
        startDate: startDateObj,
        endDate: endDateObj
      };
    }

    const analyticsService = c.get('analyticsService');
    
    // Get performance metrics and trends
    const performanceMetrics = await analyticsService.getPerformanceMetrics(
      authContext.tenant_id,
      dateRange
    );

    // Get processing analytics with trends
    const analytics = await analyticsService.getProcessingAnalytics(
      authContext.tenant_id,
      dateRange,
      {
        includePerformanceMetrics: true,
        includeTrends: true,
        trendGranularity: granularity,
        limit: Math.min(limit, 100)
      }
    );

    // Get bottleneck analysis
    const bottlenecks = await analyticsService.identifyBottlenecks(
      authContext.tenant_id,
      dateRange
    );

    // Get improvement suggestions
    const suggestions = await analyticsService.generateImprovementSuggestions(
      authContext.tenant_id,
      dateRange
    );

    const response = {
      performanceMetrics,
      trends: analytics.trends,
      bottlenecks,
      suggestions,
      summary: {
        avgProcessingTime: performanceMetrics.processingSpeed.totalAvgTimeMs,
        throughputPerDay: performanceMetrics.throughput.receiptsPerDay,
        criticalBottlenecks: bottlenecks.filter(b => b.severity === 'HIGH').length,
        improvementPriority: suggestions.length > 0 ? suggestions[0] : 'System performing optimally'
      }
    };

    // Log performance trends access
    await auditService.logSensitiveOperation('RECEIPT_PROCESSING_TRENDS_ACCESSED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Processing trends accessed: ${dateRange.startDate.toISOString().split('T')[0]} to ${dateRange.endDate.toISOString().split('T')[0]}, granularity: ${granularity}`
    });

    return c.json({
      success: true,
      data: {
        ...response,
        metadata: {
          dateRange: {
            startDate: dateRange.startDate.toISOString().split('T')[0],
            endDate: dateRange.endDate.toISOString().split('T')[0]
          },
          granularity,
          limit,
          generatedAt: new Date().toISOString()
        }
      },
      message: 'Processing trends retrieved successfully'
    }, 200);

  } catch (error) {
    console.error('Processing trends analytics error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      await auditService.logSensitiveOperation('PROCESSING_TRENDS_VALIDATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Processing trends validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      });
      
      return c.json(createErrorResponse(
        'Validation Error',
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        'VALIDATION_ERROR'
      ), 400);
    }

    // Log generic error
    await auditService.logSensitiveOperation('PROCESSING_TRENDS_ANALYTICS_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Processing trends analytics failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Analytics Failed',
      'Failed to retrieve processing trends',
      'ANALYTICS_ERROR'
    ), 500);
  }
});

export default analytics;