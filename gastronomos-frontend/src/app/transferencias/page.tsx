'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { ArrowRightLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslations } from '@/hooks/use-translations';

export default function TransfersPage() {
  const { t } = useTranslations();

  const transferModules = [
    {
      title: t('navigation.activeTransfers'),
      description: t('transfers.activeTransfersDesc'),
      icon: GastronomyIcons.Truck,
      href: '/transfers/active',
      color: 'bg-orange-500',
      stats: `12 ${t('transfers.inTransit')}`,
    },
    {
      title: t('navigation.transferHistory'),
      description: t('transfers.transferHistoryDesc'),
      icon: FileText,
      href: '/transfers/history',
      color: 'bg-blue-500',
      stats: `847 ${t('transfers.completed')}`,
    },
    {
      title: t('navigation.emergencyTransfers'),
      description: t('transfers.emergencyTransfersDesc'),
      icon: GastronomyIcons.Timer,
      href: '/transfers/emergency',
      color: 'bg-red-500',
      stats: `3 ${t('transfers.urgent')}`,
    },
  ];

  return (
    <MainLayout title={t('pages.transfers.title')}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t('pages.transfers.title')}</h1>
            <p className="text-slate-600 mt-2">{t('pages.transfers.subtitle')}</p>
          </div>
          <Button className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            {t('pages.transfers.newTransfer')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {transferModules.map((module, index) => {
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