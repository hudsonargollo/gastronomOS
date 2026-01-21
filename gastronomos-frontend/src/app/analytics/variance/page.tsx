'use client';

import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { AnimatedPage } from '@/components/ui/animated-page';
import { 
  AnimatedBarChart, 
  AnimatedLineChart, 
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
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Filter
} from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerContainer, listItemVariants } from '@/lib/animation-utils';

// Mock data for variance analytics
const varianceMetrics = [
  {
    title: 'Overall Variance',
    value: '12.3%',
    change: { value: -2.1, period: 'last month', trend: 'down' as const },
    icon: <BarChart3 className="w-5 h-5" />,
    color: 'bg-orange-500',
  },
  {
    title: 'Budget Variance',
    value: '+$3,450',
    change: { value: 8.5, period: 'vs planned', trend: 'up' as const },
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'bg-red-500',
  },
  {
    title: 'Performance Variance',
    value: '-5.2%',
    change: { value: -1.8, period: 'vs target', trend: 'down' as const },
    icon: <TrendingDown className="w-5 h-5" />,
    color: 'bg-blue-500',
  },
  {
    title: 'Quality Score',
    value: '94.8%',
    change: { value: 2.3, period: 'vs standard', trend: 'up' as const },
    icon: <CheckCircle className="w-5 h-5" />,
    color: 'bg-green-500',
  },
];

const departmentVarianceData: ChartDataPoint[] = [
  { label: 'Kitchen', value: 8.5, color: 'bg-green-500', trend: 'down', percentage: -2.1 },
  { label: 'Service', value: 15.2, color: 'bg-orange-500', trend: 'up', percentage: 3.8 },
  { label: 'Inventory', value: 6.8, color: 'bg-blue-500', trend: 'down', percentage: -1.2 },
  { label: 'Purchasing', value: 18.9, color: 'bg-red-500', trend: 'up', percentage: 5.4 },
  { label: 'Maintenance', value: 22.1, color: 'bg-purple-500', trend: 'up', percentage: 8.7 },
];

const varianceTrendData = [
  { x: 'Jan', y: 15.2 },
  { x: 'Feb', y: 13.8 },
  { x: 'Mar', y: 16.5 },
  { x: 'Apr', y: 14.2 },
  { x: 'May', y: 11.9 },
  { x: 'Jun', y: 12.3 },
];

const criticalVariances = [
  {
    id: '1',
    label: 'Food Cost Overrun',
    value: '+18.5%',
    subtitle: 'Purchasing Department',
    badge: { text: 'Critical', variant: 'destructive' as const },
    icon: <XCircle className="w-4 h-4" />,
  },
  {
    id: '2',
    label: 'Service Time Delay',
    value: '+12.3%',
    subtitle: 'Front of House',
    badge: { text: 'High', variant: 'secondary' as const },
    icon: <AlertCircle className="w-4 h-4" />,
  },
  {
    id: '3',
    label: 'Inventory Accuracy',
    value: '-8.7%',
    subtitle: 'Stock Management',
    badge: { text: 'Medium', variant: 'outline' as const },
    icon: <TrendingDown className="w-4 h-4" />,
  },
];

const positiveVariances = [
  {
    id: '1',
    label: 'Energy Efficiency',
    value: '-15.2%',
    subtitle: 'Below target consumption',
    badge: { text: 'Excellent', variant: 'default' as const },
    icon: <CheckCircle className="w-4 h-4" />,
  },
  {
    id: '2',
    label: 'Staff Productivity',
    value: '+8.9%',
    subtitle: 'Above performance target',
    badge: { text: 'Good', variant: 'secondary' as const },
    icon: <TrendingUp className="w-4 h-4" />,
  },
];

const varianceCategories = [
  { name: 'Cost Variance', planned: 45000, actual: 48500, variance: 7.8, status: 'over' },
  { name: 'Time Variance', planned: 120, actual: 115, variance: -4.2, status: 'under' },
  { name: 'Quality Variance', planned: 95, actual: 94.8, variance: -0.2, status: 'under' },
  { name: 'Quantity Variance', planned: 1000, actual: 1050, variance: 5.0, status: 'over' },
];

export default function VarianceReportsPage() {
  const [timeRange, setTimeRange] = useState('30d');
  const [category, setCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleExport = () => {
    console.log('Exporting variance reports...');
  };

  return (
    <MainLayout title="Variance Reports">
      <AnimatedPage>
        <div className="p-6 space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Variance Reports</h1>
              <p className="text-slate-600 mt-2">Compare planned vs actual performance across all operations</p>
            </div>
            <div className="flex items-center space-x-3">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="cost">Cost</SelectItem>
                  <SelectItem value="time">Time</SelectItem>
                  <SelectItem value="quality">Quality</SelectItem>
                  <SelectItem value="quantity">Quantity</SelectItem>
                </SelectContent>
              </Select>
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
            {varianceMetrics.map((metric, index) => (
              <motion.div key={metric.title} variants={listItemVariants}>
                <AnimatedMetricCard {...metric} />
              </motion.div>
            ))}
          </motion.div>

          {/* Critical Alerts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="flex items-center text-red-800">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  Critical Variances
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {criticalVariances.map((variance) => (
                    <div key={variance.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                      <div className="flex items-center space-x-3">
                        <div className="text-red-600">{variance.icon}</div>
                        <div>
                          <p className="font-medium text-slate-900">{variance.label}</p>
                          <p className="text-sm text-slate-600">{variance.subtitle}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">{variance.value}</span>
                        <Badge variant={variance.badge.variant}>{variance.badge.text}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center text-green-800">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Positive Variances
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {positiveVariances.map((variance) => (
                    <div key={variance.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                      <div className="flex items-center space-x-3">
                        <div className="text-green-600">{variance.icon}</div>
                        <div>
                          <p className="font-medium text-slate-900">{variance.label}</p>
                          <p className="text-sm text-slate-600">{variance.subtitle}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">{variance.value}</span>
                        <Badge variant={variance.badge.variant}>{variance.badge.text}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="departments">Departments</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AnimatedBarChart
                  data={departmentVarianceData}
                  title="Department Variance (%)"
                  showTrends={true}
                />
                <AnimatedLineChart
                  data={varianceTrendData}
                  title="Variance Trend (6 Months)"
                  color="stroke-orange-500"
                />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <StatCard
                  title="Highest Variance"
                  value="Maintenance"
                  description="22.1% above target"
                  trend={{
                    value: 8.7,
                    label: 'vs last month',
                    direction: 'up'
                  }}
                  icon={<TrendingUp className="w-4 h-4" />}
                />
                
                <StatCard
                  title="Best Performance"
                  value="Inventory"
                  description="6.8% variance"
                  trend={{
                    value: -1.2,
                    label: 'improvement',
                    direction: 'down'
                  }}
                  icon={<CheckCircle className="w-4 h-4" />}
                />
                
                <StatCard
                  title="Action Items"
                  value="7"
                  description="Require attention"
                  icon={<AlertCircle className="w-4 h-4" />}
                />
              </div>
            </TabsContent>

            <TabsContent value="departments" className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Department Performance vs Targets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="space-y-4"
                    >
                      {departmentVarianceData.map((dept, index) => (
                        <motion.div
                          key={dept.label}
                          variants={listItemVariants}
                          className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                        >
                          <div className="flex items-center space-x-4">
                            <div className={`w-4 h-4 rounded-full ${dept.color}`} />
                            <div>
                              <h4 className="font-medium text-slate-900">{dept.label}</h4>
                              <p className="text-sm text-slate-600">
                                {dept.trend === 'up' ? 'Above' : dept.trend === 'down' ? 'Below' : 'At'} target
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg">{dept.value}%</div>
                            <div className="flex items-center space-x-1">
                              <Badge
                                variant={dept.trend === 'up' ? 'destructive' : dept.trend === 'down' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {dept.trend === 'up' ? '↗' : dept.trend === 'down' ? '↘' : '→'}
                                {dept.percentage}%
                              </Badge>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="trends" className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <AnimatedLineChart
                  data={varianceTrendData}
                  title="6-Month Variance Trend"
                  height={300}
                  color="stroke-orange-500"
                />
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard
                    title="Best Month"
                    value="May"
                    description="11.9% variance"
                    icon={<CheckCircle className="w-4 h-4" />}
                  />
                  <StatCard
                    title="Improvement"
                    value="-2.9%"
                    description="Since January"
                    trend={{
                      value: -19.1,
                      label: '6 months',
                      direction: 'down'
                    }}
                    icon={<TrendingDown className="w-4 h-4" />}
                  />
                  <StatCard
                    title="Average Variance"
                    value="14.0%"
                    description="6-month average"
                    icon={<BarChart3 className="w-4 h-4" />}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="analysis" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Variance Category Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {varianceCategories.map((category, index) => (
                        <div key={category.name} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{category.name}</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-slate-600">
                                {category.planned.toLocaleString()} → {category.actual.toLocaleString()}
                              </span>
                              <Badge
                                variant={category.status === 'over' ? 'destructive' : 'default'}
                                className="text-xs"
                              >
                                {category.variance > 0 ? '+' : ''}{category.variance}%
                              </Badge>
                            </div>
                          </div>
                          <ProgressCard
                            title=""
                            progress={Math.abs(category.variance)}
                            color={Math.abs(category.variance) > 10 ? 'danger' : Math.abs(category.variance) > 5 ? 'warning' : 'success'}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Root Cause Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                        <h4 className="font-medium text-red-800 mb-2">High Impact Issues</h4>
                        <ul className="text-sm text-red-700 space-y-1">
                          <li>• Supplier price increases (Food costs +18.5%)</li>
                          <li>• Equipment maintenance delays (+22.1%)</li>
                          <li>• Staff training gaps (Service time +12.3%)</li>
                        </ul>
                      </div>
                      
                      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <h4 className="font-medium text-yellow-800 mb-2">Medium Impact Issues</h4>
                        <ul className="text-sm text-yellow-700 space-y-1">
                          <li>• Seasonal demand fluctuations</li>
                          <li>• Inventory counting accuracy</li>
                          <li>• Process optimization opportunities</li>
                        </ul>
                      </div>
                      
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h4 className="font-medium text-green-800 mb-2">Positive Factors</h4>
                        <ul className="text-sm text-green-700 space-y-1">
                          <li>• Energy efficiency improvements</li>
                          <li>• Staff productivity gains</li>
                          <li>• Waste reduction initiatives</li>
                        </ul>
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