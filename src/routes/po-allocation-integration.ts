/**
 * Purchase Order Allocation Integration API Routes
 * 
 * Handles PO-allocation integration endpoints including allocation summaries,
 * auto-allocation, and PO status change webhooks.
 * 
 * Requirements: 8.1, 8.2, 8.4
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { 
  createPOAllocationIntegrationService, 
  POAllocationIntegrationService,
  AutoAllocationRequest 
} from '../services/po-allocation-integration';
import { createErrorResponse, createSuccessResponse } from '../utils';
import { Env, Variables } from '../types';

// Initialize PO allocation integration router
const poAllocationIntegration = new Hono<{ Bindings: Env; Variables: Variables }>();

// Service initialization middleware
poAllocationIntegration.use('*', async (c, next) => {
  try {
    const db = drizzle(c.env.DB);
    const poAllocationIntegrationService = createPOAllocationIntegrationService(db);
    
    c.set('poAllocationIntegrationService', poAllocationIntegrationService);
    
    await next();
  } catch (error) {
    console.error('Failed to initialize PO allocation integration services:', error);
    return c.json(createErrorResponse(
      'Service Error',
      'Failed to initialize PO allocation integration services',
      'SERVICE_INIT_ERROR'
    ), 500);
  }
});

// Authentication middleware (placeholder - would use actual auth middleware)
poAllocationIntegration.use('*', async (c, next) => {
  // TODO: Replace with actual authentication middleware
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader) {
    return c.json(createErrorResponse(
      'Authentication Required',
      'Authorization header is required',
      'AUTH_REQUIRED'
    ), 401);
  }

  // Mock user context for now
  c.set('user', {
    id: 'user_123',
    tenantId: 'tenant_123',
    email: 'user@example.com'
  });

  await next();
});

/**
 * GET /purchase-orders/:id/allocation-summary
 * Get comprehensive allocation summary for a purchase order
 * Requirements: 8.1, 8.2
 */
poAllocationIntegration.get('/purchase-orders/:id/allocation-summary', async (c) => {
  try {
    const poId = c.req.param('id');
    const user = c.get('user');
    const service = c.get('poAllocationIntegrationService') as POAllocationIntegrationService;

    if (!poId) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Purchase order ID is required',
        'VALIDATION_ERROR'
      ), 400);
    }

    const summary = await service.getPOAllocationSummary(poId, user.tenantId);

    return c.json(createSuccessResponse(
      'Allocation summary retrieved successfully',
      summary
    ));

  } catch (error) {
    console.error('Error getting PO allocation summary:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return c.json(createErrorResponse(
          'Not Found',
          error.message,
          'PO_NOT_FOUND'
        ), 404);
      }
      
      return c.json(createErrorResponse(
        'Operation Failed',
        error.message,
        'SUMMARY_ERROR'
      ), 400);
    }

    return c.json(createErrorResponse(
      'Internal Server Error',
      'An unexpected error occurred while retrieving allocation summary',
      'INTERNAL_ERROR'
    ), 500);
  }
});

/**
 * POST /purchase-orders/:id/auto-allocate
 * Auto-allocate PO items based on strategy
 * Requirements: 8.1, 8.2, 8.4
 */
poAllocationIntegration.post('/purchase-orders/:id/auto-allocate', async (c) => {
  try {
    const poId = c.req.param('id');
    const user = c.get('user');
    const service = c.get('poAllocationIntegrationService') as POAllocationIntegrationService;

    if (!poId) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Purchase order ID is required',
        'VALIDATION_ERROR'
      ), 400);
    }

    const requestBody = await c.req.json();
    
    // Validate request body
    if (!requestBody.strategy) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Allocation strategy is required',
        'VALIDATION_ERROR'
      ), 400);
    }

    const validStrategies = ['EQUAL_DISTRIBUTION', 'PERCENTAGE_BASED', 'TEMPLATE_BASED'];
    if (!validStrategies.includes(requestBody.strategy)) {
      return c.json(createErrorResponse(
        'Validation Error',
        `Invalid strategy. Must be one of: ${validStrategies.join(', ')}`,
        'VALIDATION_ERROR'
      ), 400);
    }

    // Validate strategy-specific parameters
    if (requestBody.strategy === 'PERCENTAGE_BASED' && !requestBody.parameters?.locationPercentages) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Location percentages are required for percentage-based allocation',
        'VALIDATION_ERROR'
      ), 400);
    }

    if (requestBody.strategy === 'TEMPLATE_BASED' && !requestBody.parameters?.templateId) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Template ID is required for template-based allocation',
        'VALIDATION_ERROR'
      ), 400);
    }

    if (requestBody.strategy === 'EQUAL_DISTRIBUTION' && !requestBody.parameters?.locationIds) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Location IDs are required for equal distribution allocation',
        'VALIDATION_ERROR'
      ), 400);
    }

    const autoAllocationRequest: AutoAllocationRequest = {
      poId,
      strategy: requestBody.strategy,
      parameters: requestBody.parameters
    };

    const result = await service.autoAllocatePO(autoAllocationRequest, user.tenantId, user.id);

    if (!result.success) {
      return c.json(createErrorResponse(
        'Auto-allocation Failed',
        `Auto-allocation failed: ${result.errors.join(', ')}`,
        'AUTO_ALLOCATION_ERROR',
        { errors: result.errors }
      ), 400);
    }

    return c.json(createSuccessResponse(
      'Auto-allocation completed successfully',
      {
        allocationsCreated: result.allocationsCreated,
        totalQuantityAllocated: result.totalQuantityAllocated,
        unallocatedQuantity: result.unallocatedQuantity,
        strategy: requestBody.strategy
      }
    ));

  } catch (error) {
    console.error('Error during auto-allocation:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return c.json(createErrorResponse(
          'Not Found',
          error.message,
          'PO_NOT_FOUND'
        ), 404);
      }
      
      return c.json(createErrorResponse(
        'Operation Failed',
        error.message,
        'AUTO_ALLOCATION_ERROR'
      ), 400);
    }

    return c.json(createErrorResponse(
      'Internal Server Error',
      'An unexpected error occurred during auto-allocation',
      'INTERNAL_ERROR'
    ), 500);
  }
});

/**
 * POST /purchase-orders/:id/status-change-webhook
 * Handle PO status change webhooks for allocation updates
 * Requirements: 8.1, 8.4
 */
poAllocationIntegration.post('/purchase-orders/:id/status-change-webhook', async (c) => {
  try {
    const poId = c.req.param('id');
    const user = c.get('user');
    const service = c.get('poAllocationIntegrationService') as POAllocationIntegrationService;

    if (!poId) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Purchase order ID is required',
        'VALIDATION_ERROR'
      ), 400);
    }

    const requestBody = await c.req.json();
    
    // Validate webhook payload
    if (!requestBody.oldStatus || !requestBody.newStatus || !requestBody.changedBy) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Old status, new status, and changed by user ID are required',
        'VALIDATION_ERROR'
      ), 400);
    }

    const validStatuses = ['DRAFT', 'APPROVED', 'SHIPPED', 'RECEIVED', 'CANCELLED'];
    if (!validStatuses.includes(requestBody.oldStatus) || !validStatuses.includes(requestBody.newStatus)) {
      return c.json(createErrorResponse(
        'Validation Error',
        `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        'VALIDATION_ERROR'
      ), 400);
    }

    await service.handlePOStatusChange({
      poId,
      oldStatus: requestBody.oldStatus,
      newStatus: requestBody.newStatus,
      changedBy: requestBody.changedBy,
      tenantId: user.tenantId,
      reason: requestBody.reason
    });

    return c.json(createSuccessResponse(
      'PO status change processed successfully',
      {
        poId,
        oldStatus: requestBody.oldStatus,
        newStatus: requestBody.newStatus,
        processedAt: new Date().toISOString()
      }
    ));

  } catch (error) {
    console.error('Error processing PO status change webhook:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return c.json(createErrorResponse(
          'Not Found',
          error.message,
          'PO_NOT_FOUND'
        ), 404);
      }
      
      return c.json(createErrorResponse(
        'Operation Failed',
        error.message,
        'STATUS_CHANGE_ERROR'
      ), 400);
    }

    return c.json(createErrorResponse(
      'Internal Server Error',
      'An unexpected error occurred while processing status change',
      'INTERNAL_ERROR'
    ), 500);
  }
});

/**
 * GET /purchase-orders/:id/unallocated
 * Get unallocated items for a purchase order
 * Requirements: 3.4, 3.5
 */
poAllocationIntegration.get('/purchase-orders/:id/unallocated', async (c) => {
  try {
    const poId = c.req.param('id');
    const user = c.get('user');
    const service = c.get('poAllocationIntegrationService') as POAllocationIntegrationService;

    if (!poId) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Purchase order ID is required',
        'VALIDATION_ERROR'
      ), 400);
    }

    const unallocatedItems = await service.getUnallocatedPOItems(poId, user.tenantId);

    return c.json(createSuccessResponse(
      'Unallocated items retrieved successfully',
      {
        poId,
        unallocatedItems: unallocatedItems.map(item => ({
          poItemId: item.id,
          productId: item.productId,
          quantityOrdered: item.quantityOrdered,
          unallocatedQuantity: item.unallocatedQuantity,
          unitPriceCents: item.unitPriceCents,
          lineTotalCents: item.lineTotalCents
        })),
        totalUnallocatedItems: unallocatedItems.length,
        totalUnallocatedQuantity: unallocatedItems.reduce((sum, item) => sum + item.unallocatedQuantity, 0)
      }
    ));

  } catch (error) {
    console.error('Error getting unallocated items:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return c.json(createErrorResponse(
          'Not Found',
          error.message,
          'PO_NOT_FOUND'
        ), 404);
      }
      
      return c.json(createErrorResponse(
        'Operation Failed',
        error.message,
        'UNALLOCATED_ERROR'
      ), 400);
    }

    return c.json(createErrorResponse(
      'Internal Server Error',
      'An unexpected error occurred while retrieving unallocated items',
      'INTERNAL_ERROR'
    ), 500);
  }
});

/**
 * POST /purchase-orders/:id/sync-allocations
 * Sync allocation status with PO status
 * Requirements: 8.1, 8.4
 */
poAllocationIntegration.post('/purchase-orders/:id/sync-allocations', async (c) => {
  try {
    const poId = c.req.param('id');
    const user = c.get('user');
    const service = c.get('poAllocationIntegrationService') as POAllocationIntegrationService;

    if (!poId) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Purchase order ID is required',
        'VALIDATION_ERROR'
      ), 400);
    }

    await service.syncAllocationStatusWithPO(poId, user.tenantId);

    return c.json(createSuccessResponse(
      'Allocation status synchronized successfully',
      {
        poId,
        synchronizedAt: new Date().toISOString()
      }
    ));

  } catch (error) {
    console.error('Error syncing allocation status:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return c.json(createErrorResponse(
          'Not Found',
          error.message,
          'PO_NOT_FOUND'
        ), 404);
      }
      
      return c.json(createErrorResponse(
        'Operation Failed',
        error.message,
        'SYNC_ERROR'
      ), 400);
    }

    return c.json(createErrorResponse(
      'Internal Server Error',
      'An unexpected error occurred while syncing allocation status',
      'INTERNAL_ERROR'
    ), 500);
  }
});

/**
 * POST /purchase-orders/:id/validate-allocation
 * Validate that a PO can be allocated
 * Requirements: 8.1, 8.3
 */
poAllocationIntegration.post('/purchase-orders/:id/validate-allocation', async (c) => {
  try {
    const poId = c.req.param('id');
    const user = c.get('user');
    const service = c.get('poAllocationIntegrationService') as POAllocationIntegrationService;

    if (!poId) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Purchase order ID is required',
        'VALIDATION_ERROR'
      ), 400);
    }

    const validation = await service.validatePOForAllocation(poId, user.tenantId);

    return c.json(createSuccessResponse(
      'PO allocation validation completed',
      {
        poId,
        valid: validation.valid,
        errors: validation.errors,
        validatedAt: new Date().toISOString()
      }
    ));

  } catch (error) {
    console.error('Error validating PO for allocation:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return c.json(createErrorResponse(
          'Not Found',
          error.message,
          'PO_NOT_FOUND'
        ), 404);
      }
      
      return c.json(createErrorResponse(
        'Operation Failed',
        error.message,
        'VALIDATION_ERROR'
      ), 400);
    }

    return c.json(createErrorResponse(
      'Internal Server Error',
      'An unexpected error occurred during validation',
      'INTERNAL_ERROR'
    ), 500);
  }
});

export default poAllocationIntegration;