'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { useTranslations } from '@/hooks/use-translations';
import { ShoppingCart, FileText, Building2 } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function PurchasingPage() {
  const { t } = useTranslations();

  const purchasingModules = [
    {
      title: t('purchasing.purchaseOrders'),
      description: t('purchasing.purchaseOrdersDesc'),
      icon: FileText,
      href: '/purchasing/orders',
      color: 'bg-blue-500',
      stats: `23 ${t('purchasing.activeOrders')}`,
    },
    {
      title: t('purchasing.suppliers'),
      description: t('purchasing.suppliersDesc'),
      icon: Building2,
      href: '/purchasing/suppliers',
      color: 'bg-purple-500',
      stats: `47 ${t('purchasing.suppliersCount')}`,
    },
    {
      title: t('purchasing.receipts'),
      description: t('purchasing.receiptsDesc'),
      icon: GastronomyIcons.Receipt,
      href: '/purchasing/receipts',
      color: 'bg-green-500',
      stats: `156 ${t('purchasing.processed')}`,
    },
  ];

  return (
    <MainLayout title={t('purchasing.title')}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t('purchasing.title')}</h1>
            <p className="text-slate-600 mt-2">{t('purchasing.subtitle')}</p>
          </div>
          <Button className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700">
            <ShoppingCart className="h-4 w-4 mr-2" />
            {t('purchasing.newPurchaseOrder')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {purchasingModules.map((module, index) => {
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