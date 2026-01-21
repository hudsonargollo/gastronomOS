'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { ResponsiveContainer } from '@/components/layout/responsive-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { Plus, FolderOpen, Hash } from 'lucide-react';
import { AnimatedPage } from '@/components/ui/animated-page';
import { AnimatedCRUDTable } from '@/components/ui/animated-crud-table';
import { EnhancedModalForm } from '@/components/ui/enhanced-modal-form';
import { useCategories } from '@/hooks/use-crud';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { ColumnDef } from '@tanstack/react-table';
import { FormFieldConfig } from '@/hooks/use-enhanced-form-validation';
import { staggerContainer, listItemVariants } from '@/lib/animation-utils';

// Category type definition
interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  parentId?: string;
  parent?: {
    id: string;
    name: string;
  };
  isActive: boolean;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

// Category form data
interface CategoryFormData {
  name: string;
  description?: string;
  color?: string;
  parentId?: string;
  isActive: boolean;
}

export default function CategoriesPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [searchParams, setSearchParams] = useState({
    search: '',
    parentId: '',
    page: 1,
    limit: 20,
  });

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Inventory', href: '/inventory' },
    { label: 'Categories', href: '/inventory/categories' }
  ];

  // Use enhanced CRUD hooks
  const categoriesCrud = useCategories(searchParams);

  // Define table columns
  const columns: ColumnDef<Category>[] = [
    {
      accessorKey: 'name',
      header: 'Category Name',
      cell: ({ row }) => (
        <div className="flex items-center space-x-3">
          {row.original.color && (
            <div 
              className="w-4 h-4 rounded-full border border-gray-200"
              style={{ backgroundColor: row.original.color }}
            />
          )}
          <div className="space-y-1">
            <div className="font-medium">{row.original.name}</div>
            {row.original.parent && (
              <div className="text-xs text-muted-foreground">
                Parent: {row.original.parent.name}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => (
        <div className="max-w-xs truncate">
          {row.original.description || (
            <span className="text-muted-foreground italic">No description</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'productCount',
      header: 'Products',
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono">
          {row.original.productCount || 0}
        </Badge>
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
      label: 'Category Name',
      type: 'text',
      placeholder: 'Enter category name',
      validation: {
        required: true,
        minLength: 2,
        maxLength: 50,
      },
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      placeholder: 'Enter category description (optional)',
      validation: {
        maxLength: 200,
      },
    },
    {
      name: 'parentId',
      label: 'Parent Category',
      type: 'select',
      placeholder: 'Select parent category (optional)',
      options: (categoriesCrud.data as Category[])?.filter(cat => cat.id !== editingCategory?.id).map(cat => ({
        value: cat.id,
        label: cat.name,
      })) || [],
    },
    {
      name: 'color',
      label: 'Color',
      type: 'text',
      placeholder: '#3B82F6',
      description: 'Hex color code for visual identification',
      validation: {
        pattern: /^#[0-9A-Fa-f]{6}$/,
        custom: (value: string) => {
          if (value && !/^#[0-9A-Fa-f]{6}$/.test(value)) {
            return 'Color must be a valid hex code (e.g., #3B82F6)';
          }
          return null;
        },
      },
    },
    {
      name: 'isActive',
      label: 'Active Category',
      type: 'checkbox',
      defaultValue: true,
    },
  ];

  const handleCreateCategory = async (data: CategoryFormData) => {
    await categoriesCrud.create(data as any);
    setShowCreateForm(false);
  };

  const handleEditCategory = async (data: CategoryFormData) => {
    if (!editingCategory) return;
    await categoriesCrud.update(editingCategory.id, data as any);
    setEditingCategory(null);
  };

  const handleEditClick = (category: Category) => {
    setEditingCategory(category);
  };

  return (
    <AnimatedPage>
      <MainLayout title="Categories" breadcrumbs={breadcrumbs}>
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
                  <FolderOpen className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">Categories</h1>
                  <p className="text-slate-600">Organize your products with categories and subcategories</p>
                </div>
              </div>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </motion.div>
            
            {/* Categories Table */}
            <motion.div variants={listItemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Hash className="h-5 w-5" />
                    <span>Categories Management</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AnimatedCRUDTable
                    columns={columns as any}
                    crudHook={categoriesCrud as any}
                    searchable={true}
                    searchPlaceholder="Search categories by name..."
                    sortable={true}
                    filterable={true}
                    selectable={true}
                    pagination={true}
                    pageSize={20}
                    addLabel="Add Category"
                    emptyMessage="No categories found. Create your first category to organize products."
                    enableRowSelection={true}
                    enableBulkOperations={true}
                    enableExport={true}
                    enableDuplicate={true}
                    onCreateNew={() => setShowCreateForm(true)}
                    onEditItem={handleEditClick}
                    rowClassName={(category) => 
                      !category.isActive ? 'opacity-60' : ''
                    }
                  />
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </ResponsiveContainer>

        {/* Create Category Form */}
        <EnhancedModalForm<CategoryFormData>
          open={showCreateForm}
          onOpenChange={setShowCreateForm}
          title="Create New Category"
          description="Add a new category to organize your products"
          fields={formFields}
          onSubmit={handleCreateCategory}
          submitLabel="Create Category"
          size="md"
          showValidationSummary={true}
          enableRealTimeValidation={true}
        />

        {/* Edit Category Form */}
        <EnhancedModalForm<CategoryFormData>
          open={!!editingCategory}
          onOpenChange={(open) => !open && setEditingCategory(null)}
          title="Edit Category"
          description="Update category information"
          fields={formFields}
          initialValues={editingCategory ? {
            name: editingCategory.name,
            description: editingCategory.description || '',
            color: editingCategory.color || '',
            parentId: editingCategory.parentId || '',
            isActive: editingCategory.isActive,
          } : undefined}
          onSubmit={handleEditCategory}
          submitLabel="Update Category"
          size="md"
          showValidationSummary={true}
          enableRealTimeValidation={true}
        />
      </MainLayout>
    </AnimatedPage>
  );
}