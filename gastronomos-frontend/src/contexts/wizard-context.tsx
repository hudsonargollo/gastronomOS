/**
 * Wizard Context
 * Provides wizard workflow state management and navigation throughout the app
 */

'use client';

import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';

// Wizard step configuration
export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  component: React.ComponentType<{
    stepData?: any;
    wizardData?: Record<string, any>;
    onDataChange?: (data: any) => void;
  }>;
  validation?: (data: any) => boolean | Promise<boolean>;
  dependencies?: string[];
  isOptional?: boolean;
}

// Wizard configuration
export interface WizardConfig {
  id: string;
  title: string;
  steps: WizardStep[];
  onComplete: (data: any) => Promise<void>;
  onCancel?: () => void;
  allowBackNavigation?: boolean;
  persistState?: boolean;
}

// Wizard state
export interface WizardState {
  currentStep: number;
  totalSteps: number;
  stepData: Record<string, any>;
  isValid: boolean;
  canProceed: boolean;
  canGoBack: boolean;
  progress: number;
  isCompleting: boolean;
  errors: Record<string, string>;
}

// Wizard step props
export interface WizardStepProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  isValid?: boolean;
  onNext?: () => void;
  onPrevious?: () => void;
  onDataChange?: (data: any) => void;
  stepData?: any;
  wizardData?: Record<string, any>;
}

// Wizard context type
interface WizardContextType {
  config: WizardConfig | null;
  state: WizardState;
  actions: {
    startWizard: (config: WizardConfig) => void;
    nextStep: () => Promise<void>;
    previousStep: () => void;
    goToStep: (step: number) => void;
    updateStepData: (stepId: string, data: any) => void;
    setStepValid: (stepId: string, isValid: boolean) => void;
    complete: () => Promise<void>;
    cancel: () => void;
    reset: () => void;
  };
  currentStepConfig: WizardStep | null;
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}

// Initial wizard state
const initialState: WizardState = {
  currentStep: 0,
  totalSteps: 0,
  stepData: {},
  isValid: false,
  canProceed: false,
  canGoBack: false,
  progress: 0,
  isCompleting: false,
  errors: {},
};

interface WizardProviderProps {
  children: React.ReactNode;
  persistenceKey?: string;
}

export function WizardProvider({ children, persistenceKey }: WizardProviderProps) {
  const [config, setConfig] = useState<WizardConfig | null>(null);
  const [state, setState] = useState<WizardState>(initialState);

  // Load persisted state on mount
  useEffect(() => {
    if (persistenceKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(`wizard-${persistenceKey}`);
      if (saved) {
        try {
          const parsedState = JSON.parse(saved);
          setState(prev => ({ ...prev, ...parsedState }));
        } catch (error) {
          console.warn('Failed to load wizard state:', error);
        }
      }
    }
  }, [persistenceKey]);

  // Persist state changes
  useEffect(() => {
    if (persistenceKey && config?.persistState && typeof window !== 'undefined') {
      localStorage.setItem(`wizard-${persistenceKey}`, JSON.stringify({
        stepData: state.stepData,
        currentStep: state.currentStep,
      }));
    }
  }, [state.stepData, state.currentStep, persistenceKey, config?.persistState]);

  const validateCurrentStep = useCallback(async (stepConfig: WizardStep, stepData: any): Promise<boolean> => {
    if (!stepConfig) return false;
    
    try {
      if (stepConfig.validation) {
        const result = await stepConfig.validation(stepData);
        return result;
      }
      
      // Basic validation - step data exists if not optional
      return stepConfig.isOptional || (stepData !== undefined && stepData !== null);
    } catch (error) {
      console.error('Step validation error:', error);
      return false;
    }
  }, []);

  // Calculate derived state
  useEffect(() => {
    if (!config) return;

    const currentStepId = config.steps[state.currentStep]?.id;
    const currentStepData = state.stepData[currentStepId];
    const currentStepConfig = config.steps[state.currentStep];

    const updateDerivedState = async () => {
      const canProceed = await validateCurrentStep(currentStepConfig, currentStepData);
      
      setState(prev => ({
        ...prev,
        totalSteps: config.steps.length,
        progress: ((state.currentStep + 1) / config.steps.length) * 100,
        canGoBack: config.allowBackNavigation !== false && state.currentStep > 0,
        canProceed,
      }));
    };

    updateDerivedState();
  }, [config, state.currentStep, state.stepData, validateCurrentStep]);

  const startWizard = useCallback((newConfig: WizardConfig) => {
    setConfig(newConfig);
    setState({
      ...initialState,
      totalSteps: newConfig.steps.length,
    });
  }, []);

  const nextStep = useCallback(async () => {
    if (!config || state.currentStep >= config.steps.length - 1) return;

    const currentStepConfig = config.steps[state.currentStep];
    const currentStepData = state.stepData[currentStepConfig.id];

    // Validate current step before proceeding
    const isValid = await validateCurrentStep(currentStepConfig, currentStepData);
    if (!isValid) {
      setState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          [currentStepConfig.id]: 'Please complete all required fields before proceeding.',
        },
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      currentStep: prev.currentStep + 1,
      errors: {
        ...prev.errors,
        [currentStepConfig.id]: '',
      },
    }));
  }, [config, state.currentStep, state.stepData, validateCurrentStep]);

  const previousStep = useCallback(() => {
    if (!config || state.currentStep <= 0) return;

    setState(prev => ({
      ...prev,
      currentStep: prev.currentStep - 1,
    }));
  }, [config, state.currentStep]);

  const goToStep = useCallback((step: number) => {
    if (!config || step < 0 || step >= config.steps.length) return;

    setState(prev => ({
      ...prev,
      currentStep: step,
    }));
  }, [config]);

  const updateStepData = useCallback((stepId: string, data: any) => {
    setState(prev => ({
      ...prev,
      stepData: {
        ...prev.stepData,
        [stepId]: data,
      },
    }));
  }, []);

  const setStepValid = useCallback((stepId: string, isValid: boolean) => {
    setState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [stepId]: isValid ? '' : prev.errors[stepId] || 'Invalid step data',
      },
    }));
  }, []);

  const complete = useCallback(async () => {
    if (!config) return;

    setState(prev => ({ ...prev, isCompleting: true }));

    try {
      await config.onComplete(state.stepData);
      
      // Clear persisted state on successful completion
      if (persistenceKey && typeof window !== 'undefined') {
        localStorage.removeItem(`wizard-${persistenceKey}`);
      }
      
      reset();
    } catch (error) {
      console.error('Wizard completion error:', error);
      setState(prev => ({
        ...prev,
        isCompleting: false,
        errors: {
          ...prev.errors,
          completion: 'Failed to complete wizard. Please try again.',
        },
      }));
    }
  }, [config, state.stepData, persistenceKey]);

  const cancel = useCallback(() => {
    if (config?.onCancel) {
      config.onCancel();
    }
    reset();
  }, [config]);

  const reset = useCallback(() => {
    setConfig(null);
    setState(initialState);
    
    // Clear persisted state
    if (persistenceKey && typeof window !== 'undefined') {
      localStorage.removeItem(`wizard-${persistenceKey}`);
    }
  }, [persistenceKey]);

  const currentStepConfig = config?.steps[state.currentStep] || null;

  const contextValue: WizardContextType = {
    config,
    state,
    actions: {
      startWizard,
      nextStep,
      previousStep,
      goToStep,
      updateStepData,
      setStepValid,
      complete,
      cancel,
      reset,
    },
    currentStepConfig,
  };

  return (
    <WizardContext.Provider value={contextValue}>
      {children}
    </WizardContext.Provider>
  );
}

// Hook for accessing wizard state
export function useWizardState() {
  const { state } = useWizard();
  return state;
}

// Hook for accessing wizard actions
export function useWizardActions() {
  const { actions } = useWizard();
  return actions;
}

// Hook for accessing current step
export function useCurrentStep() {
  const { currentStepConfig, state } = useWizard();
  return {
    step: currentStepConfig,
    stepNumber: state.currentStep,
    stepData: currentStepConfig ? state.stepData[currentStepConfig.id] : undefined,
  };
}

// Hook for wizard navigation
export function useWizardNavigation() {
  const { state, actions } = useWizard();
  return {
    canGoNext: state.canProceed && !state.isCompleting,
    canGoBack: state.canGoBack && !state.isCompleting,
    isLastStep: state.currentStep === state.totalSteps - 1,
    isFirstStep: state.currentStep === 0,
    nextStep: actions.nextStep,
    previousStep: actions.previousStep,
    complete: actions.complete,
    cancel: actions.cancel,
  };
}