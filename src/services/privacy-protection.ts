/**
 * Privacy Protection Service for Receipt Scanning System
 * 
 * Implements privacy protection measures including in-memory-only OCR text processing,
 * secure data retention policies, and tenant isolation for receipt storage.
 * 
 * Requirements: 3.5, 8.1, 8.2, 8.3
 */

import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, lt } from 'drizzle-orm';
import { 
  receipts, 
  receiptProcessingJobs, 
  receiptLineItems,
  ReceiptProcessingStatus 
} from '../db';
import * as schema from '../db';
import { createAuditService, type IAuditService, type AuditContext } from './audit';

// Privacy protection interfaces
export interface DataRetentionPolicy {
  receiptDataRetentionDays: number;
  processingJobRetentionDays: number;
  auditLogRetentionDays: number;
  failedJobRetentionDays: number;
}

export interface PrivacyProtectionConfig {
  enableInMemoryOnlyProcessing: boolean;
  enableAutomaticDataPurging: boolean;
  dataRetentionPolicy: DataRetentionPolicy;
  tenantIsolationEnabled: boolean;
  encryptionAtRest: boolean;
}

export interface DataPurgeResult {
  receiptsDeleted: number;
  processingJobsDeleted: number;
  lineItemsDeleted: number;
  matchCandidatesDeleted: number;
  r2ObjectsDeleted: number;
  errors: string[];
}

export interface TenantIsolationCheck {
  isValid: boolean;
  tenantId: string;
  resourceType: string;
  resourceId: string;
  violations: string[];
}

// Privacy protection service implementation
export interface IPrivacyProtectionService {
  enforceInMemoryOnlyProcessing(ocrText: string, processingContext: any): Promise<void>;
  applyDataRetentionPolicy(tenantId: string): Promise<DataPurgeResult>;
  validateTenantIsolation(tenantId: string, resourceType: string, resourceId: string): Promise<TenantIsolationCheck>;
  purgeExpiredData(tenantId?: string): Promise<DataPurgeResult>;
  getDataRetentionStatus(tenantId: string): Promise<{
    totalReceipts: number;
    expiredReceipts: number;
    nextPurgeDate: Date;
    retentionPolicy: DataRetentionPolicy;
  }>;
}

export class PrivacyProtectionService implements IPrivacyProtectionService {
  private db: ReturnType<typeof drizzle>;
  private r2Bucket: R2Bucket;
  private auditService: IAuditService;
  private config: PrivacyProtectionConfig;

  // Default privacy protection configuration
  private static readonly DEFAULT_CONFIG: PrivacyProtectionConfig = {
    enableInMemoryOnlyProcessing: true,
    enableAutomaticDataPurging: true,
    dataRetentionPolicy: {
      receiptDataRetentionDays: 2555, // 7 years for tax compliance
      processingJobRetentionDays: 90,  // 3 months for debugging
      auditLogRetentionDays: 2555,    // 7 years for compliance
      failedJobRetentionDays: 30      // 1 month for failed jobs
    },
    tenantIsolationEnabled: true,
    encryptionAtRest: true
  };

  constructor(
    db: DrizzleD1Database<typeof schema>, 
    r2Bucket: R2Bucket, 
    config: Partial<PrivacyProtectionConfig> = {}
  ) {
    this.db = db;
    this.r2Bucket = r2Bucket;
    this.auditService = createAuditService(db);
    this.config = { ...PrivacyProtectionService.DEFAULT_CONFIG, ...config };
  }

  /**
   * Enforce in-memory-only OCR text processing
   * Requirements: 3.5, 8.1
   */
  async enforceInMemoryOnlyProcessing(ocrText: string, processingContext: any): Promise<void> {
    if (!this.config.enableInMemoryOnlyProcessing) {
      return;
    }

    try {
      // Validate that OCR text is not being persisted
      if (this.detectTextPersistenceAttempt(ocrText, processingContext)) {
        const auditContext: AuditContext = {
          tenantId: processingContext.tenantId,
          userId: processingContext.userId,
          resource: `OCR text persistence attempt detected for job: ${processingContext.jobId}`
        };

        await this.auditService.logSensitiveOperation('PRIVACY_VIOLATION_OCR_PERSISTENCE', auditContext);
        
        throw new Error('Privacy violation: OCR text persistence is not allowed');
      }

      // Log successful in-memory processing enforcement
      const auditContext: AuditContext = {
        tenantId: processingContext.tenantId,
        userId: processingContext.userId,
        resource: `In-memory OCR processing enforced for job: ${processingContext.jobId}`
      };

      await this.auditService.logSensitiveOperation('PRIVACY_IN_MEMORY_PROCESSING_ENFORCED', auditContext);

      // Clear any temporary OCR text references
      this.clearOCRTextFromMemory(ocrText);

    } catch (error) {
      console.error('Failed to enforce in-memory processing:', error);
      throw new Error(`Privacy protection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply data retention policy for a specific tenant
   * Requirements: 8.2, 8.3
   */
  async applyDataRetentionPolicy(tenantId: string): Promise<DataPurgeResult> {
    if (!this.config.enableAutomaticDataPurging) {
      return {
        receiptsDeleted: 0,
        processingJobsDeleted: 0,
        lineItemsDeleted: 0,
        matchCandidatesDeleted: 0,
        r2ObjectsDeleted: 0,
        errors: ['Automatic data purging is disabled']
      };
    }

    const result: DataPurgeResult = {
      receiptsDeleted: 0,
      processingJobsDeleted: 0,
      lineItemsDeleted: 0,
      matchCandidatesDeleted: 0,
      r2ObjectsDeleted: 0,
      errors: []
    };

    try {
      const now = Date.now();
      const policy = this.config.dataRetentionPolicy;

      // Calculate expiration timestamps
      const receiptExpirationTime = now - (policy.receiptDataRetentionDays * 24 * 60 * 60 * 1000);
      const jobExpirationTime = now - (policy.processingJobRetentionDays * 24 * 60 * 60 * 1000);
      const failedJobExpirationTime = now - (policy.failedJobRetentionDays * 24 * 60 * 60 * 1000);

      // Find expired receipts with tenant isolation
      const expiredReceipts = await this.db
        .select()
        .from(receipts)
        .where(and(
          eq(receipts.tenantId, tenantId),
          lt(receipts.createdAt, receiptExpirationTime)
        ));

      // Delete expired receipt data and associated R2 objects
      for (const receipt of expiredReceipts) {
        try {
          // Delete R2 object first
          await this.r2Bucket.delete(receipt.r2Key);
          result.r2ObjectsDeleted++;

          // Delete receipt line items (cascade will handle match candidates)
          await this.db
            .delete(receiptLineItems)
            .where(eq(receiptLineItems.receiptId, receipt.id));
          
          result.lineItemsDeleted += 1; // Approximate count

          // Delete receipt record
          await this.db
            .delete(receipts)
            .where(eq(receipts.id, receipt.id));
          
          result.receiptsDeleted++;

        } catch (error) {
          result.errors.push(`Failed to delete receipt ${receipt.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Find and delete expired processing jobs
      const expiredJobs = await this.db
        .select()
        .from(receiptProcessingJobs)
        .where(and(
          eq(receiptProcessingJobs.tenantId, tenantId),
          lt(receiptProcessingJobs.createdAt, jobExpirationTime)
        ));

      for (const job of expiredJobs) {
        try {
          await this.db
            .delete(receiptProcessingJobs)
            .where(eq(receiptProcessingJobs.id, job.id));
          
          result.processingJobsDeleted++;
        } catch (error) {
          result.errors.push(`Failed to delete processing job ${job.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Find and delete failed jobs that exceed failed job retention
      const expiredFailedJobs = await this.db
        .select()
        .from(receiptProcessingJobs)
        .where(and(
          eq(receiptProcessingJobs.tenantId, tenantId),
          eq(receiptProcessingJobs.status, ReceiptProcessingStatus.FAILED),
          lt(receiptProcessingJobs.createdAt, failedJobExpirationTime)
        ));

      for (const job of expiredFailedJobs) {
        try {
          await this.db
            .delete(receiptProcessingJobs)
            .where(eq(receiptProcessingJobs.id, job.id));
          
          result.processingJobsDeleted++;
        } catch (error) {
          result.errors.push(`Failed to delete failed job ${job.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Log data retention policy application
      const auditContext: AuditContext = {
        tenantId,
        resource: `Data retention policy applied: ${result.receiptsDeleted} receipts, ${result.processingJobsDeleted} jobs deleted`
      };

      await this.auditService.logSensitiveOperation('PRIVACY_DATA_RETENTION_APPLIED', auditContext);

      return result;

    } catch (error) {
      result.errors.push(`Data retention policy application failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Validate tenant isolation for receipt storage
   * Requirements: 8.3
   */
  async validateTenantIsolation(
    tenantId: string, 
    resourceType: string, 
    resourceId: string
  ): Promise<TenantIsolationCheck> {
    if (!this.config.tenantIsolationEnabled) {
      return {
        isValid: true,
        tenantId,
        resourceType,
        resourceId,
        violations: []
      };
    }

    const check: TenantIsolationCheck = {
      isValid: true,
      tenantId,
      resourceType,
      resourceId,
      violations: []
    };

    try {
      switch (resourceType) {
        case 'receipt':
          await this.validateReceiptTenantIsolation(tenantId, resourceId, check);
          break;
        case 'processing_job':
          await this.validateProcessingJobTenantIsolation(tenantId, resourceId, check);
          break;
        case 'line_item':
          await this.validateLineItemTenantIsolation(tenantId, resourceId, check);
          break;
        case 'r2_object':
          await this.validateR2ObjectTenantIsolation(tenantId, resourceId, check);
          break;
        default:
          check.violations.push(`Unknown resource type: ${resourceType}`);
          check.isValid = false;
      }

      // Log tenant isolation check
      const auditContext: AuditContext = {
        tenantId,
        resource: `Tenant isolation validated for ${resourceType}:${resourceId}, valid: ${check.isValid}`
      };

      await this.auditService.logSensitiveOperation('PRIVACY_TENANT_ISOLATION_CHECKED', auditContext);

      return check;

    } catch (error) {
      check.violations.push(`Tenant isolation validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      check.isValid = false;
      return check;
    }
  }

  /**
   * Purge expired data across all tenants or for a specific tenant
   * Requirements: 8.2
   */
  async purgeExpiredData(tenantId?: string): Promise<DataPurgeResult> {
    const aggregateResult: DataPurgeResult = {
      receiptsDeleted: 0,
      processingJobsDeleted: 0,
      lineItemsDeleted: 0,
      matchCandidatesDeleted: 0,
      r2ObjectsDeleted: 0,
      errors: []
    };

    try {
      if (tenantId) {
        // Purge data for specific tenant
        const result = await this.applyDataRetentionPolicy(tenantId);
        return result;
      } else {
        // Purge data for all tenants (system-wide cleanup)
        const allTenants = await this.db
          .selectDistinct({ tenantId: receipts.tenantId })
          .from(receipts);

        for (const tenant of allTenants) {
          if (tenant.tenantId) {
            const result = await this.applyDataRetentionPolicy(tenant.tenantId);
            
            aggregateResult.receiptsDeleted += result.receiptsDeleted;
            aggregateResult.processingJobsDeleted += result.processingJobsDeleted;
            aggregateResult.lineItemsDeleted += result.lineItemsDeleted;
            aggregateResult.matchCandidatesDeleted += result.matchCandidatesDeleted;
            aggregateResult.r2ObjectsDeleted += result.r2ObjectsDeleted;
            aggregateResult.errors.push(...result.errors);
          }
        }

        // Log system-wide purge
        const auditContext: AuditContext = {
          resource: `System-wide data purge completed: ${aggregateResult.receiptsDeleted} receipts deleted across ${allTenants.length} tenants`
        };

        await this.auditService.logSensitiveOperation('PRIVACY_SYSTEM_WIDE_PURGE', auditContext);
      }

      return aggregateResult;

    } catch (error) {
      aggregateResult.errors.push(`Data purge failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return aggregateResult;
    }
  }

  /**
   * Get data retention status for a tenant
   * Requirements: 8.2
   */
  async getDataRetentionStatus(tenantId: string): Promise<{
    totalReceipts: number;
    expiredReceipts: number;
    nextPurgeDate: Date;
    retentionPolicy: DataRetentionPolicy;
  }> {
    try {
      const now = Date.now();
      const receiptExpirationTime = now - (this.config.dataRetentionPolicy.receiptDataRetentionDays * 24 * 60 * 60 * 1000);

      // Count total receipts for tenant
      const totalReceiptsResult = await this.db
        .select({ count: receipts.id })
        .from(receipts)
        .where(eq(receipts.tenantId, tenantId));

      const totalReceipts = totalReceiptsResult.length;

      // Count expired receipts
      const expiredReceiptsResult = await this.db
        .select({ count: receipts.id })
        .from(receipts)
        .where(and(
          eq(receipts.tenantId, tenantId),
          lt(receipts.createdAt, receiptExpirationTime)
        ));

      const expiredReceipts = expiredReceiptsResult.length;

      // Calculate next purge date (daily purge schedule)
      const nextPurgeDate = new Date();
      nextPurgeDate.setDate(nextPurgeDate.getDate() + 1);
      nextPurgeDate.setHours(2, 0, 0, 0); // 2 AM daily purge

      return {
        totalReceipts,
        expiredReceipts,
        nextPurgeDate,
        retentionPolicy: this.config.dataRetentionPolicy
      };

    } catch (error) {
      console.error('Failed to get data retention status:', error);
      throw new Error(`Data retention status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect attempts to persist OCR text
   */
  private detectTextPersistenceAttempt(ocrText: string, processingContext: any): boolean {
    // Check if OCR text is being stored in database fields
    if (processingContext.storeRawText === true) {
      return true;
    }

    // Check if OCR text is being written to external storage
    if (processingContext.persistToFile === true) {
      return true;
    }

    // Check for suspicious text length that might indicate full OCR text storage
    if (ocrText.length > 10000) { // Threshold for suspiciously long text
      console.warn('Large OCR text detected, potential persistence attempt');
    }

    return false;
  }

  /**
   * Clear OCR text from memory
   */
  private clearOCRTextFromMemory(ocrText: string): void {
    // In JavaScript, we can't directly clear memory, but we can help GC
    // by removing references and suggesting garbage collection
    if (typeof ocrText === 'string') {
      // Clear the string reference
      ocrText = '';
    }

    // Suggest garbage collection if available (Node.js)
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }
  }

  /**
   * Validate receipt tenant isolation
   */
  private async validateReceiptTenantIsolation(
    tenantId: string, 
    receiptId: string, 
    check: TenantIsolationCheck
  ): Promise<void> {
    const receiptResult = await this.db
      .select({ tenantId: receipts.tenantId })
      .from(receipts)
      .where(eq(receipts.id, receiptId))
      .limit(1);

    if (receiptResult.length === 0) {
      check.violations.push(`Receipt ${receiptId} not found`);
      check.isValid = false;
      return;
    }

    const receipt = receiptResult[0];
    if (receipt && receipt.tenantId !== tenantId) {
      check.violations.push(`Receipt ${receiptId} belongs to tenant ${receipt.tenantId}, not ${tenantId}`);
      check.isValid = false;
    }
  }

  /**
   * Validate processing job tenant isolation
   */
  private async validateProcessingJobTenantIsolation(
    tenantId: string, 
    jobId: string, 
    check: TenantIsolationCheck
  ): Promise<void> {
    const jobResult = await this.db
      .select({ tenantId: receiptProcessingJobs.tenantId })
      .from(receiptProcessingJobs)
      .where(eq(receiptProcessingJobs.id, jobId))
      .limit(1);

    if (jobResult.length === 0) {
      check.violations.push(`Processing job ${jobId} not found`);
      check.isValid = false;
      return;
    }

    const job = jobResult[0];
    if (job && job.tenantId !== tenantId) {
      check.violations.push(`Processing job ${jobId} belongs to tenant ${job.tenantId}, not ${tenantId}`);
      check.isValid = false;
    }
  }

  /**
   * Validate line item tenant isolation
   */
  private async validateLineItemTenantIsolation(
    tenantId: string, 
    lineItemId: string, 
    check: TenantIsolationCheck
  ): Promise<void> {
    const lineItemResult = await this.db
      .select({ receiptTenantId: receipts.tenantId })
      .from(receiptLineItems)
      .innerJoin(receipts, eq(receiptLineItems.receiptId, receipts.id))
      .where(eq(receiptLineItems.id, lineItemId))
      .limit(1);

    if (lineItemResult.length === 0) {
      check.violations.push(`Line item ${lineItemId} not found`);
      check.isValid = false;
      return;
    }

    const lineItem = lineItemResult[0];
    if (lineItem && lineItem.receiptTenantId !== tenantId) {
      check.violations.push(`Line item ${lineItemId} belongs to tenant ${lineItem.receiptTenantId}, not ${tenantId}`);
      check.isValid = false;
    }
  }

  /**
   * Validate R2 object tenant isolation
   */
  private async validateR2ObjectTenantIsolation(
    tenantId: string, 
    r2Key: string, 
    check: TenantIsolationCheck
  ): Promise<void> {
    // R2 key format: receipts/{tenantId}/{userId}/{uploadId}
    const keyParts = r2Key.split('/');
    
    if (keyParts.length !== 4 || keyParts[0] !== 'receipts') {
      check.violations.push(`Invalid R2 key format: ${r2Key}`);
      check.isValid = false;
      return;
    }

    const keyTenantId = keyParts[1];
    if (keyTenantId !== tenantId) {
      check.violations.push(`R2 object ${r2Key} belongs to tenant ${keyTenantId}, not ${tenantId}`);
      check.isValid = false;
    }
  }
}

/**
 * Factory function to create PrivacyProtectionService instance
 */
export function createPrivacyProtectionService(
  db: DrizzleD1Database<typeof schema>, 
  r2Bucket: R2Bucket,
  config?: Partial<PrivacyProtectionConfig>
): IPrivacyProtectionService {
  return new PrivacyProtectionService(db, r2Bucket, config);
}

/**
 * Default privacy protection configuration
 */
export const DEFAULT_PRIVACY_CONFIG: PrivacyProtectionConfig = {
  enableInMemoryOnlyProcessing: true,
  enableAutomaticDataPurging: true,
  dataRetentionPolicy: {
    receiptDataRetentionDays: 2555, // 7 years
    processingJobRetentionDays: 90,  // 3 months
    auditLogRetentionDays: 2555,    // 7 years
    failedJobRetentionDays: 30      // 1 month
  },
  tenantIsolationEnabled: true,
  encryptionAtRest: true
};