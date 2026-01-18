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
import {
  Package,
  ShoppingCart,
  ArrowRightLeft,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
} from 'lucide-react';

const statsData = [
  {
    title: 'Total Products',
    value: '2,847',
    change: { value: 12, type: 'increase' as const, period: 'vs last month' },
    icon: Package,
    color: 'blue' as const,
  },
  {
    title: 'Active Orders',
    value: '156',
    change: { value: 8, type: 'increase' as const, period: 'vs last week' },
    icon: ShoppingCart,
    color: 'green' as const,
  },
  {
    title: 'Pending Transfers',
    value: '23',
    change: { value: 15, type: 'decrease' as const, period: 'vs yesterday' },
    icon: ArrowRightLeft,
    color: 'orange' as const,
  },
  {
    title: 'Monthly Revenue',
    value: '$47,892',
    change: { value: 23, type: 'increase' as const, period: 'vs last month' },
    icon: DollarSign,
    color: 'purple' as const,
  },
];

const quickActions = [
  {
    title: 'Create Purchase Order',
    description: 'Start a new purchase order',
    icon: ShoppingCart,
    color: 'bg-blue-500',
    href: '/purchasing/orders/new',
  },
  {
    title: 'Process Receipt',
    description: 'Upload and process receipt',
    icon: GastronomyIcons.Receipt,
    color: 'bg-green-500',
    href: '/purchasing/receipts/new',
  },
  {
    title: 'Create Transfer',
    description: 'Transfer items between locations',
    icon: ArrowRightLeft,
    color: 'bg-orange-500',
    href: '/transfers/new',
  },
  {
    title: 'View Analytics',
    description: 'Check performance metrics',
    icon: TrendingUp,
    color: 'bg-purple-500',
    href: '/analytics',
  },
];

const alerts = [
  {
    id: 1,
    type: 'warning',
    title: 'Low Stock Alert',
    message: 'Tomatoes running low at Downtown Location',
    time: '5 minutes ago',
  },
  {
    id: 2,
    type: 'info',
    title: 'Transfer Completed',
    message: 'TR-001 successfully delivered to Westside',
    time: '10 minutes ago',
  },
  {
    id: 3,
    type: 'success',
    title: 'Order Approved',
    message: 'PO-123 approved and sent to supplier',
    time: '15 minutes ago',
  },
];

export default function DashboardPage() {
  return (
    <MainLayout title="Dashboard">
      <div className="p-6 space-y-6">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-2xl p-8 text-white relative overflow-hidden"
        >
          <div className="relative z-10">
            <h1 className="text-3xl font-bold mb-2">Welcome back, John! 👋</h1>
            <p className="text-orange-100 text-lg">
              Here's what's happening with your restaurant operations today.
            </p>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-white/5" />
          <GastronomyIcons.Chef className="absolute right-8 top-8 h-16 w-16 text-white/20" />
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {quickActions.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <motion.div
                      key={action.title}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        variant="ghost"
                        className="w-full justify-start h-auto p-4 hover:bg-slate-50"
                        asChild
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`h-10 w-10 rounded-lg ${action.color} flex items-center justify-center`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div className="text-left">
                            <h4 className="font-medium text-slate-900">{action.title}</h4>
                            <p className="text-sm text-slate-500">{action.description}</p>
                          </div>
                        </div>
                      </Button>
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
            className="lg:col-span-2"
          >
            <ActivityFeed />
          </motion.div>
        </div>

        {/* Alerts and Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Alerts */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <span>System Alerts</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start space-x-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className={`h-2 w-2 rounded-full mt-2 ${
                      alert.type === 'warning' ? 'bg-yellow-500' :
                      alert.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-slate-900">{alert.title}</h4>
                      <p className="text-sm text-slate-600">{alert.message}</p>
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
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <span>Performance Overview</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">Order Fulfillment</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">98.5%</Badge>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full" style={{ width: '98.5%' }} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">Inventory Accuracy</span>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">94.2%</Badge>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full" style={{ width: '94.2%' }} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">Cost Efficiency</span>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700">87.8%</Badge>
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