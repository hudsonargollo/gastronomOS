'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { MapPin, Plus, Users, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from '@/hooks/use-translations';

const locations = [
  {
    id: 1,
    name: 'Downtown Restaurant',
    type: 'RESTAURANT',
    address: '123 Main St, Downtown',
    status: 'active',
    staff: 24,
    inventory: 1247,
    manager: 'Sarah Johnson',
  },
  {
    id: 2,
    name: 'Westside Location',
    type: 'RESTAURANT',
    address: '456 West Ave, Westside',
    status: 'active',
    staff: 18,
    inventory: 892,
    manager: 'Mike Chen',
  },
  {
    id: 3,
    name: 'Central Commissary',
    type: 'COMMISSARY',
    address: '789 Industrial Blvd',
    status: 'active',
    staff: 12,
    inventory: 3456,
    manager: 'Lisa Rodriguez',
  },
  {
    id: 4,
    name: 'Pop-up Market',
    type: 'POP_UP',
    address: 'Farmers Market, Saturdays',
    status: 'seasonal',
    staff: 4,
    inventory: 156,
    manager: 'Tom Wilson',
  },
];

export default function LocationsPage() {
  const { t } = useTranslations();

  return (
    <MainLayout title={t('pages.locations.title')}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t('pages.locations.title')}</h1>
            <p className="text-slate-600 mt-2">{t('pages.locations.subtitle')}</p>
          </div>
          <Button className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700">
            <Plus className="h-4 w-4 mr-2" />
            {t('pages.locations.addLocation')}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locations.map((location, index) => (
            <motion.div
              key={location.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                        <MapPin className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{location.name}</CardTitle>
                        <p className="text-sm text-slate-500">{location.address}</p>
                      </div>
                    </div>
                    <Badge 
                      variant={location.status === 'active' ? 'default' : 'secondary'}
                      className={location.status === 'active' ? 'bg-green-100 text-green-700' : ''}
                    >
                      {location.status === 'active' ? t('status.active') : 
                       location.status === 'seasonal' ? t('status.seasonal') : 
                       t('status.inactive')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{t('pages.locations.type')}</span>
                    <Badge variant="outline">
                      {location.type === 'RESTAURANT' ? t('locations.restaurant') :
                       location.type === 'COMMISSARY' ? t('locations.commissary') :
                       location.type === 'POP_UP' ? t('locations.popUp') :
                       location.type.replace('_', ' ')}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{t('pages.locations.manager')}</span>
                    <span className="font-medium">{location.manager}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium">{location.staff}</p>
                        <p className="text-xs text-slate-500">{t('pages.locations.staff')}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Package className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium">{location.inventory.toLocaleString()}</p>
                        <p className="text-xs text-slate-500">{t('pages.locations.items')}</p>
                      </div>
                    </div>
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