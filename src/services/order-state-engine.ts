// Order State Management Engine

import { eq, and } from 'drizzle-orm';
import { 
  orders, 
  orderStateTransitions, 
  orderItems,
  OrderState, 
  type Order, 
  type NewOrderStateTransition 
} from '../db/schema';
import { 
  StateTransitionRequest, 
  StateTransitionResult, 
  StateTransitionLog,
  OrderErrorCode,
  VALID_STATE_TRANSITIONS,
  isValidStateTransition,
  isTerminalState,
  OrderItemDetails
} from '../types/orders';
import { createRecipeEngine, type RecipeEngine } from './recipe-engine';

export class OrderStateEngine {
  private recipeEngine: RecipeEngine;

  constructor(private db: any) {
    this.recipeEngine = createRecipeEngine(db);
  }

  /**
   * Transition an order from one state to another with validation and audit logging
   */
  async transitionState(request: StateTransitionRequest): Promise<StateTransitionResult> {
    const { orderId, fromState, toState, transitionedBy, reason } = request;
    let { metadata } = request;

    try {
      // Start transaction
      return await this.db.transaction(async (tx: any) => {
        // Get current order with optimistic locking
        const currentOrder = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);

        if (!currentOrder || currentOrder.length === 0) {
          return {
            success: false,
            error: 'Order not found',
            errorCode: OrderErrorCode.ORDER_NOT_FOUND
          };
        }

        const order = currentOrder[0] as Order;
        const currentState = order.state as OrderState;

        // Check if order is already in terminal state first
        if (isTerminalState(currentState)) {
          return {
            success: false,
            error: `Cannot transition from terminal state ${currentState}`,
            errorCode: OrderErrorCode.INVALID_STATE_TRANSITION
          };
        }

        // Validate fromState if provided (concurrent modification check)
        if (fromState && currentState !== fromState) {
          return {
            success: false,
            error: `Order state mismatch. Expected ${fromState}, got ${currentState}`,
            errorCode: OrderErrorCode.CONCURRENT_MODIFICATION
          };
        }

        // Validate state transition
        if (!isValidStateTransition(currentState, toState)) {
          return {
            success: false,
            error: `Invalid state transition from ${currentState} to ${toState}`,
            errorCode: OrderErrorCode.INVALID_STATE_TRANSITION
          };
        }

        // Handle ingredient reservation for PREPARING state transition
        if (toState === OrderState.PREPARING) {
          // Get order items for ingredient calculation
          const orderItemsData = await tx
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, orderId));

          if (orderItemsData.length > 0) {
            const orderItemDetails: OrderItemDetails[] = orderItemsData.map(item => ({
              id: item.id,
              orderId: item.orderId,
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              specialInstructions: item.specialInstructions || undefined,
              status: item.status as any,
              createdAt: item.createdAt
            }));

            // Calculate ingredient requirements
            const ingredientCalculation = await this.recipeEngine.calculateIngredientRequirements({
              orderId,
              tenantId: order.tenantId,
              locationId: order.locationId,
              orderItems: orderItemDetails
            });

            if (!ingredientCalculation.success) {
              return {
                success: false,
                error: `Failed to calculate ingredients: ${ingredientCalculation.error}`,
                errorCode: ingredientCalculation.errorCode || OrderErrorCode.VALIDATION_ERROR
              };
            }

            // Reserve ingredients if any are required
            if (ingredientCalculation.ingredientRequirements && ingredientCalculation.ingredientRequirements.length > 0) {
              const reservationResult = await this.recipeEngine.reserveIngredients({
                orderId,
                tenantId: order.tenantId,
                locationId: order.locationId,
                ingredientRequirements: ingredientCalculation.ingredientRequirements,
                reservedBy: transitionedBy || 'system'
              });

              if (!reservationResult.success) {
                return {
                  success: false,
                  error: `Failed to reserve ingredients: ${reservationResult.error}`,
                  errorCode: reservationResult.errorCode || OrderErrorCode.INVENTORY_LOCK_FAILED
                };
              }

              // Store reservation IDs in metadata for potential cleanup
              if (!metadata) {
                metadata = {};
              }
              metadata.reservationIds = reservationResult.reservationIds;
            }
          }
        }

        const now = Date.now();

        // Update order state with optimistic locking
        const updateResult = await tx
          .update(orders)
          .set({
            state: toState,
            version: order.version + 1,
            updatedAt: now,
            ...(toState === OrderState.READY && { actualReadyTime: now })
          })
          .where(and(
            eq(orders.id, orderId),
            eq(orders.version, order.version)
          ));

        // Check if update was successful (optimistic locking)
        if (updateResult.changes === 0) {
          return {
            success: false,
            error: 'Order was modified by another process. Please retry.',
            errorCode: OrderErrorCode.CONCURRENT_MODIFICATION
          };
        }

        // Log state transition
        const transitionLog: NewOrderStateTransition = {
          id: crypto.randomUUID(),
          tenantId: order.tenantId,
          orderId: orderId,
          fromState: currentState,
          toState: toState,
          transitionedBy: transitionedBy,
          transitionedAt: now,
          reason: reason,
          metadata: metadata ? JSON.stringify(metadata) : undefined
        };

        await tx.insert(orderStateTransitions).values(transitionLog);

        return {
          success: true,
          newState: toState,
          metadata: {
            previousState: currentState,
            version: order.version + 1,
            transitionedAt: now
          }
        };
      });
    } catch (error) {
      console.error('Error transitioning order state:', error);
      return {
        success: false,
        error: 'Internal server error during state transition',
        errorCode: OrderErrorCode.VALIDATION_ERROR
      };
    }
  }

  /**
   * Get valid next states for an order
   */
  getValidNextStates(currentState: OrderState): OrderState[] {
    return VALID_STATE_TRANSITIONS[currentState] || [];
  }

  /**
   * Check if a state transition is valid
   */
  isValidTransition(fromState: OrderState, toState: OrderState): boolean {
    return isValidStateTransition(fromState, toState);
  }

  /**
   * Get order state transition history
   */
  async getStateTransitionHistory(orderId: string): Promise<StateTransitionLog[]> {
    try {
      const transitions = await this.db
        .select()
        .from(orderStateTransitions)
        .where(eq(orderStateTransitions.orderId, orderId))
        .orderBy(orderStateTransitions.transitionedAt);

      return transitions.map(t => ({
        id: t.id,
        tenantId: t.tenantId,
        orderId: t.orderId,
        fromState: t.fromState as OrderState | undefined,
        toState: t.toState as OrderState,
        transitionedBy: t.transitionedBy,
        transitionedAt: t.transitionedAt,
        reason: t.reason,
        metadata: t.metadata ? JSON.parse(t.metadata) : undefined,
        ipAddress: t.ipAddress,
        userAgent: t.userAgent
      }));
    } catch (error) {
      console.error('Error getting state transition history:', error);
      return [];
    }
  }

  /**
   * Validate order state consistency
   */
  async validateOrderState(orderId: string): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    try {
      const order = await this.db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!order || order.length === 0) {
        return {
          isValid: false,
          issues: ['Order not found']
        };
      }

      const orderData = order[0] as Order;
      const issues: string[] = [];

      // Get transition history
      const transitions = await this.getStateTransitionHistory(orderId);
      
      if (transitions.length === 0) {
        issues.push('No state transition history found');
      } else {
        // Validate transition sequence
        let expectedState: OrderState | null = null; // Start with null for initial transition
        
        for (const transition of transitions) {
          // First transition should have null fromState and go to PLACED
          if (expectedState === null) {
            if (transition.fromState !== null && transition.fromState !== undefined) {
              issues.push(`First transition should have null fromState, got ${transition.fromState}`);
            }
            if (transition.toState !== OrderState.PLACED) {
              issues.push(`First transition should go to PLACED, got ${transition.toState}`);
            }
            expectedState = transition.toState;
            continue;
          }
          
          if (transition.fromState && transition.fromState !== expectedState) {
            issues.push(`Invalid transition sequence: expected from state ${expectedState}, got ${transition.fromState}`);
          }
          
          if (!isValidStateTransition(transition.fromState || OrderState.PLACED, transition.toState as OrderState)) {
            issues.push(`Invalid transition from ${transition.fromState} to ${transition.toState}`);
          }
          
          expectedState = transition.toState;
        }

        // Check if current state matches last transition
        if (expectedState !== orderData.state) {
          issues.push(`Current state ${orderData.state} doesn't match last transition state ${expectedState}`);
        }
      }

      return {
        isValid: issues.length === 0,
        issues
      };
    } catch (error) {
      console.error('Error validating order state:', error);
      return {
        isValid: false,
        issues: ['Error during validation']
      };
    }
  }

  /**
   * Batch transition multiple orders (useful for kitchen operations)
   */
  async batchTransitionStates(requests: StateTransitionRequest[]): Promise<StateTransitionResult[]> {
    const results: StateTransitionResult[] = [];

    for (const request of requests) {
      const result = await this.transitionState(request);
      results.push(result);
    }

    return results;
  }

  /**
   * Get orders by state for a tenant/location
   */
  async getOrdersByState(
    tenantId: string, 
    state: OrderState, 
    locationId?: string
  ): Promise<Order[]> {
    try {
      let query = this.db
        .select()
        .from(orders)
        .where(and(
          eq(orders.tenantId, tenantId),
          eq(orders.state, state)
        ));

      if (locationId) {
        query = query.where(and(
          eq(orders.tenantId, tenantId),
          eq(orders.state, state),
          eq(orders.locationId, locationId)
        ));
      }

      return await query.orderBy(orders.createdAt);
    } catch (error) {
      console.error('Error getting orders by state:', error);
      return [];
    }
  }

  /**
   * Get order state statistics for a tenant
   */
  async getOrderStateStatistics(
    tenantId: string, 
    locationId?: string,
    dateFrom?: number,
    dateTo?: number
  ): Promise<Record<OrderState, number>> {
    try {
      let query = this.db
        .select({
          state: orders.state,
          count: 'COUNT(*)'
        })
        .from(orders)
        .where(eq(orders.tenantId, tenantId));

      if (locationId) {
        query = query.where(and(
          eq(orders.tenantId, tenantId),
          eq(orders.locationId, locationId)
        ));
      }

      if (dateFrom) {
        query = query.where(and(
          eq(orders.tenantId, tenantId),
          ...(locationId ? [eq(orders.locationId, locationId)] : []),
          // Add date filter when available
        ));
      }

      const results = await query.groupBy(orders.state);

      // Initialize all states with 0
      const statistics: Record<OrderState, number> = {
        [OrderState.PLACED]: 0,
        [OrderState.PREPARING]: 0,
        [OrderState.READY]: 0,
        [OrderState.DELIVERED]: 0,
        [OrderState.CANCELLED]: 0
      };

      // Fill in actual counts
      for (const result of results) {
        statistics[result.state as OrderState] = parseInt(result.count as string);
      }

      return statistics;
    } catch (error) {
      console.error('Error getting order state statistics:', error);
      return {
        [OrderState.PLACED]: 0,
        [OrderState.PREPARING]: 0,
        [OrderState.READY]: 0,
        [OrderState.DELIVERED]: 0,
        [OrderState.CANCELLED]: 0
      };
    }
  }
}