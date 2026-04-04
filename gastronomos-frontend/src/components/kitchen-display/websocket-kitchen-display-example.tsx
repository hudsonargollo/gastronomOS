/**
 * WebSocket Kitchen Display Example
 * Demonstrates real-time order updates using WebSocket
 * Part of Digital Menu, Kitchen Orchestration & Payment System
 */

'use client';

import { useState, useEffect } from 'react';
import { useWebSocket } from '@/lib/use-websocket';
import { WebSocketStatusIndicator } from '@/components/websocket-status-indicator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Order {
  id: string;
  orderNumber: string;
  state: string;
  tableNumber?: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
  }>;
  createdAt: string;
}

interface WebSocketKitchenDisplayProps {
  tenantId: string;
  userId: string;
  initialOrders: Order[];
}

export function WebSocketKitchenDisplay({
  tenantId,
  userId,
  initialOrders
}: WebSocketKitchenDisplayProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [notifications, setNotifications] = useState<string[]>([]);

  // Initialize WebSocket connection
  const { isConnected, connectionState, subscribe } = useWebSocket({
    tenantId,
    userId,
    interfaceType: 'kitchen-display',
    autoConnect: true
  });

  // Subscribe to order state changes
  useEffect(() => {
    const unsubscribeStateChange = subscribe('order:state-change', (data) => {
      console.log('Order state changed:', data);
      
      // Update order in list
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === data.orderId 
            ? { ...order, state: data.newState }
            : order
        )
      );

      // Show notification
      addNotification(`Order #${data.order?.orderNumber || data.orderId} is now ${data.newState}`);
    });

    return unsubscribeStateChange;
  }, [subscribe]);

  // Subscribe to new orders
  useEffect(() => {
    const unsubscribeNewOrder = subscribe('order:new', (data) => {
      console.log('New order received:', data);
      
      // Add new order to list
      setOrders(prevOrders => [data.order, ...prevOrders]);

      // Show notification
      addNotification(`New order #${data.order.orderNumber} received!`);
      
      // Play notification sound (optional)
      playNotificationSound();
    });

    return unsubscribeNewOrder;
  }, [subscribe]);

  // Subscribe to order ready notifications
  useEffect(() => {
    const unsubscribeOrderReady = subscribe('order:ready', (data) => {
      console.log('Order ready:', data);
      
      // Show notification
      addNotification(`Order #${data.orderId} is ready for pickup!`);
    });

    return unsubscribeOrderReady;
  }, [subscribe]);

  const addNotification = (message: string) => {
    setNotifications(prev => [message, ...prev].slice(0, 5));
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n !== message));
    }, 5000);
  };

  const playNotificationSound = () => {
    // Play a notification sound
    const audio = new Audio('/notification.mp3');
    audio.play().catch(err => console.log('Could not play sound:', err));
  };

  const handleStateTransition = async (orderId: string, newState: string) => {
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/transition`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ toState: newState })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('State transition failed:', error);
        addNotification(`Failed to update order: ${error.error}`);
      }
      // Note: The WebSocket will receive the state change and update the UI
    } catch (error) {
      console.error('Error transitioning state:', error);
      addNotification('Network error: Could not update order');
    }
  };

  const getOrdersByState = (state: string) => {
    return orders.filter(order => order.state === state);
  };

  return (
    <div className="space-y-6">
      {/* Header with WebSocket Status */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Kitchen Display</h1>
        <WebSocketStatusIndicator connectionState={connectionState} />
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((notification, index) => (
            <div
              key={index}
              className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg animate-in slide-in-from-top"
            >
              <p className="text-sm text-blue-900 dark:text-blue-100">
                {notification}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Connection Status Warning */}
      {!isConnected && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-900 dark:text-yellow-100">
            ⚠️ Real-time updates are currently unavailable. Orders will not update automatically.
          </p>
        </div>
      )}

      {/* Order Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* New Orders (PLACED) */}
        <OrderColumn
          title="New Orders"
          state="PLACED"
          orders={getOrdersByState('PLACED')}
          onStateTransition={handleStateTransition}
          nextState="PREPARING"
          nextStateLabel="Start Preparing"
        />

        {/* Preparing Orders */}
        <OrderColumn
          title="Preparing"
          state="PREPARING"
          orders={getOrdersByState('PREPARING')}
          onStateTransition={handleStateTransition}
          nextState="READY"
          nextStateLabel="Mark Ready"
        />

        {/* Ready Orders */}
        <OrderColumn
          title="Ready"
          state="READY"
          orders={getOrdersByState('READY')}
          onStateTransition={handleStateTransition}
          nextState="DELIVERED"
          nextStateLabel="Mark Delivered"
        />
      </div>
    </div>
  );
}

interface OrderColumnProps {
  title: string;
  state: string;
  orders: Order[];
  onStateTransition: (orderId: string, newState: string) => void;
  nextState: string;
  nextStateLabel: string;
}

function OrderColumn({
  title,
  state,
  orders,
  onStateTransition,
  nextState,
  nextStateLabel
}: OrderColumnProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <Badge variant="secondary">{orders.length}</Badge>
      </div>

      <div className="space-y-3">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No orders in {state.toLowerCase()} state
            </CardContent>
          </Card>
        ) : (
          orders.map(order => (
            <Card key={order.id} className="transition-all hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Order #{order.orderNumber}</span>
                  {order.tableNumber && (
                    <Badge variant="outline">Table {order.tableNumber}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Order Items */}
                <div className="space-y-2">
                  {order.items.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.name}</span>
                      <span className="font-semibold">x{item.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* Action Button */}
                <Button
                  onClick={() => onStateTransition(order.id, nextState)}
                  className="w-full"
                  variant={state === 'PREPARING' ? 'default' : 'secondary'}
                >
                  {nextStateLabel}
                </Button>

                {/* Order Time */}
                <p className="text-xs text-muted-foreground text-center">
                  {new Date(order.createdAt).toLocaleTimeString()}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
