/**
 * Inventory Management Wizard
 * Multi-step wizard for complex inventory operations including bulk updates, stock adjustments, and audits
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Package, MapPin, FileText, Check, AlertTriangle, Calculator, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Wizard, createWizardConfig } from '@/components/ui/wizard';
import { WizardConfig } from '@/contexts/wizard-context';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/animation-utils';

// Types
interface Location {
  id: string;
  name: string;
  type: string;
}

interface Product {
  id: string;
  name: string;
  sku?: string;
  unit: string;
  category?: {
    id: string;
    name: string;
  };
}

interface InventoryItem {
  id: string;
  productId: string;
  product: Product;
  locationId: string;
  location: Location;
  quantity: number;
  unitCost: number;
  minQuantity: number;
  maxQuantity: number;
}

interface AdjustmentItem {
  inventoryId: string;
  product?: Product;
  location?: Location;
  currentQuantity: number;
  newQuantity: number;
  adjustmentType: 'increase' | 'decrease' | 'set';
  reason: string;
  notes?: string;
}

interface InventoryOperationData {
  operationType: 'adjustment' | 'audit' | 'restock' | 'transfer';
  location?: Location;
  adjustmentItems: AdjustmentItem[];
  reason: string;
  notes?: string;
}

// Step 1: Operation Type Selection
interface OperationTypeProps {
  stepData?: { operationType?: string };
  onDataChange?: (data: any) => void;
}

function OperationTypeStep({ stepData, onDataChange }: OperationTypeProps) {
  const [operationType, setOperationType] = useState(stepData?.operationType || '');

  useEffect(() => {
    onDataChange?.({ operationType });
  }, [operationType, onDataChange]);

  const operationTypes = [
    {
      value: 'adjustment',
      title: 'Stock Adjustment',
      description: 'Adjust inventory quantities for corrections, waste, or consumption',
      icon: Calculator,
      color: 'bg-blue-500',
    },
    {
      value: 'audit',
      title: 'Inventory Audit',
      description: 'Perform a comprehensive inventory count and reconciliation',
      icon: ClipboardList,
      color: 'bg-purple-500',
    },
    {
      value: 'restock',
      title: 'Bulk Restock',
      description: 'Add new inventory from deliveries or purchases',
      icon: Package,
      color: 'bg-green-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Package className="w-5 h-5" />
        <span>Select the type of inventory operation you want to perform</span>
      </div>

      <div className="space-y-4">
        {operationTypes.map((type) => {
          const Icon = type.icon;
          return (
            <motion.div
              key={type.value}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transitions.default}
            >
              <Card 
                className={cn(
                  "cursor-pointer transition-colors hover:bg-muted/50",
                  operationType === type.value && "border-primary bg-primary/5"
                )}
                onClick={() => setOperationType(type.value)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`h-12 w-12 rounded-xl ${type.color} flex items-center justify-center`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-medium">{type.title}</h4>
                        <p className="text-sm text-muted-foreground">{type.description}</p>
                      </div>
                    </div>
                    {operationType === type.value && (
                      <Check className="w-5 h-5 text-primary" />
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// Step 2: Location Selection
interface LocationSelectionProps {
  stepData?: { locationId?: string };
  wizardData?: Record<string, any>;
  onDataChange?: (data: any) => void;
}

function LocationSelectionStep({ stepData, wizardData, onDataChange }: LocationSelectionProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  const operationType = wizardData?.['operation-type']?.operationType;

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (stepData?.locationId && locations.length > 0) {
      const location = locations.find(l => l.id === stepData.locationId);
      if (location) setSelectedLocation(location);
    }
  }, [stepData, locations]);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getLocations({ active: true });
      if (response.success) {
        setLocations(response.data.locations || []);
      }
    } catch (error) {
      console.error('Failed to load locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationChange = (locationId: string) => {
    const location = locations.find(l => l.id === locationId);
    setSelectedLocation(location || null);
    onDataChange?.({
      locationId,
      location,
    });
  };

  const getOperationTitle = () => {
    switch (operationType) {
      case 'adjustment': return 'Stock Adjustment Location';
      case 'audit': return 'Audit Location';
      case 'restock': return 'Restock Location';
      default: return 'Select Location';
    }
  };

  const getOperationDescription = () => {
    switch (operationType) {
      case 'adjustment': return 'Where are you making inventory adjustments?';
      case 'audit': return 'Which location do you want to audit?';
      case 'restock': return 'Where are you adding new inventory?';
      default: return 'Select the location for this operation';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <MapPin className="w-5 h-5" />
        <span>{getOperationDescription()}</span>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-20 bg-muted rounded-md animate-pulse" />
          <div className="h-20 bg-muted rounded-md animate-pulse" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              {getOperationTitle()}
            </CardTitle>
            <CardDescription>
              {getOperationDescription()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedLocation?.id || ''}
              onValueChange={handleLocationChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{location.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {location.type}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedLocation && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={transitions.default}
                className="mt-4 p-4 bg-muted/50 rounded-lg"
              >
                <div className="space-y-2">
                  <h4 className="font-medium">{selectedLocation.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Type: {selectedLocation.type}
                  </p>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Step 3: Inventory Items Selection and Adjustment
interface InventoryAdjustmentProps {
  stepData?: { adjustmentItems?: AdjustmentItem[] };
  wizardData?: Record<string, any>;
  onDataChange?: (data: any) => void;
}

function InventoryAdjustmentStep({ stepData, wizardData, onDataChange }: InventoryAdjustmentProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [adjustmentItems, setAdjustmentItems] = useState<AdjustmentItem[]>(stepData?.adjustmentItems || []);

  const location = wizardData?.['location-selection']?.location;
  const operationType = wizardData?.['operation-type']?.operationType;

  useEffect(() => {
    if (location) {
      loadInventory();
    }
  }, [location]);

  useEffect(() => {
    onDataChange?.({ adjustmentItems });
  }, [adjustmentItems, onDataChange]);

  const loadInventory = async () => {
    if (!location) return;

    try {
      setLoading(true);
      const response = await apiClient.getInventory({ 
        locationId: location.id,
        search: searchTerm,
      });
      if (response.success) {
        setInventory(response.data.inventory || []);
      }
    } catch (error) {
      console.error('Failed to load inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setTimeout(() => {
      if (value === searchTerm) {
        loadInventory();
      }
    }, 300);
  };

  const addAdjustmentItem = (inventoryItem: InventoryItem) => {
    const existingIndex = adjustmentItems.findIndex(item => item.inventoryId === inventoryItem.id);
    
    if (existingIndex >= 0) {
      return; // Already added
    }

    const newItem: AdjustmentItem = {
      inventoryId: inventoryItem.id,
      product: inventoryItem.product,
      location: inventoryItem.location,
      currentQuantity: inventoryItem.quantity,
      newQuantity: inventoryItem.quantity,
      adjustmentType: 'set',
      reason: '',
    };
    setAdjustmentItems([...adjustmentItems, newItem]);
  };

  const updateAdjustmentItem = (index: number, updates: Partial<AdjustmentItem>) => {
    const updatedItems = [...adjustmentItems];
    updatedItems[index] = { ...updatedItems[index], ...updates };
    
    // Auto-calculate adjustment type based on quantities
    const item = updatedItems[index];
    if (item.newQuantity > item.currentQuantity) {
      item.adjustmentType = 'increase';
    } else if (item.newQuantity < item.currentQuantity) {
      item.adjustmentType = 'decrease';
    } else {
      item.adjustmentType = 'set';
    }
    
    setAdjustmentItems(updatedItems);
  };

  const removeAdjustmentItem = (index: number) => {
    setAdjustmentItems(adjustmentItems.filter((_, i) => i !== index));
  };

  const filteredInventory = inventory.filter(item =>
    item.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStepTitle = () => {
    switch (operationType) {
      case 'adjustment': return 'Select Items to Adjust';
      case 'audit': return 'Audit Inventory Items';
      case 'restock': return 'Add Restock Items';
      default: return 'Select Inventory Items';
    }
  };

  if (!location) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Please select a location first</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Calculator className="w-5 h-5" />
        <span>{getStepTitle()} at {location.name}</span>
      </div>

      {/* Current Adjustments */}
      {adjustmentItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Items to Adjust ({adjustmentItems.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {adjustmentItems.map((item, index) => (
              <motion.div
                key={`${item.inventoryId}-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={transitions.default}
                className="p-4 border rounded-lg space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{item.product?.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      SKU: {item.product?.sku || 'N/A'} • Current: {item.currentQuantity} {item.product?.unit}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAdjustmentItem(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    Remove
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">New Quantity</Label>
                    <Input
                      type="number"
                      min="0"
                      value={item.newQuantity}
                      onChange={(e) => {
                        const qty = parseInt(e.target.value) || 0;
                        updateAdjustmentItem(index, { newQuantity: qty });
                      }}
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs">Reason</Label>
                    <Select
                      value={item.reason}
                      onValueChange={(value) => updateAdjustmentItem(index, { reason: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select reason" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="waste">Waste/Spoilage</SelectItem>
                        <SelectItem value="consumption">Consumption</SelectItem>
                        <SelectItem value="delivery">New Delivery</SelectItem>
                        <SelectItem value="correction">Count Correction</SelectItem>
                        <SelectItem value="damage">Damage/Loss</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs">Adjustment</Label>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={
                          item.adjustmentType === 'increase' ? 'default' :
                          item.adjustmentType === 'decrease' ? 'destructive' :
                          'secondary'
                        }
                      >
                        {item.adjustmentType === 'increase' && '+'}
                        {item.adjustmentType === 'decrease' && '-'}
                        {Math.abs(item.newQuantity - item.currentQuantity)} {item.product?.unit}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Label className="text-xs">Notes (Optional)</Label>
                  <Textarea
                    placeholder="Additional notes about this adjustment..."
                    value={item.notes || ''}
                    onChange={(e) => updateAdjustmentItem(index, { notes: e.target.value })}
                    rows={2}
                  />
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Inventory Search */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search inventory by product name or SKU..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Inventory List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-md animate-pulse" />
            ))}
          </div>
        ) : filteredInventory.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No inventory found at {location.name}</p>
              {searchTerm && (
                <p className="text-sm mt-2">Try adjusting your search terms</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredInventory.map((inventoryItem) => {
              const isAdded = adjustmentItems.some(item => item.inventoryId === inventoryItem.id);
              
              return (
                <motion.div
                  key={inventoryItem.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={transitions.default}
                >
                  <Card className={cn(
                    "cursor-pointer transition-colors hover:bg-muted/50",
                    isAdded && "border-primary bg-primary/5"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h4 className="font-medium">{inventoryItem.product.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            SKU: {inventoryItem.product.sku || 'N/A'} • Current: {inventoryItem.quantity} {inventoryItem.product.unit}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              Min: {inventoryItem.minQuantity}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Max: {inventoryItem.maxQuantity}
                            </Badge>
                            {inventoryItem.product.category && (
                              <Badge variant="outline" className="text-xs">
                                {inventoryItem.product.category.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => addAdjustmentItem(inventoryItem)}
                          size="sm"
                          variant={isAdded ? "secondary" : "default"}
                          className="flex items-center gap-2"
                          disabled={isAdded}
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-4 h-4" />
                              Added
                            </>
                          ) : (
                            <>
                              <Calculator className="w-4 h-4" />
                              Adjust
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Step 4: Review and Notes
interface ReviewNotesProps {
  stepData?: { reason?: string; notes?: string };
  wizardData?: Record<string, any>;
  onDataChange?: (data: any) => void;
}

function ReviewNotesStep({ stepData, wizardData, onDataChange }: ReviewNotesProps) {
  const [reason, setReason] = useState(stepData?.reason || '');
  const [notes, setNotes] = useState(stepData?.notes || '');
  
  const operationType = wizardData?.['operation-type']?.operationType;
  const location = wizardData?.['location-selection']?.location;
  const adjustmentItems = wizardData?.['inventory-adjustment']?.adjustmentItems || [];
  
  useEffect(() => {
    onDataChange?.({ reason, notes });
  }, [reason, notes, onDataChange]);

  const totalAdjustments = adjustmentItems.length;
  const increases = adjustmentItems.filter((item: AdjustmentItem) => item.adjustmentType === 'increase').length;
  const decreases = adjustmentItems.filter((item: AdjustmentItem) => item.adjustmentType === 'decrease').length;

  const getOperationTitle = () => {
    switch (operationType) {
      case 'adjustment': return 'Stock Adjustment Summary';
      case 'audit': return 'Inventory Audit Summary';
      case 'restock': return 'Restock Summary';
      default: return 'Operation Summary';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <FileText className="w-5 h-5" />
        <span>Review your changes and add notes</span>
      </div>

      {/* Operation Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{getOperationTitle()}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Operation:</span>
                <Badge variant="outline">{operationType}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Location:</span>
                <span className="font-medium">{location?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Items:</span>
                <span className="font-medium">{totalAdjustments}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Changes:</span>
                <div className="flex gap-2">
                  {increases > 0 && (
                    <Badge variant="default" className="bg-green-100 text-green-700">
                      +{increases}
                    </Badge>
                  )}
                  {decreases > 0 && (
                    <Badge variant="secondary" className="bg-red-100 text-red-700">
                      -{decreases}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reason Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Operation Reason</CardTitle>
          <CardDescription>
            Select the primary reason for this inventory operation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger>
              <SelectValue placeholder="Select reason" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="routine-audit">Routine Audit</SelectItem>
              <SelectItem value="cycle-count">Cycle Count</SelectItem>
              <SelectItem value="delivery-received">Delivery Received</SelectItem>
              <SelectItem value="waste-spoilage">Waste/Spoilage</SelectItem>
              <SelectItem value="consumption">Consumption</SelectItem>
              <SelectItem value="damage-loss">Damage/Loss</SelectItem>
              <SelectItem value="correction">Count Correction</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Additional Notes</CardTitle>
          <CardDescription>
            Add any additional notes or comments about this operation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Enter any additional notes or comments..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// Main Inventory Management Wizard Component
interface InventoryManagementWizardProps {
  onComplete?: (data: InventoryOperationData) => void;
  onCancel?: () => void;
  className?: string;
}

export function InventoryManagementWizard({ onComplete, onCancel, className }: InventoryManagementWizardProps) {
  const handleComplete = async (wizardData: Record<string, any>) => {
    try {
      const operationData = wizardData['operation-type'];
      const locationData = wizardData['location-selection'];
      const adjustmentData = wizardData['inventory-adjustment'];
      const reviewData = wizardData['review-notes'];

      if (!operationData?.operationType || !locationData?.location || !adjustmentData?.adjustmentItems?.length) {
        throw new Error('Missing required data');
      }

      // Process adjustments based on operation type
      for (const item of adjustmentData.adjustmentItems) {
        const adjustmentPayload = {
          inventoryId: item.inventoryId,
          newQuantity: item.newQuantity,
          reason: item.reason || reviewData?.reason || 'Manual adjustment',
          notes: item.notes || reviewData?.notes,
          operationType: operationData.operationType,
        };

        // await apiClient.adjustInventory(adjustmentPayload);
      }

      // Call completion callback
      onComplete?.({
        operationType: operationData.operationType,
        location: locationData.location,
        adjustmentItems: adjustmentData.adjustmentItems,
        reason: reviewData?.reason || '',
        notes: reviewData?.notes,
      });
    } catch (error) {
      console.error('Failed to complete inventory operation:', error);
      throw error;
    }
  };

  const wizardConfig: WizardConfig = createWizardConfig(
    'inventory-management-wizard',
    'Inventory Management',
    [
      {
        id: 'operation-type',
        title: 'Operation Type',
        description: 'Select the type of inventory operation',
        component: OperationTypeStep,
        validation: (data) => !!data?.operationType,
      },
      {
        id: 'location-selection',
        title: 'Select Location',
        description: 'Choose the location for this operation',
        component: LocationSelectionStep,
        validation: (data) => !!data?.locationId,
      },
      {
        id: 'inventory-adjustment',
        title: 'Adjust Items',
        description: 'Select and adjust inventory items',
        component: InventoryAdjustmentStep,
        validation: (data) => data?.adjustmentItems?.length > 0,
      },
      {
        id: 'review-notes',
        title: 'Review & Notes',
        description: 'Review changes and add notes',
        component: ReviewNotesStep,
        validation: (data) => !!data?.reason,
      },
    ],
    {
      onComplete: handleComplete,
      onCancel,
      allowBackNavigation: true,
      persistState: true,
    }
  );

  return (
    <div className={className}>
      <Wizard
        config={wizardConfig}
        persistenceKey="inventory-management-wizard"
        showProgress={true}
        showNavigation={true}
        navigationVariant="full"
        stepVariant="card"
        animated={true}
        onComplete={onComplete as ((data: Record<string, any>) => void) | undefined}
        onCancel={onCancel}
      />
    </div>
  );
}

export default InventoryManagementWizard;