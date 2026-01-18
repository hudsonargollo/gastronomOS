/**
 * Quality Control API Routes
 * 
 * Handles manual review items, error monitoring, and quality statistics.
 * Implements requirements 7.2, 7.5 for the receipt scanning system.
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { createErrorHandlingService, IErrorHandlingService } from '../services/error-handling';
import { createAuditService, IAuditService, extractAuditContext } from '../services/audit';
import { createErrorResponse } from '../utils';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { receipts, receiptLineItems, receiptProcessingJobs } from '../db/schema';

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
  JWT_SECRET: string;
}

// Extend Hono context with services
type Variables = {
  errorHandlingService: IErrorHandlingService;
  auditService: IAuditService;
  authContext?: {
    user_id: string;
    tenant_id: string;
    role: string;
    location_id?: string;
  };
};

// Validation schemas
const approveReceiptSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional(),
  corrections: z.object({
    vendorName: z.string().optional(),
    totalAmountCents: z.number().optional(),
    transactionDate: z.number().optional(),
    lineItemCorrections: z.array(z.object({
      lineItemId: z.string(),
      description: z.string().optional(),
      matchedProductId: z.string().optional(),
      quantity: z.number().optional(),
      unitPriceCents: z.number().optional(),
      totalPriceCents: z.number().optional()
    })).optional()
  }).optional()
});

const qualityStatsFiltersSchema = z.object({
  startDate: z.string().optional(), // ISO date string
  endDate: z.string().optional(),   // ISO date string
  category: z.enum(['UPLOAD', 'OCR', 'PARSING', 'MATCHING', 'STORAGE', 'VALIDATION', 'SYSTEM']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional()
});

// Initialize quality control router
const qualityControl = new Hono<{ Bindings: Env; Variables: Variables }>();

// Service initialization middleware
qualityControl.use('*', async (c, next) => {
  try {
    const db = drizzle(c.env.DB);
    const errorHandlingService = createErrorHandlingService(db);
    const auditService = createAuditService(db);
    
    c.set('errorHandlingService', errorHandlingService);
    c.set('auditService', auditService);
    
    return await next();
  } catch (error) {
    console.error('Service initialization error:', error);
    return c.json(createErrorResponse(
      'Service Error',
      'Failed to initialize quality control services',
      'SERVICE_INIT_ERROR'
    ), 500);
  }
});

// Authentication middleware (placeholder - would use actual auth middleware)
qualityControl.use('*', async (c, next) => {
  // TODO: Replace with actual authentication middleware
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
 * GET /receipts/manual-review - Get receipts flagged for manual review
 * Requirements: 7.2 - Manual review flagging system
 */
qualityControl.get('/manual-review', async (c) => {
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
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const status = c.req.query('status') || 'pending'; // 'pending', 'all'
    const severity = c.req.query('severity'); // 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    const reason = c.req.query('reason'); // Manual review reason

    const db = drizzle(c.env.DB);
    
    // Build query conditions
    const conditions = [
      eq(receipts.tenantId, authContext.tenant_id),
      eq(receipts.requiresManualReview, true)
    ];

    // Get receipts requiring manual review
    const manualReviewReceipts = await db
      .select({
        receipt: receipts,
        processingJob: receiptProcessingJobs
      })
      .from(receipts)
      .leftJoin(receiptProcessingJobs, eq(receipts.processingJobId, receiptProcessingJobs.id))
      .where(and(...conditions))
      .orderBy(desc(receipts.createdAt))
      .limit(Math.min(limit, 100));

    // Get count of line items for each receipt
    const receiptIds = manualReviewReceipts.map(r => r.receipt.id);
    const lineItemCounts = receiptIds.length > 0 ? await db
      .select({
        receiptId: receiptLineItems.receiptId,
        count: sql<number>`count(*)`
      })
      .from(receiptLineItems)
      .where(sql`${receiptLineItems.receiptId} IN (${receiptIds.map(id => `'${id}'`).join(',')})`)
      .groupBy(receiptLineItems.receiptId) : [];

    // Get line items requiring manual review
    const manualReviewLineItems = await db
      .select({
        lineItem: receiptLineItems,
        receipt: receipts
      })
      .from(receiptLineItems)
      .innerJoin(receipts, eq(receiptLineItems.receiptId, receipts.id))
      .where(and(
        eq(receipts.tenantId, authContext.tenant_id),
        eq(receiptLineItems.requiresManualReview, true)
      ))
      .orderBy(desc(receiptLineItems.createdAt))
      .limit(Math.min(limit, 100));

    // Format response data
    const reviewItems = {
      receipts: manualReviewReceipts.map((item: any) => {
        const lineItemCount = lineItemCounts.find(c => c.receiptId === item.receipt.id)?.count || 0;
        return {
          id: item.receipt.id,
          processingJobId: item.receipt.processingJobId,
          vendorName: item.receipt.vendorName,
          transactionDate: item.receipt.transactionDate ? new Date(item.receipt.transactionDate).toISOString() : null,
          totalAmountCents: item.receipt.totalAmountCents,
          confidenceScore: item.receipt.confidenceScore,
          lineItemCount: lineItemCount,
          flaggedAt: new Date(item.receipt.createdAt).toISOString(),
          processingStatus: item.processingJob?.status || 'UNKNOWN',
          errorMessage: item.processingJob?.errorMessage || null,
          retryCount: item.processingJob?.retryCount || 0,
          reviewReason: item.receipt.confidenceScore < 0.3 ? 'LOW_CONFIDENCE' : 
                       !item.receipt.vendorName ? 'VENDOR_UNKNOWN' : 
                       !item.receipt.totalAmountCents ? 'PARSING_FAILED' : 'DATA_INCONSISTENCY'
        };
      }),
      lineItems: manualReviewLineItems.map((item: any) => ({
        id: item.lineItem.id,
        receiptId: item.lineItem.receiptId,
        description: item.lineItem.description,
        quantity: item.lineItem.quantity,
        unitPriceCents: item.lineItem.unitPriceCents,
        totalPriceCents: item.lineItem.totalPriceCents,
        matchConfidence: item.lineItem.matchConfidence,
        rawText: item.lineItem.rawText,
        flaggedAt: new Date(item.lineItem.createdAt).toISOString(),
        receipt: {
          vendorName: item.receipt.vendorName,
          transactionDate: item.receipt.transactionDate ? new Date(item.receipt.transactionDate).toISOString() : null
        },
        reviewReason: !item.lineItem.matchedProductId ? 'NO_PRODUCT_MATCH' : 
                     item.lineItem.matchConfidence < 0.3 ? 'LOW_CONFIDENCE' : 'DATA_INCONSISTENCY'
      }))
    };

    // Log manual review access
    await auditService.logSensitiveOperation('MANUAL_REVIEW_ACCESSED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Manual review items accessed: ${reviewItems.receipts.length} receipts, ${reviewItems.lineItems.length} line items`
    });

    return c.json({
      success: true,
      data: {
        ...reviewItems,
        metadata: {
          totalReceipts: reviewItems.receipts.length,
          totalLineItems: reviewItems.lineItems.length,
          requestedLimit: limit,
          filters: { status, severity, reason }
        }
      },
      message: 'Manual review items retrieved successfully'
    }, 200);

  } catch (error) {
    console.error('Manual review retrieval error:', error);

    await auditService.logSensitiveOperation('MANUAL_REVIEW_ACCESS_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Manual review access failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Manual Review Failed',
      'Failed to retrieve manual review items',
      'MANUAL_REVIEW_ERROR'
    ), 500);
  }
});

/**
 * POST /receipts/:id/approve - Approve receipt after manual review
 * Requirements: 7.2 - Manual approval system
 */
qualityControl.post('/:id/approve', async (c) => {
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
    const receiptId = c.req.param('id');
    if (!receiptId) {
      return c.json(createErrorResponse(
        'Invalid Request',
        'Receipt ID is required',
        'MISSING_RECEIPT_ID'
      ), 400);
    }

    // Parse and validate request body
    const body = await c.req.json();
    const validatedData = approveReceiptSchema.parse(body);

    const db = drizzle(c.env.DB);
    
    // Verify receipt exists and belongs to tenant
    const receiptQuery = await db
      .select()
      .from(receipts)
      .where(and(
        eq(receipts.id, receiptId),
        eq(receipts.tenantId, authContext.tenant_id)
      ))
      .limit(1);

    if (receiptQuery.length === 0) {
      return c.json(createErrorResponse(
        'Receipt Not Found',
        'The specified receipt was not found or access denied',
        'RECEIPT_NOT_FOUND'
      ), 404);
    }

    const receipt = receiptQuery[0];
    if (!receipt) {
      return c.json(createErrorResponse(
        'Receipt Not Found',
        'The specified receipt was not found',
        'RECEIPT_NOT_FOUND'
      ), 404);
    }

    const now = Date.now();

    if (validatedData.approved) {
      // Apply corrections if provided
      const updateData: any = {
        requiresManualReview: false,
        updatedAt: now
      };

      if (validatedData.corrections) {
        if (validatedData.corrections.vendorName) {
          updateData.vendorName = validatedData.corrections.vendorName;
        }
        if (validatedData.corrections.totalAmountCents) {
          updateData.totalAmountCents = validatedData.corrections.totalAmountCents;
        }
        if (validatedData.corrections.transactionDate) {
          updateData.transactionDate = validatedData.corrections.transactionDate;
        }
      }

      // Update receipt
      await db
        .update(receipts)
        .set(updateData)
        .where(eq(receipts.id, receiptId));

      // Apply line item corrections if provided
      if (validatedData.corrections?.lineItemCorrections) {
        for (const correction of validatedData.corrections.lineItemCorrections) {
          const lineItemUpdate: any = {
            requiresManualReview: false
          };

          if (correction.description) lineItemUpdate.description = correction.description;
          if (correction.matchedProductId) lineItemUpdate.matchedProductId = correction.matchedProductId;
          if (correction.quantity !== undefined) lineItemUpdate.quantity = correction.quantity;
          if (correction.unitPriceCents !== undefined) lineItemUpdate.unitPriceCents = correction.unitPriceCents;
          if (correction.totalPriceCents !== undefined) lineItemUpdate.totalPriceCents = correction.totalPriceCents;

          await db
            .update(receiptLineItems)
            .set(lineItemUpdate)
            .where(eq(receiptLineItems.id, correction.lineItemId));
        }
      }

      // Update processing job status
      await db
        .update(receiptProcessingJobs)
        .set({ 
          status: 'COMPLETED',
          completedAt: now
        })
        .where(eq(receiptProcessingJobs.id, receipt.processingJobId));

      // Log approval
      await auditService.logSensitiveOperation('RECEIPT_APPROVED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Receipt approved: ${receiptId}, corrections applied: ${!!validatedData.corrections}, notes: ${validatedData.notes || 'none'}`
      });

      return c.json({
        success: true,
        data: {
          receiptId,
          approved: true,
          approvedBy: authContext.user_id,
          approvedAt: new Date(now).toISOString(),
          correctionsApplied: !!validatedData.corrections,
          notes: validatedData.notes
        },
        message: 'Receipt approved successfully'
      }, 200);

    } else {
      // Receipt rejected - flag for further review or reprocessing
      await db
        .update(receiptProcessingJobs)
        .set({ 
          status: 'FAILED',
          errorMessage: `Manual review rejected: ${validatedData.notes || 'No reason provided'}`,
          completedAt: now
        })
        .where(eq(receiptProcessingJobs.id, receipt.processingJobId));

      // Log rejection
      await auditService.logSensitiveOperation('RECEIPT_REJECTED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Receipt rejected: ${receiptId}, reason: ${validatedData.notes || 'No reason provided'}`
      });

      return c.json({
        success: true,
        data: {
          receiptId,
          approved: false,
          rejectedBy: authContext.user_id,
          rejectedAt: new Date(now).toISOString(),
          reason: validatedData.notes
        },
        message: 'Receipt rejected'
      }, 200);
    }

  } catch (error) {
    console.error('Receipt approval error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      await auditService.logSensitiveOperation('RECEIPT_APPROVAL_VALIDATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Receipt approval validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      });
      
      return c.json(createErrorResponse(
        'Validation Error',
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        'VALIDATION_ERROR'
      ), 400);
    }

    await auditService.logSensitiveOperation('RECEIPT_APPROVAL_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt approval failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Approval Failed',
      'Failed to process receipt approval',
      'APPROVAL_ERROR'
    ), 500);
  }
});

/**
 * GET /quality-stats - Get quality control statistics and monitoring data
 * Requirements: 7.5 - Quality monitoring and statistics
 */
qualityControl.get('/quality-stats', async (c) => {
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
    const queryParams = {
      startDate: c.req.query('startDate'),
      endDate: c.req.query('endDate'),
      category: c.req.query('category'),
      severity: c.req.query('severity')
    };

    const validatedFilters = qualityStatsFiltersSchema.parse(queryParams);
    
    const errorHandlingService = c.get('errorHandlingService');
    
    // Build date range
    const dateRange = validatedFilters.startDate && validatedFilters.endDate ? {
      startDate: new Date(validatedFilters.startDate).getTime(),
      endDate: new Date(validatedFilters.endDate).getTime()
    } : undefined;

    // Get quality metrics
    const qualityMetrics = await errorHandlingService.getQualityMetrics(
      authContext.tenant_id,
      dateRange
    );

    // Get recent errors for analysis
    const recentErrors = await errorHandlingService.getProcessingErrors(
      authContext.tenant_id,
      {
        ...(validatedFilters.category && { category: validatedFilters.category as any }),
        ...(validatedFilters.severity && { severity: validatedFilters.severity as any }),
        ...(dateRange?.startDate && { startDate: dateRange.startDate }),
        ...(dateRange?.endDate && { endDate: dateRange.endDate }),
        limit: 20
      }
    );

    // Get manual review items
    const manualReviewItems = await errorHandlingService.getManualReviewItems(
      authContext.tenant_id,
      {
        ...(validatedFilters.severity && { severity: validatedFilters.severity as any }),
        ...(dateRange?.startDate && { startDate: dateRange.startDate }),
        ...(dateRange?.endDate && { endDate: dateRange.endDate }),
        limit: 20
      }
    );

    // Calculate additional quality indicators
    const qualityIndicators = {
      processingSuccessRate: qualityMetrics.totalProcessed > 0 
        ? (qualityMetrics.successfulProcessed / qualityMetrics.totalProcessed) * 100 
        : 0,
      manualReviewRate: qualityMetrics.totalProcessed > 0 
        ? (qualityMetrics.manualReviewRequired / qualityMetrics.totalProcessed) * 100 
        : 0,
      errorRate: qualityMetrics.totalProcessed > 0 
        ? (qualityMetrics.failedProcessed / qualityMetrics.totalProcessed) * 100 
        : 0,
      avgConfidenceScore: qualityMetrics.avgConfidenceScore,
      avgProcessingTimeSeconds: qualityMetrics.avgProcessingTime / 1000
    };

    const qualityStatsResponse = {
      summary: qualityMetrics,
      indicators: qualityIndicators,
      recentErrors: recentErrors.map(error => ({
        id: error.id,
        category: error.category,
        severity: error.severity,
        message: error.message,
        timestamp: new Date(error.timestamp).toISOString(),
        context: {
          retryCount: error.context.retryCount,
          stage: error.stage
        }
      })),
      manualReviewItems: manualReviewItems.map(item => ({
        id: item.id,
        reason: item.reason,
        severity: item.severity,
        description: item.description,
        flaggedAt: new Date(item.flaggedAt).toISOString(),
        resolved: item.resolved
      })),
      metadata: {
        dateRange: {
          startDate: validatedFilters.startDate,
          endDate: validatedFilters.endDate
        },
        filters: {
          category: validatedFilters.category,
          severity: validatedFilters.severity
        },
        generatedAt: new Date().toISOString()
      }
    };

    // Log quality stats access
    await auditService.logSensitiveOperation('QUALITY_STATS_ACCESSED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Quality stats accessed: ${qualityMetrics.totalProcessed} total processed, ${recentErrors.length} recent errors, ${manualReviewItems.length} manual review items`
    });

    return c.json({
      success: true,
      data: qualityStatsResponse,
      message: 'Quality statistics retrieved successfully'
    }, 200);

  } catch (error) {
    console.error('Quality stats error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      await auditService.logSensitiveOperation('QUALITY_STATS_VALIDATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Quality stats validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      });
      
      return c.json(createErrorResponse(
        'Validation Error',
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        'VALIDATION_ERROR'
      ), 400);
    }

    await auditService.logSensitiveOperation('QUALITY_STATS_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Quality stats failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Quality Stats Failed',
      'Failed to retrieve quality statistics',
      'QUALITY_STATS_ERROR'
    ), 500);
  }
});

export default qualityControl;