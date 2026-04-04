'use client';

/**
 * Order Submission Component
 * Order confirmation and submission interface with theme integration
 * Part of QR Menu Interface - Digital Menu System
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { CartItem } from './order-cart';

export interface OrderSubmissionProps {
  items: CartItem[];
  totalAmount: number;
  onSubmit: (data: OrderSubmissionData) => Promise<void>;
  onCancel: () => void;
  className?: string;
}

export interface OrderSubmissionData {
  tableNumber?: string;
  specialInstructions?: string;
  customerName?: string;
  items: CartItem[];
}

/**
 * Order Submission
 * Handles order confirmation and submission with customer details
 */
export function OrderSubmission({
  items,
  totalAmount,
  onSubmit,
  onCancel,
  className
}: OrderSubmissionProps) {
  const [tableNumber, setTableNumber] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price / 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit({
        tableNumber: tableNumber || undefined,
        specialInstructions: specialInstructions || undefined,
        customerName: customerName || undefined,
        items
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar pedido');
      setIsSubmitting(false);
    }
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

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
      <div className="p-6 border-b border-[var(--token-border-subtle)]">
        <h2 className="text-2xl font-bold text-[var(--token-text-primary)] mb-2">
          Confirmar Pedido
        </h2>
        <p className="text-[var(--token-text-secondary)]">
          Revise seu pedido e adicione informações adicionais
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Order Summary */}
        <div className="p-6 border-b border-[var(--token-border-subtle)]">
          <h3 className="text-lg font-semibold text-[var(--token-text-primary)] mb-4">
            Resumo do Pedido
          </h3>
          
          <div className="space-y-3">
            {items.map(item => (
              <div
                key={item.menuItemId}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex-1">
                  <span className="text-[var(--token-text-primary)] font-medium">
                    {item.quantity}x {item.name}
                  </span>
                  {item.specialInstructions && (
                    <p className="text-xs text-[var(--token-text-tertiary)] italic mt-0.5">
                      "{item.specialInstructions}"
                    </p>
                  )}
                </div>
                <span className="text-[var(--token-text-primary)] font-semibold ml-4">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--token-border-subtle)]">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-[var(--token-text-primary)]">
                Total ({totalItems} {totalItems === 1 ? 'item' : 'itens'})
              </span>
              <span className="text-2xl font-bold text-[var(--token-action-primary)]">
                {formatPrice(totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Customer Information */}
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-[var(--token-text-primary)] mb-4">
            Informações do Pedido
          </h3>

          {/* Customer Name */}
          <div className="space-y-2">
            <Label htmlFor="customerName">
              Nome (opcional)
            </Label>
            <Input
              id="customerName"
              type="text"
              placeholder="Seu nome"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Table Number */}
          <div className="space-y-2">
            <Label htmlFor="tableNumber">
              Número da Mesa (opcional)
            </Label>
            <Input
              id="tableNumber"
              type="text"
              placeholder="Ex: 12"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Special Instructions */}
          <div className="space-y-2">
            <Label htmlFor="specialInstructions">
              Observações Especiais (opcional)
            </Label>
            <Textarea
              id="specialInstructions"
              placeholder="Ex: Sem cebola, ponto da carne mal passado..."
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div
              className={cn(
                'p-3 rounded-lg',
                'bg-[var(--token-status-error-bg)]',
                'border border-[var(--token-status-error)]',
                'text-[var(--token-status-error)]',
                'text-sm'
              )}
            >
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-[var(--token-border-subtle)] bg-[var(--token-surface-base)]">
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1"
            >
              Voltar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? 'Enviando...' : 'Confirmar Pedido'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
