'use client';

/**
 * Horizontal Insumos Bar Component
 * Ingredient breakdown visualization
 * Adaptive Gastronomy Design System
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface InsumosBarProps {
  ingredients: Ingredient[];
  className?: string;
  variant?: 'default' | 'compact' | 'detailed';
  showQuantities?: boolean;
}

export interface Ingredient {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  color?: string;
  icon?: React.ReactNode;
}

/**
 * Horizontal Insumos Bar
 * Displays ingredient breakdown in a horizontal bar format
 */
export function InsumosBar({ 
  ingredients, 
  className,
  variant = 'default',
  showQuantities = true
}: InsumosBarProps) {
  const variantClasses = {
    default: 'p-3',
    compact: 'p-2',
    detailed: 'p-4',
  };

  return (
    <div
      className={cn(
        'bg-[var(--token-surface-base)]',
        'border border-[var(--token-border-subtle)]',
        'rounded-lg',
        variantClasses[variant],
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-[var(--token-text-secondary)] uppercase tracking-wide">
          Insumos
        </span>
        <div className="flex-1 h-px bg-[var(--token-border-subtle)]" />
      </div>
      
      <div className="flex flex-wrap gap-2">
        {ingredients.map((ingredient) => (
          <IngredientChip
            key={ingredient.id}
            ingredient={ingredient}
            variant={variant}
            showQuantity={showQuantities}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Ingredient Chip
 * Individual ingredient display within the bar
 */
function IngredientChip({ 
  ingredient, 
  variant,
  showQuantity 
}: { 
  ingredient: Ingredient; 
  variant: 'default' | 'compact' | 'detailed';
  showQuantity: boolean;
}) {
  const sizeClasses = {
    default: 'px-3 py-1.5 text-sm',
    compact: 'px-2 py-1 text-xs',
    detailed: 'px-4 py-2 text-sm',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1.5',
        'bg-[var(--token-surface-elevated)]',
        'border border-[var(--token-border-default)]',
        'rounded-full',
        'transition-all duration-200',
        'hover:shadow-sm hover:border-[var(--token-border-strong)]',
        sizeClasses[variant]
      )}
      style={{
        borderLeftColor: ingredient.color,
        borderLeftWidth: ingredient.color ? '3px' : undefined,
      }}
    >
      {ingredient.icon && (
        <span className="flex-shrink-0 text-[var(--token-text-secondary)]">
          {ingredient.icon}
        </span>
      )}
      
      <span className="font-medium text-[var(--token-text-primary)]">
        {ingredient.name}
      </span>
      
      {showQuantity && ingredient.quantity && (
        <span className="text-[var(--token-text-tertiary)] font-mono text-xs">
          {ingredient.quantity}{ingredient.unit}
        </span>
      )}
    </div>
  );
}
