/**
 * Secure Receipt Access API Routes
 * 
 * Handles authenticated receipt image access, receipt data deletion,
 * and access audit logging with comprehensive security controls.
 * 
 * Requirements: 1.5, 8.4, 8.5
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { 
  createSecureAccessControlService, 
  type ISecureAccessControlService,
  type AccessControlContext,
  type ReceiptAccessRequest,
  type ReceiptDeletionRequest,
  type SecureImageAccessRequest
} from '../services/secure-access-control';
import { createAuditService, type IAuditService, extractAuditContext } from '../services/audit';
import { createErrorResponse } from '../utils';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { receipts } from '../db';

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
  RECEIPT_BUCKET: R2Bucket;
  JWT_SECRET: string;
}

// Extend Hono context with services
type Variables = {
  secureAccessService: ISecureAccessControlService;
  auditService: IAuditService;
  authContext?: {
    user_id: string;
    tenant_id: string;
    role: string;
    location_id?: string;
  };
};

// Validation schemas
const receiptAccessSchema = z.object({
  accessType: z.enum(['READ', 'UPDATE', 'DELETE', 'IMAGE_VIEW', 'IMAGE_DOWNLOAD']),
  purpose: z.string().min(1, 'Access purpose is required').max(200, 'Purpose too long')
});

const imageAccessSchema = z.object({
  accessType: z.enum(['VIEW', 'DOWNLOAD', 'THUMBNAIL']),
  r2Key: z.string().min(1, 'R2 key is required')
});

const receiptDeletionSchema = z.object({
  reason: z.string().min(1, 'Deletion reason is required').max(500, 'Reason too long'),
  confirmDeletion: z.boolean().refine(val => val === true, 'Deletion confirmation required')
});

// Initialize secure receipts router
const secureReceipts = new Hono<{ Bindings: Env; Variables: Variables }>();

// Service initialization middleware
secureReceipts.use('*', async (c, next) => {
  try {
    const db = drizzle(c.env.DB);
    const secureAccessService = createSecureAccessControlService(db, c.env.RECEIPT_BUCKET);
    const auditService = createAuditService(db);
    
    c.set('secureAccessService', secureAccessService);
    c.set('auditService', auditService);
    
    return await next();
  } catch (error) {
    console.error('Service initialization error:', error);
    return c.json(createErrorResponse(
      'Service Error',
      'Failed to initialize secure access services',
      'SERVICE_INIT_ERROR'
    ), 500);
  }
});

// Authentication middleware (placeholder - would use actual auth middleware)
secureReceipts.use('*', async (c, next) => {
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
 * POST /secure-receipts/:receiptId/access - Request access to receipt data
 * Requirements: 1.5, 8.4
 */
secureReceipts.post('/:receiptId/access', async (c) => {
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
    const receiptId = c.req.param('receiptId');
    if (!receiptId) {
      return c.json(createErrorResponse(
        'Invalid Request',
        'Receipt ID is required',
        'MISSING_RECEIPT_ID'
      ), 400);
    }

    // Parse and validate request body
    const body = await c.req.json();
    const validatedData = receiptAccessSchema.parse(body);
    
    const secureAccessService = c.get('secureAccessService');

    // Create access control context
    const accessControlContext: AccessControlContext = {
      userId: authContext.user_id,
      tenantId: authContext.tenant_id,
      role: authContext.role,
      locationId: authContext.location_id,
      ipAddress: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown',
      userAgent: c.req.header('user-agent') || 'unknown'
    };

    // Create access request
    const accessRequest: ReceiptAccessRequest = {
      receiptId,
      accessType: validatedData.accessType,
      purpose: validatedData.purpose,
      context: accessControlContext
    };

    // Validate receipt access
    const accessResult = await secureAccessService.validateReceiptAccess(accessRequest);

    if (!accessResult.granted) {
      return c.json({
        success: false,
        data: {
          receiptId,
          accessType: validatedData.accessType,
          granted: false,
          reason: accessResult.reason
        },
        message: 'Receipt access denied',
        error: accessResult.reason
      }, 403);
    }

    return c.json({
      success: true,
      data: {
        receiptId,
        accessType: validatedData.accessType,
        granted: true,
        reason: accessResult.reason,
        restrictions: accessResult.restrictions,
        auditLogId: accessResult.auditLogId
      },
      message: 'Receipt access granted'
    }, 200);

  } catch (error) {
    console.error('Receipt access validation error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      await auditService.logSensitiveOperation('RECEIPT_ACCESS_VALIDATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Access validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      });
      
      return c.json(createErrorResponse(
        'Validation Error',
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        'VALIDATION_ERROR'
      ), 400);
    }

    // Log generic error
    await auditService.logSensitiveOperation('RECEIPT_ACCESS_VALIDATION_ERROR', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Access validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Access Validation Failed',
      'Failed to validate receipt access',
      'ACCESS_VALIDATION_ERROR'
    ), 500);
  }
});

/**
 * POST /secure-receipts/images/access - Generate secure image access
 * Requirements: 1.5, 8.4
 */
secureReceipts.post('/images/access', async (c) => {
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
    // Parse and validate request body
    const body = await c.req.json();
    const validatedData = imageAccessSchema.parse(body);
    
    const secureAccessService = c.get('secureAccessService');

    // Create access control context
    const accessControlContext: AccessControlContext = {
      userId: authContext.user_id,
      tenantId: authContext.tenant_id,
      role: authContext.role,
      locationId: authContext.location_id,
      ipAddress: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown',
      userAgent: c.req.header('user-agent') || 'unknown'
    };

    // Create image access request
    const imageAccessRequest: SecureImageAccessRequest = {
      r2Key: validatedData.r2Key,
      accessType: validatedData.accessType,
      context: accessControlContext
    };

    // Generate secure image access
    const imageAccessResult = await secureAccessService.generateSecureImageAccess(imageAccessRequest);

    if (!imageAccessResult.granted) {
      return c.json({
        success: false,
        data: {
          r2Key: validatedData.r2Key,
          accessType: validatedData.accessType,
          granted: false,
          auditLogId: imageAccessResult.auditLogId
        },
        message: 'Image access denied'
      }, 403);
    }

    return c.json({
      success: true,
      data: {
        r2Key: validatedData.r2Key,
        accessType: validatedData.accessType,
        granted: true,
        signedUrl: imageAccessResult.signedUrl,
        expiresAt: imageAccessResult.expiresAt?.toISOString(),
        restrictions: imageAccessResult.restrictions,
        auditLogId: imageAccessResult.auditLogId
      },
      message: 'Secure image access granted'
    }, 200);

  } catch (error) {
    console.error('Image access generation error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      await auditService.logSensitiveOperation('IMAGE_ACCESS_VALIDATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Image access validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      });
      
      return c.json(createErrorResponse(
        'Validation Error',
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        'VALIDATION_ERROR'
      ), 400);
    }

    // Log generic error
    await auditService.logSensitiveOperation('IMAGE_ACCESS_GENERATION_ERROR', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Image access generation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Image Access Failed',
      'Failed to generate secure image access',
      'IMAGE_ACCESS_ERROR'
    ), 500);
  }
});

/**
 * DELETE /secure-receipts/:receiptId - Delete receipt data with audit logging
 * Requirements: 8.5
 */
secureReceipts.delete('/:receiptId', async (c) => {
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
    const receiptId = c.req.param('receiptId');
    if (!receiptId) {
      return c.json(createErrorResponse(
        'Invalid Request',
        'Receipt ID is required',
        'MISSING_RECEIPT_ID'
      ), 400);
    }

    // Parse and validate request body
    const body = await c.req.json();
    const validatedData = receiptDeletionSchema.parse(body);
    
    const secureAccessService = c.get('secureAccessService');

    // Create access control context
    const accessControlContext: AccessControlContext = {
      userId: authContext.user_id,
      tenantId: authContext.tenant_id,
      role: authContext.role,
      locationId: authContext.location_id,
      ipAddress: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown',
      userAgent: c.req.header('user-agent') || 'unknown'
    };

    // Create deletion request
    const deletionRequest: ReceiptDeletionRequest = {
      receiptId,
      reason: validatedData.reason,
      context: accessControlContext,
      confirmDeletion: validatedData.confirmDeletion
    };

    // Delete receipt data
    const deletionResult = await secureAccessService.deleteReceiptData(deletionRequest);

    if (!deletionResult.success) {
      return c.json({
        success: false,
        data: {
          receiptId,
          deleted: false,
          errors: deletionResult.errors,
          deletedComponents: deletionResult.deletedComponents,
          auditLogId: deletionResult.auditLogId
        },
        message: 'Receipt deletion failed',
        errors: deletionResult.errors
      }, 422);
    }

    return c.json({
      success: true,
      data: {
        receiptId,
        deleted: true,
        deletedComponents: deletionResult.deletedComponents,
        auditLogId: deletionResult.auditLogId
      },
      message: 'Receipt deleted successfully'
    }, 200);

  } catch (error) {
    console.error('Receipt deletion error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      await auditService.logSensitiveOperation('RECEIPT_DELETION_VALIDATION_FAILED', {
        ...auditContext,
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Deletion validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      });
      
      return c.json(createErrorResponse(
        'Validation Error',
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        'VALIDATION_ERROR'
      ), 400);
    }

    // Log generic error
    await auditService.logSensitiveOperation('RECEIPT_DELETION_ERROR', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Receipt deletion error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Deletion Failed',
      'Failed to delete receipt data',
      'DELETION_ERROR'
    ), 500);
  }
});

/**
 * GET /secure-receipts/audit-log - Get access audit log
 * Requirements: 8.5
 */
secureReceipts.get('/audit-log', async (c) => {
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

  // Only admin roles can access audit logs
  if (!['ADMIN', 'MANAGER'].includes(authContext.role)) {
    return c.json(createErrorResponse(
      'Access Denied',
      'Insufficient permissions to access audit logs',
      'ACCESS_DENIED'
    ), 403);
  }

  try {
    // Parse query parameters
    const userId = c.req.query('userId');
    const resourceType = c.req.query('resourceType');
    const limit = parseInt(c.req.query('limit') || '100', 10);
    
    const secureAccessService = c.get('secureAccessService');

    // Get access audit log
    const auditLogs = await secureAccessService.getAccessAuditLog(authContext.tenant_id, {
      userId,
      resourceType,
      limit: Math.min(limit, 500) // Cap at 500 records
    });

    // Log audit log access
    await auditService.logSensitiveOperation('AUDIT_LOG_ACCESSED', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Audit log accessed: ${auditLogs.length} records, filters: userId=${userId || 'all'}, resourceType=${resourceType || 'all'}`
    });

    return c.json({
      success: true,
      data: {
        auditLogs,
        metadata: {
          count: auditLogs.length,
          filters: {
            userId: userId || null,
            resourceType: resourceType || null
          },
          requestedLimit: limit
        }
      },
      message: 'Audit log retrieved successfully'
    }, 200);

  } catch (error) {
    console.error('Audit log retrieval error:', error);

    await auditService.logSensitiveOperation('AUDIT_LOG_ACCESS_ERROR', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Audit log access error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Audit Log Failed',
      'Failed to retrieve audit log',
      'AUDIT_LOG_ERROR'
    ), 500);
  }
});

/**
 * POST /secure-receipts/images/:r2Key/revoke - Revoke image access
 * Requirements: 8.4
 */
secureReceipts.post('/images/:r2Key/revoke', async (c) => {
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

  // Only admin roles can revoke image access
  if (!['ADMIN'].includes(authContext.role)) {
    return c.json(createErrorResponse(
      'Access Denied',
      'Insufficient permissions to revoke image access',
      'ACCESS_DENIED'
    ), 403);
  }

  try {
    const r2Key = decodeURIComponent(c.req.param('r2Key') || '');
    if (!r2Key) {
      return c.json(createErrorResponse(
        'Invalid Request',
        'R2 key is required',
        'MISSING_R2_KEY'
      ), 400);
    }

    const secureAccessService = c.get('secureAccessService');

    // Create access control context
    const accessControlContext: AccessControlContext = {
      userId: authContext.user_id,
      tenantId: authContext.tenant_id,
      role: authContext.role,
      locationId: authContext.location_id,
      ipAddress: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown',
      userAgent: c.req.header('user-agent') || 'unknown'
    };

    // Revoke image access
    const revoked = await secureAccessService.revokeImageAccess(r2Key, accessControlContext);

    if (!revoked) {
      return c.json({
        success: false,
        data: {
          r2Key,
          revoked: false
        },
        message: 'Failed to revoke image access'
      }, 422);
    }

    return c.json({
      success: true,
      data: {
        r2Key,
        revoked: true,
        revokedAt: new Date().toISOString(),
        revokedBy: authContext.user_id
      },
      message: 'Image access revoked successfully'
    }, 200);

  } catch (error) {
    console.error('Image access revocation error:', error);

    await auditService.logSensitiveOperation('IMAGE_ACCESS_REVOCATION_ERROR', {
      ...auditContext,
      tenantId: authContext.tenant_id,
      userId: authContext.user_id,
      resource: `Image access revocation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Revocation Failed',
      'Failed to revoke image access',
      'REVOCATION_ERROR'
    ), 500);
  }
});

export default secureReceipts;