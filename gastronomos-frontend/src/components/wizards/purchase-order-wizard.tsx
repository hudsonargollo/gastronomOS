/**
 * Purchase Order Wizard
 * Multi-step wizard for creating purchase orders with supplier and product selection
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Trash2, Package, Building2, FileText, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Wizard, createWizardConfig } from '@/components/ui/wizard';
import { WizardConfig } from '@/contexts/wizard-context';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/animation-utils';

// Types
interface Supplier {
  id: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  paymentTerms?: string;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  unit: string;
  price: number;
  sku?: string;
  category?: {
    id: string;
    name: string;
  };
}

interface POLineItem {
  productId: string;
  product?: Product;
  quantityOrdered: number;
  unitPriceCents: number;
  notes?: string;
}

interface PurchaseOrderData {
  supplier?: Supplier;
  lineItems: POLineItem[];
  notes?: string;
}

// Step 1: Supplier Selection
interface SupplierSelectionProps {
  stepData?: { supplierId?: string };
  wizardData?: Record<string, any>;
  onDataChange?: (data: any) => void;
}

function SupplierSelectionStep({ stepData, onDataChange }: SupplierSelectionProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    if (stepData?.supplierId && suppliers.length > 0) {
      const supplier = suppliers.find(s => s.id === stepData.supplierId);
      if (supplier) {
        setSelectedSupplier(supplier);
      }
    }
  }, [stepData?.supplierId, suppliers]);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getSuppliers({ search: searchTerm });
      if (response.success) {
        setSuppliers(response.data.suppliers || []);
      }
    } catch (error) {
      console.error('Failed to load suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSupplierSelect = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    onDataChange?.({ supplierId: supplier.id, supplier });
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    // Debounce search
    setTimeout(() => {
      if (value === searchTerm) {
        loadSuppliers();
      }
    }, 300);
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.contactEmail?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Building2 className="w-5 h-5" />
        <span>Select a supplier for this purchase order</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search suppliers by name or email..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Selected Supplier */}
      {selectedSupplier && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitions.default}
        >
          <Card className="border-primary bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Check className="w-5 h-5 text-primary" />
                  Selected Supplier
                </CardTitle>
                <Badge variant="secondary">Selected</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <h3 className="font-semibold">{selectedSupplier.name}</h3>
                {selectedSupplier.contactEmail && (
                  <p className="text-sm text-muted-foreground">{selectedSupplier.contactEmail}</p>
                )}
                {selectedSupplier.contactPhone && (
                  <p className="text-sm text-muted-foreground">{selectedSupplier.contactPhone}</p>
                )}
                {selectedSupplier.paymentTerms && (
                  <p className="text-sm">
                    <span className="font-medium">Payment Terms:</span> {selectedSupplier.paymentTerms}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Supplier List */}
      <div className="space-y-3">
        <h3 className="font-medium">Available Suppliers</h3>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-md animate-pulse" />
            ))}
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No suppliers found</p>
              {searchTerm && (
                <p className="text-sm mt-2">Try adjusting your search terms</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredSuppliers.map((supplier) => (
              <motion.div
                key={supplier.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={transitions.default}
              >
                <Card 
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-muted/50",
                    selectedSupplier?.id === supplier.id && "border-primary bg-primary/5"
                  )}
                  onClick={() => handleSupplierSelect(supplier)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium">{supplier.name}</h4>
                        {supplier.contactEmail && (
                          <p className="text-sm text-muted-foreground">{supplier.contactEmail}</p>
                        )}
                        {supplier.paymentTerms && (
                          <p className="text-xs text-muted-foreground">
                            Terms: {supplier.paymentTerms}
                          </p>
                        )}
                      </div>
                      {selectedSupplier?.id === supplier.id && (
                        <Check className="w-5 h-5 text-primary" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Step 2: Product Selection
interface ProductSelectionProps {
  stepData?: { lineItems?: POLineItem[] };
  wizardData?: Record<string, any>;
  onDataChange?: (data: any) => void;
}

function ProductSelectionStep({ stepData, wizardData, onDataChange }: ProductSelectionProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [lineItems, setLineItems] = useState<POLineItem[]>(stepData?.lineItems || []);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    onDataChange?.({ lineItems });
  }, [lineItems, onDataChange]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getProducts({ search: searchTerm, status: 'ACTIVE' });
      if (response.success) {
        setProducts(response.data.products || []);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setTimeout(() => {
      if (value === searchTerm) {
        loadProducts();
      }
    }, 300);
  };

  const addLineItem = (product: Product) => {
    const existingIndex = lineItems.findIndex(item => item.productId === product.id);
    
    if (existingIndex >= 0) {
      // Increase quantity if product already exists
      const updatedItems = [...lineItems];
      updatedItems[existingIndex].quantityOrdered += 1;
      setLineItems(updatedItems);
    } else {
      // Add new line item
      const newItem: POLineItem = {
        productId: product.id,
        product,
        quantityOrdered: 1,
        unitPriceCents: product.price || 0,
      };
      setLineItems([...lineItems, newItem]);
    }
  };

  const updateLineItem = (index: number, updates: Partial<POLineItem>) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = { ...updatedItems[index], ...updates };
    setLineItems(updatedItems);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCost = lineItems.reduce((sum, item) => 
    sum + (item.quantityOrdered * item.unitPriceCents), 0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Package className="w-5 h-5" />
        <span>Add products to your purchase order</span>
      </div>

      {/* Current Line Items */}
      {lineItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Order Items ({lineItems.length})</CardTitle>
            <CardDescription>
              Total: ${(totalCost / 100).toFixed(2)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lineItems.map((item, index) => (
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
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantityOrdered}
                      onChange={(e) => updateLineItem(index, { 
                        quantityOrdered: parseInt(e.target.value) || 1 
                      })}
                      className="w-20"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs">Unit Price</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={(item.unitPriceCents / 100).toFixed(2)}
                      onChange={(e) => updateLineItem(index, { 
                        unitPriceCents: Math.round(parseFloat(e.target.value) * 100) || 0 
                      })}
                      className="w-24"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs">Total</Label>
                    <div className="w-24 px-3 py-2 text-sm bg-muted rounded-md text-center">
                      ${((item.quantityOrdered * item.unitPriceCents) / 100).toFixed(2)}
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLineItem(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Product Search */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search products by name or SKU..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Product List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-md animate-pulse" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No products found</p>
              {searchTerm && (
                <p className="text-sm mt-2">Try adjusting your search terms</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredProducts.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={transitions.default}
              >
                <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium">{product.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          SKU: {product.sku || 'N/A'} • Unit: {product.unit} • ${(product.price / 100).toFixed(2)}
                        </p>
                        {product.category && (
                          <Badge variant="outline" className="text-xs">
                            {product.category.name}
                          </Badge>
                        )}
                      </div>
                      <Button
                        onClick={() => addLineItem(product)}
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Step 3: Review and Notes
interface ReviewStepProps {
  stepData?: { notes?: string };
  wizardData?: Record<string, any>;
  onDataChange?: (data: any) => void;
}

function ReviewStep({ stepData, wizardData, onDataChange }: ReviewStepProps) {
  const [notes, setNotes] = useState(stepData?.notes || '');
  
  const supplier = wizardData?.['supplier-selection']?.supplier;
  const lineItems = wizardData?.['product-selection']?.lineItems || [];
  
  useEffect(() => {
    onDataChange?.({ notes });
  }, [notes, onDataChange]);

  const totalCost = lineItems.reduce((sum: number, item: POLineItem) => 
    sum + (item.quantityOrdered * item.unitPriceCents), 0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <FileText className="w-5 h-5" />
        <span>Review your purchase order details</span>
      </div>

      {/* Supplier Summary */}
      {supplier && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Supplier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <h3 className="font-semibold">{supplier.name}</h3>
              {supplier.contactEmail && (
                <p className="text-sm text-muted-foreground">{supplier.contactEmail}</p>
              )}
              {supplier.paymentTerms && (
                <p className="text-sm">
                  <span className="font-medium">Payment Terms:</span> {supplier.paymentTerms}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Order Summary</CardTitle>
          <CardDescription>
            {lineItems.length} item{lineItems.length !== 1 ? 's' : ''} • Total: ${(totalCost / 100).toFixed(2)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {lineItems.map((item: POLineItem, index: number) => (
              <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                <div>
                  <h4 className="font-medium">{item.product?.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {item.quantityOrdered} × ${(item.unitPriceCents / 100).toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    ${((item.quantityOrdered * item.unitPriceCents) / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between items-center font-semibold">
              <span>Total</span>
              <span>${(totalCost / 100).toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notes (Optional)</CardTitle>
          <CardDescription>
            Add any additional notes or special instructions for this purchase order
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

// Main Purchase Order Wizard Component
interface PurchaseOrderWizardProps {
  onComplete?: (data: PurchaseOrderData) => void;
  onCancel?: () => void;
  className?: string;
}

export function PurchaseOrderWizard({ onComplete, onCancel, className }: PurchaseOrderWizardProps) {
  const handleComplete = async (wizardData: Record<string, any>) => {
    try {
      const supplierData = wizardData['supplier-selection'];
      const productData = wizardData['product-selection'];
      const reviewData = wizardData['review'];

      if (!supplierData?.supplierId || !productData?.lineItems?.length) {
        throw new Error('Missing required data');
      }

      // Create the purchase order
      const poData = {
        supplierId: supplierData.supplierId,
        notes: reviewData?.notes,
      };

      const response = await apiClient.createPurchaseOrder(poData);
      
      if (response.purchaseOrder) {
        // Add line items
        const poId = response.purchaseOrder.id;
        
        for (const item of productData.lineItems) {
          await apiClient.addPOLineItem(poId, {
            productId: item.productId,
            quantityOrdered: item.quantityOrdered,
            unitPriceCents: item.unitPriceCents,
            notes: item.notes,
          });
        }

        // Call completion callback
        onComplete?.({
          supplier: supplierData.supplier,
          lineItems: productData.lineItems,
          notes: reviewData?.notes,
        });
      }
    } catch (error) {
      console.error('Failed to create purchase order:', error);
      throw error;
    }
  };

  const wizardConfig: WizardConfig = createWizardConfig(
    'purchase-order-wizard',
    'Create Purchase Order',
    [
      {
        id: 'supplier-selection',
        title: 'Select Supplier',
        description: 'Choose the supplier for this purchase order',
        component: SupplierSelectionStep,
        validation: (data) => !!data?.supplierId,
      },
      {
        id: 'product-selection',
        title: 'Add Products',
        description: 'Select products and quantities to order',
        component: ProductSelectionStep,
        validation: (data) => data?.lineItems?.length > 0,
      },
      {
        id: 'review',
        title: 'Review & Submit',
        description: 'Review your order details and add notes',
        component: ReviewStep,
        validation: () => true, // Notes are optional
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
        persistenceKey="purchase-order-wizard"
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

export default PurchaseOrderWizard;