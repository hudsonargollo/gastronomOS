import { z } from 'zod';

/**
 * Data Validation and Sanitization Service
 * Requirements: 9.1, 9.4
 */

export interface SanitizationOptions {
  allowHtml?: boolean;
  allowedTags?: string[];
  maxLength?: number;
  trimWhitespace?: boolean;
  normalizeUnicode?: boolean;
  removeControlChars?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  sanitizedValue: any;
  errors: string[];
  warnings: string[];
}

/**
 * Data Sanitization Service
 */
export class DataSanitizationService {
  /**
   * Sanitize string input
   */
  static sanitizeString(
    input: string,
    options: SanitizationOptions = {}
  ): ValidationResult {
    const {
      allowHtml = false,
      allowedTags = [],
      maxLength = 10000,
      trimWhitespace = true,
      normalizeUnicode = true,
      removeControlChars = true,
    } = options;

    const errors: string[] = [];
    const warnings: string[] = [];
    let sanitized = input;

    try {
      // Basic type check
      if (typeof input !== 'string') {
        sanitized = String(input);
        warnings.push('Input was converted to string');
      }

      // Trim whitespace
      if (trimWhitespace) {
        sanitized = sanitized.trim();
      }

      // Normalize Unicode
      if (normalizeUnicode) {
        sanitized = sanitized.normalize('NFC');
      }

      // Remove control characters
      if (removeControlChars) {
        sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
      }

      // Length validation
      if (sanitized.length > maxLength) {
        errors.push(`String exceeds maximum length of ${maxLength} characters`);
        sanitized = sanitized.substring(0, maxLength);
        warnings.push(`String was truncated to ${maxLength} characters`);
      }

      // HTML sanitization
      if (!allowHtml) {
        const htmlPattern = /<[^>]*>/g;
        if (htmlPattern.test(sanitized)) {
          sanitized = this.stripHtml(sanitized);
          warnings.push('HTML tags were removed');
        }
      } else if (allowedTags.length > 0) {
        sanitized = this.sanitizeHtml(sanitized, allowedTags);
      }

      // Check for potentially dangerous content
      const dangerousPatterns = [
        { pattern: /javascript:/gi, message: 'JavaScript URLs detected' },
        { pattern: /on\w+\s*=/gi, message: 'Event handlers detected' },
        { pattern: /data:text\/html/gi, message: 'Data URLs detected' },
        { pattern: /<script/gi, message: 'Script tags detected' },
      ];

      dangerousPatterns.forEach(({ pattern, message }) => {
        if (pattern.test(sanitized)) {
          errors.push(message);
          sanitized = sanitized.replace(pattern, '');
        }
      });

      return {
        isValid: errors.length === 0,
        sanitizedValue: sanitized,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        sanitizedValue: input,
        errors: [`Sanitization error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings,
      };
    }
  }

  /**
   * Sanitize email address
   */
  static sanitizeEmail(email: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let sanitized = email;

    try {
      // Basic sanitization
      sanitized = sanitized.trim().toLowerCase();

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(sanitized)) {
        errors.push('Invalid email format');
      }

      // Length check
      if (sanitized.length > 254) {
        errors.push('Email address is too long');
      }

      // Check for dangerous characters
      const dangerousChars = /[<>'"]/;
      if (dangerousChars.test(sanitized)) {
        errors.push('Email contains invalid characters');
        sanitized = sanitized.replace(dangerousChars, '');
      }

      return {
        isValid: errors.length === 0,
        sanitizedValue: sanitized,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        sanitizedValue: email,
        errors: [`Email sanitization error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings,
      };
    }
  }

  /**
   * Sanitize numeric input
   */
  static sanitizeNumber(
    input: any,
    options: {
      min?: number;
      max?: number;
      integer?: boolean;
      allowNegative?: boolean;
    } = {}
  ): ValidationResult {
    const { min, max, integer = false, allowNegative = true } = options;
    const errors: string[] = [];
    const warnings: string[] = [];
    let sanitized: number;

    try {
      // Convert to number
      if (typeof input === 'string') {
        sanitized = parseFloat(input);
      } else if (typeof input === 'number') {
        sanitized = input;
      } else {
        sanitized = Number(input);
      }

      // Check if conversion was successful
      if (isNaN(sanitized)) {
        errors.push('Invalid number format');
        sanitized = 0;
      }

      // Check for infinity
      if (!isFinite(sanitized)) {
        errors.push('Number must be finite');
        sanitized = 0;
      }

      // Integer validation
      if (integer && !Number.isInteger(sanitized)) {
        warnings.push('Number was rounded to integer');
        sanitized = Math.round(sanitized);
      }

      // Negative number validation
      if (!allowNegative && sanitized < 0) {
        errors.push('Negative numbers are not allowed');
        sanitized = Math.abs(sanitized);
      }

      // Range validation
      if (min !== undefined && sanitized < min) {
        errors.push(`Number must be at least ${min}`);
        sanitized = min;
      }

      if (max !== undefined && sanitized > max) {
        errors.push(`Number must be at most ${max}`);
        sanitized = max;
      }

      return {
        isValid: errors.length === 0,
        sanitizedValue: sanitized,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        sanitizedValue: 0,
        errors: [`Number sanitization error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings,
      };
    }
  }

  /**
   * Sanitize date input
   */
  static sanitizeDate(input: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let sanitized: Date;

    try {
      if (input instanceof Date) {
        sanitized = input;
      } else if (typeof input === 'string' || typeof input === 'number') {
        sanitized = new Date(input);
      } else {
        errors.push('Invalid date format');
        sanitized = new Date();
      }

      // Check if date is valid
      if (isNaN(sanitized.getTime())) {
        errors.push('Invalid date');
        sanitized = new Date();
      }

      // Check for reasonable date range (1900-2100)
      const minYear = 1900;
      const maxYear = 2100;
      const year = sanitized.getFullYear();

      if (year < minYear || year > maxYear) {
        errors.push(`Date must be between ${minYear} and ${maxYear}`);
        sanitized = new Date();
      }

      return {
        isValid: errors.length === 0,
        sanitizedValue: sanitized,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        sanitizedValue: new Date(),
        errors: [`Date sanitization error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings,
      };
    }
  }

  /**
   * Sanitize object recursively
   */
  static sanitizeObject(
    obj: Record<string, any>,
    schema?: Record<string, SanitizationOptions>
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const sanitized: Record<string, any> = {};

    try {
      for (const [key, value] of Object.entries(obj)) {
        // Sanitize key
        const sanitizedKey = this.sanitizeString(key, { maxLength: 100 });
        if (!sanitizedKey.isValid) {
          errors.push(`Invalid key "${key}": ${sanitizedKey.errors.join(', ')}`);
          continue;
        }

        // Get sanitization options for this field
        const fieldOptions = schema?.[key] || {};

        // Sanitize value based on type
        let fieldResult: ValidationResult;

        if (typeof value === 'string') {
          fieldResult = this.sanitizeString(value, fieldOptions);
        } else if (typeof value === 'number') {
          fieldResult = this.sanitizeNumber(value);
        } else if (value instanceof Date) {
          fieldResult = this.sanitizeDate(value);
        } else if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            fieldResult = this.sanitizeArray(value);
          } else {
            fieldResult = this.sanitizeObject(value, schema);
          }
        } else {
          // For other types, just validate they're not dangerous
          fieldResult = {
            isValid: true,
            sanitizedValue: value,
            errors: [],
            warnings: [],
          };
        }

        if (fieldResult.errors.length > 0) {
          errors.push(`Field "${sanitizedKey.sanitizedValue}": ${fieldResult.errors.join(', ')}`);
        }

        warnings.push(...fieldResult.warnings);
        sanitized[sanitizedKey.sanitizedValue] = fieldResult.sanitizedValue;
      }

      return {
        isValid: errors.length === 0,
        sanitizedValue: sanitized,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        sanitizedValue: obj,
        errors: [`Object sanitization error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings,
      };
    }
  }

  /**
   * Sanitize array
   */
  static sanitizeArray(arr: any[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const sanitized: any[] = [];

    try {
      if (!Array.isArray(arr)) {
        errors.push('Input is not an array');
        return {
          isValid: false,
          sanitizedValue: [],
          errors,
          warnings,
        };
      }

      // Limit array size
      const maxArraySize = 1000;
      if (arr.length > maxArraySize) {
        errors.push(`Array exceeds maximum size of ${maxArraySize}`);
        arr = arr.slice(0, maxArraySize);
        warnings.push(`Array was truncated to ${maxArraySize} items`);
      }

      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        let itemResult: ValidationResult;

        if (typeof item === 'string') {
          itemResult = this.sanitizeString(item);
        } else if (typeof item === 'number') {
          itemResult = this.sanitizeNumber(item);
        } else if (item instanceof Date) {
          itemResult = this.sanitizeDate(item);
        } else if (typeof item === 'object' && item !== null) {
          if (Array.isArray(item)) {
            itemResult = this.sanitizeArray(item);
          } else {
            itemResult = this.sanitizeObject(item);
          }
        } else {
          itemResult = {
            isValid: true,
            sanitizedValue: item,
            errors: [],
            warnings: [],
          };
        }

        if (itemResult.errors.length > 0) {
          errors.push(`Item ${i}: ${itemResult.errors.join(', ')}`);
        }

        warnings.push(...itemResult.warnings);
        sanitized.push(itemResult.sanitizedValue);
      }

      return {
        isValid: errors.length === 0,
        sanitizedValue: sanitized,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        sanitizedValue: arr,
        errors: [`Array sanitization error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings,
      };
    }
  }

  /**
   * Strip HTML tags from string
   */
  private static stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }

  /**
   * Sanitize HTML with allowed tags
   */
  private static sanitizeHtml(html: string, allowedTags: string[]): string {
    // Simple HTML sanitization - in production, use a library like DOMPurify
    const tagRegex = /<(\/?)([\w-]+)([^>]*)>/g;
    
    return html.replace(tagRegex, (match, closing, tagName, attributes) => {
      const tag = tagName.toLowerCase();
      
      if (!allowedTags.includes(tag)) {
        return '';
      }
      
      // Remove dangerous attributes
      const safeAttributes = attributes.replace(
        /\s*(on\w+|javascript:|data:)/gi,
        ''
      );
      
      return `<${closing}${tag}${safeAttributes}>`;
    });
  }
}

/**
 * Input validation middleware
 */
export function inputValidationMiddleware() {
  return async (c: any, next: any) => {
    try {
      // Get request body
      const body = await c.req.json().catch(() => ({}));
      
      // Sanitize request body
      const sanitizationResult = DataSanitizationService.sanitizeObject(body);
      
      if (!sanitizationResult.isValid) {
        return c.json({
          error: 'Input Validation Error',
          message: 'Request contains invalid or dangerous data',
          details: sanitizationResult.errors,
        }, 400);
      }
      
      // Store sanitized body
      c.set('sanitizedBody', sanitizationResult.sanitizedValue);
      
      // Add warnings to response headers if any
      if (sanitizationResult.warnings.length > 0) {
        c.header('X-Sanitization-Warnings', sanitizationResult.warnings.join('; '));
      }
      
      await next();
    } catch (error) {
      console.error('Input validation error:', error);
      return c.json({
        error: 'Input Validation Error',
        message: 'Failed to validate request data',
      }, 400);
    }
  };
}

/**
 * Sanitization utilities
 */
export const sanitizationUtils = {
  /**
   * Create sanitization schema for common entity types
   */
  createEntitySchema(entityType: 'user' | 'product' | 'category' | 'location'): Record<string, SanitizationOptions> {
    const commonOptions: SanitizationOptions = {
      allowHtml: false,
      maxLength: 255,
      trimWhitespace: true,
      normalizeUnicode: true,
      removeControlChars: true,
    };

    const schemas = {
      user: {
        firstName: { ...commonOptions, maxLength: 50 },
        lastName: { ...commonOptions, maxLength: 50 },
        email: { ...commonOptions, maxLength: 254 },
        role: { ...commonOptions, maxLength: 20 },
      },
      product: {
        name: { ...commonOptions, maxLength: 100 },
        description: { ...commonOptions, maxLength: 1000, allowHtml: true, allowedTags: ['p', 'br', 'strong', 'em'] },
        sku: { ...commonOptions, maxLength: 50 },
        unit: { ...commonOptions, maxLength: 20 },
      },
      category: {
        name: { ...commonOptions, maxLength: 100 },
        description: { ...commonOptions, maxLength: 500 },
      },
      location: {
        name: { ...commonOptions, maxLength: 100 },
        address: { ...commonOptions, maxLength: 500 },
        type: { ...commonOptions, maxLength: 20 },
      },
    };

    return schemas[entityType];
  },

  /**
   * Validate file upload data
   */
  validateFileUpload(file: {
    name: string;
    size: number;
    type: string;
  }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // File name validation
    const nameResult = DataSanitizationService.sanitizeString(file.name, {
      maxLength: 255,
      allowHtml: false,
    });
    
    if (!nameResult.isValid) {
      errors.push(`Invalid filename: ${nameResult.errors.join(', ')}`);
    }

    // File size validation (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      errors.push(`File size exceeds limit of ${maxSize} bytes`);
    }

    // File type validation
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/csv',
      'application/json',
    ];

    if (!allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed`);
    }

    return {
      isValid: errors.length === 0,
      sanitizedValue: {
        name: nameResult.sanitizedValue,
        size: file.size,
        type: file.type,
      },
      errors,
      warnings,
    };
  },

  /**
   * Sanitize SQL-like input to prevent injection
   */
  sanitizeSqlInput(input: string): string {
    return input
      .replace(/[';--]/g, '') // Remove SQL comment and statement terminators
      .replace(/\b(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|EXEC|EXECUTE)\b/gi, '') // Remove dangerous SQL keywords
      .trim();
  },

  /**
   * Generate content security policy
   */
  generateCSP(): string {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
  },
};