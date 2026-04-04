/**
 * WizardNavigation Component
 * Navigation component for wizard workflows with step validation and progress tracking
 */

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, X, AlertCircle, Home } from 'lucide-react';
import { Button } from './button';
import { ProgressIndicator } from './progress-indicator';
import { cn } from '@/lib/utils';
import { fadeInOut, slideInFromBottom, transitions } from '@/lib/animation-utils';
import { useWizard, useWizardNavigation, useWizardState } from '@/contexts/wizard-context';

export interface WizardNavigationProps {
  className?: string;
  showProgress?: boolean;
  showStepLabels?: boolean;
  variant?: 'full' | 'compact' | 'minimal';
  position?: 'top' | 'bottom' | 'floating';
  animated?: boolean;
  onCancel?: () => void;
  onComplete?: () => void;
  customActions?: React.ReactNode;
}

export function WizardNavigation({
  className,
  showProgress = true,
  showStepLabels = true,
  variant = 'full',
  position = 'bottom',
  animated = true,
  onCancel,
  onComplete,
  customActions,
}: WizardNavigationProps) {
  const wizard = useWizard();
  const navigation = useWizardNavigation();
  const state = useWizardState();

  if (!wizard.config) return null;

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigation.cancel();
    }
  };

  const handleComplete = async () => {
    if (onComplete) {
      onComplete();
    } else {
      await navigation.complete();
    }
  };

  const renderProgressSection = () => {
    if (!showProgress) return null;

    return (
      <motion.div
        className="flex-1"
        initial={animated ? { opacity: 0, y: -10 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={animated ? transitions.default : { duration: 0 }}
      >
        <ProgressIndicator
          showLabels={showStepLabels && variant === 'full'}
          variant="horizontal"
          animated={animated}
        />
      </motion.div>
    );
  };

  const renderNavigationButtons = () => (
    <motion.div
      className="flex items-center gap-2"
      initial={animated ? { opacity: 0, x: 20 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={animated ? { ...transitions.default, delay: 0.1 } : { duration: 0 }}
    >
      {/* Custom actions */}
      {customActions}

      {/* Cancel button */}
      <Button
        variant="outline"
        size={variant === 'compact' ? 'sm' : 'default'}
        onClick={handleCancel}
        className="flex items-center gap-2"
      >
        <X className="w-4 h-4" />
        {variant !== 'minimal' && 'Cancel'}
      </Button>

      {/* Previous button */}
      <Button
        variant="outline"
        size={variant === 'compact' ? 'sm' : 'default'}
        onClick={navigation.previousStep}
        disabled={!navigation.canGoBack}
        className="flex items-center gap-2"
      >
        <ChevronLeft className="w-4 h-4" />
        {variant !== 'minimal' && 'Previous'}
      </Button>

      {/* Next/Complete button */}
      {navigation.isLastStep ? (
        <Button
          size={variant === 'compact' ? 'sm' : 'default'}
          onClick={handleComplete}
          disabled={!navigation.canGoNext || state.isCompleting}
          className="flex items-center gap-2"
        >
          {state.isCompleting ? (
            <>
              <motion.div
                className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              {variant !== 'minimal' && 'Completing...'}
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              {variant !== 'minimal' && 'Complete'}
            </>
          )}
        </Button>
      ) : (
        <Button
          size={variant === 'compact' ? 'sm' : 'default'}
          onClick={navigation.nextStep}
          disabled={!navigation.canGoNext}
          className="flex items-center gap-2"
        >
          {variant !== 'minimal' && 'Next'}
          <ChevronRight className="w-4 h-4" />
        </Button>
      )}
    </motion.div>
  );

  const renderStepInfo = () => {
    if (variant === 'minimal') return null;

    return (
      <motion.div
        className="flex items-center gap-4"
        initial={animated ? { opacity: 0, x: -20 } : false}
        animate={{ opacity: 1, x: 0 }}
        transition={animated ? transitions.default : { duration: 0 }}
      >
        <div className="text-sm text-muted-foreground">
          Step {state.currentStep + 1} of {state.totalSteps}
        </div>
        {variant === 'full' && (
          <div className="text-sm font-medium">
            {wizard.currentStepConfig?.title}
          </div>
        )}
      </motion.div>
    );
  };

  const renderErrorMessage = () => {
    const currentStepId = wizard.currentStepConfig?.id;
    const error = currentStepId ? state.errors[currentStepId] : null;

    if (!error) return null;

    return (
      <AnimatePresence>
        <motion.div
          className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm"
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={transitions.default}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </motion.div>
      </AnimatePresence>
    );
  };

  // Base container classes
  const containerClasses = cn(
    'bg-background border-t',
    position === 'floating' && 'rounded-lg border shadow-lg',
    position === 'top' && 'border-t-0 border-b',
    className
  );

  // Layout based on variant
  switch (variant) {
    case 'full':
      return (
        <motion.div
          className={containerClasses}
          initial={animated ? { opacity: 0, y: 20 } : undefined}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={animated ? transitions.default : { duration: 0 }}
        >
          {renderErrorMessage()}
          <div className="p-4 space-y-4">
            {renderProgressSection()}
            <div className="flex items-center justify-between">
              {renderStepInfo()}
              {renderNavigationButtons()}
            </div>
          </div>
        </motion.div>
      );

    case 'compact':
      return (
        <motion.div
          className={containerClasses}
          initial={animated ? { opacity: 0, y: 20 } : undefined}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={animated ? transitions.default : { duration: 0 }}
        >
          {renderErrorMessage()}
          <div className="p-3">
            <div className="flex items-center justify-between gap-4">
              {renderStepInfo()}
              {showProgress && (
                <div className="flex-1 max-w-xs">
                  <ProgressIndicator
                    showLabels={false}
                    variant="horizontal"
                    animated={animated}
                  />
                </div>
              )}
              {renderNavigationButtons()}
            </div>
          </div>
        </motion.div>
      );

    case 'minimal':
      return (
        <motion.div
          className={cn('flex items-center justify-end gap-2', className)}
          initial={animated ? { opacity: 0 } : undefined}
          animate={{ opacity: 1 }}
          transition={animated ? transitions.default : { duration: 0 }}
        >
          {renderNavigationButtons()}
        </motion.div>
      );

    default:
      return null;
  }
}

// Floating navigation component for overlay scenarios
export interface FloatingWizardNavigationProps extends Omit<WizardNavigationProps, 'position'> {
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
}

export function FloatingWizardNavigation({
  position = 'bottom-right',
  className,
  ...props
}: FloatingWizardNavigationProps) {
  const positionClasses = {
    'bottom-right': 'fixed bottom-4 right-4',
    'bottom-left': 'fixed bottom-4 left-4',
    'bottom-center': 'fixed bottom-4 left-1/2 transform -translate-x-1/2',
  };

  return (
    <WizardNavigation
      {...props}
      variant="compact"
      position="floating"
      className={cn(positionClasses[position], 'z-50', className)}
    />
  );
}

// Step navigation breadcrumb component
export interface WizardBreadcrumbProps {
  className?: string;
  animated?: boolean;
  clickable?: boolean;
  showIcons?: boolean;
}

export function WizardBreadcrumb({
  className,
  animated = true,
  clickable = false,
  showIcons = true,
}: WizardBreadcrumbProps) {
  const wizard = useWizard();
  const state = useWizardState();

  if (!wizard.config) return null;

  const handleStepClick = (stepIndex: number) => {
    if (clickable && stepIndex <= state.currentStep) {
      wizard.actions.goToStep(stepIndex);
    }
  };

  return (
    <motion.nav
      className={cn('flex items-center space-x-2 text-sm', className)}
      initial={animated ? { opacity: 0, y: -10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={animated ? transitions.default : { duration: 0 }}
    >
      {wizard.config?.steps?.map((step, index) => (
        <React.Fragment key={step.id}>
          <motion.button
            className={cn(
              'flex items-center gap-2 px-2 py-1 rounded transition-colors',
              index === state.currentStep && 'bg-primary/10 text-primary font-medium',
              index < state.currentStep && 'text-muted-foreground hover:text-foreground',
              index > state.currentStep && 'text-muted-foreground/50',
              clickable && index <= state.currentStep && 'hover:bg-muted cursor-pointer',
              !clickable && 'cursor-default'
            )}
            onClick={() => handleStepClick(index)}
            disabled={!clickable || index > state.currentStep}
            initial={animated ? { opacity: 0, scale: 0.9 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={animated ? { ...transitions.default, delay: index * 0.1 } : { duration: 0 }}
          >
            {showIcons && (
              <div className="w-5 h-5 flex items-center justify-center">
                {index < state.currentStep ? (
                  <Check className="w-3 h-3" />
                ) : index === state.currentStep ? (
                  <div className="w-2 h-2 bg-current rounded-full" />
                ) : (
                  <span className="text-xs">{index + 1}</span>
                )}
              </div>
            )}
            <span className="truncate max-w-24">{step.title}</span>
          </motion.button>
          
          {index < (wizard.config?.steps.length ?? 0) - 1 && (
            <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
          )}
        </React.Fragment>
      ))}
    </motion.nav>
  );
}