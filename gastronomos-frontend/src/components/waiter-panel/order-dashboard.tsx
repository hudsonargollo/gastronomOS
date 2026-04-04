'use client';

import React, { useEffect, useState } from 'react';
import { BentoBox } from '@/components/design-system/layouts/bento-box';
import { AsymmetricCard } from '@/components/design-system/layouts/asymmetric-card';
import { StatusRibbon } from '@/components/design-system/layouts/status-ribbon';
import { getWebSocketService } from '@/lib/websocket';
import { useTranslations } from '@/hooks/use-translations';

interface Order {
  id: string;
  orderNumber: string;
  state: 'PLACED' | 'PREPARING' | 'READY' | 'DELIVERED';
  tableNumber?: string;
  totalAmount: number;
  items: OrderItem[];
  specialInstructions?: string;
  createdAt: number;
  estimatedReadyTime?: number;
}

interface OrderItem {
  id: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specialInstructions?: string;
}

interface OrderDashboardProps {
  waiterId: string;
  tenantId: string;
  onOrderSelect?: (order: Order) => void;
}

export function OrderDashboard({ waiterId, tenantId, onOrderSelect }: OrderDashboardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslations();

  useEffect(() => {
    fetchOrders();
    
    // Subscribe to real-time order updates
    const ws = getWebSocketService();
    ws.connect();

    const unsubscribe = ws.on('order:updated', (data) => {
      if (data.waiterId === waiterId) {
        updateOrder(data.order);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [waiterId, tenantId]);

  const fetchOrders = async () => {
    try {
      const response = await fetch(`/api/orders?waiterId=${waiterId}&tenantId=${tenantId}`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrder = (updatedOrder: Order) => {
    setOrders(prev => {
      const index = prev.findIndex(o => o.id === updatedOrder.id);
      if (index >= 0) {
        const newOrders = [...prev];
        newOrders[index] = updatedOrder;
        return newOrders;
      }
      return [...prev, updatedOrder];
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">{t('loading', 'Loading...')}</div>
      </div>
    );
  }

  const activeOrders = orders.filter(o => o.state !== 'DELIVERED');
  const deliveredOrders = orders.filter(o => o.state === 'DELIVERED');

  return (
    <div className="space-y-6">
      <BentoBox
        items={[
          {
            id: 'active-orders',
            title: t('waiter.activeOrders', 'Active Orders'),
            size: 'large',
            content: (
              <div className="space-y-4">
                {activeOrders.length === 0 ? (
                  <p className="text-muted-foreground">
                    {t('waiter.noActiveOrders', 'No active orders')}
                  </p>
                ) : (
                  activeOrders.map(order => (
                    <AsymmetricCard
                      key={order.id}
                      variant="elevated"
                      onClick={() => onOrderSelect?.(order)}
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-bold text-lg">
                              {t('waiter.order', 'Order')} #{order.orderNumber}
                            </h3>
                            <StatusRibbon
                              status={order.state}
                              variant="compact"
                              className={getStateColor(order.state)}
                            />
                          </div>
                          
                          {order.tableNumber && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {t('waiter.table', 'Table')}: {order.tableNumber}
                            </p>
                          )}

                          <div className="space-y-1 mb-3">
                            {order.items.map(item => (
                              <div key={item.id} className="text-sm flex justify-between">
                                <span>{item.quantity}x {item.menuItemName}</span>
                                <span className="font-mono">{formatCurrency(item.totalPrice)}</span>
                              </div>
                            ))}
                          </div>

                          {order.specialInstructions && (
                            <p className="text-sm italic text-muted-foreground mb-2">
                              {order.specialInstructions}
                            </p>
                          )}

                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="text-xs text-muted-foreground">
                              {formatTime(order.createdAt)}
                            </span>
                            <span className="font-bold text-lg">
                              {formatCurrency(order.totalAmount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </AsymmetricCard>
                  ))
                )}
              </div>
            )
          },
          {
            id: 'recent-delivered',
            title: t('waiter.recentDelivered', 'Recently Delivered'),
            size: 'medium',
            content: (
              <div className="space-y-2">
                {deliveredOrders.slice(0, 5).map(order => (
                  <div
                    key={order.id}
                    className="p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted"
                    onClick={() => onOrderSelect?.(order)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold">#{order.orderNumber}</p>
                        {order.tableNumber && (
                          <p className="text-xs text-muted-foreground">
                            {t('waiter.table', 'Table')} {order.tableNumber}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(order.totalAmount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(order.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          },
          {
            id: 'stats',
            title: t('waiter.todayStats', "Today's Stats"),
            size: 'small',
            content: (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('waiter.totalOrders', 'Total Orders')}
                  </p>
                  <p className="text-2xl font-bold">{orders.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('waiter.activeNow', 'Active Now')}
                  </p>
                  <p className="text-2xl font-bold">{activeOrders.length}</p>
                </div>
              </div>
            )
          }
        ]}
      />
    </div>
  );
}
