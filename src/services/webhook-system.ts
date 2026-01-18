import { z } from 'zod';

/**
 * Webhook System Service
 * Requirements: 9.6
 */

export interface WebhookEndpoint {
  id: string;
  tenantId: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  headers?: Record<string, string>;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEvent {
  id: string;
  tenantId: string;
  eventType: string;
  data: any;
  timestamp: Date;
  source: string;
  version: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  url: string;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  httpStatus?: number;
  response?: string;
  error?: string;
  attempts: number;
  nextRetry?: Date;
  createdAt: Date;
  completedAt?: Date;
}

export interface WebhookPayload {
  id: string;
  event: string;
  timestamp: string;
  data: any;
  signature?: string;
}

/**
 * Webhook validation schemas
 */
export const webhookEndpointSchema = z.object({
  url: z.string().url('Invalid webhook URL'),
  events: z.array(z.string()).min(1, 'At least one event type is required'),
  secret: z.string().optional(),
  active: z.boolean().default(true),
  headers: z.record(z.string()).optional(),
  timeout: z.number().int().min(1000).max(30000).default(10000),
  retryAttempts: z.number().int().min(0).max(10).default(3),
  retryDelay: z.number().int().min(1000).max(300000).default(5000),
});

export const webhookEventSchema = z.object({
  eventType: z.string().min(1),
  data: z.any(),
  source: z.string().default('api'),
  version: z.string().default('1.0'),
});

/**
 * Webhook System Service
 */
export class WebhookSystemService {
  private endpoints = new Map<string, WebhookEndpoint>();
  private deliveries = new Map<string, WebhookDelivery>();
  private eventQueue: WebhookEvent[] = [];
  private processing = false;

  constructor() {
    // Start processing queue
    this.startQueueProcessor();
  }

  /**
   * Register a webhook endpoint
   */
  async registerWebhook(
    tenantId: string,
    endpoint: Omit<WebhookEndpoint, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
  ): Promise<WebhookEndpoint> {
    try {
      // Validate endpoint
      const validatedEndpoint = webhookEndpointSchema.parse(endpoint);

      const webhookEndpoint: WebhookEndpoint = {
        id: crypto.randomUUID(),
        tenantId,
        ...validatedEndpoint,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Test webhook endpoint
      const testResult = await this.testWebhookEndpoint(webhookEndpoint);
      if (!testResult.success) {
        throw new Error(`Webhook endpoint test failed: ${testResult.error}`);
      }

      this.endpoints.set(webhookEndpoint.id, webhookEndpoint);
      
      console.log(`Registered webhook endpoint: ${webhookEndpoint.url} for tenant ${tenantId}`);
      
      return webhookEndpoint;
    } catch (error) {
      console.error('Error registering webhook:', error);
      throw error;
    }
  }

  /**
   * Update webhook endpoint
   */
  async updateWebhook(
    webhookId: string,
    tenantId: string,
    updates: Partial<Omit<WebhookEndpoint, 'id' | 'tenantId' | 'createdAt'>>
  ): Promise<WebhookEndpoint | null> {
    const endpoint = this.endpoints.get(webhookId);
    
    if (!endpoint || endpoint.tenantId !== tenantId) {
      return null;
    }

    // Validate updates
    if (updates.url || updates.events || updates.timeout || updates.retryAttempts || updates.retryDelay) {
      const validatedUpdates = webhookEndpointSchema.partial().parse(updates);
      Object.assign(endpoint, validatedUpdates);
    } else {
      Object.assign(endpoint, updates);
    }

    endpoint.updatedAt = new Date();
    
    // Test updated endpoint if URL changed
    if (updates.url) {
      const testResult = await this.testWebhookEndpoint(endpoint);
      if (!testResult.success) {
        throw new Error(`Updated webhook endpoint test failed: ${testResult.error}`);
      }
    }

    this.endpoints.set(webhookId, endpoint);
    
    return endpoint;
  }

  /**
   * Delete webhook endpoint
   */
  deleteWebhook(webhookId: string, tenantId: string): boolean {
    const endpoint = this.endpoints.get(webhookId);
    
    if (!endpoint || endpoint.tenantId !== tenantId) {
      return false;
    }

    this.endpoints.delete(webhookId);
    
    console.log(`Deleted webhook endpoint: ${endpoint.url} for tenant ${tenantId}`);
    
    return true;
  }

  /**
   * Get webhook endpoints for a tenant
   */
  getWebhooks(tenantId: string): WebhookEndpoint[] {
    return Array.from(this.endpoints.values())
      .filter(endpoint => endpoint.tenantId === tenantId);
  }

  /**
   * Get webhook endpoint by ID
   */
  getWebhook(webhookId: string, tenantId: string): WebhookEndpoint | null {
    const endpoint = this.endpoints.get(webhookId);
    
    if (!endpoint || endpoint.tenantId !== tenantId) {
      return null;
    }

    return endpoint;
  }

  /**
   * Trigger webhook event
   */
  async triggerEvent(
    tenantId: string,
    eventType: string,
    data: any,
    source = 'api'
  ): Promise<void> {
    try {
      // Validate event
      const validatedEvent = webhookEventSchema.parse({
        eventType,
        data,
        source,
      });

      const event: WebhookEvent = {
        id: crypto.randomUUID(),
        tenantId,
        eventType: validatedEvent.eventType,
        data: validatedEvent.data,
        timestamp: new Date(),
        source: validatedEvent.source,
        version: validatedEvent.version,
      };

      // Add to queue
      this.eventQueue.push(event);
      
      console.log(`Queued webhook event: ${eventType} for tenant ${tenantId}`);
    } catch (error) {
      console.error('Error triggering webhook event:', error);
      throw error;
    }
  }

  /**
   * Get webhook deliveries
   */
  getDeliveries(
    tenantId: string,
    webhookId?: string,
    limit = 50
  ): WebhookDelivery[] {
    return Array.from(this.deliveries.values())
      .filter(delivery => {
        const endpoint = this.endpoints.get(delivery.webhookId);
        if (!endpoint || endpoint.tenantId !== tenantId) return false;
        if (webhookId && delivery.webhookId !== webhookId) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get webhook statistics
   */
  getWebhookStats(tenantId: string, webhookId?: string): {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    pendingDeliveries: number;
    averageResponseTime: number;
    successRate: number;
  } {
    const deliveries = this.getDeliveries(tenantId, webhookId, 1000);
    
    const successful = deliveries.filter(d => d.status === 'success');
    const failed = deliveries.filter(d => d.status === 'failed');
    const pending = deliveries.filter(d => d.status === 'pending' || d.status === 'retrying');
    
    const completedDeliveries = deliveries.filter(d => d.completedAt);
    const totalResponseTime = completedDeliveries.reduce((sum, d) => {
      return sum + (d.completedAt!.getTime() - d.createdAt.getTime());
    }, 0);
    
    const averageResponseTime = completedDeliveries.length > 0 
      ? totalResponseTime / completedDeliveries.length 
      : 0;
    
    const successRate = deliveries.length > 0 
      ? successful.length / deliveries.length 
      : 0;

    return {
      totalDeliveries: deliveries.length,
      successfulDeliveries: successful.length,
      failedDeliveries: failed.length,
      pendingDeliveries: pending.length,
      averageResponseTime,
      successRate,
    };
  }

  /**
   * Test webhook endpoint
   */
  async testWebhookEndpoint(endpoint: WebhookEndpoint): Promise<{
    success: boolean;
    error?: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();
    
    try {
      const testPayload: WebhookPayload = {
        id: crypto.randomUUID(),
        event: 'webhook.test',
        timestamp: new Date().toISOString(),
        data: { test: true },
      };

      // Add signature if secret is provided
      if (endpoint.secret) {
        testPayload.signature = this.generateSignature(testPayload, endpoint.secret);
      }

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GastronomOS-Webhooks/1.0',
          ...endpoint.headers,
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(endpoint.timeout),
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return { success: true, responseTime };
      } else {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          responseTime,
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime,
      };
    }
  }

  /**
   * Start processing webhook event queue
   */
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (this.processing || this.eventQueue.length === 0) {
        return;
      }

      this.processing = true;

      try {
        const event = this.eventQueue.shift();
        if (event) {
          await this.processEvent(event);
        }
      } catch (error) {
        console.error('Error processing webhook event:', error);
      } finally {
        this.processing = false;
      }
    }, 1000); // Process every second
  }

  /**
   * Process a webhook event
   */
  private async processEvent(event: WebhookEvent): Promise<void> {
    // Find matching webhook endpoints
    const matchingEndpoints = Array.from(this.endpoints.values())
      .filter(endpoint => 
        endpoint.tenantId === event.tenantId &&
        endpoint.active &&
        endpoint.events.includes(event.eventType)
      );

    if (matchingEndpoints.length === 0) {
      console.log(`No webhook endpoints found for event ${event.eventType} in tenant ${event.tenantId}`);
      return;
    }

    // Create deliveries for each matching endpoint
    const deliveryPromises = matchingEndpoints.map(endpoint => 
      this.createDelivery(endpoint, event)
    );

    await Promise.all(deliveryPromises);
  }

  /**
   * Create and execute webhook delivery
   */
  private async createDelivery(endpoint: WebhookEndpoint, event: WebhookEvent): Promise<void> {
    const delivery: WebhookDelivery = {
      id: crypto.randomUUID(),
      webhookId: endpoint.id,
      eventId: event.id,
      url: endpoint.url,
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
    };

    this.deliveries.set(delivery.id, delivery);

    await this.executeDelivery(delivery, endpoint, event);
  }

  /**
   * Execute webhook delivery
   */
  private async executeDelivery(
    delivery: WebhookDelivery,
    endpoint: WebhookEndpoint,
    event: WebhookEvent
  ): Promise<void> {
    delivery.attempts++;
    delivery.status = 'pending';

    try {
      const payload: WebhookPayload = {
        id: event.id,
        event: event.eventType,
        timestamp: event.timestamp.toISOString(),
        data: event.data,
      };

      // Add signature if secret is provided
      if (endpoint.secret) {
        payload.signature = this.generateSignature(payload, endpoint.secret);
      }

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GastronomOS-Webhooks/1.0',
          'X-Webhook-ID': delivery.id,
          'X-Webhook-Event': event.eventType,
          'X-Webhook-Timestamp': event.timestamp.toISOString(),
          ...endpoint.headers,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(endpoint.timeout),
      });

      delivery.httpStatus = response.status;
      delivery.response = await response.text();
      delivery.completedAt = new Date();

      if (response.ok) {
        delivery.status = 'success';
        console.log(`Webhook delivery successful: ${endpoint.url} for event ${event.eventType}`);
      } else {
        delivery.status = 'failed';
        delivery.error = `HTTP ${response.status}: ${response.statusText}`;
        
        // Schedule retry if attempts remaining
        if (delivery.attempts < endpoint.retryAttempts) {
          await this.scheduleRetry(delivery, endpoint, event);
        } else {
          console.error(`Webhook delivery failed after ${delivery.attempts} attempts: ${endpoint.url}`);
        }
      }
    } catch (error) {
      delivery.status = 'failed';
      delivery.error = error instanceof Error ? error.message : 'Unknown error';
      delivery.completedAt = new Date();

      // Schedule retry if attempts remaining
      if (delivery.attempts < endpoint.retryAttempts) {
        await this.scheduleRetry(delivery, endpoint, event);
      } else {
        console.error(`Webhook delivery failed after ${delivery.attempts} attempts: ${endpoint.url}`, error);
      }
    }

    this.deliveries.set(delivery.id, delivery);
  }

  /**
   * Schedule webhook delivery retry
   */
  private async scheduleRetry(
    delivery: WebhookDelivery,
    endpoint: WebhookEndpoint,
    event: WebhookEvent
  ): Promise<void> {
    const retryDelay = endpoint.retryDelay * Math.pow(2, delivery.attempts - 1); // Exponential backoff
    delivery.nextRetry = new Date(Date.now() + retryDelay);
    delivery.status = 'retrying';

    console.log(`Scheduling webhook retry in ${retryDelay}ms for ${endpoint.url}`);

    setTimeout(async () => {
      await this.executeDelivery(delivery, endpoint, event);
    }, retryDelay);
  }

  /**
   * Generate webhook signature
   */
  private generateSignature(payload: WebhookPayload, secret: string): string {
    // In a real implementation, use HMAC-SHA256
    // For demo purposes, we'll create a simple hash
    const data = JSON.stringify(payload) + secret;
    let hash = 0;
    
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `sha256=${Math.abs(hash).toString(16)}`;
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(JSON.parse(payload), secret);
    return signature === expectedSignature;
  }
}

/**
 * Common webhook events
 */
export const WebhookEvents = {
  // User events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  
  // Product events
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_DELETED: 'product.deleted',
  
  // Order events
  ORDER_CREATED: 'order.created',
  ORDER_APPROVED: 'order.approved',
  ORDER_RECEIVED: 'order.received',
  ORDER_CANCELLED: 'order.cancelled',
  
  // Transfer events
  TRANSFER_CREATED: 'transfer.created',
  TRANSFER_APPROVED: 'transfer.approved',
  TRANSFER_SHIPPED: 'transfer.shipped',
  TRANSFER_RECEIVED: 'transfer.received',
  TRANSFER_CANCELLED: 'transfer.cancelled',
  
  // Allocation events
  ALLOCATION_CREATED: 'allocation.created',
  ALLOCATION_UPDATED: 'allocation.updated',
  ALLOCATION_CANCELLED: 'allocation.cancelled',
  
  // System events
  SYSTEM_MAINTENANCE: 'system.maintenance',
  SYSTEM_ALERT: 'system.alert',
  BACKUP_COMPLETED: 'backup.completed',
  BACKUP_FAILED: 'backup.failed',
} as const;

/**
 * Webhook utilities
 */
export const webhookUtils = {
  /**
   * Validate webhook URL
   */
  validateWebhookUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  },

  /**
   * Format webhook event name
   */
  formatEventName(eventType: string): string {
    return eventType
      .split('.')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  },

  /**
   * Get webhook status color
   */
  getStatusColor(status: WebhookDelivery['status']): string {
    const colors = {
      pending: '#f59e0b',
      success: '#22c55e',
      failed: '#ef4444',
      retrying: '#3b82f6',
    };
    return colors[status] || '#6b7280';
  },

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(attempt: number, baseDelay: number, maxDelay = 300000): number {
    const delay = baseDelay * Math.pow(2, attempt - 1);
    return Math.min(delay, maxDelay);
  },

  /**
   * Generate webhook test payload
   */
  generateTestPayload(eventType: string): WebhookPayload {
    return {
      id: crypto.randomUUID(),
      event: eventType,
      timestamp: new Date().toISOString(),
      data: {
        test: true,
        message: 'This is a test webhook payload',
        timestamp: new Date().toISOString(),
      },
    };
  },
};