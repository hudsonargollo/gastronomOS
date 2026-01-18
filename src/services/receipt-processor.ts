/**
 * Receipt Processor Worker Service
 * 
 * Handles asynchronous receipt processing through Cloudflare Queues.
 * Orchestrates OCR, parsing, product matching, and data storage.
 * Implements requirements 2.1, 2.4, 2.5.
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { 
  receiptProcessingJobs, 
  receipts, 
  receiptLineItems,
  products,
  productMatchCandidates,
  ReceiptProcessingStatus,
  type ReceiptProcessingStatusType
} from '../db/schema';
import * as schema from '../db/schema';
import { generateId } from '../utils';
import { createOCRService, type IOCRService, type OCROptions } from './ocr';
import { 
  createNotaiParserService, 
  type INotaiParserService, 
  type NotaiParseResult,
  type ParsingStrategy 
} from './notai-parser';
import { createProductMatcher, type IProductMatcher } from './product-matcher';
import { 
  createErrorHandlingService, 
  type IErrorHandlingService, 
  ErrorCategory, 
  ErrorSeverity,
  ManualReviewReason,
  type ProcessingContext 
} from './error-handling';
import { 
  createPrivacyProtectionService, 
  type IPrivacyProtectionService 
} from './privacy-protection';

// Processing job interfaces
export interface ReceiptProcessingJobMessage {
  jobId: string;
  tenantId: string;
  userId: string;
  r2Key: string;
  uploadMetadata: {
    fileName: string;
    fileSize: number;
    contentType: string;
    checksum?: string;
  };
  processingOptions: {
    ocrModel: string;
    parsingStrategy: 'AGGRESSIVE' | 'CONSERVATIVE' | 'ADAPTIVE';
    productMatchingThreshold: number;
    requireManualReview: boolean;
  };
}

export interface ProcessingResult {
  success: boolean;
  receiptData?: StructuredReceiptData;
  errors: ProcessingError[];
  processingStats: ProcessingStatistics;
  requiresManualReview: boolean;
}

export interface StructuredReceiptData {
  vendor: VendorInfo | null;
  transactionDate: Date | null;
  totalAmount: number | null;
  subtotal: number | null;
  tax: number | null;
  lineItems: LineItemCandidate[];
  confidence: ParseConfidence;
  parsingMetadata: ParsingMetadata;
}

export interface VendorInfo {
  name: string;
  confidence: number;
  coordinates?: BoundingBox;
}

export interface LineItemCandidate {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  confidence: number;
  rawText: string;
  coordinates?: BoundingBox;
  matchedProductId?: string;
  matchConfidence?: number;
  requiresManualReview?: boolean;
}

export interface ParseConfidence {
  overall: number; // 0-1 confidence score
  vendor: number;
  date: number;
  total: number;
  lineItems: number;
}

export interface ParsingMetadata {
  processingTime: number;
  ocrModel: string;
  parsingStrategy: string;
  textBlocks: number;
  coordinatesAvailable: boolean;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProcessingError {
  stage: 'OCR' | 'PARSING' | 'MATCHING' | 'STORAGE' | 'PROCESSING';
  code: string;
  message: string;
  details?: any;
}

export interface ProcessingStatistics {
  startTime: number;
  endTime: number;
  processingTimeMs: number;
  ocrTimeMs: number;
  parsingTimeMs: number;
  matchingTimeMs: number;
  storageTimeMs: number;
  retryCount: number;
}

// Receipt processor worker implementation
export interface IReceiptProcessorWorker {
  processReceipt(job: ReceiptProcessingJobMessage): Promise<ProcessingResult>;
  retryFailedProcessing(jobId: string, currentRetryCount: number): Promise<ProcessingResult>;
  updateProcessingStatus(jobId: string, status: ReceiptProcessingStatusType, errorMessage?: string): Promise<void>;
}

export class ReceiptProcessorWorker implements IReceiptProcessorWorker {
  private db: ReturnType<typeof drizzle<typeof schema>>;
  private r2Bucket: R2Bucket;
  private ocrService: IOCRService;
  private notaiParser: INotaiParserService;
  private productMatcher: IProductMatcher;
  private errorHandlingService: IErrorHandlingService;
  private privacyProtectionService: IPrivacyProtectionService;
  
  // Configuration constants
  public static readonly MAX_RETRY_COUNT = 3;
  private static readonly RETRY_DELAYS = [1000, 5000, 15000]; // Exponential backoff in ms

  constructor(db: ReturnType<typeof drizzle<typeof schema>>, r2Bucket: R2Bucket, ai: Ai) {
    this.db = db;
    this.r2Bucket = r2Bucket;
    this.ocrService = createOCRService(ai);
    this.notaiParser = createNotaiParserService();
    this.productMatcher = createProductMatcher(db);
    this.errorHandlingService = createErrorHandlingService(db);
    this.privacyProtectionService = createPrivacyProtectionService(db, r2Bucket);
  }

  /**
   * Process receipt from queue message
   * Requirements: 2.1, 2.4, 2.5, 7.1, 7.2, 7.3
   */
  async processReceipt(job: ReceiptProcessingJobMessage): Promise<ProcessingResult> {
    const startTime = Date.now();
    const stats: ProcessingStatistics = {
      startTime,
      endTime: 0,
      processingTimeMs: 0,
      ocrTimeMs: 0,
      parsingTimeMs: 0,
      matchingTimeMs: 0,
      storageTimeMs: 0,
      retryCount: 0
    };

    // Create processing context for error handling
    const processingContext: ProcessingContext = {
      userId: job.userId,
      r2Key: job.r2Key,
      fileName: job.uploadMetadata.fileName,
      fileSize: job.uploadMetadata.fileSize,
      processingOptions: job.processingOptions,
      retryCount: 0
    };

    try {
      // Update job status to PROCESSING
      await this.updateProcessingStatus(job.jobId, ReceiptProcessingStatus.PROCESSING);

      // Step 1: Retrieve image from R2
      const imageBuffer = await this.retrieveImageFromR2(job.r2Key);
      if (!imageBuffer) {
        const errorId = await this.errorHandlingService.logProcessingError({
          jobId: job.jobId,
          tenantId: job.tenantId,
          category: ErrorCategory.UPLOAD,
          severity: ErrorSeverity.HIGH,
          stage: 'IMAGE_RETRIEVAL',
          code: 'R2_RETRIEVAL_FAILED',
          message: 'Failed to retrieve image from R2 storage',
          context: processingContext
        });
        throw new Error(`Failed to retrieve image from R2 storage (Error ID: ${errorId})`);
      }

      // Step 2: OCR Processing with privacy protection
      const ocrStartTime = Date.now();
      let ocrResult;
      try {
        ocrResult = await this.performOCR(imageBuffer, job.processingOptions.ocrModel);
        stats.ocrTimeMs = Date.now() - ocrStartTime;

        // Enforce in-memory-only OCR text processing (Requirements: 3.5, 8.1)
        await this.privacyProtectionService.enforceInMemoryOnlyProcessing(
          ocrResult.text, 
          {
            jobId: job.jobId,
            tenantId: job.tenantId,
            userId: job.userId,
            storeRawText: false, // Explicitly prevent raw text storage
            persistToFile: false // Explicitly prevent file persistence
          }
        );

      } catch (ocrError) {
        stats.ocrTimeMs = Date.now() - ocrStartTime;
        const errorId = await this.errorHandlingService.logProcessingError({
          jobId: job.jobId,
          tenantId: job.tenantId,
          category: ErrorCategory.OCR,
          severity: ErrorSeverity.HIGH,
          stage: 'OCR_PROCESSING',
          code: 'OCR_FAILED',
          message: ocrError instanceof Error ? ocrError.message : 'OCR processing failed',
          details: { ocrModel: job.processingOptions.ocrModel },
          context: { ...processingContext, processingTimeMs: stats.ocrTimeMs }
        });
        throw new Error(`OCR processing failed (Error ID: ${errorId}): ${ocrError instanceof Error ? ocrError.message : 'Unknown error'}`);
      }

      // Step 3: Heuristic Parsing using Notai adapter
      const parsingStartTime = Date.now();
      let parsedData;
      try {
        parsedData = await this.parseReceiptText(
          ocrResult.text, 
          job.processingOptions.parsingStrategy,
          ocrResult.coordinates
        );
        stats.parsingTimeMs = Date.now() - parsingStartTime;

        // Validate parsed data
        const validationResult = await this.errorHandlingService.validateReceiptData(
          parsedData, 
          { ...processingContext, ocrModel: job.processingOptions.ocrModel, parsingStrategy: job.processingOptions.parsingStrategy }
        );

        if (!validationResult.isValid) {
          // Log validation errors
          for (const error of validationResult.errors) {
            await this.errorHandlingService.logProcessingError({
              jobId: job.jobId,
              tenantId: job.tenantId,
              category: ErrorCategory.VALIDATION,
              severity: error.severity,
              stage: 'DATA_VALIDATION',
              code: error.code,
              message: error.message,
              details: { field: error.field, suggestedFix: error.suggestedFix },
              context: processingContext
            });
          }
        }

        if (validationResult.requiresManualReview) {
          await this.errorHandlingService.flagForManualReview({
            jobId: job.jobId,
            reason: validationResult.confidence < 0.3 ? ManualReviewReason.LOW_CONFIDENCE : ManualReviewReason.DATA_INCONSISTENCY,
            description: `Data validation requires manual review: ${validationResult.errors.length} errors, ${validationResult.warnings.length} warnings`,
            severity: validationResult.errors.length > 0 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
            flaggedBy: 'SYSTEM'
          });
        }

      } catch (parsingError) {
        stats.parsingTimeMs = Date.now() - parsingStartTime;
        const errorId = await this.errorHandlingService.logProcessingError({
          jobId: job.jobId,
          tenantId: job.tenantId,
          category: ErrorCategory.PARSING,
          severity: ErrorSeverity.HIGH,
          stage: 'TEXT_PARSING',
          code: 'PARSING_FAILED',
          message: parsingError instanceof Error ? parsingError.message : 'Receipt parsing failed',
          details: { parsingStrategy: job.processingOptions.parsingStrategy },
          context: { ...processingContext, processingTimeMs: stats.parsingTimeMs }
        });
        throw new Error(`Receipt parsing failed (Error ID: ${errorId}): ${parsingError instanceof Error ? parsingError.message : 'Unknown error'}`);
      }

      // Step 4: Product Matching
      const matchingStartTime = Date.now();
      let matchedData, matchResults;
      try {
        const matchingResult = await this.matchProducts(parsedData, job.tenantId, job.processingOptions.productMatchingThreshold);
        matchedData = matchingResult.matchedData;
        matchResults = matchingResult.matchResults;
        stats.matchingTimeMs = Date.now() - matchingStartTime;

        // Check for matching issues
        const unmatchedItems = matchedData.lineItems.filter(item => !item.matchedProductId);
        if (unmatchedItems.length > 0) {
          await this.errorHandlingService.flagForManualReview({
            jobId: job.jobId,
            reason: ManualReviewReason.NO_PRODUCT_MATCH,
            description: `${unmatchedItems.length} line items could not be matched to products`,
            severity: unmatchedItems.length > matchedData.lineItems.length / 2 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
            flaggedBy: 'SYSTEM'
          });
        }

      } catch (matchingError) {
        stats.matchingTimeMs = Date.now() - matchingStartTime;
        const errorId = await this.errorHandlingService.logProcessingError({
          jobId: job.jobId,
          tenantId: job.tenantId,
          category: ErrorCategory.MATCHING,
          severity: ErrorSeverity.MEDIUM,
          stage: 'PRODUCT_MATCHING',
          code: 'MATCHING_FAILED',
          message: matchingError instanceof Error ? matchingError.message : 'Product matching failed',
          details: { threshold: job.processingOptions.productMatchingThreshold },
          context: { ...processingContext, processingTimeMs: stats.matchingTimeMs }
        });
        
        // Continue with unmatched data
        matchedData = parsedData;
        matchResults = [];
        console.warn(`Product matching failed, continuing with unmatched data (Error ID: ${errorId})`);
      }

      // Step 5: Store processed data with tenant isolation validation
      const storageStartTime = Date.now();
      let receiptId;
      try {
        // Validate tenant isolation before storing (Requirements: 8.3)
        const tenantCheck = await this.privacyProtectionService.validateTenantIsolation(
          job.tenantId, 
          'r2_object', 
          job.r2Key
        );

        if (!tenantCheck.isValid) {
          throw new Error(`Tenant isolation violation: ${tenantCheck.violations.join(', ')}`);
        }

        receiptId = await this.storeReceiptData(job, matchedData);
        
        // Store product match candidates after receipt data is stored
        if (matchResults && matchResults.length > 0) {
          await this.storeProductMatchCandidates(matchResults, receiptId);
        }
        
        stats.storageTimeMs = Date.now() - storageStartTime;

      } catch (storageError) {
        stats.storageTimeMs = Date.now() - storageStartTime;
        const errorId = await this.errorHandlingService.logProcessingError({
          jobId: job.jobId,
          tenantId: job.tenantId,
          category: ErrorCategory.STORAGE,
          severity: ErrorSeverity.CRITICAL,
          stage: 'DATA_STORAGE',
          code: 'STORAGE_FAILED',
          message: storageError instanceof Error ? storageError.message : 'Database storage failed',
          context: { ...processingContext, processingTimeMs: stats.storageTimeMs }
        });
        throw new Error(`Database storage failed (Error ID: ${errorId}): ${storageError instanceof Error ? storageError.message : 'Unknown error'}`);
      }

      // Update job status to COMPLETED
      await this.updateProcessingStatus(job.jobId, ReceiptProcessingStatus.COMPLETED);

      stats.endTime = Date.now();
      stats.processingTimeMs = stats.endTime - stats.startTime;

      const requiresManualReview = matchedData.confidence.overall < 0.7 || job.processingOptions.requireManualReview;

      return {
        success: true,
        receiptData: matchedData,
        errors: [],
        processingStats: stats,
        requiresManualReview
      };

    } catch (error) {
      console.error('Receipt processing failed:', error);

      // Log the overall processing failure
      const errorId = await this.errorHandlingService.logProcessingError({
        jobId: job.jobId,
        tenantId: job.tenantId,
        category: this.categorizeError(error),
        severity: ErrorSeverity.HIGH,
        stage: 'PROCESSING',
        code: 'PROCESSING_FAILED',
        message: error instanceof Error ? error.message : 'Unknown processing error',
        details: { error },
        context: { ...processingContext, processingTimeMs: Date.now() - startTime }
      });

      const processingError: ProcessingError = {
        stage: this.determineErrorStage(error),
        code: 'PROCESSING_FAILED',
        message: error instanceof Error ? error.message : 'Unknown processing error',
        details: { errorId, error }
      };

      // Update job status to FAILED
      await this.updateProcessingStatus(
        job.jobId, 
        ReceiptProcessingStatus.FAILED, 
        `${processingError.message} (Error ID: ${errorId})`
      );

      stats.endTime = Date.now();
      stats.processingTimeMs = stats.endTime - stats.startTime;

      return {
        success: false,
        errors: [processingError],
        processingStats: stats,
        requiresManualReview: true
      };
    }
  }

  /**
   * Retry failed processing with exponential backoff
   * Requirements: 2.4, 2.5
   */
  async retryFailedProcessing(jobId: string, currentRetryCount: number): Promise<ProcessingResult> {
    try {
      // Check if retry count exceeds maximum
      if (currentRetryCount >= ReceiptProcessorWorker.MAX_RETRY_COUNT) {
        await this.updateProcessingStatus(
          jobId, 
          ReceiptProcessingStatus.FAILED, 
          `Maximum retry count (${ReceiptProcessorWorker.MAX_RETRY_COUNT}) exceeded`
        );
        
        return {
          success: false,
          errors: [{
            stage: 'PROCESSING',
            code: 'MAX_RETRIES_EXCEEDED',
            message: 'Maximum retry attempts exceeded'
          }],
          processingStats: {
            startTime: Date.now(),
            endTime: Date.now(),
            processingTimeMs: 0,
            ocrTimeMs: 0,
            parsingTimeMs: 0,
            matchingTimeMs: 0,
            storageTimeMs: 0,
            retryCount: currentRetryCount
          },
          requiresManualReview: true
        };
      }

      // Get job details from database
      const jobs = await this.db
        .select()
        .from(receiptProcessingJobs)
        .where(eq(receiptProcessingJobs.id, jobId))
        .limit(1);

      if (jobs.length === 0) {
        throw new Error('Processing job not found');
      }

      const job = jobs[0];
      if (!job) {
        throw new Error('Processing job data is invalid');
      }

      // Update retry count in database
      await this.db
        .update(receiptProcessingJobs)
        .set({ 
          retryCount: currentRetryCount + 1,
          status: ReceiptProcessingStatus.PROCESSING
        })
        .where(eq(receiptProcessingJobs.id, jobId));

      // Apply exponential backoff delay
      const delay = ReceiptProcessorWorker.RETRY_DELAYS[Math.min(currentRetryCount, ReceiptProcessorWorker.RETRY_DELAYS.length - 1)] || 1000;
      await this.sleep(delay);

      // Reconstruct job message for retry
      const processingOptions = job.processingOptions as any;
      const jobMessage: ReceiptProcessingJobMessage = {
        jobId: job.id,
        tenantId: job.tenantId,
        userId: job.userId,
        r2Key: job.r2Key,
        uploadMetadata: {
          fileName: 'retry-processing',
          fileSize: 0,
          contentType: 'image/jpeg'
        },
        processingOptions: processingOptions || {
          ocrModel: 'llama-vision',
          parsingStrategy: 'ADAPTIVE',
          productMatchingThreshold: 0.7,
          requireManualReview: false
        }
      };

      // Retry processing
      const result = await this.processReceipt(jobMessage);
      result.processingStats.retryCount = currentRetryCount + 1;

      return result;

    } catch (error) {
      console.error('Retry processing failed:', error);

      await this.updateProcessingStatus(
        jobId, 
        ReceiptProcessingStatus.FAILED, 
        `Retry failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      return {
        success: false,
        errors: [{
          stage: 'PROCESSING',
          code: 'RETRY_FAILED',
          message: error instanceof Error ? error.message : 'Retry processing failed'
        }],
        processingStats: {
          startTime: Date.now(),
          endTime: Date.now(),
          processingTimeMs: 0,
          ocrTimeMs: 0,
          parsingTimeMs: 0,
          matchingTimeMs: 0,
          storageTimeMs: 0,
          retryCount: currentRetryCount
        },
        requiresManualReview: true
      };
    }
  }

  /**
   * Update processing job status in database
   * Requirements: 2.3, 2.5
   */
  async updateProcessingStatus(
    jobId: string, 
    status: ReceiptProcessingStatusType, 
    errorMessage?: string
  ): Promise<void> {
    try {
      const now = Date.now();
      const updateData: any = {
        status,
        ...(errorMessage && { errorMessage })
      };

      // Set timestamps based on status
      if (status === ReceiptProcessingStatus.PROCESSING) {
        updateData.startedAt = now;
      } else if (status === ReceiptProcessingStatus.COMPLETED || status === ReceiptProcessingStatus.FAILED) {
        updateData.completedAt = now;
      }

      await this.db
        .update(receiptProcessingJobs)
        .set(updateData)
        .where(eq(receiptProcessingJobs.id, jobId));

    } catch (error) {
      console.error('Failed to update processing status:', error);
      // Don't throw here to avoid cascading failures
    }
  }

  /**
   * Retrieve image from R2 storage
   */
  private async retrieveImageFromR2(r2Key: string): Promise<ArrayBuffer | null> {
    try {
      const object = await this.r2Bucket.get(r2Key);
      if (!object) {
        return null;
      }
      return await object.arrayBuffer();
    } catch (error) {
      console.error('Failed to retrieve image from R2:', error);
      return null;
    }
  }

  /**
   * Perform OCR processing using Cloudflare Workers AI
   * Requirements: 3.1, 3.2
   */
  private async performOCR(imageBuffer: ArrayBuffer, ocrModel: string): Promise<{ 
    text: string; 
    confidence: number; 
    coordinates?: BoundingBox[] 
  }> {
    try {
      // Configure OCR options based on model preference
      const ocrOptions: OCROptions = {
        model: ocrModel === 'llama-vision' ? 'llama-vision' : 'resnet-ocr',
        language: 'en', // Default to English for receipts
        enhanceQuality: true, // Enable quality enhancement for better results
        extractCoordinates: true // Extract coordinates for better parsing
      };

      // Use OCR service with retry logic for better reliability
      const result = await this.ocrService.extractTextWithRetry(imageBuffer, ocrOptions, {
        maxRetries: 2, // Limit retries in processing pipeline
        baseDelayMs: 500,
        maxDelayMs: 2000,
        backoffMultiplier: 2
      });

      // Extract coordinates if available
      let coordinates: BoundingBox[] | undefined;
      if ('textBlocks' in result && result.textBlocks && Array.isArray(result.textBlocks)) {
        coordinates = result.textBlocks.map((block: any) => block.boundingBox);
      }

      return {
        text: result.text,
        confidence: result.confidence,
        ...(coordinates && { coordinates })
      };

    } catch (error) {
      console.error('OCR processing failed:', error);
      
      // Provide detailed error information for debugging
      const errorMessage = error instanceof Error ? error.message : 'Unknown OCR error';
      throw new Error(`OCR processing failed: ${errorMessage}`);
    }
  }

  /**
   * Parse receipt text using Notai adapter with error handling and confidence scoring
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
   */
  private async parseReceiptText(
    text: string, 
    strategy: string, 
    coordinates?: BoundingBox[]
  ): Promise<StructuredReceiptData> {
    try {
      // Map strategy string to ParsingStrategy type
      const parsingStrategy: ParsingStrategy = 
        strategy === 'AGGRESSIVE' ? 'AGGRESSIVE' :
        strategy === 'CONSERVATIVE' ? 'CONSERVATIVE' : 
        'ADAPTIVE';

      // Use Notai parser service for actual parsing
      const parseResult: NotaiParseResult = await this.notaiParser.parseReceiptText(
        text, 
        parsingStrategy, 
        coordinates
      );

      // Convert NotaiParseResult to StructuredReceiptData format
      return {
        vendor: parseResult.vendor,
        transactionDate: parseResult.transactionDate,
        totalAmount: parseResult.totalAmount,
        subtotal: parseResult.subtotal,
        tax: parseResult.tax,
        lineItems: parseResult.lineItems,
        confidence: parseResult.confidence,
        parsingMetadata: parseResult.parsingMetadata
      };

    } catch (error) {
      console.error('Receipt parsing failed:', error);
      
      // Return minimal result with error indication
      return {
        vendor: null,
        transactionDate: null,
        totalAmount: null,
        subtotal: null,
        tax: null,
        lineItems: [],
        confidence: {
          overall: 0.1,
          vendor: 0.0,
          date: 0.0,
          total: 0.0,
          lineItems: 0.0
        },
        parsingMetadata: {
          processingTime: 0,
          ocrModel: 'notai-adapted',
          parsingStrategy: strategy,
          textBlocks: 0,
          coordinatesAvailable: !!coordinates && coordinates.length > 0
        }
      };
    }
  }

  /**
   * Match products using ProductMatcher service
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
   */
  private async matchProducts(
    parsedData: StructuredReceiptData, 
    tenantId: string, 
    threshold: number
  ): Promise<{ matchedData: StructuredReceiptData; matchResults: any[] }> {
    try {
      // Get tenant's product catalog
      const productCatalog = await this.db
        .select()
        .from(products)
        .where(eq(products.tenantId, tenantId));

      if (productCatalog.length === 0 || parsedData.lineItems.length === 0) {
        // No products to match against or no line items to match
        return { matchedData: parsedData, matchResults: [] };
      }

      // Configure matching options
      const matchingOptions = {
        similarityThreshold: threshold,
        maxMatches: 5, // Return up to 5 matches per item
        useAliases: true,
        categoryHints: [] // Could be enhanced with category hints from receipt context
      };

      // Perform product matching
      const matchResults = await this.productMatcher.matchLineItems(
        parsedData.lineItems,
        productCatalog,
        matchingOptions
      );

      // Update line items with matching results
      const updatedLineItems = matchResults.map(result => {
        const lineItem = result.lineItem;
        const bestMatch = result.bestMatch;

        return {
          ...lineItem,
          // Update with matched product information if available
          ...(bestMatch && {
            matchedProductId: bestMatch.product.id,
            matchConfidence: bestMatch.confidence
          }),
          // Flag for manual review if confidence is low or no match found
          requiresManualReview: result.requiresManualReview
        };
      });

      // Return updated receipt data and match results for later storage
      const matchedData = {
        ...parsedData,
        lineItems: updatedLineItems
      };

      return { matchedData, matchResults };

    } catch (error) {
      console.error('Product matching failed:', error);
      
      // Return original data if matching fails
      return { matchedData: parsedData, matchResults: [] };
    }
  }

  /**
   * Store product match candidates for manual review
   */
  private async storeProductMatchCandidates(matchResults: any[], receiptId: string): Promise<void> {
    try {
      const now = Date.now();
      
      for (const result of matchResults) {
        // Only store candidates if there are multiple matches or low confidence
        if (result.matches.length > 1 || result.requiresManualReview) {
          // Get the line item ID from the stored receipt line items
          const lineItemQuery = await this.db
            .select({ id: receiptLineItems.id })
            .from(receiptLineItems)
            .where(and(
              eq(receiptLineItems.receiptId, receiptId),
              eq(receiptLineItems.description, result.lineItem.description)
            ))
            .limit(1);

          if (lineItemQuery.length > 0 && lineItemQuery[0]) {
            const lineItemId = lineItemQuery[0].id;
            
            for (const match of result.matches) {
              await this.db.insert(productMatchCandidates).values({
                id: generateId(),
                receiptLineItemId: lineItemId,
                productId: match.product.id,
                similarityScore: match.similarity,
                matchType: match.matchType,
                confidence: match.confidence,
                createdAt: now
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to store product match candidates:', error);
      // Don't throw here to avoid breaking the main processing flow
    }
  }

  /**
   * Store processed receipt data in database
   */
  private async storeReceiptData(job: ReceiptProcessingJobMessage, receiptData: StructuredReceiptData): Promise<string> {
    try {
      const now = Date.now();
      const receiptId = generateId();

      // Insert receipt record
      await this.db.insert(receipts).values({
        id: receiptId,
        tenantId: job.tenantId,
        processingJobId: job.jobId,
        r2Key: job.r2Key,
        vendorName: receiptData.vendor?.name || null,
        transactionDate: receiptData.transactionDate?.getTime() || null,
        totalAmountCents: receiptData.totalAmount || null,
        subtotalCents: receiptData.subtotal || null,
        taxCents: receiptData.tax || null,
        currency: 'USD',
        confidenceScore: receiptData.confidence.overall,
        requiresManualReview: receiptData.confidence.overall < 0.7,
        createdAt: now,
        updatedAt: now
      });

      // Insert line items
      for (const lineItem of receiptData.lineItems) {
        await this.db.insert(receiptLineItems).values({
          id: generateId(),
          receiptId,
          description: lineItem.description,
          quantity: lineItem.quantity,
          unitPriceCents: lineItem.unitPrice,
          totalPriceCents: lineItem.totalPrice,
          matchedProductId: lineItem.matchedProductId || null,
          matchConfidence: lineItem.matchConfidence || lineItem.confidence,
          requiresManualReview: lineItem.requiresManualReview || lineItem.confidence < 0.7,
          rawText: lineItem.rawText,
          coordinates: lineItem.coordinates ? JSON.stringify(lineItem.coordinates) : null,
          createdAt: now
        });
      }

      return receiptId;

    } catch (error) {
      console.error('Failed to store receipt data:', error);
      throw new Error('Database storage failed');
    }
  }

  /**
   * Categorize error for error handling service
   */
  private categorizeError(error: any): ErrorCategory {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
    
    if (errorMessage.includes('r2') || errorMessage.includes('upload')) {
      return ErrorCategory.UPLOAD;
    } else if (errorMessage.includes('ocr') || errorMessage.includes('vision')) {
      return ErrorCategory.OCR;
    } else if (errorMessage.includes('parsing') || errorMessage.includes('text')) {
      return ErrorCategory.PARSING;
    } else if (errorMessage.includes('matching') || errorMessage.includes('product')) {
      return ErrorCategory.MATCHING;
    } else if (errorMessage.includes('database') || errorMessage.includes('storage')) {
      return ErrorCategory.STORAGE;
    } else if (errorMessage.includes('validation')) {
      return ErrorCategory.VALIDATION;
    }
    
    return ErrorCategory.SYSTEM;
  }

  /**
   * Determine error stage based on error type
   */
  private determineErrorStage(error: any): ProcessingError['stage'] {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
    
    if (errorMessage.includes('ocr') || errorMessage.includes('vision')) {
      return 'OCR';
    } else if (errorMessage.includes('parsing') || errorMessage.includes('text')) {
      return 'PARSING';
    } else if (errorMessage.includes('matching') || errorMessage.includes('product')) {
      return 'MATCHING';
    } else if (errorMessage.includes('database') || errorMessage.includes('storage')) {
      return 'STORAGE';
    }
    
    return 'PROCESSING';
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Cloudflare Queue consumer handler
 * This function should be exported and used as the queue consumer in the worker
 */
export async function handleReceiptProcessingQueue(
  batch: MessageBatch<ReceiptProcessingJobMessage>,
  env: { DB: D1Database; RECEIPT_BUCKET: R2Bucket; AI: Ai }
): Promise<void> {
  const db = drizzle(env.DB, { schema });
  const processor = new ReceiptProcessorWorker(db, env.RECEIPT_BUCKET, env.AI);

  for (const message of batch.messages) {
    try {
      console.log(`Processing receipt job: ${message.body.jobId}`);
      
      const result = await processor.processReceipt(message.body);
      
      if (result.success) {
        console.log(`Receipt processing completed successfully: ${message.body.jobId}`);
        message.ack();
      } else {
        console.error(`Receipt processing failed: ${message.body.jobId}`, result.errors);
        
        // Determine if we should retry
        const currentJob = await db
          .select()
          .from(receiptProcessingJobs)
          .where(eq(receiptProcessingJobs.id, message.body.jobId))
          .limit(1);

        if (currentJob.length > 0 && currentJob[0] && (currentJob[0].retryCount || 0) < ReceiptProcessorWorker.MAX_RETRY_COUNT) {
          // Retry the job
          const retryCount = currentJob[0].retryCount || 0;
          await processor.retryFailedProcessing(message.body.jobId, retryCount);
          message.retry();
        } else {
          // Max retries exceeded, acknowledge to remove from queue
          message.ack();
        }
      }
    } catch (error) {
      console.error(`Queue message processing error: ${message.body.jobId}`, error);
      
      // Update job status to failed
      await processor.updateProcessingStatus(
        message.body.jobId,
        ReceiptProcessingStatus.FAILED,
        `Queue processing error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      
      message.ack(); // Remove from queue to prevent infinite retries
    }
  }
}

/**
 * Factory function to create ReceiptProcessorWorker instance
 */
export function createReceiptProcessorWorker(
  db: ReturnType<typeof drizzle<typeof schema>>, 
  r2Bucket: R2Bucket,
  ai: Ai
): IReceiptProcessorWorker {
  return new ReceiptProcessorWorker(db, r2Bucket, ai);
}