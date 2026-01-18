// Utility functions for the authentication system

// Response interfaces
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  timestamp: string;
  requestId?: string;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  code?: string;
  timestamp: string;
  requestId?: string;
  details?: any;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T = any> {
  success: true;
  data: T[];
  pagination: PaginationInfo;
  timestamp: string;
  requestId?: string;
}

// Generate secure random IDs using crypto.randomUUID for Cloudflare Workers
export function generateId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

// Generate tenant-specific prefixed IDs
export function generateTenantId(): string {
  return `tenant_${generateId()}`;
}

export function generateUserId(): string {
  return `user_${generateId()}`;
}

export function generateLocationId(): string {
  return `location_${generateId()}`;
}

export function generateAuditId(): string {
  return `audit_${generateId()}`;
}

export function generateSupplierId(): string {
  return `supplier_${generateId()}`;
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Additional check for consecutive dots
  return emailRegex.test(email) && !email.includes('..');
}

// Validate tenant slug format (lowercase, alphanumeric, hyphens)
export function isValidSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9-]+$/;
  return slugRegex.test(slug) && slug.length >= 3 && slug.length <= 50;
}

// Get current timestamp
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

// Create standardized error response
export function createErrorResponse(
  error: string,
  message: string,
  code: string,
  requestId?: string
) {
  return {
    error,
    message,
    code,
    timestamp: new Date().toISOString(),
    request_id: requestId,
  };
}

// Create standardized success response
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  requestId?: string
): SuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    ...(requestId && { requestId }),
  };
}

/**
 * Create a paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  requestId?: string
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    timestamp: new Date().toISOString(),
    ...(requestId && { requestId }),
  };
}

/**
 * Validate pagination parameters
 */
export function validatePagination(page?: number, limit?: number) {
  const validatedPage = Math.max(1, page || 1);
  const validatedLimit = Math.min(100, Math.max(1, limit || 20));
  
  return {
    page: validatedPage,
    limit: validatedLimit,
    offset: (validatedPage - 1) * validatedLimit,
  };
}

/**
 * Sanitize search query
 */
export function sanitizeSearchQuery(query?: string): string | undefined {
  if (!query || typeof query !== 'string') {
    return undefined;
  }
  
  // Remove special characters that could cause issues
  const sanitized = query
    .trim()
    .replace(/[<>'"&]/g, '') // Remove potentially dangerous characters
    .substring(0, 100); // Limit length
  
  return sanitized.length > 0 ? sanitized : undefined;
}

/**
 * Convert cents to dollars for display
 */
export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Convert dollars to cents for storage
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Format currency for display
 */
export function formatCurrency(cents: number, currency = 'USD'): string {
  const dollars = centsToDollars(cents);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(dollars);
}