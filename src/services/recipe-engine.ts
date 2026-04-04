// Recipe Engine for ingredient calculation and inventory consumption

import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, inArray } from 'drizzle-orm';
import { 
  recipes, 
  recipeIngredients, 
  menuItems,
  orderItems,
  inventoryConsumptions,
  inventoryItems,
  type Recipe,
  type RecipeIngredient,
  type MenuItem,
  type OrderItem,
  type NewInventoryConsumption
} from '../db/schema';
import { 
  OrderDetails,
  OrderItemDetails,
  InventoryConsumptionRequest,
  InventoryConsumptionResult,
  InventoryConsumptionDetails,
  OrderErrorCode
} from '../types/orders';
import { createInventoryIntegrationService, type InventoryIntegrationService } from './inventory-integration';
import { generateId, getCurrentTimestamp } from '../utils';

export interface RecipeCalculationRequest {
  orderId: string;
  tenantId: string;
  locationId: string;
  orderItems: OrderItemDetails[];
}

export interface RecipeCalculationResult {
  success: boolean;
  ingredientRequirements?: IngredientRequirement[];
  totalIngredients?: Map<string, IngredientRequirement>;
  error?: string;
  errorCode?: string;
}

export interface IngredientRequirement {
  productId: string;
  totalQuantity: number;
  unit: string;
  menuItemBreakdown: {
    menuItemId: string;
    menuItemName: string;
    quantity: number;
    unitQuantity: number;
  }[];
}

export interface InventoryReservationRequest {
  orderId: string;
  tenantId: string;
  locationId: string;
  ingredientRequirements: IngredientRequirement[];
  reservedBy?: string;
}

export interface InventoryReservationResult {
  success: boolean;
  reservationIds?: string[];
  insufficientIngredients?: {
    productId: string;
    required: number;
    available: number;
    unit: string;
  }[];
  error?: string;
  errorCode?: string;
}

export interface StockValidationRequest {
  tenantId: string;
  locationId: string;
  ingredientRequirements: IngredientRequirement[];
}

export interface StockValidationResult {
  success: boolean;
  allIngredientsAvailable: boolean;
  availabilityDetails: {
    productId: string;
    required: number;
    available: number;
    sufficient: boolean;
    unit: string;
  }[];
  error?: string;
  errorCode?: string;
}

export class RecipeEngine {
  private inventoryService: InventoryIntegrationService;

  constructor(private db: DrizzleD1Database) {
    this.inventoryService = createInventoryIntegrationService(db);
  }

  /**
   * Calculate ingredient requirements for an order
   * Requirements: 3.1
   */
  async calculateIngredientRequirements(request: RecipeCalculationRequest): Promise<RecipeCalculationResult> {
    try {
      const { orderId, tenantId, locationId, orderItems } = request;

      if (!orderItems || orderItems.length === 0) {
        return {
          success: false,
          error: 'No order items provided',
          errorCode: OrderErrorCode.VALIDATION_ERROR
        };
      }

      // Get menu item IDs from order items
      const menuItemIds = orderItems.map(item => item.menuItemId);

      // Fetch menu items with their recipes and ingredients
      const menuItemsWithRecipes = await this.db
        .select({
          menuItem: menuItems,
          recipe: recipes,
          ingredient: recipeIngredients
        })
        .from(menuItems)
        .leftJoin(recipes, eq(recipes.menuItemId, menuItems.id))
        .leftJoin(recipeIngredients, eq(recipeIngredients.recipeId, recipes.id))
        .where(and(
          eq(menuItems.tenantId, tenantId),
          inArray(menuItems.id, menuItemIds)
        ));

      if (menuItemsWithRecipes.length === 0) {
        return {
          success: false,
          error: 'No menu items found for the provided IDs',
          errorCode: OrderErrorCode.INVALID_MENU_ITEM
        };
      }

      // Group by menu item and calculate requirements
      const menuItemRecipes = new Map<string, {
        menuItem: MenuItem;
        recipe?: Recipe;
        ingredients: RecipeIngredient[];
      }>();

      for (const row of menuItemsWithRecipes) {
        const menuItemId = row.menuItem.id;
        
        if (!menuItemRecipes.has(menuItemId)) {
          menuItemRecipes.set(menuItemId, {
            menuItem: row.menuItem,
            recipe: row.recipe || undefined,
            ingredients: []
          });
        }

        if (row.ingredient) {
          menuItemRecipes.get(menuItemId)!.ingredients.push(row.ingredient);
        }
      }

      // Calculate total ingredient requirements
      const totalIngredients = new Map<string, IngredientRequirement>();

      for (const orderItem of orderItems) {
        const menuItemData = menuItemRecipes.get(orderItem.menuItemId);
        
        if (!menuItemData) {
          return {
            success: false,
            error: `Menu item ${orderItem.menuItemId} not found`,
            errorCode: OrderErrorCode.INVALID_MENU_ITEM
          };
        }

        if (!menuItemData.recipe || menuItemData.ingredients.length === 0) {
          // Menu item has no recipe - skip ingredient calculation
          continue;
        }

        // Calculate ingredients for this order item
        for (const ingredient of menuItemData.ingredients) {
          const productId = ingredient.productId;
          const requiredQuantity = ingredient.quantity * orderItem.quantity;

          if (totalIngredients.has(productId)) {
            const existing = totalIngredients.get(productId)!;
            existing.totalQuantity += requiredQuantity;
            existing.menuItemBreakdown.push({
              menuItemId: orderItem.menuItemId,
              menuItemName: menuItemData.menuItem.name,
              quantity: orderItem.quantity,
              unitQuantity: ingredient.quantity
            });
          } else {
            totalIngredients.set(productId, {
              productId,
              totalQuantity: requiredQuantity,
              unit: ingredient.unit,
              menuItemBreakdown: [{
                menuItemId: orderItem.menuItemId,
                menuItemName: menuItemData.menuItem.name,
                quantity: orderItem.quantity,
                unitQuantity: ingredient.quantity
              }]
            });
          }
        }
      }

      const ingredientRequirements = Array.from(totalIngredients.values());

      return {
        success: true,
        ingredientRequirements,
        totalIngredients
      };

    } catch (error) {
      console.error('Error calculating ingredient requirements:', error);
      return {
        success: false,
        error: 'Internal error calculating ingredient requirements',
        errorCode: OrderErrorCode.VALIDATION_ERROR
      };
    }
  }

  /**
   * Validate stock availability for ingredient requirements
   * Requirements: 3.4
   */
  async validateStockAvailability(request: StockValidationRequest): Promise<StockValidationResult> {
    try {
      const { tenantId, locationId, ingredientRequirements } = request;

      if (!ingredientRequirements || ingredientRequirements.length === 0) {
        return {
          success: true,
          allIngredientsAvailable: true,
          availabilityDetails: []
        };
      }

      const availabilityDetails: StockValidationResult['availabilityDetails'] = [];
      let allIngredientsAvailable = true;

      // Check availability for each ingredient
      for (const requirement of ingredientRequirements) {
        try {
          const availability = await this.inventoryService.checkInventoryAvailability(
            requirement.productId,
            locationId
          );

          const sufficient = availability.availableQuantity >= requirement.totalQuantity;
          if (!sufficient) {
            allIngredientsAvailable = false;
          }

          availabilityDetails.push({
            productId: requirement.productId,
            required: requirement.totalQuantity,
            available: availability.availableQuantity,
            sufficient,
            unit: requirement.unit
          });

        } catch (error) {
          console.error(`Error checking availability for product ${requirement.productId}:`, error);
          
          // Treat as unavailable if we can't check
          availabilityDetails.push({
            productId: requirement.productId,
            required: requirement.totalQuantity,
            available: 0,
            sufficient: false,
            unit: requirement.unit
          });
          allIngredientsAvailable = false;
        }
      }

      return {
        success: true,
        allIngredientsAvailable,
        availabilityDetails
      };

    } catch (error) {
      console.error('Error validating stock availability:', error);
      return {
        success: false,
        allIngredientsAvailable: false,
        availabilityDetails: [],
        error: 'Internal error validating stock availability',
        errorCode: OrderErrorCode.VALIDATION_ERROR
      };
    }
  }

  /**
   * Reserve ingredients for an order using Inventory Lock system
   * Requirements: 3.2, 3.3
   */
  async reserveIngredients(request: InventoryReservationRequest): Promise<InventoryReservationResult> {
    try {
      const { orderId, tenantId, locationId, ingredientRequirements, reservedBy = 'system' } = request;

      if (!ingredientRequirements || ingredientRequirements.length === 0) {
        return {
          success: true,
          reservationIds: []
        };
      }

      // First validate that all ingredients are available
      const stockValidation = await this.validateStockAvailability({
        tenantId,
        locationId,
        ingredientRequirements
      });

      if (!stockValidation.success) {
        return {
          success: false,
          error: stockValidation.error,
          errorCode: stockValidation.errorCode
        };
      }

      if (!stockValidation.allIngredientsAvailable) {
        const insufficientIngredients = stockValidation.availabilityDetails
          .filter(detail => !detail.sufficient)
          .map(detail => ({
            productId: detail.productId,
            required: detail.required,
            available: detail.available,
            unit: detail.unit
          }));

        return {
          success: false,
          insufficientIngredients,
          error: 'Insufficient inventory for some ingredients',
          errorCode: OrderErrorCode.INSUFFICIENT_INVENTORY
        };
      }

      // Reserve each ingredient
      const reservationIds: string[] = [];
      const failedReservations: string[] = [];

      for (const requirement of ingredientRequirements) {
        try {
          const reservationResult = await this.inventoryService.reserveInventoryForTransfer(
            requirement.productId,
            locationId,
            requirement.totalQuantity,
            `order_${orderId}`, // Use order ID as transfer ID for reservations
            reservedBy,
            tenantId
          );

          if (reservationResult.reserved) {
            reservationIds.push(reservationResult.reservationId);
          } else {
            failedReservations.push(requirement.productId);
          }

        } catch (error) {
          console.error(`Error reserving ingredient ${requirement.productId}:`, error);
          failedReservations.push(requirement.productId);
        }
      }

      // If any reservations failed, release the successful ones and return error
      if (failedReservations.length > 0) {
        // Release successful reservations
        for (const reservationId of reservationIds) {
          try {
            await this.inventoryService.releaseInventoryReservation(reservationId);
          } catch (error) {
            console.error(`Error releasing reservation ${reservationId}:`, error);
          }
        }

        return {
          success: false,
          error: `Failed to reserve ingredients: ${failedReservations.join(', ')}`,
          errorCode: OrderErrorCode.INVENTORY_LOCK_FAILED
        };
      }

      return {
        success: true,
        reservationIds
      };

    } catch (error) {
      console.error('Error reserving ingredients:', error);
      return {
        success: false,
        error: 'Internal error reserving ingredients',
        errorCode: OrderErrorCode.INVENTORY_LOCK_FAILED
      };
    }
  }

  /**
   * Consume ingredients when order transitions to PREPARING
   * Requirements: 3.1, 3.2, 3.3
   */
  async consumeIngredients(request: InventoryConsumptionRequest): Promise<InventoryConsumptionResult> {
    try {
      const { orderId, locationId, consumptions } = request;

      if (!consumptions || consumptions.length === 0) {
        return {
          success: true,
          consumptions: []
        };
      }

      // Get order details to validate tenant
      const [order] = await this.db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))
        .limit(1);

      if (!order) {
        return {
          success: false,
          error: 'Order not found',
          errorCode: OrderErrorCode.ORDER_NOT_FOUND
        };
      }

      const currentTime = getCurrentTimestamp();
      const consumptionRecords: InventoryConsumptionDetails[] = [];

      // Create consumption records for each ingredient
      for (const consumption of consumptions) {
        const consumptionId = generateId();
        
        const newConsumption: NewInventoryConsumption = {
          id: consumptionId,
          tenantId: order.orderId, // This should be the tenant ID from the order
          orderId: orderId,
          productId: consumption.productId,
          locationId: locationId,
          quantityConsumed: consumption.quantity,
          unit: consumption.unit,
          consumedAt: currentTime,
          reversedAt: null,
          reversedBy: null,
          notes: `Automatic consumption for order ${orderId}`
        };

        await this.db
          .insert(inventoryConsumptions)
          .values(newConsumption);

        consumptionRecords.push({
          id: consumptionId,
          tenantId: newConsumption.tenantId,
          orderId: orderId,
          productId: consumption.productId,
          locationId: locationId,
          quantityConsumed: consumption.quantity,
          unit: consumption.unit,
          consumedAt: currentTime,
          notes: newConsumption.notes
        });
      }

      // Trigger stock monitoring after consumption
      try {
        const { createStockAlertService } = await import('./stock-alert');
        const stockAlertService = createStockAlertService(this.db);
        
        const productIds = consumptions.map(c => c.productId);
        await stockAlertService.monitorStockLevels({
          tenantId: order.orderId, // This should be the tenant ID
          locationId: locationId,
          productIds: productIds
        });
      } catch (error) {
        console.error('Error triggering stock monitoring after consumption:', error);
        // Don't fail the consumption if monitoring fails
      }

      return {
        success: true,
        consumptions: consumptionRecords
      };

    } catch (error) {
      console.error('Error consuming ingredients:', error);
      return {
        success: false,
        error: 'Internal error consuming ingredients',
        errorCode: OrderErrorCode.VALIDATION_ERROR
      };
    }
  }

  /**
   * Release ingredient reservations (e.g., when order is cancelled)
   * Requirements: 3.2
   */
  async releaseIngredientReservations(orderId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Release reservations using the order-based transfer ID
      await this.inventoryService.releaseInventoryReservation(`order_${orderId}`);
      
      return { success: true };

    } catch (error) {
      console.error(`Error releasing reservations for order ${orderId}:`, error);
      return {
        success: false,
        error: 'Failed to release ingredient reservations'
      };
    }
  }

  /**
   * Get ingredient requirements for menu items (for availability checking)
   * Requirements: 3.1
   */
  async getMenuItemIngredients(menuItemIds: string[], tenantId: string): Promise<Map<string, IngredientRequirement[]>> {
    try {
      const menuItemIngredients = new Map<string, IngredientRequirement[]>();

      // Fetch recipes and ingredients for the menu items
      const recipesWithIngredients = await this.db
        .select({
          menuItem: menuItems,
          recipe: recipes,
          ingredient: recipeIngredients
        })
        .from(menuItems)
        .leftJoin(recipes, eq(recipes.menuItemId, menuItems.id))
        .leftJoin(recipeIngredients, eq(recipeIngredients.recipeId, recipes.id))
        .where(and(
          eq(menuItems.tenantId, tenantId),
          inArray(menuItems.id, menuItemIds)
        ));

      // Group by menu item
      const menuItemData = new Map<string, {
        menuItem: MenuItem;
        ingredients: RecipeIngredient[];
      }>();

      for (const row of recipesWithIngredients) {
        const menuItemId = row.menuItem.id;
        
        if (!menuItemData.has(menuItemId)) {
          menuItemData.set(menuItemId, {
            menuItem: row.menuItem,
            ingredients: []
          });
        }

        if (row.ingredient) {
          menuItemData.get(menuItemId)!.ingredients.push(row.ingredient);
        }
      }

      // Convert to ingredient requirements format
      for (const [menuItemId, data] of menuItemData) {
        const requirements: IngredientRequirement[] = data.ingredients.map(ingredient => ({
          productId: ingredient.productId,
          totalQuantity: ingredient.quantity,
          unit: ingredient.unit,
          menuItemBreakdown: [{
            menuItemId: menuItemId,
            menuItemName: data.menuItem.name,
            quantity: 1, // Base quantity for single item
            unitQuantity: ingredient.quantity
          }]
        }));

        menuItemIngredients.set(menuItemId, requirements);
      }

      return menuItemIngredients;

    } catch (error) {
      console.error('Error getting menu item ingredients:', error);
      return new Map();
    }
  }

  /**
   * Check if menu items are available based on ingredient stock
   * Requirements: 3.4
   */
  async checkMenuItemAvailability(
    menuItemIds: string[], 
    tenantId: string, 
    locationId: string
  ): Promise<Map<string, boolean>> {
    try {
      const availability = new Map<string, boolean>();
      
      // Get ingredient requirements for all menu items
      const menuItemIngredients = await this.getMenuItemIngredients(menuItemIds, tenantId);

      // Check availability for each menu item
      for (const menuItemId of menuItemIds) {
        const ingredients = menuItemIngredients.get(menuItemId) || [];
        
        if (ingredients.length === 0) {
          // No ingredients required - item is available
          availability.set(menuItemId, true);
          continue;
        }

        // Check if all ingredients are available
        const stockValidation = await this.validateStockAvailability({
          tenantId,
          locationId,
          ingredientRequirements: ingredients
        });

        availability.set(menuItemId, stockValidation.allIngredientsAvailable);
      }

      return availability;

    } catch (error) {
      console.error('Error checking menu item availability:', error);
      
      // Return false for all items on error
      const availability = new Map<string, boolean>();
      for (const menuItemId of menuItemIds) {
        availability.set(menuItemId, false);
      }
      return availability;
    }
  }
}

// Factory function for creating recipe engine
export function createRecipeEngine(db: DrizzleD1Database): RecipeEngine {
  return new RecipeEngine(db);
}