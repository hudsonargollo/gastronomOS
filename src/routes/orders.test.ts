// Unit Tests for Order APIs
// **Validates: Requirements 1.2, 1.3**

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import ordersApp from './orders';
import { OrderState } from '../db/schema';
import { OrderErrorCode } from '../types/orders';

// Mock services
vi.mock('../services/order-management', () => ({
  OrderManagementService: vi.fn()
}));
vi.mock('../services/order-state-engine', () => ({
  OrderStateEngine: vi.fn()
}));
vi.mock('../db', () => ({
  getDb: vi.fn()
}));

const mockOrderService = {
  createOrder: vi.fn(),
  updateOrder: vi.fn(),
  getOrderById: vi.fn(),
  getOrders: vi.fn(),
  cancelOrder: vi.fn()
};

const mockStateEngine = {
  transitionState: vi.fn(),
  batchTransitionStates: vi.fn(),
  getStateTransitionHistory: vi.fn(),
  getOrderStateStatistics: vi.fn(),
  getValidNextStates: vi.fn()
};

const mockDb = {};

// Mock implementations
import { OrderManagementService } from '../services/order-management';
import { OrderStateEngine } from '../services/order-state-engine';
import { getDb } from '../db';

vi.mocked(OrderManagementService).mockImplementation(() => mockOrderService as any);
vi.mocked(OrderStateEngine).mockImplementation(() => mockStateEngine as any);
vi.mocked(getDb).mockReturnValue(mockDb);

describe('Order API Routes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    
    // Mock authentication middleware
    app.use('*', async (c, next) => {
      c.set('tenantId', 'test-tenant-id');
      c.set('userId', 'test-user-id');
      await next();
    });
    
    app.route('/api', ordersApp);
  });

  describe('POST /orders', () => {
    it('should create a new order successfully', async () => {
      const orderData = {
        locationId: '550e8400-e29b-41d4-a716-446655440000',
        tableNumber: 'T1',
        waiterId: '550e8400-e29b-41d4-a716-446655440001',
        items: [
          {
            menuItemId: '550e8400-e29b-41d4-a716-446655440002',
            quantity: 2,
            specialInstructions: 'No onions'
          }
        ],
        specialInstructions: 'Rush order'
      };

      const mockOrder = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        tenantId: 'test-tenant-id',
        orderNumber: '20240101-0001',
        state: OrderState.PLACED,
        ...orderData,
        totalAmount: 2000,
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        items: []
      };

      mockOrderService.createOrder.mockResolvedValue({
        success: true,
        order: mockOrder
      });

      const response = await app.request('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      expect(response.status).toBe(201);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.order).toEqual(mockOrder);
      expect(mockOrderService.createOrder).toHaveBeenCalledWith({
        tenantId: 'test-tenant-id',
        ...orderData
      });
    });

    it('should return 400 for invalid order data', async () => {
      const invalidOrderData = {
        locationId: '550e8400-e29b-41d4-a716-446655440000',
        items: [] // Empty items array should be invalid
      };

      const response = await app.request('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidOrderData)
      });

      expect(response.status).toBe(400);
    });

    it('should handle order creation failure', async () => {
      const orderData = {
        locationId: '550e8400-e29b-41d4-a716-446655440000',
        items: [
          {
            menuItemId: '550e8400-e29b-41d4-a716-446655440002',
            quantity: 1
          }
        ]
      };

      mockOrderService.createOrder.mockResolvedValue({
        success: false,
        error: 'Menu item not found',
        errorCode: OrderErrorCode.INVALID_MENU_ITEM
      });

      const response = await app.request('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toBe('Menu item not found');
      expect(result.errorCode).toBe(OrderErrorCode.INVALID_MENU_ITEM);
    });
  });

  describe('GET /orders', () => {
    it('should get orders with filtering', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          tenantId: 'test-tenant-id',
          state: OrderState.PLACED,
          locationId: 'location-1'
        },
        {
          id: 'order-2',
          tenantId: 'test-tenant-id',
          state: OrderState.PREPARING,
          locationId: 'location-1'
        }
      ];

      mockOrderService.getOrders.mockResolvedValue(mockOrders);

      const response = await app.request('/api/orders?locationId=location-1&state=PLACED&limit=10&offset=0');

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.orders).toEqual(mockOrders);
      expect(result.pagination).toEqual({
        limit: 10,
        offset: 0,
        total: 2
      });

      expect(mockOrderService.getOrders).toHaveBeenCalledWith('test-tenant-id', {
        locationId: 'location-1',
        state: 'PLACED',
        limit: 10,
        offset: 0
      });
    });

    it('should use default pagination values', async () => {
      mockOrderService.getOrders.mockResolvedValue([]);

      const response = await app.request('/api/orders');

      expect(response.status).toBe(200);
      expect(mockOrderService.getOrders).toHaveBeenCalledWith('test-tenant-id', {
        locationId: undefined,
        waiterId: undefined,
        state: undefined,
        limit: 50,
        offset: 0
      });
    });
  });

  describe('GET /orders/:orderId', () => {
    it('should get specific order', async () => {
      const mockOrder = {
        id: 'order-1',
        tenantId: 'test-tenant-id',
        orderNumber: '20240101-0001',
        state: OrderState.PLACED,
        items: []
      };

      mockOrderService.getOrderById.mockResolvedValue(mockOrder);

      const response = await app.request('/api/orders/order-1');

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.order).toEqual(mockOrder);
    });

    it('should return 404 for non-existent order', async () => {
      mockOrderService.getOrderById.mockResolvedValue(null);

      const response = await app.request('/api/orders/non-existent');

      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result.error).toBe('Order not found');
      expect(result.errorCode).toBe(OrderErrorCode.ORDER_NOT_FOUND);
    });

    it('should return 404 for order from different tenant', async () => {
      const mockOrder = {
        id: 'order-1',
        tenantId: 'different-tenant-id',
        state: OrderState.PLACED
      };

      mockOrderService.getOrderById.mockResolvedValue(mockOrder);

      const response = await app.request('/api/orders/order-1');

      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result.error).toBe('Access denied');
    });
  });

  describe('PUT /orders/:orderId', () => {
    it('should update order successfully', async () => {
      const updateData = {
        version: 1,
        tableNumber: 'T2',
        specialInstructions: 'Updated instructions'
      };

      const existingOrder = {
        id: 'order-1',
        tenantId: 'test-tenant-id',
        state: OrderState.PLACED,
        version: 1
      };

      const updatedOrder = {
        ...existingOrder,
        ...updateData,
        version: 2
      };

      mockOrderService.getOrderById.mockResolvedValue(existingOrder);
      mockOrderService.updateOrder.mockResolvedValue({
        success: true,
        order: updatedOrder
      });

      const response = await app.request('/api/orders/order-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.order).toEqual(updatedOrder);
    });

    it('should handle concurrent modification', async () => {
      const updateData = {
        version: 1,
        tableNumber: 'T2'
      };

      const existingOrder = {
        id: 'order-1',
        tenantId: 'test-tenant-id',
        state: OrderState.PLACED,
        version: 1
      };

      mockOrderService.getOrderById.mockResolvedValue(existingOrder);
      mockOrderService.updateOrder.mockResolvedValue({
        success: false,
        error: 'Order was modified by another process',
        errorCode: OrderErrorCode.CONCURRENT_MODIFICATION
      });

      const response = await app.request('/api/orders/order-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.errorCode).toBe(OrderErrorCode.CONCURRENT_MODIFICATION);
    });
  });

  describe('POST /orders/:orderId/transition', () => {
    it('should transition order state successfully', async () => {
      const transitionData = {
        toState: OrderState.PREPARING,
        reason: 'Kitchen started preparation'
      };

      const existingOrder = {
        id: 'order-1',
        tenantId: 'test-tenant-id',
        state: OrderState.PLACED
      };

      const updatedOrder = {
        ...existingOrder,
        state: OrderState.PREPARING
      };

      mockOrderService.getOrderById
        .mockResolvedValueOnce(existingOrder)
        .mockResolvedValueOnce(updatedOrder);

      mockStateEngine.transitionState.mockResolvedValue({
        success: true,
        newState: OrderState.PREPARING,
        metadata: { transitionedAt: Date.now() }
      });

      const response = await app.request('/api/orders/order-1/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transitionData)
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.order.state).toBe(OrderState.PREPARING);
      expect(result.transition.newState).toBe(OrderState.PREPARING);
    });

    it('should handle invalid state transition', async () => {
      const transitionData = {
        toState: OrderState.DELIVERED,
        fromState: OrderState.PLACED
      };

      const existingOrder = {
        id: 'order-1',
        tenantId: 'test-tenant-id',
        state: OrderState.PLACED
      };

      mockOrderService.getOrderById.mockResolvedValue(existingOrder);
      mockStateEngine.transitionState.mockResolvedValue({
        success: false,
        error: 'Invalid state transition',
        errorCode: OrderErrorCode.INVALID_STATE_TRANSITION
      });

      const response = await app.request('/api/orders/order-1/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transitionData)
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.errorCode).toBe(OrderErrorCode.INVALID_STATE_TRANSITION);
    });
  });

  describe('POST /orders/batch-transition', () => {
    it('should handle batch state transitions', async () => {
      const batchData = {
        transitions: [
          {
            orderId: 'order-1',
            toState: OrderState.PREPARING
          },
          {
            orderId: 'order-2',
            toState: OrderState.READY
          }
        ]
      };

      const mockOrders = [
        { id: 'order-1', tenantId: 'test-tenant-id', state: OrderState.PLACED },
        { id: 'order-2', tenantId: 'test-tenant-id', state: OrderState.PREPARING }
      ];

      const updatedOrders = [
        { ...mockOrders[0], state: OrderState.PREPARING },
        { ...mockOrders[1], state: OrderState.READY }
      ];

      mockOrderService.getOrderById
        .mockResolvedValueOnce(mockOrders[0])
        .mockResolvedValueOnce(mockOrders[1])
        .mockResolvedValueOnce(updatedOrders[0])
        .mockResolvedValueOnce(updatedOrders[1]);

      mockStateEngine.batchTransitionStates.mockResolvedValue([
        { success: true, newState: OrderState.PREPARING },
        { success: true, newState: OrderState.READY }
      ]);

      const response = await app.request('/api/orders/batch-transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchData)
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);
      expect(result.orders).toHaveLength(2);
    });

    it('should handle batch with some failures', async () => {
      const batchData = {
        transitions: [
          {
            orderId: 'order-1',
            toState: OrderState.PREPARING
          },
          {
            orderId: 'order-2',
            toState: OrderState.DELIVERED // Invalid transition
          }
        ]
      };

      const mockOrders = [
        { id: 'order-1', tenantId: 'test-tenant-id', state: OrderState.PLACED },
        { id: 'order-2', tenantId: 'test-tenant-id', state: OrderState.PLACED }
      ];

      mockOrderService.getOrderById
        .mockResolvedValueOnce(mockOrders[0])
        .mockResolvedValueOnce(mockOrders[1])
        .mockResolvedValueOnce({ ...mockOrders[0], state: OrderState.PREPARING })
        .mockResolvedValueOnce(mockOrders[1]);

      mockStateEngine.batchTransitionStates.mockResolvedValue([
        { success: true, newState: OrderState.PREPARING },
        { 
          success: false, 
          error: 'Invalid state transition',
          errorCode: OrderErrorCode.INVALID_STATE_TRANSITION
        }
      ]);

      const response = await app.request('/api/orders/batch-transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchData)
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].errorCode).toBe(OrderErrorCode.INVALID_STATE_TRANSITION);
    });
  });

  describe('POST /orders/:orderId/cancel', () => {
    it('should cancel order successfully', async () => {
      const existingOrder = {
        id: 'order-1',
        tenantId: 'test-tenant-id',
        state: OrderState.PLACED
      };

      const cancelledOrder = {
        ...existingOrder,
        state: OrderState.CANCELLED
      };

      mockOrderService.getOrderById.mockResolvedValue(existingOrder);
      mockOrderService.cancelOrder.mockResolvedValue({
        success: true,
        order: cancelledOrder
      });

      const response = await app.request('/api/orders/order-1/cancel?reason=Customer%20request', {
        method: 'POST'
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.order.state).toBe(OrderState.CANCELLED);
      expect(mockOrderService.cancelOrder).toHaveBeenCalledWith('order-1', 'Customer request', 'test-user-id');
    });

    it('should handle cancellation of delivered order', async () => {
      const existingOrder = {
        id: 'order-1',
        tenantId: 'test-tenant-id',
        state: OrderState.DELIVERED
      };

      mockOrderService.getOrderById.mockResolvedValue(existingOrder);
      mockOrderService.cancelOrder.mockResolvedValue({
        success: false,
        error: 'Cannot cancel delivered order',
        errorCode: OrderErrorCode.INVALID_STATE_TRANSITION
      });

      const response = await app.request('/api/orders/order-1/cancel', {
        method: 'POST'
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.errorCode).toBe(OrderErrorCode.INVALID_STATE_TRANSITION);
    });
  });

  describe('GET /orders/:orderId/transitions', () => {
    it('should get order state transition history', async () => {
      const existingOrder = {
        id: 'order-1',
        tenantId: 'test-tenant-id',
        state: OrderState.READY
      };

      const transitions = [
        {
          id: 'transition-1',
          orderId: 'order-1',
          fromState: null,
          toState: OrderState.PLACED,
          transitionedAt: Date.now() - 3600000
        },
        {
          id: 'transition-2',
          orderId: 'order-1',
          fromState: OrderState.PLACED,
          toState: OrderState.PREPARING,
          transitionedAt: Date.now() - 1800000
        },
        {
          id: 'transition-3',
          orderId: 'order-1',
          fromState: OrderState.PREPARING,
          toState: OrderState.READY,
          transitionedAt: Date.now()
        }
      ];

      mockOrderService.getOrderById.mockResolvedValue(existingOrder);
      mockStateEngine.getStateTransitionHistory.mockResolvedValue(transitions);

      const response = await app.request('/api/orders/order-1/transitions');

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.transitions).toEqual(transitions);
    });
  });

  describe('GET /orders/statistics/states', () => {
    it('should get order state statistics', async () => {
      const statistics = {
        [OrderState.PLACED]: 5,
        [OrderState.PREPARING]: 3,
        [OrderState.READY]: 2,
        [OrderState.DELIVERED]: 10,
        [OrderState.CANCELLED]: 1
      };

      mockStateEngine.getOrderStateStatistics.mockResolvedValue(statistics);

      const response = await app.request('/api/orders/statistics/states?locationId=location-1');

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.statistics).toEqual(statistics);
      expect(mockStateEngine.getOrderStateStatistics).toHaveBeenCalledWith('test-tenant-id', 'location-1');
    });
  });

  describe('GET /orders/:orderId/valid-states', () => {
    it('should get valid next states for order', async () => {
      const existingOrder = {
        id: 'order-1',
        tenantId: 'test-tenant-id',
        state: OrderState.PLACED
      };

      const validNextStates = [OrderState.PREPARING, OrderState.CANCELLED];

      mockOrderService.getOrderById.mockResolvedValue(existingOrder);
      mockStateEngine.getValidNextStates.mockReturnValue(validNextStates);

      const response = await app.request('/api/orders/order-1/valid-states');

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.currentState).toBe(OrderState.PLACED);
      expect(result.validNextStates).toEqual(validNextStates);
    });
  });
});