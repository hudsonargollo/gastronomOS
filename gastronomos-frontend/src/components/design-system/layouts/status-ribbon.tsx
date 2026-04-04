'use client';

/**
 * Vertical Status Ribbon Component
 * Order workflow status visualization
 * Adaptive Gastronomy Design System
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface StatusRibbonProps {
  steps: StatusStep[];
  currentStep: number;
  className?: string;
  variant?: 'default' | 'compact' | 'detailed';
  orientation?: 'vertical' | 'horizontal';
}

export interface StatusStep {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  timestamp?: Date;
  status?: 'pending' | 'active' | 'completed' | 'error';
}

/**
 * Status Ribbon
 * Displays workflow progress in a ribbon format
 */
export function StatusRibbon({ 
  steps, 
  currentStep,
  className,
  variant = 'default',
  orientation = 'vertical'
}: StatusRibbonProps) {
  const isVertical = orientation === 'vertical';

  return (
    <div
      className={cn(
        'bg-[var(--token-surface-base)]',
        'border border-[var(--token-border-subtle)]',
        'rounded-lg p-4',
        className
      )}
    >
      <div 
        className={cn(
          'flex',
          isVertical ? 'flex-col' : 'flex-row items-center',
          isVertical ? 'gap-0' : 'gap-4'
        )}
      >
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <StepItem
              step={step}
              index={index}
              currentStep={currentStep}
              variant={variant}
              isVertical={isVertical}
            />
            {index < steps.length - 1 && (
              <StepConnector
                isActive={index < currentStep}
                isVertical={isVertical}
                variant={variant}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * Step Item
 * Individual step within the ribbon
 */
function StepItem({ 
  step, 
  index, 
  currentStep,
  variant,
  isVertical
}: { 
  step: StatusStep; 
  index: number; 
  currentStep: number;
  variant: 'default' | 'compact' | 'detailed';
  isVertical: boolean;
}) {
  const isCompleted = index < currentStep;
  const isActive = index === currentStep;
  const isPending = index > currentStep;
  const hasError = step.status === 'error';

  const getStatusColor = () => {
    if (hasError) return 'var(--token-status-error)';
    if (isCompleted) return 'var(--token-status-success)';
    if (isActive) return 'var(--token-action-primary)';
    return 'var(--token-border-default)';
  };

  const sizeClasses = {
    default: 'w-10 h-10',
    compact: 'w-8 h-8',
    detailed: 'w-12 h-12',
  };

  return (
    <div 
      className={cn(
        'flex',
        isVertical ? 'flex-row items-start gap-3' : 'flex-col items-center gap-2',
        'flex-shrink-0'
      )}
    >
      {/* Step indicator */}
      <div
        className={cn(
          'flex items-center justify-center',
          'rounded-full',
          'border-2',
          'transition-all duration-300',
          'font-bold',
          sizeClasses[variant],
          isActive && 'shadow-lg scale-110',
          isCompleted && 'bg-[var(--token-status-success)]',
          isActive && 'bg-[var(--token-action-primary)]',
          isPending && 'bg-[var(--token-surface-elevated)]',
          hasError && 'bg-[var(--token-status-error)]'
        )}
        style={{
          borderColor: getStatusColor(),
          color: isCompleted || isActive || hasError ? 'white' : 'var(--token-text-secondary)',
        }}
      >
        {step.icon || (index + 1)}
      </div>

      {/* Step content */}
      <div className={cn('flex-1', !isVertical && 'text-center')}>
        <div 
          className={cn(
            'font-semibold',
            variant === 'compact' ? 'text-xs' : 'text-sm',
            isActive && 'text-[var(--token-action-primary)]',
            isCompleted && 'text-[var(--token-status-success)]',
            isPending && 'text-[var(--token-text-secondary)]',
            hasError && 'text-[var(--token-status-error)]'
          )}
        >
          {step.label}
        </div>
        
        {variant === 'detailed' && step.description && (
          <div className="text-xs text-[var(--token-text-tertiary)] mt-1">
            {step.description}
          </div>
        )}
        
        {variant === 'detailed' && step.timestamp && (
          <div className="text-xs text-[var(--token-text-tertiary)] mt-1 font-mono">
            {step.timestamp.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Step Connector
 * Line connecting steps in the ribbon
 */
function StepConnector({ 
  isActive, 
  isVertical,
  variant
}: { 
  isActive: boolean; 
  isVertical: boolean;
  variant: 'default' | 'compact' | 'detailed';
}) {
  const thickness = {
    default: '2px',
    compact: '1px',
    detailed: '3px',
  };

  return (
    <div
      className={cn(
        'transition-all duration-300',
        isVertical ? 'w-0.5 h-8 ml-5' : 'h-0.5 w-12',
        isActive ? 'bg-[var(--token-status-success)]' : 'bg-[var(--token-border-subtle)]'
      )}
      style={{
        [isVertical ? 'width' : 'height']: thickness[variant],
      }}
    />
  );
}
