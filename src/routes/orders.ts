// Order Management API Routes

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { OrderStateEngine } from '../services/order-state-engine';
import { OrderManagementService } from '../services/order-management';
import { OrderState } from '../db/schema';
import { OrderErrorCode } from '../types/orders';
import { getDb } from '../db';
import { authenticate, injectTenantContext } from '../middleware/auth';

const app = new Hono();

// Apply authentication and tenant context to all routes
app.use('*', authenticate());
app.use('*', injectTenantContext());

// Validation schemas
const createOrderSchema = z.object({
  locationId: z.string().uuid(),
  tableNumber: z.string().optional(),
  waiterId: z.string().uuid().optional(),
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().positive(),
    specialInstructions: z.string().optional()
  })).min(1),
  specialInstructions: z.string().optional()
});

const updateOrderSchema = z.object({
  version: z.number().int().positive(),
  tableNumber: z.string().optional(),
  waiterId: z.string().uuid().optional(),
  specialInstructions: z.string().optional(),
  items: z.array(z.object({
    id: z.string().uuid().optional(),
    menuItemId: z.string().uuid(),
    quantity: z.number().int().positive(),
    specialInstructions: z.string().optional()
  })).optional()
});

const stateTransitionSchema = z.object({
  toState: z.enum([OrderState.PLACED, OrderState.PREPARING, OrderState.READY, OrderState.DELIVERED, OrderState.CANCELLED]),
  fromState: z.enum([OrderState.PLACED, OrderState.PREPARING, OrderState.READY, OrderState.DELIVERED, OrderState.CANCELLED]).optional(),
  reason: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

const batchStateTransitionSchema = z.object({
  transitions: z.array(z.object({
    orderId: z.string().uuid(),
    toState: z.enum([OrderState.PLACED, OrderState.PREPARING, OrderState.READY, OrderState.DELIVERED, OrderState.CANCELLED]),
    fromState: z.enum([OrderState.PLACED, OrderState.PREPARING, OrderState.READY, OrderState.DELIVERED, OrderState.CANCELLED]).optional(),
    reason: z.string().optional(),
    metadata: z.record(z.any()).optional()
  })).min(1).max(50)
});

// Create new order
app.post('/orders', zValidator('json', createOrderSchema), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const userId = c.get('userId') as string;
    const body = c.req.valid('json');

    const db = getDb(c.env);
    const orderService = new OrderManagementService(db);

    const result = await orderService.createOrder({
      tenantId,
      locationId: body.locationId,
      tableNumber: body.tableNumber,
      waiterId: body.waiterId,
      items: body.items,
      specialInstructions: body.specialInstructions
    });

    if (!result.success) {
      return c.json({
        error: result.error,
        errorCode: result.errorCode
      }, 400);
    }

    return c.json({
      success: true,
      order: result.order
    }, 201);
  } catch (error) {
    console.error('Error creating order:', error);
    return c.json({
      error: 'Internal server error',
      errorCode: OrderErrorCode.VALIDATION_ERROR
    }, 500);
  }
});

// Get orders with filtering
app.get('/orders', async (c) => {
  try {
    const tenantId = c.get('tenantId');
    const locationId = c.req.query('locationId');
    const waiterId = c.req.query('waiterId');
    const state = c.req.query('state') as OrderState;
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 50;
    const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0;

    const db = getDb(c.env);
    const orderService = new OrderManagementService(db);

    const orders = await orderService.getOrders(tenantId, {
      locationId,
      waiterId,
      state,
      limit,
      offset
    });

    return c.json({
      success: true,
      orders,
      pagination: {
        limit,
        offset,
        total: orders.length
      }
    });
  } catch (error) {
    console.error('Error getting orders:', error);
    return c.json({
      error: 'Internal server error',
      errorCode: OrderErrorCode.VALIDATION_ERROR
    }, 500);
  }
});

// Get specific order
app.get('/orders/:orderId', async (c) => {
  try {
    const tenantId = c.get('tenantId');
    const orderId = c.req.param('orderId');

    const db = getDb(c.env);
    const orderService = new OrderManagementService(db);

    const order = await orderService.getOrderById(orderId);

    if (!order) {
      return c.json({
        error: 'Order not found',
        errorCode: OrderErrorCode.ORDER_NOT_FOUND
      }, 404);
    }

    // Verify tenant access
    if (order.tenantId !== tenantId) {
      return c.json({
        error: 'Access denied',
        errorCode: OrderErrorCode.ORDER_NOT_FOUND
      }, 404);
    }

    return c.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Error getting order:', error);
    return c.json({
      error: 'Internal server error',
      errorCode: OrderErrorCode.VALIDATION_ERROR
    }, 500);
  }
});

// Update order
app.put('/orders/:orderId', zValidator('json', updateOrderSchema), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const userId = c.get('userId') as string;
    const orderId = c.req.param('orderId');
    const body = c.req.valid('json');

    const db = getDb(c.env);
    const orderService = new OrderManagementService(db);

    // Verify order exists and belongs to tenant
    const existingOrder = await orderService.getOrderById(orderId);
    if (!existingOrder || existingOrder.tenantId !== tenantId) {
      return c.json({
        error: 'Order not found',
        errorCode: OrderErrorCode.ORDER_NOT_FOUND
      }, 404);
    }

    const result = await orderService.updateOrder({
      orderId,
      version: body.version,
      tableNumber: body.tableNumber,
      waiterId: body.waiterId,
      specialInstructions: body.specialInstructions,
      items: body.items
    });

    if (!result.success) {
      return c.json({
        error: result.error,
        errorCode: result.errorCode
      }, 400);
    }

    return c.json({
      success: true,
      order: result.order
    });
  } catch (error) {
    console.error('Error updating order:', error);
    return c.json({
      error: 'Internal server error',
      errorCode: OrderErrorCode.VALIDATION_ERROR
    }, 500);
  }
});

// Partial update order (PATCH) - for waiter panel modifications
const patchOrderSchema = z.object({
  specialInstructions: z.string().optional(),
  items: z.array(z.object({
    id: z.string().uuid(),
    specialInstructions: z.string().optional()
  })).optional()
});

app.patch('/orders/:orderId', zValidator('json', patchOrderSchema), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const userId = c.get('userId') as string;
    const orderId = c.req.param('orderId');
    const body = c.req.valid('json');

    const db = getDb(c.env);
    const orderService = new OrderManagementService(db);

    // Verify order exists and belongs to tenant
    const existingOrder = await orderService.getOrderById(orderId);
    if (!existingOrder || existingOrder.tenantId !== tenantId) {
      return c.json({
        error: 'Order not found',
        errorCode: OrderErrorCode.ORDER_NOT_FOUND
      }, 404);
    }

    const result = await orderService.updateOrderInstructions({
      orderId,
      specialInstructions: body.specialInstructions,
      itemInstructions: body.items
    });

    if (!result.success) {
      return c.json({
        error: result.error,
        errorCode: result.errorCode
      }, 400);
    }

    return c.json({
      success: true,
      order: result.order
    });
  } catch (error) {
    console.error('Error patching order:', error);
    return c.json({
      error: 'Internal server error',
      errorCode: OrderErrorCode.VALIDATION_ERROR
    }, 500);
  }
});

// Transition order state
app.post('/orders/:orderId/transition', zValidator('json', stateTransitionSchema), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const userId = c.get('userId') as string;
    const orderId = c.req.param('orderId');
    const body = c.req.valid('json');

    const db = getDb(c.env);
    const orderService = new OrderManagementService(db);
    const stateEngine = new OrderStateEngine(db);

    // Verify order exists and belongs to tenant
    const existingOrder = await orderService.getOrderById(orderId);
    if (!existingOrder || existingOrder.tenantId !== tenantId) {
      return c.json({
        error: 'Order not found',
        errorCode: OrderErrorCode.ORDER_NOT_FOUND
      }, 404);
    }

    const result = await stateEngine.transitionState({
      orderId,
      fromState: body.fromState,
      toState: body.toState,
      transitionedBy: userId,
      reason: body.reason,
      metadata: body.metadata
    });

    if (!result.success) {
      return c.json({
        error: result.error,
        errorCode: result.errorCode
      }, 400);
    }

    // Get updated order
    const updatedOrder = await orderService.getOrderById(orderId);

    return c.json({
      success: true,
      order: updatedOrder,
      transition: {
        newState: result.newState,
        metadata: result.metadata
      }
    });
  } catch (error) {
    console.error('Error transitioning order state:', error);
    return c.json({
      error: 'Internal server error',
      errorCode: OrderErrorCode.VALIDATION_ERROR
    }, 500);
  }
});

// Batch state transitions (for kitchen operations)
app.post('/orders/batch-transition', zValidator('json', batchStateTransitionSchema), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const userId = c.get('userId') as string;
    const body = c.req.valid('json');

    const db = getDb(c.env);
    const orderService = new OrderManagementService(db);
    const stateEngine = new OrderStateEngine(db);

    // Verify all orders exist and belong to tenant
    const orderIds = body.transitions.map(t => t.orderId);
    const verificationPromises = orderIds.map(id => orderService.getOrderById(id));
    const orders = await Promise.all(verificationPromises);

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      if (!order || order.tenantId !== tenantId) {
        return c.json({
          error: `Order not found: ${orderIds[i]}`,
          errorCode: OrderErrorCode.ORDER_NOT_FOUND
        }, 400);
      }
    }

    // Execute batch transitions
    const transitionRequests = body.transitions.map(t => ({
      orderId: t.orderId,
      fromState: t.fromState,
      toState: t.toState,
      transitionedBy: userId,
      reason: t.reason,
      metadata: t.metadata
    }));

    const results = await stateEngine.batchTransitionStates(transitionRequests);

    // Get updated orders
    const updatedOrderPromises = orderIds.map(id => orderService.getOrderById(id));
    const updatedOrders = await Promise.all(updatedOrderPromises);

    return c.json({
      success: true,
      results: results.map((result, index) => ({
        orderId: orderIds[index],
        success: result.success,
        newState: result.newState,
        error: result.error,
        errorCode: result.errorCode
      })),
      orders: updatedOrders.filter(order => order !== null)
    });
  } catch (error) {
    console.error('Error batch transitioning order states:', error);
    return c.json({
      error: 'Internal server error',
      errorCode: OrderErrorCode.VALIDATION_ERROR
    }, 500);
  }
});

// Cancel order
app.post('/orders/:orderId/cancel', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const userId = c.get('userId') as string;
    const orderId = c.req.param('orderId');
    const reason = c.req.query('reason');

    const db = getDb(c.env);
    const orderService = new OrderManagementService(db);

    // Verify order exists and belongs to tenant
    const existingOrder = await orderService.getOrderById(orderId);
    if (!existingOrder || existingOrder.tenantId !== tenantId) {
      return c.json({
        error: 'Order not found',
        errorCode: OrderErrorCode.ORDER_NOT_FOUND
      }, 404);
    }

    const result = await orderService.cancelOrder(orderId, reason, userId);

    if (!result.success) {
      return c.json({
        error: result.error,
        errorCode: result.errorCode
      }, 400);
    }

    return c.json({
      success: true,
      order: result.order
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    return c.json({
      error: 'Internal server error',
      errorCode: OrderErrorCode.VALIDATION_ERROR
    }, 500);
  }
});

// Get order state transition history
app.get('/orders/:orderId/transitions', async (c) => {
  try {
    const tenantId = c.get('tenantId');
    const orderId = c.req.param('orderId');

    const db = getDb(c.env);
    const orderService = new OrderManagementService(db);
    const stateEngine = new OrderStateEngine(db);

    // Verify order exists and belongs to tenant
    const existingOrder = await orderService.getOrderById(orderId);
    if (!existingOrder || existingOrder.tenantId !== tenantId) {
      return c.json({
        error: 'Order not found',
        errorCode: OrderErrorCode.ORDER_NOT_FOUND
      }, 404);
    }

    const transitions = await stateEngine.getStateTransitionHistory(orderId);

    return c.json({
      success: true,
      transitions
    });
  } catch (error) {
    console.error('Error getting order transitions:', error);
    return c.json({
      error: 'Internal server error',
      errorCode: OrderErrorCode.VALIDATION_ERROR
    }, 500);
  }
});

// Get order state statistics
app.get('/orders/statistics/states', async (c) => {
  try {
    const tenantId = c.get('tenantId');
    const locationId = c.req.query('locationId');

    const db = getDb(c.env);
    const stateEngine = new OrderStateEngine(db);

    const statistics = await stateEngine.getOrderStateStatistics(tenantId, locationId);

    return c.json({
      success: true,
      statistics
    });
  } catch (error) {
    console.error('Error getting order statistics:', error);
    return c.json({
      error: 'Internal server error',
      errorCode: OrderErrorCode.VALIDATION_ERROR
    }, 500);
  }
});

// Get valid next states for an order
app.get('/orders/:orderId/valid-states', async (c) => {
  try {
    const tenantId = c.get('tenantId');
    const orderId = c.req.param('orderId');

    const db = getDb(c.env);
    const orderService = new OrderManagementService(db);
    const stateEngine = new OrderStateEngine(db);

    // Verify order exists and belongs to tenant
    const existingOrder = await orderService.getOrderById(orderId);
    if (!existingOrder || existingOrder.tenantId !== tenantId) {
      return c.json({
        error: 'Order not found',
        errorCode: OrderErrorCode.ORDER_NOT_FOUND
      }, 404);
    }

    const validNextStates = stateEngine.getValidNextStates(existingOrder.state);

    return c.json({
      success: true,
      currentState: existingOrder.state,
      validNextStates
    });
  } catch (error) {
    console.error('Error getting valid states:', error);
    return c.json({
      error: 'Internal server error',
      errorCode: OrderErrorCode.VALIDATION_ERROR
    }, 500);
  }
});

export default app;