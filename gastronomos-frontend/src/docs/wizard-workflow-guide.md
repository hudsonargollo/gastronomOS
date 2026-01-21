# Wizard Workflow Implementation Guide

The Wizard Workflow system provides a comprehensive solution for creating multi-step guided interfaces that break complex operations into manageable steps. This guide covers implementation patterns, best practices, and advanced features.

## Overview

The wizard system consists of several key components:
- **WizardProvider**: Context provider for wizard state management
- **Wizard**: Main wizard container component
- **WizardStep**: Individual step component with navigation controls
- **WizardNavigation**: Navigation controls with step validation
- **ProgressIndicator**: Visual progress tracking with animations

## Quick Start

### 1. Basic Wizard Setup

```tsx
import { Wizard, createWizardConfig } from '@/components/ui/wizard';

const wizardConfig = createWizardConfig(
  'my-wizard',
  'My Wizard Title',
  [
    {
      id: 'step1',
      title: 'First Step',
      description: 'Complete the first step',
      component: FirstStepComponent,
      validation: (data) => !!data.requiredField,
    },
    {
      id: 'step2',
      title: 'Second Step',
      description: 'Complete the second step',
      component: SecondStepComponent,
      validation: (data) => data.items?.length > 0,
    },
  ],
  {
    onComplete: async (data) => {
      console.log('Wizard completed:', data);
    },
    onCancel: () => {
      console.log('Wizard cancelled');
    },
  }
);

function MyWizard() {
  return (
    <Wizard
      config={wizardConfig}
      showProgress={true}
      showNavigation={true}
      animated={true}
    />
  );
}
```

### 2. Step Component Implementation

```tsx
interface StepProps {
  stepData?: any;
  onDataChange?: (data: any) => void;
  wizardData?: any;
}

const FirstStepComponent: React.FC<StepProps> = ({ 
  stepData = {}, 
  onDataChange,
  wizardData 
}) => {
  const handleInputChange = (field: string, value: any) => {
    onDataChange?.({ ...stepData, [field]: value });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Step Title</h3>
      <Input
        value={stepData.requiredField || ''}
        onChange={(e) => handleInputChange('requiredField', e.target.value)}
        placeholder="Enter required information"
      />
    </div>
  );
};
```

## Core Components

### WizardProvider

Provides wizard state management and context throughout the wizard lifecycle.

```tsx
import { WizardProvider, useWizardContext } from '@/contexts/wizard-context';

function App() {
  return (
    <WizardProvider>
      <MyWizardComponent />
    </WizardProvider>
  );
}

function MyWizardComponent() {
  const { state, actions } = useWizardContext();
  
  return (
    <div>
      <p>Current Step: {state.currentStep + 1} of {state.totalSteps}</p>
      <p>Progress: {Math.round(state.progress * 100)}%</p>
    </div>
  );
}
```

### Wizard Configuration

Create comprehensive wizard configurations with validation and dependencies:

```tsx
const advancedWizardConfig = createWizardConfig(
  'advanced-wizard',
  'Advanced Wizard',
  [
    {
      id: 'welcome',
      title: 'Welcome',
      description: 'Get started',
      component: WelcomeStep,
      validation: (data) => data?.acknowledged === true,
      skipCondition: (wizardData) => wizardData.skipWelcome,
    },
    {
      id: 'details',
      title: 'Details',
      description: 'Enter details',
      component: DetailsStep,
      validation: async (data) => {
        // Async validation example
        return await validateDetails(data);
      },
      dependencies: ['welcome'],
    },
    {
      id: 'review',
      title: 'Review',
      description: 'Review and confirm',
      component: ReviewStep,
      validation: () => true,
      dependencies: ['welcome', 'details'],
    },
  ],
  {
    onComplete: async (data) => {
      await submitWizardData(data);
    },
    onCancel: () => {
      // Handle cancellation
    },
    allowBackNavigation: true,
    persistState: true,
    persistenceKey: 'advanced-wizard-state',
    autoSave: true,
    autoSaveInterval: 30000, // 30 seconds
  }
);
```

### Step Validation

Implement comprehensive step validation with real-time feedback:

```tsx
const StepWithValidation: React.FC<StepProps> = ({ 
  stepData = {}, 
  onDataChange 
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState(false);

  const validateField = async (field: string, value: any) => {
    setIsValidating(true);
    
    try {
      // Perform validation
      const error = await validateFieldValue(field, value);
      setErrors(prev => ({ ...prev, [field]: error }));
    } finally {
      setIsValidating(false);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    const newData = { ...stepData, [field]: value };
    onDataChange?.(newData);
    
    // Debounced validation
    debounce(() => validateField(field, value), 300)();
  };

  return (
    <div className="space-y-4">
      <div>
        <Input
          value={stepData.email || ''}
          onChange={(e) => handleFieldChange('email', e.target.value)}
          placeholder="Enter email"
          className={errors.email ? 'border-red-500' : ''}
        />
        {errors.email && (
          <p className="text-sm text-red-500 mt-1">{errors.email}</p>
        )}
        {isValidating && (
          <p className="text-sm text-gray-500 mt-1">Validating...</p>
        )}
      </div>
    </div>
  );
};
```

## Advanced Features

### Conditional Steps

Implement dynamic step flow based on user input:

```tsx
const conditionalWizardConfig = createWizardConfig(
  'conditional-wizard',
  'Conditional Wizard',
  [
    {
      id: 'type-selection',
      title: 'Select Type',
      component: TypeSelectionStep,
      validation: (data) => !!data.type,
    },
    {
      id: 'individual-details',
      title: 'Individual Details',
      component: IndividualDetailsStep,
      validation: (data) => !!data.name,
      skipCondition: (wizardData) => wizardData['type-selection']?.type !== 'individual',
    },
    {
      id: 'business-details',
      title: 'Business Details',
      component: BusinessDetailsStep,
      validation: (data) => !!data.businessName,
      skipCondition: (wizardData) => wizardData['type-selection']?.type !== 'business',
    },
  ],
  // ... config options
);
```

### Step Dependencies

Define complex step dependencies and prerequisites:

```tsx
const dependentWizardConfig = createWizardConfig(
  'dependent-wizard',
  'Dependent Steps Wizard',
  [
    {
      id: 'prerequisites',
      title: 'Prerequisites',
      component: PrerequisitesStep,
      validation: (data) => data.hasPrerequisites,
    },
    {
      id: 'advanced-config',
      title: 'Advanced Configuration',
      component: AdvancedConfigStep,
      validation: (data) => !!data.config,
      dependencies: ['prerequisites'],
      dependencyValidation: (wizardData) => {
        return wizardData.prerequisites?.hasPrerequisites === true;
      },
    },
  ],
  // ... config options
);
```

### Custom Navigation

Implement custom navigation patterns:

```tsx
function CustomWizardNavigation() {
  const { state, actions } = useWizardContext();
  
  return (
    <div className="flex justify-between items-center p-4 border-t">
      <Button
        variant="outline"
        onClick={actions.previousStep}
        disabled={!state.canGoBack}
      >
        Previous
      </Button>
      
      <div className="flex space-x-2">
        {Array.from({ length: state.totalSteps }, (_, index) => (
          <button
            key={index}
            onClick={() => actions.goToStep(index)}
            className={`w-3 h-3 rounded-full ${
              index === state.currentStep
                ? 'bg-primary'
                : index < state.currentStep
                ? 'bg-primary/50'
                : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
      
      <Button
        onClick={state.currentStep === state.totalSteps - 1 ? actions.complete : actions.nextStep}
        disabled={!state.canProceed}
      >
        {state.currentStep === state.totalSteps - 1 ? 'Complete' : 'Next'}
      </Button>
    </div>
  );
}
```

## Built-in Wizard Templates

### Purchase Order Wizard

```tsx
import { PurchaseOrderWizard } from '@/components/wizards/purchase-order-wizard';

function CreatePurchaseOrder() {
  return (
    <PurchaseOrderWizard
      onComplete={async (orderData) => {
        await createPurchaseOrder(orderData);
      }}
      onCancel={() => {
        // Handle cancellation
      }}
      suppliers={availableSuppliers}
      products={availableProducts}
    />
  );
}
```

### Inventory Transfer Wizard

```tsx
import { InventoryTransferWizard } from '@/components/wizards/inventory-transfer-wizard';

function CreateTransfer() {
  return (
    <InventoryTransferWizard
      onComplete={async (transferData) => {
        await createInventoryTransfer(transferData);
      }}
      locations={availableLocations}
      inventory={currentInventory}
    />
  );
}
```

### Allocation Rules Wizard

```tsx
import { AllocationRulesWizard } from '@/components/wizards/allocation-rules-wizard';

function CreateAllocationRules() {
  return (
    <AllocationRulesWizard
      onComplete={async (rulesData) => {
        await createAllocationRules(rulesData);
      }}
      locations={locations}
      products={products}
    />
  );
}
```

### Receipt Processing Wizard

```tsx
import { ReceiptProcessingWizard } from '@/components/wizards/receipt-processing-wizard';

function ProcessReceipt() {
  return (
    <ReceiptProcessingWizard
      onComplete={async (receiptData) => {
        await processReceipt(receiptData);
      }}
      purchaseOrders={pendingOrders}
    />
  );
}
```

## Best Practices

### 1. Step Design

- **Keep steps focused**: Each step should have a single, clear purpose
- **Provide clear instructions**: Use descriptive titles and helpful descriptions
- **Show progress**: Always indicate current position and remaining steps
- **Enable navigation**: Allow users to go back and review previous steps

### 2. Validation Strategy

- **Real-time validation**: Provide immediate feedback on user input
- **Step-level validation**: Prevent progression until step requirements are met
- **Cross-step validation**: Validate dependencies between steps
- **Async validation**: Handle server-side validation gracefully

### 3. Data Management

- **Immutable updates**: Always create new objects when updating step data
- **Persistence**: Save wizard state to prevent data loss
- **Auto-save**: Implement periodic auto-save for long wizards
- **Data normalization**: Structure data consistently across steps

### 4. User Experience

- **Clear navigation**: Provide obvious next/previous controls
- **Progress indication**: Show completion percentage and remaining steps
- **Error handling**: Display clear error messages with recovery options
- **Responsive design**: Ensure wizards work well on all screen sizes

### 5. Performance

- **Lazy loading**: Load step components only when needed
- **Debounced validation**: Avoid excessive validation calls
- **Optimistic updates**: Update UI immediately, sync with server later
- **Memory cleanup**: Clean up resources when wizard is closed

## Error Handling

### Validation Errors

```tsx
const StepWithErrorHandling: React.FC<StepProps> = ({ stepData, onDataChange }) => {
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  const validateStep = async (data: any) => {
    try {
      const errors = await validateStepData(data);
      setValidationErrors(errors);
      return errors.length === 0;
    } catch (error) {
      setValidationErrors(['Validation failed. Please try again.']);
      return false;
    }
  };

  return (
    <div className="space-y-4">
      {validationErrors.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <h4 className="font-medium text-red-800">Please fix the following errors:</h4>
          <ul className="mt-2 text-sm text-red-700">
            {validationErrors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Step content */}
    </div>
  );
};
```

### Network Errors

```tsx
const NetworkAwareStep: React.FC<StepProps> = ({ stepData, onDataChange }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingChanges, setPendingChanges] = useState<any[]>([]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Sync pending changes
      syncPendingChanges();
    };
    
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncPendingChanges = async () => {
    for (const change of pendingChanges) {
      try {
        await syncChange(change);
      } catch (error) {
        console.error('Failed to sync change:', error);
      }
    }
    setPendingChanges([]);
  };

  return (
    <div className="space-y-4">
      {!isOnline && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-yellow-800">
            You're currently offline. Changes will be saved locally and synced when connection is restored.
          </p>
        </div>
      )}
      
      {/* Step content */}
    </div>
  );
};
```

## Testing Wizards

### Unit Testing Steps

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { WizardProvider } from '@/contexts/wizard-context';
import { MyWizardStep } from './MyWizardStep';

describe('MyWizardStep', () => {
  const mockOnDataChange = jest.fn();
  
  const renderStep = (stepData = {}) => {
    return render(
      <WizardProvider>
        <MyWizardStep
          stepData={stepData}
          onDataChange={mockOnDataChange}
        />
      </WizardProvider>
    );
  };

  it('should render step content', () => {
    renderStep();
    expect(screen.getByText('Step Title')).toBeInTheDocument();
  });

  it('should call onDataChange when input changes', () => {
    renderStep();
    const input = screen.getByPlaceholderText('Enter required information');
    fireEvent.change(input, { target: { value: 'test value' } });
    
    expect(mockOnDataChange).toHaveBeenCalledWith({
      requiredField: 'test value'
    });
  });

  it('should validate step data correctly', async () => {
    const { rerender } = renderStep({ requiredField: '' });
    
    // Should be invalid with empty field
    expect(screen.getByText('This field is required')).toBeInTheDocument();
    
    // Should be valid with filled field
    rerender(
      <WizardProvider>
        <MyWizardStep
          stepData={{ requiredField: 'valid value' }}
          onDataChange={mockOnDataChange}
        />
      </WizardProvider>
    );
    
    expect(screen.queryByText('This field is required')).not.toBeInTheDocument();
  });
});
```

### Integration Testing

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Wizard } from '@/components/ui/wizard';
import { testWizardConfig } from './test-config';

describe('Wizard Integration', () => {
  it('should complete full wizard flow', async () => {
    const mockOnComplete = jest.fn();
    const config = {
      ...testWizardConfig,
      onComplete: mockOnComplete,
    };

    render(<Wizard config={config} />);

    // Step 1
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Enter name'), {
      target: { value: 'Test Name' }
    });
    fireEvent.click(screen.getByText('Next'));

    // Step 2
    await waitFor(() => {
      expect(screen.getByText('Step 2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Option A'));
    fireEvent.click(screen.getByText('Next'));

    // Final step
    await waitFor(() => {
      expect(screen.getByText('Review')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Complete'));

    // Verify completion
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith({
        'step1': { name: 'Test Name' },
        'step2': { option: 'A' }
      });
    });
  });
});
```

## Accessibility

### Keyboard Navigation

```tsx
const AccessibleWizardStep: React.FC<StepProps> = ({ stepData, onDataChange }) => {
  const stepRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus management when step becomes active
    stepRef.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && event.ctrlKey) {
      // Ctrl+Enter to proceed to next step
      event.preventDefault();
      // Trigger next step logic
    }
  };

  return (
    <div
      ref={stepRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="focus:outline-none"
      role="tabpanel"
      aria-labelledby="step-title"
    >
      <h3 id="step-title" className="text-lg font-semibold">
        Step Title
      </h3>
      
      {/* Step content with proper ARIA labels */}
      <div className="space-y-4" role="group" aria-labelledby="step-title">
        <Input
          aria-label="Required field"
          aria-required="true"
          aria-describedby="field-help"
          value={stepData.requiredField || ''}
          onChange={(e) => onDataChange?.({ ...stepData, requiredField: e.target.value })}
        />
        <div id="field-help" className="text-sm text-gray-600">
          This field is required to proceed
        </div>
      </div>
    </div>
  );
};
```

### Screen Reader Support

```tsx
const ScreenReaderFriendlyWizard: React.FC = () => {
  const { state } = useWizardContext();

  return (
    <div role="application" aria-label="Multi-step wizard">
      <div
        role="progressbar"
        aria-valuenow={state.currentStep + 1}
        aria-valuemin={1}
        aria-valuemax={state.totalSteps}
        aria-label={`Step ${state.currentStep + 1} of ${state.totalSteps}`}
      >
        <span className="sr-only">
          Progress: {Math.round(state.progress * 100)}% complete
        </span>
      </div>
      
      <div role="tablist" aria-label="Wizard steps">
        {/* Step navigation */}
      </div>
      
      <main role="main" aria-live="polite">
        {/* Current step content */}
      </main>
    </div>
  );
};
```

## Conclusion

The Wizard Workflow system provides a powerful foundation for creating guided user experiences in the Gastronomos application. By following these patterns and best practices, you can create intuitive, accessible, and maintainable wizard interfaces that guide users through complex operations with confidence.

Key benefits:
- **Reduced cognitive load**: Break complex tasks into manageable steps
- **Improved completion rates**: Guide users through the entire process
- **Better data quality**: Validate input at each step
- **Enhanced accessibility**: Support keyboard navigation and screen readers
- **Consistent experience**: Unified patterns across all wizards

For more examples and advanced patterns, refer to the wizard demo components and the built-in wizard templates in the codebase.