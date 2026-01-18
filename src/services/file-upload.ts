import { z } from 'zod';

// File upload configuration
export interface FileUploadConfig {
  maxFileSize: number; // in bytes
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  virusScanEnabled: boolean;
  storageProvider: 'r2' | 's3' | 'local' | 'mock';
  storageBucket?: string;
  storagePrefix?: string;
  compressionEnabled: boolean;
  thumbnailGeneration: boolean;
}

// File upload result
export interface FileUploadResult {
  success: boolean;
  fileId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  virusScanResult?: {
    clean: boolean;
    threats?: string[];
    scanDate: Date;
  };
  metadata: {
    uploadedBy: string;
    uploadedAt: Date;
    tenantId: string;
    checksum: string;
  };
  error?: string;
}

// File validation result
export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Virus scan result
export interface VirusScanResult {
  clean: boolean;
  threats: string[];
  scanDate: Date;
  scanEngine: string;
  scanVersion: string;
}

// File upload service
export class FileUploadService {
  private config: FileUploadConfig;
  private quarantineFiles: Set<string> = new Set();

  constructor(config: FileUploadConfig) {
    this.config = config;
  }

  /**
   * Upload single file with validation and virus scanning
   */
  async uploadFile(
    file: File | ArrayBuffer,
    metadata: {
      originalName: string;
      mimeType: string;
      uploadedBy: string;
      tenantId: string;
    }
  ): Promise<FileUploadResult> {
    try {
      const fileId = crypto.randomUUID();
      const fileBuffer = file instanceof File ? await file.arrayBuffer() : file;
      const size = fileBuffer.byteLength;

      // Validate file
      const validation = await this.validateFile({
        name: metadata.originalName,
        mimeType: metadata.mimeType,
        size,
        buffer: fileBuffer,
      });

      if (!validation.valid) {
        return {
          success: false,
          fileId,
          filename: '',
          originalName: metadata.originalName,
          mimeType: metadata.mimeType,
          size,
          url: '',
          metadata: {
            uploadedBy: metadata.uploadedBy,
            uploadedAt: new Date(),
            tenantId: metadata.tenantId,
            checksum: '',
          },
          error: validation.errors.join(', '),
        };
      }

      // Generate checksum
      const checksum = await this.generateChecksum(fileBuffer);

      // Virus scan if enabled
      let virusScanResult: VirusScanResult | undefined;
      if (this.config.virusScanEnabled) {
        virusScanResult = await this.scanForViruses(fileBuffer, metadata.originalName);
        
        if (!virusScanResult.clean) {
          // Quarantine the file
          this.quarantineFiles.add(fileId);
          
          return {
            success: false,
            fileId,
            filename: '',
            originalName: metadata.originalName,
            mimeType: metadata.mimeType,
            size,
            url: '',
            virusScanResult: {
              clean: virusScanResult.clean,
              threats: virusScanResult.threats,
              scanDate: virusScanResult.scanDate,
            },
            metadata: {
              uploadedBy: metadata.uploadedBy,
              uploadedAt: new Date(),
              tenantId: metadata.tenantId,
              checksum,
            },
            error: `Virus detected: ${virusScanResult.threats.join(', ')}`,
          };
        }
      }

      // Generate filename
      const extension = this.getFileExtension(metadata.originalName);
      const filename = `${fileId}${extension}`;

      // Compress if enabled and applicable
      let processedBuffer = fileBuffer;
      if (this.config.compressionEnabled && this.shouldCompress(metadata.mimeType)) {
        processedBuffer = await this.compressFile(fileBuffer, metadata.mimeType);
      }

      // Upload to storage
      const url = await this.uploadToStorage(filename, processedBuffer, metadata);

      // Generate thumbnail if enabled and applicable
      let thumbnailUrl: string | undefined;
      if (this.config.thumbnailGeneration && this.isImageFile(metadata.mimeType)) {
        thumbnailUrl = await this.generateThumbnail(fileBuffer, filename, metadata);
      }

      return {
        success: true,
        fileId,
        filename,
        originalName: metadata.originalName,
        mimeType: metadata.mimeType,
        size: processedBuffer.byteLength,
        url,
        thumbnailUrl,
        virusScanResult: virusScanResult ? {
          clean: virusScanResult.clean,
          threats: virusScanResult.threats,
          scanDate: virusScanResult.scanDate,
        } : undefined,
        metadata: {
          uploadedBy: metadata.uploadedBy,
          uploadedAt: new Date(),
          tenantId: metadata.tenantId,
          checksum,
        },
      };
    } catch (error) {
      console.error('File upload error:', error);
      return {
        success: false,
        fileId: crypto.randomUUID(),
        filename: '',
        originalName: metadata.originalName,
        mimeType: metadata.mimeType,
        size: 0,
        url: '',
        metadata: {
          uploadedBy: metadata.uploadedBy,
          uploadedAt: new Date(),
          tenantId: metadata.tenantId,
          checksum: '',
        },
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Upload multiple files
   */
  async uploadMultipleFiles(
    files: Array<{
      file: File | ArrayBuffer;
      metadata: {
        originalName: string;
        mimeType: string;
        uploadedBy: string;
        tenantId: string;
      };
    }>
  ): Promise<{
    results: FileUploadResult[];
    summary: {
      total: number;
      successful: number;
      failed: number;
      quarantined: number;
    };
  }> {
    const results: FileUploadResult[] = [];
    let successful = 0;
    let failed = 0;
    let quarantined = 0;

    for (const { file, metadata } of files) {
      const result = await this.uploadFile(file, metadata);
      results.push(result);

      if (result.success) {
        successful++;
      } else {
        failed++;
        if (result.virusScanResult && !result.virusScanResult.clean) {
          quarantined++;
        }
      }
    }

    return {
      results,
      summary: {
        total: files.length,
        successful,
        failed,
        quarantined,
      },
    };
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string, tenantId: string): Promise<boolean> {
    try {
      // Remove from quarantine if present
      this.quarantineFiles.delete(fileId);

      // Delete from storage
      return await this.deleteFromStorage(fileId, tenantId);
    } catch (error) {
      console.error('File deletion error:', error);
      return false;
    }
  }

  /**
   * Get file info
   */
  async getFileInfo(fileId: string, tenantId: string): Promise<FileUploadResult | null> {
    try {
      // Mock implementation - in real app would query database
      return null;
    } catch (error) {
      console.error('Get file info error:', error);
      return null;
    }
  }

  /**
   * Get quarantined files
   */
  getQuarantinedFiles(): string[] {
    return Array.from(this.quarantineFiles);
  }

  /**
   * Release file from quarantine (admin only)
   */
  async releaseFromQuarantine(fileId: string, adminUserId: string): Promise<boolean> {
    try {
      if (!this.quarantineFiles.has(fileId)) {
        return false;
      }

      // Log the release action
      console.log(`File ${fileId} released from quarantine by admin ${adminUserId}`);
      
      this.quarantineFiles.delete(fileId);
      return true;
    } catch (error) {
      console.error('Release from quarantine error:', error);
      return false;
    }
  }

  /**
   * Validate file before upload
   */
  private async validateFile(file: {
    name: string;
    mimeType: string;
    size: number;
    buffer: ArrayBuffer;
  }): Promise<FileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file size
    if (file.size > this.config.maxFileSize) {
      errors.push(`File size ${file.size} bytes exceeds maximum allowed size of ${this.config.maxFileSize} bytes`);
    }

    // Check MIME type
    if (!this.config.allowedMimeTypes.includes(file.mimeType)) {
      errors.push(`MIME type ${file.mimeType} is not allowed`);
    }

    // Check file extension
    const extension = this.getFileExtension(file.name).toLowerCase();
    if (!this.config.allowedExtensions.includes(extension)) {
      errors.push(`File extension ${extension} is not allowed`);
    }

    // Check for suspicious file patterns
    const suspiciousPatterns = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
    if (suspiciousPatterns.some(pattern => file.name.toLowerCase().includes(pattern))) {
      warnings.push('File contains potentially suspicious patterns');
    }

    // Validate file header (magic bytes)
    const headerValidation = await this.validateFileHeader(file.buffer, file.mimeType);
    if (!headerValidation.valid) {
      errors.push('File header does not match declared MIME type');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate file header against MIME type
   */
  private async validateFileHeader(buffer: ArrayBuffer, mimeType: string): Promise<{ valid: boolean }> {
    const bytes = new Uint8Array(buffer.slice(0, 16));
    
    // Common file signatures
    const signatures: Record<string, number[][]> = {
      'image/jpeg': [[0xFF, 0xD8, 0xFF]],
      'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
      'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
      'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
      'application/zip': [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06], [0x50, 0x4B, 0x07, 0x08]],
    };

    const expectedSignatures = signatures[mimeType];
    if (!expectedSignatures) {
      // No signature validation for this MIME type
      return { valid: true };
    }

    // Check if any expected signature matches
    for (const signature of expectedSignatures) {
      let matches = true;
      for (let i = 0; i < signature.length; i++) {
        if (bytes[i] !== signature[i]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return { valid: true };
      }
    }

    return { valid: false };
  }

  /**
   * Scan file for viruses (mock implementation)
   */
  private async scanForViruses(buffer: ArrayBuffer, filename: string): Promise<VirusScanResult> {
    // Mock virus scanning - in real implementation would use ClamAV or similar
    const suspiciousPatterns = ['virus', 'malware', 'trojan', 'worm'];
    const threats: string[] = [];

    // Simple pattern matching (mock)
    const content = new TextDecoder().decode(buffer.slice(0, 1024));
    for (const pattern of suspiciousPatterns) {
      if (content.toLowerCase().includes(pattern)) {
        threats.push(`Suspicious pattern detected: ${pattern}`);
      }
    }

    // Check filename for suspicious patterns
    if (filename.toLowerCase().includes('virus') || filename.toLowerCase().includes('malware')) {
      threats.push('Suspicious filename detected');
    }

    return {
      clean: threats.length === 0,
      threats,
      scanDate: new Date(),
      scanEngine: 'MockAV',
      scanVersion: '1.0.0',
    };
  }

  /**
   * Generate file checksum
   */
  private async generateChecksum(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Get file extension
   */
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot === -1 ? '' : filename.substring(lastDot);
  }

  /**
   * Check if file should be compressed
   */
  private shouldCompress(mimeType: string): boolean {
    const compressibleTypes = [
      'text/',
      'application/json',
      'application/xml',
      'application/javascript',
      'application/css',
    ];
    
    return compressibleTypes.some(type => mimeType.startsWith(type));
  }

  /**
   * Check if file is an image
   */
  private isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  /**
   * Compress file (mock implementation)
   */
  private async compressFile(buffer: ArrayBuffer, mimeType: string): Promise<ArrayBuffer> {
    // Mock compression - in real implementation would use compression library
    console.log(`Compressing file of type ${mimeType}`);
    return buffer; // Return original for now
  }

  /**
   * Generate thumbnail (mock implementation)
   */
  private async generateThumbnail(
    buffer: ArrayBuffer,
    filename: string,
    metadata: { tenantId: string }
  ): Promise<string> {
    // Mock thumbnail generation - in real implementation would use image processing library
    const thumbnailFilename = `thumb_${filename}`;
    console.log(`Generated thumbnail: ${thumbnailFilename}`);
    return `https://storage.example.com/${metadata.tenantId}/thumbnails/${thumbnailFilename}`;
  }

  /**
   * Upload to storage provider
   */
  private async uploadToStorage(
    filename: string,
    buffer: ArrayBuffer,
    metadata: { tenantId: string; mimeType: string }
  ): Promise<string> {
    const path = `${this.config.storagePrefix || ''}${metadata.tenantId}/${filename}`;

    switch (this.config.storageProvider) {
      case 'mock':
        console.log(`Mock upload: ${path} (${buffer.byteLength} bytes)`);
        return `https://storage.example.com/${path}`;

      case 'r2':
        return await this.uploadToR2(path, buffer, metadata.mimeType);

      case 's3':
        return await this.uploadToS3(path, buffer, metadata.mimeType);

      case 'local':
        return await this.uploadToLocal(path, buffer);

      default:
        throw new Error(`Unknown storage provider: ${this.config.storageProvider}`);
    }
  }

  /**
   * Upload to Cloudflare R2 (mock implementation)
   */
  private async uploadToR2(path: string, buffer: ArrayBuffer, mimeType: string): Promise<string> {
    // Mock R2 upload - in real implementation would use R2 API
    console.log(`R2 upload: ${path} (${mimeType})`);
    return `https://r2.example.com/${this.config.storageBucket}/${path}`;
  }

  /**
   * Upload to AWS S3 (mock implementation)
   */
  private async uploadToS3(path: string, buffer: ArrayBuffer, mimeType: string): Promise<string> {
    // Mock S3 upload - in real implementation would use AWS SDK
    console.log(`S3 upload: ${path} (${mimeType})`);
    return `https://s3.amazonaws.com/${this.config.storageBucket}/${path}`;
  }

  /**
   * Upload to local storage (mock implementation)
   */
  private async uploadToLocal(path: string, buffer: ArrayBuffer): Promise<string> {
    // Mock local upload - in real implementation would write to filesystem
    console.log(`Local upload: ${path}`);
    return `file://uploads/${path}`;
  }

  /**
   * Delete from storage
   */
  private async deleteFromStorage(fileId: string, tenantId: string): Promise<boolean> {
    try {
      const path = `${this.config.storagePrefix || ''}${tenantId}/${fileId}`;
      console.log(`Deleting file: ${path}`);
      return true; // Mock success
    } catch (error) {
      console.error('Storage deletion error:', error);
      return false;
    }
  }
}

// Default file upload configuration
export const defaultFileUploadConfig: FileUploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/json',
  ],
  allowedExtensions: [
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.pdf', '.csv', '.xls', '.xlsx', '.txt', '.json',
  ],
  virusScanEnabled: true,
  storageProvider: 'mock',
  compressionEnabled: true,
  thumbnailGeneration: true,
};

// Create file upload service
export function createFileUploadService(config?: Partial<FileUploadConfig>): FileUploadService {
  return new FileUploadService({ ...defaultFileUploadConfig, ...config });
}

// File upload middleware for Hono
export function fileUploadMiddleware(config?: Partial<FileUploadConfig>) {
  const uploadService = createFileUploadService(config);

  return async (c: any, next: any) => {
    c.set('fileUploadService', uploadService);
    await next();
  };
}