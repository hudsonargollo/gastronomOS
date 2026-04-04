'use client';

import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { ResponsiveContainer, ResponsiveGrid } from '@/components/layout/responsive-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { useTranslations } from '@/hooks/use-translations';
import { Package, Apple, Warehouse, Plus, TrendingUp, AlertTriangle, Zap } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Badge } from '@/components/ui/badge';
import { InventoryTransferWizard } from '@/components/wizards/inventory-transfer-wizard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLowStockItems } from '@/hooks/use-crud';
import { staggerContainer, listItemVariants, fadeInOut } from '@/lib/animation-utils';

export default function InventoryPage() {
  const { t } = useTranslations();
  const [showTransferWizard, setShowTransferWizard] = useState(false);
  const { data: lowStockItems, loading: lowStockLoading } = useLowStockItems(50);

  const breadcrumbs = [
    { label: t('navigation.dashboard'), href: '/dashboard' },
    { label: t('inventory.title'), href: '/inventory' }
  ];

  const inventoryModules = [
    {
      title: t('inventory.products'),
      description: t('inventory.productsDesc'),
      icon: Apple,
      href: '/inventory/products',
      color: 'bg-green-500',
      stats: `2.847 ${t('inventory.items')}`,
      trend: '+12%',
      trendUp: true,
    },
    {
      title: t('inventory.categories'),
      description: t('inventory.categoriesDesc'),
      icon: GastronomyIcons.Plate,
      href: '/inventory/categories',
      color: 'bg-blue-500',
      stats: '24 categorias',
      trend: '+2',
      trendUp: true,
    },
    {
      title: t('inventory.stockLevels'),
      description: t('inventory.stockLevelsDesc'),
      icon: Warehouse,
      href: '/inventory/stock',
      color: 'bg-orange-500',
      stats: `${lowStockItems?.length || 156} ${t('inventory.lowStock')}`,
      trend: lowStockItems?.length ? '-8%' : 'Loading...',
      trendUp: false,
    },
  ];

  const quickActions = [
    {
      title: 'Quick Transfer',
      description: 'Transfer items between locations',
      icon: Zap,
      action: () => setShowTransferWizard(true),
      color: 'bg-purple-500',
    },
    {
      title: 'Add Product',
      description: 'Add new product to inventory',
      icon: Plus,
      href: '/inventory/products?action=create',
      color: 'bg-green-500',
    },
    {
      title: 'Stock Alert',
      description: 'View low stock items',
      icon: AlertTriangle,
      href: '/inventory/stock?filter=low',
      color: 'bg-red-500',
      badge: lowStockItems?.length || 0,
    },
  ];

  const handleTransferComplete = (data: any) => {
    setShowTransferWizard(false);
    // Refresh inventory data or show success message
  };

  return (
    <AnimatedPage>
      <MainLayout title={t('inventory.title')} breadcrumbs={breadcrumbs}>
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
                <h1 className="text-3xl font-bold text-slate-900">{t('inventory.title')}</h1>
                <p className="text-slate-600 mt-2">{t('inventory.subtitle')}</p>
              </div>
              <Button 
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                onClick={() => setShowTransferWizard(true)}
              >
                <Package className="h-4 w-4 mr-2" />
                Quick Transfer
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
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Inventory Management</h2>
              <ResponsiveGrid cols={{ default: 1, md: 2, lg: 3 }} gap="md">
                {inventoryModules.map((module, index) => {
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

            {/* Low Stock Alert */}
            {!lowStockLoading && lowStockItems && lowStockItems.length > 0 && (
              <motion.div variants={listItemVariants}>
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-800">
                      <AlertTriangle className="h-5 w-5" />
                      Low Stock Alert
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-orange-700 mb-4">
                      {lowStockItems.length} items are running low on stock and may need restocking soon.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/inventory/stock?filter=low">
                          View All Low Stock Items
                        </Link>
                      </Button>
                      <Button size="sm" onClick={() => setShowTransferWizard(true)}>
                        Quick Transfer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </motion.div>
        </ResponsiveContainer>

        {/* Transfer Wizard Dialog */}
        <Dialog open={showTransferWizard} onOpenChange={setShowTransferWizard}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Create Inventory Transfer</DialogTitle>
            </DialogHeader>
            <InventoryTransferWizard
              onComplete={handleTransferComplete}
              onCancel={() => setShowTransferWizard(false)}
            />
          </DialogContent>
        </Dialog>
      </MainLayout>
    </AnimatedPage>
  );
}