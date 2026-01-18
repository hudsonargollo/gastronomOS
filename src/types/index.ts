// Core type definitions for the authentication system

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: number;
  settings?: Record<string, any>;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  locationId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Location {
  id: string;
  tenantId: string;
  name: string;
  type: LocationType;
  address?: string;
  createdAt: number;
}

export interface AuthAuditLog {
  id: string;
  tenantId?: string;
  userId?: string;
  eventType: AuditEventType;
  resource?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: number;
}

// Enums
export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF';
export type LocationType = 'COMMISSARY' | 'RESTAURANT' | 'POP_UP';
export type AuditEventType = 'LOGIN' | 'LOGIN_FAILED' | 'ACCESS_DENIED' | 'USER_CREATED' | 'ROLE_CHANGED' | 'TENANT_CREATED';

// JWT Claims interface
export interface JWTClaims {
  sub: string;        // user_id
  tenant_id: string;  // tenant identifier
  role: UserRole;     // user role
  location_id?: string; // optional location restriction
  exp: number;        // expiration timestamp
  iat: number;        // issued at timestamp
}

// Authentication context
export interface AuthContext {
  user_id: string;
  tenant_id: string;
  role: UserRole;
  location_id?: string;
}

// Request/Response types
export interface CreateTenantRequest {
  name: string;
  slug: string;
  settings?: Record<string, any>;
}

export interface RegisterUserRequest {
  email: string;
  password: string;
  role: UserRole;
  locationId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
    tenantId: string;
    locationId?: string;
  };
}

// Error response format
export interface ErrorResponse {
  error: string;
  message: string;
  code: string;
  timestamp: string;
  request_id?: string;
}