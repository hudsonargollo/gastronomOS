import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';
import { 
  authenticate, 
  injectTenantContext,
  injectAuthorizationService,
  getAuthContext,
  requirePriceHistoryAccess
} from '../middleware/auth';
import { validateQuery, getValidatedQuery } from '../middleware/error';
import { createPriceHistoryService } from '../services/price-history';

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
}

// Validation schemas
const priceHistoryQuerySchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined).refine(val => val === undefined || (val > 0 && val <= 100), {
    message: 'Limit must be between 1 and 100'
  }),
});

const priceTrendsQuerySchema = z.object({
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
});

// Initialize price history router
const priceHistory = new Hono<{ Bindings: Env }>();

// Apply authentication and context to all routes
priceHistory.use('*', authenticate());
priceHistory.use('*', injectTenantContext());
priceHistory.use('*', injectAuthorizationService());

/**
 * GET /suppliers/:supplierId/products/:productId/price-history - Get price history for supplier/product
 * Requirements: 2.2, 2.6
 * 
 * This endpoint demonstrates:
 * - Historical price tracking for supplier/product combinations
 * - Tenant isolation for price data
 * - Pagination support for large price histories
 * - Role-based access (all authenticated users can view price history)
 */
priceHistory.get('/suppliers/:supplierId/products/:productId/price-history',
  requirePriceHistoryAccess(),
  validateQuery(priceHistoryQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const supplierId = c.req.param('supplierId');
    const productId = c.req.param('productId');
    const query = getValidatedQuery<{
      limit?: number;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const priceHistoryService = createPriceHistoryService(db);
      
      // Get price history for this supplier/product combination
      const history = await priceHistoryService.getPriceHistory(
        authContext.tenant_id,
        supplierId,
        productId,
        query.limit || 20
      );
      
      // Return price history with formatted dates
      return c.json({
        supplierId,
        productId,
        priceHistory: history.map(entry => ({
          id: entry.id,
          unitPriceCents: entry.unitPriceCents,
          unitPriceDollars: entry.unitPriceCents / 100,
          poId: entry.poId,
          poNumber: entry.poNumber,
          recordedAt: entry.recordedAt,
          recordedDate: new Date(entry.recordedAt * 1000).toISOString(),
        })),
        total: history.length,
        limit: query.limit || 20,
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /suppliers/:supplierId/products/:productId/price-suggestion - Get price suggestion based on history
 * Requirements: 2.2, 2.6
 * 
 * This endpoint demonstrates:
 * - Intelligent price suggestions based on historical data
 * - Confidence scoring for price suggestions
 * - Price variance analysis from historical averages
 * - Role-based access for procurement planning
 */
priceHistory.get('/suppliers/:supplierId/products/:productId/price-suggestion',
  requirePriceHistoryAccess(),
  async (c) => {
    const authContext = getAuthContext(c);
    const supplierId = c.req.param('supplierId');
    const productId = c.req.param('productId');
    
    try {
      const db = drizzle(c.env.DB);
      const priceHistoryService = createPriceHistoryService(db);
      
      // Get price suggestion for this supplier/product combination
      const suggestion = await priceHistoryService.getSuggestedPrice(
        authContext.tenant_id,
        supplierId,
        productId
      );
      
      if (!suggestion) {
        return c.json({
          supplierId,
          productId,
          suggestion: null,
          message: 'No price history available for this supplier/product combination'
        });
      }
      
      // Return price suggestion with formatted data
      return c.json({
        supplierId,
        productId,
        suggestion: {
          suggestedPriceCents: suggestion.suggestedPriceCents,
          suggestedPriceDollars: suggestion.suggestedPriceCents / 100,
          lastPurchaseDate: suggestion.lastPurchaseDate.toISOString(),
          confidence: suggestion.confidence,
          priceVariance: suggestion.priceVariance,
          confidenceDescription: getConfidenceDescription(suggestion.confidence),
        }
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * GET /products/:productId/price-trends - Get price trend analysis for a product
 * Requirements: 2.6
 * 
 * This endpoint demonstrates:
 * - Price trend analysis across all suppliers for a product
 * - Statistical analysis including volatility and trend direction
 * - Date range filtering for trend analysis
 * - Business intelligence for procurement decisions
 */
priceHistory.get('/products/:productId/price-trends',
  requirePriceHistoryAccess(),
  validateQuery(priceTrendsQuerySchema),
  async (c) => {
    const authContext = getAuthContext(c);
    const productId = c.req.param('productId');
    const query = getValidatedQuery<{
      startDate?: Date;
      endDate?: Date;
    }>(c);
    
    try {
      const db = drizzle(c.env.DB);
      const priceHistoryService = createPriceHistoryService(db);
      
      // Build date range if provided
      let dateRange;
      if (query.startDate && query.endDate) {
        // Validate date range
        if (query.startDate >= query.endDate) {
          return c.json({
            error: 'Bad Request',
            message: 'Start date must be before end date'
          }, 400);
        }
        
        dateRange = {
          startDate: query.startDate,
          endDate: query.endDate,
        };
      }
      
      // Get price trend analysis
      const trends = await priceHistoryService.analyzePriceTrends(
        authContext.tenant_id,
        productId,
        dateRange
      );
      
      return c.json({
        productId,
        dateRange: dateRange ? {
          startDate: dateRange.startDate.toISOString(),
          endDate: dateRange.endDate.toISOString(),
        } : null,
        trends: {
          averagePriceCents: trends.averagePriceCents,
          averagePriceDollars: trends.averagePriceCents / 100,
          priceVolatility: trends.priceVolatility,
          trendDirection: trends.trendDirection,
          dataPoints: trends.dataPoints,
          volatilityDescription: getVolatilityDescription(trends.priceVolatility),
          trendDescription: getTrendDescription(trends.trendDirection),
        }
      });
      
    } catch (error) {
      throw error; // Let error middleware handle it
    }
  }
);

/**
 * Helper function to get confidence description
 */
function getConfidenceDescription(confidence: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  switch (confidence) {
    case 'HIGH':
      return 'High confidence based on consistent recent pricing data';
    case 'MEDIUM':
      return 'Medium confidence based on some pricing history';
    case 'LOW':
      return 'Low confidence due to limited or inconsistent pricing data';
    default:
      return 'Unknown confidence level';
  }
}

/**
 * Helper function to get volatility description
 */
function getVolatilityDescription(volatility: number): string {
  if (volatility < 5) {
    return 'Very stable pricing';
  } else if (volatility < 15) {
    return 'Moderately stable pricing';
  } else if (volatility < 30) {
    return 'Somewhat volatile pricing';
  } else {
    return 'Highly volatile pricing';
  }
}

/**
 * Helper function to get trend description
 */
function getTrendDescription(trend: 'INCREASING' | 'DECREASING' | 'STABLE'): string {
  switch (trend) {
    case 'INCREASING':
      return 'Prices are trending upward over time';
    case 'DECREASING':
      return 'Prices are trending downward over time';
    case 'STABLE':
      return 'Prices are relatively stable over time';
    default:
      return 'Unknown trend direction';
  }
}

export default priceHistory;