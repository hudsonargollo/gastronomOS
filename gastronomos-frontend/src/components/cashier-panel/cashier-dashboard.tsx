'use client';

/**
 * Cashier Dashboard Component
 * Main cashier panel interface with payment processing workflow
 * Requirements: 5.1, 5.2, 5.3, 7.1, 7.2
 */

import React, { useState, useEffect } from 'react';
import { BentoBox, BentoItem } from '@/components/design-system/layouts/bento-box';
import { AsymmetricCard } from '@/components/design-system/layouts/asymmetric-card';
import { SketchWireIcon } from '@/components/design-system/sketch-wire-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getWebSocketService } from '@/lib/websocket';
import { 
  PaymentProcessor, 
  SplitPaymentManager, 
  PixGenerator, 
  ManualPaymentLogger, 
  ReceiptGenerator,
  type PaymentMethod,
  type BalanceInfo,
  type ManualPaymentData,
  type PixQRCodeData,
  type ReceiptData
} from './index';

interface Order {
  id: string;
  orderNumber: string;
  state: 'READY' | 'DELIVERED';
  tableNumber?: string;
  waiterName?: string;
  totalAmount: number;
  items: OrderItem[];
  createdAt: number;
}

interface OrderItem {
  id: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

type PaymentStep = 
  | 'select-order'
  | 'select-method'
  | 'process-pix'
  | 'process-card'
  | 'process-manual'
  | 'split-payment'
  | 'receipt';

export function CashierDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [currentStep, setCurrentStep] = useState<PaymentStep>('select-order');
  const [balanceInfo, setBalanceInfo] = useState<BalanceInfo | null>(null);
  const [pixData, setPixData] = useState<PixQRCodeData | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    fetchOrders();

    // Setup WebSocket for real-time updates
    const ws = getWebSocketService();
    ws.connect();

    const unsubscribeConnect = ws.onConnect(() => {
      setIsConnected(true);
    });

    const unsubscribeDisconnect = ws.onDisconnect(() => {
      setIsConnected(false);
    });

    const unsubscribeOrderUpdate = ws.on('order:update', (data) => {
      handleOrderUpdate(data);
    });

    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeOrderUpdate();
    };
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/v1/orders?state=READY');
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const handleOrderUpdate = (data: any) => {
    setOrders(prevOrders => {
      const updatedOrders = prevOrders.map(order =>
        order.id === data.orderId ? { ...order, ...data.updates } : order
      );
      return updatedOrders.filter(order => order.state === 'READY');
    });
  };

  const handleOrderSelect = async (order: Order) => {
    setSelectedOrder(order);
    
    // Check if order has existing split payment
    const balanceResponse = await fetch(`/api/v1/payments/split/${order.id}/balance`);
    if (balanceResponse.ok) {
      const balance = await balanceResponse.json();
      if (balance.paymentCount > 0) {
        setBalanceInfo(balance);
        setCurrentStep('split-payment');
        return;
      }
    }
    
    setCurrentStep('select-method');
  };

  const handlePaymentMethodSelect = async (method: PaymentMethod) => {
    if (!selectedOrder) return;

    if (method === 'PIX') {
      setCurrentStep('process-pix');
    } else if (method === 'CREDIT_CARD' || method === 'DEBIT_CARD') {
      setCurrentStep('process-card');
    } else if (method === 'MANUAL_CARD' || method === 'CASH') {
      setCurrentStep('process-manual');
    }
  };

  const handleGeneratePixQR = async () => {
    if (!selectedOrder) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/payments/pix/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          amount: balanceInfo?.remainingAmount || selectedOrder.totalAmount,
          description: `Pedido #${selectedOrder.orderNumber}`,
          customerEmail: 'customer@example.com'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPixData({
          pixId: data.pixId,
          qrCode: data.qrCode,
          qrCodeBase64: data.qrCodeBase64,
          ticketUrl: data.ticketUrl,
          expirationDate: new Date(data.expirationDate),
          gatewayTransactionId: data.gatewayTransactionId
        });
      }
    } catch (error) {
      console.error('Error generating Pix QR:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckPixStatus = async () => {
    if (!pixData || !selectedOrder) return;

    try {
      const response = await fetch(`/api/v1/payments/pix/${pixData.pixId}/status`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'COMPLETED') {
          await completeOrder();
        }
      }
    } catch (error) {
      console.error('Error checking Pix status:', error);
    }
  };

  const handleManualPaymentSubmit = async (data: ManualPaymentData) => {
    if (!selectedOrder) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/payments/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          ...data,
          processedBy: 'cashier-user-id' // Should come from auth context
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Check if payment is complete
        if (result.balanceInfo?.isComplete) {
          await completeOrder();
        } else {
          // Show split payment view
          setBalanceInfo(result.balanceInfo);
          setCurrentStep('split-payment');
        }
      }
    } catch (error) {
      console.error('Error logging manual payment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSplitPayment = () => {
    setCurrentStep('select-method');
  };

  const completeOrder = async () => {
    if (!selectedOrder) return;

    try {
      // Fetch final receipt data
      const response = await fetch(`/api/v1/orders/${selectedOrder.id}/receipt`);
      if (response.ok) {
        const receiptData = await response.json();
        setReceipt(receiptData);
        setCurrentStep('receipt');
      }
    } catch (error) {
      console.error('Error completing order:', error);
    }
  };

  const handleNewOrder = () => {
    setSelectedOrder(null);
    setCurrentStep('select-order');
    setBalanceInfo(null);
    setPixData(null);
    setReceipt(null);
    fetchOrders();
  };

  const handleCancel = () => {
    if (balanceInfo && balanceInfo.paymentCount > 0) {
      setCurrentStep('split-payment');
    } else {
      setCurrentStep('select-method');
    }
  };

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

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SketchWireIcon name="cashRegister" size={32} useAccent />
          <h1 className="text-3xl font-bold">Caixa</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-muted-foreground">
            {isConnected ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side - Order List */}
        <div className="lg:col-span-1">
          <div className="bg-[var(--token-surface-elevated)] rounded-lg border border-[var(--token-border-subtle)] p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <SketchWireIcon name="list" size={20} />
              Pedidos Prontos ({orders.length})
            </h2>
            
            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
              {orders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <SketchWireIcon name="inbox" size={48} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum pedido pronto</p>
                </div>
              ) : (
                orders.map(order => (
                  <AsymmetricCard
                    key={order.id}
                    variant="compact"
                    onClick={() => handleOrderSelect(order)}
                    className={`cursor-pointer transition-all ${
                      selectedOrder?.id === order.id
                        ? 'ring-2 ring-[var(--token-action-primary)]'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold">#{order.orderNumber}</h3>
                          <Badge variant="secondary" className="bg-green-500 text-white">
                            PRONTO
                          </Badge>
                        </div>
                        {order.tableNumber && (
                          <p className="text-xs text-muted-foreground mb-1">
                            Mesa {order.tableNumber}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatTime(order.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{formatCurrency(order.totalAmount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                        </p>
                      </div>
                    </div>
                  </AsymmetricCard>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side - Payment Processing */}
        <div className="lg:col-span-2">
          {currentStep === 'select-order' && !selectedOrder && (
            <div className="bg-[var(--token-surface-elevated)] rounded-lg border border-[var(--token-border-subtle)] p-12 text-center">
              <SketchWireIcon name="arrowLeft" size={64} className="mx-auto mb-4 opacity-50" />
              <h2 className="text-xl font-semibold mb-2">Selecione um Pedido</h2>
              <p className="text-muted-foreground">
                Escolha um pedido da lista ao lado para processar o pagamento
              </p>
            </div>
          )}

          {currentStep === 'select-method' && selectedOrder && (
            <PaymentProcessor
              orderId={selectedOrder.id}
              orderNumber={selectedOrder.orderNumber}
              totalAmount={selectedOrder.totalAmount}
              remainingAmount={balanceInfo?.remainingAmount}
              onPaymentMethodSelect={handlePaymentMethodSelect}
              onCancel={balanceInfo ? handleCancel : undefined}
            />
          )}

          {currentStep === 'process-pix' && selectedOrder && (
            <PixGenerator
              orderId={selectedOrder.id}
              orderNumber={selectedOrder.orderNumber}
              amount={balanceInfo?.remainingAmount || selectedOrder.totalAmount}
              pixData={pixData || undefined}
              onGenerate={handleGeneratePixQR}
              onCheckStatus={handleCheckPixStatus}
              onCancel={handleCancel}
              isGenerating={isLoading}
            />
          )}

          {currentStep === 'process-manual' && selectedOrder && (
            <ManualPaymentLogger
              orderId={selectedOrder.id}
              orderNumber={selectedOrder.orderNumber}
              orderTotal={selectedOrder.totalAmount}
              remainingAmount={balanceInfo?.remainingAmount}
              onSubmit={handleManualPaymentSubmit}
              onCancel={handleCancel}
              isSubmitting={isLoading}
            />
          )}

          {currentStep === 'split-payment' && selectedOrder && balanceInfo && (
            <SplitPaymentManager
              orderId={selectedOrder.id}
              orderNumber={selectedOrder.orderNumber}
              balanceInfo={balanceInfo}
              onAddPayment={handleAddSplitPayment}
              onComplete={completeOrder}
              onCancel={() => setCurrentStep('select-order')}
            />
          )}

          {currentStep === 'receipt' && receipt && (
            <ReceiptGenerator
              receipt={receipt}
              onNewOrder={handleNewOrder}
              onClose={handleNewOrder}
            />
          )}
        </div>
      </div>
    </div>
  );
}
