'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DataTable } from '@/components/ui/data-table';
import { ModalForm, FormField } from '@/components/ui/modal-form';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { SearchFilter } from '@/components/ui/search-filter';
import { ExportData } from '@/components/ui/export-data';
import { ImageUpload } from '@/components/ui/image-upload';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useProducts, useCategories } from '@/hooks/use-crud';
import { useTranslations } from '@/hooks/use-translations';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import {
  Search,
  Plus,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Package,
  AlertTriangle,
  CheckCircle,
  Archive,
  Copy,
  BarChart3,
  History,
  Tags,
  Zap,
  TrendingUp,
  DollarSign,
  Boxes,
  Star,
  Eye,
  Download,
  Upload,
  Settings,
  Palette,
  ShoppingCart,
  Warehouse,
  Calendar,
  FileText,
  Link,
  Image as ImageIcon,
} from 'lucide-react';
import { z } from 'zod';

// Enhanced Product interface
interface Product {
  id: string;
  name: string;
  description?: string;
  categoryId?: string;
  category?: { id: string; name: string };
  unit: string;
  price: number;
  sku?: string;
  barcode?: string;
  imageUrl?: string;
  status: 'ACTIVE' | 'DISCONTINUED' | 'ARCHIVED' | 'PENDING_APPROVAL';
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  costCents: number;
  marginPercent: number;
  weight?: number;
  dimensions?: { length?: number; width?: number; height?: number };
  allergens?: string[];
  certifications?: string[];
  seasonalAvailability?: { startMonth?: number; endMonth?: number; notes?: string };
  tags?: string[];
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  variants?: ProductVariant[];
  relationships?: ProductRelationship[];
  inventoryItems?: { locationId: string; quantity: number; location: { name: string } }[];
  analytics?: ProductAnalytics;
}

interface ProductVariant {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  price: number;
  costCents: number;
  attributes?: Record<string, any>;
  active: boolean;
}

interface ProductRelationship {
  id: string;
  relatedProductId: string;
  relationshipType: 'SUBSTITUTE' | 'COMPLEMENT' | 'BUNDLE' | 'UPSELL' | 'CROSS_SELL';
  strength: number;
  notes?: string;
  relatedProduct: Product;
}

interface ProductAnalytics {
  totalOrdered: number;
  totalReceived: number;
  totalCostCents: number;
  avgUnitCostCents: number;
  orderCount: number;
  supplierCount: number;
  locationCount: number;
}

// Form validation schema
const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  price: z.number().min(0, 'Price must be non-negative').default(0),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  imageUrl: z.string().url('Invalid image URL').optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'DISCONTINUED', 'ARCHIVED', 'PENDING_APPROVAL']).default('ACTIVE'),
  minStock: z.number().int().min(0).default(0),
  maxStock: z.number().int().min(0).default(0),
  reorderPoint: z.number().int().min(0).default(0),
  costCents: z.number().int().min(0).default(0),
  weight: z.number().min(0).optional(),
  dimensions: z.object({
    length: z.number().min(0).optional(),
    width: z.number().min(0).optional(),
    height: z.number().min(0).optional(),
  }).optional(),
  allergens: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  seasonalAvailability: z.object({
    startMonth: z.number().int().min(1).max(12).optional(),
    endMonth: z.number().int().min(1).max(12).optional(),
    notes: z.string().optional(),
  }).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  active: z.boolean().default(true),
});

type ProductFormData = z.infer<typeof productSchema>;

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'DISCONTINUED':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'ARCHIVED':
      return 'bg-gray-100 text-gray-700 border-gray-200';
    case 'PENDING_APPROVAL':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return CheckCircle;
    case 'DISCONTINUED':
      return AlertTriangle;
    case 'ARCHIVED':
      return Archive;
    case 'PENDING_APPROVAL':
      return Clock;
    default:
      return Package;
  }
};

export default function ProductsPage() {
  const t = useTranslations();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<{ min?: number; max?: number }>({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [isRelationshipModalOpen, setIsRelationshipModalOpen] = useState(false);
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);

  // Data hooks
  const {
    data: products,
    loading: productsLoading,
    error: productsError,
    create: createProduct,
    update: updateProduct,
    delete: deleteProduct,
    bulkDelete: bulkDeleteProducts,
    refresh: refreshProducts,
  } = useProducts({
    search: searchTerm,
    categoryId: selectedCategory || undefined,
    status: selectedStatus || undefined,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    minPrice: priceRange.min,
    maxPrice: priceRange.max,
    active: true,
  });

  const { data: categories } = useCategories();

  // Memoized filtered products
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    return products.filter(product => {
      const matchesSearch = !searchTerm || 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.barcode?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
      const matchesStatus = !selectedStatus || product.status === selectedStatus;
      
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchTerm, selectedCategory, selectedStatus]);

  // Table columns
  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: 'imageUrl',
      header: '',
      cell: ({ row }) => (
        <Avatar className="h-10 w-10">
          <AvatarImage src={row.original.imageUrl} alt={row.original.name} />
          <AvatarFallback className="bg-gradient-to-br from-orange-400 to-red-500">
            <Package className="h-5 w-5 text-white" />
          </AvatarFallback>
        </Avatar>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'name',
      header: 'Product Name',
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="font-medium">{row.original.name}</div>
          {row.original.sku && (
            <div className="text-sm text-muted-foreground">SKU: {row.original.sku}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.category?.name || 'Uncategorized'}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const StatusIcon = getStatusIcon(row.original.status);
        return (
          <Badge className={getStatusColor(row.original.status)}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {row.original.status}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'price',
      header: 'Price',
      cell: ({ row }) => (
        <div className="text-right">
          <div className="font-medium">${(row.original.price / 100).toFixed(2)}</div>
          <div className="text-sm text-muted-foreground">per {row.original.unit}</div>
        </div>
      ),
    },
    {
      accessorKey: 'stock',
      header: 'Stock',
      cell: ({ row }) => {
        const totalStock = row.original.inventoryItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        const stockPercentage = row.original.maxStock > 0 ? (totalStock / row.original.maxStock) * 100 : 0;
        const isLowStock = totalStock <= row.original.reorderPoint;
        
        return (
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className={`font-medium ${isLowStock ? 'text-red-600' : ''}`}>
                {totalStock} {row.original.unit}
              </span>
              {isLowStock && <AlertTriangle className="h-4 w-4 text-red-500" />}
            </div>
            {row.original.maxStock > 0 && (
              <Progress 
                value={stockPercentage} 
                className="h-1"
                indicatorClassName={
                  stockPercentage > 50 ? 'bg-green-500' :
                  stockPercentage > 25 ? 'bg-yellow-500' : 'bg-red-500'
                }
              />
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'margin',
      header: 'Margin',
      cell: ({ row }) => (
        <div className="text-right">
          <div className="font-medium">{row.original.marginPercent.toFixed(1)}%</div>
          <div className="text-sm text-muted-foreground">
            Cost: ${(row.original.costCents / 100).toFixed(2)}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'tags',
      header: 'Tags',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.tags?.slice(0, 2).map((tag, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {row.original.tags && row.original.tags.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{row.original.tags.length - 2}
            </Badge>
          )}
        </div>
      ),
    },
  ];

  // Form fields for product creation/editing
  const getProductFormFields = (isEdit = false): FormField[] => [
    {
      name: 'name',
      label: 'Product Name',
      type: 'text',
      placeholder: 'Enter product name',
      required: true,
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      placeholder: 'Enter product description',
      rows: 3,
    },
    {
      name: 'categoryId',
      label: 'Category',
      type: 'select',
      placeholder: 'Select category',
      options: [
        { value: '', label: 'No Category' },
        ...(categories?.map(cat => ({ value: cat.id, label: cat.name })) || [])
      ],
    },
    {
      name: 'unit',
      label: 'Unit of Measure',
      type: 'text',
      placeholder: 'e.g., kg, pieces, liters',
      required: true,
    },
    {
      name: 'price',
      label: 'Price (cents)',
      type: 'number',
      placeholder: '0',
      min: 0,
    },
    {
      name: 'costCents',
      label: 'Cost (cents)',
      type: 'number',
      placeholder: '0',
      min: 0,
    },
    {
      name: 'sku',
      label: 'SKU',
      type: 'text',
      placeholder: 'Auto-generated if empty',
    },
    {
      name: 'barcode',
      label: 'Barcode',
      type: 'text',
      placeholder: 'Product barcode',
    },
    {
      name: 'imageUrl',
      label: 'Image URL',
      type: 'text',
      placeholder: 'https://example.com/image.jpg',
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'ACTIVE', label: 'Active' },
        { value: 'DISCONTINUED', label: 'Discontinued' },
        { value: 'ARCHIVED', label: 'Archived' },
        { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
      ],
    },
    {
      name: 'minStock',
      label: 'Minimum Stock',
      type: 'number',
      placeholder: '0',
      min: 0,
    },
    {
      name: 'maxStock',
      label: 'Maximum Stock',
      type: 'number',
      placeholder: '0',
      min: 0,
    },
    {
      name: 'reorderPoint',
      label: 'Reorder Point',
      type: 'number',
      placeholder: '0',
      min: 0,
    },
    {
      name: 'weight',
      label: 'Weight (kg)',
      type: 'number',
      placeholder: '0',
      min: 0,
      step: 0.01,
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea',
      placeholder: 'Additional notes about this product',
      rows: 2,
    },
    {
      name: 'active',
      label: 'Active',
      type: 'switch',
      description: 'Whether this product is active',
    },
  ];

  // Event handlers
  const handleCreateProduct = async (data: ProductFormData) => {
    try {
      await createProduct(data);
      setIsCreateModalOpen(false);
      toast.success('Product created successfully');
    } catch (error) {
      toast.error('Failed to create product');
      throw error;
    }
  };

  const handleEditProduct = async (data: ProductFormData) => {
    if (!selectedProduct) return;
    
    try {
      await updateProduct(selectedProduct.id, data);
      setIsEditModalOpen(false);
      setSelectedProduct(null);
      toast.success('Product updated successfully');
    } catch (error) {
      toast.error('Failed to update product');
      throw error;
    }
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    
    try {
      await deleteProduct(selectedProduct.id);
      setIsDeleteModalOpen(false);
      setSelectedProduct(null);
      toast.success('Product deleted successfully');
    } catch (error) {
      toast.error('Failed to delete product');
    }
  };

  const handleBulkDelete = async (products: Product[]) => {
    try {
      await bulkDeleteProducts(products.map(p => p.id));
      toast.success(`${products.length} products deleted successfully`);
    } catch (error) {
      toast.error('Failed to delete products');
    }
  };

  const handleDuplicateProduct = async (product: Product) => {
    try {
      // Call duplicate API endpoint
      const response = await fetch(`/api/products/${product.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${product.name} (Copy)` }),
      });
      
      if (!response.ok) throw new Error('Failed to duplicate product');
      
      await refreshProducts();
      toast.success('Product duplicated successfully');
    } catch (error) {
      toast.error('Failed to duplicate product');
    }
  };

  const handleArchiveProduct = async (product: Product) => {
    try {
      const response = await fetch(`/api/products/${product.id}/archive`, {
        method: 'POST',
      });
      
      if (!response.ok) throw new Error('Failed to archive product');
      
      await refreshProducts();
      toast.success('Product archived successfully');
    } catch (error) {
      toast.error('Failed to archive product');
    }
  };

  const handleExportProducts = (products: Product[]) => {
    const csvData = products.map(product => ({
      name: product.name,
      description: product.description || '',
      category: product.category?.name || '',
      unit: product.unit,
      price: product.price / 100,
      sku: product.sku || '',
      barcode: product.barcode || '',
      status: product.status,
      minStock: product.minStock,
      maxStock: product.maxStock,
      reorderPoint: product.reorderPoint,
      costCents: product.costCents / 100,
      marginPercent: product.marginPercent,
      weight: product.weight || '',
      tags: product.tags?.join(', ') || '',
      notes: product.notes || '',
      active: product.active,
    }));

    // Convert to CSV and download
    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout title="Product Management">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Product Management</h1>
            <p className="text-slate-600">Manage your complete product catalog with advanced features</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleExportProducts(filteredProducts)}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button 
              className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="list">
              <Package className="h-4 w-4 mr-2" />
              Products
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="templates">
              <FileText className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-6">
            {/* Advanced Search and Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <SearchFilter
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Search products by name, SKU, or barcode..."
                        className="w-full"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All Categories</SelectItem>
                          {categories?.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All Status</SelectItem>
                          <SelectItem value="ACTIVE">Active</SelectItem>
                          <SelectItem value="DISCONTINUED">Discontinued</SelectItem>
                          <SelectItem value="ARCHIVED">Archived</SelectItem>
                          <SelectItem value="PENDING_APPROVAL">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button
                        variant="outline"
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      >
                        <Filter className="h-4 w-4 mr-2" />
                        Filters
                      </Button>
                    </div>
                  </div>

                  {showAdvancedFilters && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t"
                    >
                      <div className="space-y-2">
                        <Label>Price Range</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="Min"
                            value={priceRange.min || ''}
                            onChange={(e) => setPriceRange(prev => ({ 
                              ...prev, 
                              min: e.target.value ? Number(e.target.value) : undefined 
                            }))}
                          />
                          <Input
                            type="number"
                            placeholder="Max"
                            value={priceRange.max || ''}
                            onChange={(e) => setPriceRange(prev => ({ 
                              ...prev, 
                              max: e.target.value ? Number(e.target.value) : undefined 
                            }))}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Tags</Label>
                        <Input
                          placeholder="Enter tags (comma separated)"
                          value={selectedTags.join(', ')}
                          onChange={(e) => setSelectedTags(
                            e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                          )}
                        />
                      </div>
                      
                      <div className="flex items-end">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSearchTerm('');
                            setSelectedCategory('');
                            setSelectedStatus('');
                            setSelectedTags([]);
                            setPriceRange({});
                          }}
                        >
                          Clear Filters
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Products Data Table */}
            <DataTable
              columns={columns}
              data={filteredProducts}
              loading={productsLoading}
              searchable={false} // We have custom search
              onEdit={(product) => {
                setSelectedProduct(product);
                setIsEditModalOpen(true);
              }}
              onDelete={(product) => {
                setSelectedProduct(product);
                setIsDeleteModalOpen(true);
              }}
              onView={(product) => {
                // Navigate to product detail page
                window.location.href = `/products/${product.id}`;
              }}
              onBulkDelete={handleBulkDelete}
              onExport={handleExportProducts}
              onAdd={() => setIsCreateModalOpen(true)}
              addLabel="Add Product"
              emptyMessage="No products found. Create your first product to get started."
              className="bg-white rounded-lg shadow-sm"
            />
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{filteredProducts.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Active products in catalog
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {filteredProducts.filter(p => {
                      const totalStock = p.inventoryItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
                      return totalStock <= p.reorderPoint;
                    }).length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Need reordering
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Margin</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {filteredProducts.length > 0 
                      ? (filteredProducts.reduce((sum, p) => sum + p.marginPercent, 0) / filteredProducts.length).toFixed(1)
                      : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Profit margin
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${(filteredProducts.reduce((sum, p) => {
                      const totalStock = p.inventoryItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
                      return sum + (totalStock * p.costCents);
                    }, 0) / 100).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Inventory value at cost
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <CardTitle>Product Templates</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Create templates for quick product creation
                </p>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No templates yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first product template to speed up product creation
                  </p>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Product Settings</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Configure product management preferences
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-generate SKUs</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically generate SKUs for new products
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Require approval for new products</Label>
                      <p className="text-sm text-muted-foreground">
                        New products need approval before becoming active
                      </p>
                    </div>
                    <Switch />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable barcode scanning</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow barcode scanning for product lookup
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Import/Export Settings</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Configure data import and export options
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button variant="outline" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV Template
                  </Button>
                  
                  <Button variant="outline" className="w-full">
                    <Upload className="h-4 w-4 mr-2" />
                    Bulk Import Products
                  </Button>
                  
                  <Button variant="outline" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Configure Export Fields
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Create Product Modal */}
        <ModalForm
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateProduct}
          title="Create New Product"
          description="Add a new product to your catalog with all the details"
          fields={getProductFormFields()}
          schema={productSchema}
          submitLabel="Create Product"
        />

        {/* Edit Product Modal */}
        <ModalForm
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedProduct(null);
          }}
          onSubmit={handleEditProduct}
          title="Edit Product"
          description="Update product information"
          fields={getProductFormFields(true)}
          schema={productSchema}
          initialData={selectedProduct ? {
            name: selectedProduct.name,
            description: selectedProduct.description || '',
            categoryId: selectedProduct.categoryId || '',
            unit: selectedProduct.unit,
            price: selectedProduct.price,
            sku: selectedProduct.sku || '',
            barcode: selectedProduct.barcode || '',
            imageUrl: selectedProduct.imageUrl || '',
            status: selectedProduct.status,
            minStock: selectedProduct.minStock,
            maxStock: selectedProduct.maxStock,
            reorderPoint: selectedProduct.reorderPoint,
            costCents: selectedProduct.costCents,
            weight: selectedProduct.weight,
            dimensions: selectedProduct.dimensions,
            allergens: selectedProduct.allergens,
            certifications: selectedProduct.certifications,
            seasonalAvailability: selectedProduct.seasonalAvailability,
            tags: selectedProduct.tags,
            notes: selectedProduct.notes || '',
            active: selectedProduct.active,
          } : undefined}
          submitLabel="Update Product"
        />

        {/* Delete Confirmation Modal */}
        <ConfirmationDialog
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedProduct(null);
          }}
          onConfirm={handleDeleteProduct}
          title="Delete Product"
          description={`Are you sure you want to delete "${selectedProduct?.name}"? This action cannot be undone.`}
          confirmLabel="Delete Product"
          variant="destructive"
        />
      </div>
    </MainLayout>
  );
}