/**
 * Accessibility Testing Utilities
 * Utilities for automated accessibility testing with axe-core
 */

import { render, RenderResult } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Accessibility test configuration
export const accessibilityTestConfig = {
  // axe-core configuration
  axeConfig: {
    rules: {
      // Enable valid WCAG 2.1 AA rules
      'color-contrast': { enabled: true },
      'focus-order-semantics': { enabled: true },
      'aria-allowed-attr': { enabled: true },
      'aria-required-attr': { enabled: true },
      'button-name': { enabled: true },
      'label': { enabled: true },
    },
    tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
  },
  
  // Keyboard navigation test configuration
  keyboardNavigation: {
    tabKey: 'Tab',
    shiftTabKey: ['Shift', 'Tab'],
    enterKey: 'Enter',
    spaceKey: ' ',
    escapeKey: 'Escape',
    arrowKeys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
  },
  
  // Screen reader test configuration
  screenReader: {
    announcements: [],
    focusedElement: null,
  },
};

// Core accessibility testing utilities
export const accessibilityTestHelpers = {
  // Run axe accessibility audit
  runAxeAudit: async (container: HTMLElement, config = accessibilityTestConfig.axeConfig) => {
    const results = await axe(container, config);
    return results;
  },

  // Assert no accessibility violations
  assertNoViolations: async (container: HTMLElement) => {
    const results = await axe(container, accessibilityTestConfig.axeConfig);
    expect(results).toHaveNoViolations();
  },

  // Render component and run accessibility audit
  renderAndAudit: async (component: React.ReactElement) => {
    const { container, ...renderResult } = render(component);
    const results = await axe(container, accessibilityTestConfig.axeConfig);
    
    return {
      ...renderResult,
      container,
      accessibilityResults: results,
      assertNoViolations: () => expect(results).toHaveNoViolations(),
    };
  },

  // Test keyboard navigation
  testKeyboardNavigation: async (container: HTMLElement) => {
    const user = userEvent.setup();
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const navigationResults = {
      totalFocusableElements: focusableElements.length,
      navigationPath: [] as string[],
      trapsFocus: false,
      hasSkipLinks: false,
    };

    // Test tab navigation
    for (let i = 0; i < focusableElements.length; i++) {
      await user.tab();
      const activeElement = document.activeElement;
      if (activeElement) {
        navigationResults.navigationPath.push(
          activeElement.tagName + (activeElement.id ? `#${activeElement.id}` : '')
        );
      }
    }

    // Test reverse tab navigation
    for (let i = 0; i < focusableElements.length; i++) {
      await user.tab({ shift: true });
    }

    // Check for skip links
    const skipLinks = container.querySelectorAll('[href^="#"], .skip-link');
    navigationResults.hasSkipLinks = skipLinks.length > 0;

    return navigationResults;
  },

  // Test focus management
  testFocusManagement: async (
    triggerElement: HTMLElement,
    expectedFocusTarget: HTMLElement | string
  ) => {
    const user = userEvent.setup();
    
    // Record initial focus
    const initialFocus = document.activeElement;
    
    // Trigger action
    await user.click(triggerElement);
    
    // Check focus after action
    const finalFocus = document.activeElement;
    
    if (typeof expectedFocusTarget === 'string') {
      const targetElement = document.querySelector(expectedFocusTarget);
      expect(finalFocus).toBe(targetElement);
    } else {
      expect(finalFocus).toBe(expectedFocusTarget);
    }

    return {
      initialFocus,
      finalFocus,
      focusChanged: initialFocus !== finalFocus,
    };
  },

  // Test ARIA attributes
  testAriaAttributes: (element: HTMLElement) => {
    const ariaAttributes = {
      hasAriaLabel: element.hasAttribute('aria-label'),
      hasAriaLabelledBy: element.hasAttribute('aria-labelledby'),
      hasAriaDescribedBy: element.hasAttribute('aria-describedby'),
      hasRole: element.hasAttribute('role'),
      ariaExpanded: element.getAttribute('aria-expanded'),
      ariaHidden: element.getAttribute('aria-hidden'),
      ariaDisabled: element.getAttribute('aria-disabled'),
      tabIndex: element.getAttribute('tabindex'),
    };

    return ariaAttributes;
  },

  // Test color contrast
  testColorContrast: async (element: HTMLElement) => {
    const styles = getComputedStyle(element);
    const backgroundColor = styles.backgroundColor;
    const color = styles.color;
    
    // This is a simplified contrast check - in real implementation,
    // you would use a proper color contrast calculation library
    const hasGoodContrast = backgroundColor !== color && 
                           backgroundColor !== 'transparent' && 
                           color !== 'transparent';

    return {
      backgroundColor,
      color,
      hasGoodContrast,
    };
  },
};

// Form accessibility testing utilities
export const formAccessibilityHelpers = {
  // Test form field accessibility
  testFormFieldAccessibility: async (fieldElement: HTMLElement) => {
    const results = {
      hasLabel: false,
      hasRequiredIndicator: false,
      hasErrorMessage: false,
      hasHelpText: false,
      isKeyboardAccessible: false,
    };

    // Check for label
    const labelElement = fieldElement.closest('label') || 
                        document.querySelector(`label[for="${fieldElement.id}"]`);
    results.hasLabel = !!labelElement;

    // Check for required indicator
    results.hasRequiredIndicator = fieldElement.hasAttribute('required') ||
                                  fieldElement.hasAttribute('aria-required');

    // Check for error message
    const errorId = fieldElement.getAttribute('aria-describedby');
    if (errorId) {
      const errorElement = document.getElementById(errorId);
      results.hasErrorMessage = !!errorElement;
    }

    // Check keyboard accessibility
    results.isKeyboardAccessible = fieldElement.tabIndex >= 0;

    return results;
  },

  // Test form validation accessibility
  testFormValidationAccessibility: async (formElement: HTMLElement) => {
    const user = userEvent.setup();
    const results = {
      errorsAnnounced: false,
      focusMovesToFirstError: false,
      errorMessagesLinked: false,
    };

    // Trigger validation (submit invalid form)
    const submitButton = formElement.querySelector('button[type="submit"]') as HTMLElement;
    if (submitButton) {
      await user.click(submitButton);
      
      // Check if focus moves to first error
      const firstErrorField = formElement.querySelector('[aria-invalid="true"]');
      if (firstErrorField) {
        results.focusMovesToFirstError = document.activeElement === firstErrorField;
      }

      // Check if error messages are properly linked
      const errorFields = formElement.querySelectorAll('[aria-invalid="true"]');
      results.errorMessagesLinked = Array.from(errorFields).every(field => {
        const describedBy = field.getAttribute('aria-describedby');
        return describedBy && document.getElementById(describedBy);
      });
    }

    return results;
  },
};

// Modal accessibility testing utilities
export const modalAccessibilityHelpers = {
  // Test modal accessibility
  testModalAccessibility: async (modalElement: HTMLElement) => {
    const results = {
      trapsFocus: false,
      hasCloseButton: false,
      hasAriaModal: false,
      hasAriaLabel: false,
      restoresFocus: false,
    };

    // Check ARIA attributes
    results.hasAriaModal = modalElement.getAttribute('role') === 'dialog' ||
                          modalElement.hasAttribute('aria-modal');
    results.hasAriaLabel = modalElement.hasAttribute('aria-label') ||
                          modalElement.hasAttribute('aria-labelledby');

    // Check for close button
    const closeButton = modalElement.querySelector('[aria-label*="close"], .close-button');
    results.hasCloseButton = !!closeButton;

    // Test focus trap
    const user = userEvent.setup();
    const focusableElements = modalElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length > 0) {
      // Tab through all elements and check if focus stays within modal
      for (let i = 0; i < focusableElements.length + 1; i++) {
        await user.tab();
        const activeElement = document.activeElement;
        const isWithinModal = modalElement.contains(activeElement);
        if (i === focusableElements.length && isWithinModal) {
          results.trapsFocus = true;
        }
      }
    }

    return results;
  },

  // Test modal keyboard interactions
  testModalKeyboardInteractions: async (modalElement: HTMLElement) => {
    const user = userEvent.setup();
    const results = {
      closesOnEscape: false,
      maintainsFocus: false,
    };

    // Test escape key
    await user.keyboard('{Escape}');
    results.closesOnEscape = !document.body.contains(modalElement);

    return results;
  },
};

// Navigation accessibility testing utilities
export const navigationAccessibilityHelpers = {
  // Test navigation accessibility
  testNavigationAccessibility: async (navElement: HTMLElement) => {
    const results = {
      hasLandmarkRole: false,
      hasSkipLinks: false,
      hasAriaLabel: false,
      linksAreAccessible: false,
    };

    // Check landmark role
    results.hasLandmarkRole = navElement.tagName === 'NAV' ||
                             navElement.getAttribute('role') === 'navigation';

    // Check ARIA label
    results.hasAriaLabel = navElement.hasAttribute('aria-label') ||
                          navElement.hasAttribute('aria-labelledby');

    // Check skip links
    const skipLinks = navElement.querySelectorAll('[href^="#"]');
    results.hasSkipLinks = skipLinks.length > 0;

    // Check link accessibility
    const links = navElement.querySelectorAll('a');
    results.linksAreAccessible = Array.from(links).every(link => {
      return link.hasAttribute('href') && 
             (link.textContent?.trim() || link.hasAttribute('aria-label'));
    });

    return results;
  },

  // Test breadcrumb accessibility
  testBreadcrumbAccessibility: async (breadcrumbElement: HTMLElement) => {
    const results = {
      hasAriaLabel: false,
      hasCurrentPage: false,
      linksAreAccessible: false,
    };

    // Check ARIA label
    results.hasAriaLabel = breadcrumbElement.hasAttribute('aria-label') ||
                          breadcrumbElement.getAttribute('aria-label') === 'breadcrumb';

    // Check current page indicator
    const currentPage = breadcrumbElement.querySelector('[aria-current="page"]');
    results.hasCurrentPage = !!currentPage;

    // Check link accessibility
    const links = breadcrumbElement.querySelectorAll('a');
    results.linksAreAccessible = Array.from(links).every(link => {
      return link.hasAttribute('href') && link.textContent?.trim();
    });

    return results;
  },
};

// Comprehensive accessibility test suite
export const runComprehensiveAccessibilityTest = async (
  component: React.ReactElement,
  options: {
    testKeyboardNavigation?: boolean;
    testFocusManagement?: boolean;
    testColorContrast?: boolean;
    testAriaAttributes?: boolean;
  } = {}
) => {
  const { container, ...renderResult } = render(component);
  
  const results = {
    axeResults: await axe(container, accessibilityTestConfig.axeConfig),
    keyboardNavigation: null as any,
    focusManagement: null as any,
    colorContrast: null as any,
    ariaAttributes: null as any,
  };

  // Run optional tests
  if (options.testKeyboardNavigation) {
    results.keyboardNavigation = await accessibilityTestHelpers.testKeyboardNavigation(container);
  }

  if (options.testColorContrast) {
    const elements = container.querySelectorAll('*');
    results.colorContrast = await Promise.all(
      Array.from(elements).map(el => accessibilityTestHelpers.testColorContrast(el as HTMLElement))
    );
  }

  if (options.testAriaAttributes) {
    const interactiveElements = container.querySelectorAll(
      'button, [role="button"], input, select, textarea, a, [tabindex]'
    );
    results.ariaAttributes = Array.from(interactiveElements).map(el =>
      accessibilityTestHelpers.testAriaAttributes(el as HTMLElement)
    );
  }

  return {
    ...renderResult,
    container,
    results,
    assertNoViolations: () => expect(results.axeResults).toHaveNoViolations(),
  };
};

export default {
  accessibilityTestConfig,
  accessibilityTestHelpers,
  formAccessibilityHelpers,
  modalAccessibilityHelpers,
  navigationAccessibilityHelpers,
  runComprehensiveAccessibilityTest,
};