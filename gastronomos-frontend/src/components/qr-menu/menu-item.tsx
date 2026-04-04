'use client';

/**
 * Menu Item Component
 * Individual menu item display using Asymmetric Cards
 * Part of QR Menu Interface - Digital Menu System
 */

import React, { useState } from 'react';
import {
  AsymmetricCard,
  CardHeader,
  CardContent,
  CardFooter
} from '@/components/design-system/layouts/asymmetric-card';
import { InsumosBar } from '@/components/design-system/layouts/insumos-bar';
import { AvailabilityIndicator } from './availability-indicator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MenuItemData } from './menu-catalog';

export interface MenuItemProps {
  item: MenuItemData;
  onSelect: (item: MenuItemData, quantity: number) => void;
  realtimeAvailability?: {
    isAvailable: boolean;
    reason?: 'OUT_OF_STOCK' | 'MANUAL_OVERRIDE' | 'PREPARATION_CAPACITY' | 'RESTORED';
    estimatedAvailableAt?: number;
  };
  isRealTimeConnected?: boolean;
  className?: string;
}

/**
 * Menu Item
 * Displays individual menu item with ingredients and availability
 */
export function MenuItem({ 
  item, 
  onSelect, 
  realtimeAvailability,
  isRealTimeConnected = false,
  className 
}: MenuItemProps) {
  const [quantity, setQuantity] = useState(1);

  // Use real-time availability if provided, otherwise fall back to item's availability
  const isAvailable = realtimeAvailability?.isAvailable ?? item.isAvailable;

  const handleAddToCart = () => {
    if (isAvailable) {
      onSelect(item, quantity);
      setQuantity(1); // Reset quantity after adding
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price / 100);
  };

  return (
    <AsymmetricCard
      variant="default"
      imagePosition="top"
      image={item.imageUrl}
      imageAlt={item.name}
      className={cn(
        !isAvailable && 'opacity-60',
        className
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-[var(--token-text-primary)] mb-1">
              {item.name}
            </h3>
            {item.description && (
              <p className="text-sm text-[var(--token-text-secondary)] line-clamp-2">
                {item.description}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xl font-bold text-[var(--token-action-primary)]">
              {formatPrice(item.price)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Real-time Availability Indicator */}
        <AvailabilityIndicator
          isAvailable={isAvailable}
          preparationTime={item.preparationTime}
          reason={realtimeAvailability?.reason}
          estimatedAvailableAt={realtimeAvailability?.estimatedAvailableAt}
          isRealTimeConnected={isRealTimeConnected}
          className="mb-3"
        />

        {/* Allergens */}
        {item.allergens && item.allergens.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-[var(--token-text-tertiary)] mb-1">
              Alérgenos:
            </p>
            <div className="flex flex-wrap gap-1">
              {item.allergens.map((allergen, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {allergen}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Ingredients Breakdown */}
        {item.recipe?.ingredients && item.recipe.ingredients.length > 0 && (
          <InsumosBar
            ingredients={item.recipe.ingredients.map(ing => ({
              id: ing.id,
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit
            }))}
            variant="compact"
            showQuantities={true}
          />
        )}
      </CardContent>

      <CardFooter>
        <div className="flex items-center gap-3 w-full">
          {/* Quantity Selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={!isAvailable || quantity <= 1}
              className={cn(
                'w-8 h-8 rounded-lg',
                'flex items-center justify-center',
                'bg-[var(--token-surface-elevated)]',
                'border border-[var(--token-border-default)]',
                'text-[var(--token-text-primary)]',
                'hover:bg-[var(--token-interactive-hover)]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors'
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="w-8 text-center font-semibold text-[var(--token-text-primary)]">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              disabled={!isAvailable}
              className={cn(
                'w-8 h-8 rounded-lg',
                'flex items-center justify-center',
                'bg-[var(--token-surface-elevated)]',
                'border border-[var(--token-border-default)]',
                'text-[var(--token-text-primary)]',
                'hover:bg-[var(--token-interactive-hover)]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors'
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Add to Cart Button */}
          <Button
            onClick={handleAddToCart}
            disabled={!isAvailable}
            className="flex-1"
            size="sm"
          >
            {isAvailable ? 'Adicionar' : 'Indisponível'}
          </Button>
        </div>
      </CardFooter>
    </AsymmetricCard>
  );
}
