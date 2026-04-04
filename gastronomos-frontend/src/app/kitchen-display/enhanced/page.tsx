/**
 * Enhanced Kitchen Display System Page
 * Full-featured kitchen interface with all workflow capabilities
 * Part of Digital Menu, Kitchen Orchestration & Payment System
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SketchWireIcon } from '@/components/design-system/sketch-wire-icon';
import { OrderQueue } from '@/components/kitchen-display/order-queue';
import { RecipeDisplay } from '@/components/kitchen-display/recipe-display';
import { TimerManager } from '@/components/kitchen-display/timer-manager';
import { OrderProgressTracker } from '@/components/kitchen-display/order-progress-tracker';
import { BatchOrderProcessor } from '@/components/kitchen-display/batch-order-processor';
import { StaffAssignment } from '@/components/kitchen-display/staff-assignment';
import { getWebSocketService } from '@/lib/websocket';
import type { KitchenOrder } from '@/components/kitchen-display/kitchen-dashboard';

export default function EnhancedKitchenDisplayPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<KitchenOrder | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('queue');

  useEffect(() => {
    fetchOrders();

    const ws = getWebSocketService();
    ws.connect();

    const unsubscribeConnect = ws.onConnect(() => {
      setIsConnected(true);
    });

    const unsubscribeDisconnect = ws.onDisconnect(() => {
      setIsConnected(false);
    });

    const unsubscribeOrderUpdate = ws.on('order:update', handleOrderUpdate);
    const unsubscribeNewOrder = ws.on('order:new', handleNewOrder);

    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeOrderUpdate();
      unsubscribeNewOrder();
    };
  }, []);

  const fetchOrders = async () => {
    try {
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

    if (selectedOrder?.id === data.orderId) {
      setSelectedOrder(prev => prev ? { ...prev, ...data.updates } : null);
    }
  };

  const handleNewOrder = (data: any) => {
    setOrders(prevOrders => sortOrdersByPriority([...prevOrders, data.order]));
  };

  const sortOrdersByPriority = (orders: KitchenOrder[]): KitchenOrder[] => {
    return [...orders].sort((a, b) => {
      const stateOrder = { PLACED: 0, PREPARING: 1, READY: 2 };
      const stateDiff = stateOrder[a.state] - stateOrder[b.state];
      if (stateDiff !== 0) return stateDiff;
      const priorityDiff = b.priority - a.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt - b.createdAt;
    });
  };

  const handleOrderSelect = (order: KitchenOrder) => {
    setSelectedOrder(order);
    setActiveTab('details');
  };

  const handleStateTransition = async (orderId: string, newState: string) => {
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toState: newState })
      });

      if (!response.ok) {
        console.error('State transition failed');
      }
    } catch (error) {
      console.error('Error transitioning state:', error);
    }
  };

  const handleBatchStateTransition = async (orderIds: string[], newState: string) => {
    try {
      const response = await fetch('/api/v1/orders/batch-transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transitions: orderIds.map(orderId => ({
            orderId,
            toState: newState
          }))
        })
      });

      if (!response.ok) {
        console.error('Batch state transition failed');
      }
    } catch (error) {
      console.error('Error in batch transition:', error);
    }
  };

  const handleItemStatusUpdate = async (itemId: string, status: string) => {
    try {
      const response = await fetch(`/api/v1/kitchen/order-items/${itemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        console.error('Item status update failed');
      }
    } catch (error) {
      console.error('Error updating item status:', error);
    }
  };

  const handleStaffAssign = async (orderId: string, staffId: string) => {
    try {
      const response = await fetch(`/api/v1/kitchen/orders/${orderId}/assign-staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId })
      });

      if (!response.ok) {
        console.error('Staff assignment failed');
      }
    } catch (error) {
      console.error('Error assigning staff:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SketchWireIcon name="chef" size={32} useAccent />
          <div>
            <h1 className="text-3xl font-bold">Enhanced Kitchen Display</h1>
            <p className="text-sm text-muted-foreground">
              Full workflow management with batch processing
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <Card className="px-4 py-2">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Active Orders</p>
                <p className="text-lg font-bold">{orders.length}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Preparing</p>
                <p className="text-lg font-bold text-blue-500">
                  {orders.filter(o => o.state === 'PREPARING').length}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Ready</p>
                <p className="text-lg font-bold text-green-500">
                  {orders.filter(o => o.state === 'READY').length}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Order Queue */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SketchWireIcon name="list" size={20} />
                Order Queue
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

        {/* Right Column - Tabbed Interface */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="queue">Queue</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="batch">Batch</TabsTrigger>
              <TabsTrigger value="staff">Staff</TabsTrigger>
            </TabsList>

            <TabsContent value="queue" className="space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    <SketchWireIcon name="list" size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Select an order from the queue to view details</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-6">
              {selectedOrder ? (
                <>
                  <RecipeDisplay order={selectedOrder} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <TimerManager order={selectedOrder} />
                    <OrderProgressTracker
                      order={selectedOrder}
                      onItemStatusUpdate={handleItemStatusUpdate}
                    />
                  </div>
                  <StaffAssignment
                    order={selectedOrder}
                    onStaffAssign={handleStaffAssign}
                  />
                </>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground">
                      <SketchWireIcon name="document" size={48} className="mx-auto mb-4 opacity-50" />
                      <p>Select an order to view details</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="batch" className="space-y-6">
              <BatchOrderProcessor
                orders={orders}
                onBatchStateTransition={handleBatchStateTransition}
              />
            </TabsContent>

            <TabsContent value="staff" className="space-y-6">
              {selectedOrder ? (
                <StaffAssignment
                  order={selectedOrder}
                  onStaffAssign={handleStaffAssign}
                />
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground">
                      <SketchWireIcon name="user" size={48} className="mx-auto mb-4 opacity-50" />
                      <p>Select an order to assign staff</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
