/**
 * Stock Alert Configurations API Routes
 * Handles per-product stock alert thresholds
 * 
 * Pontal Stock - Stock Alert Configuration System
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc, asc } from 'drizzle-orm';
import { getDb } from '../db';
import { stockAlertConfigs } from '../db/schema';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Validation schemas
const createStockAlertConfigSchema = z.object({
  productId: z.string().min(1),
  locationId: z.string().min(1),
  alertThresholdPercent: z.number().int().min(1).max(100),
  alertThresholdQuantity: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
});

const updateStockAlertConfigSchema = z.object({
  alertThresholdPercent: z.number().int().min(1).max(100).optional(),
  alertThresholdQuantity: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

// Middleware to extract tenant ID
app.use('*', async (c, next) => {
  const tenantId = c.req.header('x-tenant-id') || c.req.query('tenantId');
  if (!tenantId) {
    return c.json({ error: 'Tenant ID is required' }, 400);
  }
  c.set('tenantId', tenantId);
  await next();
});

/**
 * Create Stock Alert Configuration
 * POST /api/v1/stock-alert-configs
 */
app.post('/', zValidator('json', createStockAlertConfigSchema), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const body = c.req.valid('json');
    const db = getDb(c.env);

    const id = `sac-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Math.floor(Date.now() / 1000);

    const result = await db.insert(stockAlertConfigs).values({
      id,
      tenantId,
      productId: body.productId,
      locationId: body.locationId,
      alertThresholdPercent: body.alertThresholdPercent,
      alertThresholdQuantity: body.alertThresholdQuantity || null,
      isActive: body.isActive ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    }).run();

    return c.json({
      success: true,
      data: {
        id,
        productId: body.productId,
        locationId: body.locationId,
        alertThresholdPercent: body.alertThresholdPercent,
        alertThresholdQuantity: body.alertThresholdQuantity || null,
        isActive: body.isActive,
        createdAt: now,
        updatedAt: now,
      },
    }, 201);
  } catch (error) {
    console.error('Error creating stock alert config:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * List Stock Alert Configurations
 * GET /api/v1/stock-alert-configs
 */
app.get('/', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const productId = c.req.query('productId');
    const locationId = c.req.query('locationId');
    const isActive = c.req.query('isActive');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');

    const db = getDb(c.env);
    const offset = (page - 1) * limit;

    // Build query
    let query = db.select().from(stockAlertConfigs).where(eq(stockAlertConfigs.tenantId, tenantId));

    if (productId) {
      query = query.where(eq(stockAlertConfigs.productId, productId));
    }

    if (locationId) {
      query = query.where(eq(stockAlertConfigs.locationId, locationId));
    }

    if (isActive !== undefined) {
      const isActiveValue = isActive === 'true' ? 1 : 0;
      query = query.where(eq(stockAlertConfigs.isActive, isActiveValue as any));
    }

    // Get total count
    const countResult = await query.run();
    const total = countResult.length;

    const items = await query
      .orderBy(asc(stockAlertConfigs.createdAt))
      .limit(limit)
      .offset(offset)
      .run();

    return c.json({
      success: true,
      data: {
        items: items.map(item => ({
          id: item.id,
          productId: item.productId,
          locationId: item.locationId,
          alertThresholdPercent: item.alertThresholdPercent,
          alertThresholdQuantity: item.alertThresholdQuantity,
          isActive: item.isActive === 1,
          createdAt: item.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error listing stock alert configs:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Get Stock Alert Configuration Details
 * GET /api/v1/stock-alert-configs/:id
 */
app.get('/:id', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const id = c.req.param('id');
    const db = getDb(c.env);

    const result = await db
      .select()
      .from(stockAlertConfigs)
      .where(and(eq(stockAlertConfigs.id, id), eq(stockAlertConfigs.tenantId, tenantId)))
      .run();

    if (result.length === 0) {
      return c.json({ error: 'Stock alert config not found' }, 404);
    }

    const item = result[0];
    return c.json({
      success: true,
      data: {
        id: item.id,
        productId: item.productId,
        locationId: item.locationId,
        alertThresholdPercent: item.alertThresholdPercent,
        alertThresholdQuantity: item.alertThresholdQuantity,
        isActive: item.isActive === 1,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error getting stock alert config:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Update Stock Alert Configuration
 * PUT /api/v1/stock-alert-configs/:id
 */
app.put('/:id', zValidator('json', updateStockAlertConfigSchema), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const id = c.req.param('id');
    const body = c.req.valid('json');
    const db = getDb(c.env);

    const now = Math.floor(Date.now() / 1000);
    const updates: any = { updatedAt: now };

    if (body.alertThresholdPercent !== undefined) {
      updates.alertThresholdPercent = body.alertThresholdPercent;
    }
    if (body.alertThresholdQuantity !== undefined) {
      updates.alertThresholdQuantity = body.alertThresholdQuantity;
    }
    if (body.isActive !== undefined) {
      updates.isActive = body.isActive ? 1 : 0;
    }

    await db
      .update(stockAlertConfigs)
      .set(updates)
      .where(and(eq(stockAlertConfigs.id, id), eq(stockAlertConfigs.tenantId, tenantId)))
      .run();

    // Fetch updated record
    const result = await db
      .select()
      .from(stockAlertConfigs)
      .where(and(eq(stockAlertConfigs.id, id), eq(stockAlertConfigs.tenantId, tenantId)))
      .run();

    if (result.length === 0) {
      return c.json({ error: 'Stock alert config not found' }, 404);
    }

    const item = result[0];
    return c.json({
      success: true,
      data: {
        id: item.id,
        productId: item.productId,
        locationId: item.locationId,
        alertThresholdPercent: item.alertThresholdPercent,
        alertThresholdQuantity: item.alertThresholdQuantity,
        isActive: item.isActive === 1,
        updatedAt: item.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating stock alert config:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Delete Stock Alert Configuration
 * DELETE /api/v1/stock-alert-configs/:id
 */
app.delete('/:id', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const id = c.req.param('id');
    const db = getDb(c.env);

    await db
      .delete(stockAlertConfigs)
      .where(and(eq(stockAlertConfigs.id, id), eq(stockAlertConfigs.tenantId, tenantId)))
      .run();

    return c.json({
      success: true,
      message: 'Stock alert config deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting stock alert config:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;
