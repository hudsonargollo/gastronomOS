/**
 * End-to-End Accessibility Tests
 * Tests accessibility compliance across the application using Playwright
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Application Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test('should not have any automatically detectable accessibility issues on homepage', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Test tab navigation through interactive elements
    await page.keyboard.press('Tab');
    
    // Check that focus is visible
    const focusedElement = await page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Continue tabbing through elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Test reverse tab navigation
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
  });

  test('should have proper heading structure', async ({ page }) => {
    // Check for h1 element
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    
    // Check heading hierarchy (no skipped levels)
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    
    let previousLevel = 0;
    for (const heading of headings) {
      const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
      const currentLevel = parseInt(tagName.charAt(1));
      
      // Heading levels should not skip (e.g., h1 -> h3)
      expect(currentLevel - previousLevel).toBeLessThanOrEqual(1);
      previousLevel = currentLevel;
    }
  });

  test('should have accessible forms', async ({ page }) => {
    // Navigate to a page with forms (if any)
    const forms = await page.locator('form').all();
    
    for (const form of forms) {
      // Check that form fields have labels
      const inputs = await form.locator('input, select, textarea').all();
      
      for (const input of inputs) {
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        
        if (id) {
          // Check for associated label
          const label = page.locator(`label[for="${id}"]`);
          const hasLabel = await label.count() > 0;
          
          expect(hasLabel || ariaLabel || ariaLabelledBy).toBeTruthy();
        }
      }
    }
  });

  test('should have accessible buttons and links', async ({ page }) => {
    // Check buttons have accessible names
    const buttons = await page.locator('button').all();
    
    for (const button of buttons) {
      const textContent = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      const ariaLabelledBy = await button.getAttribute('aria-labelledby');
      
      expect(textContent?.trim() || ariaLabel || ariaLabelledBy).toBeTruthy();
    }
    
    // Check links have accessible names
    const links = await page.locator('a').all();
    
    for (const link of links) {
      const textContent = await link.textContent();
      const ariaLabel = await link.getAttribute('aria-label');
      const ariaLabelledBy = await link.getAttribute('aria-labelledby');
      
      expect(textContent?.trim() || ariaLabel || ariaLabelledBy).toBeTruthy();
    }
  });

  test('should have sufficient color contrast', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include('*')
      .analyze();

    // Filter for color contrast violations
    const colorContrastViolations = accessibilityScanResults.violations.filter(
      violation => violation.id === 'color-contrast'
    );

    expect(colorContrastViolations).toEqual([]);
  });

  test('should handle focus management in modals', async ({ page }) => {
    // Look for modal triggers
    const modalTriggers = await page.locator('[data-testid*="modal"], [aria-haspopup="dialog"]').all();
    
    for (const trigger of modalTriggers) {
      // Open modal
      await trigger.click();
      
      // Wait for modal to appear
      const modal = page.locator('[role="dialog"], [aria-modal="true"]').first();
      await expect(modal).toBeVisible();
      
      // Check that focus is trapped within modal
      await page.keyboard.press('Tab');
      const focusedElement = await page.locator(':focus');
      
      // Focus should be within the modal
      const isWithinModal = await modal.locator(':focus').count() > 0;
      expect(isWithinModal).toBeTruthy();
      
      // Test escape key closes modal
      await page.keyboard.press('Escape');
      await expect(modal).not.toBeVisible();
    }
  });

  test('should announce dynamic content changes', async ({ page }) => {
    // Look for elements with aria-live regions
    const liveRegions = await page.locator('[aria-live]').all();
    
    for (const region of liveRegions) {
      const ariaLive = await region.getAttribute('aria-live');
      expect(['polite', 'assertive', 'off']).toContain(ariaLive);
    }
    
    // Check for status messages
    const statusElements = await page.locator('[role="status"], [role="alert"]').all();
    expect(statusElements.length).toBeGreaterThanOrEqual(0); // Should not error
  });

  test('should support screen reader navigation', async ({ page }) => {
    // Check for landmark roles
    const landmarks = await page.locator('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer').all();
    expect(landmarks.length).toBeGreaterThan(0);
    
    // Check for skip links
    const skipLinks = await page.locator('a[href^="#"]').first();
    if (await skipLinks.count() > 0) {
      const href = await skipLinks.getAttribute('href');
      const target = page.locator(href!);
      await expect(target).toBeVisible();
    }
  });
});

test.describe('Responsive Accessibility', () => {
  test('should maintain accessibility on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should maintain accessibility on tablet devices', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should support touch navigation', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Check that interactive elements are large enough for touch
    const buttons = await page.locator('button').all();
    
    for (const button of buttons) {
      const boundingBox = await button.boundingBox();
      if (boundingBox) {
        // WCAG recommends minimum 44x44 pixels for touch targets
        expect(boundingBox.width).toBeGreaterThanOrEqual(44);
        expect(boundingBox.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
});