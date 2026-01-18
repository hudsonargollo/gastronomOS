'use client';

import React, { useState, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { z } from 'zod';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { ModalForm, FormField } from '@/components/ui/modal-form';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { SearchFilter } from '@/components/ui/search-filter';
import { SkeletonLoader } from '@/components/ui/loading-states';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { useCategories } from '@/hooks/use-crud';
import { useTranslations } from '@/hooks/use-translations';
import { Plus, Search, Filter, FolderTree, Package, Edit, Trash2, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

// Category interface
interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  parent?: Category;
  children?: Category[];
  productCount?: number;
  level?: number; // Added for hierarchy display
}

// Form validation schema
const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().optional(),
  parentId: z.string().optional(),
  sortOrder: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export default function CategoriesPage() {
  const { t } = useTranslations();
  const [searchQuery, setSearchQuery] = useState('');
  const [parentFilter, setParentFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Fetch categories with filters
  const { 
    data: categories, 
    loading, 
    error, 
    create, 
    update, 
    delete: deleteCategory,
    bulkDelete,
    refresh 
  } = useCategories({
    search: searchQuery,
    parentId: parentFilter || undefined,
    active: activeFilter,
    limit: 50,
  });

  // Build hierarchy for parent selection
  const categoryHierarchy = useMemo(() => {
    if (!categories) return [];
    
    const buildHierarchy = (items: Category[], parentId?: string, level = 0): Category[] => {
      return items
        .filter(item => item.parentId === parentId)
        .map(item => ({
          ...item,
          level,
          children: buildHierarchy(items, item.id, level + 1)
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder);
    };
    
    return buildHierarchy(categories);
  }, [categories]);

  // Flatten hierarchy for parent options
  const parentOptions = useMemo(() => {
    const flattenOptions = (items: Category[], options: { value: string; label: string }[] = []): { value: string; label: string }[] => {
      items.forEach(item => {
        const indent = '  '.repeat(item.level || 0);
        options.push({
          value: item.id,
          label: `${indent}${item.name}`
        });
        if (item.children) {
          flattenOptions(item.children, options);
        }
      });
      return options;
    };
    
    return flattenOptions(categoryHierarchy);
  }, [categoryHierarchy]);

  // Form fields configuration
  const formFields: FormField[] = [
    {
      name: 'name',
      label: t('forms.labels.name'),
      type: 'text',
      placeholder: t('forms.placeholders.enterName'),
      required: true,
    },
    {
      name: 'description',
      label: t('forms.labels.description'),
      type: 'textarea',
      placeholder: t('forms.placeholders.enterDescription'),
      rows: 3,
    },
    {
      name: 'parentId',
      label: t('forms.labels.parentCategory'),
      type: 'select',
      placeholder: t('forms.placeholders.selectParentCategory'),
      options: [
        { value: '', label: t('inventory.rootCategory') },
        ...parentOptions.filter(option => {
          // Prevent circular references and self-selection
          if (selectedCategory) {
            return option.value !== selectedCategory.id && 
                   !isDescendant(option.value, selectedCategory.id);
          }
          return true;
        })
      ],
    },
    {
      name: 'sortOrder',
      label: t('forms.labels.sortOrder'),
      type: 'number',
      placeholder: t('forms.placeholders.enterSortOrder'),
      min: 0,
      step: 1,
    },
    {
      name: 'active',
      label: t('status.active'),
      type: 'switch',
      description: 'Enable this category for use',
    },
  ];

  // Helper function to check if a category is a descendant of another
  const isDescendant = (potentialDescendantId: string, ancestorId: string): boolean => {
    if (!categories) return false;
    
    const findCategory = (id: string) => categories.find(cat => cat.id === id);
    const potentialDescendant = findCategory(potentialDescendantId);
    
    if (!potentialDescendant || !potentialDescendant.parentId) return false;
    if (potentialDescendant.parentId === ancestorId) return true;
    
    return isDescendant(potentialDescendant.parentId, ancestorId);
  };

  // Table columns
  const columns: ColumnDef<Category>[] = [
    {
      accessorKey: 'name',
      header: t('forms.labels.name'),
      cell: ({ row }) => {
        const category = row.original;
        const level = category.level || 0;
        const indent = level * 20;
        
        return (
          <div className="flex items-center" style={{ paddingLeft: `${indent}px` }}>
            {level > 0 && (
              <div className="flex items-center mr-2">
                <div className="w-4 h-4 border-l-2 border-b-2 border-gray-300 rounded-bl-sm" />
              </div>
            )}
            <FolderTree className="h-4 w-4 mr-2 text-orange-500" />
            <span className="font-medium">{category.name}</span>
            {level > 0 && (
              <Badge variant="outline" className="ml-2 text-xs">
                Level {level + 1}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'description',
      header: t('forms.labels.description'),
      cell: ({ row }) => (
        <span className="text-gray-600 max-w-xs truncate">
          {row.original.description || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'productCount',
      header: 'Products',
      cell: ({ row }) => (
        <div className="flex items-center">
          <Package className="h-4 w-4 mr-1 text-gray-400" />
          <span>{row.original.productCount || 0}</span>
        </div>
      ),
    },
    {
      accessorKey: 'sortOrder',
      header: t('forms.labels.sortOrder'),
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.sortOrder}</Badge>
      ),
    },
    {
      accessorKey: 'active',
      header: t('forms.labels.status'),
      cell: ({ row }) => (
        <Badge variant={row.original.active ? 'default' : 'secondary'}>
          {row.original.active ? t('status.active') : t('status.inactive')}
        </Badge>
      ),
    },
  ];

  // Handle form submission
  const handleCreate = async (data: CategoryFormData) => {
    try {
      await create(data);
      setIsCreateModalOpen(false);
      toast.success(t('messages.createSuccess'));
    } catch (error) {
      toast.error(t('messages.errorOccurred'));
      throw error;
    }
  };

  const handleEdit = async (data: CategoryFormData) => {
    if (!selectedCategory) return;
    
    try {
      await update(selectedCategory.id, data);
      setIsEditModalOpen(false);
      setSelectedCategory(null);
      toast.success(t('messages.updateSuccess'));
    } catch (error) {
      toast.error(t('messages.errorOccurred'));
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;
    
    try {
      // Check if category has children
      const hasChildren = categories?.some(cat => cat.parentId === selectedCategory.id);
      if (hasChildren) {
        toast.error(t('inventory.categoryHasChildren'));
        return;
      }
      
      await deleteCategory(selectedCategory.id);
      setIsDeleteDialogOpen(false);
      setSelectedCategory(null);
      toast.success(t('messages.deleteSuccess'));
    } catch (error: any) {
      console.error('Delete error:', error);
      if (error?.message?.includes('HAS_CHILDREN')) {
        toast.error(t('inventory.categoryHasChildren'));
      } else {
        toast.error(t('messages.errorOccurred'));
      }
    }
  };

  const handleBulkDelete = async (selectedRows: Category[]) => {
    try {
      const ids = selectedRows.map(row => row.id);
      await bulkDelete(ids);
      toast.success(t('messages.deleteSuccess'));
    } catch (error) {
      toast.error(t('messages.errorOccurred'));
    }
  };

  // Action handlers
  const handleEditClick = (category: Category) => {
    setSelectedCategory(category);
    setIsEditModalOpen(true);
  };

  const handleDeleteClick = (category: Category) => {
    setSelectedCategory(category);
    setIsDeleteDialogOpen(true);
  };

  const handleViewClick = (category: Category) => {
    // Navigate to category details or show details modal
    console.log('View category:', category);
  };

  if (loading && !categories) {
    return (
      <MainLayout title={t('navigation.categories')}>
        <div className="p-6">
          <SkeletonLoader type="table" />
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout title={t('navigation.categories')}>
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-red-600">{t('messages.errorOccurred')}</p>
            <Button onClick={refresh} className="mt-4">
              {t('actions.refresh')}
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={t('navigation.categories')}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('navigation.categories')}</h1>
            <p className="text-slate-600">{t('inventory.categoriesDesc')}</p>
          </div>
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-gradient-to-r from-orange-500 to-red-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('inventory.addCategory')}
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="h-5 w-5 mr-2" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Search</label>
                <SearchFilter
                  searchValue={searchQuery}
                  onSearchChange={setSearchQuery}
                  searchPlaceholder={t('forms.placeholders.searchItems')}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Parent Category</label>
                <select
                  value={parentFilter}
                  onChange={(e) => setParentFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">All Categories</option>
                  <option value="root">Root Categories Only</option>
                  {parentOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <select
                  value={activeFilter === undefined ? '' : activeFilter.toString()}
                  onChange={(e) => setActiveFilter(e.target.value === '' ? undefined : e.target.value === 'true')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">All</option>
                  <option value="true">{t('status.active')}</option>
                  <option value="false">{t('status.inactive')}</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* View Toggle */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('table')}
            >
              Table View
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('cards')}
            >
              Card View
            </Button>
          </div>
          <div className="text-sm text-gray-600">
            {categories?.length || 0} categories
          </div>
        </div>

        {/* Content */}
        {viewMode === 'table' ? (
          <Card>
            <CardContent className="p-0">
              <DataTable
                columns={columns}
                data={categoryHierarchy}
                loading={loading}
                searchable={false} // We have custom search
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
                onView={handleViewClick}
                onBulkDelete={handleBulkDelete}
                emptyMessage={t('inventory.noCategoriesFound')}
                getRowId={(row) => row.id}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categoryHierarchy.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="h-12 w-12 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 flex items-center justify-center">
                        <FolderTree className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary">
                          {category.productCount || 0} products
                        </Badge>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewClick(category)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditClick(category)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteClick(category)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <h3 className="font-semibold text-slate-900 mb-1">{category.name}</h3>
                    <p className="text-sm text-slate-600 mb-2 line-clamp-2">
                      {category.description || 'No description provided'}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Order: {category.sortOrder}</span>
                      <Badge variant={category.active ? 'default' : 'secondary'} className="text-xs">
                        {category.active ? t('status.active') : t('status.inactive')}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        <ModalForm
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreate}
          title={t('inventory.addCategory')}
          fields={formFields}
          schema={categorySchema}
          submitLabel={t('forms.buttons.create')}
          cancelLabel={t('forms.buttons.cancel')}
        />

        {/* Edit Modal */}
        <ModalForm
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedCategory(null);
          }}
          onSubmit={handleEdit}
          title={t('inventory.editCategory')}
          initialData={selectedCategory ? {
            name: selectedCategory.name,
            description: selectedCategory.description || '',
            parentId: selectedCategory.parentId || '',
            sortOrder: selectedCategory.sortOrder,
            active: selectedCategory.active,
          } : undefined}
          fields={formFields}
          schema={categorySchema}
          submitLabel={t('forms.buttons.update')}
          cancelLabel={t('forms.buttons.cancel')}
        />

        {/* Delete Confirmation */}
        <ConfirmationDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => {
            setIsDeleteDialogOpen(false);
            setSelectedCategory(null);
          }}
          onConfirm={handleDelete}
          title={t('inventory.deleteCategory')}
          description={
            selectedCategory
              ? `${t('inventory.categoryDeleteWarning')} "${selectedCategory.name}"`
              : ''
          }
          confirmLabel={t('forms.buttons.delete')}
          cancelLabel={t('forms.buttons.cancel')}
          variant="destructive"
        />
      </div>
    </MainLayout>
  );
}