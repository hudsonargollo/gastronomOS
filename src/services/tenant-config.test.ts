/**
 * Unit tests for Tenant Configuration Service
 * 
 * Tests tenant settings management, theme configuration, branding assets,
 * and payment gateway configuration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TenantConfigService,
  createTenantConfigService,
  DEFAULT_THEMES,
  type ThemeConfig,
  type BrandingAssets,
  type TenantSettings
} from './tenant-config';

describe('TenantConfigService', () => {
  let service: TenantConfigService;
  let mockDb: any;
  
  const tenantId = 'tenant-123';
  const encryptionKey = 'test-encryption-key-32-characters';
  
  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
      query: {
        paymentGatewayConfigs: {
          findFirst: vi.fn().mockResolvedValue(null)
        }
      }
    };
    
    service = new TenantConfigService(mockDb, encryptionKey);
    vi.clearAllMocks();
  });
  
  describe('getSettings', () => {
    it('should return null when tenant has no settings', async () => {
      mockDb.limit.mockResolvedValueOnce([{ id: tenantId, settings: null }]);
      
      const result = await service.getSettings(tenantId);
      
      expect(result).toBeNull();
    });
    
    it('should return parsed settings when available', async () => {
      const settings: TenantSettings = {
        theme: DEFAULT_THEMES['bistro-noir'],
        features: {
          enableQRMenu: true,
          enableKitchenDisplay: true
        }
      };
      
      mockDb.limit.mockResolvedValueOnce([{
        id: tenantId,
        settings: JSON.stringify(settings)
      }]);
      
      const result = await service.getSettings(tenantId);
      
      expect(result).toEqual(settings);
    });
    
    it('should return null when settings JSON is invalid', async () => {
      mockDb.limit.mockResolvedValueOnce([{
        id: tenantId,
        settings: 'invalid-json'
      }]);
      
      const result = await service.getSettings(tenantId);
      
      expect(result).toBeNull();
    });
  });
  
  describe('updateSettings', () => {
    it('should merge new settings with existing settings', async () => {
      const existingSettings: TenantSettings = {
        theme: DEFAULT_THEMES['bistro-noir'],
        features: {
          enableQRMenu: true
        }
      };
      
      mockDb.limit.mockResolvedValueOnce([{
        id: tenantId,
        settings: JSON.stringify(existingSettings)
      }]);
      
      const newSettings: Partial<TenantSettings> = {
        features: {
          enableKitchenDisplay: true
        }
      };
      
      const result = await service.updateSettings(tenantId, newSettings);
      
      expect(result.theme).toEqual(DEFAULT_THEMES['bistro-noir']);
      expect(result.features).toEqual({
        enableQRMenu: true,
        enableKitchenDisplay: true
      });
      expect(mockDb.update).toHaveBeenCalled();
    });
    
    it('should create new settings when none exist', async () => {
      mockDb.limit.mockResolvedValueOnce([{ id: tenantId, settings: null }]);
      
      const newSettings: Partial<TenantSettings> = {
        theme: DEFAULT_THEMES['neon-diner']
      };
      
      const result = await service.updateSettings(tenantId, newSettings);
      
      expect(result.theme).toEqual(DEFAULT_THEMES['neon-diner']);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
  
  describe('getThemeConfig', () => {
    it('should return theme configuration', async () => {
      const settings: TenantSettings = {
        theme: DEFAULT_THEMES['bistro-noir']
      };
      
      mockDb.limit.mockResolvedValueOnce([{
        id: tenantId,
        settings: JSON.stringify(settings)
      }]);
      
      const result = await service.getThemeConfig(tenantId);
      
      expect(result).toEqual(DEFAULT_THEMES['bistro-noir']);
    });
    
    it('should return null when no theme configured', async () => {
      mockDb.limit.mockResolvedValueOnce([{
        id: tenantId,
        settings: JSON.stringify({})
      }]);
      
      const result = await service.getThemeConfig(tenantId);
      
      expect(result).toBeNull();
    });
  });
  
  describe('updateThemeConfig', () => {
    it('should update theme configuration', async () => {
      mockDb.limit.mockResolvedValueOnce([{
        id: tenantId,
        settings: JSON.stringify({})
      }]);
      
      const theme = DEFAULT_THEMES['neon-diner'];
      const result = await service.updateThemeConfig(tenantId, theme);
      
      expect(result).toEqual(theme);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
  
  describe('getBrandingAssets', () => {
    it('should return branding assets', async () => {
      const branding: BrandingAssets = {
        logo: 'https://example.com/logo.png',
        favicon: 'https://example.com/favicon.ico',
        bannerImages: [
          {
            id: 'banner-1',
            name: 'Main Banner',
            url: 'https://example.com/banner.jpg',
            width: 1920,
            height: 1080,
            category: 'hero'
          }
        ]
      };
      
      const settings: TenantSettings = { branding };
      
      mockDb.limit.mockResolvedValueOnce([{
        id: tenantId,
        settings: JSON.stringify(settings)
      }]);
      
      const result = await service.getBrandingAssets(tenantId);
      
      expect(result).toEqual(branding);
    });
    
    it('should return null when no branding configured', async () => {
      mockDb.limit.mockResolvedValueOnce([{
        id: tenantId,
        settings: JSON.stringify({})
      }]);
      
      const result = await service.getBrandingAssets(tenantId);
      
      expect(result).toBeNull();
    });
  });
  
  describe('updateBrandingAssets', () => {
    it('should update branding assets', async () => {
      mockDb.limit.mockResolvedValueOnce([{
        id: tenantId,
        settings: JSON.stringify({})
      }]);
      
      const branding: BrandingAssets = {
        logo: 'https://example.com/logo.png',
        bannerImages: []
      };
      
      const result = await service.updateBrandingAssets(tenantId, branding);
      
      expect(result).toEqual(branding);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
  
  describe('configurePaymentGateway', () => {
    it('should create new payment gateway configuration', async () => {
      mockDb.limit.mockResolvedValueOnce([{
        id: tenantId,
        settings: JSON.stringify({})
      }]);
      
      const credentials = {
        provider: 'MERCADO_PAGO' as const,
        accessToken: 'test-access-token',
        publicKey: 'test-public-key',
        webhookUrl: 'https://example.com/webhook'
      };
      
      const result = await service.configurePaymentGateway(tenantId, credentials);
      
      expect(result.success).toBe(true);
      expect(result.configId).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });
    
    it('should update existing payment gateway configuration', async () => {
      const existingConfig = {
        id: 'config-123',
        tenantId,
        provider: 'MERCADO_PAGO',
        accessToken: 'old-token',
        publicKey: 'old-key',
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      mockDb.query.paymentGatewayConfigs.findFirst.mockResolvedValueOnce(existingConfig);
      mockDb.limit.mockResolvedValueOnce([{
        id: tenantId,
        settings: JSON.stringify({})
      }]);
      
      const credentials = {
        provider: 'MERCADO_PAGO' as const,
        accessToken: 'new-access-token',
        publicKey: 'new-public-key'
      };
      
      const result = await service.configurePaymentGateway(tenantId, credentials);
      
      expect(result.success).toBe(true);
      expect(result.configId).toBe('config-123');
      expect(mockDb.update).toHaveBeenCalled();
    });
    
    it('should handle configuration errors', async () => {
      mockDb.query.paymentGatewayConfigs.findFirst.mockRejectedValueOnce(
        new Error('Database error')
      );
      
      const credentials = {
        provider: 'MERCADO_PAGO' as const,
        accessToken: 'test-access-token',
        publicKey: 'test-public-key'
      };
      
      const result = await service.configurePaymentGateway(tenantId, credentials);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
  
  describe('getPaymentGatewayConfig', () => {
    it('should return active payment gateway configuration', async () => {
      const config = {
        id: 'config-123',
        tenantId,
        provider: 'MERCADO_PAGO',
        accessToken: 'encrypted-token',
        publicKey: 'public-key',
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      mockDb.query.paymentGatewayConfigs.findFirst.mockResolvedValueOnce(config);
      
      const result = await service.getPaymentGatewayConfig(tenantId);
      
      expect(result).toEqual(config);
    });
    
    it('should return null when no active configuration exists', async () => {
      mockDb.query.paymentGatewayConfigs.findFirst.mockResolvedValueOnce(null);
      
      const result = await service.getPaymentGatewayConfig(tenantId);
      
      expect(result).toBeNull();
    });
  });
  
  describe('deactivatePaymentGateway', () => {
    it('should deactivate payment gateway', async () => {
      mockDb.limit.mockResolvedValueOnce([{
        id: tenantId,
        settings: JSON.stringify({})
      }]);
      
      const result = await service.deactivatePaymentGateway(tenantId);
      
      expect(result.success).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });
    
    it('should handle deactivation errors', async () => {
      mockDb.update.mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      const result = await service.deactivatePaymentGateway(tenantId);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
  
  describe('getFeatureFlags', () => {
    it('should return feature flags from settings', async () => {
      const settings: TenantSettings = {
        features: {
          enableQRMenu: true,
          enableKitchenDisplay: false,
          enableWaiterPanel: true
        }
      };
      
      mockDb.limit.mockResolvedValueOnce([{
        id: tenantId,
        settings: JSON.stringify(settings)
      }]);
      
      const result = await service.getFeatureFlags(tenantId);
      
      expect(result).toEqual(settings.features);
    });
    
    it('should return default feature flags when none configured', async () => {
      mockDb.limit.mockResolvedValueOnce([{
        id: tenantId,
        settings: JSON.stringify({})
      }]);
      
      const result = await service.getFeatureFlags(tenantId);
      
      expect(result).toEqual({
        enableQRMenu: true,
        enableKitchenDisplay: true,
        enableWaiterPanel: true,
        enableCashierPanel: true,
        enableCommissions: true,
        enableSplitPayments: true
      });
    });
  });
  
  describe('updateFeatureFlags', () => {
    it('should update feature flags', async () => {
      mockDb.limit.mockResolvedValueOnce([{
        id: tenantId,
        settings: JSON.stringify({})
      }]);
      
      const features = {
        enableQRMenu: true,
        enableKitchenDisplay: false
      };
      
      const result = await service.updateFeatureFlags(tenantId, features);
      
      expect(result).toEqual(features);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
  
  describe('createTenantConfigService', () => {
    it('should create service instance', () => {
      const service = createTenantConfigService(mockDb, encryptionKey);
      
      expect(service).toBeInstanceOf(TenantConfigService);
    });
  });
  
  describe('DEFAULT_THEMES', () => {
    it('should include all theme configurations', () => {
      expect(DEFAULT_THEMES).toHaveProperty('bistro-noir');
      expect(DEFAULT_THEMES).toHaveProperty('neon-diner');
      expect(DEFAULT_THEMES).toHaveProperty('organic-garden');
      expect(DEFAULT_THEMES).toHaveProperty('signature');
    });
    
    it('should have valid theme structure', () => {
      Object.values(DEFAULT_THEMES).forEach((theme) => {
        expect(theme).toHaveProperty('theme');
        expect(theme).toHaveProperty('palette');
        expect(theme).toHaveProperty('typography');
        expect(theme).toHaveProperty('bannerDefaults');
        
        expect(theme.palette).toHaveProperty('primary');
        expect(theme.palette).toHaveProperty('secondary');
        expect(theme.palette).toHaveProperty('accent');
        
        expect(theme.typography).toHaveProperty('headingFont');
        expect(theme.typography).toHaveProperty('bodyFont');
        
        expect(theme.bannerDefaults).toHaveProperty('backgroundType');
        expect(theme.bannerDefaults).toHaveProperty('textColor');
        expect(theme.bannerDefaults).toHaveProperty('overlayOpacity');
      });
    });
  });
});
