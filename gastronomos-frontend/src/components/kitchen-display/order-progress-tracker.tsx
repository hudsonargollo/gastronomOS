/**
 * Order Progress Tracker Component
 * Tracks individual item completion and overall order progress
 * Requirements: 11.3
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { SketchWireIcon } from '@/components/design-system/sketch-wire-icon';
import type { KitchenOrder, KitchenOrderItem } from './kitchen-dashboard';

interface OrderProgressTrackerProps {
  order: KitchenOrder;
  onItemStatusUpdate: (itemId: string, status: string) => void;
}

export function OrderProgressTracker({ 
  order, 
  onItemStatusUpdate 
}: OrderProgressTrackerProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItemExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const getOrderProgress = (): number => {
    if (order.items.length === 0) return 0;
    const completedItems = order.items.filter(item => item.status === 'READY').length;
    return (completedItems / order.items.length) * 100;
  };

  const getItemStatusColor = (status: string): string => {
    switch (status) {
      case 'PENDING':
        return 'text-gray-500';
      case 'PREPARING':
        return 'text-blue-500';
      case 'READY':
        return 'text-green-500';
      default:
        return 'text-gray-500';
    }
  };

  const handleItemStatusChange = (itemId: string, currentStatus: string) => {
    let newStatus: string;
    
    switch (currentStatus) {
      case 'PENDING':
        newStatus = 'PREPARING';
        break;
      case 'PREPARING':
        newStatus = 'READY';
        break;
      case 'READY':
        newStatus = 'PREPARING'; // Allow toggling back
        break;
      default:
        newStatus = 'PENDING';
    }

    onItemStatusUpdate(itemId, newStatus);
  };

  const orderProgress = getOrderProgress();
  const completedCount = order.items.filter(item => item.status === 'READY').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <SketchWireIcon name="list" size={20} />
            Order Progress
          </span>
          <Badge variant={orderProgress === 100 ? 'success' : 'default'}>
            {completedCount}/{order.items.length} Complete
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{Math.round(orderProgress)}%</span>
          </div>
          <Progress 
            value={orderProgress} 
            className="h-3"
            indicatorClassName={orderProgress === 100 ? 'bg-green-500' : 'bg-blue-500'}
          />
        </div>

        {/* Item List */}
        <div className="space-y-2">
          {order.items.map((item) => {
            const isExpanded = expandedItems.has(item.id);
            const isReady = item.status === 'READY';

            return (
              <div 
                key={item.id} 
                className={`border rounded-lg p-3 transition-all ${
                  isReady ? 'bg-green-50 dark:bg-green-900/10 border-green-300 dark:border-green-700' : 'bg-muted/50'
                }`}
              >
                {/* Item Header */}
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={isReady}
                    onCheckedChange={() => handleItemStatusChange(item.id, item.status)}
                    className="flex-shrink-0"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {item.quantity}x
                      </Badge>
                      <span className={`font-medium truncate ${isReady ? 'line-through text-muted-foreground' : ''}`}>
                        {item.menuItemName}
                      </span>
                    </div>
                    {item.specialInstructions && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <SketchWireIcon name="alert" size={10} />
                        {item.specialInstructions}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge 
                      variant={
                        item.status === 'PENDING' ? 'secondary' :
                        item.status === 'PREPARING' ? 'default' :
                        'success'
                      }
                      className="text-xs"
                    >
                      {item.status}
                    </Badge>
                    
                    {item.recipe && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleItemExpanded(item.id)}
                        className="h-6 w-6 p-0"
                      >
                        <SketchWireIcon 
                          name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                          size={14} 
                        />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded Recipe Details */}
                {isExpanded && item.recipe && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    {item.recipe.ingredients && item.recipe.ingredients.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold mb-1">Ingredients:</h5>
                        <div className="grid grid-cols-2 gap-1">
                          {item.recipe.ingredients.map((ing, idx) => (
                            <div key={idx} className="text-xs text-muted-foreground">
                              • {ing.quantity} {ing.unit} {ing.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {item.recipe.preparationTime && (
                      <div className="text-xs flex items-center gap-1">
                        <SketchWireIcon name="clock" size={10} />
                        <span className="font-medium">Prep Time:</span>
                        <span className="text-muted-foreground">{item.recipe.preparationTime} min</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="pt-3 border-t flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              order.items.forEach(item => {
                if (item.status === 'PENDING') {
                  onItemStatusUpdate(item.id, 'PREPARING');
                }
              });
            }}
            className="flex-1"
          >
            <SketchWireIcon name="play" size={14} className="mr-2" />
            Start All
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              order.items.forEach(item => {
                if (item.status === 'PREPARING') {
                  onItemStatusUpdate(item.id, 'READY');
                }
              });
            }}
            className="flex-1"
          >
            <SketchWireIcon name="check" size={14} className="mr-2" />
            Complete All
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
