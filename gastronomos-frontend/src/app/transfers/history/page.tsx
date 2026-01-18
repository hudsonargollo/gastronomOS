'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { Calendar, Download, Eye, Filter, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

const transferHistory = [
  {
    id: 'TR-098',
    from: 'Main Kitchen',
    to: 'Downtown Branch',
    items: 12,
    status: 'completed',
    date: '2024-01-14',
    completedTime: '3:45 PM',
    driver: 'John Smith',
    value: '$1,156.25'
  },
  {
    id: 'TR-097',
    from: 'Central Warehouse',
    to: 'Airport Location',
    items: 25,
    status: 'completed',
    date: '2024-01-13',
    completedTime: '2:20 PM',
    driver: 'Maria Garcia',
    value: '$2,890.50'
  },
  {
    id: 'TR-096',
    from: 'Westside Location',
    to: 'Downtown Branch',
    items: 8,
    status: 'cancelled',
    date: '2024-01-12',
    completedTime: '11:30 AM',
    driver: 'David Wilson',
    value: '$567.75'
  },
  {
    id: 'TR-095',
    from: 'Downtown Branch',
    to: 'Main Kitchen',
    items: 18,
    status: 'completed',
    date: '2024-01-11',
    completedTime: '4:15 PM',
    driver: 'Sarah Johnson',
    value: '$1,445.80'
  },
];

export default function TransferHistoryPage() {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <MainLayout title="Transfer History">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Transfer History</h1>
            <p className="text-slate-600">View completed and cancelled transfers</p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <GastronomyIcons.Truck className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">3</p>
                  <p className="text-sm text-slate-600">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">1</p>
                  <p className="text-sm text-slate-600">Cancelled</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">63</p>
                  <p className="text-sm text-slate-600">Items Moved</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <GastronomyIcons.ChartPie className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">$6,060</p>
                  <p className="text-sm text-slate-600">Total Value</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transfer History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transferHistory.map((transfer, index) => (
                <motion.div
                  key={transfer.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {transfer.id.split('-')[1]}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900">{transfer.id}</h4>
                      <p className="text-sm text-slate-600">
                        {transfer.from} → {transfer.to}
                      </p>
                      <p className="text-xs text-slate-500">
                        {transfer.date} at {transfer.completedTime} • Driver: {transfer.driver}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-900">{transfer.items}</p>
                      <p className="text-xs text-slate-500">Items</p>
                    </div>
                    
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{transfer.value}</p>
                      <Badge className={getStatusColor(transfer.status)}>
                        {transfer.status.charAt(0).toUpperCase() + transfer.status.slice(1)}
                      </Badge>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
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