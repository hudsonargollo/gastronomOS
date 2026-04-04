'use client';

import React, { useState } from 'react';
import { AsymmetricCard } from '@/components/design-system/layouts/asymmetric-card';
import { StatusRibbon } from '@/components/design-system/layouts/status-ribbon';
import { useTranslations } from '@/hooks/use-translations';

interface Order {
  id: string;
  orderNumber: string;
  state: 'PLACED' | 'PREPARING' | 'READY' | 'DELIVERED';
  tableNumber?: string;
  totalAmount: number;
  subtotalAmount: number;
  taxAmount: number;
  items: OrderItem[];
  specialInstructions?: string;
  createdAt: number;
  estimatedReadyTime?: number;
}

interface OrderItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specialInstructions?: string;
}

interface OrderDetailsProps {
  order: Order;
  waiterId: string;
  tenantId: string;
  onUpdate?: () => void;
  onClose?: () => void;
}

export function OrderDetails({ order, waiterId, tenantId, onUpdate, onClose }: OrderDetailsProps) {
  const [editing, setEditing] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState(order.specialInstructions || '');
  const [itemInstructions, setItemInstructions] = useState<Record<string, string>>(
    Object.fromEntries(order.items.map(item => [item.id, item.specialInstructions || '']))
  );
  const [saving, setSaving] = useState(false);
  const { t } = useTranslations();

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStateColor = (state: Order['state']) => {
    switch (state) {
      case 'PLACED': return 'bg-blue-500';
      case 'PREPARING': return 'bg-yellow-500';
      case 'READY': return 'bg-green-500';
      case 'DELIVERED': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          specialInstructions,
          items: order.items.map(item => ({
            id: item.id,
            specialInstructions: itemInstructions[item.id]
          }))
        })
      });

      if (response.ok) {
        setEditing(false);
        onUpdate?.();
      }
    } catch (error) {
      console.error('Failed to update order:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSpecialInstructions(order.specialInstructions || '');
    setItemInstructions(
      Object.fromEntries(order.items.map(item => [item.id, item.specialInstructions || '']))
    );
    setEditing(false);
  };

  return (
    <div className="space-y-6">
      <AsymmetricCard variant="elevated">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">
              {t('waiter.order', 'Order')} #{order.orderNumber}
            </h2>
            {order.tableNumber && (
              <p className="text-muted-foreground">
                {t('waiter.table', 'Table')}: {order.tableNumber}
              </p>
            )}
          </div>
          <StatusRibbon
            status={order.state}
            variant="compact"
            className={getStateColor(order.state)}
          />
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              {t('order.createdAt', 'Created at')}
            </p>
            <p className="font-mono">{formatTime(order.createdAt)}</p>
          </div>

          {order.estimatedReadyTime && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {t('order.estimatedReady', 'Estimated ready time')}
              </p>
              <p className="font-mono">{formatTime(order.estimatedReadyTime)}</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">
                {t('order.specialInstructions', 'Special Instructions')}
              </p>
              {!editing && order.state !== 'DELIVERED' && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm text-primary hover:underline"
                >
                  {t('common.edit', 'Edit')}
                </button>
              )}
            </div>
            {editing ? (
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="w-full p-2 border rounded-md"
                rows={3}
                placeholder={t('order.enterInstructions', 'Enter special instructions...')}
              />
            ) : (
              <p className="text-muted-foreground italic">
                {order.specialInstructions || t('order.noInstructions', 'No special instructions')}
              </p>
            )}
          </div>
        </div>
      </AsymmetricCard>

      <AsymmetricCard variant="outlined">
        <h3 className="text-lg font-bold mb-4">
          {t('order.items', 'Order Items')}
        </h3>
        <div className="space-y-4">
          {order.items.map(item => (
            <div key={item.id} className="pb-4 border-b last:border-b-0">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <p className="font-semibold">
                    {item.quantity}x {item.menuItemName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(item.unitPrice)} {t('order.each', 'each')}
                  </p>
                </div>
                <p className="font-bold">{formatCurrency(item.totalPrice)}</p>
              </div>
              
              {editing ? (
                <textarea
                  value={itemInstructions[item.id] || ''}
                  onChange={(e) => setItemInstructions(prev => ({
                    ...prev,
                    [item.id]: e.target.value
                  }))}
                  className="w-full p-2 border rounded-md text-sm"
                  rows={2}
                  placeholder={t('order.itemInstructions', 'Item-specific instructions...')}
                />
              ) : item.specialInstructions ? (
                <p className="text-sm text-muted-foreground italic">
                  {item.specialInstructions}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t space-y-2">
          <div className="flex justify-between text-sm">
            <span>{t('order.subtotal', 'Subtotal')}</span>
            <span className="font-mono">{formatCurrency(order.subtotalAmount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>{t('order.tax', 'Tax')}</span>
            <span className="font-mono">{formatCurrency(order.taxAmount)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>{t('order.total', 'Total')}</span>
            <span className="font-mono">{formatCurrency(order.totalAmount)}</span>
          </div>
        </div>
      </AsymmetricCard>

      {editing && (
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save Changes')}
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="flex-1 px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
          >
            {t('common.cancel', 'Cancel')}
          </button>
        </div>
      )}

      {onClose && (
        <button
          onClick={onClose}
          className="w-full px-4 py-2 border rounded-md hover:bg-muted"
        >
          {t('common.close', 'Close')}
        </button>
      )}
    </div>
  );
}
