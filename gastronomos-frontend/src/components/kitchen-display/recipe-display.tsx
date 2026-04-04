/**
 * Recipe Display Component
 * Shows ingredient lists and preparation instructions
 * Requirements: 11.1, 11.2
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SketchWireIcon } from '@/components/design-system/sketch-wire-icon';
import { InsumosBar } from '@/components/design-system/layouts/insumos-bar';
import { StateControls } from './state-controls';
import type { KitchenOrder, KitchenOrderItem } from './kitchen-dashboard';

interface RecipeDisplayProps {
  order: KitchenOrder;
}

export function RecipeDisplay({ order }: RecipeDisplayProps) {
  const handleStateTransition = async (orderId: string, newState: string) => {
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toState: newState })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('State transition failed:', error);
      }
    } catch (error) {
      console.error('Error transitioning state:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <SketchWireIcon name="document" size={20} />
            Order #{order.orderNumber}
            {order.tableNumber && (
              <Badge variant="outline">Table {order.tableNumber}</Badge>
            )}
          </CardTitle>
          <Badge 
            variant={
              order.state === 'PLACED' ? 'secondary' :
              order.state === 'PREPARING' ? 'default' :
              'success'
            }
          >
            {order.state}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Special Instructions */}
        {order.specialInstructions && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border-2 border-yellow-300 dark:border-yellow-700">
            <div className="flex items-start gap-2">
              <SketchWireIcon name="alert" size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-yellow-800 dark:text-yellow-300">
                  Special Instructions
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                  {order.specialInstructions}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Order Items */}
        <div className="space-y-4">
          {order.items.map((item, index) => (
            <OrderItemCard key={item.id} item={item} index={index} />
          ))}
        </div>

        {/* State Controls */}
        <div className="pt-4 border-t">
          <StateControls
            currentState={order.state}
            orderId={order.id}
            onStateTransition={handleStateTransition}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function OrderItemCard({ item, index }: { item: KitchenOrderItem; index: number }) {
  return (
    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
      {/* Item Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Badge variant="secondary" className="text-base px-3 py-1">
            {item.quantity}x
          </Badge>
          <div>
            <h3 className="font-semibold text-lg">{item.menuItemName}</h3>
            {item.specialInstructions && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <SketchWireIcon name="alert" size={12} />
                {item.specialInstructions}
              </p>
            )}
          </div>
        </div>
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
      </div>

      {/* Recipe Details */}
      {item.recipe && (
        <div className="space-y-3">
          {/* Ingredients */}
          {item.recipe.ingredients && item.recipe.ingredients.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <SketchWireIcon name="box" size={14} />
                Ingredients
              </h4>
              <InsumosBar
                items={item.recipe.ingredients.map(ing => ({
                  name: ing.name,
                  percentage: 0, // Not used for kitchen display
                  color: 'hsl(var(--primary))'
                }))}
                showPercentages={false}
                height="sm"
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                {item.recipe.ingredients.map((ingredient, idx) => (
                  <div key={idx} className="text-xs flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="font-medium">{ingredient.quantity} {ingredient.unit}</span>
                    <span className="text-muted-foreground">{ingredient.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          {item.recipe.instructions && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <SketchWireIcon name="document" size={14} />
                Preparation Instructions
              </h4>
              <div className="text-sm text-muted-foreground whitespace-pre-line bg-background p-3 rounded border">
                {item.recipe.instructions}
              </div>
            </div>
          )}

          {/* Preparation Time */}
          {item.recipe.preparationTime && (
            <div className="flex items-center gap-2 text-sm">
              <SketchWireIcon name="clock" size={14} />
              <span className="font-medium">Prep Time:</span>
              <span className="text-muted-foreground">{item.recipe.preparationTime} minutes</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
