import { Hono } from 'hono';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { 
  createTransferOptimizationService,
  RouteOptimizationRequest,
  BulkTransferRequest,
  SchedulingRequest
} from '../services/transfer-optimization';
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
 * POST /transfer-optimization/routes
 * Optimize transfer routes for multiple destinations
 */
app.post('/routes', async (c) => {
  try {
    const db = c.get('db');
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');

    const request = await c.req.json() as RouteOptimizationRequest;
    
    // Validate request
    if (!request.sourceLocationId || !request.destinationLocationIds?.length || !request.productId || !request.totalQuantity) {
      return c.json({ 
        error: 'Source location, destination locations, product, and total quantity are required' 
      }, 400);
    }

    if (request.totalQuantity <= 0) {
      return c.json({ 
        error: 'Total quantity must be positive' 
      }, 400);
    }

    // Set requestedBy if not provided
    if (!request.requestedBy) {
      request.requestedBy = userId;
    }

    const transferService = createTransferService(db);
    const optimizationService = createTransferOptimizationService(db, transferService);
    
    const result = await optimizationService.optimizeTransferRoutes(request, tenantId);
    
    return c.json(result);
  } catch (error) {
    console.error('Error optimizing transfer routes:', error);
    return c.json({ 
      error: 'Failed to optimize transfer routes',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /transfer-optimization/bulk
 * Create multiple transfers in bulk with optimization
 */
app.post('/bulk', async (c) => {
  try {
    const db = c.get('db');
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');

    const request = await c.req.json() as BulkTransferRequest;
    
    // Validate request
    if (!request.transfers?.length) {
      return c.json({ 
        error: 'At least one transfer request is required' 
      }, 400);
    }

    // Set requestedBy if not provided
    if (!request.requestedBy) {
      request.requestedBy = userId;
    }

    const transferService = createTransferService(db);
    const optimizationService = createTransferOptimizationService(db, transferService);
    
    const result = await optimizationService.createBulkTransfers(request, tenantId);
    
    return c.json(result);
  } catch (error) {
    console.error('Error creating bulk transfers:', error);
    return c.json({ 
      error: 'Failed to create bulk transfers',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /transfer-optimization/schedule
 * Schedule transfer batches for optimal resource utilization
 */
app.post('/schedule', async (c) => {
  try {
    const db = c.get('db');
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');

    const request = await c.req.json() as SchedulingRequest;
    
    // Validate request
    if (!request.transfers?.length || !request.scheduledFor) {
      return c.json({ 
        error: 'Transfer requests and scheduled time are required' 
      }, 400);
    }

    // Parse scheduledFor if it's a string
    if (typeof request.scheduledFor === 'string') {
      request.scheduledFor = new Date(request.scheduledFor);
    }

    // Validate scheduledFor is a valid future date
    if (isNaN(request.scheduledFor.getTime()) || request.scheduledFor <= new Date()) {
      return c.json({ 
        error: 'Scheduled time must be a valid future date' 
      }, 400);
    }

    // Set requestedBy if not provided
    if (!request.requestedBy) {
      request.requestedBy = userId;
    }

    const transferService = createTransferService(db);
    const optimizationService = createTransferOptimizationService(db, transferService);
    
    const result = await optimizationService.scheduleTransferBatch(request, tenantId);
    
    return c.json(result);
  } catch (error) {
    console.error('Error scheduling transfer batch:', error);
    return c.json({ 
      error: 'Failed to schedule transfer batch',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /transfer-optimization/recommendations/:locationId
 * Get optimization recommendations for a location
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
    const optimizationService = createTransferOptimizationService(db, transferService);
    
    const recommendations = await optimizationService.getOptimizationRecommendations(locationId, tenantId);
    
    return c.json({ recommendations });
  } catch (error) {
    console.error('Error getting optimization recommendations:', error);
    return c.json({ 
      error: 'Failed to get optimization recommendations',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /transfer-optimization/batch-performance/:batchId
 * Analyze batch performance for optimization insights
 */
app.get('/batch-performance/:batchId', async (c) => {
  try {
    const db = c.get('db');
    const tenantId = c.get('tenantId');
    const batchId = c.req.param('batchId');

    if (!batchId) {
      return c.json({ 
        error: 'Batch ID is required' 
      }, 400);
    }

    const transferService = createTransferService(db);
    const optimizationService = createTransferOptimizationService(db, transferService);
    
    const analysis = await optimizationService.analyzeBatchPerformance(batchId, tenantId);
    
    return c.json(analysis);
  } catch (error) {
    console.error('Error analyzing batch performance:', error);
    return c.json({ 
      error: 'Failed to analyze batch performance',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /transfer-optimization/health
 * Health check endpoint
 */
app.get('/health', async (c) => {
  return c.json({ 
    status: 'healthy',
    service: 'transfer-optimization',
    timestamp: new Date().toISOString()
  });
});

export default app;