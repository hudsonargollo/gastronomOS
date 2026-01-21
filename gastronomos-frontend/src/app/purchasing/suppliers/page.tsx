'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { ResponsiveContainer, ResponsiveGrid } from '@/components/layout/responsive-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { Plus, Phone, Mail, MapPin, Building2, Hash } from 'lucide-react';
import { motion } from 'framer-motion';
import { AnimatedPage } from '@/components/ui/animated-page';
import { AnimatedCRUDTable } from '@/components/ui/animated-crud-table';
import { EnhancedModalForm } from '@/components/ui/enhanced-modal-form';
import { useCategories, useProducts } from '@/hooks/use-crud';
import { ColumnDef } from '@tanstack/react-table';
import { FormFieldConfig } from '@/hooks/use-enhanced-form-validation';
import { staggerContainer, listItemVariants } from '@/lib/animation-utils';

// Supplier type definition
interface Supplier {
  id: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  paymentTerms?: string;
  category?: string;
  rating?: number;
  totalOrders?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Supplier form data
interface SupplierFormData {
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  paymentTerms?: string;
  category?: string;
  isActive: boolean;
}

export default function SuppliersPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchParams, setSearchParams] = useState({
    search: '',
    category: '',
    isActive: '',
    page: 1,
    limit: 20,
  });

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Purchasing', href: '/purchasing' },
    { label: 'Suppliers', href: '/purchasing/suppliers' }
  ];

  // Use enhanced CRUD hooks - using categories as a placeholder for suppliers
  const suppliersCrud = useCategories(searchParams);

  // Define table columns
  const columns: ColumnDef<Supplier>[] = [
    {
      accessorKey: 'name',
      header: 'Supplier Name',
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="font-medium">{row.original.name}</div>
          {row.original.category && (
            <Badge variant="outline" className="text-xs">
              {row.original.category}
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'contactInfo',
      header: 'Contact Information',
      cell: ({ row }) => (
        <div className="space-y-1 text-sm">
          {row.original.contactEmail && (
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3 text-muted-foreground" />
              <span>{row.original.contactEmail}</span>
            </div>
          )}
          {row.original.contactPhone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3 text-muted-foreground" />
              <span>{row.original.contactPhone}</span>
            </div>
          )}
          {row.original.address && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="truncate max-w-xs">{row.original.address}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'rating',
      header: 'Rating',
      cell: ({ row }) => (
        row.original.rating ? (
          <div className="flex items-center gap-1">
            <div className="flex text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <span key={i} className={i < Math.floor(row.original.rating!) ? 'text-yellow-400' : 'text-gray-300'}>
                  ★
                </span>
              ))}
            </div>
            <span className="text-sm text-muted-foreground ml-1">
              {row.original.rating.toFixed(1)}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">No rating</span>
        )
      ),
    },
    {
      accessorKey: 'totalOrders',
      header: 'Orders',
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono">
          {row.original.totalOrders || 0}
        </Badge>
      ),
    },
    {
      accessorKey: 'paymentTerms',
      header: 'Payment Terms',
      cell: ({ row }) => (
        row.original.paymentTerms ? (
          <span className="text-sm">{row.original.paymentTerms}</span>
        ) : (
          <span className="text-muted-foreground text-sm">Not set</span>
        )
      ),
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
          {row.original.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  // Form field configuration
  const formFields: FormFieldConfig[] = [
    {
      name: 'name',
      label: 'Supplier Name',
      type: 'text',
      placeholder: 'Enter supplier name',
      validation: {
        required: true,
        minLength: 2,
        maxLength: 100,
      },
    },
    {
      name: 'contactEmail',
      label: 'Contact Email',
      type: 'email',
      placeholder: 'supplier@example.com',
      validation: {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        custom: (value: string) => {
          if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return 'Please enter a valid email address';
          }
          return null;
        },
      },
    },
    {
      name: 'contactPhone',
      label: 'Contact Phone',
      type: 'text',
      placeholder: '+1 (555) 123-4567',
      validation: {
        pattern: /^[\+]?[1-9][\d]{0,15}$/,
        custom: (value: string) => {
          if (value && !/^[\+]?[0-9\s\-\(\)]{10,}$/.test(value)) {
            return 'Please enter a valid phone number';
          }
          return null;
        },
      },
    },
    {
      name: 'address',
      label: 'Address',
      type: 'textarea',
      placeholder: 'Enter supplier address',
      validation: {
        maxLength: 200,
      },
    },
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      placeholder: 'Select supplier category',
      options: [
        { value: 'produce', label: 'Produce & Vegetables' },
        { value: 'meat', label: 'Meat & Poultry' },
        { value: 'dairy', label: 'Dairy Products' },
        { value: 'beverages', label: 'Beverages' },
        { value: 'dry-goods', label: 'Dry Goods' },
        { value: 'spices', label: 'Spices & Seasonings' },
        { value: 'equipment', label: 'Equipment & Supplies' },
        { value: 'other', label: 'Other' },
      ],
    },
    {
      name: 'paymentTerms',
      label: 'Payment Terms',
      type: 'select',
      placeholder: 'Select payment terms',
      options: [
        { value: 'net-15', label: 'Net 15 days' },
        { value: 'net-30', label: 'Net 30 days' },
        { value: 'net-45', label: 'Net 45 days' },
        { value: 'net-60', label: 'Net 60 days' },
        { value: 'cod', label: 'Cash on Delivery (COD)' },
        { value: 'prepaid', label: 'Prepaid' },
        { value: '2-10-net-30', label: '2/10 Net 30' },
        { value: 'custom', label: 'Custom Terms' },
      ],
    },
    {
      name: 'isActive',
      label: 'Active Supplier',
      type: 'checkbox',
      defaultValue: true,
    },
  ];

  const handleCreateSupplier = async (data: SupplierFormData) => {
    await suppliersCrud.create(data as any);
    setShowCreateForm(false);
  };

  const handleEditSupplier = async (data: SupplierFormData) => {
    if (!editingSupplier) return;
    await suppliersCrud.update(editingSupplier.id, data as any);
    setEditingSupplier(null);
  };

  const handleEditClick = (supplier: Supplier) => {
    setEditingSupplier(supplier);
  };

  // Calculate summary statistics
  const summaryStats = React.useMemo(() => {
    const suppliers = suppliersCrud.data as Supplier[] || [];
    const active = suppliers.filter(s => s.isActive).length;
    const totalOrders = suppliers.reduce((sum, s) => sum + (s.totalOrders || 0), 0);
    const avgRating = suppliers.length > 0 
      ? suppliers.reduce((sum, s) => sum + (s.rating || 0), 0) / suppliers.length 
      : 0;
    
    return { active, totalOrders, avgRating };
  }, [suppliersCrud.data]);

  return (
    <AnimatedPage>
      <MainLayout title="Suppliers" breadcrumbs={breadcrumbs}>
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
                <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">Suppliers</h1>
                  <p className="text-slate-600">Manage your supplier relationships</p>
                </div>
              </div>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Supplier
              </Button>
            </motion.div>

            {/* Summary Cards */}
            <motion.div variants={listItemVariants}>
              <ResponsiveGrid cols={{ default: 2, md: 4 }} gap="md">
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
                          transition={{ delay: 0.2, type: "spring" }}
                        >
                          {summaryStats.active}
                        </motion.p>
                        <p className="text-sm text-slate-600">Active Suppliers</p>
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
                          {summaryStats.totalOrders}
                        </motion.p>
                        <p className="text-sm text-slate-600">Total Orders</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                        <GastronomyIcons.TrendingUp className="h-6 w-6 text-yellow-600" />
                      </div>
                      <div>
                        <motion.p 
                          className="text-2xl font-bold text-slate-900"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.4, type: "spring" }}
                        >
                          {summaryStats.avgRating.toFixed(1)}
                        </motion.p>
                        <p className="text-sm text-slate-600">Avg Rating</p>
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
                          $45K
                        </motion.p>
                        <p className="text-sm text-slate-600">Monthly Spend</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </ResponsiveGrid>
            </motion.div>
            
            {/* Suppliers Table */}
            <motion.div variants={listItemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Hash className="h-5 w-5" />
                    <span>Suppliers Management</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AnimatedCRUDTable
                    columns={columns as any}
                    crudHook={suppliersCrud as any}
                    searchable={true}
                    searchPlaceholder="Search suppliers by name, email, or phone..."
                    sortable={true}
                    filterable={true}
                    selectable={true}
                    pagination={true}
                    pageSize={20}
                    addLabel="Add Supplier"
                    emptyMessage="No suppliers found. Add your first supplier to start managing relationships."
                    enableRowSelection={true}
                    enableBulkOperations={true}
                    enableExport={true}
                    enableDuplicate={true}
                    onCreateNew={() => setShowCreateForm(true)}
                    onEditItem={handleEditClick}
                    rowClassName={(supplier) => 
                      !supplier.isActive ? 'opacity-60' : ''
                    }
                  />
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </ResponsiveContainer>

        {/* Create Supplier Form */}
        <EnhancedModalForm<SupplierFormData>
          open={showCreateForm}
          onOpenChange={setShowCreateForm}
          title="Add New Supplier"
          description="Add a new supplier to your purchasing network"
          fields={formFields}
          onSubmit={handleCreateSupplier}
          submitLabel="Add Supplier"
          size="lg"
          showValidationSummary={true}
          enableRealTimeValidation={true}
        />

        {/* Edit Supplier Form */}
        <EnhancedModalForm<SupplierFormData>
          open={!!editingSupplier}
          onOpenChange={(open) => !open && setEditingSupplier(null)}
          title="Edit Supplier"
          description="Update supplier information"
          fields={formFields}
          initialValues={editingSupplier ? {
            name: editingSupplier.name,
            contactEmail: editingSupplier.contactEmail || '',
            contactPhone: editingSupplier.contactPhone || '',
            address: editingSupplier.address || '',
            category: editingSupplier.category || '',
            paymentTerms: editingSupplier.paymentTerms || '',
            isActive: editingSupplier.isActive,
          } : undefined}
          onSubmit={handleEditSupplier}
          submitLabel="Update Supplier"
          size="lg"
          showValidationSummary={true}
          enableRealTimeValidation={true}
        />
      </MainLayout>
    </AnimatedPage>
  );
}