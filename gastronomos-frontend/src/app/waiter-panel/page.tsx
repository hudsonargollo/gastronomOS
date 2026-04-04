'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, TrendingUp, AlertCircle, CheckCircle2, Zap, Loader, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useTheme } from '@/contexts/theme-context';
import { useTranslations } from '@/hooks/use-translations';

interface OrderItem {
  id: string;
  menuItemId: string;
  quantity: number;
  specialInstructions?: string;
}

interface Order {
  id: string;
  tableNumber?: string;
  items: OrderItem[];
  totalAmount?: number;
  state: 'PLACED' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
  createdAt: number;
  updatedAt: number;
  version: number;
}

export default function WaiterPanelPage() {
  const { palette } = useTheme();
  const { t } = useTranslations();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [commission, setCommission] = useState(0);
  const [loading, setLoading] = useState(true);
  const [waiterName, setWaiterName] = useState('Garçom');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch orders on mount and set up polling
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Load waiter name from localStorage
  useEffect(() => {
    const name = localStorage.getItem('waiterName');
    if (name) setWaiterName(name);
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error(t('pages.products.notAuthenticated'));
        return;
      }

      const response = await fetch('/api/orders?state=PLACED,PREPARING,READY', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      
      const fetchedOrders = data.orders || [];
      setOrders(fetchedOrders);

      // Calculate commission (assuming 10% of total sales)
      const total = fetchedOrders.reduce((sum: number, order: Order) => {
        return sum + (order.totalAmount || 0);
      }, 0);
      setCommission(total * 0.1);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching orders:', error);
      if (!loading) {
        toast.error(t('pages.waiterPanel.failedToRefreshOrders'));
      }
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
    toast.success(t('pages.waiterPanel.ordersRefreshed'));
  };

  const handleStateChange = async (orderId: string, newState: Order['state']) => {
    try {
      const token = localStorage.getItem('token');
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const response = await fetch(`/api/orders/${orderId}/state`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toState: newState,
          fromState: order.state,
        }),
      });

      if (!response.ok) throw new Error('Failed to update order state');

      toast.success(`${t('pages.waiterPanel.orderMovedToState')} ${newState}`);
      fetchOrders();
    } catch (error) {
      console.error('Error updating order state:', error);
      toast.error(t('pages.waiterPanel.failedToUpdateOrderState'));
    }
  };

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: palette.background }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold" style={{ color: palette.text }}>{t('pages.waiterPanel.title')}</h1>
              <p style={{ color: palette.textSecondary }} className="mt-1">{t('pages.waiterPanel.welcome')}, {waiterName}</p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {t('pages.waiterPanel.refresh')}
              </Button>
              <div className="text-right">
                <div className="text-3xl font-bold" style={{ color: palette.primary }}>R$ {commission.toFixed(2)}</div>
                <p className="text-sm" style={{ color: palette.textSecondary }}>{t('pages.waiterPanel.todaysCommission')}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-8 h-8 animate-spin" style={{ color: palette.primary }} />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm" style={{ color: palette.textSecondary }}>{t('pages.waiterPanel.activeOrders')}</p>
                        <p className="text-2xl font-bold" style={{ color: palette.text }}>
                          {orders.filter(o => o.state !== 'DELIVERED' && o.state !== 'CANCELLED').length}
                        </p>
                      </div>
                      <Users className="w-8 h-8" style={{ color: palette.primary }} />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm" style={{ color: palette.textSecondary }}>{t('pages.waiterPanel.readyToServe')}</p>
                        <p className="text-2xl font-bold" style={{ color: palette.accent }}>
                          {orders.filter(o => o.state === 'READY').length}
                        </p>
                      </div>
                      <CheckCircle2 className="w-8 h-8" style={{ color: palette.accent }} />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm" style={{ color: palette.textSecondary }}>{t('pages.waiterPanel.inPreparation')}</p>
                        <p className="text-2xl font-bold" style={{ color: palette.warning }}>
                          {orders.filter(o => o.state === 'PREPARING').length}
                        </p>
                      </div>
                      <Zap className="w-8 h-8" style={{ color: palette.warning }} />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm" style={{ color: palette.textSecondary }}>{t('pages.waiterPanel.totalSales')}</p>
                        <p className="text-2xl font-bold" style={{ color: palette.primary }}>
                          R$ {orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0).toFixed(2)}
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8" style={{ color: palette.primary }} />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Orders Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Orders List */}
              <div className="lg:col-span-2">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                  <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
                    <CardHeader>
                      <CardTitle style={{ color: palette.text }}>{t('pages.waiterPanel.activeOrders')}</CardTitle>
                      <CardDescription style={{ color: palette.textSecondary }}>{t('pages.waiterPanel.manageAndTrackOrders')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {orders.length === 0 ? (
                        <p className="text-center" style={{ color: palette.textSecondary }} className="py-8">{t('pages.waiterPanel.noActiveOrders')}</p>
                      ) : (
                        <div className="space-y-3">
                          {orders.map((order, idx) => (
                            <motion.div
                              key={order.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.5 + idx * 0.1 }}
                              onClick={() => setSelectedOrder(order)}
                              className="p-4 border rounded-lg hover:shadow-md transition-all cursor-pointer"
                              style={{
                                borderColor: palette.border,
                                backgroundColor: palette.background,
                              }}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: palette.primary, color: palette.primaryForeground }}>
                                    {order.tableNumber || 'O'}
                                  </div>
                                  <div>
                                    <p className="font-semibold" style={{ color: palette.text }}>
                                      {order.tableNumber ? `${t('pages.waiterPanel.table')} ${order.tableNumber}` : t('pages.waiterPanel.order')}
                                    </p>
                                    <p className="text-sm" style={{ color: palette.textSecondary }}>
                                      {order.items.length} {order.items.length !== 1 ? t('pages.waiterPanel.items') : t('pages.waiterPanel.item')}
                                    </p>
                                  </div>
                                </div>
                                <Badge style={{ backgroundColor: getStateColor(order.state, palette).bg, color: getStateColor(order.state, palette).text }}>
                                  <span className="flex items-center gap-1">
                                    {getStateIcon(order.state)}
                                    {order.state}
                                  </span>
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2" style={{ color: palette.textSecondary }}>
                                  <Clock className="w-4 h-4" />
                                  {Math.round((Date.now() - order.createdAt) / 60000)} {t('pages.waiterPanel.minutesAgo')}
                                </div>
                                <p className="font-semibold" style={{ color: palette.text }}>
                                  R$ {((order.totalAmount || 0) / 100).toFixed(2)}
                                </p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Order Details / Quick Actions */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }} className="sticky top-6">
                  <CardHeader>
                    <CardTitle style={{ color: palette.text }}>
                      {selectedOrder ? `${t('pages.waiterPanel.table')} ${selectedOrder.tableNumber || t('pages.waiterPanel.order')}` : t('pages.waiterPanel.quickActions')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedOrder ? (
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm" style={{ color: palette.textSecondary }} className="mb-2">{t('pages.waiterPanel.items_label')} ({selectedOrder.items.length})</p>
                          <ul className="space-y-1">
                            {selectedOrder.items.map((item, idx) => (
                              <li key={idx} className="text-sm" style={{ color: palette.text }}>
                                • {item.quantity}x Item #{item.menuItemId.slice(0, 8)}
                                {item.specialInstructions && (
                                  <p className="text-xs" style={{ color: palette.textSecondary }} className="ml-4">
                                    {t('pages.waiterPanel.note')}: {item.specialInstructions}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="border-t pt-4" style={{ borderColor: palette.border }}>
                          <p className="text-sm" style={{ color: palette.textSecondary }} className="mb-2">{t('pages.waiterPanel.total')}</p>
                          <p className="text-2xl font-bold" style={{ color: palette.text }}>
                            R$ {((selectedOrder.totalAmount || 0) / 100).toFixed(2)}
                          </p>
                        </div>
                        <div className="border-t pt-4" style={{ borderColor: palette.border }}>
                          <p className="text-sm" style={{ color: palette.textSecondary }} className="mb-2">{t('pages.waiterPanel.status')}</p>
                          <p className="text-sm font-semibold mb-3" style={{ color: palette.text }}>{selectedOrder.state}</p>
                          <div className="space-y-2">
                            {selectedOrder.state === 'PLACED' && (
                              <Button
                                onClick={() => handleStateChange(selectedOrder.id, 'PREPARING')}
                                className="w-full"
                                style={{ backgroundColor: palette.warning, color: palette.text }}
                              >
                                {t('pages.waiterPanel.startPreparing')}
                              </Button>
                            )}
                            {selectedOrder.state === 'PREPARING' && (
                              <Button
                                onClick={() => handleStateChange(selectedOrder.id, 'READY')}
                                className="w-full"
                                style={{ backgroundColor: palette.accent, color: palette.text }}
                              >
                                {t('pages.waiterPanel.markReady')}
                              </Button>
                            )}
                            {selectedOrder.state === 'READY' && (
                              <Button
                                onClick={() => handleStateChange(selectedOrder.id, 'DELIVERED')}
                                className="w-full"
                                style={{ backgroundColor: palette.primary, color: palette.primaryForeground }}
                              >
                                {t('pages.waiterPanel.serveOrder')}
                              </Button>
                            )}
                            {selectedOrder.state !== 'DELIVERED' && selectedOrder.state !== 'CANCELLED' && (
                              <Button
                                onClick={() => handleStateChange(selectedOrder.id, 'CANCELLED')}
                                variant="outline"
                                className="w-full"
                                style={{ color: palette.destructive, borderColor: palette.destructive }}
                              >
                                {t('pages.waiterPanel.cancelOrder')}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 text-center py-8">
                        <p style={{ color: palette.textSecondary }}>{t('pages.waiterPanel.selectOrderToViewDetails')}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function getStateColor(state: string, palette: any) {
  switch (state) {
    case 'PLACED':
      return { bg: palette.primary, text: palette.primaryForeground };
    case 'PREPARING':
      return { bg: palette.warning, text: palette.text };
    case 'READY':
      return { bg: palette.accent, text: palette.text };
    case 'DELIVERED':
      return { bg: palette.border, text: palette.text };
    case 'CANCELLED':
      return { bg: palette.destructive, text: palette.primaryForeground };
    default:
      return { bg: palette.border, text: palette.text };
  }
}

function getStateIcon(state: string) {
  switch (state) {
    case 'PLACED':
      return <AlertCircle className="w-4 h-4" />;
    case 'PREPARING':
      return <Zap className="w-4 h-4" />;
    case 'READY':
      return <CheckCircle2 className="w-4 h-4" />;
    default:
      return null;
  }
}
