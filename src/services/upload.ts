/**
 * Upload Service for Receipt Scanning System
 * 
 * Manages secure receipt image uploads with R2 presigned URLs, file validation,
 * and upload confirmation. Implements requirements 1.1, 1.2, 1.3, 1.4.
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { receiptProcessingJobs, ReceiptProcessingStatus } from '../db/schema';
import { generateId } from '../utils';

// Upload service interfaces
export interface UploadURLResponse {
  uploadUrl: string;
  uploadId: string;
  expiresAt: Date;
  maxFileSize: number;
  allowedTypes: string[];
}

export interface UploadMetadata {
  fileName: string;
  fileSize: number;
  contentType: string;
  checksum?: string;
}

export interface UploadConfirmation {
  uploadId: string;
  r2Key: string;
  processingJobId: string;
  estimatedProcessingTime: number;
}

export interface UploadStatus {
  uploadId: string;
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  r2Key?: string;
  processingJobId?: string;
  errorMessage?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ProcessingOptions {
  ocrModel?: string | undefined;
  parsingStrategy?: 'AGGRESSIVE' | 'CONSERVATIVE' | 'ADAPTIVE' | undefined;
  productMatchingThreshold?: number | undefined;
  requireManualReview?: boolean | undefined;
}

// Upload service implementation
export interface IUploadService {
  generateUploadURL(tenantId: string, userId: string): Promise<UploadURLResponse>;
  validateImageFile(file: File): ValidationResult;
  confirmUpload(uploadId: string, metadata: UploadMetadata, options?: ProcessingOptions): Promise<UploadConfirmation>;
  getUploadStatus(uploadId: string): Promise<UploadStatus | null>;
}

export class UploadService implements IUploadService {
  private db: ReturnType<typeof drizzle>;
  private r2Bucket: R2Bucket;
  private uploadQueue: Queue;
  private uploadMappings: Map<string, { r2Key: string; tenantId: string; userId: string }> = new Map();

  // Configuration constants
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly ALLOWED_TYPES = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ];
  private static readonly PRESIGNED_URL_EXPIRY = 15 * 60; // 15 minutes
  private static readonly ESTIMATED_PROCESSING_TIME = 30; // 30 seconds

  constructor(db: ReturnType<typeof drizzle>, r2Bucket: R2Bucket, uploadQueue: Queue) {
    this.db = db;
    this.r2Bucket = r2Bucket;
    this.uploadQueue = uploadQueue;
  }

  /**
   * Generate presigned URL for secure receipt image upload
   * Requirements: 1.1, 1.2
   */
  async generateUploadURL(tenantId: string, userId: string): Promise<UploadURLResponse> {
    try {
      // Generate unique upload ID and R2 key
      const uploadId = generateId();
      const r2Key = `receipts/${tenantId}/${userId}/${uploadId}`;

      // Store the mapping for later retrieval
      this.storeUploadMapping(uploadId, r2Key, tenantId, userId);

      // Generate presigned URL for PUT operation
      // Note: R2 presigned URLs need to be generated using the R2 REST API
      // For now, we'll create a placeholder URL structure
      const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/{account_id}/r2/buckets/{bucket_name}/objects/${r2Key}?X-Amz-Expires=${UploadService.PRESIGNED_URL_EXPIRY}`;

      const expiresAt = new Date(Date.now() + (UploadService.PRESIGNED_URL_EXPIRY * 1000));

      return {
        uploadUrl,
        uploadId,
        expiresAt,
        maxFileSize: UploadService.MAX_FILE_SIZE,
        allowedTypes: [...UploadService.ALLOWED_TYPES]
      };

    } catch (error) {
      console.error('Failed to generate upload URL:', error);
      throw new Error('Failed to generate secure upload URL');
    }
  }

  /**
   * Validate image file type, size, and format
   * Requirements: 1.2, 1.3
   */
  validateImageFile(file: File): ValidationResult {
    const errors: string[] = [];

    // Validate file size
    if (file.size > UploadService.MAX_FILE_SIZE) {
      errors.push(`File size ${Math.round(file.size / 1024 / 1024)}MB exceeds maximum allowed size of ${UploadService.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    if (file.size === 0) {
      errors.push('File is empty');
    }

    // Validate file type
    if (!UploadService.ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      errors.push(`File type ${file.type} is not supported. Allowed types: ${UploadService.ALLOWED_TYPES.join(', ')}`);
    }

    // Validate file name
    if (!file.name || file.name.trim().length === 0) {
      errors.push('File name is required');
    }

    // Check for potentially malicious file extensions
    const fileName = file.name.toLowerCase();
    const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.com', '.pif', '.js', '.vbs'];
    if (suspiciousExtensions.some(ext => fileName.endsWith(ext))) {
      errors.push('File type not allowed for security reasons');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Confirm upload completion and trigger processing
   * Requirements: 1.4, 2.1
   */
  async confirmUpload(
    uploadId: string, 
    metadata: UploadMetadata, 
    options: ProcessingOptions = {}
  ): Promise<UploadConfirmation> {
    try {
      // Validate metadata
      const validationResult = this.validateUploadMetadata(metadata);
      if (!validationResult.isValid) {
        throw new Error(`Upload validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Get R2 key and tenant/user info from stored mapping
      const mapping = this.uploadMappings.get(uploadId);
      if (!mapping) {
        throw new Error('Upload ID not found or expired');
      }

      const { r2Key, tenantId, userId } = mapping;

      // Verify file exists in R2
      const headResult = await this.r2Bucket.head(r2Key);
      if (!headResult) {
        throw new Error('Upload not found in storage');
      }

      // Verify file size matches metadata
      if (headResult.size !== metadata.fileSize) {
        throw new Error(`File size mismatch: expected ${metadata.fileSize}, got ${headResult.size}`);
      }

      // Create processing job record
      const processingJobId = generateId();
      const now = Date.now();

      const processingOptionsJson = {
        ocrModel: options.ocrModel || 'llama-vision',
        parsingStrategy: options.parsingStrategy || 'ADAPTIVE',
        productMatchingThreshold: options.productMatchingThreshold || 0.7,
        requireManualReview: options.requireManualReview || false
      };

      await this.db.insert(receiptProcessingJobs).values({
        id: processingJobId,
        tenantId,
        userId,
        r2Key,
        status: ReceiptProcessingStatus.PENDING,
        processingOptions: processingOptionsJson,
        createdAt: now,
        retryCount: 0
      });

      // Queue processing job
      await this.uploadQueue.send({
        jobId: processingJobId,
        tenantId,
        userId,
        r2Key,
        uploadMetadata: metadata,
        processingOptions: processingOptionsJson
      });

      // Clean up mapping after successful confirmation
      this.uploadMappings.delete(uploadId);

      return {
        uploadId,
        r2Key,
        processingJobId,
        estimatedProcessingTime: UploadService.ESTIMATED_PROCESSING_TIME
      };

    } catch (error) {
      console.error('Failed to confirm upload:', error);
      throw new Error(`Upload confirmation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get upload and processing status
   * Requirements: 1.4, 2.3
   */
  async getUploadStatus(uploadId: string): Promise<UploadStatus | null> {
    try {
      const r2Key = this.extractR2KeyFromUploadId(uploadId);
      
      // Find processing job by R2 key
      const jobs = await this.db
        .select()
        .from(receiptProcessingJobs)
        .where(eq(receiptProcessingJobs.r2Key, r2Key))
        .limit(1);

      if (jobs.length === 0) {
        // Check if upload exists in R2 but no processing job yet
        const headResult = await this.r2Bucket.head(r2Key);
        if (headResult) {
          return {
            uploadId,
            status: 'CONFIRMED',
            r2Key,
            createdAt: new Date(headResult.uploaded || Date.now()),
            updatedAt: new Date(headResult.uploaded || Date.now())
          };
        }
        return null;
      }

      const job = jobs[0];
      if (!job) {
        return null;
      }
      
      // Map processing status to upload status
      let status: UploadStatus['status'];
      switch (job.status) {
        case ReceiptProcessingStatus.PENDING:
          status = 'PENDING';
          break;
        case ReceiptProcessingStatus.PROCESSING:
          status = 'PROCESSING';
          break;
        case ReceiptProcessingStatus.COMPLETED:
          status = 'COMPLETED';
          break;
        case ReceiptProcessingStatus.FAILED:
        case ReceiptProcessingStatus.REQUIRES_REVIEW:
          status = 'FAILED';
          break;
        default:
          status = 'PENDING';
      }

      return {
        uploadId,
        status,
        r2Key: job.r2Key,
        processingJobId: job.id,
        errorMessage: job.errorMessage || undefined,
        createdAt: new Date(job.createdAt),
        updatedAt: new Date(job.createdAt) // Use createdAt as updatedAt for now
      };

    } catch (error) {
      console.error('Failed to get upload status:', error);
      return null;
    }
  }

  /**
   * Validate upload metadata
   */
  private validateUploadMetadata(metadata: UploadMetadata): ValidationResult {
    const errors: string[] = [];

    if (!metadata.fileName || metadata.fileName.trim().length === 0) {
      errors.push('File name is required');
    }

    if (!metadata.contentType || !UploadService.ALLOWED_TYPES.includes(metadata.contentType.toLowerCase())) {
      errors.push(`Invalid content type: ${metadata.contentType}`);
    }

    if (!metadata.fileSize || metadata.fileSize <= 0) {
      errors.push('File size must be greater than 0');
    }

    if (metadata.fileSize > UploadService.MAX_FILE_SIZE) {
      errors.push(`File size exceeds maximum allowed size of ${UploadService.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Extract R2 key from upload ID using stored mapping
   */
  private extractR2KeyFromUploadId(uploadId: string): string {
    const mapping = this.uploadMappings.get(uploadId);
    if (!mapping) {
      throw new Error('Upload ID not found or expired');
    }
    return mapping.r2Key;
  }

  /**
   * Store upload ID to R2 key mapping
   */
  private storeUploadMapping(uploadId: string, r2Key: string, tenantId: string, userId: string): void {
    this.uploadMappings.set(uploadId, { r2Key, tenantId, userId });
    
    // Clean up expired mappings after expiry time
    setTimeout(() => {
      this.uploadMappings.delete(uploadId);
    }, (UploadService.PRESIGNED_URL_EXPIRY + 300) * 1000); // Add 5 minutes buffer
  }

  /**
   * Parse tenant and user IDs from R2 key
   */
  private parseR2Key(r2Key: string): { tenantId: string; userId: string } {
    // Expected format: receipts/{tenantId}/{userId}/{uploadId}
    const parts = r2Key.split('/');
    if (parts.length !== 4 || parts[0] !== 'receipts') {
      throw new Error('Invalid R2 key format');
    }

    const tenantId = parts[1];
    const userId = parts[2];
    
    if (!tenantId || !userId) {
      throw new Error('Invalid R2 key format - missing tenant or user ID');
    }

    return {
      tenantId,
      userId
    };
  }
}

/**
 * Factory function to create UploadService instance
 */
export function createUploadService(
  db: ReturnType<typeof drizzle>, 
  r2Bucket: R2Bucket, 
  uploadQueue: Queue
): IUploadService {
  return new UploadService(db, r2Bucket, uploadQueue);
}