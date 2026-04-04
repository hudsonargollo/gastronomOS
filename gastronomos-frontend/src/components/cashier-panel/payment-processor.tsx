'use client';

/**
 * Payment Processor Component
 * Main payment interface with method selection (Pix, credit, debit, manual, cash)
 * Requirements: 1.5, 5.1, 5.2, 6.1
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SketchWireIcon } from '@/components/design-system/sketch-wire-icon';
import { cn } from '@/lib/utils';

export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'MANUAL_CARD' | 'CASH';

export interface PaymentProcessorProps {
  orderId: string;
  orderNumber: string;
  totalAmount: number; // in cents
  remainingAmount?: number; // in cents, for split payments
  onPaymentMethodSelect: (method: PaymentMethod) => void;
  onCancel?: () => void;
  availableMethods?: PaymentMethod[];
  className?: string;
}

interface PaymentMethodOption {
  method: PaymentMethod;
  label: string;
  icon: string;
  description: string;
  color: string;
}

/**
 * Payment Processor
 * Displays available payment methods and handles method selection
 */
export function PaymentProcessor({
  orderId,
  orderNumber,
  totalAmount,
  remainingAmount,
  onPaymentMethodSelect,
  onCancel,
  availableMethods,
  className
}: PaymentProcessorProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  const amountToPay = remainingAmount !== undefined ? remainingAmount : totalAmount;
  const isSplitPayment = remainingAmount !== undefined && remainingAmount < totalAmount;

  const paymentMethods: PaymentMethodOption[] = [
    {
      method: 'PIX',
      label: 'Pix',
      icon: 'qr-code',
      description: 'QR Code - Pagamento instantâneo',
      color: 'bg-teal-500'
    },
    {
      method: 'CREDIT_CARD',
      label: 'Cartão de Crédito',
      icon: 'credit-card',
      description: 'Pagamento via gateway',
      color: 'bg-blue-500'
    },
    {
      method: 'DEBIT_CARD',
      label: 'Cartão de Débito',
      icon: 'credit-card',
      description: 'Pagamento via gateway',
      color: 'bg-green-500'
    },
    {
      method: 'MANUAL_CARD',
      label: 'Cartão Manual',
      icon: 'terminal',
      description: 'Máquina externa',
      color: 'bg-purple-500'
    },
    {
      method: 'CASH',
      label: 'Dinheiro',
      icon: 'cash',
      description: 'Pagamento em espécie',
      color: 'bg-amber-500'
    }
  ];

  // Filter methods if availableMethods is provided
  const displayMethods = availableMethods
    ? paymentMethods.filter(m => availableMethods.includes(m.method))
    : paymentMethods;

  const handleMethodClick = (method: PaymentMethod) => {
    setSelectedMethod(method);
  };

  const handleConfirm = () => {
    if (selectedMethod) {
      onPaymentMethodSelect(selectedMethod);
    }
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <SketchWireIcon name="payment" size={24} useAccent />
              Processar Pagamento
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Pedido #{orderNumber}
            </p>
          </div>
          {isSplitPayment && (
            <Badge variant="secondary">Pagamento Parcial</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Amount Display */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {isSplitPayment ? 'Valor Restante' : 'Valor Total'}
              </p>
              <p className="text-3xl font-bold text-[var(--token-action-primary)]">
                {formatCurrency(amountToPay)}
              </p>
            </div>
            {isSplitPayment && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total do Pedido</p>
                <p className="text-lg font-semibold">{formatCurrency(totalAmount)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Method Selection */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Selecione o Método de Pagamento</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {displayMethods.map((option) => (
              <button
                key={option.method}
                onClick={() => handleMethodClick(option.method)}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-lg border-2 transition-all',
                  'hover:shadow-md hover:scale-[1.02]',
                  selectedMethod === option.method
                    ? 'border-[var(--token-action-primary)] bg-[var(--token-action-primary)]/5'
                    : 'border-[var(--token-border-default)] bg-[var(--token-surface-base)]'
                )}
              >
                <div className={cn('p-2 rounded-lg', option.color)}>
                  <SketchWireIcon name={option.icon} size={20} className="text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-[var(--token-text-primary)]">
                    {option.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {option.description}
                  </p>
                </div>
                {selectedMethod === option.method && (
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 rounded-full bg-[var(--token-action-primary)] flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          {onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancelar
            </Button>
          )}
          <Button
            onClick={handleConfirm}
            disabled={!selectedMethod}
            className="flex-1"
            size="lg"
          >
            Continuar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
