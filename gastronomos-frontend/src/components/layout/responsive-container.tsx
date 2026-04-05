'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  animate?: boolean;
}

export function ResponsiveContainer({ 
  children, 
  className,
  maxWidth = 'full',
  padding = 'md',
  animate = true
}: ResponsiveContainerProps) {
  const maxWidthClasses: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    '2xl': 'max-w-7xl',
    full: 'max-w-full'
  };

  const paddingClasses: Record<string, string> = {
    none: '',
    sm: 'p-2 sm:p-4',
    md: 'p-4 sm:p-6 lg:p-8',
    lg: 'p-6 sm:p-8 lg:p-12'
  };

  const containerClasses = [
    'mx-auto w-full',
    maxWidthClasses[maxWidth] || 'max-w-full',
    paddingClasses[padding] || '',
    className
  ].filter(Boolean).join(' ');

  if (!animate) {
    return <div className={containerClasses}>{children}</div>;
  }

  return (
    <motion.div
      className={containerClasses}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.4, 
        ease: [0.4, 0.0, 0.2, 1] 
      }}
      layout
    >
      {children}
    </motion.div>
  );
}

interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 'sm' | 'md' | 'lg';
  animate?: boolean;
}

export function ResponsiveGrid({ 
  children, 
  className,
  cols = { default: 1, md: 2, lg: 3 },
  gap = 'md',
  animate = true
}: ResponsiveGridProps) {
  const gapClasses: Record<string, string> = {
    sm: 'gap-2 sm:gap-4',
    md: 'gap-4 sm:gap-6',
    lg: 'gap-6 sm:gap-8'
  };

  // Use fixed grid layout based on lg column count
  let gridColsClass = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
  if (cols.lg === 2) {
    gridColsClass = 'grid-cols-1 md:grid-cols-2';
  } else if (cols.lg === 1) {
    gridColsClass = 'grid-cols-1';
  }

  const gridClasses = [
    'grid',
    gridColsClass,
    gapClasses[gap] || 'gap-4 sm:gap-6',
    className
  ].filter(Boolean).join(' ');

  if (!animate) {
    return <div className={gridClasses}>{children}</div>;
  }

  return (
    <motion.div
      className={gridClasses}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      layout
    >
      {Array.isArray(children) ? children.map((child, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 0.4, 
            delay: index * 0.1,
            ease: [0.4, 0.0, 0.2, 1]
          }}
          layout
        >
          {child}
        </motion.div>
      )) : children}
    </motion.div>
  );
}