'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { Plus, Eye, Download } from 'lucide-react';
import { motion } from 'framer-motion';

const purchaseOrders = [
  { id: 'PO-001', supplier: 'Fresh Produce Co.', total: '$1,245.50', status: 'pending', date: '2024-01-15', items: 12 },
  { id: 'PO-002', supplier: 'Meat Masters Ltd.', total: '$2,890.00', status: 'approved', date: '2024-01-14', items: 8 },
  { id: 'PO-003', supplier: 'Dairy Direct', total: '$567.25', status: 'delivered', date: '2024-01-13', items: 15 },
  { id: 'PO-004', supplier: 'Spice World', total: '$234.75', status: 'pending', date: '2024-01-12', items: 6 },
  { id: 'PO-005', supplier: 'Beverage Plus', total: '$1,123.40', status: 'approved', date: '2024-01-11', items: 20 },
];

export default function PurchaseOrdersPage() {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'approved': return 'bg-blue-100 text-blue-700';
      case 'delivered': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <MainLayout title="Purchase Orders">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Purchase Orders</h1>
            <p className="text-slate-600">Manage and track your purchase orders</p>
          </div>
          <Button className="bg-gradient-to-r from-orange-500 to-red-600">
            <Plus className="h-4 w-4 mr-2" />
            New Purchase Order
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <GastronomyIcons.Timer className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">2</p>
                  <p className="text-sm text-slate-600">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <GastronomyIcons.Receipt className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">2</p>
                  <p className="text-sm text-slate-600">Approved</p>
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
                  <p className="text-2xl font-bold text-slate-900">1</p>
                  <p className="text-sm text-slate-600">Delivered</p>
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
            <CardTitle>Recent Purchase Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {purchaseOrders.map((order, index) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">{order.id.split('-')[1]}</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900">{order.id}</h4>
                      <p className="text-sm text-slate-600">{order.supplier}</p>
                      <p className="text-xs text-slate-500">{order.date} • {order.items} items</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{order.total}</p>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
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