'use client';

import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { AnimatedPage } from '@/components/ui/animated-page';
import { 
  AnimatedBarChart, 
  AnimatedLineChart, 
  AnimatedPieChart,
  AnimatedMetricCard,
  ChartDataPoint 
} from '@/components/ui/animated-charts';
import { StatCard, ProgressCard, ListCard } from '@/components/ui/dashboard-widgets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  PieChart,
  Calculator,
  Target,
  RefreshCw,
  Download,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerContainer, listItemVariants } from '@/lib/animation-utils';

// Mock data for cost analytics
const costMetrics = [
  {
    title: 'Total Monthly Costs',
    value: '$47,284',
    change: { value: -3.2, period: 'last month', trend: 'down' as const },
    icon: <DollarSign className="w-5 h-5" />,
    color: 'bg-blue-500',
  },
  {
    title: 'Cost per Order',
    value: '$12.45',
    change: { value: -8.1, period: 'last week', trend: 'down' as const },
    icon: <Calculator className="w-5 h-5" />,
    color: 'bg-green-500',
  },
  {
    title: 'Profit Margin',
    value: '34.2%',
    change: { value: 2.8, period: 'last month', trend: 'up' as const },
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'bg-emerald-500',
  },
  {
    title: 'Budget Utilization',
    value: '78.5%',
    change: { value: 5.3, period: 'this month', trend: 'up' as const },
    icon: <Target className="w-5 h-5" />,
    color: 'bg-purple-500',
  },
];

const costBreakdownData: ChartDataPoint[] = [
  { label: 'Food & Ingredients', value: 18500, color: 'bg-blue-500' },
  { label: 'Labor', value: 15200, color: 'bg-green-500' },
  { label: 'Utilities', value: 4800, color: 'bg-yellow-500' },
  { label: 'Equipment', value: 3200, color: 'bg-purple-500' },
  { label: 'Supplies', value: 2900, color: 'bg-red-500' },
  { label: 'Other', value: 2684, color: 'bg-gray-500' },
];

const monthlyTrendData = [
  { x: 'Jan', y: 45200 },
  { x: 'Feb', y: 43800 },
  { x: 'Mar', y: 46500 },
  { x: 'Apr', y: 44200 },
  { x: 'May', y: 48900 },
  { x: 'Jun', y: 47284 },
];

const costCenterData: ChartDataPoint[] = [
  { label: 'Kitchen Operations', value: 28500, color: 'bg-blue-500', trend: 'down', percentage: -2.1 },
  { label: 'Front of House', value: 12800, color: 'bg-green-500', trend: 'up', percentage: 1.5 },
  { label: 'Administration', value: 3200, color: 'bg-purple-500', trend: 'neutral', percentage: 0.2 },
  { label: 'Maintenance', value: 2784, color: 'bg-orange-500', trend: 'up', percentage: 8.3 },
];

const topExpenses = [
  {
    id: '1',
    label: 'Premium Ingredients',
    value: '$8,450',
    subtitle: 'Food & Beverage',
    badge: { text: 'High Priority', variant: 'destructive' as const },
    icon: <GastronomyIcons.Ingredients className="w-4 h-4" />,
  },
  {
    id: '2',
    label: 'Staff Wages',
    value: '$7,200',
    subtitle: 'Labor Costs',
    badge: { text: 'Fixed', variant: 'secondary' as const },
    icon: <GastronomyIcons.Staff className="w-4 h-4" />,
  },
  {
    id: '3',
    label: 'Equipment Lease',
    value: '$2,100',
    subtitle: 'Monthly Payment',
    badge: { text: 'Recurring', variant: 'outline' as const },
    icon: <GastronomyIcons.Equipment className="w-4 h-4" />,
  },
];

const budgetAlerts = [
  {
    id: '1',
    label: 'Food Costs Exceeding Budget',
    value: '105%',
    subtitle: 'Over budget by $850',
    badge: { text: 'Alert', variant: 'destructive' as const },
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  {
    id: '2',
    label: 'Utility Costs Rising',
    value: '92%',
    subtitle: 'Approaching limit',
    badge: { text: 'Warning', variant: 'secondary' as const },
    icon: <TrendingUp className="w-4 h-4" />,
  },
];

export default function CostAnalysisPage() {
  const [timeRange, setTimeRange] = useState('30d');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleExport = () => {
    console.log('Exporting cost analysis data...');
  };

  return (
    <MainLayout title="Cost Analysis">
      <AnimatedPage>
        <div className="p-6 space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Cost Analysis</h1>
              <p className="text-slate-600 mt-2">Analyze costs, profitability, and budget utilization</p>
            </div>
            <div className="flex items-center space-x-3">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </motion.div>

          {/* Key Metrics */}
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {costMetrics.map((metric, index) => (
              <motion.div key={metric.title} variants={listItemVariants}>
                <AnimatedMetricCard {...metric} />
              </motion.div>
            ))}
          </motion.div>

          {/* Budget Alerts */}
          {budgetAlerts.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <CardTitle className="flex items-center text-orange-800">
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    Budget Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {budgetAlerts.map((alert) => (
                      <div key={alert.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <div className="flex items-center space-x-3">
                          <div className="text-orange-600">{alert.icon}</div>
                          <div>
                            <p className="font-medium text-slate-900">{alert.label}</p>
                            <p className="text-sm text-slate-600">{alert.subtitle}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">{alert.value}</span>
                          <Badge variant={alert.badge.variant}>{alert.badge.text}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="budget">Budget</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AnimatedPieChart
                  data={costBreakdownData}
                  title="Cost Distribution"
                  size={250}
                />
                <AnimatedBarChart
                  data={costCenterData}
                  title="Cost Centers"
                  showTrends={true}
                />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ListCard
                  title="Top Expenses"
                  description="Highest cost items this month"
                  items={topExpenses}
                  onItemClick={(id) => console.log('View expense details:', id)}
                />
                
                <ProgressCard
                  title="Monthly Budget"
                  description="Current utilization"
                  progress={78.5}
                  current={47284}
                  target={60000}
                  unit="$"
                  color="warning"
                />
                
                <StatCard
                  title="Cost Efficiency"
                  value="92.3%"
                  description="vs industry average"
                  trend={{
                    value: 4.2,
                    label: 'vs last quarter',
                    direction: 'up'
                  }}
                  icon={<Target className="w-4 h-4" />}
                />
              </div>
            </TabsContent>

            <TabsContent value="breakdown" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Detailed Cost Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="space-y-4"
                    >
                      {costBreakdownData.map((item, index) => (
                        <motion.div
                          key={item.label}
                          variants={listItemVariants}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${item.color}`} />
                            <span className="font-medium">{item.label}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">${item.value.toLocaleString()}</div>
                            <div className="text-sm text-slate-500">
                              {((item.value / costBreakdownData.reduce((sum, d) => sum + d.value, 0)) * 100).toFixed(1)}%
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Cost per Unit Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <StatCard
                        title="Cost per Meal"
                        value="$8.45"
                        trend={{ value: -5.2, label: 'vs last month', direction: 'down' }}
                      />
                      <StatCard
                        title="Cost per Customer"
                        value="$12.30"
                        trend={{ value: -2.1, label: 'vs last month', direction: 'down' }}
                      />
                      <StatCard
                        title="Cost per Hour"
                        value="$156.20"
                        trend={{ value: 1.8, label: 'vs last month', direction: 'up' }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="trends" className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <AnimatedLineChart
                  data={monthlyTrendData}
                  title="6-Month Cost Trend"
                  height={300}
                  color="stroke-blue-500"
                />
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard
                    title="Lowest Month"
                    value="February"
                    description="$43,800 total costs"
                    icon={<TrendingDown className="w-4 h-4" />}
                  />
                  <StatCard
                    title="Cost Reduction"
                    value="-$1,916"
                    description="vs last month"
                    trend={{
                      value: -3.2,
                      label: 'month over month',
                      direction: 'down'
                    }}
                    icon={<TrendingDown className="w-4 h-4" />}
                  />
                  <StatCard
                    title="Average Monthly"
                    value="$45,947"
                    description="6-month average"
                    icon={<Calculator className="w-4 h-4" />}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="budget" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Budget vs Actual</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {costBreakdownData.map((item, index) => {
                        const budgetAmount = item.value * 1.15; // Assume 15% budget buffer
                        const utilization = (item.value / budgetAmount) * 100;
                        
                        return (
                          <div key={item.label} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{item.label}</span>
                              <span className="text-slate-600">
                                ${item.value.toLocaleString()} / ${budgetAmount.toLocaleString()}
                              </span>
                            </div>
                            <ProgressCard
                              title=""
                              progress={utilization}
                              color={utilization > 90 ? 'danger' : utilization > 75 ? 'warning' : 'success'}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Budget Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-slate-900">78.5%</div>
                        <div className="text-slate-600">Overall Budget Utilization</div>
                      </div>
                      
                      <div className="space-y-4">
                        <StatCard
                          title="Remaining Budget"
                          value="$12,716"
                          description="Available this month"
                          icon={<DollarSign className="w-4 h-4" />}
                        />
                        <StatCard
                          title="Projected End-of-Month"
                          value="$52,400"
                          description="Based on current trend"
                          trend={{ value: 8.2, label: 'over budget', direction: 'up' }}
                          icon={<TrendingUp className="w-4 h-4" />}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </AnimatedPage>
    </MainLayout>
  );
}