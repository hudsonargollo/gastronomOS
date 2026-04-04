// API routes for Stock Alert System
// Requirements: 3.5

import { Hono } from 'hono';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { 
  createStockAlertService,
  type StockAlertConfigRequest,
  type StockMonitoringRequest,
  StockAlertErrorCode
} from '../services/stock-alert';
import { 
  StockAlertType,
  StockAlertSeverity,
  type StockAlertTypeValue,
  type StockAlertSeverityValue
} from '../db/schema';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Middleware to get database instance
app.use('*', async (c, next) => {
  const db = c.env.DB as DrizzleD1Database;
  c.set('db', db);
  await next();
});

// Middleware to extract tenant ID from headers or query params
app.use('*', async (c, next) => {
  const tenantId = c.req.header('x-tenant-id') || c.req.query('tenantId');
  if (!tenantId) {
    return c.json({ error: 'Tenant ID is required' }, 400);
  }
  c.set('tenantId', tenantId);
  await next();
});

/**
 * Create or update stock alert configuration
 * POST /stock-alerts/config
 */
app.post('/config', async (c) => {
  try {
    const db = c.get('db') as DrizzleD1Database;
    const tenantId = c.get('tenantId') as string;
    const stockAlertService = createStockAlertService(db);

    const body = await c.req.json();
    const {
      productId,
      locationId,
      lowStockThreshold,
      criticalStockThreshold,
      outOfStockThreshold,
      alertEnabled,
      emailNotifications,
      smsNotifications,
      createdBy
    } = body;

    // Validate required fields
    if (!productId || !locationId || !createdBy) {
      return c.json({
        error: 'Missing required fields: productId, locationId, createdBy'
      }, 400);
    }

    if (typeof lowStockThreshold !== 'number' || typeof criticalStockThreshold !== 'number') {
      return c.json({
        error: 'lowStockThreshold and criticalStockThreshold must be numbers'
      }, 400);
    }

    const request: StockAlertConfigRequest = {
      tenantId,
      productId,
      locationId,
      lowStockThreshold,
      criticalStockThreshold,
      outOfStockThreshold: outOfStockThreshold ?? 0,
      alertEnabled: alertEnabled ?? true,
      emailNotifications: emailNotifications ?? true,
      smsNotifications: smsNotifications ?? false,
      createdBy
    };

    const result = await stockAlertService.createOrUpdateAlertConfig(request);

    if (!result.success) {
      const statusCode = result.errorCode === StockAlertErrorCode.INVALID_THRESHOLD ? 400 : 500;
      return c.json({
        error: result.error,
        errorCode: result.errorCode
      }, statusCode);
    }

    return c.json({
      success: true,
      config: result.config
    });

  } catch (error) {
    console.error('Error creating/updating stock alert config:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

/**
 * Get stock alert configurations
 * GET /stock-alerts/config
 */
app.get('/config', async (c) => {
  try {
    const db = c.get('db') as DrizzleD1Database;
    const tenantId = c.get('tenantId') as string;
    const stockAlertService = createStockAlertService(db);

    const locationId = c.req.query('locationId');
    const productId = c.req.query('productId');

    // For now, we'll use the getStockLevelInfo method to get configurations
    // In a full implementation, you'd add a dedicated method to get configs
    const stockInfo = await stockAlertService.getStockLevelInfo(
      tenantId,
      locationId || '',
      productId ? [productId] : undefined
    );

    const configs = stockInfo.map(info => info.config).filter(Boolean);

    return c.json({
      success: true,
      configs
    });

  } catch (error) {
    console.error('Error getting stock alert configs:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

/**
 * Delete stock alert configuration
 * DELETE /stock-alerts/config/:productId/:locationId
 */
app.delete('/config/:productId/:locationId', async (c) => {
  try {
    const db = c.get('db') as DrizzleD1Database;
    const tenantId = c.get('tenantId') as string;
    const stockAlertService = createStockAlertService(db);

    const productId = c.req.param('productId');
    const locationId = c.req.param('locationId');

    if (!productId || !locationId) {
      return c.json({
        error: 'Product ID and Location ID are required'
      }, 400);
    }

    const result = await stockAlertService.deleteAlertConfig(tenantId, productId, locationId);

    if (!result.success) {
      return c.json({
        error: result.error
      }, 500);
    }

    return c.json({
      success: true,
      message: 'Alert configuration deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting stock alert config:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

/**
 * Monitor stock levels and generate alerts
 * POST /stock-alerts/monitor
 */
app.post('/monitor', async (c) => {
  try {
    const db = c.get('db') as DrizzleD1Database;
    const tenantId = c.get('tenantId') as string;
    const stockAlertService = createStockAlertService(db);

    const body = await c.req.json();
    const { locationId, productIds } = body;

    const request: StockMonitoringRequest = {
      tenantId,
      locationId,
      productIds
    };

    const result = await stockAlertService.monitorStockLevels(request);

    if (!result.success) {
      return c.json({
        error: result.error,
        errorCode: result.errorCode
      }, 500);
    }

    return c.json({
      success: true,
      alertsGenerated: result.alertsGenerated,
      alertsResolved: result.alertsResolved,
      summary: {
        newAlerts: result.alertsGenerated?.length || 0,
        resolvedAlerts: result.alertsResolved?.length || 0
      }
    });

  } catch (error) {
    console.error('Error monitoring stock levels:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

/**
 * Get stock alerts
 * GET /stock-alerts
 */
app.get('/', async (c) => {
  try {
    const db = c.get('db') as DrizzleD1Database;
    const tenantId = c.get('tenantId') as string;
    const stockAlertService = createStockAlertService(db);

    const locationId = c.req.query('locationId');
    const productId = c.req.query('productId');
    const alertType = c.req.query('alertType') as StockAlertTypeValue;
    const severity = c.req.query('severity') as StockAlertSeverityValue;
    const acknowledged = c.req.query('acknowledged');
    const resolved = c.req.query('resolved');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    // Validate enum values
    if (alertType && !Object.values(StockAlertType).includes(alertType)) {
      return c.json({
        error: 'Invalid alert type'
      }, 400);
    }

    if (severity && !Object.values(StockAlertSeverity).includes(severity)) {
      return c.json({
        error: 'Invalid severity'
      }, 400);
    }

    const options = {
      locationId,
      productId,
      alertType,
      severity,
      acknowledged: acknowledged ? acknowledged === 'true' : undefined,
      resolved: resolved ? resolved === 'true' : undefined,
      limit: Math.min(limit, 100), // Cap at 100
      offset: Math.max(offset, 0)
    };

    const result = await stockAlertService.getStockAlerts(tenantId, options);

    return c.json({
      success: true,
      alerts: result.alerts,
      total: result.total,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        hasMore: result.total > (options.offset + options.limit)
      }
    });

  } catch (error) {
    console.error('Error getting stock alerts:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

/**
 * Acknowledge a stock alert
 * POST /stock-alerts/:alertId/acknowledge
 */
app.post('/:alertId/acknowledge', async (c) => {
  try {
    const db = c.get('db') as DrizzleD1Database;
    const stockAlertService = createStockAlertService(db);

    const alertId = c.req.param('alertId');
    const body = await c.req.json();
    const { acknowledgedBy } = body;

    if (!alertId) {
      return c.json({
        error: 'Alert ID is required'
      }, 400);
    }

    if (!acknowledgedBy) {
      return c.json({
        error: 'acknowledgedBy is required'
      }, 400);
    }

    const result = await stockAlertService.acknowledgeAlert(alertId, acknowledgedBy);

    if (!result.success) {
      return c.json({
        error: result.error
      }, 500);
    }

    return c.json({
      success: true,
      message: 'Alert acknowledged successfully'
    });

  } catch (error) {
    console.error('Error acknowledging alert:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

/**
 * Get stock level information
 * GET /stock-alerts/stock-levels
 */
app.get('/stock-levels', async (c) => {
  try {
    const db = c.get('db') as DrizzleD1Database;
    const tenantId = c.get('tenantId') as string;
    const stockAlertService = createStockAlertService(db);

    const locationId = c.req.query('locationId');
    const productIds = c.req.query('productIds');

    if (!locationId) {
      return c.json({
        error: 'Location ID is required'
      }, 400);
    }

    const productIdArray = productIds ? productIds.split(',') : undefined;

    const stockInfo = await stockAlertService.getStockLevelInfo(
      tenantId,
      locationId,
      productIdArray
    );

    return c.json({
      success: true,
      stockLevels: stockInfo
    });

  } catch (error) {
    console.error('Error getting stock level info:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

/**
 * Health check endpoint
 * GET /stock-alerts/health
 */
app.get('/health', async (c) => {
  return c.json({
    status: 'healthy',
    service: 'stock-alert-system',
    timestamp: new Date().toISOString()
  });
});

export default app;