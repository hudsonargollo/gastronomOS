'use client';

import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { ResponsiveContainer, ResponsiveGrid } from '@/components/layout/responsive-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { useTranslations } from '@/hooks/use-translations';
import { ShoppingCart, FileText, Building2, Plus, TrendingUp, AlertTriangle, Zap, Package } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AnimatedPage } from '@/components/ui/animated-page';
import { PurchaseOrderWizard } from '@/components/wizards/purchase-order-wizard';
import { ReceiptProcessingWizard } from '@/components/wizards/receipt-processing-wizard';
import { useProducts, useCategories } from '@/hooks/use-crud';
import { staggerContainer, listItemVariants } from '@/lib/animation-utils';

export default function PurchasingPage() {
  const { t } = useTranslations();
  const [showPOWizard, setShowPOWizard] = useState(false);
  const [showReceiptWizard, setShowReceiptWizard] = useState(false);

  // Use enhanced CRUD hooks for data - using existing hooks as placeholders
  const { data: purchaseOrders, loading: poLoading } = useProducts({ 
    limit: 5 
  });
  const { data: suppliers } = useCategories({ active: true });

  const breadcrumbs = [
    { label: t('navigation.dashboard'), href: '/dashboard' },
    { label: t('purchasing.title'), href: '/purchasing' }
  ];

  const purchasingModules = [
    {
      title: t('purchasing.purchaseOrders'),
      description: t('purchasing.purchaseOrdersDesc'),
      icon: FileText,
      href: '/purchasing/orders',
      color: 'bg-blue-500',
      stats: `${purchaseOrders?.length || 23} ${t('purchasing.activeOrders')}`,
      trend: '+5%',
      trendUp: true,
    },
    {
      title: t('purchasing.suppliers'),
      description: t('purchasing.suppliersDesc'),
      icon: Building2,
      href: '/purchasing/suppliers',
      color: 'bg-purple-500',
      stats: `${suppliers?.length || 47} ${t('purchasing.suppliersCount')}`,
      trend: '+2',
      trendUp: true,
    },
    {
      title: t('purchasing.receipts'),
      description: t('purchasing.receiptsDesc'),
      icon: GastronomyIcons.Receipt,
      href: '/purchasing/receipts',
      color: 'bg-green-500',
      stats: `156 ${t('purchasing.processed')}`,
      trend: '+12%',
      trendUp: true,
    },
  ];

  const quickActions = [
    {
      title: 'New Purchase Order',
      description: 'Create a new purchase order with wizard',
      icon: Plus,
      action: () => setShowPOWizard(true),
      color: 'bg-blue-500',
    },
    {
      title: 'Process Receipt',
      description: 'Upload and process delivery receipts',
      icon: Zap,
      action: () => setShowReceiptWizard(true),
      color: 'bg-green-500',
    },
    {
      title: 'Pending Orders',
      description: 'View orders awaiting approval',
      icon: AlertTriangle,
      href: '/purchasing/orders?filter=pending',
      color: 'bg-orange-500',
      badge: purchaseOrders?.length || 0,
    },
  ];

  const handlePOComplete = (data: any) => {
    setShowPOWizard(false);
    // Refresh purchase orders data or show success message
  };

  const handleReceiptComplete = (data: any) => {
    setShowReceiptWizard(false);
    // Refresh receipts data or show success message
  };

  return (
    <AnimatedPage>
      <MainLayout title={t('purchasing.title')} breadcrumbs={breadcrumbs}>
        <ResponsiveContainer maxWidth="xl" padding="md">
          <motion.div 
            className="space-y-8"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {/* Header Section */}
            <motion.div 
              className="flex items-center justify-between"
              variants={listItemVariants}
            >
              <div>
                <h1 className="text-3xl font-bold text-slate-900">{t('purchasing.title')}</h1>
                <p className="text-slate-600 mt-2">{t('purchasing.subtitle')}</p>
              </div>
              <Button 
                className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700"
                onClick={() => setShowPOWizard(true)}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                {t('purchasing.newPurchaseOrder')}
              </Button>
            </motion.div>

            {/* Quick Actions */}
            <motion.div variants={listItemVariants}>
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Quick Actions</h2>
              <ResponsiveGrid cols={{ default: 1, md: 3 }} gap="md">
                {quickActions.map((action, index) => {
                  const Icon = action.icon;
                  const content = (
                    <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group">
                      <CardContent className="p-6">
                        <div className="flex items-center space-x-4">
                          <div className={`h-12 w-12 rounded-xl ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-900">{action.title}</h3>
                              {action.badge !== undefined && action.badge > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {action.badge}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 mt-1">{action.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );

                  return (
                    <motion.div
                      key={action.title}
                      variants={listItemVariants}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {action.href ? (
                        <Link href={action.href}>
                          {content}
                        </Link>
                      ) : (
                        <div onClick={action.action}>
                          {content}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </ResponsiveGrid>
            </motion.div>

            {/* Main Modules */}
            <motion.div variants={listItemVariants}>
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Purchasing Management</h2>
              <ResponsiveGrid cols={{ default: 1, md: 2, lg: 3 }} gap="md">
                {purchasingModules.map((module, index) => {
                  const Icon = module.icon;
                  return (
                    <motion.div
                      key={module.title}
                      variants={listItemVariants}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group">
                        <Link href={module.href}>
                          <CardHeader className="pb-4">
                            <div className="flex items-center space-x-4">
                              <div className={`h-12 w-12 rounded-xl ${module.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                <Icon className="h-6 w-6 text-white" />
                              </div>
                              <div className="flex-1">
                                <CardTitle className="text-lg">{module.title}</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-sm text-slate-500">{module.stats}</p>
                                  {module.trend && (
                                    <Badge 
                                      variant={module.trendUp ? "default" : "secondary"}
                                      className={`text-xs ${
                                        module.trendUp 
                                          ? "bg-green-100 text-green-700" 
                                          : "bg-red-100 text-red-700"
                                      }`}
                                    >
                                      <TrendingUp className={`h-3 w-3 mr-1 ${!module.trendUp ? 'rotate-180' : ''}`} />
                                      {module.trend}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-slate-600">{module.description}</p>
                          </CardContent>
                        </Link>
                      </Card>
                    </motion.div>
                  );
                })}
              </ResponsiveGrid>
            </motion.div>

            {/* Pending Orders Alert */}
            {!poLoading && purchaseOrders && purchaseOrders.length > 0 && (
              <motion.div variants={listItemVariants}>
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-800">
                      <AlertTriangle className="h-5 w-5" />
                      Pending Purchase Orders
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-orange-700 mb-4">
                      {purchaseOrders.length} purchase orders are pending approval and need your attention.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/purchasing/orders?filter=pending">
                          View Pending Orders
                        </Link>
                      </Button>
                      <Button size="sm" onClick={() => setShowPOWizard(true)}>
                        Create New Order
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </motion.div>
        </ResponsiveContainer>

        {/* Purchase Order Wizard Dialog */}
        <Dialog open={showPOWizard} onOpenChange={setShowPOWizard}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Create Purchase Order</DialogTitle>
            </DialogHeader>
            <PurchaseOrderWizard
              onComplete={handlePOComplete}
              onCancel={() => setShowPOWizard(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Receipt Processing Wizard Dialog */}
        <Dialog open={showReceiptWizard} onOpenChange={setShowReceiptWizard}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Process Receipt</DialogTitle>
            </DialogHeader>
            <ReceiptProcessingWizard
              onComplete={handleReceiptComplete}
              onCancel={() => setShowReceiptWizard(false)}
            />
          </DialogContent>
        </Dialog>
      </MainLayout>
    </AnimatedPage>
  );
}