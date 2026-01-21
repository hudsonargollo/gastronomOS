/**
 * Animation Testing Utilities
 * Utilities for testing Framer Motion animations and performance
 */

import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import React from 'react';

// Animation test configuration
export const animationTestConfig = {
  defaultTimeout: 1000,
  frameRate: 60,
  performanceThreshold: {
    minFps: 30,
    maxFrameDrops: 5,
    maxMemoryIncrease: 10 * 1024 * 1024, // 10MB
  },
};

// Mock animation frame tracking
export class AnimationFrameTracker {
  private frames: number[] = [];
  private isTracking = false;
  private startTime = 0;

  start() {
    this.frames = [];
    this.isTracking = true;
    this.startTime = performance.now();
    this.trackFrame();
  }

  stop() {
    this.isTracking = false;
    return this.getMetrics();
  }

  private trackFrame = () => {
    if (!this.isTracking) return;
    
    this.frames.push(performance.now());
    requestAnimationFrame(this.trackFrame);
  };

  private getMetrics() {
    if (this.frames.length < 2) {
      return { fps: 0, frameDrops: 0, duration: 0 };
    }

    const duration = this.frames[this.frames.length - 1] - this.frames[0];
    const intervals = this.frames.slice(1).map((time, i) => time - this.frames[i]);
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const fps = 1000 / avgInterval;
    
    // Count frame drops (intervals > 20ms for 60fps)
    const frameDrops = intervals.filter(interval => interval > 20).length;

    return { fps, frameDrops, duration };
  }
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private initialMemory = 0;
  private measurements: Array<{ name: string; value: number; timestamp: number }> = [];

  start() {
    this.initialMemory = this.getMemoryUsage();
    this.measurements = [];
    performance.mark('test-start');
  }

  measure(name: string) {
    const timestamp = performance.now();
    const memory = this.getMemoryUsage();
    
    this.measurements.push({
      name,
      value: memory - this.initialMemory,
      timestamp,
    });
    
    performance.mark(`test-${name}`);
  }

  stop() {
    performance.mark('test-end');
    performance.measure('test-duration', 'test-start', 'test-end');
    
    const entries = performance.getEntriesByType('measure');
    const testDuration = entries.find(entry => entry.name === 'test-duration');
    
    return {
      duration: testDuration?.duration || 0,
      memoryDelta: this.getMemoryUsage() - this.initialMemory,
      measurements: this.measurements,
    };
  }

  private getMemoryUsage(): number {
    return (performance as any).memory?.usedJSHeapSize || 0;
  }
}

// Animation testing helpers
export const animationTestHelpers = {
  // Wait for animation to complete
  waitForAnimation: async (duration: number = 300, buffer: number = 50) => {
    await new Promise(resolve => setTimeout(resolve, duration + buffer));
  },

  // Test animation presence
  expectAnimationToStart: async (element: HTMLElement, property: string = 'opacity') => {
    const initialValue = getComputedStyle(element).getPropertyValue(property);
    
    // Trigger animation (this would be done by the test)
    await waitFor(() => {
      const currentValue = getComputedStyle(element).getPropertyValue(property);
      expect(currentValue).not.toBe(initialValue);
    }, { timeout: animationTestConfig.defaultTimeout });
  },

  // Test animation completion
  expectAnimationToComplete: async (
    element: HTMLElement, 
    finalValue: string, 
    property: string = 'opacity',
    timeout: number = animationTestConfig.defaultTimeout
  ) => {
    await waitFor(() => {
      const currentValue = getComputedStyle(element).getPropertyValue(property);
      expect(currentValue).toBe(finalValue);
    }, { timeout });
  },

  // Mock Framer Motion animation controls
  createMockAnimationControls: () => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    set: vi.fn(),
    mount: vi.fn(),
    unmount: vi.fn(),
  }),

  // Create mock motion values
  createMockMotionValue: (initialValue: any = 0) => ({
    get: vi.fn().mockReturnValue(initialValue),
    set: vi.fn(),
    onChange: vi.fn(),
    destroy: vi.fn(),
  }),

  // Test component with animation
  renderWithAnimation: (component: React.ReactElement) => {
    const tracker = new AnimationFrameTracker();
    const monitor = new PerformanceMonitor();
    
    monitor.start();
    tracker.start();
    
    const result = render(component);
    
    return {
      ...result,
      stopTracking: () => {
        const animationMetrics = tracker.stop();
        const performanceMetrics = monitor.stop();
        
        return {
          animation: animationMetrics,
          performance: performanceMetrics,
        };
      },
    };
  },
};

// Page transition testing utilities
export const pageTransitionTestHelpers = {
  // Test page transition animations
  testPageTransition: async (
    fromComponent: React.ReactElement,
    toComponent: React.ReactElement,
    transitionDuration: number = 300
  ) => {
    const { rerender } = render(fromComponent);
    
    // Start tracking
    const tracker = new AnimationFrameTracker();
    tracker.start();
    
    // Trigger transition
    rerender(toComponent);
    
    // Wait for transition
    await animationTestHelpers.waitForAnimation(transitionDuration);
    
    // Stop tracking and return metrics
    return tracker.stop();
  },

  // Test smooth navigation
  testSmoothNavigation: async (navigationFn: () => void, expectedUrl: string) => {
    const tracker = new AnimationFrameTracker();
    tracker.start();
    
    navigationFn();
    
    await waitFor(() => {
      expect(window.location.pathname).toBe(expectedUrl);
    });
    
    return tracker.stop();
  },
};

// Modal animation testing utilities
export const modalAnimationTestHelpers = {
  // Test modal open animation
  testModalOpen: async (modalTrigger: HTMLElement, modalSelector: string) => {
    const tracker = new AnimationFrameTracker();
    tracker.start();
    
    modalTrigger.click();
    
    await waitFor(() => {
      const modal = screen.getByTestId(modalSelector);
      expect(modal).toBeInTheDocument();
    });
    
    return tracker.stop();
  },

  // Test modal close animation
  testModalClose: async (closeButton: HTMLElement, modalSelector: string) => {
    const tracker = new AnimationFrameTracker();
    tracker.start();
    
    closeButton.click();
    
    await waitFor(() => {
      const modal = screen.queryByTestId(modalSelector);
      expect(modal).not.toBeInTheDocument();
    });
    
    return tracker.stop();
  },
};

// List animation testing utilities
export const listAnimationTestHelpers = {
  // Test list item addition animation
  testListItemAddition: async (
    addButton: HTMLElement,
    listSelector: string,
    expectedNewItemCount: number
  ) => {
    const tracker = new AnimationFrameTracker();
    const initialItems = screen.getAllByTestId(listSelector);
    const initialCount = initialItems.length;
    
    tracker.start();
    addButton.click();
    
    await waitFor(() => {
      const currentItems = screen.getAllByTestId(listSelector);
      expect(currentItems).toHaveLength(initialCount + expectedNewItemCount);
    });
    
    return tracker.stop();
  },

  // Test list item removal animation
  testListItemRemoval: async (
    removeButton: HTMLElement,
    listSelector: string,
    expectedRemovedItemCount: number = 1
  ) => {
    const tracker = new AnimationFrameTracker();
    const initialItems = screen.getAllByTestId(listSelector);
    const initialCount = initialItems.length;
    
    tracker.start();
    removeButton.click();
    
    await waitFor(() => {
      const currentItems = screen.getAllByTestId(listSelector);
      expect(currentItems).toHaveLength(initialCount - expectedRemovedItemCount);
    });
    
    return tracker.stop();
  },

  // Test list reordering animation
  testListReordering: async (
    reorderAction: () => void,
    listSelector: string,
    expectedOrder: string[]
  ) => {
    const tracker = new AnimationFrameTracker();
    tracker.start();
    
    reorderAction();
    
    await waitFor(() => {
      const items = screen.getAllByTestId(listSelector);
      const actualOrder = items.map(item => item.textContent || '');
      expect(actualOrder).toEqual(expectedOrder);
    });
    
    return tracker.stop();
  },
};

// Performance assertion helpers
export const performanceAssertions = {
  // Assert minimum frame rate
  assertMinimumFrameRate: (metrics: { fps: number }, minFps: number = 30) => {
    expect(metrics.fps).toBeGreaterThanOrEqual(minFps);
  },

  // Assert maximum frame drops
  assertMaximumFrameDrops: (metrics: { frameDrops: number }, maxDrops: number = 5) => {
    expect(metrics.frameDrops).toBeLessThanOrEqual(maxDrops);
  },

  // Assert memory usage within bounds
  assertMemoryUsage: (
    metrics: { memoryDelta: number }, 
    maxIncrease: number = animationTestConfig.performanceThreshold.maxMemoryIncrease
  ) => {
    expect(metrics.memoryDelta).toBeLessThanOrEqual(maxIncrease);
  },

  // Assert animation duration
  assertAnimationDuration: (
    metrics: { duration: number }, 
    expectedDuration: number, 
    tolerance: number = 50
  ) => {
    expect(Math.abs(metrics.duration - expectedDuration)).toBeLessThanOrEqual(tolerance);
  },
};

export default {
  animationTestConfig,
  AnimationFrameTracker,
  PerformanceMonitor,
  animationTestHelpers,
  pageTransitionTestHelpers,
  modalAnimationTestHelpers,
  listAnimationTestHelpers,
  performanceAssertions,
};