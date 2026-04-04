/**
 * Interactive Element Styles
 * Provides uniform styling for interactive states across all components
 */

import { cva, type VariantProps } from 'class-variance-authority';
import { designTokens } from './design-tokens';
import { cn } from './utils';

// Base interactive element styles
export const interactiveBase = cva(
  [
    // Base styles
    'relative',
    'transition-all',
    'duration-150',
    'ease-out',
    
    // Focus styles
    'outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-ring',
    'focus-visible:ring-offset-2',
    'focus-visible:ring-offset-background',
    
    // Disabled styles
    'disabled:pointer-events-none',
    'disabled:opacity-60',
    'disabled:cursor-not-allowed',
    
    // Accessibility
    'touch-target', // Ensures minimum 44px touch target
  ],
  {
    variants: {
      variant: {
        default: [
          'bg-primary',
          'text-primary-foreground',
          'hover:bg-primary/90',
          'active:bg-primary/95',
        ],
        secondary: [
          'bg-secondary',
          'text-secondary-foreground',
          'hover:bg-secondary/80',
          'active:bg-secondary/90',
        ],
        outline: [
          'border',
          'border-input',
          'bg-background',
          'hover:bg-accent',
          'hover:text-accent-foreground',
          'active:bg-accent/90',
        ],
        ghost: [
          'hover:bg-accent',
          'hover:text-accent-foreground',
          'active:bg-accent/90',
        ],
        destructive: [
          'bg-destructive',
          'text-destructive-foreground',
          'hover:bg-destructive/90',
          'active:bg-destructive/95',
        ],
        success: [
          'bg-green-600',
          'text-white',
          'hover:bg-green-700',
          'active:bg-green-800',
        ],
        warning: [
          'bg-yellow-600',
          'text-white',
          'hover:bg-yellow-700',
          'active:bg-yellow-800',
        ],
        info: [
          'bg-blue-600',
          'text-white',
          'hover:bg-blue-700',
          'active:bg-blue-800',
        ],
      },
      size: {
        sm: [
          'h-8',
          'px-3',
          'text-sm',
          'rounded-md',
        ],
        default: [
          'h-9',
          'px-4',
          'py-2',
          'text-sm',
          'rounded-md',
        ],
        lg: [
          'h-10',
          'px-6',
          'text-base',
          'rounded-md',
        ],
        xl: [
          'h-12',
          'px-8',
          'text-lg',
          'rounded-lg',
        ],
        icon: [
          'h-9',
          'w-9',
          'p-0',
          'rounded-md',
        ],
      },
      state: {
        default: '',
        loading: [
          'cursor-wait',
          'opacity-70',
        ],
        success: [
          'bg-green-600',
          'text-white',
        ],
        error: [
          'bg-red-600',
          'text-white',
          'animate-pulse',
        ],
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      state: 'default',
    },
  }
);

// Input field styles
export const inputStyles = cva(
  [
    // Base styles
    'flex',
    'w-full',
    'rounded-md',
    'border',
    'border-input',
    'bg-transparent',
    'px-3',
    'py-1',
    'text-base',
    'shadow-sm',
    'transition-all',
    'duration-150',
    
    // Placeholder styles
    'placeholder:text-muted-foreground',
    
    // Focus styles
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-ring',
    'focus-visible:ring-offset-0',
    
    // Disabled styles
    'disabled:cursor-not-allowed',
    'disabled:opacity-50',
    
    // File input styles
    'file:border-0',
    'file:bg-transparent',
    'file:text-sm',
    'file:font-medium',
    'file:text-foreground',
    
    // Selection styles
    'selection:bg-primary',
    'selection:text-primary-foreground',
    
    // Mobile optimization
    'md:text-sm',
  ],
  {
    variants: {
      variant: {
        default: '',
        filled: [
          'bg-muted/50',
          'border-transparent',
          'focus-visible:bg-background',
          'focus-visible:border-ring',
        ],
        underlined: [
          'border-0',
          'border-b-2',
          'border-input',
          'rounded-none',
          'px-0',
          'focus-visible:border-ring',
        ],
      },
      size: {
        sm: [
          'h-8',
          'px-2',
          'text-sm',
        ],
        default: [
          'h-9',
          'px-3',
        ],
        lg: [
          'h-10',
          'px-4',
          'text-base',
        ],
      },
      state: {
        default: '',
        error: [
          'border-destructive',
          'focus-visible:ring-destructive',
          'text-destructive',
        ],
        success: [
          'border-green-500',
          'focus-visible:ring-green-500',
        ],
        warning: [
          'border-yellow-500',
          'focus-visible:ring-yellow-500',
        ],
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      state: 'default',
    },
  }
);

// Card styles
export const cardStyles = cva(
  [
    'rounded-xl',
    'border',
    'bg-card',
    'text-card-foreground',
    'shadow-sm',
    'transition-all',
    'duration-200',
  ],
  {
    variants: {
      variant: {
        default: '',
        elevated: [
          'shadow-md',
          'hover:shadow-lg',
        ],
        outlined: [
          'border-2',
          'shadow-none',
        ],
        filled: [
          'bg-muted/50',
          'border-transparent',
        ],
      },
      interactive: {
        true: [
          'cursor-pointer',
          'hover:shadow-md',
          'hover:scale-[1.02]',
          'active:scale-[0.98]',
          'focus-visible:outline-none',
          'focus-visible:ring-2',
          'focus-visible:ring-ring',
          'focus-visible:ring-offset-2',
        ],
        false: '',
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        default: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      interactive: false,
      padding: 'default',
    },
  }
);

// Badge styles
export const badgeStyles = cva(
  [
    'inline-flex',
    'items-center',
    'rounded-md',
    'border',
    'px-2.5',
    'py-0.5',
    'text-xs',
    'font-semibold',
    'transition-colors',
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-ring',
    'focus:ring-offset-2',
  ],
  {
    variants: {
      variant: {
        default: [
          'border-transparent',
          'bg-primary',
          'text-primary-foreground',
          'shadow',
          'hover:bg-primary/80',
        ],
        secondary: [
          'border-transparent',
          'bg-secondary',
          'text-secondary-foreground',
          'hover:bg-secondary/80',
        ],
        destructive: [
          'border-transparent',
          'bg-destructive',
          'text-destructive-foreground',
          'shadow',
          'hover:bg-destructive/80',
        ],
        outline: [
          'text-foreground',
          'hover:bg-accent',
          'hover:text-accent-foreground',
        ],
        success: [
          'border-transparent',
          'bg-green-600',
          'text-white',
          'shadow',
          'hover:bg-green-700',
        ],
        warning: [
          'border-transparent',
          'bg-yellow-600',
          'text-white',
          'shadow',
          'hover:bg-yellow-700',
        ],
        info: [
          'border-transparent',
          'bg-blue-600',
          'text-white',
          'shadow',
          'hover:bg-blue-700',
        ],
      },
      size: {
        sm: [
          'px-2',
          'py-0.5',
          'text-xs',
        ],
        default: [
          'px-2.5',
          'py-0.5',
          'text-xs',
        ],
        lg: [
          'px-3',
          'py-1',
          'text-sm',
        ],
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

// Navigation item styles
export const navigationStyles = cva(
  [
    'flex',
    'items-center',
    'gap-2',
    'rounded-lg',
    'px-3',
    'py-2',
    'text-sm',
    'font-medium',
    'transition-all',
    'duration-150',
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-ring',
    'focus-visible:ring-offset-2',
    'mobile-nav-item', // Custom utility class
  ],
  {
    variants: {
      variant: {
        default: [
          'text-muted-foreground',
          'hover:bg-accent',
          'hover:text-accent-foreground',
        ],
        active: [
          'bg-accent',
          'text-accent-foreground',
        ],
        ghost: [
          'hover:bg-accent/50',
          'hover:text-accent-foreground',
        ],
      },
      size: {
        sm: [
          'px-2',
          'py-1.5',
          'text-xs',
        ],
        default: [
          'px-3',
          'py-2',
          'text-sm',
        ],
        lg: [
          'px-4',
          'py-3',
          'text-base',
        ],
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

// Loading state styles
export const loadingStyles = cva(
  [
    'animate-pulse',
    'bg-muted',
    'rounded',
  ],
  {
    variants: {
      variant: {
        text: [
          'h-4',
          'bg-muted',
        ],
        avatar: [
          'rounded-full',
        ],
        button: [
          'h-9',
          'w-20',
        ],
        card: [
          'h-32',
          'w-full',
        ],
      },
    },
    defaultVariants: {
      variant: 'text',
    },
  }
);

// Utility functions for creating consistent interactive styles
export const createInteractiveStyles = {
  // Create hover effect
  hover: (intensity: 'subtle' | 'medium' | 'strong' = 'medium') => {
    const intensityMap = {
      subtle: 'hover:bg-accent/50',
      medium: 'hover:bg-accent',
      strong: 'hover:bg-accent hover:scale-105',
    };
    return intensityMap[intensity];
  },

  // Create focus ring
  focusRing: (color: string = 'ring') => cn(
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    `focus-visible:ring-${color}`,
    'focus-visible:ring-offset-2'
  ),

  // Create disabled state
  disabled: () => cn(
    'disabled:pointer-events-none',
    'disabled:opacity-50',
    'disabled:cursor-not-allowed'
  ),

  // Create loading state
  loading: () => cn(
    'cursor-wait',
    'opacity-70',
    'pointer-events-none'
  ),

  // Create pressed/active state
  pressed: () => cn(
    'active:scale-95',
    'active:brightness-95'
  ),
};

// Animation variants for interactive elements
export const interactiveAnimations = {
  button: {
    initial: { scale: 1 },
    hover: { scale: 1.02 },
    tap: { scale: 0.98 },
    disabled: { scale: 1, opacity: 0.6 },
  },
  
  card: {
    initial: { scale: 1, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' },
    hover: { 
      scale: 1.02, 
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    },
    tap: { scale: 0.98 },
  },
  
  input: {
    initial: { scale: 1 },
    focus: { scale: 1.01 },
    error: { 
      x: [-2, 2, -2, 2, 0],
      transition: { duration: 0.4 }
    },
  },
  
  navigation: {
    initial: { x: 0 },
    hover: { x: 4 },
    active: { x: 8 },
  },
  
  badge: {
    initial: { scale: 1 },
    hover: { scale: 1.05 },
    tap: { scale: 0.95 },
  },
};

// Export types for TypeScript support
export type InteractiveVariant = VariantProps<typeof interactiveBase>['variant'];
export type InteractiveSize = VariantProps<typeof interactiveBase>['size'];
export type InteractiveState = VariantProps<typeof interactiveBase>['state'];
export type InputVariant = VariantProps<typeof inputStyles>['variant'];
export type CardVariant = VariantProps<typeof cardStyles>['variant'];
export type BadgeVariant = VariantProps<typeof badgeStyles>['variant'];
export type NavigationVariant = VariantProps<typeof navigationStyles>['variant'];