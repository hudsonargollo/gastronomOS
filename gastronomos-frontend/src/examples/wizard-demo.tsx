/**
 * Wizard Demo Component
 * Demonstrates the wizard workflow system with example steps
 */

'use client';

import React, { useState } from 'react';
import { Wizard, createWizardConfig, createFormStep } from '@/components/ui/wizard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Package, Truck, FileText } from 'lucide-react';

// Example step components
const WelcomeStep: React.FC<{
  stepData?: any;
  onDataChange?: (data: any) => void;
}> = ({ stepData = {}, onDataChange }) => {
  return (
    <div className="text-center space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Welcome to the Purchase Order Wizard</h3>
        <p className="text-muted-foreground">
          This wizard will guide you through creating a new purchase order step by step.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="w-8 h-8 mx-auto mb-2 text-primary" />
            <h4 className="font-medium">Select Supplier</h4>
            <p className="text-sm text-muted-foreground">Choose your supplier</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Truck className="w-8 h-8 mx-auto mb-2 text-primary" />
            <h4 className="font-medium">Add Products</h4>
            <p className="text-sm text-muted-foreground">Select products and quantities</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <FileText className="w-8 h-8 mx-auto mb-2 text-primary" />
            <h4 className="font-medium">Review & Submit</h4>
            <p className="text-sm text-muted-foreground">Confirm your order</p>
          </CardContent>
        </Card>
      </div>

      <Button
        onClick={() => onDataChange?.({ acknowledged: true })}
        className="w-full max-w-sm"
      >
        Get Started
      </Button>
    </div>
  );
};

const SupplierStep: React.FC<{
  stepData?: any;
  onDataChange?: (data: any) => void;
}> = ({ stepData = {}, onDataChange }) => {
  const suppliers = [
    { id: '1', name: 'Fresh Foods Inc.', category: 'Produce', rating: 4.8 },
    { id: '2', name: 'Quality Meats Co.', category: 'Meat & Poultry', rating: 4.6 },
    { id: '3', name: 'Dairy Direct', category: 'Dairy Products', rating: 4.9 },
    { id: '4', name: 'Spice World', category: 'Spices & Seasonings', rating: 4.7 },
  ];

  const handleSupplierSelect = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    onDataChange?.({ 
      supplierId, 
      supplierName: supplier?.name,
      supplierCategory: supplier?.category 
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Select Supplier</h3>
        <p className="text-muted-foreground">Choose the supplier for this purchase order.</p>
      </div>

      <div className="grid gap-4">
        {suppliers.map((supplier) => (
          <Card
            key={supplier.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              stepData.supplierId === supplier.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => handleSupplierSelect(supplier.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{supplier.name}</h4>
                  <p className="text-sm text-muted-foreground">{supplier.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">★ {supplier.rating}</Badge>
                  {stepData.supplierId === supplier.id && (
                    <CheckCircle className="w-5 h-5 text-primary" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stepData.supplierId && (
        <div className="p-4 bg-primary/5 rounded-lg">
          <p className="text-sm">
            <strong>Selected:</strong> {stepData.supplierName} ({stepData.supplierCategory})
          </p>
        </div>
      )}
    </div>
  );
};

const ProductsStep: React.FC<{
  stepData?: any;
  onDataChange?: (data: any) => void;
}> = ({ stepData = { products: [] }, onDataChange }) => {
  const availableProducts = [
    { id: '1', name: 'Organic Tomatoes', unit: 'lb', price: 3.99 },
    { id: '2', name: 'Fresh Basil', unit: 'bunch', price: 2.49 },
    { id: '3', name: 'Mozzarella Cheese', unit: 'lb', price: 8.99 },
    { id: '4', name: 'Olive Oil', unit: 'bottle', price: 12.99 },
  ];

  const addProduct = (product: any) => {
    const existingIndex = stepData.products.findIndex((p: any) => p.id === product.id);
    let newProducts;
    
    if (existingIndex >= 0) {
      newProducts = [...stepData.products];
      newProducts[existingIndex].quantity += 1;
    } else {
      newProducts = [...stepData.products, { ...product, quantity: 1 }];
    }
    
    onDataChange?.({ ...stepData, products: newProducts });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const newProducts = stepData.products.map((p: any) =>
      p.id === productId ? { ...p, quantity: Math.max(0, quantity) } : p
    ).filter((p: any) => p.quantity > 0);
    
    onDataChange?.({ ...stepData, products: newProducts });
  };

  const total = stepData.products.reduce((sum: number, p: any) => sum + (p.price * p.quantity), 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Add Products</h3>
        <p className="text-muted-foreground">Select products and specify quantities for your order.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Available Products */}
        <div>
          <h4 className="font-medium mb-3">Available Products</h4>
          <div className="space-y-2">
            {availableProducts.map((product) => (
              <Card key={product.id} className="cursor-pointer hover:shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-sm">{product.name}</h5>
                      <p className="text-xs text-muted-foreground">
                        ${product.price} per {product.unit}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => addProduct(product)}>
                      Add
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Selected Products */}
        <div>
          <h4 className="font-medium mb-3">Selected Products</h4>
          {stepData.products.length === 0 ? (
            <p className="text-muted-foreground text-sm">No products selected yet.</p>
          ) : (
            <div className="space-y-2">
              {stepData.products.map((product: any) => (
                <Card key={product.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-sm">{product.name}</h5>
                        <p className="text-xs text-muted-foreground">
                          ${product.price} per {product.unit}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          value={product.quantity}
                          onChange={(e) => updateQuantity(product.id, parseInt(e.target.value) || 0)}
                          className="w-16 h-8 text-center"
                        />
                        <span className="text-sm font-medium">
                          ${(product.price * product.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center font-medium">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ReviewStep: React.FC<{
  stepData?: any;
  wizardData?: any;
}> = ({ wizardData = {} }) => {
  const { supplier, products } = wizardData;
  const total = products?.products?.reduce((sum: number, p: any) => sum + (p.price * p.quantity), 0) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Review Purchase Order</h3>
        <p className="text-muted-foreground">Please review your order details before submitting.</p>
      </div>

      <div className="grid gap-6">
        {/* Supplier Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supplier Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><strong>Name:</strong> {supplier?.supplierName || 'Not selected'}</p>
              <p><strong>Category:</strong> {supplier?.supplierCategory || 'N/A'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Products</CardTitle>
          </CardHeader>
          <CardContent>
            {products?.products?.length > 0 ? (
              <div className="space-y-3">
                {products.products.map((product: any) => (
                  <div key={product.id} className="flex justify-between items-center py-2 border-b last:border-b-0">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ${product.price} per {product.unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">Qty: {product.quantity}</p>
                      <p className="text-sm">${(product.price * product.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t">
                  <div className="flex justify-between items-center font-bold text-lg">
                    <span>Total:</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No products selected.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export function WizardDemo() {
  const [showWizard, setShowWizard] = useState(false);

  const wizardConfig = createWizardConfig(
    'purchase-order-wizard',
    'Create Purchase Order',
    [
      {
        id: 'welcome',
        title: 'Welcome',
        description: 'Get started with your purchase order',
        component: WelcomeStep,
        validation: (data) => data?.acknowledged === true,
      },
      {
        id: 'supplier',
        title: 'Select Supplier',
        description: 'Choose your supplier',
        component: SupplierStep,
        validation: (data) => !!data?.supplierId,
      },
      {
        id: 'products',
        title: 'Add Products',
        description: 'Select products and quantities',
        component: ProductsStep,
        validation: (data) => data?.products?.length > 0,
      },
      {
        id: 'review',
        title: 'Review & Submit',
        description: 'Review your order details',
        component: ReviewStep,
        validation: () => true,
      },
    ],
    {
      onComplete: async (data) => {
        console.log('Purchase order completed:', data);
        alert('Purchase order created successfully!');
        setShowWizard(false);
      },
      onCancel: () => {
        setShowWizard(false);
      },
      allowBackNavigation: true,
      persistState: true,
    }
  );

  if (!showWizard) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Wizard Demo</CardTitle>
            <CardDescription>
              Experience the wizard workflow system with this interactive purchase order example.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowWizard(true)} className="w-full">
              Start Purchase Order Wizard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <Wizard
        config={wizardConfig}
        showProgress={true}
        showNavigation={true}
        navigationVariant="full"
        stepVariant="full"
        animated={true}
        persistenceKey="purchase-order-demo"
        onComplete={(data) => {
          console.log('Wizard completed with data:', data);
          setShowWizard(false);
        }}
        onCancel={() => setShowWizard(false)}
      />
    </div>
  );
}

export default WizardDemo;