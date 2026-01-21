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
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Users, 
  DollarSign,
  Package,
  RefreshCw,
  Download,
  Filter
} from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerContainer, listItemVariants } from '@/lib/animation-utils';

// Mock data for performance analytics
const performanceMetrics = [
  {
    title: 'Overall Efficiency',
    value: '98.5%',
    change: { value: 2.3, period: 'last month', trend: 'up' as const },
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'bg-green-500',
  },
  {
    title: 'Order Processing Time',
    value: '2.4 min',
    change: { value: -12.5, period: 'last week', trend: 'down' as const },
    icon: <Clock className="w-5 h-5" />,
    color: 'bg-blue-500',
  },
  {
    title: 'Active Users',
    value: '1,247',
    change: { value: 8.2, period: 'last month', trend: 'up' as const },
    icon: <Users className="w-5 h-5" />,
    color: 'bg-purple-500',
  },
  {
    title: 'Revenue per Hour',
    value: '$2,847',
    change: { value: 15.3, period: 'last week', trend: 'up' as const },
    icon: <DollarSign className="w-5 h-5" />,
    color: 'bg-emerald-500',
  },
];

const efficiencyData: ChartDataPoint[] = [
  { label: 'Kitchen', value: 95, color: 'bg-green-500', trend: 'up', percentage: 3.2 },
  { label: 'Service', value: 88, color: 'bg-blue-500', trend: 'up', percentage: 1.8 },
  { label: 'Inventory', value: 92, color: 'bg-purple-500', trend: 'neutral', percentage: 0.5 },
  { label: 'Purchasing', value: 97, color: 'bg-emerald-500', trend: 'up', percentage: 4.1 },
  { label: 'Transfers', value: 85, color: 'bg-orange-500', trend: 'down', percentage: -2.3 },
];

const trendData = [
  { x: 'Jan', y: 85 },
  { x: 'Feb', y: 88 },
  { x: 'Mar', y: 92 },
  { x: 'Apr', y: 89 },
  { x: 'May', y: 95 },
  { x: 'Jun', y: 98 },
];

const topPerformers = [
  {
    id: '1',
    label: 'Main Kitchen',
    value: '98.5%',
    subtitle: 'Efficiency rating',
    badge: { text: 'Excellent', variant: 'default' as const },
    icon: <GastronomyIcons.Chef className="w-4 h-4" />,
  },
  {
    id: '2',
    label: 'Inventory Team',
    value: '96.2%',
    subtitle: 'Stock accuracy',
    badge: { text: 'Great', variant: 'secondary' as const },
    icon: <Package className="w-4 h-4" />,
  },
  {
    id: '3',
    label: 'Purchasing Dept',
    value: '94.8%',
    subtitle: 'Order processing',
    badge: { text: 'Good', variant: 'outline' as const },
    icon: <GastronomyIcons.ShoppingCart className="w-4 h-4" />,
  },
];

export default function PerformancePage() {
  const [timeRange, setTimeRange] = useState('7d');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate data refresh
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleExport = () => {
    // Simulate export functionality
    console.log('Exporting performance data...');
  };

  return (
    <MainLayout title="Performance Analytics">
      <AnimatedPage>
        <div className="p-6 space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Performance Analytics</h1>
              <p className="text-slate-600 mt-2">Track operational performance and efficiency metrics</p>
            </div>
            <div className="flex items-center space-x-3">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24h</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
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
            {performanceMetrics.map((metric, index) => (
              <motion.div key={metric.title} variants={listItemVariants}>
                <AnimatedMetricCard {...metric} />
              </motion.div>
            ))}
          </motion.div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AnimatedBarChart
                  data={efficiencyData}
                  title="Department Efficiency"
                  showTrends={true}
                />
                <AnimatedLineChart
                  data={trendData}
                  title="Performance Trend"
                  color="stroke-green-500"
                />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ListCard
                  title="Top Performers"
                  description="Highest efficiency ratings"
                  items={topPerformers}
                  onItemClick={(id) => console.log('View details for:', id)}
                />
                
                <ProgressCard
                  title="Monthly Target"
                  description="Overall efficiency goal"
                  progress={85}
                  current={85}
                  target={100}
                  unit="%"
                  color="success"
                />
                
                <StatCard
                  title="System Uptime"
                  value="99.9%"
                  description="Last 30 days"
                  trend={{
                    value: 0.1,
                    label: 'vs last month',
                    direction: 'up'
                  }}
                  icon={<TrendingUp className="w-4 h-4" />}
                />
              </div>
            </TabsContent>

            <TabsContent value="efficiency" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Efficiency Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <motion.div
                      variants={staggerContainer}
                      initial="initial"
                      animate="animate"
                      className="space-y-4"
                    >
                      {efficiencyData.map((item, index) => (
                        <motion.div
                          key={item.label}
                          variants={listItemVariants}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${item.color}`} />
                            <span className="font-medium">{item.label}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold">{item.value}%</span>
                            {item.trend && (
                              <Badge
                                variant={item.trend === 'up' ? 'default' : item.trend === 'down' ? 'destructive' : 'secondary'}
                                className="text-xs"
                              >
                                {item.trend === 'up' ? '↗' : item.trend === 'down' ? '↘' : '→'}
                                {item.percentage}%
                              </Badge>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Factors</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <ProgressCard
                        title="Staff Productivity"
                        progress={92}
                        color="success"
                      />
                      <ProgressCard
                        title="Equipment Utilization"
                        progress={87}
                        color="warning"
                      />
                      <ProgressCard
                        title="Process Optimization"
                        progress={95}
                        color="success"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="trends" className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <AnimatedLineChart
                  data={trendData}
                  title="6-Month Performance Trend"
                  height={300}
                  color="stroke-blue-500"
                />
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard
                    title="Best Month"
                    value="June"
                    description="98.5% efficiency"
                    icon={<TrendingUp className="w-4 h-4" />}
                  />
                  <StatCard
                    title="Improvement"
                    value="+13%"
                    description="Since January"
                    trend={{
                      value: 13,
                      label: '6 months',
                      direction: 'up'
                    }}
                    icon={<TrendingUp className="w-4 h-4" />}
                  />
                  <StatCard
                    title="Consistency"
                    value="94.2%"
                    description="Average performance"
                    icon={<GastronomyIcons.Target className="w-4 h-4" />}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="details" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <StatCard
                        title="Order Accuracy"
                        value="99.2%"
                        trend={{ value: 0.8, label: 'vs last week', direction: 'up' }}
                      />
                      <StatCard
                        title="Avg Response Time"
                        value="1.8s"
                        trend={{ value: -15.2, label: 'vs last week', direction: 'down' }}
                      />
                      <StatCard
                        title="Error Rate"
                        value="0.3%"
                        trend={{ value: -25.0, label: 'vs last week', direction: 'down' }}
                      />
                    </div>
                    
                    <ListCard
                      title="Recent Performance Events"
                      items={[
                        {
                          id: '1',
                          label: 'System Optimization',
                          value: '+5.2%',
                          subtitle: '2 hours ago',
                          badge: { text: 'Improvement', variant: 'default' },
                        },
                        {
                          id: '2',
                          label: 'Peak Hour Handling',
                          value: '98.5%',
                          subtitle: '4 hours ago',
                          badge: { text: 'Excellent', variant: 'secondary' },
                        },
                        {
                          id: '3',
                          label: 'Database Query Optimization',
                          value: '-200ms',
                          subtitle: '1 day ago',
                          badge: { text: 'Speed Up', variant: 'outline' },
                        },
                      ]}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </AnimatedPage>
    </MainLayout>
  );
}