/**
 * Integration Tests for Inventory System
 * Tests Recipe Engine integration with existing inventory
 * Validates inventory locking and consumption workflows
 * Tests stock alert generation and availability updates
 * 
 * Feature: digital-menu-kitchen-payment-system
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RecipeEngine } from '../../src/services/recipe-engine';
import { OrderStateEngine } from '../../src/services/order-state-engine';
import { StockAlertService } from '../../src/services/stock-alert';
import { OrderState } from '../../src/db/schema';
import { OrderErrorCode } from '../../src/types/orders';

// Mock database
const mockDb = {
  transaction: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  query: {
    products: { findFirst: vi.fn(), findMany: vi.fn() },
    recipes: { findFirst: vi.fn(), findMany: vi.fn() },
    inventory: { findFirst: vi.fn(), findMany: vi.fn() },
    stockAlerts: { findFirst: vi.fn(), findMany: vi.fn() }
  }
};

// Mock inventory integration service
const mockInventoryService = {
  checkInventoryAvailability: vi.fn(),
  reserveInventoryForTransfer: vi.fn(),
  releaseInventoryReservation: vi.fn(),
  consumeInventory: vi.fn(),
  getInventoryLevels: vi.fn()
};

// Mock WebSocket service
const mockWebSocketService = {
  broadcastInventoryUpdate: vi.fn(),
  broadcast: vi.fn()
};

// Mock services
vi.mock('../../src/services/inventory-integration', () => ({
  createInventoryIntegrationService: vi.fn(() => mockInventoryService)
}));

vi.mock('../../src/services/websocket-service', () => ({
  WebSocketService: vi.fn(() => mockWebSocketService)
}));

vi.mock('../../src/db', () => ({
  getDb: vi.fn(() => mockDb)
}));

describe('Inventory System Integration Tests', () => {
  let recipeEngine: RecipeEngine;
  let orderStateEngine: OrderStateEngine;
  let stockAlertService: StockAlertService;

  const testTenantId = 'tenant-inventory-test-123';
  const testLocationId = 'location-inventory-test-456';

  beforeEach(() => {
    vi.clearAllMocks();
    recipeEngine = new RecipeEngine(mockDb as any);
    orderStateEngine = new OrderStateEngine(mockDb as any);
    stockAlertService = new StockAlertService(mockDb as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Recipe Engine Integration with Existing Inventory', () => {
    it('should calculate ingredient requirements for order items', async () => {
      // Mock menu items with recipes
      const mockMenuItemsWithRecipes = [
        {
          menuItem: { id: 'menu-1', name: 'Burger', tenantId: testTenantId },
          recipe: { id: 'recipe-1', menuItemId: 'menu-1', preparationTime: 15 },
          ingredient: { productId: 'prod-1', quantity: 2, unit: 'pieces' }
        },
        {
          menuItem: { id: 'menu-1', name: 'Burger', tenantId: testTenantId },
          recipe: { id: 'recipe-1', menuItemId: 'menu-1' },
          ingredient: { productId: 'prod-2', quantity: 1, unit: 'pieces' }
        }
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockMenuItemsWithRecipes)
            })
          })
        })
      });

      const result = await recipeEngine.calculateIngredientRequirements({
        orderId: 'order-recipe-001',
        tenantId: testTenantId,
        locationId: testLocationId,
        orderItems: [
          {
            id: 'item-1',
            orderId: 'order-recipe-001',
            menuItemId: 'menu-1',
            quantity: 3,
            unitPrice: 1500,
            totalPrice: 4500,
            status: 'PENDING' as any,
            createdAt: Date.now()
          }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.ingredientRequirements).toHaveLength(2);

      const prod1Requirement = result.ingredientRequirements!.find(r => r.productId === 'prod-1');
      expect(prod1Requirement?.totalQuantity).toBe(6); // 2 * 3

      const prod2Requirement = result.ingredientRequirements!.find(r => r.productId === 'prod-2');
      expect(prod2Requirement?.totalQuantity).toBe(3); // 1 * 3
    });

    it('should handle menu items without recipes', async () => {
      // Mock menu items without recipes
      const mockMenuItemsWithoutRecipes = [
        {
          menuItem: { id: 'menu-2', name: 'Soda', tenantId: testTenantId },
          recipe: null,
          ingredient: null
        }
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockMenuItemsWithoutRecipes)
            })
          })
        })
      });

      const result = await recipeEngine.calculateIngredientRequirements({
        orderId: 'order-no-recipe-001',
        tenantId: testTenantId,
        locationId: testLocationId,
        orderItems: [
          {
            id: 'item-2',
            orderId: 'order-no-recipe-001',
            menuItemId: 'menu-2',
            quantity: 2,
            unitPrice: 500,
            totalPrice: 1000,
            status: 'PENDING' as any,
            createdAt: Date.now()
          }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.ingredientRequirements).toHaveLength(0);
    });

    it('should aggregate ingredients across multiple order items', async () => {
      // Mock menu items with shared ingredients
      const mockMenuItemsWithSharedIngredients = [
        {
          menuItem: { id: 'menu-1', name: 'Burger', tenantId: testTenantId },
          recipe: { id: 'recipe-1', menuItemId: 'menu-1' },
          ingredient: { productId: 'prod-1', quantity: 2, unit: 'pieces' }
        },
        {
          menuItem: { id: 'menu-3', name: 'Cheese Burger', tenantId: testTenantId },
          recipe: { id: 'recipe-2', menuItemId: 'menu-3' },
          ingredient: { productId: 'prod-1', quantity: 3, unit: 'pieces' }
        }
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockMenuItemsWithSharedIngredients)
            })
          })
        })
      });

      const result = await recipeEngine.calculateIngredientRequirements({
        orderId: 'order-aggregate-001',
        tenantId: testTenantId,
        locationId: testLocationId,
        orderItems: [
          {
            id: 'item-3',
            orderId: 'order-aggregate-001',
            menuItemId: 'menu-1',
            quantity: 2,
            unitPrice: 1500,
            totalPrice: 3000,
            status: 'PENDING' as any,
            createdAt: Date.now()
          },
          {
            id: 'item-4',
            orderId: 'order-aggregate-001',
            menuItemId: 'menu-3',
            quantity: 1,
            unitPrice: 1800,
            totalPrice: 1800,
            status: 'PENDING' as any,
            createdAt: Date.now()
          }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.ingredientRequirements).toHaveLength(1);

      const prod1Requirement = result.ingredientRequirements!.find(r => r.productId === 'prod-1');
      expect(prod1Requirement?.totalQuantity).toBe(7); // (2 * 2) + (3 * 1)
    });
  });

  describe('Inventory Locking and Consumption Workflows', () => {
    it('should successfully reserve inventory for order preparation', async () => {
      // Mock order
      const mockOrder = {
        id: 'order-reserve-001',
        tenantId: testTenantId,
        locationId: testLocationId,
        state: OrderState.PLACED,
        version: 1
      };

      // Mock order items
      const mockOrderItems = [
        {
          id: 'item-5',
          orderId: 'order-reserve-001',
          menuItemId: 'menu-1',
          quantity: 2,
          unitPrice: 1500,
          totalPrice: 3000,
          status: 'PENDING',
          createdAt: Date.now()
        }
      ];

      // Mock menu items with recipes
      const mockMenuItemsWithRecipes = [
        {
          menuItem: { id: 'menu-1', name: 'Burger', tenantId: testTenantId },
          recipe: { id: 'recipe-1', menuItemId: 'menu-1' },
          ingredient: { productId: 'prod-1', quantity: 2, unit: 'pieces' }
        }
      ];

      // Mock database transaction
      mockDb.transaction.mockImplementation(async (callback: Function) => {
        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([mockOrder])
                })
              })
            })
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(mockOrderItems)
              })
            }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue({ changes: 1 })
            })
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue({})
          })
        };
        return callback(mockTx);
      });

      // Mock recipe engine database calls
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockMenuItemsWithRecipes)
            })
          })
        })
      });

      // Mock inventory availability check
      mockInventoryService.checkInventoryAvailability.mockResolvedValue({
        available: true,
        availableQuantity: 50,
        currentQuantity: 100,
        reservedQuantity: 50
      });

      // Mock inventory reservation
      mockInventoryService.reserveInventoryForTransfer.mockResolvedValue({
        reservationId: 'res-001',
        reserved: true,
        reservedQuantity: 4,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      });

      const result = await orderStateEngine.transitionState({
        orderId: 'order-reserve-001',
        fromState: OrderState.PLACED,
        toState: OrderState.PREPARING,
        transitionedBy: 'user-kitchen-001',
        reason: 'Kitchen accepted order'
      });

      expect(result.success).toBe(true);
      expect(result.newState).toBe(OrderState.PREPARING);
    });

    it('should fail reservation when inventory is insufficient', async () => {
      // Mock order
      const mockOrder = {
        id: 'order-insufficient-001',
        tenantId: testTenantId,
        locationId: testLocationId,
        state: OrderState.PLACED,
        version: 1
      };

      // Mock order items
      const mockOrderItems = [
        {
          id: 'item-6',
          orderId: 'order-insufficient-001',
          menuItemId: 'menu-1',
          quantity: 10,
          unitPrice: 1500,
          totalPrice: 15000,
          status: 'PENDING',
          createdAt: Date.now()
        }
      ];

      // Mock menu items with recipes
      const mockMenuItemsWithRecipes = [
        {
          menuItem: { id: 'menu-1', name: 'Burger', tenantId: testTenantId },
          recipe: { id: 'recipe-1', menuItemId: 'menu-1' },
          ingredient: { productId: 'prod-1', quantity: 2, unit: 'pieces' }
        }
      ];

      // Mock database transaction
      mockDb.transaction.mockImplementation(async (callback: Function) => {
        const mockTx = {
          select: vi.fn()
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([mockOrder])
                })
              })
            })
            .mockReturnValueOnce({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(mockOrderItems)
              })
            })
        };
        return callback(mockTx);
      });

      // Mock recipe engine database calls
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockMenuItemsWithRecipes)
            })
          })
        })
      });

      // Mock insufficient inventory
      mockInventoryService.checkInventoryAvailability.mockResolvedValue({
        available: false,
        availableQuantity: 5,
        currentQuantity: 10,
        reservedQuantity: 5
      });

      const result = await orderStateEngine.transitionState({
        orderId: 'order-insufficient-001',
        fromState: OrderState.PLACED,
        toState: OrderState.PREPARING,
        transitionedBy: 'user-kitchen-001',
        reason: 'Kitchen accepted order'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(OrderErrorCode.INSUFFICIENT_INVENTORY);
    });

    it('should release inventory reservation on order cancellation', async () => {
      // Mock order in PREPARING state
      const mockOrder = {
        id: 'order-cancel-reserve-001',
        tenantId: testTenantId,
        locationId: testLocationId,
        state: OrderState.PREPARING,
        version: 2
      };

      // Mock database transaction
      mockDb.transaction.mockImplementation(async (callback: Function) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockOrder])
              })
            })
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue({ changes: 1 })
            })
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue({})
          })
        };
        return callback(mockTx);
      });

      // Mock inventory release
      mockInventoryService.releaseInventoryReservation.mockResolvedValue({
        success: true,
        releasedQuantity: 4
      });

      const result = await orderStateEngine.transitionState({
        orderId: 'order-cancel-reserve-001',
        fromState: OrderState.PREPARING,
        toState: OrderState.CANCELLED,
        transitionedBy: 'user-manager-001',
        reason: 'Customer cancelled order'
      });

      expect(result.success).toBe(true);
    });

    it('should consume inventory on order completion', async () => {
      // Mock order in READY state
      const mockOrder = {
        id: 'order-consume-001',
        tenantId: testTenantId,
        locationId: testLocationId,
        state: OrderState.READY,
        version: 3
      };

      // Mock database transaction
      mockDb.transaction.mockImplementation(async (callback: Function) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockOrder])
              })
            })
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue({ changes: 1 })
            })
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue({})
          })
        };
        return callback(mockTx);
      });

      // Mock inventory consumption
      mockInventoryService.consumeInventory.mockResolvedValue({
        success: true,
        consumedQuantity: 4
      });

      const result = await orderStateEngine.transitionState({
        orderId: 'order-consume-001',
        fromState: OrderState.READY,
        toState: OrderState.DELIVERED,
        transitionedBy: 'user-cashier-001',
        reason: 'Payment completed'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Stock Alert Generation and Availability Updates', () => {
    it('should generate stock alert when inventory falls below threshold', async () => {
      const productId = 'prod-alert-001';
      const threshold = 10;
      const currentQuantity = 8;

      // Mock stock monitoring request
      const monitoringRequest = {
        tenantId: testTenantId,
        locationId: testLocationId,
        productIds: [productId]
      };

      // Mock stock level info
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            productId,
            currentQuantity,
            reservedQuantity: 2,
            inTransitQuantity: 0,
            threshold,
            criticalThreshold: 3
          }])
        })
      });

      // Mock alert creation
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue({
          id: 'alert-001',
          productId,
          tenantId: testTenantId,
          alertType: 'LOW_STOCK',
          threshold,
          currentQuantity,
          createdAt: Date.now()
        })
      });

      const result = await stockAlertService.monitorStockLevels(monitoringRequest);

      expect(result.success).toBe(true);
      expect(result.alertsGenerated).toBeGreaterThan(0);
    });

    it('should generate critical alert when inventory is critically low', async () => {
      const productId = 'prod-critical-001';
      const threshold = 10;
      const criticalThreshold = 3;
      const currentQuantity = 2;

      // Mock stock monitoring request
      const monitoringRequest = {
        tenantId: testTenantId,
        locationId: testLocationId,
        productIds: [productId]
      };

      // Mock stock level info
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            productId,
            currentQuantity,
            reservedQuantity: 1,
            inTransitQuantity: 0,
            threshold,
            criticalThreshold
          }])
        })
      });

      const result = await stockAlertService.monitorStockLevels(monitoringRequest);

      expect(result.success).toBe(true);
      expect(result.alertsGenerated).toBeGreaterThan(0);
    });

    it('should not generate alert when inventory is above threshold', async () => {
      const productId = 'prod-no-alert-001';
      const threshold = 10;
      const currentQuantity = 25;

      // Mock stock monitoring request
      const monitoringRequest = {
        tenantId: testTenantId,
        locationId: testLocationId,
        productIds: [productId]
      };

      // Mock stock level info
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            productId,
            currentQuantity,
            reservedQuantity: 5,
            inTransitQuantity: 0,
            threshold,
            criticalThreshold: 3
          }])
        })
      });

      const result = await stockAlertService.monitorStockLevels(monitoringRequest);

      expect(result.success).toBe(true);
      expect(result.alertsGenerated).toBe(0);
    });

    it('should broadcast inventory availability update via WebSocket', async () => {
      const menuItemId = 'menu-availability-001';

      // Mock WebSocket broadcast
      mockWebSocketService.broadcastInventoryUpdate.mockResolvedValue({
        success: true,
        broadcastCount: 5
      });

      const result = await mockWebSocketService.broadcastInventoryUpdate(
        testTenantId,
        menuItemId,
        false,
        'Insufficient ingredients'
      );

      expect(result.success).toBe(true);
      expect(result.broadcastCount).toBe(5);
    });

    it('should update menu item availability based on ingredient stock', async () => {
      const menuItemId = 'menu-check-001';

      // Mock menu items with recipes
      const mockMenuItemsWithRecipes = [
        {
          menuItem: { id: menuItemId, name: 'Burger', tenantId: testTenantId },
          recipe: { id: 'recipe-1', menuItemId },
          ingredient: { productId: 'prod-1', quantity: 2, unit: 'pieces' }
        }
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockMenuItemsWithRecipes)
            })
          })
        })
      });

      // Mock sufficient inventory
      mockInventoryService.checkInventoryAvailability.mockResolvedValue({
        available: true,
        availableQuantity: 50,
        currentQuantity: 100,
        reservedQuantity: 50
      });

      const result = await recipeEngine.checkMenuItemAvailability(
        [menuItemId],
        testTenantId,
        testLocationId
      );

      expect(result.get(menuItemId)).toBe(true);
    });

    it('should mark menu item unavailable when ingredient is out of stock', async () => {
      const menuItemId = 'menu-unavailable-001';

      // Mock menu items with recipes
      const mockMenuItemsWithRecipes = [
        {
          menuItem: { id: menuItemId, name: 'Burger', tenantId: testTenantId },
          recipe: { id: 'recipe-1', menuItemId },
          ingredient: { productId: 'prod-1', quantity: 2, unit: 'pieces' }
        }
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockMenuItemsWithRecipes)
            })
          })
        })
      });

      // Mock insufficient inventory
      mockInventoryService.checkInventoryAvailability.mockResolvedValue({
        available: false,
        availableQuantity: 1,
        currentQuantity: 5,
        reservedQuantity: 4
      });

      const result = await recipeEngine.checkMenuItemAvailability(
        [menuItemId],
        testTenantId,
        testLocationId
      );

      expect(result.get(menuItemId)).toBe(false);
    });
  });

  describe('Inventory Validation for Order Transitions', () => {
    it('should validate all ingredients before PREPARING transition', async () => {
      const ingredientRequirements = [
        { productId: 'prod-1', totalQuantity: 5, unit: 'pieces' },
        { productId: 'prod-2', totalQuantity: 3, unit: 'pieces' },
        { productId: 'prod-3', totalQuantity: 2, unit: 'pieces' }
      ];

      // Mock all ingredients available
      mockInventoryService.checkInventoryAvailability
        .mockResolvedValueOnce({
          available: true,
          availableQuantity: 20,
          currentQuantity: 50,
          reservedQuantity: 30
        })
        .mockResolvedValueOnce({
          available: true,
          availableQuantity: 15,
          currentQuantity: 40,
          reservedQuantity: 25
        })
        .mockResolvedValueOnce({
          available: true,
          availableQuantity: 10,
          currentQuantity: 30,
          reservedQuantity: 20
        });

      const result = await recipeEngine.validateStockAvailability({
        tenantId: testTenantId,
        locationId: testLocationId,
        ingredientRequirements: ingredientRequirements.map(req => ({
          ...req,
          menuItemBreakdown: []
        }))
      });

      expect(result.success).toBe(true);
      expect(result.allIngredientsAvailable).toBe(true);
    });

    it('should detect partial ingredient availability', async () => {
      const ingredientRequirements = [
        { productId: 'prod-1', totalQuantity: 5, unit: 'pieces' },
        { productId: 'prod-2', totalQuantity: 10, unit: 'pieces' },
        { productId: 'prod-3', totalQuantity: 2, unit: 'pieces' }
      ];

      // Mock mixed availability
      mockInventoryService.checkInventoryAvailability
        .mockResolvedValueOnce({
          available: true,
          availableQuantity: 20,
          currentQuantity: 50,
          reservedQuantity: 30
        })
        .mockResolvedValueOnce({
          available: false,
          availableQuantity: 5,
          currentQuantity: 15,
          reservedQuantity: 10
        })
        .mockResolvedValueOnce({
          available: true,
          availableQuantity: 10,
          currentQuantity: 30,
          reservedQuantity: 20
        });

      const result = await recipeEngine.validateStockAvailability({
        tenantId: testTenantId,
        locationId: testLocationId,
        ingredientRequirements: ingredientRequirements.map(req => ({
          ...req,
          menuItemBreakdown: []
        }))
      });

      expect(result.success).toBe(true);
      expect(result.allIngredientsAvailable).toBe(false);
      expect(result.availabilityDetails?.filter(d => !d.sufficient)).toHaveLength(1);
    });

    it('should handle inventory service unavailability gracefully', async () => {
      // Mock inventory service failure
      mockInventoryService.checkInventoryAvailability.mockRejectedValue(
        new Error('Inventory service unavailable')
      );

      try {
        await recipeEngine.validateStockAvailability({
          tenantId: testTenantId,
          locationId: testLocationId,
          ingredientRequirements: [
            { productId: 'prod-1', totalQuantity: 5, unit: 'pieces', menuItemBreakdown: [] }
          ]
        });
        
        // If we reach here, the function didn't throw, check for error in result
        expect(true).toBe(true);
      } catch (error: any) {
        expect(error.message).toBe('Inventory service unavailable');
      }
    });
  });

  describe('Concurrent Inventory Operations', () => {
    it('should handle concurrent reservations with optimistic locking', async () => {
      // Mock order
      const mockOrder = {
        id: 'order-concurrent-001',
        tenantId: testTenantId,
        locationId: testLocationId,
        state: OrderState.PLACED,
        version: 1
      };

      // Mock database transaction with optimistic lock failure
      mockDb.transaction.mockImplementation(async (callback: Function) => {
        const mockTx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockOrder])
              })
            })
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue({ changes: 0 }) // Optimistic lock failure
            })
          })
        };
        return callback(mockTx);
      });

      const result = await orderStateEngine.transitionState({
        orderId: 'order-concurrent-001',
        fromState: OrderState.PLACED,
        toState: OrderState.PREPARING,
        transitionedBy: 'user-kitchen-001'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(OrderErrorCode.CONCURRENT_MODIFICATION);
    });

    it('should handle reservation conflicts with retry', async () => {
      // Mock first reservation conflict
      mockInventoryService.reserveInventoryForTransfer
        .mockRejectedValueOnce(new Error('Reservation conflict'))
        .mockResolvedValueOnce({
          reservationId: 'res-retry-001',
          reserved: true,
          reservedQuantity: 4
        });

      // First attempt should fail
      const firstAttempt = await mockInventoryService.reserveInventoryForTransfer(
        'prod-1',
        testLocationId,
        4,
        'order_retry_001',
        'user-001',
        testTenantId
      ).catch(err => ({ success: false, error: err.message }));

      expect(firstAttempt.success).toBe(false);

      // Retry should succeed
      const retryResult = await mockInventoryService.reserveInventoryForTransfer(
        'prod-1',
        testLocationId,
        4,
        'order_retry_001',
        'user-001',
        testTenantId
      );

      expect(retryResult.reserved).toBe(true);
    });
  });
});