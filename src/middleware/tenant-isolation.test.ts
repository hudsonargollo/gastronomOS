/**
 * Unit tests for Tenant Isolation Middleware
 * 
 * Tests tenant resolution, cross-tenant access prevention, and security logging.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import {
  resolveTenant,
  preventCrossTenantAccess,
  enforceTenantIsolation,
  getTenantId,
  validateTenantOwnership
} from './tenant-isolation';

describe('Tenant Isolation Middleware', () => {
  let app: Hono;
  
  const mockAuthContext = {
    user_id: 'user-123',
    tenant_id: 'tenant-abc',
    role: 'ADMIN' as const
  };
  
  const mockAuditService = {
    logSecurityEvent: vi.fn(),
    logSensitiveOperation: vi.fn(),
    logAuthenticationEvent: vi.fn(),
    logAuthorizationEvent: vi.fn()
  };
  
  beforeEach(() => {
    app = new Hono();
    vi.clearAllMocks();
  });
  
  describe('resolveTenant', () => {
    it('should resolve tenant from auth context', async () => {
      app.use('*', (c, next) => {
        c.set('authContext', mockAuthContext);
        c.set('auditService', mockAuditService);
        return next();
      });
      
      app.use('*', resolveTenant());
      
      app.get('/test', (c) => {
        const tenantId = c.get('tenantId');
        return c.json({ tenantId });
      });
      
      const res = await app.request('/test');
      const data = await res.json();
      
      expect(res.status).toBe(200);
      expect(data.tenantId).toBe('tenant-abc');
      expect(mockAuditService.logSensitiveOperation).toHaveBeenCalledWith(
        'TENANT_RESOLVED',
        expect.objectContaining({
          tenantId: 'tenant-abc',
          userId: 'user-123'
        })
      );
    });
    
    it('should reject request without auth context', async () => {
      app.use('*', (c, next) => {
        c.set('auditService', mockAuditService);
        return next();
      });
      
      app.use('*', resolveTenant());
      
      app.get('/test', (c) => c.json({ ok: true }));
      
      const res = await app.request('/test');
      
      expect(res.status).toBe(500);
    });
    
    it('should reject request with missing tenant_id', async () => {
      app.use('*', (c, next) => {
        c.set('authContext', { ...mockAuthContext, tenant_id: '' });
        c.set('auditService', mockAuditService);
        return next();
      });
      
      app.use('*', resolveTenant());
      
      app.get('/test', (c) => c.json({ ok: true }));
      
      const res = await app.request('/test');
      
      expect(res.status).toBe(403);
      expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith(
        'TENANT_RESOLUTION_FAILED',
        expect.any(Object)
      );
    });
  });
  
  describe('preventCrossTenantAccess', () => {
    it('should allow access when tenant IDs match', async () => {
      app.use('*', (c, next) => {
        c.set('authContext', mockAuthContext);
        c.set('auditService', mockAuditService);
        return next();
      });
      
      app.use('*', preventCrossTenantAccess());
      
      app.get('/tenants/:tenantId/data', (c) => {
        return c.json({ ok: true });
      });
      
      const res = await app.request('/tenants/tenant-abc/data');
      
      expect(res.status).toBe(200);
    });
    
    it('should block cross-tenant access via path parameter', async () => {
      app.use('*', (c, next) => {
        c.set('authContext', mockAuthContext);
        c.set('auditService', mockAuditService);
        return next();
      });
      
      app.use('*', preventCrossTenantAccess());
      
      app.get('/tenants/:tenantId/data', (c) => {
        return c.json({ ok: true });
      });
      
      const res = await app.request('/tenants/tenant-xyz/data');
      
      expect(res.status).toBe(403);
      expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith(
        'CROSS_TENANT_ACCESS_ATTEMPT',
        expect.objectContaining({
          tenantId: 'tenant-abc',
          userId: 'user-123'
        })
      );
    });
    
    it('should block cross-tenant access via query parameter', async () => {
      app.use('*', (c, next) => {
        c.set('authContext', mockAuthContext);
        c.set('auditService', mockAuditService);
        return next();
      });
      
      app.use('*', preventCrossTenantAccess());
      
      app.get('/data', (c) => {
        return c.json({ ok: true });
      });
      
      const res = await app.request('/data?tenant_id=tenant-xyz');
      
      expect(res.status).toBe(403);
      expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith(
        'CROSS_TENANT_ACCESS_ATTEMPT',
        expect.any(Object)
      );
    });
    
    it('should allow access when no tenant ID in request', async () => {
      app.use('*', (c, next) => {
        c.set('authContext', mockAuthContext);
        c.set('auditService', mockAuditService);
        return next();
      });
      
      app.use('*', preventCrossTenantAccess());
      
      app.get('/data', (c) => {
        return c.json({ ok: true });
      });
      
      const res = await app.request('/data');
      
      expect(res.status).toBe(200);
    });
  });
  
  describe('enforceTenantIsolation', () => {
    it('should enforce both tenant resolution and cross-tenant prevention', async () => {
      app.use('*', (c, next) => {
        c.set('authContext', mockAuthContext);
        c.set('auditService', mockAuditService);
        return next();
      });
      
      app.use('*', enforceTenantIsolation());
      
      app.get('/tenants/:tenantId/data', (c) => {
        const tenantId = c.get('tenantId');
        return c.json({ tenantId });
      });
      
      // Should succeed with matching tenant
      const res1 = await app.request('/tenants/tenant-abc/data');
      expect(res1.status).toBe(200);
      
      // Should fail with different tenant
      const res2 = await app.request('/tenants/tenant-xyz/data');
      expect(res2.status).toBe(403);
    });
  });
  
  describe('getTenantId', () => {
    it('should return tenant ID from context', () => {
      const mockContext = {
        get: vi.fn().mockReturnValue('tenant-abc')
      } as any;
      
      const tenantId = getTenantId(mockContext);
      
      expect(tenantId).toBe('tenant-abc');
      expect(mockContext.get).toHaveBeenCalledWith('tenantId');
    });
    
    it('should throw error when tenant ID not in context', () => {
      const mockContext = {
        get: vi.fn().mockReturnValue(undefined)
      } as any;
      
      expect(() => getTenantId(mockContext)).toThrow('Tenant ID not found in context');
    });
  });
  
  describe('validateTenantOwnership', () => {
    it('should return true when tenant IDs match', async () => {
      const mockContext = {
        get: vi.fn((key: string) => {
          if (key === 'authContext') return mockAuthContext;
          if (key === 'auditService') return mockAuditService;
          return undefined;
        })
      } as any;
      
      const result = await validateTenantOwnership(mockContext, 'tenant-abc');
      
      expect(result).toBe(true);
    });
    
    it('should return false and log security event when tenant IDs do not match', async () => {
      const mockContext = {
        get: vi.fn((key: string) => {
          if (key === 'authContext') return mockAuthContext;
          if (key === 'auditService') return mockAuditService;
          return undefined;
        })
      } as any;
      
      const result = await validateTenantOwnership(mockContext, 'tenant-xyz');
      
      expect(result).toBe(false);
      expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith(
        'UNAUTHORIZED_RESOURCE_ACCESS',
        expect.objectContaining({
          tenantId: 'tenant-abc',
          userId: 'user-123'
        })
      );
    });
  });
  
  describe('Security logging', () => {
    it('should log all tenant access attempts', async () => {
      app.use('*', (c, next) => {
        c.set('authContext', mockAuthContext);
        c.set('auditService', mockAuditService);
        return next();
      });
      
      app.use('*', resolveTenant());
      
      app.get('/test', (c) => c.json({ ok: true }));
      
      await app.request('/test');
      
      expect(mockAuditService.logSensitiveOperation).toHaveBeenCalled();
    });
    
    it('should log cross-tenant access attempts', async () => {
      app.use('*', (c, next) => {
        c.set('authContext', mockAuthContext);
        c.set('auditService', mockAuditService);
        return next();
      });
      
      app.use('*', preventCrossTenantAccess());
      
      app.get('/tenants/:tenantId/data', (c) => c.json({ ok: true }));
      
      await app.request('/tenants/tenant-xyz/data');
      
      expect(mockAuditService.logSecurityEvent).toHaveBeenCalledWith(
        'CROSS_TENANT_ACCESS_ATTEMPT',
        expect.any(Object)
      );
    });
  });
});
