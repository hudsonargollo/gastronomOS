/**
 * Order Queue Component
 * Displays orders with priority sorting and vertical status ribbons
 * Requirements: 11.1, 11.2
 */

'use client';

import { StatusRibbon } from '@/components/design-system/layouts/status-ribbon';
import { StateControls } from './state-controls';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SketchWireIcon } from '@/components/design-system/sketch-wire-icon';
import type { KitchenOrder } from './kitchen-dashboard';

interface OrderQueueProps {
  orders: KitchenOrder[];
  selectedOrderId?: string;
  onOrderSelect: (order: KitchenOrder) => void;
  onStateTransition: (orderId: string, newState: string) => void;
}

export function OrderQueue({
  orders,
  selectedOrderId,
  onOrderSelect,
  onStateTransition
}: OrderQueueProps) {
  const getTimeSinceCreated = (createdAt: number): string => {
    const minutes = Math.floor((Date.now() - createdAt) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 min ago';
    return `${minutes} mins ago`;
  };

  const isOverdue = (order: KitchenOrder): boolean => {
    if (!order.estimatedReadyTime) return false;
    const elapsed = Date.now() - order.createdAt;
    return elapsed > order.estimatedReadyTime * 60000;
  };

  if (orders.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <SketchWireIcon name="check" size={48} className="mx-auto mb-4 opacity-50" />
        <p>No orders in queue</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
      {orders.map((order) => {
        const overdue = isOverdue(order);
        const isSelected = order.id === selectedOrderId;

        return (
          <Card
            key={order.id}
            className={`relative overflow-hidden cursor-pointer transition-all ${
              isSelected ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'
            } ${overdue ? 'border-red-500 border-2' : ''}`}
            onClick={() => onOrderSelect(order)}
          >
            {/* Vertical Status Ribbon */}
            <div className="absolute left-0 top-0 bottom-0 w-2">
              <StatusRibbon
                status={order.state}
                orientation="vertical"
                showLabel={false}
              />
            </div>

            <div className="pl-6 pr-4 py-3">
              {/* Order Header */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg">#{order.orderNumber}</h3>
                    {order.tableNumber && (
                      <Badge variant="outline" className="text-xs">
                        Table {order.tableNumber}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getTimeSinceCreated(order.createdAt)}
                  </p>
                </div>

                {overdue && (
                  <Badge variant="destructive" className="text-xs">
                    <SketchWireIcon name="alert" size={12} className="mr-1" />
                    Overdue
                  </Badge>
                )}
              </div>

              {/* Order Items Summary */}
              <div className="mb-3">
                <p className="text-sm text-muted-foreground">
                  {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                </p>
                <div className="mt-1 space-y-1">
                  {order.items.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        {item.quantity}x
                      </Badge>
                      <span className="truncate">{item.menuItemName}</span>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{order.items.length - 3} more
                    </p>
                  )}
                </div>
              </div>

              {/* Special Instructions */}
              {order.specialInstructions && (
                <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                  <p className="text-xs font-medium flex items-center gap-1">
                    <SketchWireIcon name="alert" size={12} />
                    Special Instructions:
                  </p>
                  <p className="text-xs mt-1">{order.specialInstructions}</p>
                </div>
              )}

              {/* State Controls */}
              <StateControls
                currentState={order.state}
                orderId={order.id}
                onStateTransition={onStateTransition}
                compact
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
