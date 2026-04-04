'use client';

/**
 * Menu Catalog Component
 * Main menu display with category navigation using Floating Stack
 * Part of QR Menu Interface - Digital Menu System
 */

import React, { useState } from 'react';
import { FloatingStack, StackItem } from '@/components/design-system/layouts/floating-stack';
import { MenuItem } from './menu-item';
import { cn } from '@/lib/utils';

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  icon?: React.ReactNode;
  itemCount?: number;
}

export interface MenuItemData {
  id: string;
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  isAvailable: boolean;
  preparationTime: number;
  imageUrl?: string;
  allergens?: string[];
  recipe?: {
    ingredients: Array<{
      id: string;
      name: string;
      quantity: number;
      unit: string;
    }>;
  };
}

export interface MenuCatalogProps {
  categories: MenuCategory[];
  items: MenuItemData[];
  onItemSelect: (item: MenuItemData, quantity: number) => void;
  availabilityMap?: Map<string, any>;
  isRealTimeConnected?: boolean;
  className?: string;
}

/**
 * Menu Catalog
 * Displays menu items organized by categories with Floating Stack navigation
 */
export function MenuCatalog({
  categories,
  items,
  onItemSelect,
  availabilityMap,
  isRealTimeConnected = false,
  className
}: MenuCatalogProps) {
  const [activeCategory, setActiveCategory] = useState<string>(
    categories[0]?.id || ''
  );

  const filteredItems = items.filter(
    item => item.categoryId === activeCategory
  );

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Category Navigation */}
      <div className="sticky top-0 z-10 bg-[var(--token-surface-base)] pb-2">
        <FloatingStack orientation="horizontal" spacing="normal">
          {categories.map(category => (
            <StackItem
              key={category.id}
              active={activeCategory === category.id}
              onClick={() => setActiveCategory(category.id)}
              icon={category.icon}
              badge={category.itemCount}
            >
              {category.name}
            </StackItem>
          ))}
        </FloatingStack>
      </div>

      {/* Menu Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredItems.map(item => (
          <MenuItem
            key={item.id}
            item={item}
            onSelect={onItemSelect}
            realtimeAvailability={availabilityMap?.get(item.id)}
            isRealTimeConnected={isRealTimeConnected}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <p className="text-[var(--token-text-secondary)] text-lg">
            Nenhum item disponível nesta categoria
          </p>
        </div>
      )}
    </div>
  );
}
