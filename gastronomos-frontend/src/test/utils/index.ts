/**
 * Test Utilities Index
 * Central export for all testing utilities
 */

// Property-based testing utilities
export * from './property-test-utils';
export { default as propertyTestUtils } from './property-test-utils';
import { 
  arbitraries, 
  propertyTestConfig, 
  propertyHelpers, 
  animationPropertyHelpers, 
  formPropertyHelpers, 
  crudPropertyHelpers 
} from './property-test-utils';

// Animation testing utilities
export * from './animation-test-utils';
export { default as animationTestUtils } from './animation-test-utils';
import animationTestUtilsDefault from './animation-test-utils';

// Accessibility testing utilities
export * from './accessibility-test-utils';
export { default as accessibilityTestUtils } from './accessibility-test-utils';
import accessibilityTestUtilsDefault from './accessibility-test-utils';

// Visual regression testing utilities
export * from './visual-regression-utils';
export { default as visualRegressionUtils } from './visual-regression-utils';
import visualRegressionUtilsDefault from './visual-regression-utils';

// Re-export common testing libraries for convenience
export { render, screen, waitFor, fireEvent } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
export { vi, expect, describe, it, test, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
export { default as fc } from 'fast-check';

// Common test configurations
export const testConfig = {
  // Global test timeouts
  timeouts: {
    default: 5000,
    animation: 1000,
    network: 10000,
    integration: 15000,
  },
  
  // Test data generators
  generators: {
    id: () => Math.random().toString(36).substr(2, 9),
    timestamp: () => new Date().toISOString(),
    email: () => `test${Math.random().toString(36).substr(2, 5)}@example.com`,
    name: () => `Test User ${Math.random().toString(36).substr(2, 5)}`,
  },
  
  // Mock data
  mockData: {
    user: {
      id: 'test-user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
    },
    
    product: {
      id: 'test-product-1',
      name: 'Test Product',
      description: 'A test product',
      price: 10.99,
      category: 'test-category',
    },
    
    location: {
      id: 'test-location-1',
      name: 'Test Location',
      address: '123 Test St',
      city: 'Test City',
      state: 'TS',
      zipCode: '12345',
    },
  },
};

// Common test helpers
export const testHelpers = {
  // Wait for a specific condition
  waitForCondition: async (
    condition: () => boolean | Promise<boolean>,
    timeout: number = testConfig.timeouts.default,
    interval: number = 100
  ): Promise<void> => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  },
  
  // Create a mock function with specific behavior
  createMockFunction: <T extends (...args: any[]) => any>(
    implementation?: T,
    returnValue?: ReturnType<T>
  ) => {
    // Mock function for build compatibility
    const mock = (() => {}) as any;
    mock.mockImplementation = () => mock;
    mock.mockReturnValue = () => mock;
    
    if (implementation) {
      return implementation as T & any;
    } else if (returnValue !== undefined) {
      return (() => returnValue) as T & any;
    }
    return mock as T & any;
  },
  
  // Create a mock promise that resolves after a delay
  createDelayedPromise: <T>(value: T, delay: number = 100): Promise<T> => {
    return new Promise(resolve => setTimeout(() => resolve(value), delay));
  },
  
  // Create a mock promise that rejects after a delay
  createDelayedRejection: (error: Error, delay: number = 100): Promise<never> => {
    return new Promise((_, reject) => setTimeout(() => reject(error), delay));
  },
  
  // Generate random test data
  generateTestData: <T>(template: T, overrides: Partial<T> = {}): T => {
    return { ...template, ...overrides };
  },
  
  // Clean up DOM after tests
  cleanupDOM: () => {
    document.body.innerHTML = '';
    document.head.querySelectorAll('style[data-test]').forEach(el => el.remove());
  },
  
  // Mock console methods
  mockConsole: () => {
    const originalConsole = { ...console };
    const mocks = {
      log: (() => {}) as any,
      warn: (() => {}) as any,
      error: (() => {}) as any,
      info: (() => {}) as any,
      debug: (() => {}) as any,
    };
    
    Object.assign(console, mocks);
    
    return {
      mocks,
      restore: () => Object.assign(console, originalConsole),
    };
  },
  
  // Mock local storage
  mockLocalStorage: () => {
    const storage = new Map<string, string>();
    
    const mockStorage = {
      getItem: ((key: string) => storage.get(key) || null) as any,
      setItem: ((key: string, value: string) => storage.set(key, value)) as any,
      removeItem: ((key: string) => storage.delete(key)) as any,
      clear: (() => storage.clear()) as any,
      length: 0,
      key: ((index: number) => Array.from(storage.keys())[index] || null) as any,
    };
    
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
    });
    
    return mockStorage;
  },
  
  // Mock session storage
  mockSessionStorage: () => {
    const storage = new Map<string, string>();
    
    const mockStorage = {
      getItem: ((key: string) => storage.get(key) || null) as any,
      setItem: ((key: string, value: string) => storage.set(key, value)) as any,
      removeItem: ((key: string) => storage.delete(key)) as any,
      clear: (() => storage.clear()) as any,
      length: 0,
      key: ((index: number) => Array.from(storage.keys())[index] || null) as any,
    };
    
    Object.defineProperty(window, 'sessionStorage', {
      value: mockStorage,
      writable: true,
    });
    
    return mockStorage;
  },
};

// Test suite helpers
export const testSuiteHelpers = {
  // Create a test suite for a component
  createComponentTestSuite: (
    componentName: string,
    component: React.ComponentType<any>,
    tests: {
      unit?: boolean;
      accessibility?: boolean;
      visual?: boolean;
      performance?: boolean;
      properties?: boolean;
    } = {}
  ) => {
    return {
      componentName,
      component,
      tests,
      
      // Generate test descriptions
      getTestDescriptions: () => {
        const descriptions = [`${componentName} Component Tests`];
        
        if (tests.unit) descriptions.push('Unit Tests');
        if (tests.accessibility) descriptions.push('Accessibility Tests');
        if (tests.visual) descriptions.push('Visual Regression Tests');
        if (tests.performance) descriptions.push('Performance Tests');
        if (tests.properties) descriptions.push('Property-Based Tests');
        
        return descriptions;
      },
    };
  },
  
  // Create a test suite for a feature
  createFeatureTestSuite: (
    featureName: string,
    components: React.ComponentType<any>[],
    workflows: Array<{ name: string; steps: string[] }>
  ) => {
    return {
      featureName,
      components,
      workflows,
      
      // Generate integration test scenarios
      getIntegrationScenarios: () => {
        return workflows.map(workflow => ({
          name: `${featureName} - ${workflow.name}`,
          steps: workflow.steps,
        }));
      },
    };
  },
};

// Export everything as default for convenience
const defaultExport = {
  testConfig,
  testHelpers,
  testSuiteHelpers,
  propertyTestUtils: {
    arbitraries,
    propertyTestConfig,
    propertyHelpers,
    animationPropertyHelpers,
    formPropertyHelpers,
    crudPropertyHelpers,
  },
  animationTestUtils: animationTestUtilsDefault,
  accessibilityTestUtils: accessibilityTestUtilsDefault,
  visualRegressionUtils: visualRegressionUtilsDefault,
};

export default defaultExport;