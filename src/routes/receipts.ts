/**
 * Receipt Upload API Routes
 * 
 * Handles secure receipt image uploads, processing status, and management.
 * Implements requirements 1.1, 1.4, 2.3 for the receipt scanning system.
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { createUploadService, IUploadService, ProcessingOptions } from '../services/upload';
import { createAuditService, IAuditService, extractAuditContext } from '../services/audit';
import { createReceiptProcessorWorker, IReceiptProcessorWorker } from '../services/receipt-processor';
import { createProductMatcher, IProductMatcher } from '../services/product-matcher';
import { createErrorResponse } from '../utils';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { receiptProcessingJobs, receiptProcessingStats, receiptLineItems, receipts as receiptsTable, ReceiptProcessingStatus } from '../db/schema';

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
  RECEIPT_BUCKET: R2Bucket;
  RECEIPT_QUEUE: Queue;
  AI: Ai;
  JWT_SECRET: string;
}

// Extend Hono context with services
type Variables = {
  uploadService: IUploadService;
  auditService: IAuditService;
  receiptProcessor: IReceiptProcessorWorker;
  productMatcher: IProductMatcher;
  authContext?: {
    user_id: string;
    tenant_id: string;
    role: string;
    location_id?: string;
  };
};

// Helper function to create database instance with schema
const createDB = (d1: D1Database) => drizzle(d1, { schema });

// Validation schemas
const confirmUploadSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().min(1, 'File size must be greater than 0').max(10 * 1024 * 1024, 'File size exceeds 10MB limit'),
  contentType: z.string().regex(/^image\/(jpeg|jpg|png|webp|heic|heif)$/i, 'Invalid image content type'),
  checksum: z.string().optional(),
  processingOptions: z.object({
    ocrModel: z.enum(['llama-vision', 'resnet-ocr']).optional(),
    parsingStrategy: z.enum(['AGGRESSIVE', 'CONSERVATIVE', 'ADAPTIVE']).optional(),
    productMatchingThreshold: z.number().min(0).max(1).optional(),
    requireManualReview: z.boolean().optional()
  }).optional()
});

const manualMatchSchema = z.object({
  productId: z.string().min(1, 'Product ID is required')
});

const flagForReviewSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long')
});

// Initialize receipts router
const receipts = new Hono<{ Bindings: Env; Variables: Variables }>();

// Service initialization middleware
receipts.use('*', async (c, next) => {
  try {
    const db = createDB(c.env.DB);
    const uploadService = createUploadService(db, c.env.RECEIPT_BUCKET, c.env.RECEIPT_QUEUE);
    const auditService = createAuditService(db);
    const receiptProcessor = createReceiptProcessorWorker(db, c.env.RECEIPT_BUCKET, c.env.AI);
    const productMatcher = createProductMatcher(db);
    
    c.set('uploadService', uploadService);
    c.set('auditService', auditService);
    c.set('receiptProcessor', receiptProcessor);
    c.set('productMatcher', productMatcher);
    
    return await next();
  } catch (error) {
    console.error('Service initialization error:', error);
    return c.json(createErrorResponse(
      'Service Error',
      'Failed to initialize receipt services',
      'SERVICE_INIT_ERROR'
    ), 500);
  }
});

// Authentication middleware (placeholder - would use actual auth middleware)
receipts.use('*', async (c, next) => {
  // TODO: Replace with actual authentication middleware
  // For now, extract from headers or use mock data
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
 * POST /receipts/upload-url - Generate presigned URL for receipt upload
 * Requirements: 1.1, 1.2
 */
receipts.post('/upload-url', async (c) => {
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
    const uploadService = c.get('uploadService');
    
    // Generate presigned URL for secure upload
    const uploadResponse = await uploadService.generateUploadURL(
      authContext.tenant_id,
      authContext.user_id
    );

    // Log upload URL generation
    await auditService.logSensitiveOperation('RECEIPT_UPLOAD_URL_GENERATED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Upload URL generated for receipt upload: ${uploadResponse.uploadId}`
    });

    return c.json({
      success: true,
      data: uploadResponse,
      message: 'Upload URL generated successfully'
    }, 200);

  } catch (error) {
    console.error('Upload URL generation error:', error);

    // Log error
    await auditService.logSensitiveOperation('RECEIPT_UPLOAD_URL_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Upload URL generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Upload URL Generation Failed',
      'Failed to generate secure upload URL',
      'UPLOAD_URL_ERROR'
    ), 500);
  }
});

/**
 * POST /receipts/confirm-upload - Confirm upload completion and trigger processing
 * Requirements: 1.4, 2.1
 */
receipts.post('/confirm-upload/:uploadId', async (c) => {
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
    const uploadId = c.req.param('uploadId');
    if (!uploadId) {
      return c.json(createErrorResponse(
        'Invalid Request',
        'Upload ID is required',
        'MISSING_UPLOAD_ID'
      ), 400);
    }

    // Parse and validate request body
    const body = await c.req.json();
    const validatedData = confirmUploadSchema.parse(body);
    
    const uploadService = c.get('uploadService');

    // Confirm upload and trigger processing
    const uploadMetadata = {
      fileName: validatedData.fileName,
      fileSize: validatedData.fileSize,
      contentType: validatedData.contentType,
      ...(validatedData.checksum && { checksum: validatedData.checksum })
    };

    // Prepare processing options
    const processingOptions: ProcessingOptions | undefined = validatedData.processingOptions ? {
      ocrModel: validatedData.processingOptions.ocrModel,
      parsingStrategy: validatedData.processingOptions.parsingStrategy,
      productMatchingThreshold: validatedData.processingOptions.productMatchingThreshold,
      requireManualReview: validatedData.processingOptions.requireManualReview
    } : undefined;

    const confirmation = await uploadService.confirmUpload(
      uploadId, 
      uploadMetadata,
      processingOptions
    );

    // Log successful upload confirmation
    await auditService.logSensitiveOperation('RECEIPT_UPLOAD_CONFIRMED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt upload confirmed: ${uploadId}, processing job: ${confirmation.processingJobId}`
    });

    return c.json({
      success: true,
      data: confirmation,
      message: 'Upload confirmed and processing started'
    }, 200);

  } catch (error) {
    console.error('Upload confirmation error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      await auditService.logSensitiveOperation('RECEIPT_UPLOAD_VALIDATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Upload confirmation validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      });
      
      return c.json(createErrorResponse(
        'Validation Error',
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        'VALIDATION_ERROR'
      ), 400);
    }

    // Log generic error
    await auditService.logSensitiveOperation('RECEIPT_UPLOAD_CONFIRMATION_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Upload confirmation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Upload Confirmation Failed',
      error instanceof Error ? error.message : 'Failed to confirm upload',
      'UPLOAD_CONFIRMATION_ERROR'
    ), 500);
  }
});

/**
 * GET /receipts/upload-status/:uploadId - Get upload and processing status
 * Requirements: 1.4, 2.3
 */
receipts.get('/upload-status/:uploadId', async (c) => {
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
    const uploadId = c.req.param('uploadId');
    if (!uploadId) {
      return c.json(createErrorResponse(
        'Invalid Request',
        'Upload ID is required',
        'MISSING_UPLOAD_ID'
      ), 400);
    }

    const uploadService = c.get('uploadService');
    
    // Get upload status
    const status = await uploadService.getUploadStatus(uploadId);
    
    if (!status) {
      return c.json(createErrorResponse(
        'Upload Not Found',
        'The specified upload was not found',
        'UPLOAD_NOT_FOUND'
      ), 404);
    }

    // Log status check (optional - might be too verbose)
    await auditService.logSensitiveOperation('RECEIPT_UPLOAD_STATUS_CHECKED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Upload status checked: ${uploadId}, status: ${status.status}`
    });

    return c.json({
      success: true,
      data: status,
      message: 'Upload status retrieved successfully'
    }, 200);

  } catch (error) {
    console.error('Upload status error:', error);

    // Log error
    await auditService.logSensitiveOperation('RECEIPT_UPLOAD_STATUS_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Upload status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Status Check Failed',
      'Failed to retrieve upload status',
      'STATUS_CHECK_ERROR'
    ), 500);
  }
});

/**
 * GET /receipts/upload-status - Get upload status for multiple uploads (optional)
 */
receipts.get('/upload-status', async (c) => {
  const authContext = c.get('authContext');
  
  if (!authContext) {
    return c.json(createErrorResponse(
      'Authentication Required',
      'User authentication is required',
      'AUTH_REQUIRED'
    ), 401);
  }

  // This would require additional implementation to query multiple uploads
  // For now, return a placeholder response
  return c.json({
    success: false,
    message: 'Bulk status checking not yet implemented',
    note: 'Use individual upload status endpoints'
  }, 501);
});

/**
 * GET /receipts/processing/:jobId - Get processing status for a specific job
 * Requirements: 2.3, 2.5
 */
receipts.get('/processing/:jobId', async (c) => {
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
    const jobId = c.req.param('jobId');
    if (!jobId) {
      return c.json(createErrorResponse(
        'Invalid Request',
        'Job ID is required',
        'MISSING_JOB_ID'
      ), 400);
    }

    const db = drizzle(c.env.DB);
    
    // Get processing job status with tenant isolation
    const jobs = await db
      .select()
      .from(receiptProcessingJobs)
      .where(and(
        eq(receiptProcessingJobs.id, jobId),
        eq(receiptProcessingJobs.tenantId, authContext.tenant_id)
      ))
      .limit(1);

    if (jobs.length === 0) {
      return c.json(createErrorResponse(
        'Job Not Found',
        'The specified processing job was not found',
        'JOB_NOT_FOUND'
      ), 404);
    }

    const job = jobs[0];
    if (!job) {
      return c.json(createErrorResponse(
        'Job Not Found',
        'The specified processing job was not found',
        'JOB_NOT_FOUND'
      ), 404);
    }

    // Calculate processing duration if applicable
    let processingDurationMs: number | null = null;
    if (job.startedAt && job.completedAt) {
      processingDurationMs = job.completedAt - job.startedAt;
    } else if (job.startedAt) {
      processingDurationMs = Date.now() - job.startedAt;
    }

    const statusResponse = {
      jobId: job.id,
      status: job.status,
      createdAt: new Date(job.createdAt).toISOString(),
      startedAt: job.startedAt ? new Date(job.startedAt).toISOString() : null,
      completedAt: job.completedAt ? new Date(job.completedAt).toISOString() : null,
      retryCount: job.retryCount || 0,
      errorMessage: job.errorMessage || null,
      processingDurationMs,
      processingOptions: job.processingOptions
    };

    // Log status check
    await auditService.logSensitiveOperation('RECEIPT_PROCESSING_STATUS_CHECKED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Processing status checked: ${jobId}, status: ${job.status}`
    });

    return c.json({
      success: true,
      data: statusResponse,
      message: 'Processing status retrieved successfully'
    }, 200);

  } catch (error) {
    console.error('Processing status error:', error);

    // Log error
    await auditService.logSensitiveOperation('RECEIPT_PROCESSING_STATUS_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Processing status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Status Check Failed',
      'Failed to retrieve processing status',
      'STATUS_CHECK_ERROR'
    ), 500);
  }
});

/**
 * POST /receipts/retry/:jobId - Manually retry a failed processing job
 * Requirements: 2.4, 2.5
 */
receipts.post('/retry/:jobId', async (c) => {
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
    const jobId = c.req.param('jobId');
    if (!jobId) {
      return c.json(createErrorResponse(
        'Invalid Request',
        'Job ID is required',
        'MISSING_JOB_ID'
      ), 400);
    }

    const db = drizzle(c.env.DB);
    
    // Get processing job with tenant isolation
    const jobs = await db
      .select()
      .from(receiptProcessingJobs)
      .where(and(
        eq(receiptProcessingJobs.id, jobId),
        eq(receiptProcessingJobs.tenantId, authContext.tenant_id)
      ))
      .limit(1);

    if (jobs.length === 0) {
      return c.json(createErrorResponse(
        'Job Not Found',
        'The specified processing job was not found',
        'JOB_NOT_FOUND'
      ), 404);
    }

    const job = jobs[0];
    if (!job) {
      return c.json(createErrorResponse(
        'Job Not Found',
        'The specified processing job was not found',
        'JOB_NOT_FOUND'
      ), 404);
    }

    // Check if job is in a retryable state
    if (job.status !== ReceiptProcessingStatus.FAILED) {
      return c.json(createErrorResponse(
        'Invalid Job State',
        `Job cannot be retried in current state: ${job.status}`,
        'INVALID_JOB_STATE'
      ), 400);
    }

    const receiptProcessor = c.get('receiptProcessor');
    const currentRetryCount = job.retryCount || 0;

    // Attempt to retry the processing
    const result = await receiptProcessor.retryFailedProcessing(jobId, currentRetryCount);

    // Log retry attempt
    await auditService.logSensitiveOperation('RECEIPT_PROCESSING_RETRY_ATTEMPTED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Processing retry attempted: ${jobId}, retry count: ${currentRetryCount + 1}, success: ${result.success}`
    });

    if (result.success) {
      return c.json({
        success: true,
        data: {
          jobId,
          retryCount: currentRetryCount + 1,
          processingStats: result.processingStats,
          requiresManualReview: result.requiresManualReview
        },
        message: 'Processing retry completed successfully'
      }, 200);
    } else {
      return c.json({
        success: false,
        data: {
          jobId,
          retryCount: currentRetryCount + 1,
          errors: result.errors,
          processingStats: result.processingStats
        },
        message: 'Processing retry failed',
        errors: result.errors
      }, 422);
    }

  } catch (error) {
    console.error('Processing retry error:', error);

    // Log error
    await auditService.logSensitiveOperation('RECEIPT_PROCESSING_RETRY_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Processing retry failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Retry Failed',
      'Failed to retry processing job',
      'RETRY_ERROR'
    ), 500);
  }
});

/**
 * GET /receipts/processing-stats - Get processing analytics and statistics
 * Requirements: 10.4
 */
receipts.get('/processing-stats', async (c) => {
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
    const db = drizzle(c.env.DB);
    
    // Parse query parameters for date filtering
    const startDate = c.req.query('startDate'); // YYYY-MM-DD format
    const endDate = c.req.query('endDate'); // YYYY-MM-DD format
    const limit = parseInt(c.req.query('limit') || '30', 10);

    // Build date filter conditions
    const dateConditions = [];
    if (startDate) {
      dateConditions.push(sql`${receiptProcessingStats.dateBucket} >= ${startDate}`);
    }
    if (endDate) {
      dateConditions.push(sql`${receiptProcessingStats.dateBucket} <= ${endDate}`);
    }

    // Get processing statistics with tenant isolation
    const statsQuery = db
      .select()
      .from(receiptProcessingStats)
      .where(and(
        eq(receiptProcessingStats.tenantId, authContext.tenant_id),
        ...dateConditions
      ))
      .orderBy(desc(receiptProcessingStats.dateBucket))
      .limit(Math.min(limit, 100)); // Cap at 100 records

    const stats = await statsQuery;

    // Get current processing job counts
    const jobCountsQuery = db
      .select({
        status: receiptProcessingJobs.status,
        count: sql<number>`count(*)`
      })
      .from(receiptProcessingJobs)
      .where(eq(receiptProcessingJobs.tenantId, authContext.tenant_id))
      .groupBy(receiptProcessingJobs.status);

    const jobCounts = await jobCountsQuery;

    // Calculate aggregate statistics
    const totalStats = stats.reduce((acc, stat) => {
      acc.totalProcessed += stat.totalProcessed || 0;
      acc.successfulProcessed += stat.successfulProcessed || 0;
      acc.failedProcessed += stat.failedProcessed || 0;
      acc.manualReviewRequired += stat.manualReviewRequired || 0;
      
      // Weighted average for processing time and confidence
      const weight = stat.totalProcessed || 0;
      if (weight > 0) {
        acc.totalWeight += weight;
        acc.weightedProcessingTime += (stat.avgProcessingTimeMs || 0) * weight;
        acc.weightedConfidenceScore += (stat.avgConfidenceScore || 0) * weight;
      }
      
      return acc;
    }, {
      totalProcessed: 0,
      successfulProcessed: 0,
      failedProcessed: 0,
      manualReviewRequired: 0,
      totalWeight: 0,
      weightedProcessingTime: 0,
      weightedConfidenceScore: 0
    });

    // Calculate final averages
    const avgProcessingTimeMs = totalStats.totalWeight > 0 
      ? Math.round(totalStats.weightedProcessingTime / totalStats.totalWeight)
      : 0;
    
    const avgConfidenceScore = totalStats.totalWeight > 0 
      ? totalStats.weightedConfidenceScore / totalStats.totalWeight
      : 0;

    // Calculate success rate
    const successRate = totalStats.totalProcessed > 0 
      ? (totalStats.successfulProcessed / totalStats.totalProcessed) * 100
      : 0;

    // Format job counts for easier consumption
    const currentJobCounts = jobCounts.reduce((acc, item) => {
      acc[item.status.toLowerCase()] = item.count;
      return acc;
    }, {} as Record<string, number>);

    const analyticsResponse = {
      summary: {
        totalProcessed: totalStats.totalProcessed,
        successfulProcessed: totalStats.successfulProcessed,
        failedProcessed: totalStats.failedProcessed,
        manualReviewRequired: totalStats.manualReviewRequired,
        successRate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
        avgProcessingTimeMs,
        avgConfidenceScore: Math.round(avgConfidenceScore * 1000) / 1000 // Round to 3 decimal places
      },
      currentJobs: {
        pending: currentJobCounts['pending'] || 0,
        processing: currentJobCounts['processing'] || 0,
        completed: currentJobCounts['completed'] || 0,
        failed: currentJobCounts['failed'] || 0,
        requiresReview: currentJobCounts['requires_review'] || 0
      },
      dailyStats: stats.map(stat => ({
        date: stat.dateBucket,
        totalProcessed: stat.totalProcessed || 0,
        successfulProcessed: stat.successfulProcessed || 0,
        failedProcessed: stat.failedProcessed || 0,
        manualReviewRequired: stat.manualReviewRequired || 0,
        successRate: (stat.totalProcessed || 0) > 0 
          ? Math.round(((stat.successfulProcessed || 0) / (stat.totalProcessed || 0)) * 10000) / 100
          : 0,
        avgProcessingTimeMs: stat.avgProcessingTimeMs || 0,
        avgConfidenceScore: stat.avgConfidenceScore || 0
      })),
      metadata: {
        dateRange: {
          startDate: startDate || null,
          endDate: endDate || null
        },
        recordCount: stats.length,
        requestedLimit: limit
      }
    };

    // Log analytics access
    await auditService.logSensitiveOperation('RECEIPT_PROCESSING_ANALYTICS_ACCESSED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Processing analytics accessed: ${stats.length} records, date range: ${startDate || 'all'} to ${endDate || 'all'}`
    });

    return c.json({
      success: true,
      data: analyticsResponse,
      message: 'Processing statistics retrieved successfully'
    }, 200);

  } catch (error) {
    console.error('Processing stats error:', error);

    // Log error
    await auditService.logSensitiveOperation('RECEIPT_PROCESSING_ANALYTICS_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Processing analytics failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Analytics Failed',
      'Failed to retrieve processing statistics',
      'ANALYTICS_ERROR'
    ), 500);
  }
});

/**
 * GET /receipts/line-items/:lineItemId/match-candidates - Get product match candidates for manual selection
 * Requirements: 5.4 - Manual product match selection
 */
receipts.get('/line-items/:lineItemId/match-candidates', async (c) => {
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
    const lineItemId = c.req.param('lineItemId');
    if (!lineItemId) {
      return c.json(createErrorResponse(
        'Invalid Request',
        'Line item ID is required',
        'MISSING_LINE_ITEM_ID'
      ), 400);
    }

    // Verify line item belongs to user's tenant
    const db = drizzle(c.env.DB);
    const lineItemCheck = await db
      .select({ receiptId: receiptLineItems.receiptId })
      .from(receiptLineItems)
      .innerJoin(receiptsTable, eq(receiptLineItems.receiptId, receiptsTable.id))
      .where(and(
        eq(receiptLineItems.id, lineItemId),
        eq(receiptsTable.tenantId, authContext.tenant_id)
      ))
      .limit(1);

    if (lineItemCheck.length === 0) {
      return c.json(createErrorResponse(
        'Line Item Not Found',
        'The specified line item was not found or access denied',
        'LINE_ITEM_NOT_FOUND'
      ), 404);
    }

    const productMatcher = c.get('productMatcher');
    const candidates = await productMatcher.getMatchCandidatesForLineItem(lineItemId);

    // Log access to match candidates
    await auditService.logSensitiveOperation('RECEIPT_MATCH_CANDIDATES_ACCESSED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Match candidates accessed for line item: ${lineItemId}, found ${candidates.length} candidates`
    });

    return c.json({
      success: true,
      data: {
        lineItemId,
        candidates: candidates.map((candidate: any) => ({
          id: candidate.id,
          productId: candidate.productId,
          similarityScore: candidate.similarityScore,
          matchType: candidate.matchType,
          confidence: candidate.confidence,
          createdAt: new Date(candidate.createdAt).toISOString()
        }))
      },
      message: 'Match candidates retrieved successfully'
    }, 200);

  } catch (error) {
    console.error('Match candidates retrieval error:', error);

    await auditService.logSensitiveOperation('RECEIPT_MATCH_CANDIDATES_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Match candidates retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Match Candidates Failed',
      'Failed to retrieve product match candidates',
      'MATCH_CANDIDATES_ERROR'
    ), 500);
  }
});

/**
 * POST /receipts/line-items/:lineItemId/manual-match - Apply manual product match
 * Requirements: 5.4 - Manual override of automatic product matches
 */
receipts.post('/line-items/:lineItemId/manual-match', async (c) => {
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
    const lineItemId = c.req.param('lineItemId');
    if (!lineItemId) {
      return c.json(createErrorResponse(
        'Invalid Request',
        'Line item ID is required',
        'MISSING_LINE_ITEM_ID'
      ), 400);
    }

    // Parse and validate request body
    const body = await c.req.json();
    const validatedData = manualMatchSchema.parse(body);

    // Verify line item belongs to user's tenant
    const db = drizzle(c.env.DB);
    const lineItemCheck = await db
      .select({ receiptId: receiptLineItems.receiptId })
      .from(receiptLineItems)
      .innerJoin(receiptsTable, eq(receiptLineItems.receiptId, receiptsTable.id))
      .where(and(
        eq(receiptLineItems.id, lineItemId),
        eq(receiptsTable.tenantId, authContext.tenant_id)
      ))
      .limit(1);

    if (lineItemCheck.length === 0) {
      return c.json(createErrorResponse(
        'Line Item Not Found',
        'The specified line item was not found or access denied',
        'LINE_ITEM_NOT_FOUND'
      ), 404);
    }

    const productMatcher = c.get('productMatcher');
    await productMatcher.applyManualProductMatch(
      lineItemId, 
      validatedData.productId, 
      authContext.user_id
    );

    // Log manual match application
    await auditService.logSensitiveOperation('RECEIPT_MANUAL_MATCH_APPLIED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Manual product match applied: line item ${lineItemId} -> product ${validatedData.productId}`
    });

    return c.json({
      success: true,
      data: {
        lineItemId,
        productId: validatedData.productId,
        appliedAt: new Date().toISOString(),
        appliedBy: authContext.user_id
      },
      message: 'Manual product match applied successfully'
    }, 200);

  } catch (error) {
    console.error('Manual match application error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      await auditService.logSensitiveOperation('RECEIPT_MANUAL_MATCH_VALIDATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Manual match validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      });
      
      return c.json(createErrorResponse(
        'Validation Error',
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        'VALIDATION_ERROR'
      ), 400);
    }

    await auditService.logSensitiveOperation('RECEIPT_MANUAL_MATCH_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Manual match application failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Manual Match Failed',
      'Failed to apply manual product match',
      'MANUAL_MATCH_ERROR'
    ), 500);
  }
});

/**
 * POST /receipts/line-items/:lineItemId/flag-for-review - Flag line item for manual review
 * Requirements: 5.5 - Unmatched item flagging system
 */
receipts.post('/line-items/:lineItemId/flag-for-review', async (c) => {
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
    const lineItemId = c.req.param('lineItemId');
    if (!lineItemId) {
      return c.json(createErrorResponse(
        'Invalid Request',
        'Line item ID is required',
        'MISSING_LINE_ITEM_ID'
      ), 400);
    }

    // Parse and validate request body
    const body = await c.req.json();
    const validatedData = flagForReviewSchema.parse(body);

    // Verify line item belongs to user's tenant
    const db = drizzle(c.env.DB);
    const lineItemCheck = await db
      .select({ receiptId: receiptLineItems.receiptId })
      .from(receiptLineItems)
      .innerJoin(receiptsTable, eq(receiptLineItems.receiptId, receiptsTable.id))
      .where(and(
        eq(receiptLineItems.id, lineItemId),
        eq(receiptsTable.tenantId, authContext.tenant_id)
      ))
      .limit(1);

    if (lineItemCheck.length === 0) {
      return c.json(createErrorResponse(
        'Line Item Not Found',
        'The specified line item was not found or access denied',
        'LINE_ITEM_NOT_FOUND'
      ), 404);
    }

    const productMatcher = c.get('productMatcher');
    await productMatcher.flagLineItemForManualReview(
      lineItemId, 
      validatedData.reason, 
      authContext.user_id
    );

    // Log flagging for review
    await auditService.logSensitiveOperation('RECEIPT_LINE_ITEM_FLAGGED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Line item flagged for manual review: ${lineItemId}, reason: ${validatedData.reason}`
    });

    return c.json({
      success: true,
      data: {
        lineItemId,
        reason: validatedData.reason,
        flaggedAt: new Date().toISOString(),
        flaggedBy: authContext.user_id
      },
      message: 'Line item flagged for manual review successfully'
    }, 200);

  } catch (error) {
    console.error('Flag for review error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      await auditService.logSensitiveOperation('RECEIPT_FLAG_VALIDATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Flag validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      });
      
      return c.json(createErrorResponse(
        'Validation Error',
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        'VALIDATION_ERROR'
      ), 400);
    }

    await auditService.logSensitiveOperation('RECEIPT_FLAG_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Flag for review failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Flag Failed',
      'Failed to flag line item for manual review',
      'FLAG_ERROR'
    ), 500);
  }
});

/**
 * GET /receipts/unmatched-items - Get unmatched line items requiring manual review
 * Requirements: 5.5 - Unmatched item flagging system
 */
receipts.get('/unmatched-items', async (c) => {
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

    const productMatcher = c.get('productMatcher');
    const unmatchedItems = await productMatcher.getUnmatchedLineItems(
      authContext.tenant_id, 
      Math.min(limit, 100) // Cap at 100 items
    );

    // Log access to unmatched items
    await auditService.logSensitiveOperation('RECEIPT_UNMATCHED_ITEMS_ACCESSED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Unmatched items accessed: found ${unmatchedItems.length} items`
    });

    return c.json({
      success: true,
      data: {
        unmatchedItems: unmatchedItems.map((item: any) => ({
          id: item.id,
          receiptId: item.receiptId,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          totalPriceCents: item.totalPriceCents,
          rawText: item.rawText,
          createdAt: new Date(item.createdAt).toISOString(),
          receipt: {
            vendorName: item.receipt.vendorName,
            transactionDate: item.receipt.transactionDate ? new Date(item.receipt.transactionDate).toISOString() : null
          }
        })),
        metadata: {
          count: unmatchedItems.length,
          requestedLimit: limit
        }
      },
      message: 'Unmatched items retrieved successfully'
    }, 200);

  } catch (error) {
    console.error('Unmatched items retrieval error:', error);

    await auditService.logSensitiveOperation('RECEIPT_UNMATCHED_ITEMS_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Unmatched items retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Unmatched Items Failed',
      'Failed to retrieve unmatched items',
      'UNMATCHED_ITEMS_ERROR'
    ), 500);
  }
});

// ===== RECEIPT MANAGEMENT ENDPOINTS =====
// Requirements: 6.1, 8.5

// Validation schemas for receipt management
const receiptUpdateSchema = z.object({
  vendorName: z.string().min(1).max(255).optional(),
  transactionDate: z.string().datetime().optional(),
  totalAmountCents: z.number().int().min(0).optional(),
  subtotalCents: z.number().int().min(0).optional(),
  taxCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  requiresManualReview: z.boolean().optional(),
  linkedPoId: z.string().optional(),
});

/**
 * GET /receipts - Get receipt listing with filtering
 * Requirements: 6.1 - Receipt data retrieval and filtering
 */
receipts.get('/', async (c) => {
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
    const db = drizzle(c.env.DB);
    
    // Parse query parameters for filtering
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const vendorName = c.req.query('vendor');
    const startDate = c.req.query('startDate'); // YYYY-MM-DD format
    const endDate = c.req.query('endDate'); // YYYY-MM-DD format
    const requiresReview = c.req.query('requiresReview') === 'true';
    const linkedPoId = c.req.query('linkedPoId');

    // Build filter conditions
    const conditions = [eq(receiptsTable.tenantId, authContext.tenant_id)];
    
    if (vendorName) {
      conditions.push(sql`${receiptsTable.vendorName} LIKE ${`%${vendorName}%`}`);
    }
    
    if (startDate) {
      const startTimestamp = new Date(startDate).getTime();
      conditions.push(sql`${receiptsTable.transactionDate} >= ${startTimestamp}`);
    }
    
    if (endDate) {
      const endTimestamp = new Date(endDate).getTime();
      conditions.push(sql`${receiptsTable.transactionDate} <= ${endTimestamp}`);
    }
    
    if (requiresReview) {
      conditions.push(eq(receiptsTable.requiresManualReview, true));
    }
    
    if (linkedPoId) {
      conditions.push(eq(receiptsTable.linkedPoId, linkedPoId));
    }

    // Get receipts with filtering
    const receiptsQuery = db
      .select({
        id: receiptsTable.id,
        processingJobId: receiptsTable.processingJobId,
        r2Key: receiptsTable.r2Key,
        vendorName: receiptsTable.vendorName,
        transactionDate: receiptsTable.transactionDate,
        totalAmountCents: receiptsTable.totalAmountCents,
        subtotalCents: receiptsTable.subtotalCents,
        taxCents: receiptsTable.taxCents,
        currency: receiptsTable.currency,
        confidenceScore: receiptsTable.confidenceScore,
        requiresManualReview: receiptsTable.requiresManualReview,
        linkedPoId: receiptsTable.linkedPoId,
        createdAt: receiptsTable.createdAt,
        updatedAt: receiptsTable.updatedAt,
      })
      .from(receiptsTable)
      .where(and(...conditions))
      .orderBy(desc(receiptsTable.createdAt))
      .limit(limit)
      .offset(offset);

    const receiptsData = await receiptsQuery;

    // Get total count for pagination
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(receiptsTable)
      .where(and(...conditions));

    const countResult = await countQuery;
    const totalCount = countResult[0]?.count || 0;

    // Format response
    const formattedReceipts = receiptsData.map(receipt => ({
      id: receipt.id,
      processingJobId: receipt.processingJobId,
      vendorName: receipt.vendorName,
      transactionDate: receipt.transactionDate ? new Date(receipt.transactionDate).toISOString() : null,
      totalAmountCents: receipt.totalAmountCents,
      subtotalCents: receipt.subtotalCents,
      taxCents: receipt.taxCents,
      currency: receipt.currency,
      confidenceScore: receipt.confidenceScore,
      requiresManualReview: receipt.requiresManualReview,
      linkedPoId: receipt.linkedPoId,
      createdAt: new Date(receipt.createdAt).toISOString(),
      updatedAt: new Date(receipt.updatedAt).toISOString(),
    }));

    // Log receipt listing access
    await auditService.logSensitiveOperation('RECEIPTS_LISTED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipts listed: ${receiptsData.length} receipts, filters: vendor=${vendorName || 'none'}, dates=${startDate || 'none'}-${endDate || 'none'}`
    });

    return c.json({
      success: true,
      data: {
        receipts: formattedReceipts,
        pagination: {
          limit,
          offset,
          totalCount,
          hasMore: offset + limit < totalCount
        },
        filters: {
          vendorName: vendorName || null,
          startDate: startDate || null,
          endDate: endDate || null,
          requiresReview,
          linkedPoId: linkedPoId || null
        }
      },
      message: 'Receipts retrieved successfully'
    }, 200);

  } catch (error) {
    console.error('Receipt listing error:', error);

    await auditService.logSensitiveOperation('RECEIPTS_LISTING_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt listing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Receipt Listing Failed',
      'Failed to retrieve receipts',
      'RECEIPT_LISTING_ERROR'
    ), 500);
  }
});

/**
 * GET /receipts/:id - Get detailed receipt view
 * Requirements: 6.1 - Receipt data retrieval
 */
receipts.get('/:id', async (c) => {
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

    const db = drizzle(c.env.DB);

    // Get receipt with tenant isolation
    const receiptQuery = db
      .select({
        id: receiptsTable.id,
        processingJobId: receiptsTable.processingJobId,
        r2Key: receiptsTable.r2Key,
        vendorName: receiptsTable.vendorName,
        transactionDate: receiptsTable.transactionDate,
        totalAmountCents: receiptsTable.totalAmountCents,
        subtotalCents: receiptsTable.subtotalCents,
        taxCents: receiptsTable.taxCents,
        currency: receiptsTable.currency,
        confidenceScore: receiptsTable.confidenceScore,
        requiresManualReview: receiptsTable.requiresManualReview,
        linkedPoId: receiptsTable.linkedPoId,
        createdAt: receiptsTable.createdAt,
        updatedAt: receiptsTable.updatedAt,
      })
      .from(receiptsTable)
      .where(and(
        eq(receiptsTable.id, receiptId),
        eq(receiptsTable.tenantId, authContext.tenant_id)
      ))
      .limit(1);

    const receiptData = await receiptQuery;

    if (receiptData.length === 0) {
      return c.json(createErrorResponse(
        'Receipt Not Found',
        'The specified receipt was not found or access denied',
        'RECEIPT_NOT_FOUND'
      ), 404);
    }

    const receipt = receiptData[0];
    if (!receipt) {
      return c.json(createErrorResponse(
        'Receipt Not Found',
        'The specified receipt was not found or access denied',
        'RECEIPT_NOT_FOUND'
      ), 404);
    }

    // Get receipt line items
    const lineItemsQuery = db
      .select({
        id: receiptLineItems.id,
        description: receiptLineItems.description,
        quantity: receiptLineItems.quantity,
        unitPriceCents: receiptLineItems.unitPriceCents,
        totalPriceCents: receiptLineItems.totalPriceCents,
        matchedProductId: receiptLineItems.matchedProductId,
        matchConfidence: receiptLineItems.matchConfidence,
        requiresManualReview: receiptLineItems.requiresManualReview,
        rawText: receiptLineItems.rawText,
        coordinates: receiptLineItems.coordinates,
        createdAt: receiptLineItems.createdAt,
      })
      .from(receiptLineItems)
      .where(eq(receiptLineItems.receiptId, receiptId))
      .orderBy(receiptLineItems.createdAt);

    const lineItemsData = await lineItemsQuery;

    // Format response
    const detailedReceipt = {
      id: receipt.id,
      processingJobId: receipt.processingJobId,
      vendorName: receipt.vendorName,
      transactionDate: receipt.transactionDate ? new Date(receipt.transactionDate).toISOString() : null,
      totalAmountCents: receipt.totalAmountCents,
      subtotalCents: receipt.subtotalCents,
      taxCents: receipt.taxCents,
      currency: receipt.currency,
      confidenceScore: receipt.confidenceScore,
      requiresManualReview: receipt.requiresManualReview,
      linkedPoId: receipt.linkedPoId,
      createdAt: new Date(receipt.createdAt).toISOString(),
      updatedAt: new Date(receipt.updatedAt).toISOString(),
      lineItems: lineItemsData.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        totalPriceCents: item.totalPriceCents,
        matchedProductId: item.matchedProductId,
        matchConfidence: item.matchConfidence,
        requiresManualReview: item.requiresManualReview,
        rawText: item.rawText,
        coordinates: item.coordinates,
        createdAt: new Date(item.createdAt).toISOString(),
      }))
    };

    // Log receipt access
    await auditService.logSensitiveOperation('RECEIPT_ACCESSED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt accessed: ${receiptId}, vendor: ${receipt.vendorName || 'unknown'}`
    });

    return c.json({
      success: true,
      data: detailedReceipt,
      message: 'Receipt retrieved successfully'
    }, 200);

  } catch (error) {
    console.error('Receipt retrieval error:', error);

    await auditService.logSensitiveOperation('RECEIPT_ACCESS_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt access failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Receipt Retrieval Failed',
      'Failed to retrieve receipt details',
      'RECEIPT_RETRIEVAL_ERROR'
    ), 500);
  }
});

/**
 * PUT /receipts/:id - Update receipt data
 * Requirements: 6.1 - Receipt updates
 */
receipts.put('/:id', async (c) => {
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
    const validatedData = receiptUpdateSchema.parse(body);

    const db = drizzle(c.env.DB);

    // Verify receipt exists and belongs to tenant
    const existingReceipt = await db
      .select({ id: receiptsTable.id })
      .from(receiptsTable)
      .where(and(
        eq(receiptsTable.id, receiptId),
        eq(receiptsTable.tenantId, authContext.tenant_id)
      ))
      .limit(1);

    if (existingReceipt.length === 0) {
      return c.json(createErrorResponse(
        'Receipt Not Found',
        'The specified receipt was not found or access denied',
        'RECEIPT_NOT_FOUND'
      ), 404);
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: Date.now()
    };

    if (validatedData.vendorName !== undefined) {
      updateData.vendorName = validatedData.vendorName;
    }
    
    if (validatedData.transactionDate !== undefined) {
      updateData.transactionDate = new Date(validatedData.transactionDate).getTime();
    }
    
    if (validatedData.totalAmountCents !== undefined) {
      updateData.totalAmountCents = validatedData.totalAmountCents;
    }
    
    if (validatedData.subtotalCents !== undefined) {
      updateData.subtotalCents = validatedData.subtotalCents;
    }
    
    if (validatedData.taxCents !== undefined) {
      updateData.taxCents = validatedData.taxCents;
    }
    
    if (validatedData.currency !== undefined) {
      updateData.currency = validatedData.currency;
    }
    
    if (validatedData.requiresManualReview !== undefined) {
      updateData.requiresManualReview = validatedData.requiresManualReview;
    }
    
    if (validatedData.linkedPoId !== undefined) {
      updateData.linkedPoId = validatedData.linkedPoId;
    }

    // Update receipt
    await db
      .update(receiptsTable)
      .set(updateData)
      .where(eq(receiptsTable.id, receiptId));

    // Log receipt update
    await auditService.logSensitiveOperation('RECEIPT_UPDATED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt updated: ${receiptId}, fields: ${Object.keys(updateData).filter(k => k !== 'updatedAt').join(', ')}`
    });

    return c.json({
      success: true,
      data: {
        receiptId,
        updatedFields: Object.keys(updateData).filter(k => k !== 'updatedAt'),
        updatedAt: new Date(updateData.updatedAt).toISOString(),
        updatedBy: authContext.user_id
      },
      message: 'Receipt updated successfully'
    }, 200);

  } catch (error) {
    console.error('Receipt update error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      await auditService.logSensitiveOperation('RECEIPT_UPDATE_VALIDATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Receipt update validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      });
      
      return c.json(createErrorResponse(
        'Validation Error',
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        'VALIDATION_ERROR'
      ), 400);
    }

    await auditService.logSensitiveOperation('RECEIPT_UPDATE_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Receipt Update Failed',
      'Failed to update receipt',
      'RECEIPT_UPDATE_ERROR'
    ), 500);
  }
});

/**
 * DELETE /receipts/:id - Delete receipt and associated data
 * Requirements: 8.5 - Receipt data deletion
 */
receipts.delete('/:id', async (c) => {
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

    const db = drizzle(c.env.DB);

    // Get receipt details before deletion for audit log
    const receiptToDelete = await db
      .select({
        id: receiptsTable.id,
        r2Key: receiptsTable.r2Key,
        vendorName: receiptsTable.vendorName,
        transactionDate: receiptsTable.transactionDate,
        totalAmountCents: receiptsTable.totalAmountCents
      })
      .from(receiptsTable)
      .where(and(
        eq(receiptsTable.id, receiptId),
        eq(receiptsTable.tenantId, authContext.tenant_id)
      ))
      .limit(1);

    if (receiptToDelete.length === 0) {
      return c.json(createErrorResponse(
        'Receipt Not Found',
        'The specified receipt was not found or access denied',
        'RECEIPT_NOT_FOUND'
      ), 404);
    }

    const receipt = receiptToDelete[0];
    if (!receipt) {
      return c.json(createErrorResponse(
        'Receipt Not Found',
        'The specified receipt was not found or access denied',
        'RECEIPT_NOT_FOUND'
      ), 404);
    }

    // Delete receipt (cascade will handle line items and match candidates)
    await db
      .delete(receiptsTable)
      .where(eq(receiptsTable.id, receiptId));

    // TODO: Delete R2 image file if needed
    // This would require additional implementation to clean up R2 storage
    // For now, we'll just log the R2 key for manual cleanup if needed

    // Log receipt deletion
    await auditService.logSensitiveOperation('RECEIPT_DELETED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt deleted: ${receiptId}, vendor: ${receipt.vendorName || 'unknown'}, r2Key: ${receipt.r2Key}, amount: ${receipt.totalAmountCents || 0} cents`
    });

    return c.json({
      success: true,
      data: {
        receiptId,
        deletedAt: new Date().toISOString(),
        deletedBy: authContext.user_id,
        r2Key: receipt.r2Key // For potential cleanup reference
      },
      message: 'Receipt deleted successfully'
    }, 200);

  } catch (error) {
    console.error('Receipt deletion error:', error);

    await auditService.logSensitiveOperation('RECEIPT_DELETION_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Receipt Deletion Failed',
      'Failed to delete receipt',
      'RECEIPT_DELETION_ERROR'
    ), 500);
  }
});

// ===== RECEIPT IMAGE SERVING ENDPOINTS =====
// Requirements: 1.5, 6.4, 8.4

/**
 * GET /receipts/:id/image - Get secure receipt image access
 * Requirements: 1.5, 8.4 - Secure receipt image access
 */
receipts.get('/:id/image', async (c) => {
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

    const db = drizzle(c.env.DB);

    // Get receipt with tenant isolation
    const receiptQuery = await db
      .select({
        id: receiptsTable.id,
        r2Key: receiptsTable.r2Key,
        vendorName: receiptsTable.vendorName,
      })
      .from(receiptsTable)
      .where(and(
        eq(receiptsTable.id, receiptId),
        eq(receiptsTable.tenantId, authContext.tenant_id)
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
        'The specified receipt was not found or access denied',
        'RECEIPT_NOT_FOUND'
      ), 404);
    }

    // Get image from R2
    const r2Object = await c.env.RECEIPT_BUCKET.get(receipt.r2Key);
    
    if (!r2Object) {
      await auditService.logSensitiveOperation('RECEIPT_IMAGE_NOT_FOUND', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Receipt image not found in R2: ${receiptId}, r2Key: ${receipt.r2Key}`
      });

      return c.json(createErrorResponse(
        'Image Not Found',
        'The receipt image could not be found',
        'IMAGE_NOT_FOUND'
      ), 404);
    }

    // Log image access
    await auditService.logSensitiveOperation('RECEIPT_IMAGE_ACCESSED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt image accessed: ${receiptId}, vendor: ${receipt.vendorName || 'unknown'}`
    });

    // Set appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', r2Object.httpMetadata?.contentType || 'image/jpeg');
    headers.set('Content-Length', r2Object.size.toString());
    headers.set('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour
    headers.set('Content-Disposition', `inline; filename="receipt-${receiptId}.jpg"`);

    return new Response(r2Object.body, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Receipt image access error:', error);

    await auditService.logSensitiveOperation('RECEIPT_IMAGE_ACCESS_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt image access failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Image Access Failed',
      'Failed to retrieve receipt image',
      'IMAGE_ACCESS_ERROR'
    ), 500);
  }
});

/**
 * GET /receipts/:id/image/thumbnail - Get receipt image thumbnail
 * Requirements: 6.4 - Image thumbnail generation
 */
receipts.get('/:id/image/thumbnail', async (c) => {
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

    // Parse thumbnail size parameters
    const width = parseInt(c.req.query('width') || '200', 10);
    const height = parseInt(c.req.query('height') || '300', 10);
    
    // Validate thumbnail dimensions
    if (width < 50 || width > 500 || height < 50 || height > 500) {
      return c.json(createErrorResponse(
        'Invalid Dimensions',
        'Thumbnail dimensions must be between 50x50 and 500x500 pixels',
        'INVALID_DIMENSIONS'
      ), 400);
    }

    const db = drizzle(c.env.DB);

    // Get receipt with tenant isolation
    const receiptQuery = await db
      .select({
        id: receiptsTable.id,
        r2Key: receiptsTable.r2Key,
        vendorName: receiptsTable.vendorName,
      })
      .from(receiptsTable)
      .where(and(
        eq(receiptsTable.id, receiptId),
        eq(receiptsTable.tenantId, authContext.tenant_id)
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
        'The specified receipt was not found or access denied',
        'RECEIPT_NOT_FOUND'
      ), 404);
    }

    // Check if thumbnail already exists in R2
    const thumbnailKey = `thumbnails/${receipt.r2Key}-${width}x${height}`;
    let thumbnailObject = await c.env.RECEIPT_BUCKET.get(thumbnailKey);

    if (!thumbnailObject) {
      // Get original image
      const originalObject = await c.env.RECEIPT_BUCKET.get(receipt.r2Key);
      
      if (!originalObject) {
        return c.json(createErrorResponse(
          'Original Image Not Found',
          'The original receipt image could not be found',
          'ORIGINAL_IMAGE_NOT_FOUND'
        ), 404);
      }

      // Generate thumbnail using Cloudflare Images API or basic resizing
      // For now, we'll use a simple approach - in production, you'd want proper image resizing
      // This is a placeholder implementation that would need actual image processing
      
      try {
        // Use Cloudflare Workers AI for image processing if available
        // This is a simplified approach - in production you'd use proper image resizing
        const imageBuffer = await originalObject.arrayBuffer();
        
        // For now, we'll store the original image as thumbnail
        // In production, implement actual thumbnail generation
        await c.env.RECEIPT_BUCKET.put(thumbnailKey, imageBuffer, {
          httpMetadata: {
            contentType: originalObject.httpMetadata?.contentType || 'image/jpeg',
          },
          customMetadata: {
            originalKey: receipt.r2Key,
            thumbnailSize: `${width}x${height}`,
            generatedAt: new Date().toISOString(),
          }
        });

        thumbnailObject = await c.env.RECEIPT_BUCKET.get(thumbnailKey);
      } catch (thumbnailError) {
        console.error('Thumbnail generation error:', thumbnailError);
        
        // Fall back to original image if thumbnail generation fails
        thumbnailObject = originalObject;
      }
    }

    if (!thumbnailObject) {
      return c.json(createErrorResponse(
        'Thumbnail Generation Failed',
        'Could not generate or retrieve thumbnail',
        'THUMBNAIL_GENERATION_FAILED'
      ), 500);
    }

    // Log thumbnail access
    await auditService.logSensitiveOperation('RECEIPT_THUMBNAIL_ACCESSED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt thumbnail accessed: ${receiptId}, size: ${width}x${height}, vendor: ${receipt.vendorName || 'unknown'}`
    });

    // Set appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', thumbnailObject.httpMetadata?.contentType || 'image/jpeg');
    headers.set('Content-Length', thumbnailObject.size.toString());
    headers.set('Cache-Control', 'private, max-age=86400'); // Cache thumbnails for 24 hours
    headers.set('Content-Disposition', `inline; filename="receipt-${receiptId}-thumbnail.jpg"`);

    return new Response(thumbnailObject.body, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Receipt thumbnail access error:', error);

    await auditService.logSensitiveOperation('RECEIPT_THUMBNAIL_ACCESS_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt thumbnail access failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Thumbnail Access Failed',
      'Failed to retrieve receipt thumbnail',
      'THUMBNAIL_ACCESS_ERROR'
    ), 500);
  }
});

/**
 * GET /receipts/:id/image/download - Download receipt image
 * Requirements: 6.4 - Image download capabilities
 */
receipts.get('/:id/image/download', async (c) => {
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

    const db = drizzle(c.env.DB);

    // Get receipt with tenant isolation
    const receiptQuery = await db
      .select({
        id: receiptsTable.id,
        r2Key: receiptsTable.r2Key,
        vendorName: receiptsTable.vendorName,
        transactionDate: receiptsTable.transactionDate,
      })
      .from(receiptsTable)
      .where(and(
        eq(receiptsTable.id, receiptId),
        eq(receiptsTable.tenantId, authContext.tenant_id)
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
        'The specified receipt was not found or access denied',
        'RECEIPT_NOT_FOUND'
      ), 404);
    }

    // Get image from R2
    const r2Object = await c.env.RECEIPT_BUCKET.get(receipt.r2Key);
    
    if (!r2Object) {
      await auditService.logSensitiveOperation('RECEIPT_DOWNLOAD_IMAGE_NOT_FOUND', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Receipt download image not found in R2: ${receiptId}, r2Key: ${receipt.r2Key}`
      });

      return c.json(createErrorResponse(
        'Image Not Found',
        'The receipt image could not be found',
        'IMAGE_NOT_FOUND'
      ), 404);
    }

    // Generate filename with vendor and date info
    const dateStr = receipt.transactionDate 
      ? new Date(receipt.transactionDate).toISOString().split('T')[0] 
      : 'unknown-date';
    const vendorStr = receipt.vendorName 
      ? receipt.vendorName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
      : 'unknown-vendor';
    const filename = `receipt-${vendorStr}-${dateStr}-${receiptId}.jpg`;

    // Log image download
    await auditService.logSensitiveOperation('RECEIPT_IMAGE_DOWNLOADED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt image downloaded: ${receiptId}, vendor: ${receipt.vendorName || 'unknown'}, filename: ${filename}`
    });

    // Set appropriate headers for download
    const headers = new Headers();
    headers.set('Content-Type', r2Object.httpMetadata?.contentType || 'image/jpeg');
    headers.set('Content-Length', r2Object.size.toString());
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    headers.set('Cache-Control', 'private, no-cache'); // Don't cache downloads

    return new Response(r2Object.body, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Receipt image download error:', error);

    await auditService.logSensitiveOperation('RECEIPT_IMAGE_DOWNLOAD_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt image download failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Image Download Failed',
      'Failed to download receipt image',
      'IMAGE_DOWNLOAD_ERROR'
    ), 500);
  }
});

export default receipts;