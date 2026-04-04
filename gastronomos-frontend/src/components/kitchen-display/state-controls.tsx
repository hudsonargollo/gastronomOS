/**
 * State Controls Component
 * One-touch state transition controls for kitchen workflow
 * Requirements: 11.5
 */

'use client';

import { Button } from '@/components/ui/button';
import { SketchWireIcon } from '@/components/design-system/sketch-wire-icon';

interface StateControlsProps {
  currentState: 'PLACED' | 'PREPARING' | 'READY';
  orderId: string;
  onStateTransition: (orderId: string, newState: string) => void;
  compact?: boolean;
}

export function StateControls({
  currentState,
  orderId,
  onStateTransition,
  compact = false
}: StateControlsProps) {
  const getNextState = (): string | null => {
    switch (currentState) {
      case 'PLACED':
        return 'PREPARING';
      case 'PREPARING':
        return 'READY';
      case 'READY':
        return null; // No next state in kitchen (cashier handles DELIVERED)
      default:
        return null;
    }
  };

  const getButtonText = (): string => {
    switch (currentState) {
      case 'PLACED':
        return compact ? 'Start' : 'Start Preparing';
      case 'PREPARING':
        return compact ? 'Ready' : 'Mark Ready';
      case 'READY':
        return compact ? 'Done' : 'Order Ready';
      default:
        return 'Unknown';
    }
  };

  const getButtonIcon = (): string => {
    switch (currentState) {
      case 'PLACED':
        return 'play';
      case 'PREPARING':
        return 'check';
      case 'READY':
        return 'check';
      default:
        return 'check';
    }
  };

  const nextState = getNextState();

  if (!nextState) {
    return (
      <div className={`flex items-center gap-2 ${compact ? 'justify-end' : 'justify-center'}`}>
        <Badge variant="success" className="text-xs">
          <SketchWireIcon name="check" size={12} className="mr-1" />
          Ready for Pickup
        </Badge>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${compact ? 'justify-end' : 'justify-center'}`}>
      <Button
        onClick={(e) => {
          e.stopPropagation();
          onStateTransition(orderId, nextState);
        }}
        className={compact ? 'h-8 text-xs' : 'w-full'}
        variant={currentState === 'PLACED' ? 'default' : 'success'}
      >
        <SketchWireIcon name={getButtonIcon()} size={compact ? 14 : 16} className="mr-2" />
        {getButtonText()}
      </Button>
    </div>
  );
}

// Badge component for "Ready" state
function Badge({ 
  children, 
  variant, 
  className 
}: { 
  children: React.ReactNode; 
  variant: string; 
  className?: string;
}) {
  const variantStyles = {
    success: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    default: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-medium ${variantStyles[variant as keyof typeof variantStyles] || variantStyles.default} ${className || ''}`}>
      {children}
    </span>
  );
}
