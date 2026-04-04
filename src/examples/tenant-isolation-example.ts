/**
 * Example: Tenant Isolation and Configuration Management
 * 
 * This example demonstrates how to use the tenant isolation middleware
 * and tenant configuration service together in a Hono application.
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { authenticate, injectTenantContext, injectAuditService } from '../middleware/auth';
import {
  enforceTenantIsolation,
  getTenantId,
  validateTenantOwnership
} from '../middleware/tenant-isolation';
import { createTenantConfigService, DEFAULT_THEMES } from '../services/tenant-config';

// Create Hono app
const app = new Hono();

// Environment bindings
interface Env {
  DB: D1Database;
  PAYMENT_ENCRYPTION_KEY: string;
}

/**
 * Example 1: Basic tenant isolation
 * 
 * This route demonstrates how to enforce tenant isolation on an API endpoint.
 */
app.get(
  '/api/tenants/:tenantId/orders',
  authenticate(),
  injectTenantContext(),
  injectAuditService(),
  enforceTenantIsolation(), // Enforces tenant isolation
  async (c) => {
    const tenantId = getTenantId(c);
    const db = c.get('db');
    
    // All queries are automatically scoped to the tenant
    // The middleware ensures tenantId matches the authenticated user's tenant
    
    return c.json({
      message: 'Orders retrieved successfully',
      tenantId
    });
  }
);

/**
 * Example 2: Tenant configuration management
 * 
 * This route demonstrates how to manage tenant settings including
 * theme configuration, branding assets, and payment gateway setup.
 */
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
    
    // Create tenant config service
    const configService = createTenantConfigService(db, encryptionKey);
    
    // Get all tenant settings
    const settings = await configService.getSettings(tenantId);
    
    return c.json({
      settings: settings || {
        message: 'No settings configured yet'
      }
    });
  }
);

/**
 * Example 3: Update theme configuration
 * 
 * This route demonstrates how to update tenant theme configuration.
 */
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
    
    const body = await c.req.json();
    const { themeName } = body;
    
    // Validate theme name
    if (!DEFAULT_THEMES[themeName]) {
      return c.json({
        error: 'Invalid theme name',
        availableThemes: Object.keys(DEFAULT_THEMES)
      }, 400);
    }
    
    // Create tenant config service
    const configService = createTenantConfigService(db, encryptionKey);
    
    // Update theme
    const theme = await configService.updateThemeConfig(
      tenantId,
      DEFAULT_THEMES[themeName]
    );
    
    return c.json({
      message: 'Theme updated successfully',
      theme
    });
  }
);

/**
 * Example 4: Configure payment gateway
 * 
 * This route demonstrates how to configure payment gateway credentials
 * for a tenant with proper encryption.
 */
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
    
    const body = await c.req.json();
    const { accessToken, publicKey, webhookUrl } = body;
    
    // Validate required fields
    if (!accessToken || !publicKey) {
      return c.json({
        error: 'Access token and public key are required'
      }, 400);
    }
    
    // Create tenant config service
    const configService = createTenantConfigService(db, encryptionKey);
    
    // Configure payment gateway
    const result = await configService.configurePaymentGateway(tenantId, {
      provider: 'MERCADO_PAGO',
      accessToken,
      publicKey,
      webhookUrl
    });
    
    if (!result.success) {
      return c.json({
        error: 'Failed to configure payment gateway',
        message: result.error
      }, 500);
    }
    
    return c.json({
      message: 'Payment gateway configured successfully',
      configId: result.configId
    });
  }
);

/**
 * Example 5: Update branding assets
 * 
 * This route demonstrates how to update tenant branding assets.
 */
app.put(
  '/api/tenant/branding',
  authenticate(),
  injectTenantContext(),
  injectAuditService(),
  enforceTenantIsolation(),
  async (c) => {
    const tenantId = getTenantId(c);
    const db = c.get('db');
    const encryptionKey = c.env.PAYMENT_ENCRYPTION_KEY;
    
    const body = await c.req.json();
    const { logo, favicon, bannerImages } = body;
    
    // Create tenant config service
    const configService = createTenantConfigService(db, encryptionKey);
    
    // Update branding assets
    const branding = await configService.updateBrandingAssets(tenantId, {
      logo,
      favicon,
      bannerImages: bannerImages || []
    });
    
    return c.json({
      message: 'Branding assets updated successfully',
      branding
    });
  }
);

/**
 * Example 6: Validate resource ownership
 * 
 * This route demonstrates how to validate that a resource belongs
 * to the authenticated tenant before allowing access.
 */
app.get(
  '/api/orders/:orderId',
  authenticate(),
  injectTenantContext(),
  injectAuditService(),
  enforceTenantIsolation(),
  async (c) => {
    const orderId = c.req.param('orderId');
    const db = c.get('db');
    
    // Fetch order from database
    // const order = await db.query.orders.findFirst({
    //   where: eq(orders.id, orderId)
    // });
    
    // Simulate order fetch
    const order = {
      id: orderId,
      tenantId: 'tenant-123', // This would come from database
      totalAmount: 5000
    };
    
    // Validate tenant ownership
    const isOwner = await validateTenantOwnership(c, order.tenantId);
    
    if (!isOwner) {
      return c.json({
        error: 'Forbidden',
        message: 'You do not have access to this order'
      }, 403);
    }
    
    return c.json({
      order
    });
  }
);

/**
 * Example 7: Feature flags management
 * 
 * This route demonstrates how to manage tenant feature flags.
 */
app.get(
  '/api/tenant/features',
  authenticate(),
  injectTenantContext(),
  injectAuditService(),
  enforceTenantIsolation(),
  async (c) => {
    const tenantId = getTenantId(c);
    const db = c.get('db');
    const encryptionKey = c.env.PAYMENT_ENCRYPTION_KEY;
    
    // Create tenant config service
    const configService = createTenantConfigService(db, encryptionKey);
    
    // Get feature flags
    const features = await configService.getFeatureFlags(tenantId);
    
    return c.json({
      features
    });
  }
);

app.put(
  '/api/tenant/features',
  authenticate(),
  injectTenantContext(),
  injectAuditService(),
  enforceTenantIsolation(),
  async (c) => {
    const tenantId = getTenantId(c);
    const db = c.get('db');
    const encryptionKey = c.env.PAYMENT_ENCRYPTION_KEY;
    
    const body = await c.req.json();
    
    // Create tenant config service
    const configService = createTenantConfigService(db, encryptionKey);
    
    // Update feature flags
    const features = await configService.updateFeatureFlags(tenantId, body);
    
    return c.json({
      message: 'Feature flags updated successfully',
      features
    });
  }
);

export default app;
