# Testing Infrastructure Documentation

This directory contains comprehensive testing utilities and infrastructure for the Enhanced UI Workflow feature.

## Overview

The testing infrastructure supports multiple testing approaches:

- **Unit Testing**: Traditional unit tests with Vitest
- **Property-Based Testing**: Generative testing with fast-check
- **Animation Testing**: Performance and behavior testing for Framer Motion animations
- **Accessibility Testing**: Automated accessibility compliance testing
- **Visual Regression Testing**: UI consistency validation across changes
- **End-to-End Testing**: Full user workflow testing with Playwright

## Directory Structure

```
src/test/
├── utils/                          # Testing utilities
│   ├── property-test-utils.ts      # Property-based testing helpers
│   ├── animation-test-utils.ts     # Animation testing utilities
│   ├── accessibility-test-utils.ts # Accessibility testing helpers
│   ├── visual-regression-utils.ts  # Visual regression testing tools
│   └── index.ts                    # Central exports
├── e2e/                           # End-to-end tests
│   └── accessibility.spec.ts      # E2E accessibility tests
├── setup.ts                       # Test environment setup
├── testing-infrastructure.test.ts # Infrastructure validation tests
└── README.md                      # This documentation
```

## Getting Started

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run specific test types
npm run test:property      # Property-based tests only
npm run test:accessibility # Accessibility tests only
npm run test:visual        # Visual regression tests only
npm run test:performance   # Performance tests only

# Run all test types
npm run test:all
```

### Writing Tests

#### Basic Unit Test

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

#### Property-Based Test

```typescript
import fc from 'fast-check';
import { propertyTestUtils } from './utils';

it('should maintain invariant across all inputs', () => {
  /**
   * **Feature: enhanced-ui-workflow, Property 1: Description**
   * **Validates: Requirements 1.1**
   */
  fc.assert(
    fc.property(propertyTestUtils.arbitraries.nonEmptyString, (input) => {
      const result = myFunction(input);
      return result.length > 0; // Invariant: result is never empty
    }),
    propertyTestUtils.propertyTestConfig
  );
});
```

#### Animation Test

```typescript
import { animationTestUtils } from './utils';

it('should animate smoothly', async () => {
  const { stopTracking } = animationTestUtils.animationTestHelpers.renderWithAnimation(
    <AnimatedComponent />
  );
  
  // Trigger animation
  await userEvent.click(screen.getByRole('button'));
  
  const metrics = stopTracking();
  animationTestUtils.performanceAssertions.assertMinimumFrameRate(metrics.animation, 30);
});
```

#### Accessibility Test

```typescript
import { accessibilityTestUtils } from './utils';

it('should be accessible', async () => {
  const { assertNoViolations } = await accessibilityTestUtils.runComprehensiveAccessibilityTest(
    <MyComponent />
  );
  
  await assertNoViolations();
});
```

#### Visual Regression Test

```typescript
import { visualRegressionUtils } from './utils';

it('should maintain visual consistency', async () => {
  const result = await visualRegressionUtils.runVisualRegressionTest(
    'my-component',
    <MyComponent />,
    { updateBaseline: false }
  );
  
  expect(result.match).toBe(true);
});
```

## Testing Utilities

### Property-Based Testing (`property-test-utils.ts`)

Provides generators and helpers for property-based testing:

- **Arbitraries**: Pre-built generators for common UI data types
- **Property Helpers**: Common property patterns (purity, invariants, round-trips)
- **Animation Helpers**: Animation-specific property testing
- **Form Helpers**: Form validation property testing
- **CRUD Helpers**: CRUD operation property testing

### Animation Testing (`animation-test-utils.ts`)

Tools for testing Framer Motion animations:

- **AnimationFrameTracker**: Tracks frame rates and performance
- **PerformanceMonitor**: Monitors memory usage and execution time
- **Animation Helpers**: Utilities for testing animation behavior
- **Performance Assertions**: Assertions for animation performance

### Accessibility Testing (`accessibility-test-utils.ts`)

Automated accessibility testing with axe-core:

- **Core Testing**: WCAG compliance validation
- **Keyboard Navigation**: Tab order and focus management testing
- **Form Accessibility**: Form field and validation accessibility
- **Modal Accessibility**: Modal focus trapping and ARIA testing
- **Navigation Accessibility**: Landmark and navigation testing

### Visual Regression Testing (`visual-regression-utils.ts`)

UI consistency validation:

- **Screenshot Capture**: Component and page screenshot utilities
- **Image Comparison**: Pixel-perfect comparison with diff generation
- **Responsive Testing**: Multi-viewport consistency testing
- **Theme Testing**: Theme variation consistency testing
- **Animation State Testing**: Animation state capture and comparison

## Configuration

### Vitest Configuration (`vitest.config.ts`)

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
});
```

### Playwright Configuration (`playwright.config.ts`)

Configured for cross-browser accessibility testing with multiple viewports.

## Best Practices

### Property-Based Testing

1. **Use appropriate generators**: Choose generators that match your input domain
2. **Write clear properties**: Properties should be easy to understand and verify
3. **Handle edge cases**: Use preconditions to filter invalid inputs
4. **Tag tests properly**: Include feature and property references in comments

### Animation Testing

1. **Test performance**: Always verify frame rates and memory usage
2. **Test behavior**: Verify animations complete and reach expected states
3. **Mock appropriately**: Use animation mocks for unit tests, real animations for integration tests
4. **Handle timing**: Use proper waits and timeouts for animation completion

### Accessibility Testing

1. **Test early and often**: Run accessibility tests on every component
2. **Test interactions**: Verify keyboard navigation and focus management
3. **Test with real users**: Automated tests catch many issues but not all
4. **Follow WCAG guidelines**: Aim for WCAG 2.1 AA compliance

### Visual Regression Testing

1. **Stable baselines**: Ensure baseline images are captured in consistent environments
2. **Meaningful comparisons**: Only compare visually significant changes
3. **Handle dynamic content**: Mock or stabilize dynamic content for consistent tests
4. **Review failures**: Always review visual differences before updating baselines

## Troubleshooting

### Common Issues

1. **Test timeouts**: Increase timeout values for slow operations
2. **Flaky tests**: Add proper waits and stabilize dynamic content
3. **Memory leaks**: Ensure proper cleanup in test teardown
4. **Mock issues**: Verify mocks match real API behavior

### Performance Issues

1. **Slow tests**: Use `--run` flag for CI, optimize test setup
2. **Memory usage**: Monitor memory usage in long test suites
3. **Animation performance**: Use reduced motion preferences in tests when appropriate

## Contributing

When adding new tests:

1. Follow the established patterns and naming conventions
2. Add appropriate documentation and comments
3. Include property-based tests for universal properties
4. Verify accessibility compliance
5. Update this README if adding new utilities or patterns

## Dependencies

- **vitest**: Test runner and assertion library
- **@testing-library/react**: React testing utilities
- **fast-check**: Property-based testing library
- **jest-axe**: Accessibility testing integration
- **html2canvas**: Screenshot capture for visual regression
- **@playwright/test**: End-to-end testing framework
- **@axe-core/playwright**: Playwright accessibility integration

## Related Documentation

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Documentation](https://testing-library.com/)
- [fast-check Documentation](https://fast-check.dev/)
- [axe-core Documentation](https://github.com/dequelabs/axe-core)
- [Playwright Documentation](https://playwright.dev/)