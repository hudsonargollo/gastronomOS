/**
 * AnimatedPage Component
 * Wrapper component that provides consistent page transitions using Framer Motion
 */

'use client';

import React from 'react';
import { motion, AnimatePresence, Variants, Transition } from 'framer-motion';
import { pageTransitionVariants, transitions } from '@/lib/animation-utils';
import { performanceMonitor } from '@/lib/animation-config';

export interface AnimatedPageProps {
  children: React.ReactNode;
  transition?: Transition;
  initial?: string;
  animate?: string;
  exit?: string;
  className?: string;
  layoutId?: string;
  onAnimationStart?: () => void;
  onAnimationComplete?: () => void;
}

export function AnimatedPage({
  children,
  transition = transitions.default,
  initial = 'initial',
  animate = 'animate',
  exit = 'exit',
  className = '',
  layoutId,
  onAnimationStart,
  onAnimationComplete,
}: AnimatedPageProps) {
  React.useEffect(() => {
    // Start performance monitoring when page animations begin
    performanceMonitor.startMonitoring();
    
    return () => {
      // Clean up monitoring when component unmounts
      performanceMonitor.stopMonitoring();
    };
  }, []);

  const handleAnimationStart = () => {
    onAnimationStart?.();
  };

  const handleAnimationComplete = () => {
    onAnimationComplete?.();
  };

  return (
    <motion.div
      variants={pageTransitionVariants}
      initial={initial}
      animate={animate}
      exit={exit}
      transition={transition}
      className={`w-full h-full ${className}`}
      layoutId={layoutId}
      onAnimationStart={handleAnimationStart}
      onAnimationComplete={handleAnimationComplete}
    >
      {children}
    </motion.div>
  );
}

// Higher-order component for wrapping pages with animations
export function withPageAnimation<P extends object>(
  Component: React.ComponentType<P>,
  animationProps?: Partial<AnimatedPageProps>
) {
  const AnimatedComponent = (props: P) => {
    return (
      <AnimatedPage {...animationProps}>
        <Component {...props} />
      </AnimatedPage>
    );
  };

  AnimatedComponent.displayName = `withPageAnimation(${Component.displayName || Component.name})`;
  
  return AnimatedComponent;
}

// Page transition wrapper for use with Next.js App Router
export interface PageTransitionWrapperProps {
  children: React.ReactNode;
  pathname: string;
}

export function PageTransitionWrapper({ children, pathname }: PageTransitionWrapperProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <AnimatedPage key={pathname} layoutId="page-content">
        {children}
      </AnimatedPage>
    </AnimatePresence>
  );
}

// Specialized page variants for different types of pages
export const pageVariants = {
  dashboard: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.05 },
  },
  form: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  list: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  modal: {
    initial: { opacity: 0, scale: 0.9, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.9, y: 20 },
  },
};

// Specialized animated page components
export function DashboardPage({ children, ...props }: Omit<AnimatedPageProps, 'initial' | 'animate' | 'exit'>) {
  return (
    <AnimatedPage
      initial="initial"
      animate="animate"
      exit="exit"
      transition={transitions.smooth}
      {...props}
    >
      <motion.div variants={pageVariants.dashboard}>
        {children}
      </motion.div>
    </AnimatedPage>
  );
}

export function FormPage({ children, ...props }: Omit<AnimatedPageProps, 'initial' | 'animate' | 'exit'>) {
  return (
    <AnimatedPage
      initial="initial"
      animate="animate"
      exit="exit"
      transition={transitions.default}
      {...props}
    >
      <motion.div variants={pageVariants.form}>
        {children}
      </motion.div>
    </AnimatedPage>
  );
}

export function ListPage({ children, ...props }: Omit<AnimatedPageProps, 'initial' | 'animate' | 'exit'>) {
  return (
    <AnimatedPage
      initial="initial"
      animate="animate"
      exit="exit"
      transition={transitions.default}
      {...props}
    >
      <motion.div variants={pageVariants.list}>
        {children}
      </motion.div>
    </AnimatedPage>
  );
}