/**
 * Kitchen Dashboard Component
 * Main kitchen display interface with order queue and workflow tracking
 * Requirements: 1.4, 11.1, 11.2, 11.5
 */

'use client';

import { useState, useEffect } from 'react';
import { OrderQueue } from './order-queue';
import { RecipeDisplay } from './recipe-display';
import { TimerManager } from './timer-manager';
import { getWebSocketService } from '@/lib/websocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SketchWireIcon } from '@/components/design-system/sketch-wire-icon';

export interface KitchenOrder {
  id: string;
  orderNumber: string;
  state: 'PLACED' | 'PREPARING' | 'READY';
  tableNumber?: string;
  items: KitchenOrderItem[];
  specialInstructions?: string;
  estimatedReadyTime?: number;
  createdAt: number;
  priority: number;
}

export interface KitchenOrderItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  specialInstructions?: string;
  status: 'PENDING' | 'PREPARING' | 'READY';
  recipe?: {
    ingredients: Array<{
      name: string;
      quantity: number;
      unit: string;
    }>;
    instructions: string;
    preparationTime: number;
  };
}

export function KitchenDashboard() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<KitchenOrder | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Fetch initial orders
    fetchOrders();

    // Setup WebSocket for real-time updates
    const ws = getWebSocketService();
    ws.connect();

    const unsubscribeConnect = ws.onConnect(() => {
      setIsConnected(true);
      console.log('Kitchen Display connected to WebSocket');
    });

    const unsubscribeDisconnect = ws.onDisconnect(() => {
      setIsConnected(false);
      console.log('Kitchen Display disconnected from WebSocket');
    });

    const unsubscribeOrderUpdate = ws.on('order:update', (data) => {
      handleOrderUpdate(data);
    });

    const unsubscribeNewOrder = ws.on('order:new', (data) => {
      handleNewOrder(data);
    });

    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeOrderUpdate();
      unsubscribeNewOrder();
    };
  }, []);

  const fetchOrders = async () => {
    try {
      // Fetch orders in PLACED, PREPARING, or READY states
      const response = await fetch('/api/v1/orders?states=PLACED,PREPARING,READY');
      if (response.ok) {
        const data = await response.json();
        setOrders(sortOrdersByPriority(data.orders || []));
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const handleOrderUpdate = (data: any) => {
    setOrders(prevOrders => {
      const updatedOrders = prevOrders.map(order =>
        order.id === data.orderId ? { ...order, ...data.updates } : order
      );
      return sortOrdersByPriority(updatedOrders);
    });

    // Update selected order if it's the one being updated
    if (selectedOrder?.id === data.orderId) {
      setSelectedOrder(prev => prev ? { ...prev, ...data.updates } : null);
    }
  };

  const handleNewOrder = (data: any) => {
    setOrders(prevOrders => sortOrdersByPriority([...prevOrders, data.order]));
  };

  const sortOrdersByPriority = (orders: KitchenOrder[]): KitchenOrder[] => {
    return [...orders].sort((a, b) => {
      // Priority 1: State (PLACED > PREPARING > READY)
      const stateOrder = { PLACED: 0, PREPARING: 1, READY: 2 };
      const stateDiff = stateOrder[a.state] - stateOrder[b.state];
      if (stateDiff !== 0) return stateDiff;

      // Priority 2: Custom priority value (higher priority first)
      const priorityDiff = b.priority - a.priority;
      if (priorityDiff !== 0) return priorityDiff;

      // Priority 3: Creation time (older first)
      return a.createdAt - b.createdAt;
    });
  };

  const handleOrderSelect = (order: KitchenOrder) => {
    setSelectedOrder(order);
  };

  const handleStateTransition = async (orderId: string, newState: string) => {
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toState: newState })
      });

      if (response.ok) {
        // Update will come through WebSocket
        console.log('State transition successful');
      } else {
        const error = await response.json();
        console.error('State transition failed:', error);
      }
    } catch (error) {
      console.error('Error transitioning state:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SketchWireIcon name="chef" size={32} useAccent />
          <h1 className="text-3xl font-bold">Kitchen Display</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-muted-foreground">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Queue - Left Side */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SketchWireIcon name="list" size={20} />
                Order Queue ({orders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrderQueue
                orders={orders}
                selectedOrderId={selectedOrder?.id}
                onOrderSelect={handleOrderSelect}
                onStateTransition={handleStateTransition}
              />
            </CardContent>
          </Card>
        </div>

        {/* Recipe Display & Timer - Right Side */}
        <div className="lg:col-span-2 space-y-6">
          {selectedOrder ? (
            <>
              <RecipeDisplay order={selectedOrder} />
              <TimerManager order={selectedOrder} />
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center text-muted-foreground">
                  <SketchWireIcon name="chef" size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Select an order to view details</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
