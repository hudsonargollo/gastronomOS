/**
 * Basic tests for Upload Service
 * 
 * Tests core functionality of the receipt upload service including
 * file validation, upload URL generation, and status tracking.
 */

import { describe, it, expect } from 'vitest';
import { UploadService } from './upload';

describe('UploadService', () => {
  describe('validateImageFile', () => {
    it('should validate valid image files', () => {
      const mockFile = {
        name: 'receipt.jpg',
        size: 1024 * 1024, // 1MB
        type: 'image/jpeg'
      } as File;

      const service = new UploadService({} as any, {} as any, {} as any);
      const result = service.validateImageFile(mockFile);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject files that are too large', () => {
      const mockFile = {
        name: 'receipt.jpg',
        size: 15 * 1024 * 1024, // 15MB (exceeds 10MB limit)
        type: 'image/jpeg'
      } as File;

      const service = new UploadService({} as any, {} as any, {} as any);
      const result = service.validateImageFile(mockFile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File size 15MB exceeds maximum allowed size of 10MB');
    });

    it('should reject invalid file types', () => {
      const mockFile = {
        name: 'document.pdf',
        size: 1024 * 1024,
        type: 'application/pdf'
      } as File;

      const service = new UploadService({} as any, {} as any, {} as any);
      const result = service.validateImageFile(mockFile);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('not supported'))).toBe(true);
    });

    it('should reject empty files', () => {
      const mockFile = {
        name: 'receipt.jpg',
        size: 0,
        type: 'image/jpeg'
      } as File;

      const service = new UploadService({} as any, {} as any, {} as any);
      const result = service.validateImageFile(mockFile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File is empty');
    });

    it('should reject files with suspicious extensions', () => {
      const mockFile = {
        name: 'malicious.exe',
        size: 1024,
        type: 'image/jpeg' // Trying to disguise as image
      } as File;

      const service = new UploadService({} as any, {} as any, {} as any);
      const result = service.validateImageFile(mockFile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File type not allowed for security reasons');
    });
  });

  describe('validateUploadMetadata', () => {
    it('should validate correct metadata', () => {
      const service = new UploadService({} as any, {} as any, {} as any);
      const metadata = {
        fileName: 'receipt.jpg',
        fileSize: 1024 * 1024,
        contentType: 'image/jpeg'
      };

      // Access private method for testing
      const result = (service as any).validateUploadMetadata(metadata);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject metadata with invalid content type', () => {
      const service = new UploadService({} as any, {} as any, {} as any);
      const metadata = {
        fileName: 'receipt.pdf',
        fileSize: 1024 * 1024,
        contentType: 'application/pdf'
      };

      const result = (service as any).validateUploadMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((error: string) => error.includes('Invalid content type'))).toBe(true);
    });
  });
});