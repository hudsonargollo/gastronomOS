'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { useTranslations } from '@/hooks/use-translations';
import { Package, Apple, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function InventoryPage() {
  const { t } = useTranslations();

  const inventoryModules = [
    {
      title: t('inventory.products'),
      description: t('inventory.productsDesc'),
      icon: Apple,
      href: '/inventory/products',
      color: 'bg-green-500',
      stats: `2.847 ${t('inventory.items')}`,
    },
    {
      title: t('inventory.categories'),
      description: t('inventory.categoriesDesc'),
      icon: GastronomyIcons.Plate,
      href: '/inventory/categories',
      color: 'bg-blue-500',
      stats: '24 categorias',
    },
    {
      title: t('inventory.stockLevels'),
      description: t('inventory.stockLevelsDesc'),
      icon: Warehouse,
      href: '/inventory/stock',
      color: 'bg-orange-500',
      stats: `156 ${t('inventory.lowStock')}`,
    },
  ];

  return (
    <MainLayout title={t('inventory.title')}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t('inventory.title')}</h1>
            <p className="text-slate-600 mt-2">{t('inventory.subtitle')}</p>
          </div>
          <Button className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700">
            <Package className="h-4 w-4 mr-2" />
            {t('inventory.addProduct')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {inventoryModules.map((module, index) => {
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