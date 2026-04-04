/**
 * Order State WebSocket Integration
 * Integrates WebSocket broadcasting with order state transitions
 * Part of Digital Menu, Kitchen Orchestration & Payment System
 * 
 * Validates: Requirements 13.1, 13.3
 */

import { OrderStateEngine } from './order-state-engine';
import { WebSocketService } from './websocket-service';
import { StateTransitionRequest, StateTransitionResult } from '../types/orders';

export class OrderStateWebSocketIntegration {
  constructor(
    private orderStateEngine: OrderStateEngine,
    private webSocketService: WebSocketService
  ) {}

  /**
   * Transition order state and broadcast update to all interfaces
   * Validates: Requirement 13.1 - Broadcast order state changes
   */
  async transitionStateWithBroadcast(
    request: StateTransitionRequest,
    tenantId: string,
    orderData?: any
  ): Promise<StateTransitionResult> {
    // Execute state transition
    const result = await this.orderStateEngine.transitionState(request);

    // Broadcast update if successful
    if (result.success && result.newState) {
      await this.webSocketService.broadcastOrderStateChange(
        tenantId,
        request.orderId,
        result.newState,
        orderData || { orderId: request.orderId, state: result.newState }
      );
    }

    return result;
  }

  /**
   * Batch transition states and broadcast updates
   */
  async batchTransitionStatesWithBroadcast(
    requests: StateTransitionRequest[],
    tenantId: string
  ): Promise<StateTransitionResult[]> {
    // Execute batch transitions
    const results = await this.orderStateEngine.batchTransitionStates(requests);

    // Broadcast successful transitions
    const broadcastPromises = results
      .filter(result => result.success && result.newState)
      .map((result, index) => 
        this.webSocketService.broadcastOrderStateChange(
          tenantId,
          requests[index].orderId,
          result.newState!,
          { orderId: requests[index].orderId, state: result.newState }
        )
      );

    await Promise.allSettled(broadcastPromises);

    return results;
  }
}

/**
 * Factory function to create integrated order state service
 */
export function createOrderStateWebSocketIntegration(
  db: any,
  webSocketNamespace: DurableObjectNamespace
): OrderStateWebSocketIntegration {
  const orderStateEngine = new OrderStateEngine(db);
  const webSocketService = new WebSocketService(webSocketNamespace);
  
  return new OrderStateWebSocketIntegration(orderStateEngine, webSocketService);
}
