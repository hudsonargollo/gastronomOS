// Recipe Engine Integration Demo

import { createRecipeEngine } from '../services/recipe-engine';
import { OrderStateEngine } from '../services/order-state-engine';
import { OrderState } from '../db/schema';

/**
 * Demo showing how the Recipe Engine integrates with Order State Management
 * 
 * This example demonstrates:
 * 1. Recipe Engine calculating ingredient requirements for orders
 * 2. Automatic ingredient reservation when orders transition to PREPARING
 * 3. Stock validation and availability checking
 * 4. Integration with existing Inventory Lock system
 */

// Example usage (pseudo-code for demonstration)
export async function demonstrateRecipeEngineIntegration(db: any) {
  
  // Initialize services
  const recipeEngine = createRecipeEngine(db);
  const orderStateEngine = new OrderStateEngine(db);

  console.log('=== Recipe Engine Integration Demo ===\n');

  // 1. Calculate ingredient requirements for an order
  console.log('1. Calculating ingredient requirements...');
  const ingredientCalculation = await recipeEngine.calculateIngredientRequirements({
    orderId: 'order-123',
    tenantId: 'restaurant-1',
    locationId: 'kitchen-1',
    orderItems: [
      {
        id: 'item-1',
        orderId: 'order-123',
        menuItemId: 'burger-deluxe',
        quantity: 2,
        unitPrice: 1500, // $15.00
        totalPrice: 3000, // $30.00
        status: 'PENDING' as any,
        createdAt: Date.now()
      },
      {
        id: 'item-2',
        orderId: 'order-123',
        menuItemId: 'fries-large',
        quantity: 1,
        unitPrice: 500, // $5.00
        totalPrice: 500, // $5.00
        status: 'PENDING' as any,
        createdAt: Date.now()
      }
    ]
  });

  if (ingredientCalculation.success) {
    console.log('✓ Ingredient requirements calculated:');
    ingredientCalculation.ingredientRequirements?.forEach(req => {
      console.log(`  - ${req.productId}: ${req.totalQuantity} ${req.unit}`);
      req.menuItemBreakdown.forEach(breakdown => {
        console.log(`    └─ ${breakdown.menuItemName} (${breakdown.quantity}x): ${breakdown.unitQuantity} ${req.unit}`);
      });
    });
  } else {
    console.log('✗ Failed to calculate ingredients:', ingredientCalculation.error);
  }

  console.log('\n2. Validating stock availability...');
  if (ingredientCalculation.success && ingredientCalculation.ingredientRequirements) {
    const stockValidation = await recipeEngine.validateStockAvailability({
      tenantId: 'restaurant-1',
      locationId: 'kitchen-1',
      ingredientRequirements: ingredientCalculation.ingredientRequirements
    });

    if (stockValidation.success) {
      console.log(`✓ Stock validation complete. All ingredients available: ${stockValidation.allIngredientsAvailable}`);
      stockValidation.availabilityDetails.forEach(detail => {
        const status = detail.sufficient ? '✓' : '✗';
        console.log(`  ${status} ${detail.productId}: ${detail.available}/${detail.required} ${detail.unit}`);
      });
    } else {
      console.log('✗ Stock validation failed:', stockValidation.error);
    }
  }

  console.log('\n3. Transitioning order to PREPARING (with automatic ingredient reservation)...');
  
  // This will automatically:
  // - Calculate ingredient requirements
  // - Validate stock availability  
  // - Reserve ingredients using Inventory Lock system
  // - Update order state if successful
  const stateTransition = await orderStateEngine.transitionState({
    orderId: 'order-123',
    fromState: OrderState.PLACED,
    toState: OrderState.PREPARING,
    transitionedBy: 'chef-john',
    reason: 'Kitchen ready to start preparation'
  });

  if (stateTransition.success) {
    console.log('✓ Order successfully transitioned to PREPARING');
    console.log('✓ Ingredients automatically reserved');
    if (stateTransition.metadata?.reservationIds) {
      console.log('  Reservation IDs:', stateTransition.metadata.reservationIds);
    }
  } else {
    console.log('✗ Order transition failed:', stateTransition.error);
    console.log('  Error code:', stateTransition.errorCode);
  }

  console.log('\n4. Checking menu item availability based on current stock...');
  const menuAvailability = await recipeEngine.checkMenuItemAvailability(
    ['burger-deluxe', 'fries-large', 'salad-caesar'],
    'restaurant-1',
    'kitchen-1'
  );

  console.log('Menu item availability:');
  for (const [menuItemId, available] of menuAvailability) {
    const status = available ? '✓ Available' : '✗ Out of stock';
    console.log(`  ${menuItemId}: ${status}`);
  }

  console.log('\n=== Integration Benefits ===');
  console.log('✓ Automatic ingredient calculation from recipes');
  console.log('✓ Real-time stock validation before order preparation');
  console.log('✓ Seamless integration with existing Inventory Lock system');
  console.log('✓ Prevents order preparation when ingredients are insufficient');
  console.log('✓ Maintains accurate inventory levels through automatic consumption');
  console.log('✓ Supports menu availability based on ingredient stock levels');
}

/**
 * Key Integration Points:
 * 
 * 1. Order State Engine Integration:
 *    - When orders transition to PREPARING, Recipe Engine automatically calculates
 *      ingredient requirements and reserves them using the Inventory Lock system
 * 
 * 2. Inventory Lock System Integration:
 *    - Recipe Engine uses existing reserveInventoryForTransfer() method
 *    - Reservations are tied to order IDs for easy tracking and cleanup
 *    - Supports rollback if any ingredient reservation fails
 * 
 * 3. Menu Availability Integration:
 *    - Recipe Engine can check if menu items are available based on ingredient stock
 *    - Supports real-time menu updates based on inventory levels
 * 
 * 4. Requirements Fulfilled:
 *    - ✓ 3.1: Recipe Engine calculates ingredient requirements for orders
 *    - ✓ 3.2: Integrates with existing Inventory Lock system  
 *    - ✓ 3.3: Automatic ingredient reservation on PREPARING transition
 *    - ✓ 3.4: Stock validation and availability checking
 */