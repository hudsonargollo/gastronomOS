import '@testing-library/jest-dom';
import 'jest-axe/extend-expect';
import { vi } from 'vitest';

// Mock Framer Motion for testing
vi.mock('framer-motion', () => ({
  motion: {
    div: vi.fn(({ children, ...props }: any) => {
      const React = require('react');
      return React.createElement('div', props, children);
    }),
    button: vi.fn(({ children, ...props }: any) => {
      const React = require('react');
      return React.createElement('button', props, children);
    }),
    form: vi.fn(({ children, ...props }: any) => {
      const React = require('react');
      return React.createElement('form', props, children);
    }),
    span: vi.fn(({ children, ...props }: any) => {
      const React = require('react');
      return React.createElement('span', props, children);
    }),
    ul: vi.fn(({ children, ...props }: any) => {
      const React = require('react');
      return React.createElement('ul', props, children);
    }),
    li: vi.fn(({ children, ...props }: any) => {
      const React = require('react');
      return React.createElement('li', props, children);
    }),
  },
  AnimatePresence: vi.fn(({ children }: any) => children),
  useAnimation: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    set: vi.fn(),
  }),
  useMotionValue: (initial: any) => ({ get: () => initial, set: vi.fn() }),
  useTransform: (value: any, transformer: any) => value,
  useSpring: (value: any) => value,
}));

// Mock Next.js router
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  }),
}));

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock browser APIs
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

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
});

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
});

// Mock performance API
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    now: vi.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 1024 * 1024 * 10, // 10MB
      totalJSHeapSize: 1024 * 1024 * 50, // 50MB
      jsHeapSizeLimit: 1024 * 1024 * 100, // 100MB
    },
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn(() => []),
    getEntriesByName: vi.fn(() => []),
  },
});

// Mock requestAnimationFrame
Object.defineProperty(window, 'requestAnimationFrame', {
  writable: true,
  value: vi.fn(cb => setTimeout(cb, 16)),
});

Object.defineProperty(window, 'cancelAnimationFrame', {
  writable: true,
  value: vi.fn(),
});

// Global test utilities
global.testUtils = {
  // Animation test helpers
  waitForAnimation: (duration = 300) => new Promise(resolve => setTimeout(resolve, duration)),
  
  // Performance test helpers
  mockPerformanceEntry: (name: string, duration: number) => ({
    name,
    duration,
    startTime: performance.now(),
    entryType: 'measure',
  }),
};

// Suppress console warnings in tests
const originalWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('React does not recognize') ||
     args[0].includes('Warning: validateDOMNesting'))
  ) {
    return;
  }
  originalWarn.call(console, ...args);
};