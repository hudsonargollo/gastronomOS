'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/contexts/theme-context';
import { useBranding } from '@/contexts/branding-context';
import { useApiClient } from '@/hooks/use-api-client';
import {
  Package,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Clock,
  AlertCircle,
  ShoppingCart,
  Plus,
} from 'lucide-react';
import Link from 'next/link';

interface StockAlert {
  id: string;
  productName: string;
  currentQuantity: number;
  thresholdQuantity: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  unit: string;
}

interface PaymentDue {
  id: string;
  supplierName: string;
  amountCents: number;
  dueDate: string;
  daysUntilDue: number;
  status: 'PENDING' | 'OVERDUE';
}

interface InventoryValue {
  totalValueCents: number;
  productCount: number;
  lowStockCount: number;
}

interface DashboardMetrics {
  inventoryValue: InventoryValue;
  paymentsDue: PaymentDue[];
  stockAlerts: StockAlert[];
  totalPaymentsPendingCents: number;
}

export default function PontalDashboard() {
  const { palette } = useTheme();
  const { branding } = useBranding();
  const apiClient = useApiClient();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardMetrics();
  }, []);

  const loadDashboardMetrics = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getDashboardMetrics() as any;
      
      if (response?.success && response?.data) {
        setMetrics(response.data);
      } else {
        // Fallback to mock data if API fails
        const mockMetrics: DashboardMetrics = {
          inventoryValue: {
            totalValueCents: 125000000,
            productCount: 247,
            lowStockCount: 12,
          },
          paymentsDue: [
            {
              id: '1',
              supplierName: 'Distribuidor Premium',
              amountCents: 45000000,
              dueDate: '2026-04-25',
              daysUntilDue: 5,
              status: 'PENDING',
            },
          ],
          stockAlerts: [
            {
              id: '1',
              productName: 'Vodka Premium',
              currentQuantity: 8,
              thresholdQuantity: 40,
              severity: 'CRITICAL',
              unit: 'garrafas',
            },
          ],
          totalPaymentsPendingCents: 57500000,
        };
        setMetrics(mockMetrics);
      }
    } catch (error) {
      console.error('Failed to load dashboard metrics:', error);
      // Fallback to mock data
      const mockMetrics: DashboardMetrics = {
        inventoryValue: {
          totalValueCents: 125000000,
          productCount: 247,
          lowStockCount: 12,
        },
        paymentsDue: [],
        stockAlerts: [],
        totalPaymentsPendingCents: 57500000,
      };
      setMetrics(mockMetrics);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return <AlertTriangle className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  return (
    <MainLayout title={`${branding.businessName} - Painel de Controle`}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: palette.text }}>
              Painel de Controle
            </h1>
            <p style={{ color: palette.textSecondary }} className="mt-2">
              Gestão de Estoque e Pagamentos - {branding.businessName}
            </p>
          </div>
          <Link href="/purchasing/orders">
            <Button
              style={{
                backgroundColor: palette.primary,
                color: palette.surface,
              }}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova Compra
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-lg animate-pulse"
                style={{ backgroundColor: `${palette.accent}20` }}
              />
            ))}
          </div>
        ) : metrics ? (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Inventory Value */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0 }}
              >
                <Card
                  style={{
                    borderColor: palette.accent,
                    borderWidth: '2px',
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium" style={{ color: palette.textSecondary }}>
                        Valor em Estoque
                      </CardTitle>
                      <Package
                        className="w-5 h-5"
                        style={{ color: palette.primary }}
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p
                        className="text-2xl font-bold"
                        style={{ color: palette.primary }}
                      >
                        {formatCurrency(metrics.inventoryValue.totalValueCents)}
                      </p>
                      <p className="text-xs" style={{ color: palette.textSecondary }}>
                        {metrics.inventoryValue.productCount} produtos
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Payments Due */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card
                  style={{
                    borderColor: metrics.paymentsDue.some(p => p.status === 'OVERDUE')
                      ? '#dc2626'
                      : palette.accent,
                    borderWidth: '2px',
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium" style={{ color: palette.textSecondary }}>
                        Pagamentos Pendentes
                      </CardTitle>
                      <DollarSign
                        className="w-5 h-5"
                        style={{
                          color: metrics.paymentsDue.some(p => p.status === 'OVERDUE')
                            ? '#dc2626'
                            : palette.primary,
                        }}
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p
                        className="text-2xl font-bold"
                        style={{
                          color: metrics.paymentsDue.some(p => p.status === 'OVERDUE')
                            ? '#dc2626'
                            : palette.primary,
                        }}
                      >
                        {formatCurrency(metrics.totalPaymentsPendingCents)}
                      </p>
                      <p className="text-xs" style={{ color: palette.textSecondary }}>
                        {metrics.paymentsDue.length} pagamentos
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Low Stock Items */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card
                  style={{
                    borderColor: metrics.stockAlerts.length > 0 ? '#ea580c' : palette.accent,
                    borderWidth: '2px',
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium" style={{ color: palette.textSecondary }}>
                        Itens com Baixo Estoque
                      </CardTitle>
                      <AlertTriangle
                        className="w-5 h-5"
                        style={{
                          color: metrics.stockAlerts.length > 0 ? '#ea580c' : palette.primary,
                        }}
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p
                        className="text-2xl font-bold"
                        style={{
                          color: metrics.stockAlerts.length > 0 ? '#ea580c' : palette.primary,
                        }}
                      >
                        {metrics.stockAlerts.length}
                      </p>
                      <p className="text-xs" style={{ color: palette.textSecondary }}>
                        Requer atenção
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Alerts Section */}
            {metrics.stockAlerts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" style={{ color: '#ea580c' }} />
                      Alertas de Estoque
                    </CardTitle>
                    <CardDescription>
                      Produtos com estoque abaixo do limite configurado
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {metrics.stockAlerts.map((alert) => (
                        <motion.div
                          key={alert.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`p-4 rounded-lg border-2 flex items-center justify-between ${getSeverityColor(
                            alert.severity
                          )}`}
                        >
                          <div className="flex items-center gap-3">
                            {getSeverityIcon(alert.severity)}
                            <div>
                              <p className="font-semibold">{alert.productName}</p>
                              <p className="text-sm opacity-75">
                                Estoque: {alert.currentQuantity} {alert.unit} (Limite: {alert.thresholdQuantity} {alert.unit})
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline">{alert.severity}</Badge>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Payments Due Section */}
            {metrics.paymentsDue.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5" style={{ color: palette.primary }} />
                      Pagamentos Agendados
                    </CardTitle>
                    <CardDescription>
                      Próximos pagamentos a fornecedores
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {metrics.paymentsDue.map((payment) => (
                        <motion.div
                          key={payment.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="p-4 rounded-lg border-2"
                          style={{
                            borderColor:
                              payment.status === 'OVERDUE'
                                ? '#dc2626'
                                : palette.accent,
                            backgroundColor:
                              payment.status === 'OVERDUE'
                                ? '#fee2e2'
                                : `${palette.accent}10`,
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-semibold" style={{ color: palette.text }}>
                                {payment.supplierName}
                              </p>
                              <p
                                className="text-sm"
                                style={{ color: palette.textSecondary }}
                              >
                                Vencimento: {new Date(payment.dueDate).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold" style={{ color: palette.primary }}>
                                {formatCurrency(payment.amountCents)}
                              </p>
                              {payment.status === 'OVERDUE' ? (
                                <Badge variant="destructive">Vencido</Badge>
                              ) : (
                                <Badge variant="outline">
                                  {payment.daysUntilDue} dias
                                </Badge>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Ações Rápidas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Link href="/purchasing/orders">
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        style={{
                          borderColor: palette.primary,
                          color: palette.primary,
                        }}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Nova Compra
                      </Button>
                    </Link>
                    <Link href="/inventory/products">
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        style={{
                          borderColor: palette.primary,
                          color: palette.primary,
                        }}
                      >
                        <Package className="w-4 h-4 mr-2" />
                        Gerenciar Estoque
                      </Button>
                    </Link>
                    <Link href="/analytics">
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        style={{
                          borderColor: palette.primary,
                          color: palette.primary,
                        }}
                      >
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Análises
                      </Button>
                    </Link>
                    <Link href="/purchasing/suppliers">
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        style={{
                          borderColor: palette.primary,
                          color: palette.primary,
                        }}
                      >
                        <DollarSign className="w-4 h-4 mr-2" />
                        Fornecedores
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        ) : null}
      </div>
    </MainLayout>
  );
}
