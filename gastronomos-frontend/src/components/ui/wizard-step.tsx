/**
 * WizardStep Component
 * Individual step component for wizard workflows with navigation controls
 */

'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, X, AlertCircle } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { cn } from '@/lib/utils';
import { slideInFromRight, slideInFromLeft, fadeInOut, transitions } from '@/lib/animation-utils';
import { useWizard, useWizardNavigation, useCurrentStep, WizardStepProps } from '@/contexts/wizard-context';

export interface WizardStepComponentProps extends WizardStepProps {
  className?: string;
  showNavigation?: boolean;
  showProgress?: boolean;
  animated?: boolean;
  variant?: 'card' | 'full' | 'minimal';
}

export function WizardStep({
  title,
  description,
  children,
  isValid,
  onNext,
  onPrevious,
  onDataChange,
  stepData,
  wizardData,
  className,
  showNavigation = true,
  showProgress = false,
  animated = true,
  variant = 'card',
}: WizardStepComponentProps) {
  const wizard = useWizard();
  const navigation = useWizardNavigation();
  const currentStep = useCurrentStep();
  const [localData, setLocalData] = useState(stepData || {});
  const [validationError, setValidationError] = useState<string>('');

  // Update local data when step data changes
  useEffect(() => {
    if (stepData !== undefined) {
      setLocalData(stepData);
    }
  }, [stepData]);

  // Handle data changes
  const handleDataChange = (newData: any) => {
    setLocalData(newData);
    onDataChange?.(newData);
    
    // Update wizard context if available
    if (currentStep.step) {
      wizard.actions.updateStepData(currentStep.step.id, newData);
    }
  };

  // Handle next step
  const handleNext = async () => {
    try {
      setValidationError('');
      
      if (onNext) {
        onNext();
      } else {
        await navigation.nextStep();
      }
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  // Handle previous step
  const handlePrevious = () => {
    if (onPrevious) {
      onPrevious();
    } else {
      navigation.previousStep();
    }
  };

  // Handle completion
  const handleComplete = async () => {
    try {
      setValidationError('');
      await navigation.complete();
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Failed to complete wizard');
    }
  };

  // Determine if step is valid
  const stepIsValid = isValid ?? navigation.canGoNext;

  // Animation variants based on navigation direction
  const getAnimationVariants = () => {
    if (!animated) return fadeInOut;
    
    // You could track navigation direction here for more sophisticated animations
    return slideInFromRight;
  };

  const renderContent = () => (
    <motion.div
      variants={getAnimationVariants()}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={transitions.default}
      className="w-full h-full"
    >
      {/* Header */}
      <div className="mb-6">
        <motion.h2
          className="text-2xl font-bold text-foreground mb-2"
          initial={animated ? { opacity: 0, y: -20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={animated ? { ...transitions.default, delay: 0.1 } : { duration: 0 }}
        >
          {title}
        </motion.h2>
        {description && (
          <motion.p
            className="text-muted-foreground"
            initial={animated ? { opacity: 0, y: -10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={animated ? { ...transitions.default, delay: 0.2 } : { duration: 0 }}
          >
            {description}
          </motion.p>
        )}
      </div>

      {/* Progress indicator */}
      {showProgress && (
        <motion.div
          className="mb-6"
          initial={animated ? { opacity: 0, scale: 0.95 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={animated ? { ...transitions.default, delay: 0.3 } : { duration: 0 }}
        >
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>Step {currentStep.stepNumber + 1} of {wizard.state.totalSteps}</span>
            <span>{Math.round(wizard.state.progress)}% complete</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <motion.div
              className="bg-primary h-2 rounded-full"
              initial={animated ? { width: 0 } : false}
              animate={{ width: `${wizard.state.progress}%` }}
              transition={animated ? { ...transitions.smooth, delay: 0.4 } : { duration: 0 }}
            />
          </div>
        </motion.div>
      )}

      {/* Content */}
      <motion.div
        className="flex-1 mb-6"
        initial={animated ? { opacity: 0, y: 20 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={animated ? { ...transitions.default, delay: 0.4 } : { duration: 0 }}
      >
        {React.isValidElement(children)
          ? React.cloneElement(children as React.ReactElement, {
              stepData: localData,
              wizardData,
              onDataChange: handleDataChange,
            })
          : children}
      </motion.div>

      {/* Validation error */}
      <AnimatePresence>
        {validationError && (
          <motion.div
            className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-destructive"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={transitions.default}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{validationError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      {showNavigation && (
        <motion.div
          className="flex items-center justify-between pt-4 border-t"
          initial={animated ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={animated ? { ...transitions.default, delay: 0.5 } : { duration: 0 }}
        >
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={!navigation.canGoBack}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={navigation.cancel}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </Button>

            {navigation.isLastStep ? (
              <Button
                onClick={handleComplete}
                disabled={!stepIsValid || wizard.state.isCompleting}
                className="flex items-center gap-2"
              >
                {wizard.state.isCompleting ? (
                  <>
                    <motion.div
                      className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    Completing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Complete
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!stepIsValid}
                className="flex items-center gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );

  // Render based on variant
  switch (variant) {
    case 'card':
      return (
        <Card className={cn('w-full max-w-2xl mx-auto', className)}>
          <CardContent className="p-6">
            {renderContent()}
          </CardContent>
        </Card>
      );

    case 'full':
      return (
        <div className={cn('w-full h-full flex flex-col', className)}>
          {renderContent()}
        </div>
      );

    case 'minimal':
      return (
        <div className={cn('w-full', className)}>
          {renderContent()}
        </div>
      );

    default:
      return renderContent();
  }
}

// Higher-order component for creating wizard steps
export function createWizardStep<T = any>(
  component: React.ComponentType<{
    stepData?: T;
    wizardData?: Record<string, any>;
    onDataChange?: (data: T) => void;
  }>,
  config?: {
    title: string;
    description?: string;
    validation?: (data: T) => boolean | Promise<boolean>;
  }
) {
  const WizardStepWrapper = (props: WizardStepComponentProps) => {
    return (
      <WizardStep
        title={config?.title || 'Step'}
        description={config?.description}
        {...props}
      >
        {React.createElement(component, {
          stepData: props.stepData,
          wizardData: props.wizardData,
          onDataChange: props.onDataChange,
        })}
      </WizardStep>
    );
  };

  WizardStepWrapper.displayName = `WizardStep(${component.displayName || component.name})`;
  
  return WizardStepWrapper;
}

// Utility component for step content with common patterns
export interface StepContentProps {
  children: React.ReactNode;
  className?: string;
}

export function StepContent({ children, className }: StepContentProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {children}
    </div>
  );
}

// Form step wrapper for common form patterns
export interface FormStepProps {
  children: React.ReactNode;
  onSubmit?: (data: any) => void;
  className?: string;
}

export function FormStep({ children, onSubmit, className }: FormStepProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    onSubmit?.(data);
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
      {children}
    </form>
  );
}