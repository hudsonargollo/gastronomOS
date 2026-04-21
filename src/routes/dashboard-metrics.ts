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

/**
 * Get Dashboard Metrics
 * GET /api/v1/dashboard/metrics
 */
app.get('/metrics', async (c) => {
  try {
    // Return mock data
    return c.json({
      success: true,
      data: {
        inventoryValue: {
          totalValueCents: 125000000,
          productCount: 247,
          lowStockCount: 12,
        },
        paymentsDue: [
          {
            id: '1',
            purchaseOrderId: 'PO-001',
            amountCents: 45000000,
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            daysUntilDue: 5,
            status: 'PENDING',
          },
        ],
        stockAlerts: [
          {
            id: '1',
            productId: 'PROD-001',
            locationId: 'LOC-001',
            currentQuantity: 8,
            thresholdQuantity: 40,
            severity: 'CRITICAL',
            status: 'ACTIVE',
          },
        ],
        totalPaymentsPendingCents: 57500000,
      },
    });
  } catch (error) {
    console.error('Error getting dashboard metrics:', error);
    return c.json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

/**
 * Get Payments Due
 * GET /api/v1/dashboard/payments-due
 */
app.get('/payments-due', async (c) => {
  try {
    // Return mock data
    return c.json({
      success: true,
      data: {
        items: [
          {
            id: '1',
            purchaseOrderId: 'PO-001',
            amountCents: 45000000,
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            daysUntilDue: 5,
            status: 'PENDING',
          },
        ],
        totalAmount: 45000000,
        count: 1,
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
    // Return mock data
    return c.json({
      success: true,
      data: {
        totalValueCents: 125000000,
        productCount: 247,
        lowStockCount: 12,
        byCategory: [],
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
    // Return mock data
    return c.json({
      success: true,
      data: {
        items: [
          {
            id: '1',
            productId: 'PROD-001',
            locationId: 'LOC-001',
            currentQuantity: 8,
            thresholdQuantity: 40,
            severity: 'CRITICAL',
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      },
    });
  } catch (error) {
    console.error('Error getting stock alerts:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;
