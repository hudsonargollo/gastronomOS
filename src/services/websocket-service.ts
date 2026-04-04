/**
 * WebSocket Service
 * Service layer for WebSocket communication
 * Part of Digital Menu, Kitchen Orchestration & Payment System
 * 
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5
 */

import { WebSocketMessage } from './websocket-durable-object';

export interface BroadcastOptions {
  tenantId: string;
  type: string;
  data: any;
  interfaces?: Array<'qr-menu' | 'waiter-panel' | 'kitchen-display' | 'cashier-panel'>;
}

export class WebSocketService {
  private durableObjectNamespace: DurableObjectNamespace;

  constructor(durableObjectNamespace: DurableObjectNamespace) {
    this.durableObjectNamespace = durableObjectNamespace;
  }

  /**
   * Broadcast message to all connected clients for a tenant
   */
  async broadcast(options: BroadcastOptions): Promise<{ success: boolean; broadcastCount?: number; error?: string }> {
    try {
      const message: WebSocketMessage = {
        type: options.type,
        data: options.data,
        timestamp: Date.now(),
        tenantId: options.tenantId
      };

      // Get Durable Object instance for this tenant
      const id = this.durableObjectNamespace.idFromName(options.tenantId);
      const stub = this.durableObjectNamespace.get(id);

      // Send broadcast request to Durable Object
      const response = await stub.fetch('https://websocket/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });

      const result = await response.json() as any;
      return result;
    } catch (error) {
      console.error('Error broadcasting message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Broadcast order state change to all interfaces
   * Validates: Requirement 13.1
   */
  async broadcastOrderStateChange(tenantId: string, orderId: string, newState: string, orderData: any): Promise<void> {
    await this.broadcast({
      tenantId,
      type: 'order:state-change',
      data: {
        orderId,
        newState,
        order: orderData,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Broadcast inventory availability update to QR Menu instances
   * Validates: Requirement 13.2
   */
  async broadcastInventoryUpdate(tenantId: string, menuItemId: string, isAvailable: boolean, reason?: string): Promise<void> {
    await this.broadcast({
      tenantId,
      type: 'inventory:availability-change',
      data: {
        menuItemId,
        isAvailable,
        reason,
        timestamp: Date.now()
      },
      interfaces: ['qr-menu']
    });
  }

  /**
   * Broadcast payment status update
   * Validates: Requirement 13.3
   */
  async broadcastPaymentStatusUpdate(tenantId: string, orderId: string, paymentStatus: string, paymentData: any): Promise<void> {
    await this.broadcast({
      tenantId,
      type: 'payment:status-change',
      data: {
        orderId,
        paymentStatus,
        payment: paymentData,
        timestamp: Date.now()
      },
      interfaces: ['waiter-panel', 'kitchen-display', 'cashier-panel']
    });
  }

  /**
   * Broadcast new order notification to kitchen
   */
  async broadcastNewOrder(tenantId: string, orderId: string, orderData: any): Promise<void> {
    await this.broadcast({
      tenantId,
      type: 'order:new',
      data: {
        orderId,
        order: orderData,
        timestamp: Date.now()
      },
      interfaces: ['kitchen-display', 'waiter-panel']
    });
  }

  /**
   * Broadcast order ready notification
   */
  async broadcastOrderReady(tenantId: string, orderId: string, tableNumber?: string): Promise<void> {
    await this.broadcast({
      tenantId,
      type: 'order:ready',
      data: {
        orderId,
        tableNumber,
        timestamp: Date.now()
      },
      interfaces: ['waiter-panel', 'cashier-panel']
    });
  }

  /**
   * Get connection information for a tenant
   */
  async getConnectionInfo(tenantId: string): Promise<any> {
    try {
      const id = this.durableObjectNamespace.idFromName(tenantId);
      const stub = this.durableObjectNamespace.get(id);

      const response = await stub.fetch(`https://websocket/connections?tenantId=${tenantId}`);
      return await response.json();
    } catch (error) {
      console.error('Error getting connection info:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get WebSocket upgrade URL for client connections
   */
  getWebSocketUrl(tenantId: string, userId: string | undefined, interfaceType: string): string {
    const params = new URLSearchParams({
      tenantId,
      interface: interfaceType
    });

    if (userId) {
      params.append('userId', userId);
    }

    return `/ws?${params.toString()}`;
  }
}
