'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { ResponsiveContainer, ResponsiveGrid } from '@/components/layout/responsive-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { Plus, Eye, Download, FileText, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { AnimatedPage } from '@/components/ui/animated-page';
import { AnimatedCRUDTable } from '@/components/ui/animated-crud-table';
import { PurchaseOrderWizard } from '@/components/wizards/purchase-order-wizard';
import { useProducts, useCategories } from '@/hooks/use-crud';
import { ColumnDef } from '@tanstack/react-table';
import { staggerContainer, listItemVariants } from '@/lib/animation-utils';

// Purchase Order type definition
interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: {
    id: string;
    name: string;
  };
  status: 'draft' | 'pending' | 'approved' | 'delivered' | 'cancelled';
  totalAmount: number;
  orderDate: string;
  expectedDelivery?: string;
  lineItemsCount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export default function PurchaseOrdersPage() {
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [searchParams, setSearchParams] = useState({
    search: '',
    status: '',
    supplierId: '',
    page: 1,
    limit: 20,
  });

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Purchasing', href: '/purchasing' },
    { label: 'Purchase Orders', href: '/purchasing/orders' }
  ];

  // Use enhanced CRUD hooks - using products as a placeholder for purchase orders
  const purchaseOrdersCrud = useProducts(searchParams);

  // Define table columns
  const columns: ColumnDef<PurchaseOrder>[] = [
    {
      accessorKey: 'poNumber',
      header: 'PO Number',
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="font-medium">{row.original.poNumber}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(row.original.orderDate).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'supplier',
      header: 'Supplier',
      cell: ({ row }) => (
        <div className="font-medium">{row.original.supplier.name}</div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        const getStatusColor = () => {
          switch (status) {
            case 'draft': return 'bg-gray-100 text-gray-700';
            case 'pending': return 'bg-yellow-100 text-yellow-700';
            case 'approved': return 'bg-blue-100 text-blue-700';
            case 'delivered': return 'bg-green-100 text-green-700';
            case 'cancelled': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-700';
          }
        };
        
        return (
          <Badge className={getStatusColor()}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'lineItemsCount',
      header: 'Items',
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono">
          {row.original.lineItemsCount}
        </Badge>
      ),
    },
    {
      accessorKey: 'totalAmount',
      header: 'Total Amount',
      cell: ({ row }) => (
        <span className="font-mono font-medium">
          ${row.original.totalAmount.toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: 'expectedDelivery',
      header: 'Expected Delivery',
      cell: ({ row }) => (
        row.original.expectedDelivery ? (
          <span className="text-sm">
            {new Date(row.original.expectedDelivery).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">Not set</span>
        )
      ),
    },
  ];

  const handleCreatePO = (data: any) => {
    setShowCreateWizard(false);
    // Refresh purchase orders data
  };

  const handleViewPO = (po: PurchaseOrder) => {
    // Navigate to PO detail view or open modal
    console.log('View PO:', po);
  };

  // Calculate summary statistics
  const summaryStats = React.useMemo(() => {
    const orders = purchaseOrdersCrud.data as PurchaseOrder[] || [];
    const pending = orders.filter(o => o.status === 'pending').length;
    const approved = orders.filter(o => o.status === 'approved').length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const totalValue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    
    return { pending, approved, delivered, totalValue };
  }, [purchaseOrdersCrud.data]);

  return (
    <AnimatedPage>
      <MainLayout title="Purchase Orders" breadcrumbs={breadcrumbs}>
        <ResponsiveContainer maxWidth="xl" padding="md">
          <motion.div 
            className="space-y-6"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {/* Header */}
            <motion.div 
              className="flex justify-between items-center"
              variants={listItemVariants}
            >
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">Purchase Orders</h1>
                  <p className="text-slate-600">Manage and track your purchase orders</p>
                </div>
              </div>
              <Button onClick={() => setShowCreateWizard(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Purchase Order
              </Button>
            </motion.div>

            {/* Summary Cards */}
            <motion.div variants={listItemVariants}>
              <ResponsiveGrid cols={{ default: 2, md: 4 }} gap="md">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                        <GastronomyIcons.Timer className="h-6 w-6 text-yellow-600" />
                      </div>
                      <div>
                        <motion.p 
                          className="text-2xl font-bold text-slate-900"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.2, type: "spring" }}
                        >
                          {summaryStats.pending}
                        </motion.p>
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
                        <motion.p 
                          className="text-2xl font-bold text-slate-900"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.3, type: "spring" }}
                        >
                          {summaryStats.approved}
                        </motion.p>
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
                        <motion.p 
                          className="text-2xl font-bold text-slate-900"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.4, type: "spring" }}
                        >
                          {summaryStats.delivered}
                        </motion.p>
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
                        <motion.p 
                          className="text-2xl font-bold text-slate-900"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.5, type: "spring" }}
                        >
                          ${summaryStats.totalValue.toLocaleString()}
                        </motion.p>
                        <p className="text-sm text-slate-600">Total Value</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </ResponsiveGrid>
            </motion.div>
            
            {/* Purchase Orders Table */}
            <motion.div variants={listItemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Package className="h-5 w-5" />
                    <span>Purchase Orders Management</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AnimatedCRUDTable
                    columns={columns as any}
                    crudHook={purchaseOrdersCrud as any}
                    searchable={true}
                    searchPlaceholder="Search purchase orders by PO number or supplier..."
                    sortable={true}
                    filterable={true}
                    selectable={true}
                    pagination={true}
                    pageSize={20}
                    addLabel="New Purchase Order"
                    emptyMessage="No purchase orders found. Create your first purchase order to get started."
                    enableRowSelection={true}
                    enableBulkOperations={true}
                    enableExport={true}
                    enableDuplicate={false}
                    onCreateNew={() => setShowCreateWizard(true)}
                    onEditItem={handleViewPO}
                    rowClassName={(po: PurchaseOrder) => 
                      po.status === 'cancelled' ? 'opacity-60' : ''
                    }
                  />
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </ResponsiveContainer>

        {/* Create Purchase Order Wizard */}
        <Dialog open={showCreateWizard} onOpenChange={setShowCreateWizard}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Create New Purchase Order</DialogTitle>
            </DialogHeader>
            <PurchaseOrderWizard
              onComplete={handleCreatePO}
              onCancel={() => setShowCreateWizard(false)}
            />
          </DialogContent>
        </Dialog>
      </MainLayout>
    </AnimatedPage>
  );
}