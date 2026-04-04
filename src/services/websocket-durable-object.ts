/**
 * WebSocket Durable Object
 * Manages WebSocket connections for real-time communication
 * Part of Digital Menu, Kitchen Orchestration & Payment System
 * 
 * Validates: Requirements 13.1, 13.3, 13.4, 13.5
 */

import { DurableObject } from 'cloudflare:workers';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
  tenantId: string;
}

export interface ConnectionMetadata {
  tenantId: string;
  userId?: string;
  interface: 'qr-menu' | 'waiter-panel' | 'kitchen-display' | 'cashier-panel';
  connectedAt: number;
}

export class WebSocketDurableObject extends DurableObject {
  private connections: Map<WebSocket, ConnectionMetadata> = new Map();
  private messageQueue: Map<string, WebSocketMessage[]> = new Map();

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }

    // Handle broadcast requests
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      return this.handleBroadcast(request);
    }

    // Handle connection info requests
    if (url.pathname === '/connections' && request.method === 'GET') {
      return this.handleConnectionInfo(request);
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get('tenantId');
    const userId = url.searchParams.get('userId');
    const interfaceType = url.searchParams.get('interface') as ConnectionMetadata['interface'];

    if (!tenantId || !interfaceType) {
      return new Response('Missing required parameters', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection
    this.ctx.acceptWebSocket(server);

    // Store connection metadata
    const metadata: ConnectionMetadata = {
      tenantId,
      userId,
      interface: interfaceType,
      connectedAt: Date.now()
    };

    this.connections.set(server, metadata);

    // Send queued messages for this tenant
    await this.sendQueuedMessages(server, tenantId);

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const metadata = this.connections.get(ws);
      if (!metadata) {
        return;
      }

      const data = typeof message === 'string' ? JSON.parse(message) : message;
      
      // Handle ping/pong for heartbeat
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        return;
      }

      // Handle other message types as needed
      console.log('Received message:', data);
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    this.connections.delete(ws);
    console.log(`WebSocket closed: ${code} ${reason}`);
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('WebSocket error:', error);
    this.connections.delete(ws);
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    try {
      const message: WebSocketMessage = await request.json();

      // Queue message for offline clients
      this.queueMessage(message);

      // Broadcast to connected clients
      const broadcastCount = this.broadcastMessage(message);

      return new Response(JSON.stringify({
        success: true,
        broadcastCount,
        queued: true
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error broadcasting message:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to broadcast message'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleConnectionInfo(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get('tenantId');

    const connections = Array.from(this.connections.entries())
      .filter(([_, metadata]) => !tenantId || metadata.tenantId === tenantId)
      .map(([_, metadata]) => metadata);

    return new Response(JSON.stringify({
      success: true,
      connections,
      total: connections.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private broadcastMessage(message: WebSocketMessage): number {
    let count = 0;

    for (const [ws, metadata] of this.connections.entries()) {
      // Only broadcast to same tenant
      if (metadata.tenantId === message.tenantId) {
        try {
          ws.send(JSON.stringify(message));
          count++;
        } catch (error) {
          console.error('Error sending message to client:', error);
          this.connections.delete(ws);
        }
      }
    }

    return count;
  }

  private queueMessage(message: WebSocketMessage): void {
    const key = message.tenantId;
    
    if (!this.messageQueue.has(key)) {
      this.messageQueue.set(key, []);
    }

    const queue = this.messageQueue.get(key)!;
    queue.push(message);

    // Keep only last 100 messages per tenant
    if (queue.length > 100) {
      queue.shift();
    }
  }

  private async sendQueuedMessages(ws: WebSocket, tenantId: string): Promise<void> {
    const queue = this.messageQueue.get(tenantId);
    
    if (!queue || queue.length === 0) {
      return;
    }

    for (const message of queue) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending queued message:', error);
        break;
      }
    }

    // Clear queue after sending
    this.messageQueue.delete(tenantId);
  }
}
