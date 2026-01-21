'use client';

import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { ArrowRight, MapPin, Clock, Package, Wand2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { InventoryTransferWizard } from '@/components/wizards/inventory-transfer-wizard';
import { AnimatedModal, AnimatedModalContent, AnimatedModalHeader, AnimatedModalTitle } from '@/components/ui/animated-modal';
import { toast } from 'sonner';

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
  const [showTransferWizard, setShowTransferWizard] = useState(false);

  const handleTransferWizardComplete = (data: any) => {
    console.log('Transfer wizard completed:', data);
    setShowTransferWizard(false);
    toast.success('Transfer created successfully!', {
      description: `Transfer from ${data.sourceLocation?.name} to ${data.destinationLocation?.name} has been created.`,
    });
  };

  const handleTransferWizardCancel = () => {
    setShowTransferWizard(false);
  };
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
    <MainLayout title="Active Transfers">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Active Transfers</h1>
            <p className="text-slate-600">Monitor ongoing transfers between locations</p>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={() => setShowTransferWizard(true)}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Transfer Wizard
            </Button>
            <Button className="bg-gradient-to-r from-orange-500 to-red-600">
              <GastronomyIcons.Truck className="h-4 w-4 mr-2" />
              New Transfer
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <GastronomyIcons.Truck className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">1</p>
                  <p className="text-sm text-slate-600">In Transit</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Package className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">1</p>
                  <p className="text-sm text-slate-600">Preparing</p>
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
                  <p className="text-2xl font-bold text-slate-900">1</p>
                  <p className="text-sm text-slate-600">Ready</p>
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
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {transfer.id.split('-')[1]}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{transfer.id}</h3>
                        <p className="text-sm text-slate-600">Driver: {transfer.driver}</p>
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
                        <MapPin className="h-5 w-5 text-slate-400 mx-auto mb-1" />
                        <p className="text-sm font-medium text-slate-900">{transfer.from}</p>
                        <p className="text-xs text-slate-500">From</p>
                      </div>
                      
                      <div className="flex-1 flex items-center justify-center">
                        <ArrowRight className="h-6 w-6 text-slate-400" />
                      </div>
                      
                      <div className="text-center">
                        <MapPin className="h-5 w-5 text-slate-400 mx-auto mb-1" />
                        <p className="text-sm font-medium text-slate-900">{transfer.to}</p>
                        <p className="text-xs text-slate-500">To</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                    <div className="text-center">
                      <p className="text-lg font-semibold text-slate-900">{transfer.items}</p>
                      <p className="text-xs text-slate-500">Items</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-slate-900">{transfer.estimatedArrival}</p>
                      <p className="text-xs text-slate-500">ETA</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-slate-900">{transfer.value}</p>
                      <p className="text-xs text-slate-500">Value</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Progress</span>
                      <span className="font-medium text-slate-900">{transfer.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${transfer.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      Track Transfer
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Transfer Wizard Modal */}
      <AnimatedModal open={showTransferWizard} onOpenChange={setShowTransferWizard}>
        <AnimatedModalContent size="xl" className="max-w-4xl">
          <AnimatedModalHeader>
            <AnimatedModalTitle>Create Inventory Transfer</AnimatedModalTitle>
          </AnimatedModalHeader>
          <InventoryTransferWizard
            onComplete={handleTransferWizardComplete}
            onCancel={handleTransferWizardCancel}
            className="p-6"
          />
        </AnimatedModalContent>
      </AnimatedModal>
    </MainLayout>
  );
}