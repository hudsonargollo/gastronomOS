'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { AlertTriangle, Clock, Zap, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from '@/hooks/use-translations';

const emergencyTransfers = [
  {
    id: 'ETR-001',
    from: 'Central Warehouse',
    to: 'Downtown Branch',
    reason: 'Stock Outage - Tomatoes',
    priority: 'critical',
    items: 5,
    status: 'urgent',
    requestedBy: 'Sarah Johnson',
    estimatedTime: '45 mins',
    value: '$234.50'
  },
  {
    id: 'ETR-002',
    from: 'Main Kitchen',
    to: 'Airport Location',
    reason: 'Equipment Failure - Backup Supplies',
    priority: 'high',
    items: 12,
    status: 'processing',
    requestedBy: 'Mike Chen',
    estimatedTime: '1.5 hours',
    value: '$1,156.75'
  },
];

export default function EmergencyTransfersPage() {
  const { t } = useTranslations();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'urgent': return 'bg-red-100 text-red-700';
      case 'processing': return 'bg-yellow-100 text-yellow-700';
      case 'dispatched': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <MainLayout title={t('pages.transfers.emergency.title')}>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('pages.transfers.emergency.title')}</h1>
            <p className="text-slate-600">{t('pages.transfers.emergency.subtitle')}</p>
          </div>
          <Button className="bg-gradient-to-r from-red-500 to-red-600">
            <AlertTriangle className="h-4 w-4 mr-2" />
            {t('pages.transfers.emergency.newEmergencyTransfer')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-900">1</p>
                  <p className="text-sm text-red-700">{t('pages.transfers.emergency.critical')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Zap className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-900">1</p>
                  <p className="text-sm text-orange-700">{t('pages.transfers.emergency.highPriority')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">2</p>
                  <p className="text-sm text-slate-600">{t('pages.transfers.emergency.active')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <GastronomyIcons.Truck className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">45m</p>
                  <p className="text-sm text-slate-600">{t('pages.transfers.emergency.avgResponse')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {emergencyTransfers.map((transfer, index) => (
            <motion.div
              key={transfer.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className={`border-l-4 ${
                transfer.priority === 'critical' ? 'border-l-red-500' : 
                transfer.priority === 'high' ? 'border-l-orange-500' : 'border-l-yellow-500'
              }`}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        transfer.priority === 'critical' ? 'bg-red-100' : 
                        transfer.priority === 'high' ? 'bg-orange-100' : 'bg-yellow-100'
                      }`}>
                        <AlertTriangle className={`h-5 w-5 ${
                          transfer.priority === 'critical' ? 'text-red-600' : 
                          transfer.priority === 'high' ? 'text-orange-600' : 'text-yellow-600'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{transfer.id}</h3>
                        <p className="text-sm text-slate-600">{t('pages.transfers.emergency.requestedBy')} {transfer.requestedBy}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getPriorityColor(transfer.priority)}>
                        {transfer.priority === 'critical' ? t('status.critical').toUpperCase() : 
                         transfer.priority === 'high' ? 'HIGH' : 
                         transfer.priority.toUpperCase()}
                      </Badge>
                      <Badge className={getStatusColor(transfer.status)}>
                        {transfer.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="font-medium text-slate-900 mb-2">Emergency Reason</h4>
                    <p className="text-slate-700">{transfer.reason}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">From</p>
                      <p className="font-medium text-slate-900">{transfer.from}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">To</p>
                      <p className="font-medium text-slate-900">{transfer.to}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                    <div className="text-center">
                      <p className="text-lg font-semibold text-slate-900">{transfer.items}</p>
                      <p className="text-xs text-slate-500">{t('pages.locations.items')}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-slate-900">{transfer.estimatedTime}</p>
                      <p className="text-xs text-slate-500">ETA</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-slate-900">{transfer.value}</p>
                      <p className="text-xs text-slate-500">Value</p>
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                    >
                      Escalate Priority
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      Track Transfer
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      {t('common.view')} Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card className="border-dashed border-2 border-slate-300">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Emergency Transfer Protocol</h3>
            <p className="text-slate-600 mb-4">
              Emergency transfers are prioritized for critical situations like stock outages, 
              equipment failures, or urgent customer demands.
            </p>
            <Button className="bg-gradient-to-r from-red-500 to-red-600">
              <Plus className="h-4 w-4 mr-2" />
              {t('pages.transfers.emergency.newEmergencyTransfer')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}