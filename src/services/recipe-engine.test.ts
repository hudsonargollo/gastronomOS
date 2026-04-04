// Recipe Engine Tests

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { RecipeEngine } from './recipe-engine';
import { OrderErrorCode } from '../types/orders';

// Mock the database
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn()
};

// Mock the inventory integration service
const mockInventoryService = {
  checkInventoryAvailability: vi.fn(),
  reserveInventoryForTransfer: vi.fn(),
  releaseInventoryReservation: vi.fn()
};

// Mock the createInventoryIntegrationService function
vi.mock('./inventory-integration', () => ({
  createInventoryIntegrationService: vi.fn(() => mockInventoryService)
}));

// Mock utils
vi.mock('../utils', () => ({
  generateId: vi.fn(() => 'test-id'),
  getCurrentTimestamp: vi.fn(() => 1234567890)
}));

describe('RecipeEngine', () => {
  let recipeEngine: RecipeEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    recipeEngine = new RecipeEngine(mockDb as any);
  });

  describe('calculateIngredientRequirements', () => {
    it('should calculate ingredient requirements for order items', async () => {
      // Mock database response for menu items with recipes
      const mockMenuItemsWithRecipes = [
        {
          menuItem: { id: 'menu1', name: 'Burger', tenantId: 'tenant1' },
          recipe: { id: 'recipe1', menuItemId: 'menu1' },
          ingredient: { productId: 'prod1', quantity: 2, unit: 'pieces' }
        },
        {
          menuItem: { id: 'menu1', name: 'Burger', tenantId: 'tenant1' },
          recipe: { id: 'recipe1', menuItemId: 'menu1' },
          ingredient: { productId: 'prod2', quantity: 1, unit: 'pieces' }
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

      const request = {
        orderId: 'order1',
        tenantId: 'tenant1',
        locationId: 'location1',
        orderItems: [
          {
            id: 'item1',
            orderId: 'order1',
            menuItemId: 'menu1',
            quantity: 2,
            unitPrice: 1000,
            totalPrice: 2000,
            status: 'PENDING' as any,
            createdAt: 1234567890
          }
        ]
      };

      const result = await recipeEngine.calculateIngredientRequirements(request);

      expect(result.success).toBe(true);
      expect(result.ingredientRequirements).toHaveLength(2);
      expect(result.ingredientRequirements![0]).toEqual({
        productId: 'prod1',
        totalQuantity: 4, // 2 ingredients * 2 order quantity
        unit: 'pieces',
        menuItemBreakdown: [{
          menuItemId: 'menu1',
          menuItemName: 'Burger',
          quantity: 2,
          unitQuantity: 2
        }]
      });
    });

    it('should handle empty order items', async () => {
      const request = {
        orderId: 'order1',
        tenantId: 'tenant1',
        locationId: 'location1',
        orderItems: []
      };

      const result = await recipeEngine.calculateIngredientRequirements(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No order items provided');
      expect(result.errorCode).toBe(OrderErrorCode.VALIDATION_ERROR);
    });

    it('should handle menu items without recipes', async () => {
      // Mock database response for menu items without recipes
      const mockMenuItemsWithoutRecipes = [
        {
          menuItem: { id: 'menu1', name: 'Burger', tenantId: 'tenant1' },
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

      const request = {
        orderId: 'order1',
        tenantId: 'tenant1',
        locationId: 'location1',
        orderItems: [
          {
            id: 'item1',
            orderId: 'order1',
            menuItemId: 'menu1',
            quantity: 1,
            unitPrice: 1000,
            totalPrice: 1000,
            status: 'PENDING' as any,
            createdAt: 1234567890
          }
        ]
      };

      const result = await recipeEngine.calculateIngredientRequirements(request);

      expect(result.success).toBe(true);
      expect(result.ingredientRequirements).toHaveLength(0);
    });
  });

  describe('validateStockAvailability', () => {
    it('should validate stock availability for all ingredients', async () => {
      mockInventoryService.checkInventoryAvailability
        .mockResolvedValueOnce({
          available: true,
          availableQuantity: 10,
          currentQuantity: 15,
          reservedQuantity: 5,
          inTransitQuantity: 0
        })
        .mockResolvedValueOnce({
          available: true,
          availableQuantity: 5,
          currentQuantity: 8,
          reservedQuantity: 3,
          inTransitQuantity: 0
        });

      const request = {
        tenantId: 'tenant1',
        locationId: 'location1',
        ingredientRequirements: [
          {
            productId: 'prod1',
            totalQuantity: 5,
            unit: 'pieces',
            menuItemBreakdown: []
          },
          {
            productId: 'prod2',
            totalQuantity: 3,
            unit: 'pieces',
            menuItemBreakdown: []
          }
        ]
      };

      const result = await recipeEngine.validateStockAvailability(request);

      expect(result.success).toBe(true);
      expect(result.allIngredientsAvailable).toBe(true);
      expect(result.availabilityDetails).toHaveLength(2);
      expect(result.availabilityDetails[0]).toEqual({
        productId: 'prod1',
        required: 5,
        available: 10,
        sufficient: true,
        unit: 'pieces'
      });
    });

    it('should detect insufficient stock', async () => {
      mockInventoryService.checkInventoryAvailability
        .mockResolvedValueOnce({
          available: true,
          availableQuantity: 2, // Less than required
          currentQuantity: 5,
          reservedQuantity: 3,
          inTransitQuantity: 0
        });

      const request = {
        tenantId: 'tenant1',
        locationId: 'location1',
        ingredientRequirements: [
          {
            productId: 'prod1',
            totalQuantity: 5,
            unit: 'pieces',
            menuItemBreakdown: []
          }
        ]
      };

      const result = await recipeEngine.validateStockAvailability(request);

      expect(result.success).toBe(true);
      expect(result.allIngredientsAvailable).toBe(false);
      expect(result.availabilityDetails[0].sufficient).toBe(false);
    });

    it('should handle empty ingredient requirements', async () => {
      const request = {
        tenantId: 'tenant1',
        locationId: 'location1',
        ingredientRequirements: []
      };

      const result = await recipeEngine.validateStockAvailability(request);

      expect(result.success).toBe(true);
      expect(result.allIngredientsAvailable).toBe(true);
      expect(result.availabilityDetails).toHaveLength(0);
    });
  });

  describe('reserveIngredients', () => {
    it('should successfully reserve all ingredients', async () => {
      // Mock stock validation
      mockInventoryService.checkInventoryAvailability.mockResolvedValue({
        available: true,
        availableQuantity: 10,
        currentQuantity: 15,
        reservedQuantity: 5,
        inTransitQuantity: 0
      });

      // Mock reservation
      mockInventoryService.reserveInventoryForTransfer.mockResolvedValue({
        reservationId: 'res1',
        reserved: true,
        expiresAt: new Date(),
        reservedQuantity: 5
      });

      const request = {
        orderId: 'order1',
        tenantId: 'tenant1',
        locationId: 'location1',
        ingredientRequirements: [
          {
            productId: 'prod1',
            totalQuantity: 5,
            unit: 'pieces',
            menuItemBreakdown: []
          }
        ]
      };

      const result = await recipeEngine.reserveIngredients(request);

      expect(result.success).toBe(true);
      expect(result.reservationIds).toEqual(['res1']);
      expect(mockInventoryService.reserveInventoryForTransfer).toHaveBeenCalledWith(
        'prod1',
        'location1',
        5,
        'order_order1',
        'system',
        'tenant1'
      );
    });

    it('should fail when ingredients are insufficient', async () => {
      // Mock insufficient stock
      mockInventoryService.checkInventoryAvailability.mockResolvedValue({
        available: false,
        availableQuantity: 2,
        currentQuantity: 5,
        reservedQuantity: 3,
        inTransitQuantity: 0
      });

      const request = {
        orderId: 'order1',
        tenantId: 'tenant1',
        locationId: 'location1',
        ingredientRequirements: [
          {
            productId: 'prod1',
            totalQuantity: 5,
            unit: 'pieces',
            menuItemBreakdown: []
          }
        ]
      };

      const result = await recipeEngine.reserveIngredients(request);

      expect(result.success).toBe(false);
      expect(result.insufficientIngredients).toHaveLength(1);
      expect(result.insufficientIngredients![0]).toEqual({
        productId: 'prod1',
        required: 5,
        available: 2,
        unit: 'pieces'
      });
      expect(result.errorCode).toBe(OrderErrorCode.INSUFFICIENT_INVENTORY);
    });

    it('should handle empty ingredient requirements', async () => {
      const request = {
        orderId: 'order1',
        tenantId: 'tenant1',
        locationId: 'location1',
        ingredientRequirements: []
      };

      const result = await recipeEngine.reserveIngredients(request);

      expect(result.success).toBe(true);
      expect(result.reservationIds).toEqual([]);
    });

    it('should rollback successful reservations if any fail', async () => {
      // Mock stock validation to pass
      mockInventoryService.checkInventoryAvailability.mockResolvedValue({
        available: true,
        availableQuantity: 10,
        currentQuantity: 15,
        reservedQuantity: 5,
        inTransitQuantity: 0
      });

      // Mock first reservation success, second failure
      mockInventoryService.reserveInventoryForTransfer
        .mockResolvedValueOnce({
          reservationId: 'res1',
          reserved: true,
          expiresAt: new Date(),
          reservedQuantity: 5
        })
        .mockResolvedValueOnce({
          reservationId: '',
          reserved: false,
          expiresAt: new Date(),
          reservedQuantity: 0
        });

      mockInventoryService.releaseInventoryReservation.mockResolvedValue(undefined);

      const request = {
        orderId: 'order1',
        tenantId: 'tenant1',
        locationId: 'location1',
        ingredientRequirements: [
          {
            productId: 'prod1',
            totalQuantity: 5,
            unit: 'pieces',
            menuItemBreakdown: []
          },
          {
            productId: 'prod2',
            totalQuantity: 3,
            unit: 'pieces',
            menuItemBreakdown: []
          }
        ]
      };

      const result = await recipeEngine.reserveIngredients(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(OrderErrorCode.INVENTORY_LOCK_FAILED);
      expect(mockInventoryService.releaseInventoryReservation).toHaveBeenCalledWith('res1');
    });
  });

  describe('consumeIngredients', () => {
    it('should create consumption records', async () => {
      // Mock order lookup
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ orderId: 'order1' }])
          })
        })
      });

      // Mock insert
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined)
      });

      const request = {
        orderId: 'order1',
        locationId: 'location1',
        consumptions: [
          {
            productId: 'prod1',
            quantity: 5,
            unit: 'pieces'
          }
        ]
      };

      const result = await recipeEngine.consumeIngredients(request);

      expect(result.success).toBe(true);
      expect(result.consumptions).toHaveLength(1);
      expect(result.consumptions![0]).toMatchObject({
        orderId: 'order1',
        productId: 'prod1',
        locationId: 'location1',
        quantityConsumed: 5,
        unit: 'pieces'
      });
    });

    it('should handle order not found', async () => {
      // Mock order lookup returning empty
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      const request = {
        orderId: 'order1',
        locationId: 'location1',
        consumptions: [
          {
            productId: 'prod1',
            quantity: 5,
            unit: 'pieces'
          }
        ]
      };

      const result = await recipeEngine.consumeIngredients(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');
      expect(result.errorCode).toBe(OrderErrorCode.ORDER_NOT_FOUND);
    });

    it('should handle empty consumptions', async () => {
      const request = {
        orderId: 'order1',
        locationId: 'location1',
        consumptions: []
      };

      const result = await recipeEngine.consumeIngredients(request);

      expect(result.success).toBe(true);
      expect(result.consumptions).toEqual([]);
    });
  });

  describe('checkMenuItemAvailability', () => {
    it('should check availability for menu items with ingredients', async () => {
      // Mock menu item ingredients lookup
      const mockMenuItemsWithRecipes = [
        {
          menuItem: { id: 'menu1', name: 'Burger', tenantId: 'tenant1' },
          recipe: { id: 'recipe1', menuItemId: 'menu1' },
          ingredient: { productId: 'prod1', quantity: 2, unit: 'pieces' }
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

      // Mock inventory availability
      mockInventoryService.checkInventoryAvailability.mockResolvedValue({
        available: true,
        availableQuantity: 10,
        currentQuantity: 15,
        reservedQuantity: 5,
        inTransitQuantity: 0
      });

      const result = await recipeEngine.checkMenuItemAvailability(
        ['menu1'],
        'tenant1',
        'location1'
      );

      expect(result.get('menu1')).toBe(true);
    });

    it('should mark items as available when no ingredients required', async () => {
      // Mock menu items without recipes
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  menuItem: { id: 'menu1', name: 'Burger', tenantId: 'tenant1' },
                  recipe: null,
                  ingredient: null
                }
              ])
            })
          })
        })
      });

      const result = await recipeEngine.checkMenuItemAvailability(
        ['menu1'],
        'tenant1',
        'location1'
      );

      expect(result.get('menu1')).toBe(true);
    });

    it('should mark items as unavailable when ingredients insufficient', async () => {
      // Mock menu item ingredients lookup
      const mockMenuItemsWithRecipes = [
        {
          menuItem: { id: 'menu1', name: 'Burger', tenantId: 'tenant1' },
          recipe: { id: 'recipe1', menuItemId: 'menu1' },
          ingredient: { productId: 'prod1', quantity: 2, unit: 'pieces' }
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
        reservedQuantity: 4,
        inTransitQuantity: 0
      });

      const result = await recipeEngine.checkMenuItemAvailability(
        ['menu1'],
        'tenant1',
        'location1'
      );

      expect(result.get('menu1')).toBe(false);
    });
  });

  describe('releaseIngredientReservations', () => {
    it('should release reservations for an order', async () => {
      mockInventoryService.releaseInventoryReservation.mockResolvedValue(undefined);

      const result = await recipeEngine.releaseIngredientReservations('order1');

      expect(result.success).toBe(true);
      expect(mockInventoryService.releaseInventoryReservation).toHaveBeenCalledWith('order_order1');
    });

    it('should handle release errors', async () => {
      mockInventoryService.releaseInventoryReservation.mockRejectedValue(
        new Error('Release failed')
      );

      const result = await recipeEngine.releaseIngredientReservations('order1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to release ingredient reservations');
    });
  });
});