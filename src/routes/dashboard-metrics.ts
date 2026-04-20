/**
 * Dashboard Metrics API Routes
 * Provides financial and inventory metrics for Pontal Stock dashboard
 * 
 * Pontal Stock - Dashboard System
 */

import { Hono } from 'hono';
import { eq, and, gte, lte } from 'drizzle-orm';
import { getDb } from '../db';
import { paymentSchedules, stockAlerts, inventoryItems, products } from '../db/schema';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

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
 * Get Dashboard Metrics
 * GET /api/v1/dashboard/metrics
 */
app.get('/metrics', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const locationId = c.req.query('locationId');
    const db = getDb(c.env);

    // Get inventory value
    let inventoryQuery = db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.tenantId, tenantId));

    if (locationId) {
      inventoryQuery = inventoryQuery.where(eq(inventoryItems.locationId, locationId));
    }

    const inventoryData = await inventoryQuery.run();
    const totalInventoryValueCents = inventoryData.reduce((sum, item) => {
      return sum + (item.quantity * item.unitCost);
    }, 0);

    // Get payments due (PENDING status)
    let paymentsQuery = db
      .select()
      .from(paymentSchedules)
      .where(and(eq(paymentSchedules.tenantId, tenantId), eq(paymentSchedules.status, 'PENDING')));

    const paymentsData = await paymentsQuery.run();
    const totalPaymentsPendingCents = paymentsData.reduce((sum, item) => {
      return sum + item.amountCents;
    }, 0);

    // Get stock alerts
    let alertsQuery = db
      .select()
      .from(stockAlerts)
      .where(and(eq(stockAlerts.tenantId, tenantId), eq(stockAlerts.status, 'ACTIVE')));

    const alertsData = await alertsQuery.run();

    // Get low stock count
    const lowStockCount = alertsData.filter(alert => alert.severity === 'CRITICAL' || alert.severity === 'HIGH').length;

    return c.json({
      success: true,
      data: {
        inventoryValue: {
          totalValueCents: totalInventoryValueCents,
          productCount: inventoryData.length,
          lowStockCount,
        },
        paymentsDue: paymentsData.map(payment => ({
          id: payment.id,
          purchaseOrderId: payment.purchaseOrderId,
          amountCents: payment.amountCents,
          dueDate: new Date(payment.dueDate * 1000).toISOString(),
          daysUntilDue: Math.ceil((payment.dueDate * 1000 - Date.now()) / (1000 * 60 * 60 * 24)),
          status: payment.status,
        })),
        stockAlerts: alertsData.map(alert => ({
          id: alert.id,
          productId: alert.productId,
          locationId: alert.locationId,
          currentQuantity: alert.currentQuantity,
          thresholdQuantity: alert.thresholdQuantity,
          severity: alert.severity,
          status: alert.status,
        })),
        totalPaymentsPendingCents,
      },
    });
  } catch (error) {
    console.error('Error getting dashboard metrics:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Get Payments Due
 * GET /api/v1/dashboard/payments-due
 */
app.get('/payments-due', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const daysAhead = parseInt(c.req.query('daysAhead') || '30');
    const db = getDb(c.env);

    const now = Math.floor(Date.now() / 1000);
    const futureDate = now + (daysAhead * 24 * 60 * 60);

    const paymentsData = await db
      .select()
      .from(paymentSchedules)
      .where(
        and(
          eq(paymentSchedules.tenantId, tenantId),
          eq(paymentSchedules.status, 'PENDING'),
          gte(paymentSchedules.dueDate, now),
          lte(paymentSchedules.dueDate, futureDate)
        )
      )
      .run();

    const totalAmount = paymentsData.reduce((sum, item) => sum + item.amountCents, 0);

    return c.json({
      success: true,
      data: {
        items: paymentsData.map(payment => ({
          id: payment.id,
          purchaseOrderId: payment.purchaseOrderId,
          amountCents: payment.amountCents,
          dueDate: new Date(payment.dueDate * 1000).toISOString(),
          daysUntilDue: Math.ceil((payment.dueDate * 1000 - Date.now()) / (1000 * 60 * 60 * 24)),
          status: payment.status,
        })),
        totalAmount,
        count: paymentsData.length,
      },
    });
  } catch (error) {
    console.error('Error getting payments due:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Get Inventory Value
 * GET /api/v1/dashboard/inventory-value
 */
app.get('/inventory-value', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const locationId = c.req.query('locationId');
    const db = getDb(c.env);

    let inventoryQuery = db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.tenantId, tenantId));

    if (locationId) {
      inventoryQuery = inventoryQuery.where(eq(inventoryItems.locationId, locationId));
    }

    const inventoryData = await inventoryQuery.run();
    const totalValueCents = inventoryData.reduce((sum, item) => {
      return sum + (item.quantity * item.unitCost);
    }, 0);

    // Get low stock count
    const alertsData = await db
      .select()
      .from(stockAlerts)
      .where(and(eq(stockAlerts.tenantId, tenantId), eq(stockAlerts.status, 'ACTIVE')))
      .run();

    const lowStockCount = alertsData.filter(alert => alert.severity === 'CRITICAL' || alert.severity === 'HIGH').length;

    return c.json({
      success: true,
      data: {
        totalValueCents,
        productCount: inventoryData.length,
        lowStockCount,
        byCategory: [], // Can be extended to group by category
      },
    });
  } catch (error) {
    console.error('Error getting inventory value:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Get Stock Alerts
 * GET /api/v1/dashboard/stock-alerts
 */
app.get('/stock-alerts', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const status = c.req.query('status') || 'ACTIVE';
    const severity = c.req.query('severity');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const db = getDb(c.env);

    const offset = (page - 1) * limit;

    let query = db
      .select()
      .from(stockAlerts)
      .where(and(eq(stockAlerts.tenantId, tenantId), eq(stockAlerts.status, status as any)));

    if (severity) {
      query = query.where(eq(stockAlerts.severity, severity as any));
    }

    const countResult = await query.run();
    const total = countResult.length;

    const items = await query
      .limit(limit)
      .offset(offset)
      .run();

    return c.json({
      success: true,
      data: {
        items: items.map(alert => ({
          id: alert.id,
          productId: alert.productId,
          locationId: alert.locationId,
          currentQuantity: alert.currentQuantity,
          thresholdQuantity: alert.thresholdQuantity,
          severity: alert.severity,
          status: alert.status,
          createdAt: new Date(alert.createdAt * 1000).toISOString(),
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
    console.error('Error getting stock alerts:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;
