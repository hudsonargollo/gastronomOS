/**
 * Property-Based Testing Utilities
 * Utilities for fast-check property-based testing
 */

import fc from 'fast-check';

// Common arbitraries for UI testing
export const arbitraries = {
  // Basic data types
  nonEmptyString: fc.string({ minLength: 1, maxLength: 100 }),
  shortString: fc.string({ minLength: 1, maxLength: 50 }), // Fixed: ensure minimum length of 1
  longString: fc.string({ minLength: 100, maxLength: 1000 }),
  positiveInteger: fc.integer({ min: 1, max: 1000 }),
  percentage: fc.float({ min: 0, max: 100 }),
  
  // UI-specific arbitraries
  cssColor: fc.oneof(
    fc.string({ minLength: 6, maxLength: 6 }).map(hex => `#${hex}`),
    fc.constantFrom('red', 'blue', 'green', 'yellow', 'purple', 'orange', 'black', 'white')
  ),
  
  screenSize: fc.record({
    width: fc.integer({ min: 320, max: 1920 }),
    height: fc.integer({ min: 240, max: 1080 }),
  }),
  
  animationDuration: fc.float({ min: Math.fround(0.1), max: Math.fround(2.0) }),
  
  // Form data arbitraries
  formField: fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }),
    value: fc.string({ maxLength: 200 }),
    type: fc.constantFrom('text', 'email', 'password', 'number', 'tel'),
    required: fc.boolean(),
  }),
  
  // Wizard step data
  wizardStep: fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    title: fc.string({ minLength: 1, maxLength: 100 }),
    isValid: fc.boolean(),
    data: fc.dictionary(fc.string(), fc.anything()),
  }),
  
  // CRUD operation data
  crudItem: fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.string({ maxLength: 500 }),
    createdAt: fc.date(),
    updatedAt: fc.date(),
  }),
  
  // Animation properties
  animationVariant: fc.record({
    opacity: fc.float({ min: 0, max: 1 }),
    scale: fc.float({ min: 0.5, max: 1.5 }),
    x: fc.integer({ min: -100, max: 100 }),
    y: fc.integer({ min: -100, max: 100 }),
  }),
  
  // Performance metrics
  performanceMetrics: fc.record({
    fps: fc.float({ min: 0, max: 120 }),
    frameDrops: fc.integer({ min: 0, max: 100 }),
    memoryUsage: fc.integer({ min: 1024 * 1024, max: 1024 * 1024 * 100 }), // 1MB to 100MB
    renderTime: fc.float({ min: 0, max: 100 }),
  }),
};

// Property test configuration
export const propertyTestConfig = {
  numRuns: 100,
  timeout: 5000,
  verbose: false,
  seed: 42,
  path: '',
  endOnFailure: false,
};

// Helper functions for property testing
export const propertyHelpers = {
  // Test that a function is pure (same input -> same output)
  testPurity: <T, R>(fn: (input: T) => R, arbitrary: fc.Arbitrary<T>) => {
    return fc.property(arbitrary, (input) => {
      const result1 = fn(input);
      const result2 = fn(input);
      return JSON.stringify(result1) === JSON.stringify(result2);
    });
  },
  
  // Test that a function preserves invariants
  testInvariant: <T>(
    fn: (input: T) => T,
    invariant: (input: T) => boolean,
    arbitrary: fc.Arbitrary<T>
  ) => {
    return fc.property(arbitrary, (input) => {
      fc.pre(invariant(input)); // Precondition
      const result = fn(input);
      return invariant(result); // Postcondition
    });
  },
  
  // Test round-trip properties (encode/decode, serialize/deserialize)
  testRoundTrip: <T, U>(
    encode: (input: T) => U,
    decode: (encoded: U) => T,
    arbitrary: fc.Arbitrary<T>,
    equals: (a: T, b: T) => boolean = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  ) => {
    return fc.property(arbitrary, (input) => {
      const encoded = encode(input);
      const decoded = decode(encoded);
      return equals(input, decoded);
    });
  },
  
  // Test that operations are idempotent
  testIdempotence: <T>(
    fn: (input: T) => T,
    arbitrary: fc.Arbitrary<T>,
    equals: (a: T, b: T) => boolean = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  ) => {
    return fc.property(arbitrary, (input) => {
      const result1 = fn(input);
      const result2 = fn(result1);
      return equals(result1, result2);
    });
  },
  
  // Test metamorphic properties (relationships between inputs/outputs)
  testMetamorphic: <T, R>(
    fn: (input: T) => R,
    relation: (input1: T, input2: T, output1: R, output2: R) => boolean,
    arbitrary: fc.Arbitrary<T>
  ) => {
    return fc.property(arbitrary, arbitrary, (input1, input2) => {
      const output1 = fn(input1);
      const output2 = fn(input2);
      return relation(input1, input2, output1, output2);
    });
  },
};

// Animation-specific property test helpers
export const animationPropertyHelpers = {
  // Test that animations complete within expected time
  testAnimationDuration: (
    animationFn: (duration: number) => Promise<void>,
    tolerance: number = 50 // ms tolerance
  ) => {
    return fc.property(arbitraries.animationDuration, async (duration) => {
      const startTime = performance.now();
      await animationFn(duration * 1000); // Convert to ms
      const actualDuration = performance.now() - startTime;
      const expectedDuration = duration * 1000;
      
      return Math.abs(actualDuration - expectedDuration) <= tolerance;
    });
  },
  
  // Test that animations maintain frame rate
  testFrameRate: (
    animationFn: () => Promise<number[]>, // Returns array of frame times
    minFps: number = 30
  ) => {
    return fc.property(fc.constant(null), async () => {
      const frameTimes = await animationFn();
      if (frameTimes.length < 2) return true;
      
      const intervals = frameTimes.slice(1).map((time, i) => time - frameTimes[i]);
      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      const fps = 1000 / avgInterval;
      
      return fps >= minFps;
    });
  },
};

// Form validation property helpers
export const formPropertyHelpers = {
  // Test that validation is consistent
  testValidationConsistency: (
    validator: (value: any) => boolean,
    arbitrary: fc.Arbitrary<any>
  ) => {
    return fc.property(arbitrary, (value) => {
      const result1 = validator(value);
      const result2 = validator(value);
      return result1 === result2;
    });
  },
  
  // Test that validation errors are helpful
  testValidationMessages: (
    validator: (value: any) => { isValid: boolean; message?: string },
    arbitrary: fc.Arbitrary<any>
  ) => {
    return fc.property(arbitrary, (value) => {
      const result = validator(value);
      if (!result.isValid) {
        return typeof result.message === 'string' && result.message.length > 0;
      }
      return true;
    });
  },
};

// CRUD operation property helpers
export const crudPropertyHelpers = {
  // Test that create operations increase collection size
  testCreateIncreasesSize: <T>(
    createFn: (item: Omit<T, 'id'>) => Promise<T>,
    listFn: () => Promise<T[]>,
    arbitrary: fc.Arbitrary<Omit<T, 'id'>>
  ) => {
    return fc.property(arbitrary, async (item) => {
      const initialList = await listFn();
      const initialSize = initialList.length;
      
      await createFn(item);
      
      const finalList = await listFn();
      const finalSize = finalList.length;
      
      return finalSize === initialSize + 1;
    });
  },
  
  // Test that update operations preserve other items
  testUpdatePreservesOthers: <T extends { id: string }>(
    updateFn: (id: string, updates: Partial<T>) => Promise<T>,
    listFn: () => Promise<T[]>,
    arbitrary: fc.Arbitrary<{ id: string; updates: Partial<T> }>
  ) => {
    return fc.property(arbitrary, async ({ id, updates }) => {
      const initialList = await listFn();
      const otherItems = initialList.filter(item => item.id !== id);
      
      await updateFn(id, updates);
      
      const finalList = await listFn();
      const finalOtherItems = finalList.filter(item => item.id !== id);
      
      return JSON.stringify(otherItems) === JSON.stringify(finalOtherItems);
    });
  },
  
  // Test that delete operations decrease collection size
  testDeleteDecreasesSize: <T extends { id: string }>(
    deleteFn: (id: string) => Promise<void>,
    listFn: () => Promise<T[]>,
    arbitrary: fc.Arbitrary<string>
  ) => {
    return fc.property(arbitrary, async (id) => {
      const initialList = await listFn();
      const itemExists = initialList.some(item => item.id === id);
      
      if (!itemExists) return true; // Skip if item doesn't exist
      
      const initialSize = initialList.length;
      
      await deleteFn(id);
      
      const finalList = await listFn();
      const finalSize = finalList.length;
      
      return finalSize === initialSize - 1;
    });
  },
};

export default {
  arbitraries,
  propertyTestConfig,
  propertyHelpers,
  animationPropertyHelpers,
  formPropertyHelpers,
  crudPropertyHelpers,
};