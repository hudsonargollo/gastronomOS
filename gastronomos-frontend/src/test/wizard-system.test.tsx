/**
 * Wizard System Tests
 * Tests for the wizard workflow infrastructure
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { WizardProvider } from '@/contexts/wizard-context';
import { createWizardConfig } from '@/components/ui/wizard';

// Mock components for testing
const TestStep1: React.FC<{
  stepData?: any;
  onDataChange?: (data: any) => void;
}> = ({ stepData = {}, onDataChange }) => {
  return (
    <div>
      <h3>Step One</h3>
      <input
        data-testid="step1-input"
        value={stepData.value || ''}
        onChange={(e) => onDataChange?.({ value: e.target.value })}
      />
    </div>
  );
};

const TestStep2: React.FC<{
  stepData?: any;
  onDataChange?: (data: any) => void;
}> = ({ stepData = {}, onDataChange }) => {
  return (
    <div>
      <h3>Step Two</h3>
      <input
        data-testid="step2-input"
        value={stepData.value || ''}
        onChange={(e) => onDataChange?.({ value: e.target.value })}
      />
    </div>
  );
};

describe('Wizard System', () => {
  let mockOnComplete: ReturnType<typeof vi.fn>;
  let mockOnCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnComplete = vi.fn();
    mockOnCancel = vi.fn();
  });

  it('should create wizard config correctly', () => {
    const config = createWizardConfig(
      'test-wizard',
      'Test Wizard',
      [
        {
          id: 'step1',
          title: 'Step 1',
          component: TestStep1,
          validation: (data) => !!data?.value,
        },
        {
          id: 'step2',
          title: 'Step 2',
          component: TestStep2,
          validation: (data) => !!data?.value,
        },
      ],
      {
        onComplete: mockOnComplete,
        onCancel: mockOnCancel,
      }
    );

    expect(config.id).toBe('test-wizard');
    expect(config.title).toBe('Test Wizard');
    expect(config.steps).toHaveLength(2);
    expect(config.onComplete).toBe(mockOnComplete);
    expect(config.onCancel).toBe(mockOnCancel);
  });

  it('should validate wizard step data correctly', () => {
    const config = createWizardConfig(
      'test-wizard',
      'Test Wizard',
      [
        {
          id: 'step1',
          title: 'Step 1',
          component: TestStep1,
          validation: (data) => data?.value?.length > 3,
        },
      ]
    );

    const step = config.steps[0];
    
    // Test validation function
    expect(step.validation?.({ value: 'hi' })).toBe(false);
    expect(step.validation?.({ value: 'hello' })).toBe(true);
  });

  it('should handle async validation correctly', async () => {
    const asyncValidation = async (data: any) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return data?.value === 'valid';
    };

    const config = createWizardConfig(
      'test-wizard',
      'Test Wizard',
      [
        {
          id: 'step1',
          title: 'Step 1',
          component: TestStep1,
          validation: asyncValidation,
        },
      ]
    );

    const step = config.steps[0];
    
    // Test async validation
    await expect(step.validation?.({ value: 'invalid' })).resolves.toBe(false);
    await expect(step.validation?.({ value: 'valid' })).resolves.toBe(true);
  });

  it('should handle optional steps correctly', () => {
    const config = createWizardConfig(
      'test-wizard',
      'Test Wizard',
      [
        {
          id: 'step1',
          title: 'Step 1',
          component: TestStep1,
          isOptional: true,
        },
        {
          id: 'step2',
          title: 'Step 2',
          component: TestStep2,
          isOptional: false,
        },
      ]
    );

    expect(config.steps[0].isOptional).toBe(true);
    expect(config.steps[1].isOptional).toBe(false);
  });
});

// Integration test for wizard context
describe('WizardProvider', () => {
  it('should provide wizard context correctly', () => {
    const TestComponent = () => {
      return (
        <WizardProvider>
          <div data-testid="wizard-provider">Wizard Provider Test</div>
        </WizardProvider>
      );
    };

    render(<TestComponent />);
    expect(screen.getByTestId('wizard-provider')).toBeInTheDocument();
  });
});