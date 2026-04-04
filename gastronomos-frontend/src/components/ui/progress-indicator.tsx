/**
 * ProgressIndicator Component
 * Animated progress indicator for wizard workflows and multi-step processes
 */

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Circle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/animation-utils';
import { useWizard } from '@/contexts/wizard-context';

export interface ProgressStep {
  id: string;
  title: string;
  description?: string;
  isOptional?: boolean;
}

export interface ProgressIndicatorProps {
  steps?: ProgressStep[];
  currentStep?: number;
  completedSteps?: number[];
  errorSteps?: number[];
  className?: string;
  variant?: 'horizontal' | 'vertical';
  showLabels?: boolean;
  showProgress?: boolean;
  animated?: boolean;
}

export function ProgressIndicator({
  steps,
  currentStep,
  completedSteps = [],
  errorSteps = [],
  className,
  variant = 'horizontal',
  showLabels = true,
  showProgress = true,
  animated = true,
}: ProgressIndicatorProps) {
  // Use wizard context if no props provided
  const wizard = useWizard();
  const wizardSteps = steps || wizard.config?.steps.map(step => ({
    id: step.id,
    title: step.title,
    description: step.description,
    isOptional: step.isOptional,
  })) || [];
  const wizardCurrentStep = currentStep ?? wizard.state.currentStep;
  const wizardProgress = wizard.state.progress;

  if (wizardSteps.length === 0) return null;

  const isHorizontal = variant === 'horizontal';

  return (
    <div
      className={cn(
        'flex items-center',
        isHorizontal ? 'w-full' : 'flex-col h-full',
        className
      )}
    >
      {/* Progress bar (horizontal only) */}
      {isHorizontal && showProgress && (
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted -z-10">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${wizardProgress}%` }}
            transition={animated ? transitions.smooth : { duration: 0 }}
          />
        </div>
      )}

      {wizardSteps.map((step, index) => {
        const isCompleted = completedSteps.includes(index) || index < wizardCurrentStep;
        const isCurrent = index === wizardCurrentStep;
        const hasError = errorSteps.includes(index);
        const isUpcoming = index > wizardCurrentStep;

        return (
          <React.Fragment key={step.id}>
            <div
              className={cn(
                'flex items-center',
                isHorizontal ? 'flex-col' : 'flex-row w-full',
                !isHorizontal && index < wizardSteps.length - 1 && 'mb-6'
              )}
            >
              {/* Step indicator */}
              <motion.div
                className={cn(
                  'relative flex items-center justify-center rounded-full border-2 transition-colors',
                  'w-8 h-8 text-sm font-medium',
                  isCompleted && !hasError && 'bg-primary border-primary text-primary-foreground',
                  isCurrent && !hasError && 'bg-background border-primary text-primary',
                  hasError && 'bg-destructive border-destructive text-destructive-foreground',
                  isUpcoming && 'bg-muted border-muted-foreground/30 text-muted-foreground',
                  isHorizontal ? 'mb-2' : 'mr-3'
                )}
                initial={animated ? { scale: 0.8, opacity: 0 } : undefined}
                animate={{ scale: 1, opacity: 1 }}
                transition={animated ? { ...transitions.spring, delay: index * 0.1 } : { duration: 0 }}
                whileHover={animated ? { scale: 1.05 } : {}}
              >
                <AnimatePresence mode="wait">
                  {isCompleted && !hasError ? (
                    <motion.div
                      key="completed"
                      initial={animated ? { scale: 0, rotate: -180 } : undefined}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={animated ? { scale: 0, rotate: 180 } : undefined}
                      transition={animated ? transitions.spring : { duration: 0 }}
                    >
                      <Check className="w-4 h-4" />
                    </motion.div>
                  ) : hasError ? (
                    <motion.div
                      key="error"
                      initial={animated ? { scale: 0 } : undefined}
                      animate={{ scale: 1 }}
                      exit={animated ? { scale: 0 } : undefined}
                      transition={animated ? transitions.spring : { duration: 0 }}
                    >
                      <AlertCircle className="w-4 h-4" />
                    </motion.div>
                  ) : isCurrent ? (
                    <motion.div
                      key="current"
                      initial={animated ? { scale: 0 } : undefined}
                      animate={{ scale: 1 }}
                      exit={animated ? { scale: 0 } : undefined}
                      transition={animated ? transitions.spring : { duration: 0 }}
                    >
                      <Circle className="w-3 h-3 fill-current" />
                    </motion.div>
                  ) : (
                    <motion.span
                      key="number"
                      initial={animated ? { opacity: 0 } : undefined}
                      animate={{ opacity: 1 }}
                      exit={animated ? { opacity: 0 } : undefined}
                      transition={animated ? transitions.default : { duration: 0 }}
                    >
                      {index + 1}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Current step pulse animation */}
                {isCurrent && animated && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary"
                    initial={{ scale: 1, opacity: 1 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                  />
                )}
              </motion.div>

              {/* Step labels */}
              {showLabels && (
                <motion.div
                  className={cn(
                    'text-center',
                    isHorizontal ? 'max-w-24' : 'flex-1'
                  )}
                  initial={animated ? { opacity: 0, y: 10 } : undefined}
                  animate={{ opacity: 1, y: 0 }}
                  transition={animated ? { ...transitions.default, delay: index * 0.1 + 0.2 } : { duration: 0 }}
                >
                  <div
                    className={cn(
                      'text-sm font-medium transition-colors',
                      isCurrent && 'text-primary',
                      isCompleted && !hasError && 'text-foreground',
                      hasError && 'text-destructive',
                      isUpcoming && 'text-muted-foreground'
                    )}
                  >
                    {step.title}
                    {step.isOptional && (
                      <span className="text-xs text-muted-foreground ml-1">(optional)</span>
                    )}
                  </div>
                  {step.description && (
                    <div className="text-xs text-muted-foreground mt-1 leading-tight">
                      {step.description}
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Connector line */}
            {index < wizardSteps.length - 1 && (
              <div
                className={cn(
                  'bg-muted',
                  isHorizontal ? 'flex-1 h-0.5 mx-2' : 'w-0.5 h-6 ml-4 -mt-2 mb-2'
                )}
              >
                <motion.div
                  className={cn(
                    'bg-primary',
                    isHorizontal ? 'h-full' : 'w-full'
                  )}
                  initial={animated ? (isHorizontal ? { width: 0 } : { height: 0 }) : undefined}
                  animate={
                    isCompleted
                      ? isHorizontal
                        ? { width: '100%' }
                        : { height: '100%' }
                      : isHorizontal
                      ? { width: 0 }
                      : { height: 0 }
                  }
                  transition={animated ? { ...transitions.default, delay: index * 0.1 + 0.3 } : { duration: 0 }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Simplified progress bar for basic use cases
export interface SimpleProgressProps {
  value: number;
  max?: number;
  className?: string;
  showPercentage?: boolean;
  animated?: boolean;
  color?: 'primary' | 'success' | 'warning' | 'destructive';
}

export function SimpleProgress({
  value,
  max = 100,
  className,
  showPercentage = false,
  animated = true,
  color = 'primary',
}: SimpleProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const colorClasses = {
    primary: 'bg-primary',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    destructive: 'bg-destructive',
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between mb-1">
        {showPercentage && (
          <motion.span
            className="text-sm font-medium text-muted-foreground"
            initial={animated ? { opacity: 0 } : undefined}
            animate={{ opacity: 1 }}
            transition={animated ? transitions.default : { duration: 0 }}
          >
            {Math.round(percentage)}%
          </motion.span>
        )}
      </div>
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', colorClasses[color])}
          initial={animated ? { width: 0 } : undefined}
          animate={{ width: `${percentage}%` }}
          transition={animated ? transitions.smooth : { duration: 0 }}
        />
      </div>
    </div>
  );
}

// Circular progress indicator
export interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showValue?: boolean;
  animated?: boolean;
  color?: string;
}

export function CircularProgress({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  className,
  showValue = true,
  animated = true,
  color = 'hsl(var(--primary))',
}: CircularProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          initial={animated ? { strokeDashoffset: circumference } : undefined}
          animate={{ strokeDashoffset }}
          transition={animated ? { ...transitions.smooth, duration: 1 } : { duration: 0 }}
        />
      </svg>
      {showValue && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={animated ? { opacity: 0, scale: 0.5 } : undefined}
          animate={{ opacity: 1, scale: 1 }}
          transition={animated ? { ...transitions.spring, delay: 0.5 } : { duration: 0 }}
        >
          <span className="text-2xl font-bold text-foreground">
            {Math.round(percentage)}%
          </span>
        </motion.div>
      )}
    </div>
  );
}