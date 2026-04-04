'use client';

import React from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { Upload, Eye, Download, Search, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from '@/hooks/use-translations';

const receipts = [
  { 
    id: 'REC-001', 
    supplier: 'Hortifruti São Paulo', 
    amount: 'R$ 1.245,50', 
    status: 'processed', 
    date: '15/01/2024',
    items: 12,
    poNumber: 'PC-001'
  },
  { 
    id: 'REC-002', 
    supplier: 'Açougue Premium Ltda', 
    amount: 'R$ 2.890,00', 
    status: 'pending', 
    date: '14/01/2024',
    items: 8,
    poNumber: 'PC-002'
  },
  { 
    id: 'REC-003', 
    supplier: 'Laticínios Direto', 
    amount: 'R$ 567,25', 
    status: 'processed', 
    date: '13/01/2024',
    items: 15,
    poNumber: 'PC-003'
  },
  { 
    id: 'REC-004', 
    supplier: 'Mundo das Especiarias', 
    amount: 'R$ 234,75', 
    status: 'error', 
    date: '12/01/2024',
    items: 6,
    poNumber: 'PC-004'
  },
];

export default function ReceiptsPage() {
  const { t } = useTranslations();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'error': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'processed': return 'Processado';
      case 'pending': return 'Pendente';
      case 'error': return 'Erro';
      default: return status;
    }
  };

  return (
    <MainLayout title={t('purchasing.receipts')}>
      <div className="p-6 space-y-6">
        <div className="flex justify-end items-center">
          <Button className="bg-gradient-to-r from-orange-500 to-red-600">
            <Upload className="h-4 w-4 mr-2" />
            {t('purchasing.uploadReceipt')}
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
                  <p className="text-sm text-slate-600">Processados</p>
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
                  <p className="text-sm text-slate-600">Pendentes</p>
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
                  <p className="text-sm text-slate-600">{t('purchasing.errors')}</p>
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
                  <p className="text-2xl font-bold text-slate-900">R$ 4.937</p>
                  <p className="text-sm text-slate-600">{t('purchasing.totalValue')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('purchasing.recentReceipts')}</CardTitle>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
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
                        {receipt.date} • {receipt.items} {t('purchasing.items')} • PC: {receipt.poNumber}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{receipt.amount}</p>
                      <Badge className={getStatusColor(receipt.status)}>
                        {getStatusLabel(receipt.status)}
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
            <CardTitle>{t('purchasing.uploadNew')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-orange-400 transition-colors cursor-pointer">
              <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">{t('purchasing.uploadReceipt')}</h3>
              <p className="text-slate-600 mb-4">
                {t('purchasing.dragDrop')}
              </p>
              <Button variant="outline">
                {t('purchasing.chooseFiles')}
              </Button>
              <p className="text-xs text-slate-500 mt-2">
                {t('purchasing.fileSupport')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}