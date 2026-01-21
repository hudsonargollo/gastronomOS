'use client';

import React, { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { ResponsiveContainer, ResponsiveGrid } from '@/components/layout/responsive-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GastronomyIcons } from '@/components/icons/gastronomy-icons';
import { AlertTriangle, TrendingDown, TrendingUp, Warehouse, Search, Filter, Zap, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from '@/hooks/use-translations';
import { AnimatedPage } from '@/components/ui/animated-page';
import { AnimatedList } from '@/components/ui/animated-list';
import { InventoryTransferWizard } from '@/components/wizards/inventory-transfer-wizard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useInventory, useLowStockItems } from '@/hooks/use-crud';
import { staggerContainer, listItemVariants, fadeInOut } from '@/lib/animation-utils';
import { Progress } from '@/components/ui/progress';

// Stock level item interface
interface StockItem {
  id: string;
  product: {
    id: string;
    name: string;
    sku?: string;
    unit: string;
    category?: {
      id: string;
      name: string;
    };
  };
  location: {
    id: string;
    name: string;
    type: string;
  };
  quantity: number;
  minQuantity: number;
  maxQuantity: number;
  unitCost: number;
  status: 'critical' | 'low' | 'good' | 'overstocked';
  lastUpdated: string;
}

// Mock data - in real app this would come from API
const mockStockLevels: StockItem[] = [
  { 
    id: '1', 
    product: { id: '1', name: 'Tomatoes', sku: 'TOM-001', unit: 'kg', category: { id: '1', name: 'Vegetables' } }, 
    location: { id: '1', name: 'Main Kitchen', type: 'Kitchen' },
    quantity: 45, 
    minQuantity: 50, 
    maxQuantity: 200, 
    unitCost: 3.50,
    status: 'low', 
    lastUpdated: '2024-01-20T10:30:00Z'
  },
  { 
    id: '2', 
    product: { id: '2', name: 'Chicken Breast', sku: 'CHK-001', unit: 'kg', category: { id: '2', name: 'Meat' } }, 
    location: { id: '2', name: 'Cold Storage', type: 'Storage' },
    quantity: 120, 
    minQuantity: 80, 
    maxQuantity: 300, 
    unitCost: 12.00,
    status: 'good', 
    lastUpdated: '2024-01-20T09:15:00Z'
  },
  { 
    id: '3', 
    product: { id: '3', name: 'Olive Oil', sku: 'OIL-001', unit: 'l', category: { id: '3', name: 'Oils' } }, 
    location: { id: '3', name: 'Pantry', type: 'Storage' },
    quantity: 25, 
    minQuantity: 30, 
    maxQuantity: 100, 
    unitCost: 8.75,
    status: 'low', 
    lastUpdated: '2024-01-20T08:45:00Z'
  },
  { 
    id: '4', 
    product: { id: '4', name: 'Rice', sku: 'RIC-001', unit: 'kg', category: { id: '4', name: 'Grains' } }, 
    location: { id: '4', name: 'Dry Storage', type: 'Storage' },
    quantity: 180, 
    minQuantity: 100, 
    maxQuantity: 400, 
    unitCost: 2.25,
    status: 'good', 
    lastUpdated: '2024-01-20T07:20:00Z'
  },
  { 
    id: '5', 
    product: { id: '5', name: 'Milk', sku: 'MLK-001', unit: 'l', category: { id: '5', name: 'Dairy' } }, 
    location: { id: '5', name: 'Refrigerator', type: 'Storage' },
    quantity: 15, 
    minQuantity: 20, 
    maxQuantity: 80, 
    unitCost: 1.50,
    status: 'critical', 
    lastUpdated: '2024-01-20T11:00:00Z'
  },
  { 
    id: '6', 
    product: { id: '6', name: 'Flour', sku: 'FLR-001', unit: 'kg', category: { id: '6', name: 'Baking' } }, 
    location: { id: '4', name: 'Dry Storage', type: 'Storage' },
    quantity: 450, 
    minQuantity: 100, 
    maxQuantity: 300, 
    unitCost: 1.80,
    status: 'overstocked', 
    lastUpdated: '2024-01-19T16:30:00Z'
  },
];

// Animated stock level indicator component
interface StockLevelIndicatorProps {
  current: number;
  min: number;
  max: number;
  status: StockItem['status'];
  unit: string;
}

function StockLevelIndicator({ current, min, max, status, unit }: StockLevelIndicatorProps) {
  const percentage = Math.min((current / max) * 100, 100);
  const isLow = current <= min;
  const isCritical = current <= min * 0.5;
  const isOverstocked = current > max;

  const getStatusColor = () => {
    switch (status) {
      case 'critical': return 'bg-red-500';
      case 'low': return 'bg-yellow-500';
      case 'good': return 'bg-green-500';
      case 'overstocked': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'critical': return 'Critical';
      case 'low': return 'Low Stock';
      case 'good': return 'Good';
      case 'overstocked': return 'Overstocked';
      default: return 'Unknown';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{current} {unit}</span>
        <Badge 
          variant={status === 'good' ? 'default' : 'secondary'}
          className={`${
            status === 'critical' ? 'bg-red-100 text-red-700' :
            status === 'low' ? 'bg-yellow-100 text-yellow-700' :
            status === 'overstocked' ? 'bg-blue-100 text-blue-700' :
            'bg-green-100 text-green-700'
          }`}
        >
          {getStatusText()}
        </Badge>
      </div>
      
      <div className="relative">
        <Progress 
          value={percentage} 
          className="h-2"
        />
        <motion.div
          className={`absolute top-0 left-0 h-2 rounded-full ${getStatusColor()}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        
        {/* Min/Max indicators */}
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Min: {min}</span>
          <span>Max: {max}</span>
        </div>
      </div>
    </div>
  );
}

export default function StockLevelsPage() {
  const { t } = useTranslations();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [showTransferWizard, setShowTransferWizard] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Inventory', href: '/inventory' },
    { label: 'Stock Levels', href: '/inventory/stock' }
  ];

  // Filter and search stock levels
  const filteredStockLevels = useMemo(() => {
    return mockStockLevels.filter(item => {
      const matchesSearch = !searchTerm || 
        item.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.location.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesLocation = locationFilter === 'all' || item.location.id === locationFilter;
      
      return matchesSearch && matchesStatus && matchesLocation;
    });
  }, [searchTerm, statusFilter, locationFilter]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const critical = mockStockLevels.filter(item => item.status === 'critical').length;
    const low = mockStockLevels.filter(item => item.status === 'low').length;
    const good = mockStockLevels.filter(item => item.status === 'good').length;
    const overstocked = mockStockLevels.filter(item => item.status === 'overstocked').length;
    
    return { critical, low, good, overstocked };
  }, []);

  const handleTransferComplete = (data: any) => {
    setShowTransferWizard(false);
    // Refresh stock data
  };

  const handleItemSelect = (itemId: string, selected: boolean) => {
    if (selected) {
      setSelectedItems(prev => [...prev, itemId]);
    } else {
      setSelectedItems(prev => prev.filter(id => id !== itemId));
    }
  };

  const uniqueLocations = Array.from(new Set(mockStockLevels.map(item => item.location.id)))
    .map(id => mockStockLevels.find(item => item.location.id === id)?.location)
    .filter(Boolean);

  return (
    <AnimatedPage>
      <MainLayout title={t('pages.inventory.stockLevels.title')} breadcrumbs={breadcrumbs}>
        <ResponsiveContainer maxWidth="xl" padding="md">
          <motion.div 
            className="space-y-8"
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
                <div className="h-12 w-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Warehouse className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">{t('pages.inventory.stockLevels.title')}</h1>
                  <p className="text-slate-600">{t('pages.inventory.stockLevels.subtitle')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowTransferWizard(true)}>
                  <Zap className="h-4 w-4 mr-2" />
                  Quick Transfer
                </Button>
                <Button>
                  <Package className="h-4 w-4 mr-2" />
                  Restock Items
                </Button>
              </div>
            </motion.div>

            {/* Summary Cards */}
            <motion.div variants={listItemVariants}>
              <ResponsiveGrid cols={{ default: 2, md: 4 }} gap="md">
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                      </div>
                      <div>
                        <motion.p 
                          className="text-2xl font-bold text-red-900"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.2, type: "spring" }}
                        >
                          {summaryStats.critical}
                        </motion.p>
                        <p className="text-sm text-red-700">Critical Items</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-yellow-200 bg-yellow-50">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                        <TrendingDown className="h-6 w-6 text-yellow-600" />
                      </div>
                      <div>
                        <motion.p 
                          className="text-2xl font-bold text-yellow-900"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.3, type: "spring" }}
                        >
                          {summaryStats.low}
                        </motion.p>
                        <p className="text-sm text-yellow-700">Low Stock</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <motion.p 
                          className="text-2xl font-bold text-green-900"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.4, type: "spring" }}
                        >
                          {summaryStats.good}
                        </motion.p>
                        <p className="text-sm text-green-700">Well Stocked</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Package className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <motion.p 
                          className="text-2xl font-bold text-blue-900"
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.5, type: "spring" }}
                        >
                          {summaryStats.overstocked}
                        </motion.p>
                        <p className="text-sm text-blue-700">Overstocked</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </ResponsiveGrid>
            </motion.div>

            {/* Filters */}
            <motion.div variants={listItemVariants}>
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Search by product name, SKU, or location..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full md:w-48">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="low">Low Stock</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="overstocked">Overstocked</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={locationFilter} onValueChange={setLocationFilter}>
                      <SelectTrigger className="w-full md:w-48">
                        <SelectValue placeholder="Filter by location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Locations</SelectItem>
                        {uniqueLocations.map((location) => (
                          <SelectItem key={location!.id} value={location!.id}>
                            {location!.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Stock Items List */}
            <motion.div variants={listItemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Stock Status by Product ({filteredStockLevels.length} items)</span>
                    {selectedItems.length > 0 && (
                      <Badge variant="secondary">
                        {selectedItems.length} selected
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AnimatePresence mode="popLayout">
                    {filteredStockLevels.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center py-12 text-muted-foreground"
                      >
                        <Warehouse className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No stock items match your current filters</p>
                      </motion.div>
                    ) : (
                      <AnimatedList
                        items={filteredStockLevels}
                        keyExtractor={(item) => item.id}
                        renderItem={(item, index) => (
                          <motion.div
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className="p-6 bg-slate-50 rounded-lg border hover:shadow-md transition-all duration-200"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-4 flex-1">
                                <div className="flex items-center space-x-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedItems.includes(item.id)}
                                    onChange={(e) => handleItemSelect(item.id, e.target.checked)}
                                    className="rounded border-gray-300"
                                  />
                                  <GastronomyIcons.Warehouse className="h-8 w-8 text-slate-400" />
                                </div>
                                
                                <div className="flex-1 space-y-3">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <h4 className="font-medium text-slate-900">{item.product.name}</h4>
                                      <div className="flex items-center gap-2 mt-1">
                                        <p className="text-sm text-slate-600">{item.location.name}</p>
                                        {item.product.sku && (
                                          <Badge variant="outline" className="text-xs">
                                            {item.product.sku}
                                          </Badge>
                                        )}
                                        {item.product.category && (
                                          <Badge variant="outline" className="text-xs">
                                            {item.product.category.name}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="text-right">
                                      <p className="text-sm font-medium text-slate-900">
                                        ${(item.quantity * item.unitCost).toFixed(2)} value
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        ${item.unitCost.toFixed(2)} per {item.product.unit}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <StockLevelIndicator
                                    current={item.quantity}
                                    min={item.minQuantity}
                                    max={item.maxQuantity}
                                    status={item.status}
                                    unit={item.product.unit}
                                  />
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                        className="space-y-4"
                      />
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>

            {/* Bulk Actions */}
            <AnimatePresence>
              {selectedItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 50 }}
                  className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50"
                >
                  <Card className="shadow-lg border-2">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium">
                          {selectedItems.length} items selected
                        </span>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => setShowTransferWizard(true)}>
                            <Zap className="h-4 w-4 mr-2" />
                            Transfer Selected
                          </Button>
                          <Button size="sm" variant="outline">
                            <Package className="h-4 w-4 mr-2" />
                            Restock Selected
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => setSelectedItems([])}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
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