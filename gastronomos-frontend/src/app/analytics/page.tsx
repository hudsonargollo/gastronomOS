'use client';

import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatCard, ProgressCard } from '@/components/ui/dashboard-widgets';
import { AnimatedMetricCard } from '@/components/ui/animated-charts';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Users,
  Clock,
  Target,
  Download,
  RefreshCw,
  Filter
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { staggerContainer, listItemVariants } from '@/lib/animation-utils';

const analyticsModules = [
  {
    title: 'Performance',
    description: 'Track operational performance metrics',
    icon: GastronomyIcons.TrendingUp,
    href: '/analytics/performance',
    color: 'bg-green-500',
    stats: '98.5% efficiency',
    trend: { value: 2.3, direction: 'up' as const },
    details: 'All departments performing above target',
  },
  {
    title: 'Cost Analysis',
    description: 'Analyze costs and profitability',
    icon: GastronomyIcons.ChartPie,
    href: '/analytics/costs',
    color: 'bg-blue-500',
    stats: '$47K this month',
    trend: { value: -3.2, direction: 'down' as const },
    details: 'Cost reduction vs last month',
  },
  {
    title: 'Variance Reports',
    description: 'Compare planned vs actual performance',
    icon: BarChart3,
    href: '/analytics/variance',
    color: 'bg-orange-500',
    stats: '12% variance',
    trend: { value: -2.1, direction: 'down' as const },
    details: 'Improvement in variance control',
  },
];

const quickMetrics = [
  {
    title: 'Revenue Today',
    value: '$8,247',
    change: { value: 12.5, period: 'vs yesterday', trend: 'up' as const },
    icon: <DollarSign className="w-5 h-5" />,
    color: 'bg-emerald-500',
  },
  {
    title: 'Active Orders',
    value: '47',
    change: { value: -8.2, period: 'vs avg', trend: 'down' as const },
    icon: <GastronomyIcons.ShoppingCart className="w-5 h-5" />,
    color: 'bg-blue-500',
  },
  {
    title: 'Staff On Duty',
    value: '23',
    change: { value: 4.5, period: 'scheduled', trend: 'up' as const },
    icon: <Users className="w-5 h-5" />,
    color: 'bg-purple-500',
  },
  {
    title: 'Avg Response Time',
    value: '2.4 min',
    change: { value: -15.3, period: 'improvement', trend: 'down' as const },
    icon: <Clock className="w-5 h-5" />,
    color: 'bg-orange-500',
  },
];

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('today');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleGenerateReport = () => {
    console.log('Generating comprehensive analytics report...');
  };

  return (
    <MainLayout title="Analytics">
      <AnimatedPage>
        <div className="p-6 space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Analytics Dashboard</h1>
              <p className="text-slate-600 mt-2">Comprehensive insights and reports for data-driven decisions</p>
            </div>
            <div className="flex items-center space-x-3">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={handleGenerateReport} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700">
                <Download className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            </div>
          </motion.div>

          {/* Quick Metrics */}
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {quickMetrics.map((metric, index) => (
              <motion.div key={metric.title} variants={listItemVariants}>
                <AnimatedMetricCard {...metric} />
              </motion.div>
            ))}
          </motion.div>

          {/* Analytics Modules */}
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-xl font-semibold text-slate-900">Analytics Modules</h2>
              <p className="text-slate-600">Detailed analysis and reporting tools</p>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {analyticsModules.map((module, index) => {
                const Icon = module.icon;
                return (
                  <motion.div
                    key={module.title}
                    variants={listItemVariants}
                  >
                    <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer group hover:scale-[1.02]">
                      <Link href={module.href}>
                        <CardHeader className="pb-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <motion.div 
                                className={`h-12 w-12 rounded-xl ${module.color} flex items-center justify-center group-hover:scale-110 transition-transform`}
                                whileHover={{ rotate: 5 }}
                              >
                                <Icon className="h-6 w-6 text-white" />
                              </motion.div>
                              <div>
                                <CardTitle className="text-lg">{module.title}</CardTitle>
                                <p className="text-sm text-slate-500 mt-1">{module.stats}</p>
                              </div>
                            </div>
                            <Badge
                              variant={module.trend.direction === 'up' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {module.trend.direction === 'up' ? '↗' : '↘'}
                              {module.trend.value}%
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-slate-600 mb-2">{module.description}</p>
                          <p className="text-xs text-slate-500">{module.details}</p>
                        </CardContent>
                      </Link>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>

          {/* Quick Insights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <StatCard
              title="System Health"
              value="Excellent"
              description="All systems operational"
              trend={{
                value: 99.9,
                label: 'uptime',
                direction: 'up'
              }}
              icon={<Target className="w-4 h-4" />}
            />
            
            <ProgressCard
              title="Daily Goals"
              description="Revenue and efficiency targets"
              progress={87}
              current={87}
              target={100}
              unit="%"
              color="success"
            />
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Highlights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Performance improved by 2.3%</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">Cost reduction of $1,916</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="text-sm">Variance decreased by 2.1%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </AnimatedPage>
    </MainLayout>
  );
}