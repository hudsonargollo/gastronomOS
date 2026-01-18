/**
 * Purchase Order Integration API Routes
 * 
 * Handles receipt-to-PO matching, linking, and variance reporting.
 * Implements requirements 9.3, 9.4, 9.5 for the receipt scanning system.
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { createPOMatcherService, IPOMatcherService, POMatchingOptions } from '../services/po-matcher';
import { createAuditService, IAuditService, extractAuditContext } from '../services/audit';
import { receipts } from '../db/schema';
import { createErrorResponse } from '../utils';

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
  JWT_SECRET: string;
}

// Extend Hono context with services
type Variables = {
  poMatcherService: IPOMatcherService;
  auditService: IAuditService;
  authContext?: {
    user_id: string;
    tenant_id: string;
    role: string;
    location_id?: string;
  };
};

// Validation schemas
const linkPOSchema = z.object({
  poId: z.string().min(1, 'Purchase order ID is required'),
  notes: z.string().optional()
});

const matchingOptionsSchema = z.object({
  vendorNameThreshold: z.number().min(0).max(1).optional(),
  amountTolerancePercentage: z.number().min(0).max(100).optional(),
  dateRangedays: z.number().int().min(1).max(365).optional(),
  requireExactSupplier: z.boolean().optional(),
  autoLinkThreshold: z.number().min(0).max(1).optional(),
  maxCandidates: z.number().int().min(1).max(50).optional()
});

const varianceQuerySchema = z.object({
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0)
});

// Initialize PO integration router
const poIntegration = new Hono<{ Bindings: Env; Variables: Variables }>();

// Service initialization middleware
poIntegration.use('*', async (c, next) => {
  try {
    const db = drizzle(c.env.DB);
    const poMatcherService = createPOMatcherService(db);
    const auditService = createAuditService(db);
    
    c.set('poMatcherService', poMatcherService);
    c.set('auditService', auditService);
    
    return await next();
  } catch (error) {
    console.error('Service initialization error:', error);
    return c.json(createErrorResponse(
      'Service Error',
      'Failed to initialize PO integration services',
      'SERVICE_INIT_ERROR'
    ), 500);
  }
});

// Authentication middleware (placeholder - would use actual auth middleware)
poIntegration.use('*', async (c, next) => {
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
 * GET /receipts/:id/po-matches - Get PO match suggestions for a receipt
 * Requirements: 9.1, 9.2
 */
poIntegration.get('/receipts/:id/po-matches', async (c) => {
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

    // Verify receipt belongs to user's tenant
    const db = drizzle(c.env.DB);
    const [receipt] = await db
      .select()
      .from(receipts)
      .where(and(
        eq(receipts.id, receiptId),
        eq(receipts.tenantId, authContext.tenant_id)
      ))
      .limit(1);

    if (!receipt) {
      return c.json(createErrorResponse(
        'Receipt Not Found',
        'The specified receipt was not found or access denied',
        'RECEIPT_NOT_FOUND'
      ), 404);
    }

    // Parse matching options from query parameters
    const queryParams = c.req.query();
    let matchingOptions: Partial<POMatchingOptions> = {};
    
    try {
      if (Object.keys(queryParams).length > 0) {
        matchingOptions = matchingOptionsSchema.parse(queryParams);
      }
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return c.json(createErrorResponse(
          'Invalid Query Parameters',
          validationError.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
          'VALIDATION_ERROR'
        ), 400);
      }
    }

    const poMatcherService = c.get('poMatcherService');
    const matches = await poMatcherService.findPOMatches(receiptId, matchingOptions);

    // Log PO match search
    await auditService.logSensitiveOperation('RECEIPT_PO_MATCHES_SEARCHED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `PO matches searched for receipt: ${receiptId}, found ${matches.length} candidates`
    });

    return c.json({
      success: true,
      data: {
        receiptId,
        matches: matches.map(match => ({
          poId: match.poId,
          poNumber: match.poNumber,
          supplierName: match.supplierName,
          totalCostCents: match.totalCostCents,
          status: match.status,
          matchScore: Math.round(match.matchScore * 100) / 100, // Round to 2 decimal places
          matchReasons: match.matchReasons,
          lineItemMatches: match.lineItemMatches.length,
          variances: match.variances.length,
          createdAt: new Date(match.createdAt).toISOString()
        })),
        metadata: {
          matchCount: matches.length,
          searchOptions: matchingOptions
        }
      },
      message: 'PO matches retrieved successfully'
    }, 200);

  } catch (error) {
    console.error('PO match search error:', error);

    await auditService.logSensitiveOperation('RECEIPT_PO_MATCHES_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `PO match search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'PO Match Search Failed',
      'Failed to find purchase order matches',
      'PO_MATCH_ERROR'
    ), 500);
  }
});

/**
 * POST /receipts/:id/link-po - Manually link receipt to purchase order
 * Requirements: 9.3, 9.5
 */
poIntegration.post('/receipts/:id/link-po', async (c) => {
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
    const validatedData = linkPOSchema.parse(body);

    // Verify receipt belongs to user's tenant
    const db = drizzle(c.env.DB);
    const [receipt] = await db
      .select()
      .from(receipts)
      .where(and(
        eq(receipts.id, receiptId),
        eq(receipts.tenantId, authContext.tenant_id)
      ))
      .limit(1);

    if (!receipt) {
      return c.json(createErrorResponse(
        'Receipt Not Found',
        'The specified receipt was not found or access denied',
        'RECEIPT_NOT_FOUND'
      ), 404);
    }

    const poMatcherService = c.get('poMatcherService');
    const linkingResult = await poMatcherService.linkReceiptToPO(
      receiptId, 
      validatedData.poId, 
      authContext.user_id,
      true // Manual linking
    );

    // Log successful linking
    await auditService.logSensitiveOperation('RECEIPT_PO_LINKED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt linked to PO: ${receiptId} -> ${validatedData.poId}, confidence: ${linkingResult.linkingConfidence.toFixed(2)}`
    });

    return c.json({
      success: true,
      data: {
        receiptId: linkingResult.receiptId,
        linkedPoId: linkingResult.linkedPoId,
        linkingConfidence: Math.round(linkingResult.linkingConfidence * 100) / 100,
        automaticLinking: linkingResult.automaticLinking,
        variances: linkingResult.variances,
        matchedLineItems: linkingResult.matchedLineItems,
        totalLineItems: linkingResult.totalLineItems,
        linkedAt: linkingResult.linkedAt.toISOString(),
        linkedBy: linkingResult.linkedBy,
        notes: validatedData.notes
      },
      message: 'Receipt successfully linked to purchase order'
    }, 200);

  } catch (error) {
    console.error('PO linking error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      await auditService.logSensitiveOperation('RECEIPT_PO_LINK_VALIDATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `PO linking validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      });
      
      return c.json(createErrorResponse(
        'Validation Error',
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        'VALIDATION_ERROR'
      ), 400);
    }

    await auditService.logSensitiveOperation('RECEIPT_PO_LINK_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `PO linking failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'PO Linking Failed',
      error instanceof Error ? error.message : 'Failed to link receipt to purchase order',
      'PO_LINK_ERROR'
    ), 500);
  }
});

/**
 * DELETE /receipts/:id/link-po - Unlink receipt from purchase order
 * Requirements: 9.3
 */
poIntegration.delete('/receipts/:id/link-po', async (c) => {
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

    // Verify receipt belongs to user's tenant and is linked
    const db = drizzle(c.env.DB);
    const [receipt] = await db
      .select()
      .from(receipts)
      .where(and(
        eq(receipts.id, receiptId),
        eq(receipts.tenantId, authContext.tenant_id)
      ))
      .limit(1);

    if (!receipt) {
      return c.json(createErrorResponse(
        'Receipt Not Found',
        'The specified receipt was not found or access denied',
        'RECEIPT_NOT_FOUND'
      ), 404);
    }

    if (!receipt.linkedPoId) {
      return c.json(createErrorResponse(
        'Receipt Not Linked',
        'The receipt is not currently linked to any purchase order',
        'RECEIPT_NOT_LINKED'
      ), 400);
    }

    const poMatcherService = c.get('poMatcherService');
    await poMatcherService.unlinkReceiptFromPO(receiptId, authContext.user_id);

    // Log successful unlinking
    await auditService.logSensitiveOperation('RECEIPT_PO_UNLINKED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt unlinked from PO: ${receiptId} -> ${receipt.linkedPoId}`
    });

    return c.json({
      success: true,
      data: {
        receiptId,
        previouslyLinkedPoId: receipt.linkedPoId,
        unlinkedAt: new Date().toISOString(),
        unlinkedBy: authContext.user_id
      },
      message: 'Receipt successfully unlinked from purchase order'
    }, 200);

  } catch (error) {
    console.error('PO unlinking error:', error);

    await auditService.logSensitiveOperation('RECEIPT_PO_UNLINK_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `PO unlinking failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'PO Unlinking Failed',
      error instanceof Error ? error.message : 'Failed to unlink receipt from purchase order',
      'PO_UNLINK_ERROR'
    ), 500);
  }
});

/**
 * GET /receipts/:id/po-variances - Get variances between receipt and linked PO
 * Requirements: 9.2, 9.4
 */
poIntegration.get('/receipts/:id/po-variances', async (c) => {
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

    // Verify receipt belongs to user's tenant and is linked
    const db = drizzle(c.env.DB);
    const [receipt] = await db
      .select()
      .from(receipts)
      .where(and(
        eq(receipts.id, receiptId),
        eq(receipts.tenantId, authContext.tenant_id)
      ))
      .limit(1);

    if (!receipt) {
      return c.json(createErrorResponse(
        'Receipt Not Found',
        'The specified receipt was not found or access denied',
        'RECEIPT_NOT_FOUND'
      ), 404);
    }

    if (!receipt.linkedPoId) {
      return c.json(createErrorResponse(
        'Receipt Not Linked',
        'The receipt is not linked to any purchase order',
        'RECEIPT_NOT_LINKED'
      ), 400);
    }

    const poMatcherService = c.get('poMatcherService');
    const variances = await poMatcherService.detectVariances(receiptId, receipt.linkedPoId);

    // Log variance detection
    await auditService.logSensitiveOperation('RECEIPT_PO_VARIANCES_DETECTED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Variances detected for receipt-PO pair: ${receiptId} -> ${receipt.linkedPoId}, found ${variances.length} variances`
    });

    // Group variances by severity for summary
    const varianceSummary = variances.reduce((acc, variance) => {
      acc[variance.severity] = (acc[variance.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return c.json({
      success: true,
      data: {
        receiptId,
        linkedPoId: receipt.linkedPoId,
        variances: variances.map(variance => ({
          type: variance.type,
          severity: variance.severity,
          description: variance.description,
          receiptValue: variance.receiptValue,
          poValue: variance.poValue,
          varianceAmount: variance.varianceAmount,
          variancePercentage: variance.variancePercentage
        })),
        summary: {
          totalVariances: variances.length,
          high: varianceSummary['HIGH'] || 0,
          medium: varianceSummary['MEDIUM'] || 0,
          low: varianceSummary['LOW'] || 0
        }
      },
      message: 'Receipt-PO variances retrieved successfully'
    }, 200);

  } catch (error) {
    console.error('Variance detection error:', error);

    await auditService.logSensitiveOperation('RECEIPT_PO_VARIANCES_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Variance detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Variance Detection Failed',
      'Failed to detect receipt-PO variances',
      'VARIANCE_DETECTION_ERROR'
    ), 500);
  }
});

/**
 * GET /receipts/variances - Get all receipt-PO variances for reporting
 * Requirements: 9.4, 9.5
 */
poIntegration.get('/receipts/variances', async (c) => {
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
    const queryParams = c.req.query();
    const validatedQuery = varianceQuerySchema.parse(queryParams);

    const poMatcherService = c.get('poMatcherService');
    const result = await poMatcherService.getReceiptPOVariances(
      authContext.tenant_id,
      {
        severityFilter: validatedQuery.severity,
        limit: validatedQuery.limit,
        offset: validatedQuery.offset
      }
    );

    // Log variance report access
    await auditService.logSensitiveOperation('RECEIPT_PO_VARIANCE_REPORT_ACCESSED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Variance report accessed: ${result.variances.length} records, severity filter: ${validatedQuery.severity || 'all'}`
    });

    // Calculate summary statistics
    const allVariances = result.variances.flatMap(item => item.variances);
    const varianceSummary = allVariances.reduce((acc, variance) => {
      acc[variance.severity] = (acc[variance.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return c.json({
      success: true,
      data: {
        variances: result.variances.map(item => ({
          receiptId: item.receiptId,
          poId: item.poId,
          receiptVendor: item.receiptVendor,
          receiptTotal: item.receiptTotal ? item.receiptTotal / 100 : null, // Convert to dollars
          receiptDate: item.receiptDate?.toISOString() || null,
          poNumber: item.poNumber,
          poTotal: item.poTotal ? item.poTotal / 100 : null, // Convert to dollars
          variances: item.variances,
          varianceCount: item.variances.length
        })),
        summary: {
          totalRecords: result.total,
          returnedRecords: result.variances.length,
          totalVariances: allVariances.length,
          high: varianceSummary['HIGH'] || 0,
          medium: varianceSummary['MEDIUM'] || 0,
          low: varianceSummary['LOW'] || 0
        },
        pagination: {
          limit: validatedQuery.limit,
          offset: validatedQuery.offset,
          hasMore: validatedQuery.offset + result.variances.length < result.total
        }
      },
      message: 'Receipt-PO variance report retrieved successfully'
    }, 200);

  } catch (error) {
    console.error('Variance report error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      await auditService.logSensitiveOperation('RECEIPT_PO_VARIANCE_REPORT_VALIDATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Variance report validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      });
      
      return c.json(createErrorResponse(
        'Validation Error',
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        'VALIDATION_ERROR'
      ), 400);
    }

    await auditService.logSensitiveOperation('RECEIPT_PO_VARIANCE_REPORT_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Variance report failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Variance Report Failed',
      'Failed to retrieve receipt-PO variance report',
      'VARIANCE_REPORT_ERROR'
    ), 500);
  }
});

/**
 * POST /receipts/:id/auto-link-po - Attempt automatic PO linking
 * Requirements: 9.1, 9.3
 */
poIntegration.post('/receipts/:id/auto-link-po', async (c) => {
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

    // Verify receipt belongs to user's tenant
    const db = drizzle(c.env.DB);
    const [receipt] = await db
      .select()
      .from(receipts)
      .where(and(
        eq(receipts.id, receiptId),
        eq(receipts.tenantId, authContext.tenant_id)
      ))
      .limit(1);

    if (!receipt) {
      return c.json(createErrorResponse(
        'Receipt Not Found',
        'The specified receipt was not found or access denied',
        'RECEIPT_NOT_FOUND'
      ), 404);
    }

    if (receipt.linkedPoId) {
      return c.json(createErrorResponse(
        'Receipt Already Linked',
        'The receipt is already linked to a purchase order',
        'RECEIPT_ALREADY_LINKED'
      ), 400);
    }

    const poMatcherService = c.get('poMatcherService');
    const linkingResult = await poMatcherService.attemptAutomaticLinking(receiptId);

    if (!linkingResult) {
      // Log failed automatic linking attempt
      await auditService.logSensitiveOperation('RECEIPT_AUTO_LINK_NO_MATCH', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Automatic PO linking failed - no high-confidence match found for receipt: ${receiptId}`
      });

      return c.json({
        success: false,
        data: {
          receiptId,
          automaticLinkingAttempted: true,
          linkingSuccessful: false,
          reason: 'No high-confidence purchase order match found'
        },
        message: 'Automatic PO linking was not possible'
      }, 200);
    }

    // Log successful automatic linking
    await auditService.logSensitiveOperation('RECEIPT_AUTO_LINKED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt automatically linked to PO: ${receiptId} -> ${linkingResult.linkedPoId}, confidence: ${linkingResult.linkingConfidence.toFixed(2)}`
    });

    return c.json({
      success: true,
      data: {
        receiptId: linkingResult.receiptId,
        linkedPoId: linkingResult.linkedPoId,
        linkingConfidence: Math.round(linkingResult.linkingConfidence * 100) / 100,
        automaticLinking: linkingResult.automaticLinking,
        variances: linkingResult.variances,
        matchedLineItems: linkingResult.matchedLineItems,
        totalLineItems: linkingResult.totalLineItems,
        linkedAt: linkingResult.linkedAt.toISOString(),
        linkedBy: linkingResult.linkedBy
      },
      message: 'Receipt automatically linked to purchase order'
    }, 200);

  } catch (error) {
    console.error('Automatic PO linking error:', error);

    await auditService.logSensitiveOperation('RECEIPT_AUTO_LINK_FAILED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Automatic PO linking failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Automatic PO Linking Failed',
      error instanceof Error ? error.message : 'Failed to automatically link receipt to purchase order',
      'AUTO_LINK_ERROR'
    ), 500);
  }
});

export default poIntegration;