/**
 * WebSocket Service
 * Real-time communication for menu availability and order updates
 * Part of Digital Menu, Kitchen Orchestration & Payment System
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Message queuing during disconnections
 * - Persistent message storage using localStorage
 * - Connection state management
 * - Graceful degradation for offline scenarios
 * 
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5
 */

type MessageHandler = (data: any) => void;
type ConnectionHandler = () => void;

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
  tenantId?: string;
}

export interface QueuedMessage {
  message: WebSocketMessage;
  queuedAt: number;
  retryCount: number;
}

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed'
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private disconnectionHandlers: Set<ConnectionHandler> = new Set();
  private stateChangeHandlers: Set<(state: ConnectionState) => void> = new Set();
  private isIntentionalClose = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageQueue: QueuedMessage[] = [];
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private tenantId: string | null = null;
  private userId: string | null = null;
  private interfaceType: string | null = null;
  private readonly STORAGE_KEY = 'websocket_message_queue';
  private readonly MAX_QUEUE_SIZE = 100;
  private readonly MAX_RETRY_COUNT = 3;

  constructor(url?: string) {
    this.url = url || this.getWebSocketUrl();
    this.loadQueueFromStorage();
  }

  private getWebSocketUrl(): string {
    if (typeof window === 'undefined') return '';
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_WS_URL || window.location.host;
    return `${protocol}//${host}/ws`;
  }

  /**
   * Set connection parameters
   */
  setConnectionParams(tenantId: string, userId: string | null, interfaceType: string): void {
    this.tenantId = tenantId;
    this.userId = userId;
    this.interfaceType = interfaceType;
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Subscribe to connection state changes
   */
  onStateChange(handler: (state: ConnectionState) => void): () => void {
    this.stateChangeHandlers.add(handler);
    return () => this.stateChangeHandlers.delete(handler);
  }

  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.stateChangeHandlers.forEach(handler => {
        try {
          handler(state);
        } catch (error) {
          console.error('Error in state change handler:', error);
        }
      });
    }
  }

  /**
   * Connect to WebSocket server
   * Validates: Requirement 13.4 - Connection state management
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    if (!this.tenantId || !this.interfaceType) {
      console.error('Connection parameters not set. Call setConnectionParams first.');
      return;
    }

    this.setConnectionState(
      this.reconnectAttempts > 0 ? ConnectionState.RECONNECTING : ConnectionState.CONNECTING
    );

    try {
      const params = new URLSearchParams({
        tenantId: this.tenantId,
        interface: this.interfaceType
      });

      if (this.userId) {
        params.append('userId', this.userId);
      }

      const wsUrl = `${this.url}?${params.toString()}`;
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.setConnectionState(ConnectionState.FAILED);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isIntentionalClose = true;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setConnectionState(ConnectionState.DISCONNECTED);
  }

  /**
   * Send message to server
   * Validates: Requirement 13.5 - Queue updates during disconnections
   */
  send(type: string, data: any): void {
    const message: WebSocketMessage = {
      type,
      data,
      timestamp: Date.now(),
      tenantId: this.tenantId || undefined
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending message:', error);
        this.queueMessage(message);
      }
    } else {
      console.warn('WebSocket not connected, queueing message:', type);
      this.queueMessage(message);
    }
  }

  /**
   * Queue message for later delivery
   * Validates: Requirement 13.5 - Queue updates during disconnections
   */
  private queueMessage(message: WebSocketMessage): void {
    const queuedMessage: QueuedMessage = {
      message,
      queuedAt: Date.now(),
      retryCount: 0
    };

    this.messageQueue.push(queuedMessage);

    // Limit queue size
    if (this.messageQueue.length > this.MAX_QUEUE_SIZE) {
      this.messageQueue.shift();
    }

    this.saveQueueToStorage();
  }

  /**
   * Process queued messages after reconnection
   * Validates: Requirement 13.5 - Queue updates during disconnections
   */
  private async processMessageQueue(): Promise<void> {
    if (this.messageQueue.length === 0 || !this.isConnected()) {
      return;
    }

    const messagesToProcess = [...this.messageQueue];
    this.messageQueue = [];

    for (const queuedMessage of messagesToProcess) {
      if (queuedMessage.retryCount >= this.MAX_RETRY_COUNT) {
        console.warn('Message exceeded retry count, dropping:', queuedMessage.message.type);
        continue;
      }

      try {
        this.ws!.send(JSON.stringify(queuedMessage.message));
      } catch (error) {
        console.error('Error sending queued message:', error);
        queuedMessage.retryCount++;
        this.messageQueue.push(queuedMessage);
      }
    }

    this.saveQueueToStorage();
  }

  /**
   * Save message queue to localStorage for persistence
   */
  private saveQueueToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.messageQueue));
    } catch (error) {
      console.error('Error saving queue to storage:', error);
    }
  }

  /**
   * Load message queue from localStorage
   */
  private loadQueueFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.messageQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading queue from storage:', error);
      this.messageQueue = [];
    }
  }

  /**
   * Clear message queue
   */
  clearQueue(): void {
    this.messageQueue = [];
    this.saveQueueToStorage();
  }

  /**
   * Subscribe to specific message type
   */
  on(type: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(type);
        }
      }
    };
  }

  /**
   * Subscribe to connection events
   */
  onConnect(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  /**
   * Subscribe to disconnection events
   */
  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectionHandlers.add(handler);
    return () => this.disconnectionHandlers.delete(handler);
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.setConnectionState(ConnectionState.CONNECTED);
      this.startHeartbeat();
      
      // Process queued messages
      this.processMessageQueue();
      
      // Notify connection handlers
      this.connectionHandlers.forEach(handler => {
        try {
          handler();
        } catch (error) {
          console.error('Error in connection handler:', error);
        }
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.setConnectionState(ConnectionState.FAILED);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.stopHeartbeat();
      
      if (!this.isIntentionalClose) {
        this.setConnectionState(ConnectionState.RECONNECTING);
      } else {
        this.setConnectionState(ConnectionState.DISCONNECTED);
      }
      
      // Notify disconnection handlers
      this.disconnectionHandlers.forEach(handler => {
        try {
          handler();
        } catch (error) {
          console.error('Error in disconnection handler:', error);
        }
      });

      if (!this.isIntentionalClose) {
        this.scheduleReconnect();
      }
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message.data);
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      });
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   * Validates: Requirement 15.3 - Automatic reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.setConnectionState(ConnectionState.FAILED);
      return;
    }

    this.reconnectAttempts++;
    
    // Exponential backoff: delay = baseDelay * 2^(attempts - 1)
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.isIntentionalClose) {
        this.connect();
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send('ping', {});
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

// Singleton instance
let wsInstance: WebSocketService | null = null;

export function getWebSocketService(): WebSocketService {
  if (!wsInstance) {
    wsInstance = new WebSocketService();
  }
  return wsInstance;
}
