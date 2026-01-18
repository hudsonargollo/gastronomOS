'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { Package, FileText } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const allocationModules = [
  {
    title: 'Current Allocations',
    description: 'View and manage active resource allocations',
    icon: GastronomyIcons.ChartPie,
    href: '/allocations/current',
    color: 'bg-purple-500',
    stats: '89 active',
  },
  {
    title: 'Templates',
    description: 'Create and manage allocation templates',
    icon: FileText,
    href: '/allocations/templates',
    color: 'bg-blue-500',
    stats: '12 templates',
  },
  {
    title: 'Unallocated Items',
    description: 'Items waiting for allocation',
    icon: Package,
    href: '/allocations/unallocated',
    color: 'bg-orange-500',
    stats: '23 pending',
  },
];

export default function AllocationsPage() {
  return (
    <MainLayout title="Allocations">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Allocations</h1>
            <p className="text-slate-600 mt-2">Manage resource allocation across locations</p>
          </div>
          <Button className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700">
            <GastronomyIcons.Scale className="h-4 w-4 mr-2" />
            New Allocation
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allocationModules.map((module, index) => {
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