'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const analyticsModules = [
  {
    title: 'Performance',
    description: 'Track operational performance metrics',
    icon: GastronomyIcons.TrendingUp,
    href: '/analytics/performance',
    color: 'bg-green-500',
    stats: '98.5% efficiency',
  },
  {
    title: 'Cost Analysis',
    description: 'Analyze costs and profitability',
    icon: GastronomyIcons.ChartPie,
    href: '/analytics/costs',
    color: 'bg-blue-500',
    stats: '$47K this month',
  },
  {
    title: 'Variance Reports',
    description: 'Compare planned vs actual performance',
    icon: BarChart3,
    href: '/analytics/variance',
    color: 'bg-orange-500',
    stats: '12% variance',
  },
];

export default function AnalyticsPage() {
  return (
    <MainLayout title="Analytics">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
            <p className="text-slate-600 mt-2">Insights and reports for data-driven decisions</p>
          </div>
          <Button className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700">
            <BarChart3 className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {analyticsModules.map((module, index) => {
            const Icon = module.icon;
            return (
              <motion.div
                key={module.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <Link href={module.href}>
                    <CardHeader className="pb-4">
                      <div className="flex items-center space-x-4">
                        <div className={`h-12 w-12 rounded-xl ${module.color} flex items-center justify-center`}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{module.title}</CardTitle>
                          <p className="text-sm text-slate-500 mt-1">{module.stats}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-slate-600">{module.description}</p>
                    </CardContent>
                  </Link>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}