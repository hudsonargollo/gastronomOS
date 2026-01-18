/**
 * Secure Access Control Service for Receipt Scanning System
 * 
 * Implements authenticated receipt image access, receipt data deletion capabilities,
 * and access audit logging for compliance and security.
 * 
 * Requirements: 1.5, 8.4, 8.5
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { 
  receipts, 
  receiptProcessingJobs, 
  receiptLineItems,
  productMatchCandidates,
  users
} from '../db';
import { createAuditService, type IAuditService, type AuditContext } from './audit';
import { createPrivacyProtectionService, type IPrivacyProtectionService } from './privacy-protection';

// Access control interfaces
export interface AccessControlContext {
  userId: string;
  tenantId: string;
  role: string;
  locationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ReceiptAccessRequest {
  receiptId: string;
  accessType: 'READ' | 'UPDATE' | 'DELETE' | 'IMAGE_VIEW' | 'IMAGE_DOWNLOAD';
  purpose: string;
  context: AccessControlContext;
}

export interface ReceiptAccessResult {
  granted: boolean;
  receiptId: string;
  accessType: string;
  reason: string;
  restrictions?: {
    imageAccess: boolean;
    dataAccess: boolean;
    modificationAllowed: boolean;
  };
  auditLogId?: string;
}

export interface ReceiptDeletionRequest {
  receiptId: string;
  reason: string;
  context: AccessControlContext;
  confirmDeletion: boolean;
}

export interface ReceiptDeletionResult {
  success: boolean;
  receiptId: string;
  deletedComponents: {
    receiptRecord: boolean;
    lineItems: boolean;
    matchCandidates: boolean;
    r2Object: boolean;
    processingJob: boolean;
  };
  errors: string[];
  auditLogId: string;
}

export interface SecureImageAccessRequest {
  r2Key: string;
  accessType: 'VIEW' | 'DOWNLOAD' | 'THUMBNAIL';
  context: AccessControlContext;
}

export interface SecureImageAccessResult {
  granted: boolean;
  signedUrl?: string;
  expiresAt?: Date;
  restrictions?: {
    maxDownloads: number;
    allowedOperations: string[];
  };
  auditLogId: string;
}

// Secure access control service implementation
export interface ISecureAccessControlService {
  validateReceiptAccess(request: ReceiptAccessRequest): Promise<ReceiptAccessResult>;
  generateSecureImageAccess(request: SecureImageAccessRequest): Promise<SecureImageAccessResult>;
  deleteReceiptData(request: ReceiptDeletionRequest): Promise<ReceiptDeletionResult>;
  getAccessAuditLog(tenantId: string, options?: {
    userId?: string;
    resourceType?: string;
    limit?: number;
  }): Promise<any[]>;
  revokeImageAccess(r2Key: string, context: AccessControlContext): Promise<boolean>;
}

export class SecureAccessControlService implements ISecureAccessControlService {
  private db: ReturnType<typeof drizzle>;
  private r2Bucket: R2Bucket;
  private auditService: IAuditService;
  private privacyProtectionService: IPrivacyProtectionService;

  // Access control configuration
  private static readonly IMAGE_ACCESS_EXPIRY_MINUTES = 30;
  private static readonly ADMIN_ROLES = ['ADMIN', 'MANAGER'];
  private static readonly DELETION_ROLES = ['ADMIN'];

  constructor(
    db: ReturnType<typeof drizzle>, 
    r2Bucket: R2Bucket
  ) {
    this.db = db;
    this.r2Bucket = r2Bucket;
    this.auditService = createAuditService(db);
    this.privacyProtectionService = createPrivacyProtectionService(db, r2Bucket);
  }

  /**
   * Validate receipt access with comprehensive authorization checks
   * Requirements: 1.5, 8.4
   */
  async validateReceiptAccess(request: ReceiptAccessRequest): Promise<ReceiptAccessResult> {
    const result: ReceiptAccessResult = {
      granted: false,
      receiptId: request.receiptId,
      accessType: request.accessType,
      reason: '',
      restrictions: {
        imageAccess: false,
        dataAccess: false,
        modificationAllowed: false
      }
    };

    try {
      // Step 1: Validate tenant isolation
      const tenantCheck = await this.privacyProtectionService.validateTenantIsolation(
        request.context.tenantId,
        'receipt',
        request.receiptId
      );

      if (!tenantCheck.isValid) {
        result.reason = `Tenant isolation violation: ${tenantCheck.violations.join(', ')}`;
        await this.logAccessAttempt(request, result);
        return result;
      }

      // Step 2: Get receipt details
      const receiptQuery = await this.db
        .select()
        .from(receipts)
        .where(and(
          eq(receipts.id, request.receiptId),
          eq(receipts.tenantId, request.context.tenantId)
        ))
        .limit(1);

      if (receiptQuery.length === 0) {
        result.reason = 'Receipt not found or access denied';
        await this.logAccessAttempt(request, result);
        return result;
      }

      const receipt = receiptQuery[0];
      if (!receipt) {
        result.reason = 'Receipt data is invalid';
        await this.logAccessAttempt(request, result);
        return result;
      }

      // Step 3: Validate user permissions
      const userPermissions = await this.validateUserPermissions(
        request.context.userId,
        request.context.tenantId,
        request.accessType
      );

      if (!userPermissions.hasAccess) {
        result.reason = `Insufficient permissions: ${userPermissions.reason}`;
        await this.logAccessAttempt(request, result);
        return result;
      }

      // Step 4: Apply access restrictions based on role and access type
      result.restrictions = this.determineAccessRestrictions(
        request.context.role,
        request.accessType
      ) || {
        imageAccess: false,
        dataAccess: false,
        modificationAllowed: false
      };

      // Step 5: Grant access with appropriate restrictions
      result.granted = true;
      result.reason = 'Access granted with restrictions';

      // Log successful access
      const auditLogId = await this.logAccessAttempt(request, result);
      result.auditLogId = auditLogId;

      return result;

    } catch (error) {
      result.reason = `Access validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await this.logAccessAttempt(request, result);
      return result;
    }
  }

  /**
   * Generate secure image access with time-limited signed URLs
   * Requirements: 1.5, 8.4
   */
  async generateSecureImageAccess(request: SecureImageAccessRequest): Promise<SecureImageAccessResult> {
    const result: SecureImageAccessResult = {
      granted: false,
      auditLogId: ''
    };

    try {
      // Step 1: Validate tenant isolation for R2 object
      const tenantCheck = await this.privacyProtectionService.validateTenantIsolation(
        request.context.tenantId,
        'r2_object',
        request.r2Key
      );

      if (!tenantCheck.isValid) {
        const auditContext: AuditContext = {
          tenantId: request.context.tenantId,
          userId: request.context.userId,
          resource: `Image access denied - tenant isolation violation: ${request.r2Key}`
        };
        
        if (request.context.ipAddress) auditContext.ipAddress = request.context.ipAddress;
        if (request.context.userAgent) auditContext.userAgent = request.context.userAgent;

        await this.auditService.logSensitiveOperation('RECEIPT_IMAGE_ACCESS_DENIED', auditContext);
        result.auditLogId = 'logged';
        return result;
      }

      // Step 2: Verify image exists in R2
      const imageExists = await this.r2Bucket.head(request.r2Key);
      if (!imageExists) {
        const auditContext: AuditContext = {
          tenantId: request.context.tenantId,
          userId: request.context.userId,
          resource: `Image access denied - image not found: ${request.r2Key}`
        };
        
        if (request.context.ipAddress) auditContext.ipAddress = request.context.ipAddress;
        if (request.context.userAgent) auditContext.userAgent = request.context.userAgent;

        await this.auditService.logSensitiveOperation('RECEIPT_IMAGE_NOT_FOUND', auditContext);
        result.auditLogId = 'logged';
        return result;
      }

      // Step 3: Validate user permissions for image access
      const userPermissions = await this.validateUserPermissions(
        request.context.userId,
        request.context.tenantId,
        'IMAGE_VIEW'
      );

      if (!userPermissions.hasAccess) {
        const auditContext: AuditContext = {
          tenantId: request.context.tenantId,
          userId: request.context.userId,
          resource: `Image access denied - insufficient permissions: ${request.r2Key}`
        };
        
        if (request.context.ipAddress) auditContext.ipAddress = request.context.ipAddress;
        if (request.context.userAgent) auditContext.userAgent = request.context.userAgent;

        await this.auditService.logSensitiveOperation('RECEIPT_IMAGE_ACCESS_DENIED', auditContext);
        result.auditLogId = 'logged';
        return result;
      }

      // Step 4: Generate time-limited signed URL
      // Note: This is a placeholder for R2 signed URL generation
      // In production, you would use the R2 API to generate actual signed URLs
      const expiresAt = new Date(Date.now() + (SecureAccessControlService.IMAGE_ACCESS_EXPIRY_MINUTES * 60 * 1000));
      const signedUrl = `https://secure-receipts.example.com/api/receipts/images/${encodeURIComponent(request.r2Key)}?expires=${expiresAt.getTime()}&signature=placeholder`;

      // Step 5: Set access restrictions
      result.granted = true;
      result.signedUrl = signedUrl;
      result.expiresAt = expiresAt;
      result.restrictions = {
        maxDownloads: request.accessType === 'DOWNLOAD' ? 1 : 0,
        allowedOperations: [request.accessType]
      };

      // Log successful image access
      const auditContext: AuditContext = {
        tenantId: request.context.tenantId,
        userId: request.context.userId,
        resource: `Secure image access granted: ${request.r2Key}, type: ${request.accessType}, expires: ${expiresAt.toISOString()}`
      };
      
      if (request.context.ipAddress) auditContext.ipAddress = request.context.ipAddress;
      if (request.context.userAgent) auditContext.userAgent = request.context.userAgent;

      await this.auditService.logSensitiveOperation('RECEIPT_IMAGE_ACCESS_GRANTED', auditContext);
      result.auditLogId = 'logged';

      return result;

    } catch (error) {
      const auditContext: AuditContext = {
        tenantId: request.context.tenantId,
        userId: request.context.userId,
        resource: `Image access failed: ${request.r2Key}, error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      
      if (request.context.ipAddress) auditContext.ipAddress = request.context.ipAddress;
      if (request.context.userAgent) auditContext.userAgent = request.context.userAgent;

      await this.auditService.logSensitiveOperation('RECEIPT_IMAGE_ACCESS_FAILED', auditContext);
      result.auditLogId = 'logged';
      return result;
    }
  }

  /**
   * Delete receipt data with comprehensive audit logging
   * Requirements: 8.5
   */
  async deleteReceiptData(request: ReceiptDeletionRequest): Promise<ReceiptDeletionResult> {
    const result: ReceiptDeletionResult = {
      success: false,
      receiptId: request.receiptId,
      deletedComponents: {
        receiptRecord: false,
        lineItems: false,
        matchCandidates: false,
        r2Object: false,
        processingJob: false
      },
      errors: [],
      auditLogId: ''
    };

    try {
      // Step 1: Validate deletion permissions (admin only)
      if (!SecureAccessControlService.DELETION_ROLES.includes(request.context.role)) {
        result.errors.push('Insufficient permissions for receipt deletion');
        const auditLogId = await this.logDeletionAttempt(request, result);
        result.auditLogId = auditLogId;
        return result;
      }

      // Step 2: Validate confirmation flag
      if (!request.confirmDeletion) {
        result.errors.push('Deletion confirmation required');
        const auditLogId = await this.logDeletionAttempt(request, result);
        result.auditLogId = auditLogId;
        return result;
      }

      // Step 3: Validate tenant isolation
      const tenantCheck = await this.privacyProtectionService.validateTenantIsolation(
        request.context.tenantId,
        'receipt',
        request.receiptId
      );

      if (!tenantCheck.isValid) {
        result.errors.push(`Tenant isolation violation: ${tenantCheck.violations.join(', ')}`);
        const auditLogId = await this.logDeletionAttempt(request, result);
        result.auditLogId = auditLogId;
        return result;
      }

      // Step 4: Get receipt details for deletion
      const receiptQuery = await this.db
        .select()
        .from(receipts)
        .where(and(
          eq(receipts.id, request.receiptId),
          eq(receipts.tenantId, request.context.tenantId)
        ))
        .limit(1);

      if (receiptQuery.length === 0) {
        result.errors.push('Receipt not found or access denied');
        const auditLogId = await this.logDeletionAttempt(request, result);
        result.auditLogId = auditLogId;
        return result;
      }

      const receipt = receiptQuery[0];
      if (!receipt) {
        result.errors.push('Receipt data is invalid');
        const auditLogId = await this.logDeletionAttempt(request, result);
        result.auditLogId = auditLogId;
        return result;
      }

      // Step 5: Delete components in reverse dependency order
      
      // Delete product match candidates first
      try {
        const lineItemIds = await this.db
          .select({ id: receiptLineItems.id })
          .from(receiptLineItems)
          .where(eq(receiptLineItems.receiptId, request.receiptId));

        for (const lineItem of lineItemIds) {
          await this.db
            .delete(productMatchCandidates)
            .where(eq(productMatchCandidates.receiptLineItemId, lineItem.id));
        }
        result.deletedComponents.matchCandidates = true;
      } catch (error) {
        result.errors.push(`Failed to delete match candidates: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Delete receipt line items
      try {
        await this.db
          .delete(receiptLineItems)
          .where(eq(receiptLineItems.receiptId, request.receiptId));
        result.deletedComponents.lineItems = true;
      } catch (error) {
        result.errors.push(`Failed to delete line items: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Delete R2 object
      try {
        await this.r2Bucket.delete(receipt.r2Key);
        result.deletedComponents.r2Object = true;
      } catch (error) {
        result.errors.push(`Failed to delete R2 object: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Delete processing job
      try {
        await this.db
          .delete(receiptProcessingJobs)
          .where(eq(receiptProcessingJobs.id, receipt.processingJobId));
        result.deletedComponents.processingJob = true;
      } catch (error) {
        result.errors.push(`Failed to delete processing job: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Delete receipt record last
      try {
        await this.db
          .delete(receipts)
          .where(eq(receipts.id, request.receiptId));
        result.deletedComponents.receiptRecord = true;
      } catch (error) {
        result.errors.push(`Failed to delete receipt record: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Step 6: Determine overall success
      result.success = result.deletedComponents.receiptRecord && result.errors.length === 0;

      // Log deletion attempt
      const auditLogId = await this.logDeletionAttempt(request, result);
      result.auditLogId = auditLogId;

      return result;

    } catch (error) {
      result.errors.push(`Receipt deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      const auditLogId = await this.logDeletionAttempt(request, result);
      result.auditLogId = auditLogId;
      return result;
    }
  }

  /**
   * Get access audit log for compliance and monitoring
   * Requirements: 8.5
   */
  async getAccessAuditLog(
    tenantId: string, 
    options: {
      userId?: string;
      resourceType?: string;
      limit?: number;
    } = {}
  ): Promise<any[]> {
    try {
      const { userId, resourceType, limit = 100 } = options;

      // Get audit logs with tenant isolation
      const auditLogs = await this.auditService.getAuditLogs(tenantId, {
        userId: userId || undefined,
        eventType: resourceType || undefined,
        limit: Math.min(limit, 500), // Cap at 500 records
        offset: 0
      });

      // Filter for receipt-related events
      const receiptAuditLogs = auditLogs.filter(log => 
        log.eventType.includes('RECEIPT') || 
        log.resource?.includes('receipt') ||
        log.resource?.includes('image')
      );

      return receiptAuditLogs.map(log => ({
        id: log.id,
        eventType: log.eventType,
        resource: log.resource,
        userId: log.userId,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: new Date(log.createdAt).toISOString()
      }));

    } catch (error) {
      console.error('Failed to get access audit log:', error);
      throw new Error(`Access audit log retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Revoke image access (invalidate signed URLs)
   * Requirements: 8.4
   */
  async revokeImageAccess(r2Key: string, context: AccessControlContext): Promise<boolean> {
    try {
      // Validate admin permissions for revocation
      if (!SecureAccessControlService.ADMIN_ROLES.includes(context.role)) {
        return false;
      }

      // Log revocation attempt
      const auditContext: AuditContext = {
        tenantId: context.tenantId,
        userId: context.userId,
        ipAddress: context.ipAddress || undefined,
        userAgent: context.userAgent || undefined,
        resource: `Image access revoked: ${r2Key}`
      };

      await this.auditService.logSensitiveOperation('RECEIPT_IMAGE_ACCESS_REVOKED', auditContext);

      // In a production system, this would invalidate signed URLs
      // For now, we just log the revocation
      return true;

    } catch (error) {
      console.error('Failed to revoke image access:', error);
      return false;
    }
  }

  /**
   * Validate user permissions for specific access types
   */
  private async validateUserPermissions(
    userId: string, 
    tenantId: string, 
    accessType: string
  ): Promise<{ hasAccess: boolean; reason: string }> {
    try {
      // Get user details
      const userQuery = await this.db
        .select()
        .from(users)
        .where(and(
          eq(users.id, userId),
          eq(users.tenantId, tenantId)
        ))
        .limit(1);

      if (userQuery.length === 0) {
        return { hasAccess: false, reason: 'User not found or access denied' };
      }

      const user = userQuery[0];
      if (!user) {
        return { hasAccess: false, reason: 'User data is invalid' };
      }

      // Check role-based permissions
      switch (accessType) {
        case 'DELETE':
          if (!SecureAccessControlService.DELETION_ROLES.includes(user.role)) {
            return { hasAccess: false, reason: 'Deletion requires admin role' };
          }
          break;
        case 'UPDATE':
          if (!SecureAccessControlService.ADMIN_ROLES.includes(user.role)) {
            return { hasAccess: false, reason: 'Updates require admin or manager role' };
          }
          break;
        case 'READ':
        case 'IMAGE_VIEW':
        case 'IMAGE_DOWNLOAD':
          // All authenticated users can read receipts within their tenant
          break;
        default:
          return { hasAccess: false, reason: `Unknown access type: ${accessType}` };
      }

      return { hasAccess: true, reason: 'Access granted' };

    } catch (error) {
      return { hasAccess: false, reason: `Permission validation failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  /**
   * Determine access restrictions based on role and access type
   */
  private determineAccessRestrictions(
    role: string, 
    accessType: string
  ): ReceiptAccessResult['restrictions'] {
    const restrictions = {
      imageAccess: false,
      dataAccess: false,
      modificationAllowed: false
    };

    // Admin and Manager roles get full access
    if (SecureAccessControlService.ADMIN_ROLES.includes(role)) {
      restrictions.imageAccess = true;
      restrictions.dataAccess = true;
      restrictions.modificationAllowed = accessType === 'UPDATE' || accessType === 'DELETE';
    } else {
      // Staff role gets limited access
      restrictions.imageAccess = accessType === 'IMAGE_VIEW' || accessType === 'IMAGE_DOWNLOAD';
      restrictions.dataAccess = accessType === 'READ';
      restrictions.modificationAllowed = false;
    }

    return restrictions;
  }

  /**
   * Log access attempts for audit trail
   */
  private async logAccessAttempt(
    request: ReceiptAccessRequest, 
    result: ReceiptAccessResult
  ): Promise<string> {
    const auditContext: AuditContext = {
      tenantId: request.context.tenantId,
      userId: request.context.userId,
      resource: `Receipt access ${result.granted ? 'granted' : 'denied'}: ${request.receiptId}, type: ${request.accessType}, reason: ${result.reason}`
    };
    
    if (request.context.ipAddress) auditContext.ipAddress = request.context.ipAddress;
    if (request.context.userAgent) auditContext.userAgent = request.context.userAgent;

    const eventType = result.granted ? 'RECEIPT_ACCESS_GRANTED' : 'RECEIPT_ACCESS_DENIED';
    await this.auditService.logSensitiveOperation(eventType, auditContext);
    
    return auditContext.resource || '';
  }

  /**
   * Log deletion attempts for audit trail
   */
  private async logDeletionAttempt(
    request: ReceiptDeletionRequest, 
    result: ReceiptDeletionResult
  ): Promise<string> {
    const auditContext: AuditContext = {
      tenantId: request.context.tenantId,
      userId: request.context.userId,
      resource: `Receipt deletion ${result.success ? 'completed' : 'failed'}: ${request.receiptId}, reason: ${request.reason}, components: ${JSON.stringify(result.deletedComponents)}`
    };
    
    if (request.context.ipAddress) auditContext.ipAddress = request.context.ipAddress;
    if (request.context.userAgent) auditContext.userAgent = request.context.userAgent;

    const eventType = result.success ? 'RECEIPT_DELETION_COMPLETED' : 'RECEIPT_DELETION_FAILED';
    await this.auditService.logSensitiveOperation(eventType, auditContext);
    
    return auditContext.resource || '';
  }
}

/**
 * Factory function to create SecureAccessControlService instance
 */
export function createSecureAccessControlService(
  db: ReturnType<typeof drizzle>, 
  r2Bucket: R2Bucket
): ISecureAccessControlService {
  return new SecureAccessControlService(db, r2Bucket);
}