// Recipe Engine Integration Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecipeEngine } from './recipe-engine';
import { OrderStateEngine } from './order-state-engine';
import { OrderErrorCode } from '../types/orders';
import { OrderState } from '../db/schema';

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

describe('Recipe Engine Integration with Order State Engine', () => {
  let recipeEngine: RecipeEngine;
  let orderStateEngine: OrderStateEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    recipeEngine = new RecipeEngine(mockDb as any);
    orderStateEngine = new OrderStateEngine(mockDb as any);
  });

  describe('Order State Transition to PREPARING with Recipe Engine', () => {
    it('should successfully transition to PREPARING when ingredients are available', async () => {
      // Mock order lookup
      const mockOrder = {
        id: 'order1',
        tenantId: 'tenant1',
        locationId: 'location1',
        state: OrderState.PLACED,
        version: 1
      };

      // Mock order items lookup
      const mockOrderItems = [
        {
          id: 'item1',
          orderId: 'order1',
          menuItemId: 'menu1',
          quantity: 2,
          unitPrice: 1000,
          totalPrice: 2000,
          status: 'PENDING',
          createdAt: 1234567890
        }
      ];

      // Mock menu items with recipes
      const mockMenuItemsWithRecipes = [
        {
          menuItem: { id: 'menu1', name: 'Burger', tenantId: 'tenant1' },
          recipe: { id: 'recipe1', menuItemId: 'menu1' },
          ingredient: { productId: 'prod1', quantity: 2, unit: 'pieces' }
        }
      ];

      // Mock database transaction
      mockDb.transaction.mockImplementation(async (callback) => {
        // Mock order lookup in transaction
        const mockTxSelect = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockOrder])
            })
          })
        });

        // Mock order items lookup in transaction
        const mockOrderItemsSelect = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockOrderItems)
          })
        });

        // Mock update operation
        const mockUpdate = vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ changes: 1 })
          })
        });

        // Mock insert operation for state transition log
        const mockInsert = vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined)
        });

        const tx = {
          select: mockTxSelect.mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockOrder])
              })
            })
          }).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockOrderItems)
            })
          }),
          update: mockUpdate,
          insert: mockInsert
        };

        return await callback(tx);
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
        availableQuantity: 10,
        currentQuantity: 15,
        reservedQuantity: 5,
        inTransitQuantity: 0
      });

      // Mock ingredient reservation
      mockInventoryService.reserveInventoryForTransfer.mockResolvedValue({
        reservationId: 'res1',
        reserved: true,
        expiresAt: new Date(),
        reservedQuantity: 4
      });

      // Test the transition
      const result = await orderStateEngine.transitionState({
        orderId: 'order1',
        fromState: OrderState.PLACED,
        toState: OrderState.PREPARING,
        transitionedBy: 'user1',
        reason: 'Kitchen ready to prepare'
      });

      expect(result.success).toBe(true);
      expect(result.newState).toBe(OrderState.PREPARING);
      expect(mockInventoryService.reserveInventoryForTransfer).toHaveBeenCalledWith(
        'prod1',
        'location1',
        4, // 2 ingredients * 2 order quantity
        'order_order1',
        'user1',
        'tenant1'
      );
    });

    it('should fail transition to PREPARING when ingredients are insufficient', async () => {
      // Mock order lookup
      const mockOrder = {
        id: 'order1',
        tenantId: 'tenant1',
        locationId: 'location1',
        state: OrderState.PLACED,
        version: 1
      };

      // Mock order items lookup
      const mockOrderItems = [
        {
          id: 'item1',
          orderId: 'order1',
          menuItemId: 'menu1',
          quantity: 5, // Large quantity
          unitPrice: 1000,
          totalPrice: 5000,
          status: 'PENDING',
          createdAt: 1234567890
        }
      ];

      // Mock menu items with recipes
      const mockMenuItemsWithRecipes = [
        {
          menuItem: { id: 'menu1', name: 'Burger', tenantId: 'tenant1' },
          recipe: { id: 'recipe1', menuItemId: 'menu1' },
          ingredient: { productId: 'prod1', quantity: 2, unit: 'pieces' }
        }
      ];

      // Mock database transaction
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTxSelect = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockOrder])
            })
          })
        });

        const mockOrderItemsSelect = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockOrderItems)
          })
        });

        const tx = {
          select: mockTxSelect.mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockOrder])
              })
            })
          }).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockOrderItems)
            })
          })
        };

        return await callback(tx);
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
        availableQuantity: 5, // Less than required (10)
        currentQuantity: 8,
        reservedQuantity: 3,
        inTransitQuantity: 0
      });

      // Test the transition
      const result = await orderStateEngine.transitionState({
        orderId: 'order1',
        fromState: OrderState.PLACED,
        toState: OrderState.PREPARING,
        transitionedBy: 'user1',
        reason: 'Kitchen ready to prepare'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(OrderErrorCode.INSUFFICIENT_INVENTORY);
      expect(result.error).toContain('Failed to reserve ingredients');
    });

    it('should handle orders with no recipe requirements', async () => {
      // Mock order lookup
      const mockOrder = {
        id: 'order1',
        tenantId: 'tenant1',
        locationId: 'location1',
        state: OrderState.PLACED,
        version: 1
      };

      // Mock order items lookup
      const mockOrderItems = [
        {
          id: 'item1',
          orderId: 'order1',
          menuItemId: 'menu1',
          quantity: 1,
          unitPrice: 1000,
          totalPrice: 1000,
          status: 'PENDING',
          createdAt: 1234567890
        }
      ];

      // Mock menu items without recipes
      const mockMenuItemsWithoutRecipes = [
        {
          menuItem: { id: 'menu1', name: 'Drink', tenantId: 'tenant1' },
          recipe: null,
          ingredient: null
        }
      ];

      // Mock database transaction
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTxSelect = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockOrder])
            })
          })
        });

        const mockOrderItemsSelect = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockOrderItems)
          })
        });

        const mockUpdate = vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue({ changes: 1 })
          })
        });

        const mockInsert = vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined)
        });

        const tx = {
          select: mockTxSelect.mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockOrder])
              })
            })
          }).mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockOrderItems)
            })
          }),
          update: mockUpdate,
          insert: mockInsert
        };

        return await callback(tx);
      });

      // Mock recipe engine database calls
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockMenuItemsWithoutRecipes)
            })
          })
        })
      });

      // Test the transition
      const result = await orderStateEngine.transitionState({
        orderId: 'order1',
        fromState: OrderState.PLACED,
        toState: OrderState.PREPARING,
        transitionedBy: 'user1',
        reason: 'Kitchen ready to prepare'
      });

      expect(result.success).toBe(true);
      expect(result.newState).toBe(OrderState.PREPARING);
      // Should not call inventory service for items without recipes
      expect(mockInventoryService.reserveInventoryForTransfer).not.toHaveBeenCalled();
    });
  });

  describe('Recipe Engine Standalone Functionality', () => {
    it('should calculate ingredient requirements correctly', async () => {
      // Mock menu items with recipes
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

      const result = await recipeEngine.calculateIngredientRequirements({
        orderId: 'order1',
        tenantId: 'tenant1',
        locationId: 'location1',
        orderItems: [
          {
            id: 'item1',
            orderId: 'order1',
            menuItemId: 'menu1',
            quantity: 3,
            unitPrice: 1000,
            totalPrice: 3000,
            status: 'PENDING' as any,
            createdAt: 1234567890
          }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.ingredientRequirements).toHaveLength(2);
      
      const prod1Requirement = result.ingredientRequirements!.find(r => r.productId === 'prod1');
      expect(prod1Requirement?.totalQuantity).toBe(6); // 2 * 3
      
      const prod2Requirement = result.ingredientRequirements!.find(r => r.productId === 'prod2');
      expect(prod2Requirement?.totalQuantity).toBe(3); // 1 * 3
    });

    it('should validate stock availability correctly', async () => {
      mockInventoryService.checkInventoryAvailability
        .mockResolvedValueOnce({
          available: true,
          availableQuantity: 10,
          currentQuantity: 15,
          reservedQuantity: 5,
          inTransitQuantity: 0
        })
        .mockResolvedValueOnce({
          available: false,
          availableQuantity: 2,
          currentQuantity: 5,
          reservedQuantity: 3,
          inTransitQuantity: 0
        });

      const result = await recipeEngine.validateStockAvailability({
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
            totalQuantity: 5,
            unit: 'pieces',
            menuItemBreakdown: []
          }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.allIngredientsAvailable).toBe(false);
      expect(result.availabilityDetails).toHaveLength(2);
      expect(result.availabilityDetails[0].sufficient).toBe(true);
      expect(result.availabilityDetails[1].sufficient).toBe(false);
    });

    it('should check menu item availability based on ingredients', async () => {
      // Mock menu items with recipes
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

      // Mock sufficient inventory
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
  });
});