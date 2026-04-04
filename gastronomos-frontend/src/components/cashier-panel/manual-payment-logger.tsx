'use client';

/**
 * Manual Payment Logger Component
 * Interface for logging external machine payments
 * Requirements: 6.1, 6.2, 6.3
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SketchWireIcon } from '@/components/design-system/sketch-wire-icon';
import { cn } from '@/lib/utils';

export interface ManualPaymentData {
  method: 'MANUAL_CARD' | 'CASH';
  amount: number; // in cents
  referenceNumber: string;
  notes?: string;
}

export interface ManualPaymentLoggerProps {
  orderId: string;
  orderNumber: string;
  orderTotal: number; // in cents
  remainingAmount?: number; // in cents, for split payments
  onSubmit: (data: ManualPaymentData) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  className?: string;
}

/**
 * Manual Payment Logger
 * Form for logging payments made through external card machines or cash
 */
export function ManualPaymentLogger({
  orderId,
  orderNumber,
  orderTotal,
  remainingAmount,
  onSubmit,
  onCancel,
  isSubmitting = false,
  className
}: ManualPaymentLoggerProps) {
  const [method, setMethod] = useState<'MANUAL_CARD' | 'CASH'>('MANUAL_CARD');
  const [amount, setAmount] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const amountToPay = remainingAmount !== undefined ? remainingAmount : orderTotal;
  const isSplitPayment = remainingAmount !== undefined && remainingAmount < orderTotal;

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  const parseCurrency = (value: string): number => {
    // Remove non-numeric characters except comma and dot
    const cleaned = value.replace(/[^\d,.-]/g, '');
    // Replace comma with dot for parsing
    const normalized = cleaned.replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const amountCents = parseCurrency(amount);
    if (!amount || amountCents <= 0) {
      newErrors.amount = 'Valor deve ser maior que zero';
    }

    if (!referenceNumber.trim()) {
      newErrors.referenceNumber = 'Número de referência é obrigatório';
    } else if (referenceNumber.trim().length < 3) {
      newErrors.referenceNumber = 'Número de referência deve ter pelo menos 3 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const amountCents = parseCurrency(amount);

    const data: ManualPaymentData = {
      method,
      amount: amountCents,
      referenceNumber: referenceNumber.trim(),
      notes: notes.trim() || undefined
    };

    await onSubmit(data);
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    if (errors.amount) {
      setErrors({ ...errors, amount: '' });
    }
  };

  const handleReferenceChange = (value: string) => {
    setReferenceNumber(value);
    if (errors.referenceNumber) {
      setErrors({ ...errors, referenceNumber: '' });
    }
  };

  const fillOrderAmount = () => {
    setAmount(formatCurrency(amountToPay));
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <SketchWireIcon name="terminal" size={24} useAccent />
              Registrar Pagamento Manual
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

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Amount Display */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {isSplitPayment ? 'Valor Restante' : 'Valor Total do Pedido'}
                </p>
                <p className="text-2xl font-bold text-[var(--token-action-primary)]">
                  {formatCurrency(amountToPay)}
                </p>
              </div>
              {isSplitPayment && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-semibold">{formatCurrency(orderTotal)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-3">
            <Label>Método de Pagamento</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMethod('MANUAL_CARD')}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
                  method === 'MANUAL_CARD'
                    ? 'border-[var(--token-action-primary)] bg-[var(--token-action-primary)]/5'
                    : 'border-[var(--token-border-default)] bg-[var(--token-surface-base)]'
                )}
              >
                <div className="p-2 rounded-lg bg-purple-500">
                  <SketchWireIcon name="creditCard" size={20} className="text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold">Cartão</p>
                  <p className="text-xs text-muted-foreground">Máquina externa</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMethod('CASH')}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
                  method === 'CASH'
                    ? 'border-[var(--token-action-primary)] bg-[var(--token-action-primary)]/5'
                    : 'border-[var(--token-border-default)] bg-[var(--token-surface-base)]'
                )}
              >
                <div className="p-2 rounded-lg bg-amber-500">
                  <SketchWireIcon name="cash" size={20} className="text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold">Dinheiro</p>
                  <p className="text-xs text-muted-foreground">Pagamento em espécie</p>
                </div>
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">Valor Pago *</Label>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={fillOrderAmount}
                className="h-auto p-0 text-xs"
              >
                Usar valor do pedido
              </Button>
            </div>
            <Input
              id="amount"
              type="text"
              placeholder="R$ 0,00"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              className={cn(errors.amount && 'border-red-500')}
            />
            {errors.amount && (
              <p className="text-sm text-red-500">{errors.amount}</p>
            )}
          </div>

          {/* Reference Number Input */}
          <div className="space-y-2">
            <Label htmlFor="reference">
              Número de Referência *
              {method === 'MANUAL_CARD' && (
                <span className="text-xs text-muted-foreground ml-2">
                  (NSU, Autorização, etc.)
                </span>
              )}
            </Label>
            <Input
              id="reference"
              type="text"
              placeholder={method === 'MANUAL_CARD' ? 'Ex: 123456789' : 'Ex: CAIXA-001'}
              value={referenceNumber}
              onChange={(e) => handleReferenceChange(e.target.value)}
              className={cn(errors.referenceNumber && 'border-red-500')}
            />
            {errors.referenceNumber && (
              <p className="text-sm text-red-500">{errors.referenceNumber}</p>
            )}
          </div>

          {/* Notes Input */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações (Opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Informações adicionais sobre o pagamento..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Validation Warning */}
          {amount && parseCurrency(amount) !== amountToPay && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <SketchWireIcon name="alert" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-900">
                  O valor informado ({formatCurrency(parseCurrency(amount))}) difere do valor {isSplitPayment ? 'restante' : 'total'} do pedido ({formatCurrency(amountToPay)})
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <SketchWireIcon name="loading" size={16} className="mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <SketchWireIcon name="check" size={16} className="mr-2" />
                  Registrar Pagamento
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
