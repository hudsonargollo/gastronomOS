'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { ArrowRight, MapPin, Clock, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/theme-context';
import { useTranslations } from '@/hooks/use-translations';

const activeTransfers = [
  {
    id: 'TR-001',
    from: 'Main Kitchen',
    to: 'Downtown Branch',
    items: 15,
    status: 'in-transit',
    estimatedArrival: '2:30 PM',
    progress: 75,
    driver: 'John Smith',
    value: '$1,245.50'
  },
  {
    id: 'TR-002',
    from: 'Central Warehouse',
    to: 'Westside Location',
    items: 8,
    status: 'preparing',
    estimatedArrival: '4:15 PM',
    progress: 25,
    driver: 'Maria Garcia',
    value: '$890.25'
  },
  {
    id: 'TR-003',
    from: 'Downtown Branch',
    to: 'Airport Location',
    items: 22,
    status: 'ready',
    estimatedArrival: '5:45 PM',
    progress: 100,
    driver: 'David Wilson',
    value: '$2,156.75'
  },
];

export default function ActiveTransfersPage() {
  const { palette } = useTheme();
  const { t } = useTranslations();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'preparing': return 'bg-yellow-100 text-yellow-700';
      case 'ready': return 'bg-blue-100 text-blue-700';
      case 'in-transit': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'preparing': return <Package className="h-4 w-4" />;
      case 'ready': return <Clock className="h-4 w-4" />;
      case 'in-transit': return <GastronomyIcons.Truck className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: palette.text }}>
              {t('navigation.activeTransfers')}
            </h1>
            <p className="mt-1" style={{ color: palette.textSecondary }}>
              {t('transfers.activeTransfersDesc')}
            </p>
          </div>
          <Button style={{ backgroundColor: palette.primary, color: palette.primaryForeground }}>
            <GastronomyIcons.Truck className="h-4 w-4 mr-2" />
            {t('transfers.newTransfer')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: palette.accent }}>
                  <GastronomyIcons.Truck className="h-6 w-6" style={{ color: palette.text }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: palette.text }}>1</p>
                  <p className="text-sm" style={{ color: palette.textSecondary }}>{t('status.inProgress')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: palette.accent }}>
                  <Package className="h-6 w-6" style={{ color: palette.text }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: palette.text }}>1</p>
                  <p className="text-sm" style={{ color: palette.textSecondary }}>{t('status.pending')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: palette.accent }}>
                  <Clock className="h-6 w-6" style={{ color: palette.text }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: palette.text }}>1</p>
                  <p className="text-sm" style={{ color: palette.textSecondary }}>{t('status.completed')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {activeTransfers.map((transfer, index) => (
            <motion.div
              key={transfer.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className="hover:shadow-lg transition-shadow" style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: palette.primary }}>
                        <span style={{ color: palette.primaryForeground }} className="font-semibold text-sm">
                          {transfer.id.split('-')[1]}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold" style={{ color: palette.text }}>{transfer.id}</h3>
                        <p className="text-sm" style={{ color: palette.textSecondary }}>Driver: {transfer.driver}</p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(transfer.status)}>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(transfer.status)}
                        <span>{transfer.status.replace('-', ' ').toUpperCase()}</span>
                      </div>
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-center">
                        <MapPin className="h-5 w-5 mx-auto mb-1" style={{ color: palette.textSecondary }} />
                        <p className="text-sm font-medium" style={{ color: palette.text }}>{transfer.from}</p>
                        <p className="text-xs" style={{ color: palette.textSecondary }}>{t('common.from')}</p>
                      </div>
                      
                      <div className="flex-1 flex items-center justify-center">
                        <ArrowRight className="h-6 w-6" style={{ color: palette.textSecondary }} />
                      </div>
                      
                      <div className="text-center">
                        <MapPin className="h-5 w-5 mx-auto mb-1" style={{ color: palette.textSecondary }} />
                        <p className="text-sm font-medium" style={{ color: palette.text }}>{transfer.to}</p>
                        <p className="text-xs" style={{ color: palette.textSecondary }}>{t('common.to')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4" style={{ borderTopColor: palette.border, borderTopWidth: 1 }}>
                    <div className="text-center">
                      <p className="text-lg font-semibold" style={{ color: palette.text }}>{transfer.items}</p>
                      <p className="text-xs" style={{ color: palette.textSecondary }}>{t('common.items')}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold" style={{ color: palette.text }}>{transfer.estimatedArrival}</p>
                      <p className="text-xs" style={{ color: palette.textSecondary }}>ETA</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold" style={{ color: palette.text }}>{transfer.value}</p>
                      <p className="text-xs" style={{ color: palette.textSecondary }}>{t('common.total')}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span style={{ color: palette.textSecondary }}>Progress</span>
                      <span className="font-medium" style={{ color: palette.text }}>{transfer.progress}%</span>
                    </div>
                    <div className="w-full rounded-full h-2" style={{ backgroundColor: palette.border }}>
                      <div 
                        className="h-2 rounded-full transition-all duration-300"
                        style={{ width: `${transfer.progress}%`, backgroundColor: palette.primary }}
                      />
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      {t('actions.view')}
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      {t('common.edit')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}