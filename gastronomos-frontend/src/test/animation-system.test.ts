/**
 * Basic test to verify animation system functionality
 */

import { vi } from 'vitest';
import { 
  defaultAnimationConfig, 
  AnimationPerformanceMonitor,
  getOptimizedTransition,
  getSpringTransition,
  checkReducedMotionPreference
} from '../lib/animation-config';

import {
  fadeInOut,
  slideInFromRight,
  pageTransitionVariants,
  buttonVariants,
  transitions
} from '../lib/animation-utils';

// Test animation configuration
describe('Animation Configuration', () => {
  test('should have default configuration', () => {
    expect(defaultAnimationConfig).toBeDefined();
    expect(defaultAnimationConfig.duration).toBe(0.3);
    expect(defaultAnimationConfig.easing).toBe('easeInOut');
  });

  test('should create optimized transitions', () => {
    const transition = getOptimizedTransition();
    expect(transition).toHaveProperty('duration');
    expect(transition).toHaveProperty('ease');
  });

  test('should create spring transitions', () => {
    const transition = getSpringTransition();
    expect(transition).toHaveProperty('type', 'spring');
    expect(transition).toHaveProperty('stiffness');
    expect(transition).toHaveProperty('damping');
  });
});

// Test animation variants
describe('Animation Variants', () => {
  test('should have fade in/out variants', () => {
    expect(fadeInOut).toHaveProperty('initial');
    expect(fadeInOut).toHaveProperty('animate');
    expect(fadeInOut).toHaveProperty('exit');
  });

  test('should have slide variants', () => {
    expect(slideInFromRight).toHaveProperty('initial');
    expect(slideInFromRight).toHaveProperty('animate');
    expect(slideInFromRight).toHaveProperty('exit');
  });

  test('should have page transition variants', () => {
    expect(pageTransitionVariants).toHaveProperty('initial');
    expect(pageTransitionVariants).toHaveProperty('animate');
    expect(pageTransitionVariants).toHaveProperty('exit');
  });

  test('should have button variants', () => {
    expect(buttonVariants).toHaveProperty('initial');
    expect(buttonVariants).toHaveProperty('hover');
    expect(buttonVariants).toHaveProperty('tap');
  });
});

// Test performance monitoring
describe('Performance Monitoring', () => {
  test('should create performance monitor instance', () => {
    const monitor = new AnimationPerformanceMonitor();
    expect(monitor).toBeDefined();
    expect(typeof monitor.startMonitoring).toBe('function');
    expect(typeof monitor.stopMonitoring).toBe('function');
    expect(typeof monitor.getPerformanceState).toBe('function');
  });

  test('should get initial performance state', () => {
    const monitor = new AnimationPerformanceMonitor();
    const state = monitor.getPerformanceState();
    expect(state).toHaveProperty('fps');
    expect(state).toHaveProperty('frameDrops');
    expect(state).toHaveProperty('memoryUsage');
    expect(state).toHaveProperty('lastMeasurement');
  });
});

// Test transition presets
describe('Transition Presets', () => {
  test('should have transition presets', () => {
    expect(transitions).toHaveProperty('default');
    expect(transitions).toHaveProperty('fast');
    expect(transitions).toHaveProperty('slow');
    expect(transitions).toHaveProperty('spring');
    expect(transitions).toHaveProperty('bouncy');
    expect(transitions).toHaveProperty('smooth');
  });

  test('should have different durations for different presets', () => {
    expect(transitions.fast.duration).toBeLessThan(transitions.default.duration);
    expect(transitions.slow.duration).toBeGreaterThan(transitions.default.duration);
  });
});

// Mock browser APIs for testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    now: vi.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 1024 * 1024 * 10, // 10MB
    },
  },
});

Object.defineProperty(window, 'requestAnimationFrame', {
  writable: true,
  value: vi.fn(cb => setTimeout(cb, 16)),
});

Object.defineProperty(window, 'cancelAnimationFrame', {
  writable: true,
  value: vi.fn(),
});