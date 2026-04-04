/**
 * Batch Order Processor Component
 * Handles batch processing of multiple orders
 * Requirements: 11.3
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { SketchWireIcon } from '@/components/design-system/sketch-wire-icon';
import type { KitchenOrder } from './kitchen-dashboard';

interface BatchOrderProcessorProps {
  orders: KitchenOrder[];
  onBatchStateTransition: (orderIds: string[], newState: string) => void;
}

export function BatchOrderProcessor({ 
  orders, 
  onBatchStateTransition 
}: BatchOrderProcessorProps) {
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedOrders(new Set(orders.map(o => o.id)));
  };

  const clearSelection = () => {
    setSelectedOrders(new Set());
  };

  const selectByState = (state: string) => {
    const orderIds = orders.filter(o => o.state === state).map(o => o.id);
    setSelectedOrders(new Set(orderIds));
  };

  const handleBatchTransition = (newState: string) => {
    const orderIds = Array.from(selectedOrders);
    if (orderIds.length > 0) {
      onBatchStateTransition(orderIds, newState);
      clearSelection();
    }
  };

  const canTransitionTo = (state: string): boolean => {
    if (selectedOrders.size === 0) return false;

    const selectedOrdersList = orders.filter(o => selectedOrders.has(o.id));
    
    // Check if all selected orders can transition to the target state
    return selectedOrdersList.every(order => {
      switch (state) {
        case 'PREPARING':
          return order.state === 'PLACED';
        case 'READY':
          return order.state === 'PREPARING';
        default:
          return false;
      }
    });
  };

  const getStateCount = (state: string): number => {
    return orders.filter(o => o.state === state).length;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <SketchWireIcon name="layers" size={20} />
            Batch Processing
          </span>
          <Badge variant="outline">
            {selectedOrders.size} selected
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selection Controls */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            disabled={orders.length === 0}
          >
            Select All ({orders.length})
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={clearSelection}
            disabled={selectedOrders.size === 0}
          >
            Clear
          </Button>

          <div className="flex-1" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => selectByState('PLACED')}
            disabled={getStateCount('PLACED') === 0}
          >
            Placed ({getStateCount('PLACED')})
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => selectByState('PREPARING')}
            disabled={getStateCount('PREPARING') === 0}
          >
            Preparing ({getStateCount('PREPARING')})
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => selectByState('READY')}
            disabled={getStateCount('READY') === 0}
          >
            Ready ({getStateCount('READY')})
          </Button>
        </div>

        {/* Order List */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <SketchWireIcon name="inbox" size={48} className="mx-auto mb-4 opacity-50" />
              <p>No orders available</p>
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                  selectedOrders.has(order.id) 
                    ? 'bg-primary/10 border-primary' 
                    : 'bg-muted/50 hover:bg-muted'
                }`}
                onClick={() => toggleOrderSelection(order.id)}
              >
                <Checkbox
                  checked={selectedOrders.has(order.id)}
                  onCheckedChange={() => toggleOrderSelection(order.id)}
                  onClick={(e) => e.stopPropagation()}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">#{order.orderNumber}</span>
                    {order.tableNumber && (
                      <Badge variant="outline" className="text-xs">
                        Table {order.tableNumber}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <Badge 
                  variant={
                    order.state === 'PLACED' ? 'secondary' :
                    order.state === 'PREPARING' ? 'default' :
                    'success'
                  }
                  className="text-xs"
                >
                  {order.state}
                </Badge>
              </div>
            ))
          )}
        </div>

        {/* Batch Actions */}
        <div className="pt-3 border-t space-y-2">
          <p className="text-sm font-medium mb-2">Batch Actions:</p>
          
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => handleBatchTransition('PREPARING')}
              disabled={!canTransitionTo('PREPARING')}
              variant="default"
              size="sm"
            >
              <SketchWireIcon name="play" size={14} className="mr-2" />
              Start Preparing
            </Button>

            <Button
              onClick={() => handleBatchTransition('READY')}
              disabled={!canTransitionTo('READY')}
              variant="success"
              size="sm"
            >
              <SketchWireIcon name="check" size={14} className="mr-2" />
              Mark Ready
            </Button>
          </div>

          {selectedOrders.size > 0 && !canTransitionTo('PREPARING') && !canTransitionTo('READY') && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Selected orders are in different states. Select orders in the same state for batch processing.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
