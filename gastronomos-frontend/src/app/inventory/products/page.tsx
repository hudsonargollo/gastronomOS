'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { ResponsiveContainer } from '@/components/layout/responsive-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Apple, Package, Plus, Filter, Search } from 'lucide-react';
import { AnimatedPage } from '@/components/ui/animated-page';
import { AnimatedCRUDTable } from '@/components/ui/animated-crud-table';
import { EnhancedModalForm } from '@/components/ui/enhanced-modal-form';
import { useProducts, useCategories } from '@/hooks/use-crud';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { ColumnDef } from '@tanstack/react-table';
import { FormFieldConfig } from '@/hooks/use-enhanced-form-validation';
import { staggerContainer, listItemVariants } from '@/lib/animation-utils';

// Product type definition
interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  unit: string;
  unitCost: number;
  categoryId?: string;
  category?: {
    id: string;
    name: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Category type definition
interface Category {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

// Product form data
interface ProductFormData {
  name: string;
  description?: string;
  sku?: string;
  unit: string;
  unitCost: number;
  categoryId?: string;
  isActive: boolean;
}

export default function ProductsPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchParams, setSearchParams] = useState({
    search: '',
    categoryId: '',
    page: 1,
    limit: 20,
  });

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Inventory', href: '/inventory' },
    { label: 'Products', href: '/inventory/products' }
  ];

  // Use enhanced CRUD hooks
  const productsCrud = useProducts(searchParams);
  const { data: categories } = useCategories();

  // Define table columns
  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: 'name',
      header: 'Product Name',
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="font-medium">{row.original.name}</div>
          {row.original.sku && (
            <div className="text-xs text-muted-foreground">SKU: {row.original.sku}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => (
        row.original.category ? (
          <Badge variant="outline">{row.original.category.name}</Badge>
        ) : (
          <span className="text-muted-foreground">Uncategorized</span>
        )
      ),
    },
    {
      accessorKey: 'unit',
      header: 'Unit',
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.unit}</Badge>
      ),
    },
    {
      accessorKey: 'unitCost',
      header: 'Unit Cost',
      cell: ({ row }) => (
        <span className="font-mono">
          ${row.original.unitCost.toFixed(2)}
        </span>
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
      label: 'Product Name',
      type: 'text',
      placeholder: 'Enter product name',
      validation: {
        required: true,
        minLength: 2,
        maxLength: 100,
      },
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      placeholder: 'Enter product description (optional)',
      validation: {
        maxLength: 500,
      },
    },
    {
      name: 'sku',
      label: 'SKU',
      type: 'text',
      placeholder: 'Enter SKU (optional)',
      validation: {
        maxLength: 50,
        pattern: /^[A-Z0-9-_]*$/,
        custom: (value: string) => {
          if (value && !/^[A-Z0-9-_]*$/.test(value)) {
            return 'SKU can only contain uppercase letters, numbers, hyphens, and underscores';
          }
          return null;
        },
      },
    },
    {
      name: 'categoryId',
      label: 'Category',
      type: 'select',
      placeholder: 'Select category (optional)',
      options: (categories as Category[])?.map(cat => ({
        value: cat.id,
        label: cat.name,
      })) || [],
    },
    {
      name: 'unit',
      label: 'Unit of Measurement',
      type: 'select',
      placeholder: 'Select unit',
      validation: {
        required: true,
      },
      options: [
        { value: 'kg', label: 'Kilogram (kg)' },
        { value: 'g', label: 'Gram (g)' },
        { value: 'lb', label: 'Pound (lb)' },
        { value: 'oz', label: 'Ounce (oz)' },
        { value: 'l', label: 'Liter (l)' },
        { value: 'ml', label: 'Milliliter (ml)' },
        { value: 'gal', label: 'Gallon (gal)' },
        { value: 'qt', label: 'Quart (qt)' },
        { value: 'pt', label: 'Pint (pt)' },
        { value: 'cup', label: 'Cup' },
        { value: 'tbsp', label: 'Tablespoon' },
        { value: 'tsp', label: 'Teaspoon' },
        { value: 'pc', label: 'Piece' },
        { value: 'box', label: 'Box' },
        { value: 'case', label: 'Case' },
        { value: 'bag', label: 'Bag' },
      ],
    },
    {
      name: 'unitCost',
      label: 'Unit Cost ($)',
      type: 'number',
      placeholder: '0.00',
      validation: {
        required: true,
        min: 0,
        custom: (value: number) => {
          if (value < 0) {
            return 'Unit cost cannot be negative';
          }
          if (value > 10000) {
            return 'Unit cost seems unusually high. Please verify.';
          }
          return null;
        },
      },
    },
    {
      name: 'isActive',
      label: 'Active Product',
      type: 'checkbox',
      defaultValue: true,
    },
  ];

  const handleCreateProduct = async (data: ProductFormData) => {
    await productsCrud.create(data as any);
    setShowCreateForm(false);
  };

  const handleEditProduct = async (data: ProductFormData) => {
    if (!editingProduct) return;
    await productsCrud.update(editingProduct.id, data as any);
    setEditingProduct(null);
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
  };

  return (
    <AnimatedPage>
      <MainLayout title="Products" breadcrumbs={breadcrumbs}>
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
                  <Apple className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">Products</h1>
                  <p className="text-slate-600">Manage your product catalog and inventory items</p>
                </div>
              </div>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </motion.div>
            
            {/* Products Table */}
            <motion.div variants={listItemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Package className="h-5 w-5" />
                    <span>Products Management</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AnimatedCRUDTable
                    columns={columns as any}
                    crudHook={productsCrud as any}
                    searchable={true}
                    searchPlaceholder="Search products by name or SKU..."
                    sortable={true}
                    filterable={true}
                    selectable={true}
                    pagination={true}
                    pageSize={20}
                    addLabel="Add Product"
                    emptyMessage="No products found. Create your first product to get started."
                    enableRowSelection={true}
                    enableBulkOperations={true}
                    enableExport={true}
                    enableDuplicate={true}
                    onCreateNew={() => setShowCreateForm(true)}
                    onEditItem={handleEditClick}
                    rowClassName={(product) => 
                      !product.isActive ? 'opacity-60' : ''
                    }
                  />
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </ResponsiveContainer>

        {/* Create Product Form */}
        <EnhancedModalForm<ProductFormData>
          open={showCreateForm}
          onOpenChange={setShowCreateForm}
          title="Create New Product"
          description="Add a new product to your inventory catalog"
          fields={formFields}
          onSubmit={handleCreateProduct}
          submitLabel="Create Product"
          size="lg"
          showValidationSummary={true}
          enableRealTimeValidation={true}
        />

        {/* Edit Product Form */}
        <EnhancedModalForm<ProductFormData>
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
          title="Edit Product"
          description="Update product information"
          fields={formFields}
          initialValues={editingProduct ? {
            name: editingProduct.name,
            description: editingProduct.description || '',
            sku: editingProduct.sku || '',
            unit: editingProduct.unit,
            unitCost: editingProduct.unitCost,
            categoryId: editingProduct.categoryId || '',
            isActive: editingProduct.isActive,
          } : undefined}
          onSubmit={handleEditProduct}
          submitLabel="Update Product"
          size="lg"
          showValidationSummary={true}
          enableRealTimeValidation={true}
        />
      </MainLayout>
    </AnimatedPage>
  );
}