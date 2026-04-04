/**
 * Wizard Workflows Demo
 * Demonstrates all the wizard workflows for the enhanced UI system
 */

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ShoppingCart, 
  ArrowRightLeft, 
  Settings, 
  FileText, 
  Package, 
  MapPin,
  Receipt,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  PurchaseOrderWizard,
  InventoryTransferWizard,
  AllocationRulesWizard,
  ReceiptProcessingWizard
} from '@/components/wizards';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/animation-utils';

type WizardType = 'purchase-order' | 'inventory-transfer' | 'allocation-rules' | 'receipt-processing' | null;

interface WizardOption {
  id: WizardType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  features: string[];
  requirements: string[];
}

const wizardOptions: WizardOption[] = [
  {
    id: 'purchase-order',
    title: 'Purchase Order Wizard',
    description: 'Create purchase orders with supplier and product selection',
    icon: ShoppingCart,
    color: 'text-blue-600',
    features: [
      'Supplier selection with search',
      'Product selection and quantities',
      'Real-time price calculation',
      'Order review and notes'
    ],
    requirements: ['Requirements 2.1']
  },
  {
    id: 'inventory-transfer',
    title: 'Inventory Transfer Wizard',
    description: 'Transfer inventory between locations with validation',
    icon: ArrowRightLeft,
    color: 'text-green-600',
    features: [
      'Source and destination selection',
      'Available inventory display',
      'Quantity validation',
      'Priority and notes'
    ],
    requirements: ['Requirements 2.2']
  },
  {
    id: 'allocation-rules',
    title: 'Allocation Rules Wizard',
    description: 'Create allocation rules with criteria and location mapping',
    icon: Settings,
    color: 'text-purple-600',
    features: [
      'Rule definition and activation',
      'Flexible criteria configuration',
      'Location percentage mapping',
      'Validation and review'
    ],
    requirements: ['Requirements 2.3']
  },
  {
    id: 'receipt-processing',
    title: 'Receipt Processing Wizard',
    description: 'Process receipts with AI extraction and verification',
    icon: Receipt,
    color: 'text-orange-600',
    features: [
      'Multi-file upload support',
      'AI-powered data extraction',
      'Manual verification and correction',
      'Purchase order linking'
    ],
    requirements: ['Requirements 2.4']
  },
];

export function WizardWorkflowsDemo() {
  const [activeWizard, setActiveWizard] = useState<WizardType>(null);
  const [completedWizards, setCompletedWizards] = useState<Set<WizardType>>(new Set());

  const handleWizardComplete = (wizardId: WizardType, data: any) => {
    console.log(`${wizardId} completed with data:`, data);
    setCompletedWizards(prev => new Set([...prev, wizardId]));
    setActiveWizard(null);
    
    // You could show a success toast here
    alert(`${wizardId} completed successfully!`);
  };

  const handleWizardCancel = () => {
    setActiveWizard(null);
  };

  const renderWizard = () => {
    switch (activeWizard) {
      case 'purchase-order':
        return (
          <PurchaseOrderWizard
            onComplete={(data) => handleWizardComplete('purchase-order', data)}
            onCancel={handleWizardCancel}
          />
        );
      case 'inventory-transfer':
        return (
          <InventoryTransferWizard
            onComplete={(data) => handleWizardComplete('inventory-transfer', data)}
            onCancel={handleWizardCancel}
          />
        );
      case 'allocation-rules':
        return (
          <AllocationRulesWizard
            onComplete={(data) => handleWizardComplete('allocation-rules', data)}
            onCancel={handleWizardCancel}
          />
        );
      case 'receipt-processing':
        return (
          <ReceiptProcessingWizard
            onComplete={(data) => handleWizardComplete('receipt-processing', data)}
            onCancel={handleWizardCancel}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <motion.h1
          className="text-4xl font-bold"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitions.default}
        >
          Wizard Workflows Demo
        </motion.h1>
        <motion.p
          className="text-xl text-muted-foreground max-w-2xl mx-auto"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transitions.default, delay: 0.1 }}
        >
          Experience the enhanced UI workflows with guided multi-step wizards for complex operations
        </motion.p>
      </div>

      {/* Wizard Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {wizardOptions.map((option, index) => {
          const Icon = option.icon;
          const isCompleted = completedWizards.has(option.id);
          
          return (
            <motion.div
              key={option.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transitions.default, delay: index * 0.1 }}
            >
              <Card className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02]",
                isCompleted && "border-green-200 bg-green-50"
              )}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg bg-muted", option.color)}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{option.title}</CardTitle>
                        <CardDescription>{option.description}</CardDescription>
                      </div>
                    </div>
                    {isCompleted && (
                      <Badge variant="default" className="bg-green-600">
                        Completed
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Features */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Features
                    </h4>
                    <ul className="space-y-1">
                      {option.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="text-sm text-muted-foreground flex items-center gap-2">
                          <div className="w-1 h-1 bg-current rounded-full" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Requirements */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Validates
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {option.requirements.map((req, reqIndex) => (
                        <Badge key={reqIndex} variant="outline" className="text-xs">
                          {req}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button
                    onClick={() => setActiveWizard(option.id)}
                    className="w-full"
                    variant={isCompleted ? "outline" : "default"}
                  >
                    {isCompleted ? 'Run Again' : 'Start Wizard'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Completion Summary */}
      {completedWizards.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitions.default}
        >
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-lg text-green-800 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Progress Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-green-700">
                  Completed {completedWizards.size} of {wizardOptions.length} wizards
                </span>
                <div className="flex gap-1">
                  {wizardOptions.map((option) => (
                    <div
                      key={option.id}
                      className={cn(
                        "w-3 h-3 rounded-full",
                        completedWizards.has(option.id) ? "bg-green-600" : "bg-gray-300"
                      )}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Wizard Dialog */}
      <Dialog open={!!activeWizard} onOpenChange={() => setActiveWizard(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>
                {activeWizard && wizardOptions.find(w => w.id === activeWizard)?.title}
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveWizard(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="overflow-auto">
            {renderWizard()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default WizardWorkflowsDemo;