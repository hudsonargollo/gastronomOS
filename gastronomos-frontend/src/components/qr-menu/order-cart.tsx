'use client';

/**
 * Order Cart Component
 * Shopping cart with real-time total calculation
 * Part of QR Menu Interface - Digital Menu System
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  specialInstructions?: string;
}

export interface OrderCartProps {
  items: CartItem[];
  onUpdateQuantity: (menuItemId: string, quantity: number) => void;
  onRemoveItem: (menuItemId: string) => void;
  onCheckout: () => void;
  onAddInstructions?: (menuItemId: string, instructions: string) => void;
  className?: string;
}

/**
 * Order Cart
 * Displays cart items with real-time total calculation
 */
export function OrderCart({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  onAddInstructions,
  className
}: OrderCartProps) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price / 100);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  if (items.length === 0) {
    return (
      <div
        className={cn(
          'bg-[var(--token-surface-elevated)]',
          'border border-[var(--token-border-subtle)]',
          'rounded-lg p-6',
          'text-center',
          className
        )}
      >
        <svg
          className="w-16 h-16 mx-auto mb-4 text-[var(--token-text-tertiary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <p className="text-[var(--token-text-secondary)] text-lg font-medium">
          Seu prato está vazio
        </p>
        <p className="text-[var(--token-text-tertiary)] text-sm mt-1">
          Adicione itens do menu para começar seu pedido
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-[var(--token-surface-elevated)]',
        'border border-[var(--token-border-subtle)]',
        'rounded-lg overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-[var(--token-border-subtle)]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--token-text-primary)]">
            Seu Pedido
          </h3>
          <Badge variant="secondary">
            {totalItems} {totalItems === 1 ? 'item' : 'itens'}
          </Badge>
        </div>
      </div>

      {/* Cart Items */}
      <div className="divide-y divide-[var(--token-border-subtle)] max-h-96 overflow-y-auto">
        {items.map(item => (
          <div key={item.menuItemId} className="p-4">
            <div className="flex items-start gap-3">
              {/* Item Details */}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-[var(--token-text-primary)] mb-1">
                  {item.name}
                </h4>
                <p className="text-sm text-[var(--token-text-secondary)]">
                  {formatPrice(item.price)} × {item.quantity}
                </p>
                {item.specialInstructions && (
                  <p className="text-xs text-[var(--token-text-tertiary)] mt-1 italic">
                    "{item.specialInstructions}"
                  </p>
                )}
              </div>

              {/* Price */}
              <div className="text-right">
                <p className="font-bold text-[var(--token-text-primary)]">
                  {formatPrice(item.price * item.quantity)}
                </p>
              </div>
            </div>

            {/* Quantity Controls */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => onUpdateQuantity(item.menuItemId, item.quantity - 1)}
                disabled={item.quantity <= 1}
                className={cn(
                  'w-7 h-7 rounded-lg',
                  'flex items-center justify-center',
                  'bg-[var(--token-surface-base)]',
                  'border border-[var(--token-border-default)]',
                  'text-[var(--token-text-primary)]',
                  'hover:bg-[var(--token-interactive-hover)]',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors'
                )}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="w-6 text-center text-sm font-semibold text-[var(--token-text-primary)]">
                {item.quantity}
              </span>
              <button
                onClick={() => onUpdateQuantity(item.menuItemId, item.quantity + 1)}
                className={cn(
                  'w-7 h-7 rounded-lg',
                  'flex items-center justify-center',
                  'bg-[var(--token-surface-base)]',
                  'border border-[var(--token-border-default)]',
                  'text-[var(--token-text-primary)]',
                  'hover:bg-[var(--token-interactive-hover)]',
                  'transition-colors'
                )}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>

              <div className="flex-1" />

              {/* Remove Button */}
              <button
                onClick={() => onRemoveItem(item.menuItemId)}
                className={cn(
                  'text-xs text-[var(--token-status-error)]',
                  'hover:underline',
                  'transition-colors'
                )}
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer with Total and Checkout */}
      <div className="p-4 border-t border-[var(--token-border-subtle)] bg-[var(--token-surface-base)]">
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg font-semibold text-[var(--token-text-primary)]">
            Total
          </span>
          <span className="text-2xl font-bold text-[var(--token-action-primary)]">
            {formatPrice(subtotal)}
          </span>
        </div>

        <Button
          onClick={onCheckout}
          className="w-full"
          size="lg"
        >
          Finalizar Pedido
        </Button>
      </div>
    </div>
  );
}
