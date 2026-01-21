'use client';

import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { Edit, Eye, RotateCcw, Wand2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { AllocationRulesWizard } from '@/components/wizards/allocation-rules-wizard';
import { AnimatedModal, AnimatedModalContent, AnimatedModalHeader, AnimatedModalTitle } from '@/components/ui/animated-modal';
import { toast } from 'sonner';

const currentAllocations = [
  {
    id: 'AL-001',
    product: 'Tomatoes',
    totalQuantity: 150,
    allocations: [
      { location: 'Main Kitchen', quantity: 60, percentage: 40 },
      { location: 'Downtown Branch', quantity: 45, percentage: 30 },
      { location: 'Airport Location', quantity: 30, percentage: 20 },
      { location: 'Westside Location', quantity: 15, percentage: 10 }
    ],
    status: 'active',
    lastUpdated: '2024-01-15'
  },
  {
    id: 'AL-002',
    product: 'Chicken Breast',
    totalQuantity: 80,
    allocations: [
      { location: 'Main Kitchen', quantity: 40, percentage: 50 },
      { location: 'Downtown Branch', quantity: 24, percentage: 30 },
      { location: 'Airport Location', quantity: 16, percentage: 20 }
    ],
    status: 'active',
    lastUpdated: '2024-01-14'
  },
];

export default function CurrentAllocationsPage() {
  const [showAllocationWizard, setShowAllocationWizard] = useState(false);

  const handleAllocationWizardComplete = (data: any) => {
    console.log('Allocation wizard completed:', data);
    setShowAllocationWizard(false);
    toast.success('Allocation rule created successfully!', {
      description: `Rule "${data.name}" has been created and is ${data.isActive ? 'active' : 'inactive'}.`,
    });
  };

  const handleAllocationWizardCancel = () => {
    setShowAllocationWizard(false);
  };
  return (
    <MainLayout title="Current Allocations">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Current Allocations</h1>
            <p className="text-slate-600">View and manage active resource allocations</p>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={() => setShowAllocationWizard(true)}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Allocation Wizard
            </Button>
            <Button className="bg-gradient-to-r from-orange-500 to-red-600">
              <GastronomyIcons.Scale className="h-4 w-4 mr-2" />
              New Allocation
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <GastronomyIcons.Scale className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">2</p>
                  <p className="text-sm text-slate-600">Active Allocations</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <GastronomyIcons.MapPin className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">4</p>
                  <p className="text-sm text-slate-600">Locations</p>
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
                  <p className="text-2xl font-bold text-slate-900">230</p>
                  <p className="text-sm text-slate-600">Total Items</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <GastronomyIcons.TrendingUp className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">95%</p>
                  <p className="text-sm text-slate-600">Efficiency</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {currentAllocations.map((allocation, index) => (
            <motion.div
              key={allocation.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center">
                        <GastronomyIcons.Scale className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{allocation.product}</h3>
                        <p className="text-sm text-slate-600">
                          Total: {allocation.totalQuantity} units • Updated: {allocation.lastUpdated}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className="bg-green-100 text-green-700">
                        {allocation.status.toUpperCase()}
                      </Badge>
                      <div className="flex space-x-1">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {allocation.allocations.map((alloc, allocIndex) => (
                      <div key={allocIndex} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <GastronomyIcons.MapPin className="h-5 w-5 text-slate-400" />
                          <div>
                            <p className="font-medium text-slate-900">{alloc.location}</p>
                            <p className="text-sm text-slate-600">{alloc.quantity} units</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="font-semibold text-slate-900">{alloc.percentage}%</p>
                            <div className="w-20 bg-slate-200 rounded-full h-2 mt-1">
                              <div 
                                className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full"
                                style={{ width: `${alloc.percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Allocation Distribution</span>
                      <span className="font-medium text-slate-900">
                        {allocation.allocations.reduce((sum, alloc) => sum + alloc.percentage, 0)}% Allocated
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 mt-2">
                      <div className="flex h-3 rounded-full overflow-hidden">
                        {allocation.allocations.map((alloc, allocIndex) => (
                          <div
                            key={allocIndex}
                            className={`h-3 ${
                              allocIndex === 0 ? 'bg-blue-500' :
                              allocIndex === 1 ? 'bg-green-500' :
                              allocIndex === 2 ? 'bg-yellow-500' : 'bg-purple-500'
                            }`}
                            style={{ width: `${alloc.percentage}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Allocation Wizard Modal */}
      <AnimatedModal open={showAllocationWizard} onOpenChange={setShowAllocationWizard}>
        <AnimatedModalContent size="xl" className="max-w-4xl">
          <AnimatedModalHeader>
            <AnimatedModalTitle>Create Allocation Rule</AnimatedModalTitle>
          </AnimatedModalHeader>
          <AllocationRulesWizard
            onComplete={handleAllocationWizardComplete}
            onCancel={handleAllocationWizardCancel}
            className="p-6"
          />
        </AnimatedModalContent>
      </AnimatedModal>
    </MainLayout>
  );
}