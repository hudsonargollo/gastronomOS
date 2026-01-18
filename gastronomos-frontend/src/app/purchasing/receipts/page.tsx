'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { Upload, Eye, Download, Search, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

const receipts = [
  { 
    id: 'RCP-001', 
    supplier: 'Fresh Produce Co.', 
    amount: '$1,245.50', 
    status: 'processed', 
    date: '2024-01-15',
    items: 12,
    poNumber: 'PO-001'
  },
  { 
    id: 'RCP-002', 
    supplier: 'Meat Masters Ltd.', 
    amount: '$2,890.00', 
    status: 'pending', 
    date: '2024-01-14',
    items: 8,
    poNumber: 'PO-002'
  },
  { 
    id: 'RCP-003', 
    supplier: 'Dairy Direct', 
    amount: '$567.25', 
    status: 'processed', 
    date: '2024-01-13',
    items: 15,
    poNumber: 'PO-003'
  },
  { 
    id: 'RCP-004', 
    supplier: 'Spice World', 
    amount: '$234.75', 
    status: 'error', 
    date: '2024-01-12',
    items: 6,
    poNumber: 'PO-004'
  },
];

export default function ReceiptsPage() {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'error': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <MainLayout title="Receipts">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Receipt Processing</h1>
            <p className="text-slate-600">Upload and manage purchase receipts</p>
          </div>
          <Button className="bg-gradient-to-r from-orange-500 to-red-600">
            <Upload className="h-4 w-4 mr-2" />
            Upload Receipt
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <GastronomyIcons.Receipt className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">2</p>
                  <p className="text-sm text-slate-600">Processed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <GastronomyIcons.Timer className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">1</p>
                  <p className="text-sm text-slate-600">Pending</p>
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
                  <p className="text-sm text-slate-600">Errors</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <GastronomyIcons.ChartPie className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">$4,937</p>
                  <p className="text-sm text-slate-600">Total Value</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Receipts</CardTitle>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {receipts.map((receipt, index) => (
                <motion.div
                  key={receipt.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center">
                      <GastronomyIcons.Receipt className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900">{receipt.id}</h4>
                      <p className="text-sm text-slate-600">{receipt.supplier}</p>
                      <p className="text-xs text-slate-500">
                        {receipt.date} • {receipt.items} items • PO: {receipt.poNumber}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{receipt.amount}</p>
                      <Badge className={getStatusColor(receipt.status)}>
                        {receipt.status.charAt(0).toUpperCase() + receipt.status.slice(1)}
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

        <Card>
          <CardHeader>
            <CardTitle>Upload New Receipt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-orange-400 transition-colors cursor-pointer">
              <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Upload Receipt</h3>
              <p className="text-slate-600 mb-4">
                Drag and drop your receipt files here, or click to browse
              </p>
              <Button variant="outline">
                Choose Files
              </Button>
              <p className="text-xs text-slate-500 mt-2">
                Supports PDF, JPG, PNG files up to 10MB
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}