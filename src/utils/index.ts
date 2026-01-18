// Utility functions for the authentication system

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
export function createSuccessResponse(
  data: any,
  message?: string,
  requestId?: string
) {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    request_id: requestId,
  };
}