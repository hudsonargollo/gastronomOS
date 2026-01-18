/**
 * Allocation Optimizer API Routes
 * 
 * Provides REST endpoints for allocation optimization functionality including
 * smart suggestions, rebalancing, and conflict resolution.
 * Implements requirements 7.1 for allocation optimization features.
 */

import { Hono } from 'hono';
import { createAllocationOptimizerService, OptimizationStrategy } from '../services/allocation-optimizer';
import { 
  authenticate, 
  injectTenantContext, 
  injectAuditService,
  ensureTenantIsolation,
  requireRole,
  getAuthContext,
  getDatabase
} from '../middleware/auth';

const app = new Hono<{ Bindings: { DB: D1Database } }>();

// Apply authentication and tenant context middleware
app.use('*', authenticate());
app.use('*', injectTenantContext());
app.use('*', injectAuditService());
app.use('*', ensureTenantIsolation());

/**
 * POST /smart-suggestions
 * Generate smart allocation suggestions for a purchase order
 * Requirements: 7.1
 */
app.post('/smart-suggestions', requireRole(['ADMIN', 'MANAGER']), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const optimizerService = createAllocationOptimizerService(db);

    const body = await c.req.json();
    const { poId, strategy } = body;

    if (!poId) {
      return c.json({
        error: 'Bad Request',
        message: 'Purchase order ID is required'
      }, 400);
    }

    // Parse optimization strategy if provided
    let optimizationStrategy: OptimizationStrategy | undefined;
    if (strategy) {
      optimizationStrategy = {
        name: strategy.name || 'Custom Strategy',
        description: strategy.description || 'Custom optimization strategy',
        parameters: {
          prioritizeUtilization: strategy.parameters?.prioritizeUtilization ?? true,
          minimizeWaste: strategy.parameters?.minimizeWaste ?? true,
          balanceDistribution: strategy.parameters?.balanceDistribution ?? true,
          considerHistoricalDemand: strategy.parameters?.considerHistoricalDemand ?? true,
          locationCapacityWeight: strategy.parameters?.locationCapacityWeight ?? 0.3,
          demandPredictionWeight: strategy.parameters?.demandPredictionWeight ?? 0.4,
          costOptimizationWeight: strategy.parameters?.costOptimizationWeight ?? 0.3
        }
      };
    }

    const suggestions = await optimizerService.generateSmartSuggestions(
      authContext.tenant_id,
      poId,
      optimizationStrategy
    );

    return c.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    console.error('Error generating smart suggestions:', error);
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to generate allocation suggestions'
    }, 500);
  }
});

/**
 * GET /rebalancing-opportunities
 * Analyze rebalancing opportunities for allocations
 * Requirements: 7.1
 */
app.get('/rebalancing-opportunities', requireRole(['ADMIN', 'MANAGER']), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const optimizerService = createAllocationOptimizerService(db);

    const poId = c.req.query('po_id');

    const recommendations = await optimizerService.analyzeRebalancingOpportunities(
      authContext.tenant_id,
      poId
    );

    return c.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Error analyzing rebalancing opportunities:', error);
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to analyze rebalancing opportunities'
    }, 500);
  }
});

/**
 * GET /conflicts
 * Detect allocation conflicts and issues
 * Requirements: 7.1
 */
app.get('/conflicts', requireRole(['ADMIN', 'MANAGER']), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const optimizerService = createAllocationOptimizerService(db);

    const poId = c.req.query('po_id');

    const conflicts = await optimizerService.detectAllocationConflicts(
      authContext.tenant_id,
      poId
    );

    return c.json({
      success: true,
      data: conflicts
    });
  } catch (error) {
    console.error('Error detecting allocation conflicts:', error);
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to detect allocation conflicts'
    }, 500);
  }
});

/**
 * POST /optimize-distribution
 * Optimize allocation distribution for a purchase order
 * Requirements: 7.1
 */
app.post('/optimize-distribution', requireRole(['ADMIN', 'MANAGER']), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const optimizerService = createAllocationOptimizerService(db);

    const body = await c.req.json();
    const { poId, strategy } = body;

    if (!poId) {
      return c.json({
        error: 'Bad Request',
        message: 'Purchase order ID is required'
      }, 400);
    }

    if (!strategy) {
      return c.json({
        error: 'Bad Request',
        message: 'Optimization strategy is required'
      }, 400);
    }

    // Parse optimization strategy
    const optimizationStrategy: OptimizationStrategy = {
      name: strategy.name || 'Custom Strategy',
      description: strategy.description || 'Custom optimization strategy',
      parameters: {
        prioritizeUtilization: strategy.parameters?.prioritizeUtilization ?? true,
        minimizeWaste: strategy.parameters?.minimizeWaste ?? true,
        balanceDistribution: strategy.parameters?.balanceDistribution ?? true,
        considerHistoricalDemand: strategy.parameters?.considerHistoricalDemand ?? true,
        locationCapacityWeight: strategy.parameters?.locationCapacityWeight ?? 0.3,
        demandPredictionWeight: strategy.parameters?.demandPredictionWeight ?? 0.4,
        costOptimizationWeight: strategy.parameters?.costOptimizationWeight ?? 0.3
      }
    };

    const result = await optimizerService.optimizeAllocationDistribution(
      authContext.tenant_id,
      poId,
      optimizationStrategy
    );

    return c.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error optimizing allocation distribution:', error);
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to optimize allocation distribution'
    }, 500);
  }
});

/**
 * GET /demand-patterns
 * Get location demand patterns for optimization
 * Requirements: 7.1
 */
app.get('/demand-patterns', requireRole(['ADMIN', 'MANAGER']), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const optimizerService = createAllocationOptimizerService(db);

    const locationIds = c.req.query('location_ids')?.split(',');
    const productIds = c.req.query('product_ids')?.split(',');

    const patterns = await optimizerService.getLocationDemandPatterns(
      authContext.tenant_id,
      locationIds,
      productIds
    );

    return c.json({
      success: true,
      data: patterns
    });
  } catch (error) {
    console.error('Error getting demand patterns:', error);
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve demand patterns'
    }, 500);
  }
});

/**
 * POST /validate-feasibility
 * Validate optimization feasibility
 * Requirements: 7.1
 */
app.post('/validate-feasibility', requireRole(['ADMIN', 'MANAGER']), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const optimizerService = createAllocationOptimizerService(db);

    const body = await c.req.json();
    const { suggestions } = body;

    if (!suggestions || !Array.isArray(suggestions)) {
      return c.json({
        error: 'Bad Request',
        message: 'Allocation suggestions array is required'
      }, 400);
    }

    const validation = await optimizerService.validateOptimizationFeasibility(
      authContext.tenant_id,
      suggestions
    );

    return c.json({
      success: true,
      data: validation
    });
  } catch (error) {
    console.error('Error validating optimization feasibility:', error);
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to validate optimization feasibility'
    }, 500);
  }
});

/**
 * GET /optimization-strategies
 * Get available optimization strategies
 * Requirements: 7.1
 */
app.get('/optimization-strategies', requireRole(['ADMIN', 'MANAGER']), async (c) => {
  try {
    // Return predefined optimization strategies
    const strategies = [
      {
        name: 'Balanced Optimization',
        description: 'Balances utilization, waste minimization, and distribution',
        parameters: {
          prioritizeUtilization: true,
          minimizeWaste: true,
          balanceDistribution: true,
          considerHistoricalDemand: true,
          locationCapacityWeight: 0.3,
          demandPredictionWeight: 0.4,
          costOptimizationWeight: 0.3
        },
        recommended: true
      },
      {
        name: 'Utilization Focused',
        description: 'Prioritizes high utilization rates and demand satisfaction',
        parameters: {
          prioritizeUtilization: true,
          minimizeWaste: false,
          balanceDistribution: false,
          considerHistoricalDemand: true,
          locationCapacityWeight: 0.2,
          demandPredictionWeight: 0.6,
          costOptimizationWeight: 0.2
        },
        recommended: false
      },
      {
        name: 'Waste Minimization',
        description: 'Focuses on minimizing waste and over-allocation',
        parameters: {
          prioritizeUtilization: false,
          minimizeWaste: true,
          balanceDistribution: true,
          considerHistoricalDemand: true,
          locationCapacityWeight: 0.4,
          demandPredictionWeight: 0.3,
          costOptimizationWeight: 0.3
        },
        recommended: false
      },
      {
        name: 'Equal Distribution',
        description: 'Distributes allocations evenly across all locations',
        parameters: {
          prioritizeUtilization: false,
          minimizeWaste: false,
          balanceDistribution: true,
          considerHistoricalDemand: false,
          locationCapacityWeight: 0.5,
          demandPredictionWeight: 0.2,
          costOptimizationWeight: 0.3
        },
        recommended: false
      },
      {
        name: 'Cost Optimization',
        description: 'Optimizes for cost efficiency and logistics',
        parameters: {
          prioritizeUtilization: true,
          minimizeWaste: true,
          balanceDistribution: false,
          considerHistoricalDemand: true,
          locationCapacityWeight: 0.2,
          demandPredictionWeight: 0.3,
          costOptimizationWeight: 0.5
        },
        recommended: false
      }
    ];

    return c.json({
      success: true,
      data: strategies
    });
  } catch (error) {
    console.error('Error getting optimization strategies:', error);
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve optimization strategies'
    }, 500);
  }
});

export default app;