'use client';

/**
 * Pix Generator Component
 * QR code generation and display for Pix payments with 15-minute expiration
 * Requirements: 5.2
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SketchWireIcon } from '@/components/design-system/sketch-wire-icon';
import { cn } from '@/lib/utils';

export interface PixQRCodeData {
  pixId: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl?: string;
  expirationDate: Date;
  gatewayTransactionId: string;
}

export interface PixGeneratorProps {
  orderId: string;
  orderNumber: string;
  amount: number; // in cents
  pixData?: PixQRCodeData;
  onGenerate: () => Promise<void>;
  onCancel?: () => void;
  onCheckStatus?: () => Promise<void>;
  isGenerating?: boolean;
  className?: string;
}

/**
 * Pix Generator
 * Displays Pix QR code with countdown timer and status checking
 */
export function PixGenerator({
  orderId,
  orderNumber,
  amount,
  pixData,
  onGenerate,
  onCancel,
  onCheckStatus,
  isGenerating = false,
  className
}: PixGeneratorProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!pixData) {
      setTimeRemaining(0);
      setIsExpired(false);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const expiration = new Date(pixData.expirationDate).getTime();
      const remaining = Math.max(0, expiration - now);
      
      setTimeRemaining(remaining);
      setIsExpired(remaining === 0);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [pixData]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  const formatTimeRemaining = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = async () => {
    if (pixData?.qrCode) {
      try {
        await navigator.clipboard.writeText(pixData.qrCode);
        // Could add a toast notification here
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    }
  };

  if (!pixData) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SketchWireIcon name="qr-code" size={24} useAccent />
            Pagamento Pix
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Pedido #{orderNumber}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">Valor a Pagar</p>
            <p className="text-3xl font-bold text-[var(--token-action-primary)]">
              {formatCurrency(amount)}
            </p>
          </div>

          <div className="text-center py-8">
            <SketchWireIcon name="qrCode" size={64} className="mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-6">
              Clique no botão abaixo para gerar o QR Code Pix
            </p>
            <Button
              onClick={onGenerate}
              disabled={isGenerating}
              size="lg"
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <SketchWireIcon name="loading" size={16} className="mr-2 animate-spin" />
                  Gerando QR Code...
                </>
              ) : (
                <>
                  <SketchWireIcon name="qrCode" size={16} className="mr-2" />
                  Gerar QR Code Pix
                </>
              )}
            </Button>
          </div>

          {onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
              className="w-full"
            >
              Cancelar
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <SketchWireIcon name="qrCode" size={24} useAccent />
              Pagamento Pix
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Pedido #{orderNumber}
            </p>
          </div>
          {isExpired ? (
            <Badge variant="destructive">Expirado</Badge>
          ) : (
            <Badge className="bg-green-500">Ativo</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Amount Display */}
        <div className="bg-muted/50 rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground mb-2">Valor a Pagar</p>
          <p className="text-3xl font-bold text-[var(--token-action-primary)]">
            {formatCurrency(amount)}
          </p>
        </div>

        {/* Timer Display */}
        {!isExpired && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SketchWireIcon name="clock" size={20} className="text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Tempo Restante</span>
              </div>
              <span className="text-2xl font-bold text-blue-600 font-mono">
                {formatTimeRemaining(timeRemaining)}
              </span>
            </div>
          </div>
        )}

        {/* Expired Warning */}
        {isExpired && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <SketchWireIcon name="alert" size={20} className="text-red-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-900">QR Code Expirado</p>
                <p className="text-sm text-red-700 mt-1">
                  Este QR Code expirou após 15 minutos. Gere um novo para continuar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* QR Code Display */}
        {!isExpired && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-lg border-2 border-[var(--token-border-default)] flex items-center justify-center">
              {pixData.qrCodeBase64 ? (
                <img
                  src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                  alt="Pix QR Code"
                  className="w-64 h-64"
                />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center bg-muted">
                  <SketchWireIcon name="qrCode" size={64} className="opacity-50" />
                </div>
              )}
            </div>

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Escaneie o QR Code com o app do seu banco
              </p>
              <Button
                variant="outline"
                onClick={copyToClipboard}
                className="w-full"
              >
                <SketchWireIcon name="copy" size={16} className="mr-2" />
                Copiar Código Pix
              </Button>
            </div>
          </div>
        )}

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
          {isExpired ? (
            <Button
              onClick={onGenerate}
              disabled={isGenerating}
              className="flex-1"
              size="lg"
            >
              {isGenerating ? 'Gerando...' : 'Gerar Novo QR Code'}
            </Button>
          ) : (
            onCheckStatus && (
              <Button
                onClick={onCheckStatus}
                className="flex-1"
                size="lg"
              >
                <SketchWireIcon name="refresh" size={16} className="mr-2" />
                Verificar Pagamento
              </Button>
            )
          )}
        </div>

        {/* Additional Info */}
        {pixData.ticketUrl && !isExpired && (
          <div className="text-center pt-2">
            <a
              href={pixData.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--token-action-primary)] hover:underline"
            >
              Abrir comprovante no navegador
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
