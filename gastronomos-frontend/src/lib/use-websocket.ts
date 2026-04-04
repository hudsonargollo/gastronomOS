/**
 * React Hook for WebSocket
 * Provides easy WebSocket integration for React components
 * Part of Digital Menu, Kitchen Orchestration & Payment System
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { getWebSocketService, ConnectionState } from './websocket';

export interface UseWebSocketOptions {
  tenantId: string;
  userId?: string;
  interfaceType: 'qr-menu' | 'waiter-panel' | 'kitchen-display' | 'cashier-panel';
  autoConnect?: boolean;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  connectionState: ConnectionState;
  send: (type: string, data: any) => void;
  subscribe: (type: string, handler: (data: any) => void) => () => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { tenantId, userId, interfaceType, autoConnect = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const wsRef = useRef(getWebSocketService());
  const handlersRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    const ws = wsRef.current;

    // Set connection parameters
    ws.setConnectionParams(tenantId, userId || null, interfaceType);

    // Subscribe to connection state changes
    const unsubscribeState = ws.onStateChange((state) => {
      setConnectionState(state);
      setIsConnected(state === ConnectionState.CONNECTED);
    });

    // Auto-connect if enabled
    if (autoConnect) {
      ws.connect();
    }

    // Cleanup on unmount
    return () => {
      unsubscribeState();
      
      // Unsubscribe all message handlers
      handlersRef.current.forEach(unsubscribe => unsubscribe());
      handlersRef.current.clear();

      // Disconnect if this was the component that initiated the connection
      if (autoConnect) {
        ws.disconnect();
      }
    };
  }, [tenantId, userId, interfaceType, autoConnect]);

  const send = useCallback((type: string, data: any) => {
    wsRef.current.send(type, data);
  }, []);

  const subscribe = useCallback((type: string, handler: (data: any) => void) => {
    const unsubscribe = wsRef.current.on(type, handler);
    
    // Store unsubscribe function
    const key = `${type}-${Date.now()}`;
    handlersRef.current.set(key, unsubscribe);

    // Return cleanup function
    return () => {
      unsubscribe();
      handlersRef.current.delete(key);
    };
  }, []);

  const connect = useCallback(() => {
    wsRef.current.connect();
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current.disconnect();
  }, []);

  return {
    isConnected,
    connectionState,
    send,
    subscribe,
    connect,
    disconnect
  };
}

/**
 * Hook for subscribing to specific WebSocket message types
 */
export function useWebSocketSubscription(
  messageType: string,
  handler: (data: any) => void,
  dependencies: any[] = []
) {
  const ws = getWebSocketService();

  useEffect(() => {
    const unsubscribe = ws.on(messageType, handler);
    return unsubscribe;
  }, [messageType, ...dependencies]);
}
