/**
 * Resilient WebSocket Service
 * Wraps WebSocketService with error handling and retry mechanisms
 * 
 * Implements:
 * - Automatic retry for failed broadcasts
 * - Message queuing for offline scenarios
 * - Comprehensive error logging
 * 
 * Validates: Requirements 13.4, 13.5, 15.3, 15.4
 */

import { WebSocketService, type BroadcastOptions } from './websocket-service';
import { SystemResilienceService } from './system-resilience';

export interface QueuedMessage {
  id: string;
  options: BroadcastOptions;
  timestamp: number;
  retryCount: number;
  lastAttempt?: number;
}

export interface ResilientBroadcastResult {
  success: boolean;
  broadcastCount?: number;
  error?: string;
  attemptsMade?: number;
  queued?: boolean;
}

export class ResilientWebSocketService {
  private resilienceService: SystemResilienceService;
  private messageQueue: Map<string, QueuedMessage> = new Map();
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly MAX_RETRY_COUNT = 3;
  private processingQueue: boolean = false;

  constructor(
    private websocketService: WebSocketService,
    resilienceService?: SystemResilienceService
  ) {
    this.resilienceService = resilienceService || new SystemResilienceService();
    
    // Start queue processor
    this.startQueueProcessor();
  }

  /**
   * Broadcast message with retry and queuing
   * Validates: Requirements 13.4, 13.5
   */
  async broadcast(options: BroadcastOptions): Promise<ResilientBroadcastResult> {
    const context = {
      service: 'websocket',
      operation: 'broadcast',
      tenantId: options.tenantId,
      metadata: {
        type: options.type,
        interfaces: options.interfaces
      }
    };

    const result = await this.resilienceService.executeWebSocketBroadcast(
      () => this.websocketService.broadcast(options),
      context
    );

    if (result.success && result.result) {
      return {
        success: true,
        broadcastCount: result.result.broadcastCount,
        attemptsMade: result.attemptsMade
      };
    }

    // Broadcast failed, queue message for retry
    const messageId = this.queueMessage(options);

    return {
      success: false,
      error: result.error,
      attemptsMade: result.attemptsMade,
      queued: messageId !== null
    };
  }

  /**
   * Broadcast order state change with resilience
   */
  async broadcastOrderStateChange(
    tenantId: string,
    orderId: string,
    newState: string,
    orderData: any
  ): Promise<ResilientBroadcastResult> {
    return this.broadcast({
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
   * Broadcast inventory update with resilience
   */
  async broadcastInventoryUpdate(
    tenantId: string,
    menuItemId: string,
    isAvailable: boolean,
    reason?: string
  ): Promise<ResilientBroadcastResult> {
    return this.broadcast({
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
   * Broadcast payment status update with resilience
   */
  async broadcastPaymentStatusUpdate(
    tenantId: string,
    orderId: string,
    paymentStatus: string,
    paymentData: any
  ): Promise<ResilientBroadcastResult> {
    return this.broadcast({
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
   * Broadcast new order with resilience
   */
  async broadcastNewOrder(
    tenantId: string,
    orderId: string,
    orderData: any
  ): Promise<ResilientBroadcastResult> {
    return this.broadcast({
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
   * Broadcast order ready with resilience
   */
  async broadcastOrderReady(
    tenantId: string,
    orderId: string,
    tableNumber?: string
  ): Promise<ResilientBroadcastResult> {
    return this.broadcast({
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
   * Queue message for later retry
   */
  private queueMessage(options: BroadcastOptions): string | null {
    // Check queue size limit
    if (this.messageQueue.size >= this.MAX_QUEUE_SIZE) {
      this.resilienceService.logError({
        context: {
          service: 'websocket',
          operation: 'queueMessage',
          tenantId: options.tenantId
        },
        error: 'Message queue full, dropping message',
        errorCode: 'QUEUE_FULL',
        severity: 'HIGH'
      });
      return null;
    }

    const messageId = this.generateMessageId();
    const queuedMessage: QueuedMessage = {
      id: messageId,
      options,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.messageQueue.set(messageId, queuedMessage);

    this.resilienceService.logError({
      context: {
        service: 'websocket',
        operation: 'queueMessage',
        tenantId: options.tenantId,
        metadata: {
          messageId,
          type: options.type
        }
      },
      error: 'Message queued for retry',
      errorCode: 'MESSAGE_QUEUED',
      severity: 'LOW',
      recoveryAction: 'Message will be retried automatically'
    });

    return messageId;
  }

  /**
   * Start queue processor for retrying failed messages
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue();
    }, 5000); // Process queue every 5 seconds
  }

  /**
   * Process queued messages
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.messageQueue.size === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      const now = Date.now();
      const messagesToRetry: QueuedMessage[] = [];

      // Find messages ready for retry (at least 5 seconds since last attempt)
      for (const message of this.messageQueue.values()) {
        if (!message.lastAttempt || now - message.lastAttempt >= 5000) {
          messagesToRetry.push(message);
        }
      }

      // Process messages
      for (const message of messagesToRetry) {
        await this.retryQueuedMessage(message);
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Retry a queued message
   */
  private async retryQueuedMessage(message: QueuedMessage): Promise<void> {
    message.lastAttempt = Date.now();
    message.retryCount++;

    try {
      const result = await this.websocketService.broadcast(message.options);

      if (result.success) {
        // Success, remove from queue
        this.messageQueue.delete(message.id);

        this.resilienceService.logError({
          context: {
            service: 'websocket',
            operation: 'retryQueuedMessage',
            tenantId: message.options.tenantId,
            metadata: {
              messageId: message.id,
              retryCount: message.retryCount
            }
          },
          error: 'Queued message successfully delivered',
          errorCode: 'QUEUE_SUCCESS',
          severity: 'LOW',
          recoveryAction: 'Message delivered after retry'
        });
      } else {
        // Still failing
        if (message.retryCount >= this.MAX_RETRY_COUNT) {
          // Max retries exceeded, remove from queue
          this.messageQueue.delete(message.id);

          this.resilienceService.logError({
            context: {
              service: 'websocket',
              operation: 'retryQueuedMessage',
              tenantId: message.options.tenantId,
              metadata: {
                messageId: message.id,
                retryCount: message.retryCount
              }
            },
            error: 'Max retries exceeded for queued message',
            errorCode: 'MAX_RETRIES_EXCEEDED',
            severity: 'HIGH',
            recoveryAction: 'Message dropped after max retries'
          });
        }
      }
    } catch (error) {
      // Error during retry, will try again next cycle
      this.resilienceService.logError({
        context: {
          service: 'websocket',
          operation: 'retryQueuedMessage',
          tenantId: message.options.tenantId,
          metadata: {
            messageId: message.id,
            retryCount: message.retryCount
          }
        },
        error: error instanceof Error ? error.message : 'Retry failed',
        errorCode: 'RETRY_ERROR',
        severity: 'MEDIUM',
        recoveryAction: 'Will retry in next cycle'
      });
    }
  }

  /**
   * Get queue statistics
   */
  getQueueStatistics(): {
    queueSize: number;
    oldestMessageAge: number;
    messagesByTenant: Record<string, number>;
  } {
    const now = Date.now();
    let oldestMessageAge = 0;
    const messagesByTenant: Record<string, number> = {};

    for (const message of this.messageQueue.values()) {
      const age = now - message.timestamp;
      if (age > oldestMessageAge) {
        oldestMessageAge = age;
      }

      const tenantId = message.options.tenantId;
      messagesByTenant[tenantId] = (messagesByTenant[tenantId] || 0) + 1;
    }

    return {
      queueSize: this.messageQueue.size,
      oldestMessageAge,
      messagesByTenant
    };
  }

  /**
   * Clear message queue
   */
  clearQueue(): void {
    this.messageQueue.clear();
  }

  /**
   * Get connection info with error handling
   */
  async getConnectionInfo(tenantId: string): Promise<any> {
    try {
      return await this.websocketService.getConnectionInfo(tenantId);
    } catch (error) {
      this.resilienceService.logError({
        context: {
          service: 'websocket',
          operation: 'getConnectionInfo',
          tenantId
        },
        error: error instanceof Error ? error.message : 'Failed to get connection info',
        severity: 'LOW'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get connection info'
      };
    }
  }

  /**
   * Get WebSocket URL
   */
  getWebSocketUrl(tenantId: string, userId: string | undefined, interfaceType: string): string {
    return this.websocketService.getWebSocketUrl(tenantId, userId, interfaceType);
  }

  /**
   * Generate message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Factory function to create ResilientWebSocketService
 */
export function createResilientWebSocketService(
  websocketService: WebSocketService,
  resilienceService?: SystemResilienceService
): ResilientWebSocketService {
  return new ResilientWebSocketService(websocketService, resilienceService);
}
