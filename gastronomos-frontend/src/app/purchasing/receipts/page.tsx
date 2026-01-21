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
import { Upload, Eye, Download, Search, AlertTriangle, FileText, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedPage } from '@/components/ui/animated-page';
import { AnimatedCRUDTable } from '@/components/ui/animated-crud-table';
import { ReceiptProcessingWizard } from '@/components/wizards/receipt-processing-wizard';
import { useProducts, useCategories } from '@/hooks/use-crud';
import { ColumnDef } from '@tanstack/react-table';
import { staggerContainer, listItemVariants } from '@/lib/animation-utils';

// Receipt type definition
interface Receipt {
  id: string;
  receiptNumber: string;
  supplier: {
    id: string;
    name: string;
  };
  purchaseOrder?: {
    id: string;
    poNumber: string;
  };
  status: 'uploaded' | 'processing' | 'processed' | 'error' | 'matched';
  totalAmount: number;
  receiptDate: string;
  lineItemsCount: number;
  fileName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ReceiptsPage() {
  const [showUploadWizard, setShowUploadWizard] = useState(false);
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
    { label: 'Receipts', href: '/purchasing/receipts' }
  ];

  // Use enhanced CRUD hooks - using products as a placeholder for receipts
  const receiptsCrud = useProducts(searchParams);

  // Define table columns
  const columns: ColumnDef<Receipt>[] = [
    {
      accessorKey: 'receiptNumber',
      header: 'Receipt Number',
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="font-medium">{row.original.receiptNumber}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(row.original.receiptDate).toLocaleDateString()}
          </div>
          {row.original.fileName && (
            <div className="text-xs text-muted-foreground">
              📎 {row.original.fileName}
            </div>
          )}
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
      accessorKey: 'purchaseOrder',
      header: 'Purchase Order',
      cell: ({ row }) => (
        row.original.purchaseOrder ? (
          <Badge variant="outline">
            {row.original.purchaseOrder.poNumber}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">No PO</span>
        )
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        const getStatusColor = () => {
          switch (status) {
            case 'uploaded': return 'bg-blue-100 text-blue-700';
            case 'processing': return 'bg-yellow-100 text-yellow-700';
            case 'processed': return 'bg-green-100 text-green-700';
            case 'matched': return 'bg-emerald-100 text-emerald-700';
            case 'error': return 'bg-red-100 text-red-700';
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
  ];

  const handleUploadComplete = (data: any) => {
    setShowUploadWizard(false);
    // Refresh receipts data
  };

  const handleViewReceipt = (receipt: Receipt) => {
    // Navigate to receipt detail view or open modal
    console.log('View receipt:', receipt);
  };

  // Calculate summary statistics
  const summaryStats = React.useMemo(() => {
    const receipts = receiptsCrud.data as Receipt[] || [];
    const processed = receipts.filter(r => r.status === 'processed' || r.status === 'matched').length;
    const processing = receipts.filter(r => r.status === 'processing' || r.status === 'uploaded').length;
    const errors = receipts.filter(r => r.status === 'error').length;
    const totalValue = receipts.reduce((sum, r) => sum + r.totalAmount, 0);
    
    return { processed, processing, errors, totalValue };
  }, [receiptsCrud.data]);

  return (
    <AnimatedPage>
      <MainLayout title="Receipt Processing" breadcrumbs={breadcrumbs}>
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
                <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">Receipt Processing</h1>
                  <p className="text-slate-600">Upload and manage purchase receipts</p>
                </div>
              </div>
              <Button onClick={() => setShowUploadWizard(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Receipt
              </Button>
            </motion.div>

            {/* Summary Cards */}
            <motion.div variants={listItemVariants}>
              <ResponsiveGrid cols={{ default: 2, md: 4 }} gap="md">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <GastronomyIcons.Receipt className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <motion.p 
                          className="text-2xl font-bold text-slate-900"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.2, type: "spring" }}
                        >
                          {summaryStats.processed}
                        </motion.p>
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
                        <motion.p 
                          className="text-2xl font-bold text-slate-900"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.3, type: "spring" }}
                        >
                          {summaryStats.processing}
                        </motion.p>
                        <p className="text-sm text-slate-600">Processing</p>
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
                        <motion.p 
                          className="text-2xl font-bold text-slate-900"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.4, type: "spring" }}
                        >
                          {summaryStats.errors}
                        </motion.p>
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
            
            {/* Receipts Table */}
            <motion.div variants={listItemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Package className="h-5 w-5" />
                    <span>Receipts Management</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AnimatedCRUDTable
                    columns={columns as any}
                    crudHook={receiptsCrud as any}
                    searchable={true}
                    searchPlaceholder="Search receipts by number, supplier, or PO..."
                    sortable={true}
                    filterable={true}
                    selectable={true}
                    pagination={true}
                    pageSize={20}
                    addLabel="Upload Receipt"
                    emptyMessage="No receipts found. Upload your first receipt to get started."
                    enableRowSelection={true}
                    enableBulkOperations={true}
                    enableExport={true}
                    enableDuplicate={false}
                    onCreateNew={() => setShowUploadWizard(true)}
                    onEditItem={handleViewReceipt}
                    rowClassName={(receipt: Receipt) => 
                      receipt.status === 'error' ? 'bg-red-50 border-red-200' : ''
                    }
                  />
                </CardContent>
              </Card>
            </motion.div>

            {/* Upload Area */}
            <motion.div variants={listItemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle>Quick Upload</CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-green-400 transition-colors cursor-pointer"
                    onClick={() => setShowUploadWizard(true)}
                  >
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
            </motion.div>

            {/* Error Alert */}
            {summaryStats.errors > 0 && (
              <motion.div variants={listItemVariants}>
                <Card className="border-red-200 bg-red-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-800">
                      <AlertTriangle className="h-5 w-5" />
                      Processing Errors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-red-700 mb-4">
                      {summaryStats.errors} receipts have processing errors and need your attention.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href="/purchasing/receipts?filter=error">
                          View Error Receipts
                        </a>
                      </Button>
                      <Button size="sm" onClick={() => setShowUploadWizard(true)}>
                        Upload New Receipt
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </motion.div>
        </ResponsiveContainer>

        {/* Receipt Processing Wizard */}
        <Dialog open={showUploadWizard} onOpenChange={setShowUploadWizard}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Process Receipt</DialogTitle>
            </DialogHeader>
            <ReceiptProcessingWizard
              onComplete={handleUploadComplete}
              onCancel={() => setShowUploadWizard(false)}
            />
          </DialogContent>
        </Dialog>
      </MainLayout>
    </AnimatedPage>
  );
}