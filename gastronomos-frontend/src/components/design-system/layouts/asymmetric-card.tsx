'use client';

/**
 * Asymmetric Card Component
 * Non-uniform content display cards
 * Adaptive Gastronomy Design System
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface AsymmetricCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'featured' | 'compact';
  imagePosition?: 'left' | 'right' | 'top' | 'bottom';
  image?: string;
  imageAlt?: string;
  onClick?: () => void;
}

export interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Asymmetric Card
 * Creates visually interesting cards with non-uniform layouts
 */
export function AsymmetricCard({ 
  children, 
  className,
  variant = 'default',
  imagePosition = 'top',
  image,
  imageAlt = '',
  onClick
}: AsymmetricCardProps) {
  const variantClasses = {
    default: 'p-4',
    featured: 'p-6',
    compact: 'p-3',
  };

  const layoutClasses = {
    left: 'flex-row',
    right: 'flex-row-reverse',
    top: 'flex-col',
    bottom: 'flex-col-reverse',
  };

  const isHorizontal = imagePosition === 'left' || imagePosition === 'right';

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex',
        'bg-[var(--token-surface-elevated)]',
        'border border-[var(--token-border-subtle)]',
        'rounded-lg overflow-hidden',
        'transition-all duration-200',
        'hover:shadow-lg hover:border-[var(--token-border-default)]',
        onClick && 'cursor-pointer',
        layoutClasses[imagePosition],
        variantClasses[variant],
        className
      )}
    >
      {image && (
        <div 
          className={cn(
            'relative overflow-hidden',
            isHorizontal ? 'w-1/3 flex-shrink-0' : 'w-full h-48',
            variant === 'featured' && !isHorizontal && 'h-64',
            variant === 'compact' && !isHorizontal && 'h-32'
          )}
        >
          <img 
            src={image} 
            alt={imageAlt}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className={cn('flex-1', image && isHorizontal && 'pl-4')}>
        {children}
      </div>
    </div>
  );
}

/**
 * Card Header
 * Header section of the card
 */
export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn('mb-3', className)}>
      {children}
    </div>
  );
}

/**
 * Card Content
 * Main content section of the card
 */
export function CardContent({ children, className }: CardContentProps) {
  return (
    <div className={cn('text-[var(--token-text-secondary)] text-sm', className)}>
      {children}
    </div>
  );
}

/**
 * Card Footer
 * Footer section of the card
 */
export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={cn('mt-4 pt-3 border-t border-[var(--token-border-subtle)]', className)}>
      {children}
    </div>
  );
}
