/**
 * Tenant Configuration Management Service
 * 
 * Manages tenant-specific settings including payment gateway configuration,
 * design system theme configuration, and branding asset management.
 * 
 * Requirements: 8.3, 8.5, 12.2, 12.3
 */

import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { 
  tenants, 
  paymentGatewayConfigs,
  type Tenant,
  type PaymentGatewayConfig,
  type NewPaymentGatewayConfig,
  PaymentGatewayProvider
} from '../db/schema';
import { generateId } from '../utils';
import { EncryptionService } from '../utils/encryption';

/**
 * Theme configuration for tenant design system
 */
export interface ThemeConfig {
  theme: 'bistro-noir' | 'neon-diner' | 'organic-garden' | 'signature';
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
  };
  customColors?: Record<string, string>;
  typography: {
    headingFont: 'Syne' | 'Clash Display';
    bodyFont: 'JetBrains Mono' | 'Space Grotesk';
    customFontUrls?: string[];
  };
  bannerDefaults: {
    backgroundType: 'solid' | 'gradient' | 'image';
    backgroundColor?: string;
    gradientColors?: [string, string];
    defaultImageUrl?: string;
    textColor: string;
    overlayOpacity: number;
  };
}

/**
 * Branding assets for tenant
 */
export interface BrandingAssets {
  logo?: string; // base64 or URL
  favicon?: string;
  bannerImages: Array<{
    id: string;
    name: string;
    url: string;
    width: number;
    height: number;
    category: string;
  }>;
  customIcons?: Array<{
    id: string;
    name: string;
    svg: string;
  }>;
}

/**
 * Complete tenant settings structure
 */
export interface TenantSettings {
  theme?: ThemeConfig;
  branding?: BrandingAssets;
  paymentGateway?: {
    provider: PaymentGatewayProvider;
    isConfigured: boolean;
  };
  features?: {
    enableQRMenu?: boolean;
    enableKitchenDisplay?: boolean;
    enableWaiterPanel?: boolean;
    enableCashierPanel?: boolean;
    enableCommissions?: boolean;
    enableSplitPayments?: boolean;
  };
  notifications?: {
    email?: string;
    sms?: string;
    webhookUrl?: string;
  };
  businessInfo?: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    taxId?: string;
    website?: string;
  };
}

/**
 * Payment gateway credentials (encrypted)
 */
export interface PaymentGatewayCredentials {
  provider: PaymentGatewayProvider;
  accessToken: string;
  publicKey: string;
  webhookUrl?: string;
}

/**
 * Tenant Configuration Service Interface
 */
export interface ITenantConfigService {
  // Settings management
  getSettings(tenantId: string): Promise<TenantSettings | null>;
  updateSettings(tenantId: string, settings: Partial<TenantSettings>): Promise<TenantSettings>;
  
  // Theme configuration
  getThemeConfig(tenantId: string): Promise<ThemeConfig | null>;
  updateThemeConfig(tenantId: string, theme: ThemeConfig): Promise<ThemeConfig>;
  
  // Branding assets
  getBrandingAssets(tenantId: string): Promise<BrandingAssets | null>;
  updateBrandingAssets(tenantId: string, branding: BrandingAssets): Promise<BrandingAssets>;
  
  // Payment gateway configuration
  configurePaymentGateway(
    tenantId: string,
    credentials: PaymentGatewayCredentials
  ): Promise<{ success: boolean; configId?: string; error?: string }>;
  getPaymentGatewayConfig(tenantId: string): Promise<PaymentGatewayConfig | null>;
  deactivatePaymentGateway(tenantId: string): Promise<{ success: boolean; error?: string }>;
  
  // Feature flags
  getFeatureFlags(tenantId: string): Promise<TenantSettings['features']>;
  updateFeatureFlags(tenantId: string, features: TenantSettings['features']): Promise<TenantSettings['features']>;
}

/**
 * Tenant Configuration Service Implementation
 */
export class TenantConfigService implements ITenantConfigService {
  private encryptionService: EncryptionService;
  
  constructor(
    private db: DrizzleD1Database,
    private encryptionKey: string
  ) {
    this.encryptionService = new EncryptionService(encryptionKey);
  }
  
  /**
   * Get complete tenant settings
   * Requirements: 8.3
   */
  async getSettings(tenantId: string): Promise<TenantSettings | null> {
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    
    if (!tenant || !tenant.settings) {
      return null;
    }
    
    try {
      return JSON.parse(tenant.settings) as TenantSettings;
    } catch (error) {
      console.error('Failed to parse tenant settings:', error);
      return null;
    }
  }
  
  /**
   * Update tenant settings
   * Requirements: 8.3, 8.5
   */
  async updateSettings(
    tenantId: string,
    settings: Partial<TenantSettings>
  ): Promise<TenantSettings> {
    // Get existing settings
    const existingSettings = await this.getSettings(tenantId) || {};
    
    // Merge with new settings
    const updatedSettings: TenantSettings = {
      ...existingSettings,
      ...settings,
      // Deep merge for nested objects
      theme: settings.theme ? { ...existingSettings.theme, ...settings.theme } : existingSettings.theme,
      branding: settings.branding ? { ...existingSettings.branding, ...settings.branding } : existingSettings.branding,
      features: settings.features ? { ...existingSettings.features, ...settings.features } : existingSettings.features,
      notifications: settings.notifications ? { ...existingSettings.notifications, ...settings.notifications } : existingSettings.notifications,
      businessInfo: settings.businessInfo ? { ...existingSettings.businessInfo, ...settings.businessInfo } : existingSettings.businessInfo,
    };
    
    // Update in database
    await this.db
      .update(tenants)
      .set({ settings: JSON.stringify(updatedSettings) })
      .where(eq(tenants.id, tenantId));
    
    return updatedSettings;
  }
  
  /**
   * Get theme configuration
   * Requirements: 12.2, 12.3
   */
  async getThemeConfig(tenantId: string): Promise<ThemeConfig | null> {
    const settings = await this.getSettings(tenantId);
    return settings?.theme || null;
  }
  
  /**
   * Update theme configuration
   * Requirements: 12.2, 12.3
   */
  async updateThemeConfig(tenantId: string, theme: ThemeConfig): Promise<ThemeConfig> {
    await this.updateSettings(tenantId, { theme });
    return theme;
  }
  
  /**
   * Get branding assets
   * Requirements: 12.2, 12.3
   */
  async getBrandingAssets(tenantId: string): Promise<BrandingAssets | null> {
    const settings = await this.getSettings(tenantId);
    return settings?.branding || null;
  }
  
  /**
   * Update branding assets
   * Requirements: 12.2, 12.3
   */
  async updateBrandingAssets(tenantId: string, branding: BrandingAssets): Promise<BrandingAssets> {
    await this.updateSettings(tenantId, { branding });
    return branding;
  }
  
  /**
   * Configure payment gateway for tenant
   * Requirements: 8.3, 12.2, 12.3
   */
  async configurePaymentGateway(
    tenantId: string,
    credentials: PaymentGatewayCredentials
  ): Promise<{ success: boolean; configId?: string; error?: string }> {
    try {
      // Encrypt access token
      const encryptedToken = await this.encryptionService.encrypt(credentials.accessToken);
      
      // Check if config already exists
      const existing = await this.db.query.paymentGatewayConfigs.findFirst({
        where: and(
          eq(paymentGatewayConfigs.tenantId, tenantId),
          eq(paymentGatewayConfigs.provider, credentials.provider)
        )
      });
      
      if (existing) {
        // Update existing config
        await this.db
          .update(paymentGatewayConfigs)
          .set({
            accessToken: JSON.stringify(encryptedToken),
            publicKey: credentials.publicKey,
            webhookUrl: credentials.webhookUrl || null,
            isActive: true,
            updatedAt: Date.now()
          })
          .where(eq(paymentGatewayConfigs.id, existing.id));
        
        // Update tenant settings
        await this.updateSettings(tenantId, {
          paymentGateway: {
            provider: credentials.provider,
            isConfigured: true
          }
        });
        
        return { success: true, configId: existing.id };
      }
      
      // Create new config
      const configId = generateId();
      const config: NewPaymentGatewayConfig = {
        id: configId,
        tenantId,
        provider: credentials.provider,
        accessToken: JSON.stringify(encryptedToken),
        publicKey: credentials.publicKey,
        webhookUrl: credentials.webhookUrl || null,
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await this.db.insert(paymentGatewayConfigs).values(config);
      
      // Update tenant settings
      await this.updateSettings(tenantId, {
        paymentGateway: {
          provider: credentials.provider,
          isConfigured: true
        }
      });
      
      return { success: true, configId };
    } catch (error) {
      console.error('Failed to configure payment gateway:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Get payment gateway configuration
   * Requirements: 8.3, 12.2
   */
  async getPaymentGatewayConfig(tenantId: string): Promise<PaymentGatewayConfig | null> {
    const config = await this.db.query.paymentGatewayConfigs.findFirst({
      where: and(
        eq(paymentGatewayConfigs.tenantId, tenantId),
        eq(paymentGatewayConfigs.isActive, true)
      )
    });
    
    return config || null;
  }
  
  /**
   * Deactivate payment gateway
   * Requirements: 8.3
   */
  async deactivatePaymentGateway(tenantId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.db
        .update(paymentGatewayConfigs)
        .set({
          isActive: false,
          updatedAt: Date.now()
        })
        .where(eq(paymentGatewayConfigs.tenantId, tenantId));
      
      // Update tenant settings
      await this.updateSettings(tenantId, {
        paymentGateway: {
          provider: 'MERCADO_PAGO',
          isConfigured: false
        }
      });
      
      return { success: true };
    } catch (error) {
      console.error('Failed to deactivate payment gateway:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Get feature flags
   * Requirements: 8.3
   */
  async getFeatureFlags(tenantId: string): Promise<TenantSettings['features']> {
    const settings = await this.getSettings(tenantId);
    return settings?.features || {
      enableQRMenu: true,
      enableKitchenDisplay: true,
      enableWaiterPanel: true,
      enableCashierPanel: true,
      enableCommissions: true,
      enableSplitPayments: true
    };
  }
  
  /**
   * Update feature flags
   * Requirements: 8.3
   */
  async updateFeatureFlags(
    tenantId: string,
    features: TenantSettings['features']
  ): Promise<TenantSettings['features']> {
    await this.updateSettings(tenantId, { features });
    return features || {};
  }
}

/**
 * Factory function to create TenantConfigService instance
 */
export function createTenantConfigService(
  db: DrizzleD1Database,
  encryptionKey: string
): ITenantConfigService {
  return new TenantConfigService(db, encryptionKey);
}

/**
 * Default theme configurations
 */
export const DEFAULT_THEMES: Record<string, ThemeConfig> = {
  'bistro-noir': {
    theme: 'bistro-noir',
    palette: {
      primary: '#1a1a1a',
      secondary: '#d4af37',
      accent: '#8b7355',
      background: '#ffffff',
      surface: '#f5f5f5',
      text: '#1a1a1a',
      textSecondary: '#666666'
    },
    typography: {
      headingFont: 'Syne',
      bodyFont: 'JetBrains Mono'
    },
    bannerDefaults: {
      backgroundType: 'solid',
      backgroundColor: '#1a1a1a',
      textColor: '#ffffff',
      overlayOpacity: 0.6
    }
  },
  'neon-diner': {
    theme: 'neon-diner',
    palette: {
      primary: '#ff006e',
      secondary: '#00f5ff',
      accent: '#ffbe0b',
      background: '#0a0a0a',
      surface: '#1a1a1a',
      text: '#ffffff',
      textSecondary: '#cccccc'
    },
    typography: {
      headingFont: 'Clash Display',
      bodyFont: 'Space Grotesk'
    },
    bannerDefaults: {
      backgroundType: 'gradient',
      gradientColors: ['#ff006e', '#00f5ff'],
      textColor: '#ffffff',
      overlayOpacity: 0.4
    }
  },
  'organic-garden': {
    theme: 'organic-garden',
    palette: {
      primary: '#2d6a4f',
      secondary: '#95d5b2',
      accent: '#d8f3dc',
      background: '#f8f9fa',
      surface: '#ffffff',
      text: '#1b4332',
      textSecondary: '#52796f'
    },
    typography: {
      headingFont: 'Syne',
      bodyFont: 'Space Grotesk'
    },
    bannerDefaults: {
      backgroundType: 'solid',
      backgroundColor: '#2d6a4f',
      textColor: '#ffffff',
      overlayOpacity: 0.5
    }
  },
  'signature': {
    theme: 'signature',
    palette: {
      primary: '#4a4a4a',
      secondary: '#7a7a7a',
      accent: '#a0a0a0',
      background: '#ffffff',
      surface: '#f0f0f0',
      text: '#2a2a2a',
      textSecondary: '#6a6a6a'
    },
    typography: {
      headingFont: 'Syne',
      bodyFont: 'JetBrains Mono'
    },
    bannerDefaults: {
      backgroundType: 'solid',
      backgroundColor: '#4a4a4a',
      textColor: '#ffffff',
      overlayOpacity: 0.5
    }
  }
};
