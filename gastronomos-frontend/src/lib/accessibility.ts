/**
 * Accessibility Utilities
 * Provides WCAG-compliant accessibility features and utilities
 */

import { designTokens } from './design-tokens';

// ARIA attributes and roles
export const ariaAttributes = {
  // Common ARIA attributes
  describedBy: (id: string) => ({ 'aria-describedby': id }),
  labelledBy: (id: string) => ({ 'aria-labelledby': id }),
  label: (label: string) => ({ 'aria-label': label }),
  expanded: (expanded: boolean) => ({ 'aria-expanded': expanded }),
  selected: (selected: boolean) => ({ 'aria-selected': selected }),
  checked: (checked: boolean) => ({ 'aria-checked': checked }),
  disabled: (disabled: boolean) => ({ 'aria-disabled': disabled }),
  hidden: (hidden: boolean) => ({ 'aria-hidden': hidden }),
  invalid: (invalid: boolean) => ({ 'aria-invalid': invalid }),
  required: (required: boolean) => ({ 'aria-required': required }),
  readonly: (readonly: boolean) => ({ 'aria-readonly': readonly }),
  
  // Live regions
  live: (politeness: 'polite' | 'assertive' | 'off') => ({ 'aria-live': politeness }),
  atomic: (atomic: boolean) => ({ 'aria-atomic': atomic }),
  relevant: (relevant: 'additions' | 'removals' | 'text' | 'all') => ({ 'aria-relevant': relevant }),
  
  // Relationships
  controls: (id: string) => ({ 'aria-controls': id }),
  owns: (id: string) => ({ 'aria-owns': id }),
  flowto: (id: string) => ({ 'aria-flowto': id }),
  
  // Values and ranges
  valuemin: (min: number) => ({ 'aria-valuemin': min }),
  valuemax: (max: number) => ({ 'aria-valuemax': max }),
  valuenow: (now: number) => ({ 'aria-valuenow': now }),
  valuetext: (text: string) => ({ 'aria-valuetext': text }),
  
  // Popup and modal
  haspopup: (type: 'true' | 'false' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog') => ({ 'aria-haspopup': type }),
  modal: (modal: boolean) => ({ 'aria-modal': modal }),
  
  // Position in set
  posinset: (position: number) => ({ 'aria-posinset': position }),
  setsize: (size: number) => ({ 'aria-setsize': size }),
  level: (level: number) => ({ 'aria-level': level }),
} as const;

// Common ARIA roles
export const ariaRoles = {
  // Landmark roles
  banner: 'banner',
  navigation: 'navigation',
  main: 'main',
  complementary: 'complementary',
  contentinfo: 'contentinfo',
  search: 'search',
  form: 'form',
  region: 'region',
  
  // Widget roles
  button: 'button',
  checkbox: 'checkbox',
  radio: 'radio',
  textbox: 'textbox',
  combobox: 'combobox',
  listbox: 'listbox',
  option: 'option',
  menuitem: 'menuitem',
  menuitemcheckbox: 'menuitemcheckbox',
  menuitemradio: 'menuitemradio',
  tab: 'tab',
  tabpanel: 'tabpanel',
  tablist: 'tablist',
  slider: 'slider',
  spinbutton: 'spinbutton',
  progressbar: 'progressbar',
  
  // Composite roles
  menu: 'menu',
  menubar: 'menubar',
  tree: 'tree',
  treeitem: 'treeitem',
  grid: 'grid',
  gridcell: 'gridcell',
  row: 'row',
  rowgroup: 'rowgroup',
  columnheader: 'columnheader',
  rowheader: 'rowheader',
  
  // Document structure roles
  article: 'article',
  document: 'document',
  heading: 'heading',
  img: 'img',
  list: 'list',
  listitem: 'listitem',
  table: 'table',
  
  // Live region roles
  alert: 'alert',
  alertdialog: 'alertdialog',
  status: 'status',
  log: 'log',
  marquee: 'marquee',
  timer: 'timer',
  
  // Window roles
  dialog: 'dialog',
  tooltip: 'tooltip',
} as const;

// Keyboard navigation utilities
export const keyboardNavigation = {
  // Common key codes
  keys: {
    ENTER: 'Enter',
    SPACE: ' ',
    ESCAPE: 'Escape',
    TAB: 'Tab',
    ARROW_UP: 'ArrowUp',
    ARROW_DOWN: 'ArrowDown',
    ARROW_LEFT: 'ArrowLeft',
    ARROW_RIGHT: 'ArrowRight',
    HOME: 'Home',
    END: 'End',
    PAGE_UP: 'PageUp',
    PAGE_DOWN: 'PageDown',
  },
  
  // Key event handlers
  onEnterOrSpace: (callback: () => void) => (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
  },
  
  onEscape: (callback: () => void) => (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      callback();
    }
  },
  
  onArrowKeys: (callbacks: {
    up?: () => void;
    down?: () => void;
    left?: () => void;
    right?: () => void;
  }) => (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        callbacks.up?.();
        break;
      case 'ArrowDown':
        event.preventDefault();
        callbacks.down?.();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        callbacks.left?.();
        break;
      case 'ArrowRight':
        event.preventDefault();
        callbacks.right?.();
        break;
    }
  },
  
  // Focus management
  trapFocus: (containerRef: React.RefObject<HTMLElement>) => {
    const container = containerRef.current;
    if (!container) return;
    
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };
    
    container.addEventListener('keydown', handleTabKey);
    firstElement?.focus();
    
    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  },
} as const;

// Screen reader utilities
export const screenReader = {
  // Screen reader only text
  srOnly: 'sr-only',
  
  // Announce to screen readers
  announce: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  },
  
  // Create live region
  createLiveRegion: (id: string, priority: 'polite' | 'assertive' = 'polite') => {
    const existing = document.getElementById(id);
    if (existing) return existing;
    
    const liveRegion = document.createElement('div');
    liveRegion.id = id;
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    
    document.body.appendChild(liveRegion);
    return liveRegion;
  },
  
  // Update live region
  updateLiveRegion: (id: string, message: string) => {
    const liveRegion = document.getElementById(id);
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  },
} as const;

// Color contrast utilities
export const colorContrast = {
  // Calculate relative luminance
  getLuminance: (color: string): number => {
    // This is a simplified version - in production, you'd want a more robust color parser
    const rgb = color.match(/\d+/g);
    if (!rgb) return 0;
    
    const [r, g, b] = rgb.map(c => {
      const sRGB = parseInt(c) / 255;
      return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  },
  
  // Calculate contrast ratio
  getContrastRatio: (color1: string, color2: string): number => {
    const lum1 = colorContrast.getLuminance(color1);
    const lum2 = colorContrast.getLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    
    return (brightest + 0.05) / (darkest + 0.05);
  },
  
  // Check if contrast meets WCAG standards
  meetsWCAG: (color1: string, color2: string, level: 'AA' | 'AAA' = 'AA'): boolean => {
    const ratio = colorContrast.getContrastRatio(color1, color2);
    return level === 'AA' ? ratio >= 4.5 : ratio >= 7;
  },
} as const;

// Focus management utilities
export const focusManagement = {
  // Get all focusable elements
  getFocusableElements: (container: HTMLElement): HTMLElement[] => {
    const selector = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(', ');
    
    return Array.from(container.querySelectorAll(selector));
  },
  
  // Move focus to next/previous element
  moveFocus: (direction: 'next' | 'previous', container?: HTMLElement) => {
    const activeElement = document.activeElement as HTMLElement;
    const focusableElements = focusManagement.getFocusableElements(container || document.body);
    const currentIndex = focusableElements.indexOf(activeElement);
    
    let nextIndex: number;
    if (direction === 'next') {
      nextIndex = currentIndex + 1 >= focusableElements.length ? 0 : currentIndex + 1;
    } else {
      nextIndex = currentIndex - 1 < 0 ? focusableElements.length - 1 : currentIndex - 1;
    }
    
    focusableElements[nextIndex]?.focus();
  },
  
  // Save and restore focus
  saveFocus: (): (() => void) => {
    const activeElement = document.activeElement as HTMLElement;
    return () => {
      if (activeElement && typeof activeElement.focus === 'function') {
        activeElement.focus();
      }
    };
  },
} as const;

// Motion preferences
export const motionPreferences = {
  // Check if user prefers reduced motion
  prefersReducedMotion: (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },
  
  // Get animation duration based on motion preference
  getAnimationDuration: (normalDuration: string, reducedDuration: string = '0ms'): string => {
    return motionPreferences.prefersReducedMotion() ? reducedDuration : normalDuration;
  },
  
  // Create motion-safe animation
  motionSafe: (animation: object, fallback: object = {}): object => {
    return motionPreferences.prefersReducedMotion() ? fallback : animation;
  },
} as const;

// Accessibility testing utilities (for development)
export const a11yTesting = {
  // Check for missing alt text
  checkAltText: (): string[] => {
    const images = document.querySelectorAll('img');
    const issues: string[] = [];
    
    images.forEach((img, index) => {
      if (!img.alt && !img.getAttribute('aria-label') && !img.getAttribute('aria-labelledby')) {
        issues.push(`Image ${index + 1} is missing alt text`);
      }
    });
    
    return issues;
  },
  
  // Check for proper heading hierarchy
  checkHeadingHierarchy: (): string[] => {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const issues: string[] = [];
    let previousLevel = 0;
    
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1));
      
      if (index === 0 && level !== 1) {
        issues.push('Page should start with an h1 heading');
      }
      
      if (level > previousLevel + 1) {
        issues.push(`Heading level ${level} skips levels (previous was ${previousLevel})`);
      }
      
      previousLevel = level;
    });
    
    return issues;
  },
  
  // Check for keyboard accessibility
  checkKeyboardAccess: (): string[] => {
    const interactive = document.querySelectorAll('button, a, input, select, textarea, [tabindex]');
    const issues: string[] = [];
    
    interactive.forEach((element, index) => {
      const tabIndex = element.getAttribute('tabindex');
      if (tabIndex && parseInt(tabIndex) > 0) {
        issues.push(`Element ${index + 1} has positive tabindex, which can cause navigation issues`);
      }
      
      if (element.tagName === 'A' && !element.getAttribute('href')) {
        issues.push(`Link ${index + 1} is missing href attribute`);
      }
    });
    
    return issues;
  },
} as const;

// Export accessibility CSS classes
export const a11yClasses = {
  srOnly: 'sr-only',
  focusVisible: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  skipLink: 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:border focus:rounded-md',
  reducedMotion: 'motion-reduce:transition-none motion-reduce:animate-none',
  highContrast: 'contrast-more:border-2 contrast-more:border-current',
} as const;

// Utility function to combine accessibility props
export function combineA11yProps(...props: Array<Record<string, any>>): Record<string, any> {
  return props.reduce((combined, prop) => ({ ...combined, ...prop }), {});
}

// Hook for managing focus trap
export function useFocusTrap(isActive: boolean) {
  const containerRef = React.useRef<HTMLElement>(null);
  
  React.useEffect(() => {
    if (!isActive || !containerRef.current) return;
    
    return keyboardNavigation.trapFocus(containerRef as React.RefObject<HTMLElement>);
  }, [isActive]);
  
  return containerRef;
}

// Hook for announcing messages to screen readers
export function useScreenReaderAnnouncement() {
  const announce = React.useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    screenReader.announce(message, priority);
  }, []);
  
  return announce;
}

// Export React import for hooks
import * as React from 'react';