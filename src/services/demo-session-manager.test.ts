import { describe, it, expect, beforeEach } from 'vitest';
import { DemoSessionManager, createDemoSessionManager } from './demo-session-manager';

describe('DemoSessionManager', () => {
  let mockDb: any;
  let demoSessionManager: DemoSessionManager;

  beforeEach(() => {
    // Create a minimal mock database
    mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([])
          })
        })
      })
    };

    demoSessionManager = new DemoSessionManager(mockDb);
  });

  describe('getDemoSessionExpiration', () => {
    it('should return shorter expiration time for demo sessions', () => {
      const expiration = demoSessionManager.getDemoSessionExpiration();
      
      // Demo sessions should be 2 hours (7200 seconds) by default
      expect(expiration).toBe(2 * 60 * 60);
      
      // Should be less than regular 24-hour sessions
      expect(expiration).toBeLessThan(24 * 60 * 60);
    });

    it('should respect custom expiration configuration', () => {
      const customExpiration = 1 * 60 * 60; // 1 hour
      const customManager = new DemoSessionManager(mockDb, {
        expirationSeconds: customExpiration
      });
      
      expect(customManager.getDemoSessionExpiration()).toBe(customExpiration);
    });
  });

  describe('isDemoAccount', () => {
    it('should identify demo accounts by email pattern', async () => {
      expect(await demoSessionManager.isDemoAccount('demo@gastronomos.com')).toBe(true);
      expect(await demoSessionManager.isDemoAccount('manager@demo-restaurant.com')).toBe(true);
      expect(await demoSessionManager.isDemoAccount('demo@example.com')).toBe(true);
    });

    it('should not identify regular accounts as demo', async () => {
      expect(await demoSessionManager.isDemoAccount('user@company.com')).toBe(false);
      expect(await demoSessionManager.isDemoAccount('admin@restaurant.com')).toBe(false);
    });

    it('should be case-insensitive', async () => {
      expect(await demoSessionManager.isDemoAccount('DEMO@gastronomos.com')).toBe(true);
      expect(await demoSessionManager.isDemoAccount('Manager@DEMO-restaurant.com')).toBe(true);
    });
  });

  describe('isDemoTenant', () => {
    it('should identify demo tenant', () => {
      expect(demoSessionManager.isDemoTenant('demo-tenant')).toBe(true);
    });

    it('should not identify regular tenants as demo', () => {
      expect(demoSessionManager.isDemoTenant('regular-tenant')).toBe(false);
      expect(demoSessionManager.isDemoTenant('company-123')).toBe(false);
    });
  });

  describe('createDemoSessionInfo', () => {
    it('should create session info with shorter expiration', () => {
      const sessionInfo = demoSessionManager.createDemoSessionInfo('user-123', 'demo-tenant');
      
      expect(sessionInfo.isDemoSession).toBe(true);
      expect(sessionInfo.userId).toBe('user-123');
      expect(sessionInfo.tenantId).toBe('demo-tenant');
      expect(sessionInfo.expiresAt).toBeGreaterThan(sessionInfo.sessionStartedAt);
      
      // Check that expiration is approximately 2 hours from now
      const expirationDiff = sessionInfo.expiresAt - sessionInfo.sessionStartedAt;
      expect(expirationDiff).toBe(2 * 60 * 60);
    });
  });

  describe('shouldResetDemoData', () => {
    it('should not reset if auto-reset is disabled', async () => {
      const manualManager = new DemoSessionManager(mockDb, {
        enableAutoReset: false
      });
      
      expect(await manualManager.shouldResetDemoData()).toBe(false);
    });

    it('should not reset if interval has not passed', async () => {
      const shouldReset = await demoSessionManager.shouldResetDemoData();
      
      // Should be false immediately after creation
      expect(shouldReset).toBe(false);
    });

    it('should reset if interval has passed', async () => {
      // Create manager with very short reset interval
      const shortIntervalManager = new DemoSessionManager(mockDb, {
        resetIntervalHours: 0.00001, // Very short interval for testing (0.036 seconds)
        enableAutoReset: true
      });
      
      // Wait for the interval to pass
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const shouldReset = await shortIntervalManager.shouldResetDemoData();
      expect(shouldReset).toBe(true);
    });
  });

  describe('getSessionSecurityRestrictions', () => {
    it('should return security restrictions for demo accounts', () => {
      const restrictions = demoSessionManager.getSessionSecurityRestrictions();
      
      expect(restrictions.canModifyUsers).toBe(false);
      expect(restrictions.canDeleteData).toBe(false);
      expect(restrictions.canExportData).toBe(false);
      expect(restrictions.canAccessAdminPanel).toBe(false);
      expect(restrictions.maxDataRetentionHours).toBeGreaterThan(0);
    });
  });

  describe('getConfig', () => {
    it('should return configuration', () => {
      const config = demoSessionManager.getConfig();
      
      expect(config.expirationSeconds).toBe(2 * 60 * 60);
      expect(config.resetIntervalHours).toBe(24);
      expect(config.maxConcurrentSessions).toBe(100);
      expect(config.enableAutoReset).toBe(true);
    });

    it('should return frozen config object', () => {
      const config = demoSessionManager.getConfig();
      
      // Attempting to modify should not work (frozen object)
      expect(() => {
        (config as any).expirationSeconds = 999;
      }).toThrow();
    });
  });

  describe('factory function', () => {
    it('should create DemoSessionManager instance', () => {
      const manager = createDemoSessionManager(mockDb);
      
      expect(manager).toBeDefined();
      expect(manager.getDemoSessionExpiration()).toBe(2 * 60 * 60);
    });

    it('should accept custom configuration', () => {
      const manager = createDemoSessionManager(mockDb, {
        expirationSeconds: 3600,
        resetIntervalHours: 12
      });
      
      expect(manager.getDemoSessionExpiration()).toBe(3600);
      expect(manager.getConfig().resetIntervalHours).toBe(12);
    });
  });
});
