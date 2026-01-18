'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/main-layout';
import { StatsCard } from '@/components/dashboard/stats-card';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { useTranslations } from '@/hooks/use-translations';
import Link from 'next/link';
import {
  Package,
  ShoppingCart,
  ArrowRightLeft,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Plus,
} from 'lucide-react';

export default function DashboardPage() {
  const { t } = useTranslations();

  const statsData = [
    {
      title: t('dashboard.totalProducts'),
      value: '2.847',
      change: { value: 12, type: 'increase' as const, period: t('dashboard.vsLastMonth') },
      icon: Package,
      color: 'blue' as const,
    },
    {
      title: t('dashboard.activeOrders'),
      value: '156',
      change: { value: 8, type: 'increase' as const, period: t('dashboard.vsLastWeek') },
      icon: ShoppingCart,
      color: 'green' as const,
    },
    {
      title: t('dashboard.pendingTransfers'),
      value: '23',
      change: { value: 15, type: 'decrease' as const, period: t('dashboard.vsYesterday') },
      icon: ArrowRightLeft,
      color: 'orange' as const,
    },
    {
      title: t('dashboard.monthlyRevenue'),
      value: 'R$ 47.892',
      change: { value: 23, type: 'increase' as const, period: t('dashboard.vsLastMonth') },
      icon: DollarSign,
      color: 'purple' as const,
    },
  ];

  const quickActions = [
    {
      title: t('dashboard.createPurchaseOrder'),
      description: t('dashboard.createPurchaseOrderDesc'),
      icon: ShoppingCart,
      color: 'bg-blue-500 hover:bg-blue-600',
      href: '/purchasing/orders/new',
    },
    {
      title: t('dashboard.processReceipt'),
      description: t('dashboard.processReceiptDesc'),
      icon: GastronomyIcons.Receipt,
      color: 'bg-green-500 hover:bg-green-600',
      href: '/purchasing/receipts/new',
    },
    {
      title: t('dashboard.createTransfer'),
      description: t('dashboard.createTransferDesc'),
      icon: ArrowRightLeft,
      color: 'bg-orange-500 hover:bg-orange-600',
      href: '/transfers/new',
    },
    {
      title: t('dashboard.viewAnalytics'),
      description: t('dashboard.viewAnalyticsDesc'),
      icon: TrendingUp,
      color: 'bg-purple-500 hover:bg-purple-600',
      href: '/analytics',
    },
  ];

  const alerts = [
    {
      id: 1,
      type: 'warning',
      title: 'Alerta de Estoque Baixo',
      message: 'Tomates com estoque baixo no Local Centro',
      time: '5 minutos atrás',
    },
    {
      id: 2,
      type: 'info',
      title: 'Transferência Concluída',
      message: 'TR-001 entregue com sucesso no Local Oeste',
      time: '10 minutos atrás',
    },
    {
      id: 3,
      type: 'success',
      title: 'Pedido Aprovado',
      message: 'PO-123 aprovado e enviado ao fornecedor',
      time: '15 minutos atrás',
    },
  ];

  return (
    <MainLayout title={t('dashboard.title')}>
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-2xl p-4 sm:p-6 lg:p-8 text-white relative overflow-hidden"
        >
          <div className="relative z-10">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">{t('dashboard.welcomeBack')}</h1>
            <p className="text-orange-100 text-sm sm:text-base lg:text-lg">
              {t('dashboard.subtitle')}
            </p>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute -right-4 -top-4 sm:-right-8 sm:-top-8 h-20 w-20 sm:h-32 sm:w-32 rounded-full bg-white/10" />
          <div className="absolute -right-8 -bottom-8 sm:-right-16 sm:-bottom-16 h-32 w-32 sm:h-48 sm:w-48 rounded-full bg-white/5" />
          <GastronomyIcons.Chef className="absolute right-4 top-4 sm:right-8 sm:top-8 h-8 w-8 sm:h-16 sm:w-16 text-white/20" />
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {statsData.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <StatsCard {...stat} />
            </motion.div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
          {/* Quick Actions - Improved for better usability */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="xl:col-span-1"
          >
            <Card>
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-lg sm:text-xl">{t('dashboard.quickActions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 sm:space-y-3">
                {quickActions.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <motion.div
                      key={action.title}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <Link href={action.href}>
                        <Button
                          variant="ghost"
                          className="w-full justify-start h-auto p-3 sm:p-4 hover:bg-slate-50 min-h-[60px] sm:min-h-[68px] group transition-all duration-200 hover:shadow-md border border-transparent hover:border-slate-200"
                        >
                          <div className="flex items-center space-x-3 sm:space-x-4 w-full">
                            <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-lg ${action.color} flex items-center justify-center shrink-0 transition-all duration-200 group-hover:scale-110`}>
                              <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                            </div>
                            <div className="text-left min-w-0 flex-1">
                              <h4 className="font-medium text-slate-900 text-sm sm:text-base truncate group-hover:text-slate-700">{action.title}</h4>
                              <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 group-hover:text-slate-600">{action.description}</p>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <ArrowRightLeft className="h-4 w-4 text-slate-400" />
                            </div>
                          </div>
                        </Button>
                      </Link>
                    </motion.div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>

          {/* Activity Feed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="xl:col-span-2"
          >
            <ActivityFeed />
          </motion.div>
        </div>

        {/* Alerts and Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Alerts */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card>
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <span>{t('dashboard.systemAlerts')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start space-x-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <div className={`h-2 w-2 rounded-full mt-2 shrink-0 ${
                      alert.type === 'warning' ? 'bg-yellow-500' :
                      alert.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-slate-900 truncate">{alert.title}</h4>
                      <p className="text-sm text-slate-600 line-clamp-2">{alert.message}</p>
                      <p className="text-xs text-slate-400 mt-1">{alert.time}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Performance Overview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card>
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <span>{t('dashboard.performanceOverview')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6">
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">Cumprimento de Pedidos</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">98,5%</Badge>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full" style={{ width: '98.5%' }} />
                  </div>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">Precisão do Estoque</span>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">94,2%</Badge>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full" style={{ width: '94.2%' }} />
                  </div>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">Eficiência de Custos</span>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700">87,8%</Badge>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full" style={{ width: '87.8%' }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </MainLayout>
  );
}