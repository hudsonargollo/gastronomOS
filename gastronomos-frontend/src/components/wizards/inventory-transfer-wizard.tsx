/**
 * Inventory Transfer Wizard
 * Multi-step wizard for creating inventory transfers with location and product selection
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, ArrowRight, Package, MapPin, FileText, Check, AlertTriangle } from 'lucide-react';
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
  address?: string;
  managerId?: string;
  manager?: {
    firstName: string;
    lastName: string;
  };
}

interface Product {
  id: string;
  name: string;
  description?: string;
  unit: string;
  sku?: string;
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
  quantity: number;
  unitCost: number;
}

interface TransferItem {
  productId: string;
  product?: Product;
  quantityRequested: number;
  availableQuantity: number;
  notes?: string;
}

interface TransferData {
  sourceLocation?: Location;
  destinationLocation?: Location;
  transferItems: TransferItem[];
  priority: 'NORMAL' | 'HIGH' | 'EMERGENCY';
  notes?: string;
}

// Step 1: Location Selection
interface LocationSelectionProps {
  stepData?: { sourceLocationId?: string; destinationLocationId?: string };
  wizardData?: Record<string, any>;
  onDataChange?: (data: any) => void;
}

function LocationSelectionStep({ stepData, onDataChange }: LocationSelectionProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceLocation, setSourceLocation] = useState<Location | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<Location | null>(null);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (stepData?.sourceLocationId && locations.length > 0) {
      const source = locations.find(l => l.id === stepData.sourceLocationId);
      if (source) setSourceLocation(source);
    }
    if (stepData?.destinationLocationId && locations.length > 0) {
      const destination = locations.find(l => l.id === stepData.destinationLocationId);
      if (destination) setDestinationLocation(destination);
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

  const handleSourceLocationChange = (locationId: string) => {
    const location = locations.find(l => l.id === locationId);
    setSourceLocation(location || null);
    
    // Clear destination if it's the same as source
    if (destinationLocation?.id === locationId) {
      setDestinationLocation(null);
      onDataChange?.({
        sourceLocationId: locationId,
        sourceLocation: location,
        destinationLocationId: undefined,
        destinationLocation: undefined,
      });
    } else {
      onDataChange?.({
        sourceLocationId: locationId,
        sourceLocation: location,
        destinationLocationId: destinationLocation?.id,
        destinationLocation,
      });
    }
  };

  const handleDestinationLocationChange = (locationId: string) => {
    const location = locations.find(l => l.id === locationId);
    setDestinationLocation(location || null);
    onDataChange?.({
      sourceLocationId: sourceLocation?.id,
      sourceLocation,
      destinationLocationId: locationId,
      destinationLocation: location,
    });
  };

  const availableDestinations = locations.filter(l => l.id !== sourceLocation?.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <MapPin className="w-5 h-5" />
        <span>Select source and destination locations for the transfer</span>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-20 bg-muted rounded-md animate-pulse" />
          <div className="h-20 bg-muted rounded-md animate-pulse" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Source Location */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Source Location
              </CardTitle>
              <CardDescription>
                Where are you transferring items from?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={sourceLocation?.id || ''}
                onValueChange={handleSourceLocationChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source location" />
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

              {sourceLocation && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={transitions.default}
                  className="mt-4 p-4 bg-muted/50 rounded-lg"
                >
                  <div className="space-y-2">
                    <h4 className="font-medium">{sourceLocation.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      Type: {sourceLocation.type}
                    </p>
                    {sourceLocation.address && (
                      <p className="text-sm text-muted-foreground">
                        {sourceLocation.address}
                      </p>
                    )}
                    {sourceLocation.manager && (
                      <p className="text-sm text-muted-foreground">
                        Manager: {sourceLocation.manager.firstName} {sourceLocation.manager.lastName}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>

          {/* Transfer Arrow */}
          {sourceLocation && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={transitions.default}
              className="flex justify-center"
            >
              <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
                <ArrowRight className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-primary">Transfer</span>
              </div>
            </motion.div>
          )}

          {/* Destination Location */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Destination Location
              </CardTitle>
              <CardDescription>
                Where are you transferring items to?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={destinationLocation?.id || ''}
                onValueChange={handleDestinationLocationChange}
                disabled={!sourceLocation}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    sourceLocation 
                      ? "Select destination location" 
                      : "Select source location first"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {availableDestinations.map((location) => (
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

              {destinationLocation && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={transitions.default}
                  className="mt-4 p-4 bg-muted/50 rounded-lg"
                >
                  <div className="space-y-2">
                    <h4 className="font-medium">{destinationLocation.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      Type: {destinationLocation.type}
                    </p>
                    {destinationLocation.address && (
                      <p className="text-sm text-muted-foreground">
                        {destinationLocation.address}
                      </p>
                    )}
                    {destinationLocation.manager && (
                      <p className="text-sm text-muted-foreground">
                        Manager: {destinationLocation.manager.firstName} {destinationLocation.manager.lastName}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>

          {/* Validation Message */}
          {sourceLocation && destinationLocation && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transitions.default}
            >
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-green-700">
                    <Check className="w-5 h-5" />
                    <span className="font-medium">
                      Transfer route configured: {sourceLocation.name} → {destinationLocation.name}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

// Step 2: Product Selection
interface ProductSelectionProps {
  stepData?: { transferItems?: TransferItem[] };
  wizardData?: Record<string, any>;
  onDataChange?: (data: any) => void;
}

function ProductSelectionStep({ stepData, wizardData, onDataChange }: ProductSelectionProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [transferItems, setTransferItems] = useState<TransferItem[]>(stepData?.transferItems || []);

  const sourceLocation = wizardData?.['location-selection']?.sourceLocation;

  useEffect(() => {
    if (sourceLocation) {
      loadInventory();
    }
  }, [sourceLocation]);

  useEffect(() => {
    onDataChange?.({ transferItems });
  }, [transferItems, onDataChange]);

  const loadInventory = async () => {
    if (!sourceLocation) return;

    try {
      setLoading(true);
      const response = await apiClient.getInventory({ 
        locationId: sourceLocation.id,
        search: searchTerm,
        minQuantity: 1 // Only show items with stock
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

  const addTransferItem = (inventoryItem: InventoryItem) => {
    const existingIndex = transferItems.findIndex(item => item.productId === inventoryItem.productId);
    
    if (existingIndex >= 0) {
      // Increase quantity if product already exists
      const updatedItems = [...transferItems];
      const currentQty = updatedItems[existingIndex].quantityRequested;
      const maxQty = inventoryItem.quantity;
      
      if (currentQty < maxQty) {
        updatedItems[existingIndex].quantityRequested += 1;
        setTransferItems(updatedItems);
      }
    } else {
      // Add new transfer item
      const newItem: TransferItem = {
        productId: inventoryItem.productId,
        product: inventoryItem.product,
        quantityRequested: 1,
        availableQuantity: inventoryItem.quantity,
      };
      setTransferItems([...transferItems, newItem]);
    }
  };

  const updateTransferItem = (index: number, updates: Partial<TransferItem>) => {
    const updatedItems = [...transferItems];
    updatedItems[index] = { ...updatedItems[index], ...updates };
    setTransferItems(updatedItems);
  };

  const removeTransferItem = (index: number) => {
    setTransferItems(transferItems.filter((_, i) => i !== index));
  };

  const filteredInventory = inventory.filter(item =>
    item.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!sourceLocation) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Please select locations first</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Package className="w-5 h-5" />
        <span>Select products to transfer from {sourceLocation.name}</span>
      </div>

      {/* Current Transfer Items */}
      {transferItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transfer Items ({transferItems.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {transferItems.map((item, index) => (
              <motion.div
                key={`${item.productId}-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={transitions.default}
                className="flex items-center gap-4 p-4 border rounded-lg"
              >
                <div className="flex-1 space-y-2">
                  <h4 className="font-medium">{item.product?.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    SKU: {item.product?.sku || 'N/A'} • Unit: {item.product?.unit}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Available: {item.availableQuantity} {item.product?.unit}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      max={item.availableQuantity}
                      value={item.quantityRequested}
                      onChange={(e) => {
                        const qty = parseInt(e.target.value) || 1;
                        const maxQty = item.availableQuantity;
                        updateTransferItem(index, { 
                          quantityRequested: Math.min(Math.max(qty, 1), maxQty)
                        });
                      }}
                      className="w-20"
                    />
                  </div>
                  
                  {item.quantityRequested > item.availableQuantity && (
                    <div className="flex items-center gap-1 text-destructive text-xs">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Exceeds stock</span>
                    </div>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTransferItem(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Package className="w-4 h-4" />
                  </Button>
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
              <p>No inventory found at {sourceLocation.name}</p>
              {searchTerm && (
                <p className="text-sm mt-2">Try adjusting your search terms</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredInventory.map((inventoryItem) => {
              const isAdded = transferItems.some(item => item.productId === inventoryItem.productId);
              
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
                            SKU: {inventoryItem.product.sku || 'N/A'} • Unit: {inventoryItem.product.unit}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              Stock: {inventoryItem.quantity}
                            </Badge>
                            {inventoryItem.product.category && (
                              <Badge variant="outline" className="text-xs">
                                {inventoryItem.product.category.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => addTransferItem(inventoryItem)}
                          size="sm"
                          variant={isAdded ? "secondary" : "default"}
                          className="flex items-center gap-2"
                          disabled={inventoryItem.quantity === 0}
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-4 h-4" />
                              Added
                            </>
                          ) : (
                            <>
                              <Package className="w-4 h-4" />
                              Add
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

// Step 3: Priority and Notes
interface PriorityNotesProps {
  stepData?: { priority?: string; notes?: string };
  wizardData?: Record<string, any>;
  onDataChange?: (data: any) => void;
}

function PriorityNotesStep({ stepData, wizardData, onDataChange }: PriorityNotesProps) {
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'EMERGENCY'>(
    (stepData?.priority as 'NORMAL' | 'HIGH' | 'EMERGENCY') || 'NORMAL'
  );
  const [notes, setNotes] = useState(stepData?.notes || '');
  
  const sourceLocation = wizardData?.['location-selection']?.sourceLocation;
  const destinationLocation = wizardData?.['location-selection']?.destinationLocation;
  const transferItems = wizardData?.['product-selection']?.transferItems || [];
  
  useEffect(() => {
    onDataChange?.({ priority, notes });
  }, [priority, notes, onDataChange]);

  const priorityOptions = [
    {
      value: 'NORMAL' as const,
      label: 'Normal',
      description: 'Standard transfer processing time',
      color: 'text-blue-600',
    },
    {
      value: 'HIGH' as const,
      label: 'High Priority',
      description: 'Expedited processing required',
      color: 'text-orange-600',
    },
    {
      value: 'EMERGENCY' as const,
      label: 'Emergency',
      description: 'Immediate processing required',
      color: 'text-red-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <FileText className="w-5 h-5" />
        <span>Set priority and add notes for the transfer</span>
      </div>

      {/* Transfer Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transfer Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">From:</span>
              <span className="font-medium">{sourceLocation?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">To:</span>
              <span className="font-medium">{destinationLocation?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Items:</span>
              <span className="font-medium">{transferItems.length} product{transferItems.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Priority Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transfer Priority</CardTitle>
          <CardDescription>
            Select the priority level for this transfer request
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {priorityOptions.map((option) => (
              <motion.div
                key={option.value}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={transitions.default}
              >
                <Card 
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-muted/50",
                    priority === option.value && "border-primary bg-primary/5"
                  )}
                  onClick={() => setPriority(option.value)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className={cn("font-medium", option.color)}>{option.label}</h4>
                        <p className="text-sm text-muted-foreground">{option.description}</p>
                      </div>
                      {priority === option.value && (
                        <Check className="w-5 h-5 text-primary" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notes (Optional)</CardTitle>
          <CardDescription>
            Add any additional notes or special instructions for this transfer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Enter any notes or special instructions..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// Main Inventory Transfer Wizard Component
interface InventoryTransferWizardProps {
  onComplete?: (data: TransferData) => void;
  onCancel?: () => void;
  className?: string;
}

export function InventoryTransferWizard({ onComplete, onCancel, className }: InventoryTransferWizardProps) {
  const handleComplete = async (wizardData: Record<string, any>) => {
    try {
      const locationData = wizardData['location-selection'];
      const productData = wizardData['product-selection'];
      const priorityData = wizardData['priority-notes'];

      if (!locationData?.sourceLocationId || !locationData?.destinationLocationId || !productData?.transferItems?.length) {
        throw new Error('Missing required data');
      }

      // Create transfers for each product
      for (const item of productData.transferItems) {
        const transferData = {
          productId: item.productId,
          sourceLocationId: locationData.sourceLocationId,
          destinationLocationId: locationData.destinationLocationId,
          quantityRequested: item.quantityRequested,
          priority: priorityData?.priority || 'NORMAL',
          notes: priorityData?.notes || item.notes,
        };

        await apiClient.createTransfer(transferData);
      }

      // Call completion callback
      onComplete?.({
        sourceLocation: locationData.sourceLocation,
        destinationLocation: locationData.destinationLocation,
        transferItems: productData.transferItems,
        priority: priorityData?.priority || 'NORMAL',
        notes: priorityData?.notes,
      });
    } catch (error) {
      console.error('Failed to create transfer:', error);
      throw error;
    }
  };

  const wizardConfig: WizardConfig = createWizardConfig(
    'inventory-transfer-wizard',
    'Create Inventory Transfer',
    [
      {
        id: 'location-selection',
        title: 'Select Locations',
        description: 'Choose source and destination locations',
        component: LocationSelectionStep,
        validation: (data) => !!data?.sourceLocationId && !!data?.destinationLocationId,
      },
      {
        id: 'product-selection',
        title: 'Select Products',
        description: 'Choose products and quantities to transfer',
        component: ProductSelectionStep,
        validation: (data) => data?.transferItems?.length > 0,
      },
      {
        id: 'priority-notes',
        title: 'Priority & Notes',
        description: 'Set priority and add notes',
        component: PriorityNotesStep,
        validation: () => true, // Priority has default, notes are optional
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
        persistenceKey="inventory-transfer-wizard"
        showProgress={true}
        showNavigation={true}
        navigationVariant="full"
        stepVariant="card"
        animated={true}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    </div>
  );
}

export default InventoryTransferWizard;