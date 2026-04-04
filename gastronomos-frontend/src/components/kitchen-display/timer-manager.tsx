/**
 * Timer Manager Component
 * Tracks preparation time and provides alerts
 * Requirements: 11.3, 11.4
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { SketchWireIcon } from '@/components/design-system/sketch-wire-icon';
import type { KitchenOrder } from './kitchen-dashboard';

interface TimerManagerProps {
  order: KitchenOrder;
}

export function TimerManager({ order }: TimerManagerProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    // Calculate initial elapsed time
    const initialElapsed = Math.floor((Date.now() - order.createdAt) / 1000);
    setElapsedTime(initialElapsed);

    // Update timer every second
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - order.createdAt) / 1000);
      setElapsedTime(elapsed);

      // Check if overdue
      if (order.estimatedReadyTime) {
        const estimatedSeconds = order.estimatedReadyTime * 60;
        setIsOverdue(elapsed > estimatedSeconds);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [order.createdAt, order.estimatedReadyTime]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (): number => {
    if (!order.estimatedReadyTime) return 0;
    const estimatedSeconds = order.estimatedReadyTime * 60;
    return Math.min((elapsedTime / estimatedSeconds) * 100, 100);
  };

  const getProgressColor = (): string => {
    const percentage = getProgressPercentage();
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getTimeRemaining = (): string => {
    if (!order.estimatedReadyTime) return 'N/A';
    const estimatedSeconds = order.estimatedReadyTime * 60;
    const remaining = estimatedSeconds - elapsedTime;
    
    if (remaining <= 0) {
      const overdue = Math.abs(remaining);
      return `+${formatTime(overdue)} overdue`;
    }
    
    return formatTime(remaining);
  };

  return (
    <Card className={isOverdue ? 'border-red-500 border-2' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <SketchWireIcon name="clock" size={20} />
            Preparation Timer
          </span>
          {isOverdue && (
            <Badge variant="destructive" className="animate-pulse">
              <SketchWireIcon name="alert" size={12} className="mr-1" />
              Overdue
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Timer Display */}
        <div className="text-center">
          <div className={`text-5xl font-bold font-mono ${isOverdue ? 'text-red-500' : ''}`}>
            {formatTime(elapsedTime)}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Elapsed Time
          </p>
        </div>

        {/* Progress Bar */}
        {order.estimatedReadyTime && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className={`font-medium ${isOverdue ? 'text-red-500' : ''}`}>
                {Math.round(getProgressPercentage())}%
              </span>
            </div>
            <Progress 
              value={getProgressPercentage()} 
              className="h-3"
              indicatorClassName={getProgressColor()}
            />
          </div>
        )}

        {/* Time Remaining */}
        {order.estimatedReadyTime && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">Time Remaining:</span>
            <span className={`text-lg font-bold font-mono ${isOverdue ? 'text-red-500' : ''}`}>
              {getTimeRemaining()}
            </span>
          </div>
        )}

        {/* Order State Info */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Current State</p>
            <Badge variant={
              order.state === 'PLACED' ? 'secondary' :
              order.state === 'PREPARING' ? 'default' :
              'success'
            }>
              {order.state}
            </Badge>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Items</p>
            <Badge variant="outline">
              {order.items.length} item{order.items.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>

        {/* Item-Level Timers */}
        {order.items.some(item => item.recipe?.preparationTime) && (
          <div className="pt-3 border-t space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <SketchWireIcon name="list" size={14} />
              Item Preparation Times
            </h4>
            {order.items.map((item) => (
              item.recipe?.preparationTime && (
                <div key={item.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                  <span className="truncate flex-1">{item.menuItemName}</span>
                  <Badge variant="secondary" className="text-xs ml-2">
                    {item.recipe.preparationTime} min
                  </Badge>
                </div>
              )
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
