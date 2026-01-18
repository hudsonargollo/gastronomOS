'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
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
} from 'lucide-react';

const mockProducts = [
  {
    id: '1',
    name: 'Fresh Tomatoes',
    category: 'Vegetables',
    unit: 'kg',
    currentStock: 45,
    minStock: 20,
    maxStock: 100,
    avgCost: 3.50,
    supplier: 'Green Valley Farms',
    status: 'in_stock',
    lastUpdated: '2024-01-17',
  },
  {
    id: '2',
    name: 'Olive Oil Extra Virgin',
    category: 'Oils & Condiments',
    unit: 'L',
    currentStock: 8,
    minStock: 15,
    maxStock: 50,
    avgCost: 12.99,
    supplier: 'Mediterranean Imports',
    status: 'low_stock',
    lastUpdated: '2024-01-16',
  },
  {
    id: '3',
    name: 'Organic Chicken Breast',
    category: 'Meat & Poultry',
    unit: 'kg',
    currentStock: 25,
    minStock: 10,
    maxStock: 40,
    avgCost: 8.75,
    supplier: 'Farm Fresh Meats',
    status: 'in_stock',
    lastUpdated: '2024-01-17',
  },
  {
    id: '4',
    name: 'Mozzarella Cheese',
    category: 'Dairy',
    unit: 'kg',
    currentStock: 0,
    minStock: 5,
    maxStock: 25,
    avgCost: 6.50,
    supplier: 'Artisan Dairy Co.',
    status: 'out_of_stock',
    lastUpdated: '2024-01-15',
  },
  {
    id: '5',
    name: 'Basil Leaves',
    category: 'Herbs & Spices',
    unit: 'bunch',
    currentStock: 12,
    minStock: 8,
    maxStock: 30,
    avgCost: 2.25,
    supplier: 'Herb Garden Supply',
    status: 'in_stock',
    lastUpdated: '2024-01-17',
  },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'in_stock':
      return 'bg-green-100 text-green-700';
    case 'low_stock':
      return 'bg-yellow-100 text-yellow-700';
    case 'out_of_stock':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'in_stock':
      return CheckCircle;
    case 'low_stock':
      return AlertTriangle;
    case 'out_of_stock':
      return AlertTriangle;
    default:
      return Package;
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Vegetables':
      return GastronomyIcons.Carrot;
    case 'Meat & Poultry':
      return GastronomyIcons.Apple; // Using apple as placeholder
    case 'Dairy':
      return GastronomyIcons.Refrigerator;
    case 'Herbs & Spices':
      return GastronomyIcons.Apple;
    default:
      return Package;
  }
};

export default function ProductsPage() {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('all');

  const filteredProducts = mockProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...Array.from(new Set(mockProducts.map(p => p.category)))];

  return (
    <MainLayout title="Products">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Product Inventory</h1>
            <p className="text-slate-600">Manage your restaurant's product catalog</p>
          </div>
          <Button className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Filter className="h-4 w-4 mr-2" />
                      Category
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {categories.map((category) => (
                      <DropdownMenuItem
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                      >
                        {category === 'all' ? 'All Categories' : category}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product, index) => {
            const StatusIcon = getStatusIcon(product.status);
            const CategoryIcon = getCategoryIcon(product.category);
            const stockPercentage = (product.currentStock / product.maxStock) * 100;

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Card className="hover:shadow-lg transition-shadow duration-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-gradient-to-br from-orange-400 to-red-500">
                            <CategoryIcon className="h-5 w-5 text-white" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">{product.name}</CardTitle>
                          <p className="text-sm text-slate-500">{product.category}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Status */}
                    <div className="flex items-center justify-between">
                      <Badge className={getStatusColor(product.status)}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {product.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <span className="text-sm text-slate-500">
                        ${product.avgCost.toFixed(2)}/{product.unit}
                      </span>
                    </div>

                    {/* Stock Level */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Stock Level</span>
                        <span className="font-medium">
                          {product.currentStock} {product.unit}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            stockPercentage > 50
                              ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                              : stockPercentage > 25
                              ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                              : 'bg-gradient-to-r from-red-500 to-pink-500'
                          }`}
                          style={{ width: `${Math.max(stockPercentage, 5)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Min: {product.minStock}</span>
                        <span>Max: {product.maxStock}</span>
                      </div>
                    </div>

                    {/* Supplier */}
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-xs text-slate-500">Supplier</p>
                      <p className="text-sm font-medium text-slate-700">{product.supplier}</p>
                    </div>

                    {/* Last Updated */}
                    <div className="text-xs text-slate-400">
                      Updated: {new Date(product.lastUpdated).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredProducts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No products found</h3>
            <p className="text-slate-500 mb-4">
              {searchTerm || selectedCategory !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : 'Get started by adding your first product'}
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </motion.div>
        )}
      </div>
    </MainLayout>
  );
}