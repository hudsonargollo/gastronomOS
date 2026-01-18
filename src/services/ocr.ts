/**
 * OCR Service for Receipt Processing
 * 
 * Integrates with Cloudflare Workers AI vision models for text extraction
 * from receipt images. Provides text extraction with bounding box coordinates
 * and handles various image formats with preprocessing.
 * 
 * Requirements: 3.1, 3.2, 3.4
 */

// Cloudflare Workers AI type (from @cloudflare/workers-types)
declare global {
  interface Ai {
    run(model: string, input: any): Promise<any>;
  }
}

// OCR interfaces matching the design document
export interface OCROptions {
  model: 'llama-vision' | 'resnet-ocr';
  language: string;
  enhanceQuality: boolean;
  extractCoordinates: boolean;
}

export interface OCRResult {
  text: string;
  confidence: number;
  processingTime: number;
  model: string;
}

export interface OCRResultWithCoordinates extends OCRResult {
  textBlocks: TextBlock[];
  boundingBoxes: BoundingBox[];
}

export interface TextBlock {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Cloudflare Workers AI response interfaces
interface WorkersAIVisionResponse {
  result: {
    text: string;
    confidence?: number;
    blocks?: Array<{
      text: string;
      confidence: number;
      bbox?: [number, number, number, number]; // [x, y, width, height]
    }>;
  };
  success: boolean;
  errors?: string[];
  messages?: string[];
}

// OCR error types
export interface OCRError {
  code: string;
  message: string;
  retryable: boolean;
  details?: any;
}

export interface OCRRetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface OCRPerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
  averageConfidence: number;
  errorsByType: Record<string, number>;
}

// OCR Service implementation
export interface IOCRService {
  extractText(imageBuffer: ArrayBuffer, options: OCROptions): Promise<OCRResult>;
  extractTextWithCoordinates(imageBuffer: ArrayBuffer): Promise<OCRResultWithCoordinates>;
  validateImageFormat(buffer: ArrayBuffer): boolean;
  extractTextWithRetry(imageBuffer: ArrayBuffer, options: OCROptions, retryOptions?: OCRRetryOptions): Promise<OCRResult>;
  getPerformanceMetrics(): OCRPerformanceMetrics;
  resetPerformanceMetrics(): void;
}

export class OCRService implements IOCRService {
  private ai: Ai;
  private performanceMetrics: OCRPerformanceMetrics;
  
  // Supported image formats and their magic bytes
  private static readonly SUPPORTED_FORMATS = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header for WebP
    'image/bmp': [0x42, 0x4D], // BM header for BMP
    'image/tiff': [0x49, 0x49, 0x2A, 0x00], // TIFF little-endian
  };

  // Maximum file size (10MB)
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024;

  // Default retry configuration
  private static readonly DEFAULT_RETRY_OPTIONS: OCRRetryOptions = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2
  };

  // OCR error codes
  private static readonly ERROR_CODES = {
    UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
    FILE_TOO_LARGE: 'FILE_TOO_LARGE',
    AI_MODEL_ERROR: 'AI_MODEL_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    INVALID_RESPONSE: 'INVALID_RESPONSE',
    PROCESSING_TIMEOUT: 'PROCESSING_TIMEOUT',
    QUALITY_TOO_LOW: 'QUALITY_TOO_LOW'
  };

  constructor(ai: Ai) {
    this.ai = ai;
    this.performanceMetrics = this.initializeMetrics();
  }

  /**
   * Extract text from image using Cloudflare Workers AI
   * Requirements: 3.1, 3.2
   */
  async extractText(imageBuffer: ArrayBuffer, options: OCROptions): Promise<OCRResult> {
    const startTime = Date.now();
    this.performanceMetrics.totalRequests++;

    try {
      // Validate image format and size
      this.validateImageInput(imageBuffer);

      // Preprocess image if quality enhancement is requested
      const processedBuffer = options.enhanceQuality 
        ? await this.enhanceImageQuality(imageBuffer)
        : imageBuffer;

      // Call Cloudflare Workers AI vision model
      const response = await this.callWorkersAI(processedBuffer, options.model);

      if (!response.success || !response.result) {
        throw this.createOCRError(
          OCRService.ERROR_CODES.AI_MODEL_ERROR,
          `OCR processing failed: ${response.errors?.join(', ') || 'Unknown error'}`,
          true,
          { response }
        );
      }

      const processingTime = Date.now() - startTime;
      const confidence = response.result.confidence || 0.8;

      // Check if confidence is too low
      if (confidence < 0.3) {
        throw this.createOCRError(
          OCRService.ERROR_CODES.QUALITY_TOO_LOW,
          `OCR confidence too low: ${confidence}`,
          true,
          { confidence }
        );
      }

      // Update performance metrics
      this.performanceMetrics.successfulRequests++;
      this.updateAverageProcessingTime(processingTime);
      this.updateAverageConfidence(confidence);

      return {
        text: response.result.text || '',
        confidence,
        processingTime,
        model: options.model
      };

    } catch (error) {
      this.performanceMetrics.failedRequests++;
      
      if (error && typeof error === 'object' && 'code' in error && 'retryable' in error) {
        const ocrError = error as OCRError;
        this.performanceMetrics.errorsByType[ocrError.code] = 
          (this.performanceMetrics.errorsByType[ocrError.code] || 0) + 1;
        throw error;
      }

      const ocrError = this.createOCRError(
        OCRService.ERROR_CODES.AI_MODEL_ERROR,
        `OCR extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        false,
        { originalError: error }
      );

      this.performanceMetrics.errorsByType[ocrError.code] = 
        (this.performanceMetrics.errorsByType[ocrError.code] || 0) + 1;

      throw ocrError;
    }
  }

  /**
   * Extract text with bounding box coordinates
   * Requirements: 3.2, 3.4
   */
  async extractTextWithCoordinates(imageBuffer: ArrayBuffer): Promise<OCRResultWithCoordinates> {
    const startTime = Date.now();
    this.performanceMetrics.totalRequests++;

    try {
      // Validate image format and size
      this.validateImageInput(imageBuffer);

      // Use llama-vision model for coordinate extraction (best for structured text)
      const response = await this.callWorkersAI(imageBuffer, 'llama-vision');

      if (!response.success || !response.result) {
        throw this.createOCRError(
          OCRService.ERROR_CODES.AI_MODEL_ERROR,
          `OCR processing failed: ${response.errors?.join(', ') || 'Unknown error'}`,
          true,
          { response }
        );
      }

      const processingTime = Date.now() - startTime;
      const confidence = response.result.confidence || 0.8;

      // Check if confidence is too low
      if (confidence < 0.3) {
        throw this.createOCRError(
          OCRService.ERROR_CODES.QUALITY_TOO_LOW,
          `OCR confidence too low: ${confidence}`,
          true,
          { confidence }
        );
      }

      // Process text blocks and bounding boxes
      const textBlocks: TextBlock[] = [];
      const boundingBoxes: BoundingBox[] = [];

      if (response.result.blocks) {
        for (const block of response.result.blocks) {
          if (block.bbox && block.bbox.length === 4) {
            const boundingBox: BoundingBox = {
              x: block.bbox[0],
              y: block.bbox[1],
              width: block.bbox[2],
              height: block.bbox[3]
            };

            textBlocks.push({
              text: block.text,
              confidence: block.confidence,
              boundingBox
            });

            boundingBoxes.push(boundingBox);
          }
        }
      }

      // Update performance metrics
      this.performanceMetrics.successfulRequests++;
      this.updateAverageProcessingTime(processingTime);
      this.updateAverageConfidence(confidence);

      return {
        text: response.result.text || '',
        confidence,
        processingTime,
        model: 'llama-vision',
        textBlocks,
        boundingBoxes
      };

    } catch (error) {
      this.performanceMetrics.failedRequests++;
      
      if (error && typeof error === 'object' && 'code' in error && 'retryable' in error) {
        const ocrError = error as OCRError;
        this.performanceMetrics.errorsByType[ocrError.code] = 
          (this.performanceMetrics.errorsByType[ocrError.code] || 0) + 1;
        throw error;
      }

      const ocrError = this.createOCRError(
        OCRService.ERROR_CODES.AI_MODEL_ERROR,
        `OCR coordinate extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        false,
        { originalError: error }
      );

      this.performanceMetrics.errorsByType[ocrError.code] = 
        (this.performanceMetrics.errorsByType[ocrError.code] || 0) + 1;

      throw ocrError;
    }
  }

  /**
   * Extract text with retry logic and exponential backoff
   * Requirements: 3.3, 7.1
   */
  async extractTextWithRetry(
    imageBuffer: ArrayBuffer, 
    options: OCROptions, 
    retryOptions: OCRRetryOptions = OCRService.DEFAULT_RETRY_OPTIONS
  ): Promise<OCRResult> {
    let lastError: OCRError | null = null;
    
    for (let attempt = 0; attempt <= retryOptions.maxRetries; attempt++) {
      try {
        return await this.extractText(imageBuffer, options);
      } catch (error) {
        lastError = error as OCRError;
        
        // Don't retry if error is not retryable or we've reached max retries
        if (!lastError.retryable || attempt === retryOptions.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryOptions.baseDelayMs * Math.pow(retryOptions.backoffMultiplier, attempt),
          retryOptions.maxDelayMs
        );

        console.warn(`OCR attempt ${attempt + 1} failed, retrying in ${delay}ms:`, lastError.message);
        
        // Wait before retry
        await this.sleep(delay);
      }
    }

    // All retries exhausted, throw the last error
    throw lastError || this.createOCRError(
      OCRService.ERROR_CODES.AI_MODEL_ERROR,
      'OCR processing failed after all retries',
      false
    );
  }

  /**
   * Get current performance metrics
   * Requirements: 10.2
   */
  getPerformanceMetrics(): OCRPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Reset performance metrics
   * Requirements: 10.2
   */
  resetPerformanceMetrics(): void {
    this.performanceMetrics = this.initializeMetrics();
  }

  /**
   * Validate image input (format and size)
   * Requirements: 3.4
   */
  private validateImageInput(imageBuffer: ArrayBuffer): void {
    if (!this.validateImageFormat(imageBuffer)) {
      throw this.createOCRError(
        OCRService.ERROR_CODES.UNSUPPORTED_FORMAT,
        'Unsupported image format. Supported formats: JPEG, PNG, WebP, BMP, TIFF',
        false,
        { supportedFormats: OCRService.getSupportedFormats() }
      );
    }

    if (imageBuffer.byteLength > OCRService.MAX_FILE_SIZE) {
      throw this.createOCRError(
        OCRService.ERROR_CODES.FILE_TOO_LARGE,
        `Image size (${imageBuffer.byteLength} bytes) exceeds maximum allowed size (${OCRService.MAX_FILE_SIZE} bytes)`,
        false,
        { 
          actualSize: imageBuffer.byteLength, 
          maxSize: OCRService.MAX_FILE_SIZE 
        }
      );
    }
  }

  /**
   * Create structured OCR error
   */
  private createOCRError(code: string, message: string, retryable: boolean, details?: any): OCRError {
    const error = Object.assign(new Error(message), {
      code,
      retryable,
      details
    }) as OCRError;
    return error;
  }

  /**
   * Initialize performance metrics
   */
  private initializeMetrics(): OCRPerformanceMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageProcessingTime: 0,
      averageConfidence: 0,
      errorsByType: {}
    };
  }

  /**
   * Update average processing time
   */
  private updateAverageProcessingTime(processingTime: number): void {
    const total = this.performanceMetrics.successfulRequests;
    const currentAvg = this.performanceMetrics.averageProcessingTime;
    this.performanceMetrics.averageProcessingTime = 
      ((currentAvg * (total - 1)) + processingTime) / total;
  }

  /**
   * Update average confidence score
   */
  private updateAverageConfidence(confidence: number): void {
    const total = this.performanceMetrics.successfulRequests;
    const currentAvg = this.performanceMetrics.averageConfidence;
    this.performanceMetrics.averageConfidence = 
      ((currentAvg * (total - 1)) + confidence) / total;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate image format using magic bytes
   * Requirements: 3.4
   */
  validateImageFormat(buffer: ArrayBuffer): boolean {
    try {
      const bytes = new Uint8Array(buffer);
      
      // Check if buffer is large enough for magic byte detection
      if (bytes.length < 4) {
        return false;
      }

      // Check each supported format
      for (const [, magicBytes] of Object.entries(OCRService.SUPPORTED_FORMATS)) {
        if (this.matchesMagicBytes(bytes, magicBytes)) {
          return true;
        }
      }

      // Special case for TIFF big-endian
      if (bytes.length >= 4 && 
          bytes[0] === 0x4D && bytes[1] === 0x4D && 
          bytes[2] === 0x00 && bytes[3] === 0x2A) {
        return true; // TIFF big-endian
      }

      return false;

    } catch (error) {
      console.error('Image format validation failed:', error);
      return false;
    }
  }

  /**
   * Call Cloudflare Workers AI vision model
   */
  private async callWorkersAI(imageBuffer: ArrayBuffer, model: string): Promise<WorkersAIVisionResponse> {
    try {
      // Convert ArrayBuffer to number array for AI input
      const imageArray = Array.from(new Uint8Array(imageBuffer));

      // Determine the appropriate AI model based on the requested model
      const aiModel = model === 'llama-vision' ? '@cf/llava-hf/llava-1.5-7b-hf' : '@cf/microsoft/resnet-50';

      // For vision models, we need to provide the image as input
      const response = await this.ai.run(aiModel, {
        image: imageArray,
        prompt: "Extract all text from this receipt image. Provide the text content and any available bounding box coordinates.",
        max_tokens: 2048
      });

      // Handle different response formats from different models
      if (typeof response === 'string') {
        // Simple text response
        return {
          result: {
            text: response,
            confidence: 0.8
          },
          success: true
        };
      } else if (response && typeof response === 'object') {
        // Structured response
        const structuredResponse = response as any;
        
        return {
          result: {
            text: structuredResponse.description || structuredResponse.text || '',
            confidence: structuredResponse.confidence || 0.8,
            blocks: structuredResponse.blocks || []
          },
          success: true
        };
      } else {
        throw new Error('Invalid response format from AI model');
      }

    } catch (error) {
      console.error('Workers AI call failed:', error);
      
      return {
        result: {
          text: '',
          confidence: 0
        },
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown AI processing error']
      };
    }
  }

  /**
   * Enhance image quality for better OCR results
   * This is a placeholder for image preprocessing logic
   */
  private async enhanceImageQuality(imageBuffer: ArrayBuffer): Promise<ArrayBuffer> {
    // TODO: Implement image enhancement techniques such as:
    // - Contrast adjustment
    // - Noise reduction
    // - Deskewing
    // - Resolution enhancement
    
    // For now, return the original buffer
    // In a production environment, you might use libraries like Sharp or ImageMagick
    return imageBuffer;
  }

  /**
   * Check if bytes match magic bytes pattern
   */
  private matchesMagicBytes(bytes: Uint8Array, magicBytes: number[]): boolean {
    if (bytes.length < magicBytes.length) {
      return false;
    }

    for (let i = 0; i < magicBytes.length; i++) {
      if (bytes[i] !== magicBytes[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get supported image formats
   */
  static getSupportedFormats(): string[] {
    return Object.keys(OCRService.SUPPORTED_FORMATS);
  }

  /**
   * Get maximum file size
   */
  static getMaxFileSize(): number {
    return OCRService.MAX_FILE_SIZE;
  }
}

/**
 * Factory function to create OCRService instance
 */
export function createOCRService(ai: Ai): IOCRService {
  return new OCRService(ai);
}

/**
 * Utility function to detect image format from buffer
 */
export function detectImageFormat(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer);
  
  if (bytes.length < 4) {
    return null;
  }

  // Check JPEG
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }

  // Check PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  }

  // Check WebP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return 'image/webp';
  }

  // Check BMP
  if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
    return 'image/bmp';
  }

  // Check TIFF (little-endian)
  if (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2A && bytes[3] === 0x00) {
    return 'image/tiff';
  }

  // Check TIFF (big-endian)
  if (bytes[0] === 0x4D && bytes[1] === 0x4D && bytes[2] === 0x00 && bytes[3] === 0x2A) {
    return 'image/tiff';
  }

  return null;
}