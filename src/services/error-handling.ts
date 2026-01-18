/**
 * Comprehensive Error Handling Service for Receipt Processing
 * 
 * Provides detailed error logging, manual review flagging, and data validation
 * for all receipt processing stages. Implements requirements 7.1, 7.2, 7.3, 7.4.
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, sql } from 'drizzle-orm';
import { 
  receiptProcessingJobs, 
  receipts, 
  receiptLineItems,
  ReceiptProcessingStatus,
  type ReceiptProcessingStatusType 
} from '../db/schema';
import { generateId } from '../utils';

// Error severity levels
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// Error categories for processing stages
export enum ErrorCategory {
  UPLOAD = 'UPLOAD',
  OCR = 'OCR',
  PARSING = 'PARSING',
  MATCHING = 'MATCHING',
  STORAGE = 'STORAGE',
  VALIDATION = 'VALIDATION',
  SYSTEM = 'SYSTEM'
}

// Manual review reasons
export enum ManualReviewReason {
  LOW_CONFIDENCE = 'LOW_CONFIDENCE',
  PARSING_FAILED = 'PARSING_FAILED',
  NO_PRODUCT_MATCH = 'NO_PRODUCT_MATCH',
  DATA_INCONSISTENCY = 'DATA_INCONSISTENCY',
  OCR_QUALITY_POOR = 'OCR_QUALITY_POOR',
  VENDOR_UNKNOWN = 'VENDOR_UNKNOWN',
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',
  USER_REQUESTED = 'USER_REQUESTED'
}

// Detailed error information
export interface DetailedError {
  id: string;
  jobId: string;
  tenantId: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  stage: string;
  code: string;
  message: string;
  details: any;
  context: ProcessingContext;
  timestamp: number;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: number;
}

// Processing context for error tracking
export interface ProcessingContext {
  userId: string;
  r2Key: string;
  fileName?: string;
  fileSize?: number;
  processingOptions?: any;
  retryCount: number;
  processingTimeMs?: number;
  ocrModel?: string;
  parsingStrategy?: string;
}

// Data validation result
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  confidence: number;
  requiresManualReview: boolean;
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: ErrorSeverity;
  suggestedFix?: string;
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  impact: string;
}

// Manual review flag
export interface ManualReviewFlag {
  id: string;
  jobId?: string;
  receiptId?: string;
  lineItemId?: string;
  reason: ManualReviewReason;
  description: string;
  severity: ErrorSeverity;
  flaggedBy: string;
  flaggedAt: number;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: number;
  resolution?: string;
}

// Quality control metrics
export interface QualityMetrics {
  totalProcessed: number;
  successfulProcessed: number;
  failedProcessed: number;
  manualReviewRequired: number;
  avgConfidenceScore: number;
  avgProcessingTime: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  commonFailureReasons: Array<{ reason: string; count: number }>;
}

// Error handling service interface
export interface IErrorHandlingService {
  logProcessingError(error: Partial<DetailedError>): Promise<string>;
  flagForManualReview(flag: Partial<ManualReviewFlag>): Promise<string>;
  validateReceiptData(data: any, context: ProcessingContext): Promise<ValidationResult>;
  getProcessingErrors(tenantId: string, filters?: ErrorFilters): Promise<DetailedError[]>;
  getManualReviewItems(tenantId: string, filters?: ReviewFilters): Promise<ManualReviewFlag[]>;
  getQualityMetrics(tenantId: string, dateRange?: DateRange): Promise<QualityMetrics>;
  resolveError(errorId: string, resolvedBy: string, resolution?: string): Promise<void>;
  resolveManualReview(flagId: string, resolvedBy: string, resolution: string): Promise<void>;
  checkDataReasonableness(data: any): ValidationResult;
}

// Filter interfaces
export interface ErrorFilters {
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  resolved?: boolean;
  startDate?: number;
  endDate?: number;
  limit?: number;
}

export interface ReviewFilters {
  reason?: ManualReviewReason;
  severity?: ErrorSeverity;
  resolved?: boolean;
  startDate?: number;
  endDate?: number;
  limit?: number;
}

export interface DateRange {
  startDate: number;
  endDate: number;
}

// Error handling service implementation
export class ErrorHandlingService implements IErrorHandlingService {
  private db: ReturnType<typeof drizzle>;

  constructor(db: ReturnType<typeof drizzle>) {
    this.db = db;
  }

  /**
   * Log detailed processing error with context
   * Requirements: 7.1 - Detailed error logging for all processing stages
   */
  async logProcessingError(error: Partial<DetailedError>): Promise<string> {
    try {
      const errorId = generateId();
      const now = Date.now();

      const detailedError: DetailedError = {
        id: errorId,
        jobId: error.jobId || '',
        tenantId: error.tenantId || '',
        category: error.category || ErrorCategory.SYSTEM,
        severity: error.severity || ErrorSeverity.MEDIUM,
        stage: error.stage || 'UNKNOWN',
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'An unknown error occurred',
        details: error.details || {},
        context: error.context || {} as ProcessingContext,
        timestamp: now,
        resolved: false
      };

      // Store error in processing job if jobId is provided
      if (error.jobId) {
        await this.db
          .update(receiptProcessingJobs)
          .set({
            status: ReceiptProcessingStatus.FAILED,
            errorMessage: `${detailedError.category}:${detailedError.code} - ${detailedError.message}`,
            completedAt: now
          })
          .where(eq(receiptProcessingJobs.id, error.jobId));
      }

      // Log to console with structured format
      console.error('Receipt Processing Error:', {
        errorId,
        jobId: detailedError.jobId,
        tenantId: detailedError.tenantId,
        category: detailedError.category,
        severity: detailedError.severity,
        stage: detailedError.stage,
        code: detailedError.code,
        message: detailedError.message,
        context: detailedError.context,
        timestamp: new Date(now).toISOString()
      });

      // Determine if manual review is required based on severity
      if (detailedError.severity === ErrorSeverity.HIGH || detailedError.severity === ErrorSeverity.CRITICAL) {
        await this.flagForManualReview({
          jobId: detailedError.jobId,
          reason: this.mapErrorToReviewReason(detailedError.category, detailedError.code),
          description: `${detailedError.category} error: ${detailedError.message}`,
          severity: detailedError.severity,
          flaggedBy: 'SYSTEM'
        });
      }

      return errorId;

    } catch (logError) {
      console.error('Failed to log processing error:', logError);
      throw new Error('Error logging failed');
    }
  }

  /**
   * Flag item for manual review with detailed reasoning
   * Requirements: 7.2 - Manual review flagging system
   */
  async flagForManualReview(flag: Partial<ManualReviewFlag>): Promise<string> {
    try {
      const flagId = generateId();
      const now = Date.now();

      const reviewFlag: ManualReviewFlag = {
        id: flagId,
        jobId: flag.jobId,
        receiptId: flag.receiptId,
        lineItemId: flag.lineItemId,
        reason: flag.reason || ManualReviewReason.USER_REQUESTED,
        description: flag.description || 'Manual review requested',
        severity: flag.severity || ErrorSeverity.MEDIUM,
        flaggedBy: flag.flaggedBy || 'SYSTEM',
        flaggedAt: now,
        resolved: false
      };

      // Update receipt or line item to require manual review
      if (reviewFlag.receiptId) {
        await this.db
          .update(receipts)
          .set({ requiresManualReview: true })
          .where(eq(receipts.id, reviewFlag.receiptId));
      }

      if (reviewFlag.lineItemId) {
        await this.db
          .update(receiptLineItems)
          .set({ requiresManualReview: true })
          .where(eq(receiptLineItems.id, reviewFlag.lineItemId));
      }

      // Update processing job status if applicable
      if (reviewFlag.jobId) {
        await this.db
          .update(receiptProcessingJobs)
          .set({ status: ReceiptProcessingStatus.REQUIRES_REVIEW })
          .where(eq(receiptProcessingJobs.id, reviewFlag.jobId));
      }

      // Log manual review flag
      console.warn('Manual Review Flagged:', {
        flagId,
        jobId: reviewFlag.jobId,
        receiptId: reviewFlag.receiptId,
        lineItemId: reviewFlag.lineItemId,
        reason: reviewFlag.reason,
        description: reviewFlag.description,
        severity: reviewFlag.severity,
        flaggedBy: reviewFlag.flaggedBy,
        timestamp: new Date(now).toISOString()
      });

      return flagId;

    } catch (flagError) {
      console.error('Failed to flag for manual review:', flagError);
      throw new Error('Manual review flagging failed');
    }
  }

  /**
   * Validate receipt data for completeness and accuracy
   * Requirements: 7.3 - Data reasonableness validation
   */
  async validateReceiptData(data: any, context: ProcessingContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let confidence = 1.0;

    try {
      // Validate vendor information
      if (!data.vendor || !data.vendor.name) {
        errors.push({
          field: 'vendor.name',
          code: 'VENDOR_MISSING',
          message: 'Vendor name is required but was not found',
          severity: ErrorSeverity.HIGH,
          suggestedFix: 'Review OCR text for vendor information'
        });
        confidence -= 0.3;
      } else if (data.vendor.confidence < 0.5) {
        warnings.push({
          field: 'vendor.name',
          code: 'VENDOR_LOW_CONFIDENCE',
          message: `Vendor name confidence is low: ${data.vendor.confidence}`,
          impact: 'May require manual verification'
        });
        confidence -= 0.1;
      }

      // Validate transaction date
      if (!data.transactionDate) {
        errors.push({
          field: 'transactionDate',
          code: 'DATE_MISSING',
          message: 'Transaction date is required but was not found',
          severity: ErrorSeverity.MEDIUM,
          suggestedFix: 'Review OCR text for date patterns'
        });
        confidence -= 0.2;
      } else {
        const date = new Date(data.transactionDate);
        const now = new Date();
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        const oneWeekFuture = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        if (date < oneYearAgo || date > oneWeekFuture) {
          warnings.push({
            field: 'transactionDate',
            code: 'DATE_UNREASONABLE',
            message: `Transaction date seems unreasonable: ${date.toISOString()}`,
            impact: 'Date may be incorrectly parsed'
          });
          confidence -= 0.1;
        }
      }

      // Validate total amount
      if (!data.totalAmount || data.totalAmount <= 0) {
        errors.push({
          field: 'totalAmount',
          code: 'TOTAL_INVALID',
          message: 'Total amount must be greater than zero',
          severity: ErrorSeverity.HIGH,
          suggestedFix: 'Review OCR text for total amount'
        });
        confidence -= 0.3;
      } else if (data.totalAmount > 100000) { // $1000 seems unreasonable for most receipts
        warnings.push({
          field: 'totalAmount',
          code: 'TOTAL_HIGH',
          message: `Total amount seems unusually high: $${(data.totalAmount / 100).toFixed(2)}`,
          impact: 'May indicate parsing error'
        });
        confidence -= 0.1;
      }

      // Validate line items
      if (!data.lineItems || data.lineItems.length === 0) {
        errors.push({
          field: 'lineItems',
          code: 'LINE_ITEMS_MISSING',
          message: 'Receipt must contain at least one line item',
          severity: ErrorSeverity.HIGH,
          suggestedFix: 'Review parsing logic for line item detection'
        });
        confidence -= 0.4;
      } else {
        // Validate individual line items
        let lineItemTotal = 0;
        for (let i = 0; i < data.lineItems.length; i++) {
          const item = data.lineItems[i];
          
          if (!item.description || item.description.trim().length === 0) {
            errors.push({
              field: `lineItems[${i}].description`,
              code: 'ITEM_DESCRIPTION_MISSING',
              message: `Line item ${i + 1} is missing description`,
              severity: ErrorSeverity.MEDIUM
            });
            confidence -= 0.1;
          }

          if (item.totalPrice && item.totalPrice > 0) {
            lineItemTotal += item.totalPrice;
          }

          if (item.confidence && item.confidence < 0.3) {
            warnings.push({
              field: `lineItems[${i}].confidence`,
              code: 'ITEM_LOW_CONFIDENCE',
              message: `Line item ${i + 1} has low parsing confidence: ${item.confidence}`,
              impact: 'May require manual verification'
            });
            confidence -= 0.05;
          }
        }

        // Check if line item total matches receipt total
        if (data.totalAmount && lineItemTotal > 0) {
          const difference = Math.abs(data.totalAmount - lineItemTotal);
          const percentDifference = (difference / data.totalAmount) * 100;

          if (percentDifference > 10) { // More than 10% difference
            warnings.push({
              field: 'totalAmount',
              code: 'TOTAL_MISMATCH',
              message: `Line items total ($${(lineItemTotal / 100).toFixed(2)}) doesn't match receipt total ($${(data.totalAmount / 100).toFixed(2)})`,
              impact: 'May indicate parsing errors or missing items'
            });
            confidence -= 0.2;
          }
        }
      }

      // Validate overall confidence score
      if (data.confidence && data.confidence.overall < 0.5) {
        warnings.push({
          field: 'confidence.overall',
          code: 'OVERALL_LOW_CONFIDENCE',
          message: `Overall parsing confidence is low: ${data.confidence.overall}`,
          impact: 'Receipt may require manual review'
        });
        confidence -= 0.2;
      }

      // Determine if manual review is required
      const requiresManualReview = 
        errors.length > 0 || 
        confidence < 0.6 || 
        warnings.some(w => w.code === 'TOTAL_MISMATCH' || w.code === 'DATE_UNREASONABLE');

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        confidence: Math.max(0, Math.min(1, confidence)),
        requiresManualReview
      };

    } catch (validationError) {
      console.error('Data validation failed:', validationError);
      
      return {
        isValid: false,
        errors: [{
          field: 'validation',
          code: 'VALIDATION_FAILED',
          message: 'Data validation process failed',
          severity: ErrorSeverity.CRITICAL
        }],
        warnings: [],
        confidence: 0,
        requiresManualReview: true
      };
    }
  }

  /**
   * Check data reasonableness with business rules
   * Requirements: 7.3 - Data reasonableness validation
   */
  checkDataReasonableness(data: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let confidence = 1.0;

    // Business rule validations
    const businessRules = [
      {
        name: 'reasonable_total',
        check: () => data.totalAmount > 0 && data.totalAmount < 1000000, // $10,000 max
        error: 'Total amount is outside reasonable range',
        severity: ErrorSeverity.MEDIUM
      },
      {
        name: 'reasonable_item_count',
        check: () => data.lineItems && data.lineItems.length > 0 && data.lineItems.length < 100,
        error: 'Line item count is outside reasonable range',
        severity: ErrorSeverity.MEDIUM
      },
      {
        name: 'reasonable_date',
        check: () => {
          if (!data.transactionDate) return false;
          const date = new Date(data.transactionDate);
          const now = new Date();
          const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
          return date >= sixMonthsAgo && date <= now;
        },
        error: 'Transaction date is outside reasonable range (6 months ago to now)',
        severity: ErrorSeverity.LOW
      }
    ];

    for (const rule of businessRules) {
      try {
        if (!rule.check()) {
          errors.push({
            field: rule.name,
            code: rule.name.toUpperCase(),
            message: rule.error,
            severity: rule.severity
          });
          confidence -= rule.severity === ErrorSeverity.HIGH ? 0.3 : 
                      rule.severity === ErrorSeverity.MEDIUM ? 0.2 : 0.1;
        }
      } catch (ruleError) {
        warnings.push({
          field: rule.name,
          code: 'RULE_CHECK_FAILED',
          message: `Business rule check failed: ${rule.name}`,
          impact: 'Unable to validate business rule'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      confidence: Math.max(0, confidence),
      requiresManualReview: errors.length > 0 || confidence < 0.7
    };
  }

  /**
   * Get processing errors with filtering
   * Requirements: 7.4 - Error tracking and monitoring
   */
  async getProcessingErrors(tenantId: string, filters: ErrorFilters = {}): Promise<DetailedError[]> {
    try {
      // This would typically query a dedicated error log table
      // For now, we'll extract errors from processing jobs
      const conditions = [eq(receiptProcessingJobs.tenantId, tenantId)];
      
      if (filters.startDate) {
        conditions.push(sql`${receiptProcessingJobs.createdAt} >= ${filters.startDate}`);
      }
      
      if (filters.endDate) {
        conditions.push(sql`${receiptProcessingJobs.createdAt} <= ${filters.endDate}`);
      }

      const failedJobs = await this.db
        .select()
        .from(receiptProcessingJobs)
        .where(and(...conditions, eq(receiptProcessingJobs.status, ReceiptProcessingStatus.FAILED)))
        .orderBy(desc(receiptProcessingJobs.createdAt))
        .limit(filters.limit || 50);

      return failedJobs.map(job => ({
        id: job.id,
        jobId: job.id,
        tenantId: job.tenantId,
        category: this.categorizeError(job.errorMessage || ''),
        severity: this.determineSeverity(job.errorMessage || '', job.retryCount || 0),
        stage: 'PROCESSING',
        code: 'PROCESSING_FAILED',
        message: job.errorMessage || 'Processing failed',
        details: { processingOptions: job.processingOptions },
        context: {
          userId: job.userId,
          r2Key: job.r2Key,
          retryCount: job.retryCount || 0
        },
        timestamp: job.createdAt,
        resolved: false
      }));

    } catch (error) {
      console.error('Failed to get processing errors:', error);
      return [];
    }
  }

  /**
   * Get manual review items with filtering
   * Requirements: 7.2 - Manual review flagging system
   */
  async getManualReviewItems(tenantId: string, filters: ReviewFilters = {}): Promise<ManualReviewFlag[]> {
    try {
      const conditions = [
        eq(receipts.tenantId, tenantId),
        eq(receipts.requiresManualReview, true)
      ];

      if (filters.startDate) {
        conditions.push(sql`${receipts.createdAt} >= ${filters.startDate}`);
      }
      
      if (filters.endDate) {
        conditions.push(sql`${receipts.createdAt} <= ${filters.endDate}`);
      }

      const reviewItems = await this.db
        .select()
        .from(receipts)
        .where(and(...conditions))
        .orderBy(desc(receipts.createdAt))
        .limit(filters.limit || 50);

      return reviewItems.map(receipt => ({
        id: generateId(),
        receiptId: receipt.id,
        jobId: receipt.processingJobId,
        reason: this.determineReviewReason(receipt),
        description: `Receipt requires manual review - confidence: ${receipt.confidenceScore}`,
        severity: receipt.confidenceScore && receipt.confidenceScore < 0.3 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
        flaggedBy: 'SYSTEM',
        flaggedAt: receipt.createdAt,
        resolved: false
      }));

    } catch (error) {
      console.error('Failed to get manual review items:', error);
      return [];
    }
  }

  /**
   * Get quality control metrics
   * Requirements: 7.4 - System monitoring and quality metrics
   */
  async getQualityMetrics(tenantId: string, dateRange?: DateRange): Promise<QualityMetrics> {
    try {
      const conditions = [eq(receiptProcessingJobs.tenantId, tenantId)];
      
      if (dateRange) {
        conditions.push(sql`${receiptProcessingJobs.createdAt} >= ${dateRange.startDate}`);
        conditions.push(sql`${receiptProcessingJobs.createdAt} <= ${dateRange.endDate}`);
      }

      const jobs = await this.db
        .select()
        .from(receiptProcessingJobs)
        .where(and(...conditions));

      const totalProcessed = jobs.length;
      const successfulProcessed = jobs.filter(j => j.status === ReceiptProcessingStatus.COMPLETED).length;
      const failedProcessed = jobs.filter(j => j.status === ReceiptProcessingStatus.FAILED).length;
      const manualReviewRequired = jobs.filter(j => j.status === ReceiptProcessingStatus.REQUIRES_REVIEW).length;

      // Get confidence scores from completed receipts
      const completedReceipts = await this.db
        .select({ confidenceScore: receipts.confidenceScore })
        .from(receipts)
        .innerJoin(receiptProcessingJobs, eq(receipts.processingJobId, receiptProcessingJobs.id))
        .where(and(...conditions, eq(receiptProcessingJobs.status, ReceiptProcessingStatus.COMPLETED)));

      const avgConfidenceScore = completedReceipts.length > 0
        ? completedReceipts.reduce((sum, r) => sum + (r.confidenceScore || 0), 0) / completedReceipts.length
        : 0;

      // Calculate average processing time
      const completedJobs = jobs.filter(j => j.startedAt && j.completedAt);
      const avgProcessingTime = completedJobs.length > 0
        ? completedJobs.reduce((sum, j) => sum + ((j.completedAt || 0) - (j.startedAt || 0)), 0) / completedJobs.length
        : 0;

      // Categorize errors
      const errorsByCategory: Record<ErrorCategory, number> = {
        [ErrorCategory.UPLOAD]: 0,
        [ErrorCategory.OCR]: 0,
        [ErrorCategory.PARSING]: 0,
        [ErrorCategory.MATCHING]: 0,
        [ErrorCategory.STORAGE]: 0,
        [ErrorCategory.VALIDATION]: 0,
        [ErrorCategory.SYSTEM]: 0
      };

      const errorsBySeverity: Record<ErrorSeverity, number> = {
        [ErrorSeverity.LOW]: 0,
        [ErrorSeverity.MEDIUM]: 0,
        [ErrorSeverity.HIGH]: 0,
        [ErrorSeverity.CRITICAL]: 0
      };

      // Analyze error messages
      const failureReasons: Record<string, number> = {};
      
      jobs.filter(j => j.errorMessage).forEach(job => {
        const category = this.categorizeError(job.errorMessage || '');
        const severity = this.determineSeverity(job.errorMessage || '', job.retryCount || 0);
        
        errorsByCategory[category]++;
        errorsBySeverity[severity]++;
        
        const reason = job.errorMessage || 'Unknown error';
        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      });

      const commonFailureReasons = Object.entries(failureReasons)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalProcessed,
        successfulProcessed,
        failedProcessed,
        manualReviewRequired,
        avgConfidenceScore,
        avgProcessingTime,
        errorsByCategory,
        errorsBySeverity,
        commonFailureReasons
      };

    } catch (error) {
      console.error('Failed to get quality metrics:', error);
      throw new Error('Quality metrics retrieval failed');
    }
  }

  /**
   * Resolve processing error
   */
  async resolveError(errorId: string, resolvedBy: string, resolution?: string): Promise<void> {
    try {
      // In a full implementation, this would update an error log table
      console.log(`Error ${errorId} resolved by ${resolvedBy}: ${resolution || 'No resolution provided'}`);
    } catch (error) {
      console.error('Failed to resolve error:', error);
      throw new Error('Error resolution failed');
    }
  }

  /**
   * Resolve manual review flag
   */
  async resolveManualReview(flagId: string, resolvedBy: string, resolution: string): Promise<void> {
    try {
      // In a full implementation, this would update the manual review flag
      console.log(`Manual review ${flagId} resolved by ${resolvedBy}: ${resolution}`);
    } catch (error) {
      console.error('Failed to resolve manual review:', error);
      throw new Error('Manual review resolution failed');
    }
  }

  // Helper methods
  private mapErrorToReviewReason(category: ErrorCategory, code: string): ManualReviewReason {
    switch (category) {
      case ErrorCategory.OCR:
        return ManualReviewReason.OCR_QUALITY_POOR;
      case ErrorCategory.PARSING:
        return ManualReviewReason.PARSING_FAILED;
      case ErrorCategory.MATCHING:
        return ManualReviewReason.NO_PRODUCT_MATCH;
      case ErrorCategory.VALIDATION:
        return ManualReviewReason.DATA_INCONSISTENCY;
      default:
        return ManualReviewReason.LOW_CONFIDENCE;
    }
  }

  private categorizeError(errorMessage: string): ErrorCategory {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('ocr') || message.includes('vision')) {
      return ErrorCategory.OCR;
    } else if (message.includes('parsing') || message.includes('text')) {
      return ErrorCategory.PARSING;
    } else if (message.includes('matching') || message.includes('product')) {
      return ErrorCategory.MATCHING;
    } else if (message.includes('database') || message.includes('storage')) {
      return ErrorCategory.STORAGE;
    } else if (message.includes('upload') || message.includes('r2')) {
      return ErrorCategory.UPLOAD;
    } else if (message.includes('validation')) {
      return ErrorCategory.VALIDATION;
    }
    
    return ErrorCategory.SYSTEM;
  }

  private determineSeverity(errorMessage: string, retryCount: number): ErrorSeverity {
    if (retryCount >= 3) {
      return ErrorSeverity.CRITICAL;
    } else if (errorMessage.includes('critical') || errorMessage.includes('fatal')) {
      return ErrorSeverity.CRITICAL;
    } else if (errorMessage.includes('failed') || retryCount >= 1) {
      return ErrorSeverity.HIGH;
    } else if (errorMessage.includes('warning') || errorMessage.includes('low confidence')) {
      return ErrorSeverity.MEDIUM;
    }
    
    return ErrorSeverity.LOW;
  }

  private determineReviewReason(receipt: any): ManualReviewReason {
    if (!receipt.confidenceScore || receipt.confidenceScore < 0.3) {
      return ManualReviewReason.LOW_CONFIDENCE;
    } else if (!receipt.vendorName) {
      return ManualReviewReason.VENDOR_UNKNOWN;
    } else if (!receipt.totalAmountCents) {
      return ManualReviewReason.PARSING_FAILED;
    }
    
    return ManualReviewReason.DATA_INCONSISTENCY;
  }
}

/**
 * Factory function to create ErrorHandlingService instance
 */
export function createErrorHandlingService(db: ReturnType<typeof drizzle>): IErrorHandlingService {
  return new ErrorHandlingService(db);
}