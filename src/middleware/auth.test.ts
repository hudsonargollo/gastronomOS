import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authenticate, requireRole, requireLocation, getAuthContext } from './auth';
import { createJWTService, IJWTService } from '../services/jwt';
import { JWTClaims } from '../types';

describe('Authentication Middleware', () => {
  let app: Hono;
  let jwtService: IJWTService;
  const testSecret = 'test-secret-that-is-long-enough-for-validation-and-security';

  beforeEach(() => {
    app = new Hono();
    jwtService = createJWTService(testSecret);
    
    // Add JWT service to context
    app.use('*', async (c, next) => {
      c.set('jwtService', jwtService);
      await next();
    });
  });

  describe('authenticate middleware', () => {
    it('should authenticate valid JWT token', async () => {
      const claims: Omit<JWTClaims, 'exp' | 'iat'> = {
        sub: 'user-123',
        tenant_id: 'tenant-456',
        role: 'ADMIN',
        location_id: 'location-789',
      };

      const token = await jwtService.sign(claims);

      app.use('/protected', authenticate());
      app.get('/protected', (c) => {
        const authContext = getAuthContext(c);
        return c.json({ success: true, authContext });
      });

      const res = await app.request('/protected', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.authContext.user_id).toBe('user-123');
    });

    it('should reject request without Authorization header', async () => {
      app.use('/protected', authenticate());
      app.get('/protected', (c) => c.json({ success: true }));

      const res = await app.request('/protected');

      expect(res.status).toBe(401);
      const body = await res.json() as any;
      expect(body.message).toBe('Authorization header is required');
    });

    it('should reject request with invalid JWT token', async () => {
      app.use('/protected', authenticate());
      app.get('/protected', (c) => c.json({ success: true }));

      const res = await app.request('/protected', {
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });

      expect(res.status).toBe(401);
      const body = await res.json() as any;
      expect(body.message).toContain('Invalid JWT token');
    });
  });

  describe('requireRole middleware', () => {
    it('should allow access for users with required role', async () => {
      const claims: Omit<JWTClaims, 'exp' | 'iat'> = {
        sub: 'user-123',
        tenant_id: 'tenant-456',
        role: 'ADMIN',
      };

      const token = await jwtService.sign(claims);

      app.use('/admin', authenticate());
      app.use('/admin', requireRole(['ADMIN']));
      app.get('/admin', (c) => c.json({ success: true }));

      const res = await app.request('/admin', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
    });

    it('should deny access for users without required role', async () => {
      const claims: Omit<JWTClaims, 'exp' | 'iat'> = {
        sub: 'user-123',
        tenant_id: 'tenant-456',
        role: 'STAFF',
      };

      const token = await jwtService.sign(claims);

      app.use('/admin', authenticate());
      app.use('/admin', requireRole(['ADMIN']));
      app.get('/admin', (c) => c.json({ success: true }));

      const res = await app.request('/admin', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(403);
    });
  });

  describe('requireLocation middleware', () => {
    it('should allow access when user has no location restriction', async () => {
      const claims: Omit<JWTClaims, 'exp' | 'iat'> = {
        sub: 'user-123',
        tenant_id: 'tenant-456',
        role: 'ADMIN',
        // No location_id - can access all locations
      };

      const token = await jwtService.sign(claims);

      app.use('/location/:locationId', authenticate());
      app.use('/location/:locationId', requireLocation());
      app.get('/location/:locationId', (c) => c.json({ success: true }));

      const res = await app.request('/location/any-location', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
    });

    it('should deny access when user location does not match requested location', async () => {
      const claims: Omit<JWTClaims, 'exp' | 'iat'> = {
        sub: 'user-123',
        tenant_id: 'tenant-456',
        role: 'MANAGER',
        location_id: 'location-789',
      };

      const token = await jwtService.sign(claims);

      app.use('/location/:locationId', authenticate());
      app.use('/location/:locationId', requireLocation());
      app.get('/location/:locationId', (c) => c.json({ success: true }));

      const res = await app.request('/location/different-location', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(403);
    });
  });
});