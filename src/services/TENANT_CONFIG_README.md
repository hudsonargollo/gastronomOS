# Tenant Configuration Management Service

This document describes the tenant configuration management service for the Digital Menu, Kitchen Orchestration & Payment System.

## Overview

The tenant configuration service manages tenant-specific settings including:

1. Payment gateway configuration (Mercado Pago)
2. Design system theme configuration
3. Branding asset management
4. Feature flags
5. Business information
6. Notification settings

## Requirements Addressed

- **Requirement 8.3**: Store tenant-specific configurations including payment gateway settings
- **Requirement 8.5**: Maintain separate audit logs per tenant
- **Requirement 12.2**: Store Mercado Pago API credentials securely in tenant settings
- **Requirement 12.3**: Support different payment gateway configurations per tenant

## Service Interface

### `ITenantConfigService`

```typescript
interface ITenantConfigService {
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
```

## Data Models

### TenantSettings

Complete tenant settings structure:

```typescript
interface TenantSettings {
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
```

### ThemeConfig

Design system theme configuration:

```typescript
interface ThemeConfig {
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
```

### BrandingAssets

Tenant branding assets:

```typescript
interface BrandingAssets {
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
```

### PaymentGatewayCredentials

Payment gateway credentials (encrypted):

```typescript
interface PaymentGatewayCredentials {
  provider: PaymentGatewayProvider;
  accessToken: string;
  publicKey: string;
  webhookUrl?: string;
}
```

## Usage Examples

### 1. Get Tenant Settings

```typescript
import { createTenantConfigService } from './services/tenant-config';

const configService = createTenantConfigService(db, encryptionKey);
const settings = await configService.getSettings(tenantId);

if (settings) {
  console.log('Theme:', settings.theme?.theme);
  console.log('Features:', settings.features);
}
```

### 2. Update Theme Configuration

```typescript
import { DEFAULT_THEMES } from './services/tenant-config';

const configService = createTenantConfigService(db, encryptionKey);

// Use a default theme
const theme = await configService.updateThemeConfig(
  tenantId,
  DEFAULT_THEMES['bistro-noir']
);

// Or create a custom theme
const customTheme: ThemeConfig = {
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
};

await configService.updateThemeConfig(tenantId, customTheme);
```

### 3. Configure Payment Gateway

```typescript
const configService = createTenantConfigService(db, encryptionKey);

const result = await configService.configurePaymentGateway(tenantId, {
  provider: 'MERCADO_PAGO',
  accessToken: 'TEST-1234567890123456-123456-abcdef1234567890abcdef1234567890-123456789',
  publicKey: 'TEST-abcdef12-3456-7890-abcd-ef1234567890',
  webhookUrl: 'https://example.com/webhooks/mercadopago'
});

if (result.success) {
  console.log('Payment gateway configured:', result.configId);
} else {
  console.error('Configuration failed:', result.error);
}
```

### 4. Update Branding Assets

```typescript
const configService = createTenantConfigService(db, encryptionKey);

const branding: BrandingAssets = {
  logo: 'https://example.com/logo.png',
  favicon: 'https://example.com/favicon.ico',
  bannerImages: [
    {
      id: 'banner-1',
      name: 'Hero Banner',
      url: 'https://example.com/hero.jpg',
      width: 1920,
      height: 1080,
      category: 'hero'
    }
  ],
  customIcons: [
    {
      id: 'icon-1',
      name: 'Custom Menu Icon',
      svg: '<svg>...</svg>'
    }
  ]
};

await configService.updateBrandingAssets(tenantId, branding);
```

### 5. Manage Feature Flags

```typescript
const configService = createTenantConfigService(db, encryptionKey);

// Get current feature flags
const features = await configService.getFeatureFlags(tenantId);

// Update feature flags
await configService.updateFeatureFlags(tenantId, {
  enableQRMenu: true,
  enableKitchenDisplay: true,
  enableWaiterPanel: false,
  enableCashierPanel: true,
  enableCommissions: true,
  enableSplitPayments: false
});
```

## Default Themes

The service provides four pre-configured themes:

### 1. Bistro Noir

Classic, elegant theme with dark accents and gold highlights.

```typescript
DEFAULT_THEMES['bistro-noir']
```

### 2. Neon Diner

Modern, vibrant theme with neon colors and gradients.

```typescript
DEFAULT_THEMES['neon-diner']
```

### 3. Organic Garden

Natural, fresh theme with green tones and organic feel.

```typescript
DEFAULT_THEMES['organic-garden']
```

### 4. Signature

Neutral, customizable theme for brand-specific styling.

```typescript
DEFAULT_THEMES['signature']
```

## Security Features

### 1. Credential Encryption

Payment gateway credentials are encrypted using AES-256-GCM:

```typescript
const encryptionService = new EncryptionService(encryptionKey);
const encrypted = await encryptionService.encrypt(accessToken);
```

### 2. Tenant Isolation

All configuration operations are tenant-scoped:

```typescript
// Settings are stored per tenant
await configService.updateSettings(tenantId, settings);

// Payment gateway configs are tenant-specific
await configService.configurePaymentGateway(tenantId, credentials);
```

### 3. Secure Storage

- Payment gateway credentials stored encrypted in database
- Encryption keys managed via environment variables
- No plaintext credentials in database or logs

## Testing

Unit tests are provided in `tenant-config.test.ts`:

```bash
npm test src/services/tenant-config.test.ts
```

Tests cover:
- Settings management (get, update, merge)
- Theme configuration
- Branding assets management
- Payment gateway configuration
- Feature flags management
- Default themes validation

## API Integration

### Complete Route Example

```typescript
import { Hono } from 'hono';
import { authenticate, injectTenantContext, injectAuditService } from './middleware/auth';
import { enforceTenantIsolation, getTenantId } from './middleware/tenant-isolation';
import { createTenantConfigService } from './services/tenant-config';

const app = new Hono();

// Get tenant settings
app.get(
  '/api/tenant/settings',
  authenticate(),
  injectTenantContext(),
  injectAuditService(),
  enforceTenantIsolation(),
  async (c) => {
    const tenantId = getTenantId(c);
    const db = c.get('db');
    const encryptionKey = c.env.PAYMENT_ENCRYPTION_KEY;
    
    const configService = createTenantConfigService(db, encryptionKey);
    const settings = await configService.getSettings(tenantId);
    
    return c.json({ settings });
  }
);

// Update theme
app.put(
  '/api/tenant/theme',
  authenticate(),
  injectTenantContext(),
  injectAuditService(),
  enforceTenantIsolation(),
  async (c) => {
    const tenantId = getTenantId(c);
    const db = c.get('db');
    const encryptionKey = c.env.PAYMENT_ENCRYPTION_KEY;
    
    const { themeName } = await c.req.json();
    
    const configService = createTenantConfigService(db, encryptionKey);
    const theme = await configService.updateThemeConfig(
      tenantId,
      DEFAULT_THEMES[themeName]
    );
    
    return c.json({ theme });
  }
);

// Configure payment gateway
app.post(
  '/api/tenant/payment-gateway',
  authenticate(),
  injectTenantContext(),
  injectAuditService(),
  enforceTenantIsolation(),
  async (c) => {
    const tenantId = getTenantId(c);
    const db = c.get('db');
    const encryptionKey = c.env.PAYMENT_ENCRYPTION_KEY;
    
    const credentials = await c.req.json();
    
    const configService = createTenantConfigService(db, encryptionKey);
    const result = await configService.configurePaymentGateway(
      tenantId,
      credentials
    );
    
    if (!result.success) {
      return c.json({ error: result.error }, 500);
    }
    
    return c.json({ configId: result.configId });
  }
);

export default app;
```

## Best Practices

1. **Always encrypt payment credentials** using the encryption service
2. **Use default themes** as starting points for customization
3. **Validate theme configurations** before applying
4. **Store branding assets** in a CDN for better performance
5. **Use feature flags** to enable/disable functionality per tenant
6. **Monitor configuration changes** through audit logs
7. **Test payment gateway credentials** before activating

## Performance Considerations

- Settings are stored as JSON in the database
- Consider caching frequently accessed settings
- Branding assets should be served from CDN
- Payment gateway configs are cached after first retrieval

## Troubleshooting

### "Failed to parse tenant settings"

**Cause:** Invalid JSON in tenant settings field

**Solution:** Validate settings structure before saving

### "Encryption service not available"

**Cause:** Missing or invalid encryption key

**Solution:** Ensure `PAYMENT_ENCRYPTION_KEY` environment variable is set

### "Payment gateway configuration failed"

**Cause:** Invalid credentials or database error

**Solution:** Validate credentials format and check database connectivity

## Future Enhancements

- Multi-currency support
- Multiple payment gateway providers
- Theme preview functionality
- Branding asset validation
- Configuration versioning
- Configuration rollback
- Configuration templates
