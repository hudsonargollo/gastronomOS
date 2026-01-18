import { Hono } from 'hono';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { 
  createTransferIntelligenceService
} from '../services/transfer-intelligence';
import { createTransferService } from '../services/transfer';

const app = new Hono<{
  Bindings: {
    DB: D1Database;
  };
  Variables: {
    db: DrizzleD1Database;
    userId: string;
    tenantId: string;
  };
}>();

/**
 * GET /transfer-intelligence/suggestions/:locationId
 * Generate predictive transfer suggestions for a location
 */
app.get('/suggestions/:locationId', async (c) => {
  try {
    const db = c.get('db');
    const tenantId = c.get('tenantId');
    const locationId = c.req.param('locationId');

    if (!locationId) {
      return c.json({ 
        error: 'Location ID is required' 
      }, 400);
    }

    const transferService = createTransferService(db);
    const intelligenceService = createTransferIntelligenceService(db, transferService);
    
    const suggestions = await intelligenceService.generatePredictiveTransferSuggestions(locationId, tenantId);
    
    return c.json({ suggestions });
  } catch (error) {
    console.error('Error generating predictive transfer suggestions:', error);
    return c.json({ 
      error: 'Failed to generate transfer suggestions',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /transfer-intelligence/patterns
 * Analyze transfer patterns for the tenant
 */
app.get('/patterns', async (c) => {
  try {
    const db = c.get('db');
    const tenantId = c.get('tenantId');
    
    // Get optional lookback days from query params
    const lookbackDays = c.req.query('lookbackDays');
    const lookback = lookbackDays ? parseInt(lookbackDays, 10) : undefined;

    if (lookback && (isNaN(lookback) || lookback <= 0)) {
      return c.json({ 
        error: 'Lookback days must be a positive number' 
      }, 400);
    }

    const transferService = createTransferService(db);
    const intelligenceService = createTransferIntelligenceService(db, transferService);
    
    const patterns = await intelligenceService.analyzeTransferPatterns(tenantId, lookback);
    
    return c.json({ patterns });
  } catch (error) {
    console.error('Error analyzing transfer patterns:', error);
    return c.json({ 
      error: 'Failed to analyze transfer patterns',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /transfer-intelligence/reorder-points
 * Create a new reorder point for automated transfers
 */
app.post('/reorder-points', async (c) => {
  try {
    const db = c.get('db');
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');

    const reorderPointData = await c.req.json();
    
    // Validate required fields
    if (!reorderPointData.productId || !reorderPointData.locationId || 
        reorderPointData.minimumStock === undefined || reorderPointData.reorderQuantity === undefined) {
      return c.json({ 
        error: 'Product ID, location ID, minimum stock, and reorder quantity are required' 
      }, 400);
    }

    if (reorderPointData.minimumStock < 0 || reorderPointData.reorderQuantity <= 0) {
      return c.json({ 
        error: 'Minimum stock must be non-negative and reorder quantity must be positive' 
      }, 400);
    }

    // Set createdBy if not provided
    if (!reorderPointData.createdBy) {
      reorderPointData.createdBy = userId;
    }

    const transferService = createTransferService(db);
    const intelligenceService = createTransferIntelligenceService(db, transferService);
    
    const reorderPoint = await intelligenceService.createReorderPoint(reorderPointData, tenantId);
    
    return c.json(reorderPoint, 201);
  } catch (error) {
    console.error('Error creating reorder point:', error);
    return c.json({ 
      error: 'Failed to create reorder point',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PUT /transfer-intelligence/reorder-points/:reorderPointId
 * Update an existing reorder point
 */
app.put('/reorder-points/:reorderPointId', async (c) => {
  try {
    const db = c.get('db');
    const tenantId = c.get('tenantId');
    const reorderPointId = c.req.param('reorderPointId');

    if (!reorderPointId) {
      return c.json({ 
        error: 'Reorder point ID is required' 
      }, 400);
    }

    const updates = await c.req.json();

    // Validate numeric fields if provided
    if (updates.minimumStock !== undefined && updates.minimumStock < 0) {
      return c.json({ 
        error: 'Minimum stock must be non-negative' 
      }, 400);
    }

    if (updates.reorderQuantity !== undefined && updates.reorderQuantity <= 0) {
      return c.json({ 
        error: 'Reorder quantity must be positive' 
      }, 400);
    }

    const transferService = createTransferService(db);
    const intelligenceService = createTransferIntelligenceService(db, transferService);
    
    const updatedReorderPoint = await intelligenceService.updateReorderPoint(reorderPointId, updates, tenantId);
    
    return c.json(updatedReorderPoint);
  } catch (error) {
    console.error('Error updating reorder point:', error);
    return c.json({ 
      error: 'Failed to update reorder point',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /transfer-intelligence/reorder-triggers
 * Check for automated reorder triggers
 */
app.get('/reorder-triggers', async (c) => {
  try {
    const db = c.get('db');
    const tenantId = c.get('tenantId');

    const transferService = createTransferService(db);
    const intelligenceService = createTransferIntelligenceService(db, transferService);
    
    const triggers = await intelligenceService.checkAutomatedReorderTriggers(tenantId);
    
    return c.json({ triggers });
  } catch (error) {
    console.error('Error checking reorder triggers:', error);
    return c.json({ 
      error: 'Failed to check reorder triggers',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /transfer-intelligence/execute-trigger/:triggerId
 * Execute an automated transfer based on a trigger
 */
app.post('/execute-trigger/:triggerId', async (c) => {
  try {
    const db = c.get('db');
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const triggerId = c.req.param('triggerId');

    if (!triggerId) {
      return c.json({ 
        error: 'Trigger ID is required' 
      }, 400);
    }

    const transferService = createTransferService(db);
    const intelligenceService = createTransferIntelligenceService(db, transferService);
    
    const transfer = await intelligenceService.executeAutomatedTransfer(triggerId, tenantId, userId);
    
    return c.json(transfer, 201);
  } catch (error) {
    console.error('Error executing automated transfer:', error);
    return c.json({ 
      error: 'Failed to execute automated transfer',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /transfer-intelligence/demand-forecast/:productId/:locationId
 * Generate demand forecast for a product at a location
 */
app.get('/demand-forecast/:productId/:locationId', async (c) => {
  try {
    const db = c.get('db');
    const tenantId = c.get('tenantId');
    const productId = c.req.param('productId');
    const locationId = c.req.param('locationId');

    if (!productId || !locationId) {
      return c.json({ 
        error: 'Product ID and location ID are required' 
      }, 400);
    }

    const transferService = createTransferService(db);
    const intelligenceService = createTransferIntelligenceService(db, transferService);
    
    const forecast = await intelligenceService.generateDemandForecast(productId, locationId, tenantId);
    
    return c.json(forecast);
  } catch (error) {
    console.error('Error generating demand forecast:', error);
    return c.json({ 
      error: 'Failed to generate demand forecast',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /transfer-intelligence/recommendations/:locationId
 * Get comprehensive transfer recommendations for a location
 */
app.get('/recommendations/:locationId', async (c) => {
  try {
    const db = c.get('db');
    const tenantId = c.get('tenantId');
    const locationId = c.req.param('locationId');

    if (!locationId) {
      return c.json({ 
        error: 'Location ID is required' 
      }, 400);
    }

    const transferService = createTransferService(db);
    const intelligenceService = createTransferIntelligenceService(db, transferService);
    
    const recommendations = await intelligenceService.getTransferRecommendations(locationId, tenantId);
    
    return c.json({ recommendations });
  } catch (error) {
    console.error('Error getting transfer recommendations:', error);
    return c.json({ 
      error: 'Failed to get transfer recommendations',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /transfer-intelligence/learn
 * Learn from transfer outcomes to improve predictions
 */
app.post('/learn', async (c) => {
  try {
    const db = c.get('db');
    const tenantId = c.get('tenantId');

    const transferService = createTransferService(db);
    const intelligenceService = createTransferIntelligenceService(db, transferService);
    
    const insights = await intelligenceService.learnFromTransferOutcomes(tenantId);
    
    return c.json(insights);
  } catch (error) {
    console.error('Error learning from transfer outcomes:', error);
    return c.json({ 
      error: 'Failed to learn from transfer outcomes',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /transfer-intelligence/health
 * Health check endpoint
 */
app.get('/health', async (c) => {
  return c.json({ 
    status: 'healthy',
    service: 'transfer-intelligence',
    timestamp: new Date().toISOString()
  });
});

export default app;