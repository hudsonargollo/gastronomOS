/**
 * Animation Utilities
 * Provides consistent animation variants and utilities for the application
 */

import { Variants, Transition } from 'framer-motion';
import { getOptimizedTransition, getSpringTransition } from './animation-config';

// Common animation variants
export const fadeInOut: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const slideInFromRight: Variants = {
  initial: { x: '100%', opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: '100%', opacity: 0 },
};

export const slideInFromLeft: Variants = {
  initial: { x: '-100%', opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: '-100%', opacity: 0 },
};

export const slideInFromTop: Variants = {
  initial: { y: '-100%', opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: '-100%', opacity: 0 },
};

export const slideInFromBottom: Variants = {
  initial: { y: '100%', opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: '-100%', opacity: 0 },
};

export const scaleInOut: Variants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.8, opacity: 0 },
};

export const modalVariants: Variants = {
  initial: { scale: 0.9, opacity: 0, y: 20 },
  animate: { scale: 1, opacity: 1, y: 0 },
  exit: { scale: 0.9, opacity: 0, y: 20 },
};

export const listItemVariants: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -20, scale: 0.95 },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

// Page transition variants
export const pageTransitionVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

// Interactive element variants
export const buttonVariants: Variants = {
  initial: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.98 },
  disabled: { scale: 1, opacity: 0.6 },
};

export const cardVariants: Variants = {
  initial: { scale: 1, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' },
  hover: { 
    scale: 1.02, 
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    transition: getSpringTransition({ stiffness: 400, damping: 25 })
  },
};

// Loading animation variants
export const spinnerVariants: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

export const pulseVariants: Variants = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [0.7, 1, 0.7],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const skeletonVariants: Variants = {
  animate: {
    opacity: [0.5, 1, 0.5],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// Utility functions for creating custom animations
export function createSlideVariants(direction: 'left' | 'right' | 'up' | 'down', distance = 100): Variants {
  const getInitialPosition = () => {
    switch (direction) {
      case 'left': return { x: -distance, opacity: 0 };
      case 'right': return { x: distance, opacity: 0 };
      case 'up': return { y: -distance, opacity: 0 };
      case 'down': return { y: distance, opacity: 0 };
    }
  };

  return {
    initial: getInitialPosition(),
    animate: { x: 0, y: 0, opacity: 1 },
    exit: getInitialPosition(),
  };
}

export function createStaggeredAnimation(staggerDelay = 0.1): Variants {
  return {
    initial: {},
    animate: {
      transition: {
        staggerChildren: staggerDelay,
      },
    },
    exit: {
      transition: {
        staggerChildren: staggerDelay / 2,
        staggerDirection: -1,
      },
    },
  };
}

export function createBounceVariants(intensity = 1.1): Variants {
  return {
    initial: { scale: 1 },
    animate: { 
      scale: [1, intensity, 1],
      transition: {
        duration: 0.6,
        times: [0, 0.5, 1],
        ease: 'easeInOut',
      },
    },
  };
}

// Transition presets
export const transitions = {
  default: getOptimizedTransition(),
  fast: getOptimizedTransition(0.15),
  slow: getOptimizedTransition(0.5),
  spring: getSpringTransition(),
  bouncy: getSpringTransition({ stiffness: 400, damping: 10 }),
  smooth: getSpringTransition({ stiffness: 100, damping: 20 }),
};

// Animation direction utilities
export type AnimationDirection = 'left' | 'right' | 'up' | 'down';

export function getDirectionalVariants(direction: AnimationDirection): Variants {
  switch (direction) {
    case 'left': return slideInFromLeft;
    case 'right': return slideInFromRight;
    case 'up': return slideInFromTop;
    case 'down': return slideInFromBottom;
  }
}

// Responsive animation utilities
export function getResponsiveVariants(isMobile: boolean): Variants {
  if (isMobile) {
    // Simpler animations for mobile
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }
  
  return pageTransitionVariants;
}

// Animation composition utilities
export function combineVariants(...variants: Variants[]): Variants {
  return variants.reduce((combined, variant) => {
    return {
      ...combined,
      initial: { ...combined.initial, ...variant.initial },
      animate: { ...combined.animate, ...variant.animate },
      exit: { ...combined.exit, ...variant.exit },
    };
  }, { initial: {}, animate: {}, exit: {} });
}