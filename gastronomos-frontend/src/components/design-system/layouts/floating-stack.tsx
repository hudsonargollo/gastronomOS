'use client';

/**
 * Floating Stack Component
 * Layered navigation system for menus
 * Adaptive Gastronomy Design System
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export interface FloatingStackProps {
  children: React.ReactNode;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  spacing?: 'tight' | 'normal' | 'relaxed';
}

export interface StackItemProps {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  badge?: string | number;
}

/**
 * Floating Stack Container
 * Creates a floating navigation menu with stacked items
 */
export function FloatingStack({ 
  children, 
  className,
  orientation = 'horizontal',
  spacing = 'normal'
}: FloatingStackProps) {
  const orientationClasses = {
    horizontal: 'flex-row overflow-x-auto',
    vertical: 'flex-col overflow-y-auto',
  };

  const spacingClasses = {
    tight: 'gap-1',
    normal: 'gap-2',
    relaxed: 'gap-4',
  };

  return (
    <nav
      className={cn(
        'flex',
        'bg-[var(--token-surface-elevated)]',
        'border border-[var(--token-border-subtle)]',
        'rounded-xl p-2',
        'shadow-lg',
        orientationClasses[orientation],
        spacingClasses[spacing],
        className
      )}
    >
      {children}
    </nav>
  );
}

/**
 * Stack Item
 * Individual item within the Floating Stack
 */
export function StackItem({ 
  children, 
  className,
  active = false,
  onClick,
  icon,
  badge
}: StackItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-2',
        'px-4 py-2 rounded-lg',
        'transition-all duration-200',
        'whitespace-nowrap',
        'font-medium text-sm',
        active 
          ? 'bg-[var(--token-action-primary)] text-[var(--token-text-inverse)] shadow-md' 
          : 'bg-transparent text-[var(--token-text-primary)] hover:bg-[var(--token-interactive-hover)]',
        'focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus)]',
        className
      )}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
      {badge && (
        <span 
          className={cn(
            'absolute -top-1 -right-1',
            'flex items-center justify-center',
            'min-w-[20px] h-5 px-1.5',
            'text-xs font-bold',
            'bg-[var(--token-status-error)] text-white',
            'rounded-full',
            'shadow-sm'
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
