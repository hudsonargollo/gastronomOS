'use client';

/**
 * Split Payment Manager Component
 * Interface for handling multiple partial payments with real-time balance tracking
 * Requirements: 7.1, 7.2
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { SketchWireIcon } from '@/components/design-system/sketch-wire-icon';
import { cn } from '@/lib/utils';

export interface PaymentSummary {
  id: string;
  method: string;
  amount: number;
  status: string;
  createdAt: number;
  processedAt?: number;
}

export interface BalanceInfo {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  isComplete: boolean;
  paymentCount: number;
  payments: PaymentSummary[];
}

export interface SplitPaymentManagerProps {
  orderId: string;
  orderNumber: string;
  balanceInfo: BalanceInfo;
  onAddPayment: () => void;
  onComplete?: () => void;
  onCancel?: () => void;
  className?: string;
}

/**
 * Split Payment Manager
 * Displays payment progress and manages multiple partial payments
 */
export function SplitPaymentManager({
  orderId,
  orderNumber,
  balanceInfo,
  onAddPayment,
  onComplete,
  onCancel,
  className
}: SplitPaymentManagerProps) {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentMethodLabel = (method: string): string => {
    const labels: Record<string, string> = {
      'PIX': 'Pix',
      'CREDIT_CARD': 'Cartão de Crédito',
      'DEBIT_CARD': 'Cartão de Débito',
      'MANUAL_CARD': 'Cartão Manual',
      'CASH': 'Dinheiro'
    };
    return labels[method] || method;
  };

  const getPaymentMethodColor = (method: string): string => {
    const colors: Record<string, string> = {
      'PIX': 'bg-teal-500',
      'CREDIT_CARD': 'bg-blue-500',
      'DEBIT_CARD': 'bg-green-500',
      'MANUAL_CARD': 'bg-purple-500',
      'CASH': 'bg-amber-500'
    };
    return colors[method] || 'bg-gray-500';
  };

  const progressPercentage = balanceInfo.totalAmount > 0
    ? (balanceInfo.paidAmount / balanceInfo.totalAmount) * 100
    : 0;

  const hasOverpayment = balanceInfo.paidAmount > balanceInfo.totalAmount;
  const changeAmount = hasOverpayment ? balanceInfo.paidAmount - balanceInfo.totalAmount : 0;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <SketchWireIcon name="split" size={24} useAccent />
              Pagamento Dividido
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Pedido #{orderNumber}
            </p>
          </div>
          {balanceInfo.isComplete ? (
            <Badge className="bg-green-500">Completo</Badge>
          ) : (
            <Badge variant="secondary">{balanceInfo.paymentCount} Pagamento(s)</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Balance Overview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso do Pagamento</span>
            <span className="font-semibold">{Math.min(progressPercentage, 100).toFixed(0)}%</span>
          </div>
          <Progress value={Math.min(progressPercentage, 100)} className="h-3" />
          
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Total</p>
              <p className="text-lg font-bold">{formatCurrency(balanceInfo.totalAmount)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Pago</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(balanceInfo.paidAmount)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Restante</p>
              <p className="text-lg font-bold text-[var(--token-action-primary)]">
                {formatCurrency(Math.max(0, balanceInfo.remainingAmount))}
              </p>
            </div>
          </div>
        </div>

        {/* Overpayment Warning */}
        {hasOverpayment && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <SketchWireIcon name="alert" size={20} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-900">Troco Necessário</p>
                <p className="text-sm text-amber-700 mt-1">
                  Valor pago excede o total. Troco: <span className="font-bold">{formatCurrency(changeAmount)}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Payment History */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Histórico de Pagamentos</h3>
          {balanceInfo.payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <SketchWireIcon name="payment" size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum pagamento registrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {balanceInfo.payments.map((payment, index) => (
                <div
                  key={payment.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-[var(--token-border-subtle)]"
                >
                  <div className={cn('p-2 rounded-lg', getPaymentMethodColor(payment.method))}>
                    <SketchWireIcon name="check" size={16} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">
                        {getPaymentMethodLabel(payment.method)}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        #{index + 1}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(payment.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(payment.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          {onCancel && !balanceInfo.isComplete && (
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancelar
            </Button>
          )}
          {!balanceInfo.isComplete ? (
            <Button
              onClick={onAddPayment}
              className="flex-1"
              size="lg"
            >
              <SketchWireIcon name="plus" size={16} className="mr-2" />
              Adicionar Pagamento
            </Button>
          ) : (
            <Button
              onClick={onComplete}
              className="flex-1 bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <SketchWireIcon name="check" size={16} className="mr-2" />
              Finalizar Pedido
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
