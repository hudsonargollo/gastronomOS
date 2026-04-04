'use client';

/**
 * Receipt Generator Component
 * Order completion and receipt display/printing
 * Requirements: 1.5, 5.3
 */

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SketchWireIcon } from '@/components/design-system/sketch-wire-icon';
import { cn } from '@/lib/utils';

export interface OrderItem {
  id: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PaymentInfo {
  method: string;
  amount: number;
  processedAt: number;
}

export interface ReceiptData {
  orderNumber: string;
  orderId: string;
  tableNumber?: string;
  waiterName?: string;
  items: OrderItem[];
  subtotal: number;
  totalAmount: number;
  payments: PaymentInfo[];
  changeAmount?: number;
  completedAt: number;
  tenantName?: string;
  tenantAddress?: string;
}

export interface ReceiptGeneratorProps {
  receipt: ReceiptData;
  onPrint?: () => void;
  onClose?: () => void;
  onNewOrder?: () => void;
  className?: string;
}

/**
 * Receipt Generator
 * Displays order receipt with print functionality
 */
export function ReceiptGenerator({
  receipt,
  onPrint,
  onClose,
  onNewOrder,
  className
}: ReceiptGeneratorProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentMethodLabel = (method: string): string => {
    const labels: Record<string, string> = {
      'PIX': 'Pix',
      'CREDIT_CARD': 'Cartão de Crédito',
      'DEBIT_CARD': 'Cartão de Débito',
      'MANUAL_CARD': 'Cartão (Manual)',
      'CASH': 'Dinheiro'
    };
    return labels[method] || method;
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <Card className={cn('w-full max-w-2xl mx-auto', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <SketchWireIcon name="receipt" size={24} useAccent />
            Comprovante de Pagamento
          </CardTitle>
          <Badge className="bg-green-500">Pago</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Receipt Content */}
        <div
          ref={receiptRef}
          className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 space-y-4 print:border-none"
        >
          {/* Header */}
          <div className="text-center space-y-2">
            {receipt.tenantName && (
              <h2 className="text-2xl font-bold">{receipt.tenantName}</h2>
            )}
            {receipt.tenantAddress && (
              <p className="text-sm text-muted-foreground">{receipt.tenantAddress}</p>
            )}
            <Separator className="my-4" />
          </div>

          {/* Order Info */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pedido:</span>
              <span className="font-semibold">#{receipt.orderNumber}</span>
            </div>
            {receipt.tableNumber && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Mesa:</span>
                <span className="font-semibold">{receipt.tableNumber}</span>
              </div>
            )}
            {receipt.waiterName && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Atendente:</span>
                <span className="font-semibold">{receipt.waiterName}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Data/Hora:</span>
              <span className="font-semibold">{formatDateTime(receipt.completedAt)}</span>
            </div>
          </div>

          <Separator />

          {/* Items */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Itens do Pedido</h3>
            {receipt.items.map((item) => (
              <div key={item.id} className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">
                    {item.quantity}x {item.menuItemName}
                  </span>
                  <span className="text-sm font-semibold">
                    {formatCurrency(item.totalPrice)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground pl-4">
                  {formatCurrency(item.unitPrice)} cada
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-semibold">{formatCurrency(receipt.subtotal)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span>{formatCurrency(receipt.totalAmount)}</span>
            </div>
          </div>

          <Separator />

          {/* Payments */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Pagamentos</h3>
            {receipt.payments.map((payment, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {getPaymentMethodLabel(payment.method)}
                </span>
                <span className="font-semibold">{formatCurrency(payment.amount)}</span>
              </div>
            ))}
            
            {receipt.changeAmount && receipt.changeAmount > 0 && (
              <>
                <Separator />
                <div className="flex justify-between text-sm font-bold text-green-600">
                  <span>Troco:</span>
                  <span>{formatCurrency(receipt.changeAmount)}</span>
                </div>
              </>
            )}
          </div>

          <Separator />

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground space-y-1">
            <p>Obrigado pela preferência!</p>
            <p>ID da Transação: {receipt.orderId}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 print:hidden">
          <Button
            variant="outline"
            onClick={handlePrint}
            className="w-full"
          >
            <SketchWireIcon name="printer" size={16} className="mr-2" />
            Imprimir
          </Button>
          
          {onNewOrder && (
            <Button
              onClick={onNewOrder}
              className="w-full"
            >
              <SketchWireIcon name="plus" size={16} className="mr-2" />
              Novo Pedido
            </Button>
          )}
          
          {onClose && (
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full"
            >
              Fechar
            </Button>
          )}
        </div>

        {/* Success Message */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 print:hidden">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <SketchWireIcon name="check" size={16} className="text-white" />
              </div>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-green-900">Pagamento Concluído</p>
              <p className="text-sm text-green-700 mt-1">
                O pedido #{receipt.orderNumber} foi pago com sucesso e está pronto para entrega.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
