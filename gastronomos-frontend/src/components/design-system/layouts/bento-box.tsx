'use client';

/**
 * Bento Box Layout Component
 * Non-Grid Grid system for dashboard layouts
 * Adaptive Gastronomy Design System
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface BentoBoxProps {
  children: React.ReactNode;
  className?: string;
  columns?: 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
}

export interface BentoItemProps {
  children: React.ReactNode;
  className?: string;
  span?: 1 | 2 | 3 | 4;
  rowSpan?: 1 | 2 | 3;
  variant?: 'default' | 'elevated' | 'outlined';
}

/**
 * Bento Box Container
 * Creates a flexible grid-like layout with asymmetric sizing
 */
export function BentoBox({ 
  children, 
  className,
  columns = 3,
  gap = 'md'
}: BentoBoxProps) {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };

  const columnClasses = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  };

  return (
    <div 
      className={cn(
        'grid w-full',
        columnClasses[columns],
        gapClasses[gap],
        'auto-rows-min',
        className
      )}
      style={{
        gridAutoFlow: 'dense',
      }}
    >
      {children}
    </div>
  );
}

/**
 * Bento Box Item
 * Individual cell within the Bento Box layout
 */
export function BentoItem({ 
  children, 
  className,
  span = 1,
  rowSpan = 1,
  variant = 'default'
}: BentoItemProps) {
  const spanClasses = {
    1: 'col-span-1',
    2: 'col-span-2',
    3: 'col-span-3',
    4: 'col-span-4',
  };

  const rowSpanClasses = {
    1: 'row-span-1',
    2: 'row-span-2',
    3: 'row-span-3',
  };

  const variantClasses = {
    default: 'bg-[var(--token-surface-base)] border border-[var(--token-border-subtle)]',
    elevated: 'bg-[var(--token-surface-elevated)] shadow-md border border-[var(--token-border-subtle)]',
    outlined: 'bg-transparent border-2 border-[var(--token-border-default)]',
  };

  return (
    <div
      className={cn(
        'rounded-lg p-4',
        'transition-all duration-200',
        'hover:shadow-lg hover:border-[var(--token-border-default)]',
        spanClasses[span],
        rowSpanClasses[rowSpan],
        variantClasses[variant],
        className
      )}
    >
      {children}
    </div>
  );
}
