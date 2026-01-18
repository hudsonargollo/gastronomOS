import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';
import { 
  authenticate, 
  injectTenantContext,
  injectAuditService,
  getAuthContext,
  requirePurchaseOrderAccess
} from '../middleware/auth';
import { validateQuery, getValidatedQuery } from '../middleware/error';
import { createPurchasingAnalyticsService } from '../services/purchasing-analytics';

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
}

// Validation schemas
const dateRangeQuerySchema = z.object({
  startDate: z.string().datetime('Invalid start date format'),
  endDate: z.string().datetime('Invalid end date format'),
});

const topProductsQuerySchema = z.object({
  startDate: z.string().datetime('Invalid start date format'),
  endDate: z.string().datetime('Invalid end date format'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// Initialize purchasing analytics router
const purchasingAnalytics = new Hono<{ Bindings: Env }>();

// Apply authentication and context to all routes
purchasingAnalytics.use('*', authenticate());
purchasingAnalytics.use('*', injectTenantContext());
purchasingAnalytics.use('*', injectAuditService());

/**
 * GET /purchasing-analytics/spend/suppliers - Get spend analysis by supplier
 * Requirements: 2.6
 * 
 * This endpoint demonstrates:
 * - Supplier spend analysis and ranking
 * - Date range filtering for analytics
 * - Percentage calculations and insights
 * - Role-based access to analytics data
 */
purchasingAnalytics.get('/spend/suppliers',
  requirePurchaseOrderAccess('read'),
  validateQuery(dateRangeQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      startDate: string;
      endDate: string;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const analyticsService = createPurchasingAnalyticsService(db);
      
      const dateRange = {
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
      };
      
      const spendAnalysis = await analyticsService.getSpendAnalysisBySupplier(
        authContext.tenant_id,
        dateRange
      );
      
      return c.json({
        dateRange: {
          startDate: query.startDate,
          endDate: query.endDate,
        },
        suppliers: spendAnalysis,
        summary: {
          totalSuppliers: spendAnalysis.length,
          totalSpendCents: spendAnalysis.reduce((sum, s) => sum + s.totalSpendCents, 0),
          totalOrders: spendAnalysis.reduce((sum, s) => sum + s.orderCount, 0),
        },
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /purchasing-analytics/spend/categories - Get spend analysis by product category
 * Requirements: 2.6
 * 
 * This endpoint demonstrates:
 * - Category-based spend analysis
 * - Product categorization insights
 * - Spend distribution analysis
 * - Role-based access to analytics data
 */
purchasingAnalytics.get('/spend/categories',
  requirePurchaseOrderAccess('read'),
  validateQuery(dateRangeQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      startDate: string;
      endDate: string;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const analyticsService = createPurchasingAnalyticsService(db);
      
      const dateRange = {
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
      };
      
      const spendAnalysis = await analyticsService.getSpendAnalysisByCategory(
        authContext.tenant_id,
        dateRange
      );
      
      return c.json({
        dateRange: {
          startDate: query.startDate,
          endDate: query.endDate,
        },
        categories: spendAnalysis,
        summary: {
          totalCategories: spendAnalysis.length,
          totalSpendCents: spendAnalysis.reduce((sum, c) => sum + c.totalSpendCents, 0),
          totalOrders: spendAnalysis.reduce((sum, c) => sum + c.orderCount, 0),
        },
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /purchasing-analytics/performance/metrics - Get PO performance metrics and KPIs
 * Requirements: 2.6
 * 
 * This endpoint demonstrates:
 * - Purchase order performance KPIs
 * - Approval and receiving time metrics
 * - Status distribution analysis
 * - Comprehensive performance dashboard data
 */
purchasingAnalytics.get('/performance/metrics',
  requirePurchaseOrderAccess('read'),
  validateQuery(dateRangeQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      startDate: string;
      endDate: string;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const analyticsService = createPurchasingAnalyticsService(db);
      
      const dateRange = {
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
      };
      
      const metrics = await analyticsService.getPOPerformanceMetrics(
        authContext.tenant_id,
        dateRange
      );
      
      return c.json({
        dateRange: {
          startDate: query.startDate,
          endDate: query.endDate,
        },
        metrics: {
          ...metrics,
          // Add calculated percentages
          draftPercentage: metrics.totalPOs > 0 ? (metrics.draftPOs / metrics.totalPOs) * 100 : 0,
          approvedPercentage: metrics.totalPOs > 0 ? (metrics.approvedPOs / metrics.totalPOs) * 100 : 0,
          receivedPercentage: metrics.totalPOs > 0 ? (metrics.receivedPOs / metrics.totalPOs) * 100 : 0,
          cancelledPercentage: metrics.totalPOs > 0 ? (metrics.cancelledPOs / metrics.totalPOs) * 100 : 0,
        },
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /purchasing-analytics/trends - Get purchasing trends over time
 * Requirements: 2.6
 * 
 * This endpoint demonstrates:
 * - Time-series purchasing trend analysis
 * - Monthly spend and order patterns
 * - Supplier diversity tracking
 * - Trend visualization data
 */
purchasingAnalytics.get('/trends',
  requirePurchaseOrderAccess('read'),
  validateQuery(dateRangeQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      startDate: string;
      endDate: string;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const analyticsService = createPurchasingAnalyticsService(db);
      
      const dateRange = {
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
      };
      
      const trends = await analyticsService.getPurchasingTrends(
        authContext.tenant_id,
        dateRange
      );
      
      return c.json({
        dateRange: {
          startDate: query.startDate,
          endDate: query.endDate,
        },
        trends,
        summary: {
          totalPeriods: trends.length,
          totalSpendCents: trends.reduce((sum, t) => sum + t.totalSpendCents, 0),
          totalOrders: trends.reduce((sum, t) => sum + t.orderCount, 0),
          averageMonthlySpendCents: trends.length > 0 
            ? Math.round(trends.reduce((sum, t) => sum + t.totalSpendCents, 0) / trends.length)
            : 0,
        },
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /purchasing-analytics/products/top - Get top products by spend or quantity
 * Requirements: 2.6
 * 
 * This endpoint demonstrates:
 * - Top product analysis by spend
 * - Product performance metrics
 * - Quantity and pricing insights
 * - Configurable result limits
 */
purchasingAnalytics.get('/products/top',
  requirePurchaseOrderAccess('read'),
  validateQuery(topProductsQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      startDate: string;
      endDate: string;
      limit: number;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const analyticsService = createPurchasingAnalyticsService(db);
      
      const dateRange = {
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
      };
      
      const topProducts = await analyticsService.getTopProducts(
        authContext.tenant_id,
        dateRange,
        query.limit
      );
      
      return c.json({
        dateRange: {
          startDate: query.startDate,
          endDate: query.endDate,
        },
        limit: query.limit,
        products: topProducts,
        summary: {
          totalProducts: topProducts.length,
          totalSpendCents: topProducts.reduce((sum, p) => sum + p.totalSpendCents, 0),
          totalQuantityOrdered: topProducts.reduce((sum, p) => sum + p.totalQuantityOrdered, 0),
        },
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /purchasing-analytics/suppliers/performance - Get supplier performance metrics
 * Requirements: 2.6
 * 
 * This endpoint demonstrates:
 * - Supplier performance evaluation
 * - On-time delivery tracking
 * - Supplier relationship metrics
 * - Performance-based supplier ranking
 */
purchasingAnalytics.get('/suppliers/performance',
  requirePurchaseOrderAccess('read'),
  validateQuery(dateRangeQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const query = getValidatedQuery<{
      startDate: string;
      endDate: string;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const analyticsService = createPurchasingAnalyticsService(db);
      
      const dateRange = {
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
      };
      
      const performance = await analyticsService.getSupplierPerformance(
        authContext.tenant_id,
        dateRange
      );
      
      return c.json({
        dateRange: {
          startDate: query.startDate,
          endDate: query.endDate,
        },
        suppliers: performance,
        summary: {
          totalSuppliers: performance.length,
          averageOnTimeDeliveryRate: performance.length > 0 
            ? performance.reduce((sum, s) => sum + s.onTimeDeliveryRate, 0) / performance.length
            : 0,
          totalOrders: performance.reduce((sum, s) => sum + s.totalOrders, 0),
          totalSpendCents: performance.reduce((sum, s) => sum + s.totalSpendCents, 0),
        },
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

export default purchasingAnalytics;