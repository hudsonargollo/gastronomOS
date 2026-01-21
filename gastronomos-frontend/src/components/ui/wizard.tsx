/**
 * Wizard Component
 * Main wizard component that orchestrates the entire wizard workflow
 */

'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WizardProvider, useWizard, WizardConfig, WizardStep as WizardStepConfig } from '@/contexts/wizard-context';
import { WizardStep } from './wizard-step';
import { WizardNavigation } from './wizard-navigation';
import { ProgressIndicator } from './progress-indicator';
import { cn } from '@/lib/utils';
import { slideInFromRight, slideInFromLeft, fadeInOut, transitions } from '@/lib/animation-utils';

export interface WizardProps {
  config: WizardConfig;
  className?: string;
  showProgress?: boolean;
  showNavigation?: boolean;
  navigationVariant?: 'full' | 'compact' | 'minimal';
  navigationPosition?: 'top' | 'bottom' | 'floating';
  stepVariant?: 'card' | 'full' | 'minimal';
  animated?: boolean;
  persistenceKey?: string;
  onStepChange?: (stepIndex: number, stepConfig: WizardStepConfig) => void;
  onComplete?: (data: Record<string, any>) => void;
  onCancel?: () => void;
}

function WizardContent({
  config,
  className,
  showProgress = true,
  showNavigation = true,
  navigationVariant = 'full',
  navigationPosition = 'bottom',
  stepVariant = 'card',
  animated = true,
  onStepChange,
  onComplete,
  onCancel,
}: Omit<WizardProps, 'persistenceKey'>) {
  const wizard = useWizard();

  // Initialize wizard when component mounts
  useEffect(() => {
    wizard.actions.startWizard(config);
  }, [config, wizard.actions]);

  // Handle step changes
  useEffect(() => {
    if (wizard.currentStepConfig && onStepChange) {
      onStepChange(wizard.state.currentStep, wizard.currentStepConfig);
    }
  }, [wizard.state.currentStep, wizard.currentStepConfig, onStepChange]);

  // Handle completion
  useEffect(() => {
    if (onComplete && wizard.state.progress === 100) {
      onComplete(wizard.state.stepData);
    }
  }, [wizard.state.progress, wizard.state.stepData, onComplete]);

  if (!wizard.config || !wizard.currentStepConfig) {
    return null;
  }

  const currentStep = wizard.currentStepConfig;
  const StepComponent = currentStep.component;

  // Animation direction based on navigation
  const getStepAnimation = () => {
    if (!animated) return fadeInOut;
    
    // You could track navigation direction for more sophisticated animations
    return slideInFromRight;
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Top navigation */}
      {showNavigation && navigationPosition === 'top' && (
        <WizardNavigation
          variant={navigationVariant}
          position="top"
          showProgress={showProgress}
          animated={animated}
          onCancel={onCancel}
          onComplete={() => onComplete?.(wizard.state.stepData)}
        />
      )}

      {/* Progress indicator (standalone) */}
      {showProgress && !showNavigation && (
        <motion.div
          className="p-4 border-b"
          initial={animated ? { opacity: 0, y: -10 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={animated ? transitions.default : { duration: 0 }}
        >
          <ProgressIndicator animated={animated} />
        </motion.div>
      )}

      {/* Step content */}
      <div className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={wizard.state.currentStep}
            variants={getStepAnimation()}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.default}
            className="h-full"
          >
            <WizardStep
              title={currentStep.title}
              description={currentStep.description}
              variant={stepVariant}
              showNavigation={!showNavigation}
              showProgress={showProgress && !showNavigation}
              animated={animated}
              stepData={wizard.state.stepData[currentStep.id]}
              wizardData={wizard.state.stepData}
              onDataChange={(data) => wizard.actions.updateStepData(currentStep.id, data)}
              children={
                <StepComponent
                  stepData={wizard.state.stepData[currentStep.id]}
                  wizardData={wizard.state.stepData}
                  onDataChange={(data) => wizard.actions.updateStepData(currentStep.id, data)}
                />
              }
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      {showNavigation && navigationPosition === 'bottom' && (
        <WizardNavigation
          variant={navigationVariant}
          position="bottom"
          showProgress={showProgress}
          animated={animated}
          onCancel={onCancel}
          onComplete={() => onComplete?.(wizard.state.stepData)}
        />
      )}

      {/* Floating navigation */}
      {showNavigation && navigationPosition === 'floating' && (
        <WizardNavigation
          variant={navigationVariant}
          position="floating"
          showProgress={false}
          animated={animated}
          onCancel={onCancel}
          onComplete={() => onComplete?.(wizard.state.stepData)}
          className="fixed bottom-4 right-4 z-50"
        />
      )}
    </div>
  );
}

export function Wizard({
  persistenceKey,
  ...props
}: WizardProps) {
  return (
    <WizardProvider persistenceKey={persistenceKey}>
      <WizardContent {...props} />
    </WizardProvider>
  );
}

// Utility function to create wizard configurations
export function createWizardConfig(
  id: string,
  title: string,
  steps: Omit<WizardStepConfig, 'component'>[] & { component: React.ComponentType<any> }[],
  options?: {
    onComplete?: (data: any) => Promise<void>;
    onCancel?: () => void;
    allowBackNavigation?: boolean;
    persistState?: boolean;
  }
): WizardConfig {
  return {
    id,
    title,
    steps: steps as WizardStepConfig[],
    onComplete: options?.onComplete || (async () => {}),
    onCancel: options?.onCancel,
    allowBackNavigation: options?.allowBackNavigation ?? true,
    persistState: options?.persistState ?? false,
  };
}

// Hook for creating wizard steps with validation
export function useWizardStep<T = any>(
  initialData?: T,
  validation?: (data: T) => boolean | Promise<boolean>
) {
  const [data, setData] = React.useState<T>(initialData || ({} as T));
  const [isValid, setIsValid] = React.useState(false);
  const [isValidating, setIsValidating] = React.useState(false);

  // Validate data when it changes
  React.useEffect(() => {
    if (!validation) {
      setIsValid(true);
      return;
    }

    const validateData = async () => {
      setIsValidating(true);
      try {
        const result = await validation(data);
        setIsValid(result);
      } catch (error) {
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateData();
  }, [data, validation]);

  const updateData = React.useCallback((newData: Partial<T>) => {
    setData(prev => ({ ...prev, ...newData }));
  }, []);

  const resetData = React.useCallback(() => {
    setData(initialData || ({} as T));
  }, [initialData]);

  return {
    data,
    setData,
    updateData,
    resetData,
    isValid,
    isValidating,
  };
}

// Example wizard step components for common patterns
export interface FormStepData {
  [key: string]: any;
}

export function createFormStep(
  fields: Array<{
    name: string;
    label: string;
    type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea';
    required?: boolean;
    options?: Array<{ value: string; label: string }>;
    validation?: (value: any) => boolean | string;
  }>,
  title: string,
  description?: string
) {
  const FormStepComponent: React.FC<{
    stepData?: FormStepData;
    onDataChange?: (data: FormStepData) => void;
  }> = ({ stepData = {}, onDataChange }) => {
    const handleFieldChange = (name: string, value: any) => {
      const newData = { ...stepData, [name]: value };
      onDataChange?.(newData);
    };

    return (
      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.name} className="space-y-2">
            <label className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </label>
            
            {field.type === 'select' ? (
              <select
                value={stepData[field.name] || ''}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                className="w-full p-2 border rounded-md"
                required={field.required}
              >
                <option value="">Select an option</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea
                value={stepData[field.name] || ''}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                className="w-full p-2 border rounded-md"
                rows={4}
                required={field.required}
              />
            ) : (
              <input
                type={field.type}
                value={stepData[field.name] || ''}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                className="w-full p-2 border rounded-md"
                required={field.required}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  return {
    id: title.toLowerCase().replace(/\s+/g, '-'),
    title,
    description,
    component: FormStepComponent,
    validation: (data: FormStepData) => {
      return fields.every((field) => {
        if (field.required && (!data[field.name] || data[field.name] === '')) {
          return false;
        }
        if (field.validation && data[field.name]) {
          const result = field.validation(data[field.name]);
          return result === true;
        }
        return true;
      });
    },
  };
}

export default Wizard;