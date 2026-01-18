'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from '@/hooks/use-translations';

const stockLevels = [
  { id: 1, product: 'Tomatoes', current: 45, minimum: 50, maximum: 200, status: 'low', location: 'Main Kitchen' },
  { id: 2, product: 'Chicken Breast', current: 120, minimum: 80, maximum: 300, status: 'good', location: 'Cold Storage' },
  { id: 3, product: 'Olive Oil', current: 25, minimum: 30, maximum: 100, status: 'low', location: 'Pantry' },
  { id: 4, product: 'Rice', current: 180, minimum: 100, maximum: 400, status: 'good', location: 'Dry Storage' },
  { id: 5, product: 'Milk', current: 15, minimum: 20, maximum: 80, status: 'critical', location: 'Refrigerator' },
];

export default function StockLevelsPage() {
  const { t } = useTranslations();

  return (
    <MainLayout title={t('pages.inventory.stockLevels.title')}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('pages.inventory.stockLevels.title')}</h1>
          <p className="text-slate-600">{t('pages.inventory.stockLevels.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">3</p>
                  <p className="text-sm text-slate-600">{t('pages.inventory.stockLevels.criticalItems')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">8</p>
                  <p className="text-sm text-slate-600">{t('pages.inventory.stockLevels.lowStock')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">156</p>
                  <p className="text-sm text-slate-600">{t('pages.inventory.stockLevels.wellStocked')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('pages.inventory.stockLevels.stockStatusByProduct')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stockLevels.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <GastronomyIcons.Warehouse className="h-8 w-8 text-slate-400" />
                    <div>
                      <h4 className="font-medium text-slate-900">{item.product}</h4>
                      <p className="text-sm text-slate-600">{item.location}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900">{item.current} {t('pages.inventory.stockLevels.units')}</p>
                      <p className="text-xs text-slate-500">{t('pages.inventory.stockLevels.min')}: {item.minimum} | {t('pages.inventory.stockLevels.max')}: {item.maximum}</p>
                    </div>
                    
                    <Badge 
                      variant={item.status === 'critical' ? 'destructive' : item.status === 'low' ? 'secondary' : 'default'}
                      className={
                        item.status === 'critical' ? 'bg-red-100 text-red-700' :
                        item.status === 'low' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }
                    >
                      {item.status === 'critical' ? t('status.critical') : 
                       item.status === 'low' ? t('status.low') : 
                       t('status.good')}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}