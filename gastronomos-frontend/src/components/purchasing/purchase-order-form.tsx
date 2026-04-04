'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReceiptScanner } from './receipt-scanner';
import {
  Plus,
  Trash2,
  Save,
  X,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';

interface PurchaseItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface PurchaseOrderFormProps {
  onSubmit?: (data: any) => void;
  initialData?: any;
}

export function PurchaseOrderForm({ onSubmit, initialData }: PurchaseOrderFormProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [supplier, setSupplier] = useState(initialData?.supplier || '');
  const [invoiceNumber, setInvoiceNumber] = useState(initialData?.invoiceNumber || '');
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<PurchaseItem[]>(initialData?.items || []);
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);

  const handleAddItem = () => {
    const newItem: PurchaseItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
    };
    setItems([...items, newItem]);
  };

  const handleUpdateItem = (id: string, field: string, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            updated.totalPrice = updated.quantity * updated.unitPrice;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleReceiptData = (data: any) => {
    if (data.supplier) setSupplier(data.supplier);
    if (data.invoiceNumber) setInvoiceNumber(data.invoiceNumber);
    if (data.date) setDate(data.date);
    if (data.items && data.items.length > 0) {
      const newItems = data.items.map((item: any) => ({
        id: Date.now().toString() + Math.random(),
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      }));
      setItems([...items, ...newItems]);
    }
    setShowScanner(false);
  };

  const handleSubmit = () => {
    if (!supplier || items.length === 0) {
      alert('Please fill in supplier and add at least one item');
      return;
    }

    const formData = {
      supplier,
      invoiceNumber,
      date,
      items,
      notes,
      totalAmount,
    };

    if (onSubmit) {
      onSubmit(formData);
    }
  };

  return (
    <div className="space-y-4">
      {/* Receipt Scanner */}
      <AnimatePresence>
        {showScanner && (
          <ReceiptScanner
            onDataExtracted={handleReceiptData}
            onClose={() => setShowScanner(false)}
          />
        )}
      </AnimatePresence>

      {/* Form Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Purchase Order Details</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowScanner(!showScanner)}
              className="text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              📸 Scan Receipt
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Supplier and Invoice Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Supplier *
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Enter supplier name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Invoice Number
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="NF-000001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">Items</h3>
              <Button
                onClick={handleAddItem}
                size="sm"
                variant="outline"
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="bg-slate-50 rounded-lg p-6 text-center">
                <AlertCircle className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-slate-600">No items added yet</p>
                <p className="text-sm text-slate-500">
                  Add items manually or scan a receipt to auto-fill
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => {
                          const newExpanded = new Set(expandedItems);
                          if (newExpanded.has(item.id)) {
                            newExpanded.delete(item.id);
                          } else {
                            newExpanded.add(item.id);
                          }
                          setExpandedItems(newExpanded);
                        }}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex-1 text-left">
                          <p className="font-medium text-slate-900 truncate">
                            {item.description || 'Untitled Item'}
                          </p>
                          <p className="text-sm text-slate-500">
                            {item.quantity} × R$ {item.unitPrice.toFixed(2)} = R${' '}
                            {item.totalPrice.toFixed(2)}
                          </p>
                        </div>
                        <ChevronDown
                          className={`h-5 w-5 text-slate-400 transition-transform ${
                            expandedItems.has(item.id) ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      <AnimatePresence>
                        {expandedItems.has(item.id) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-slate-200 bg-slate-50 p-4 space-y-3"
                          >
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">
                                Description
                              </label>
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) =>
                                  handleUpdateItem(item.id, 'description', e.target.value)
                                }
                                placeholder="Item description"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                              />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                  Quantity
                                </label>
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleUpdateItem(
                                      item.id,
                                      'quantity',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  min="0"
                                  step="0.01"
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                  Unit Price
                                </label>
                                <input
                                  type="number"
                                  value={item.unitPrice}
                                  onChange={(e) =>
                                    handleUpdateItem(
                                      item.id,
                                      'unitPrice',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  min="0"
                                  step="0.01"
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                  Total
                                </label>
                                <div className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium">
                                  R$ {item.totalPrice.toFixed(2)}
                                </div>
                              </div>
                            </div>

                            <Button
                              onClick={() => handleRemoveItem(item.id)}
                              variant="destructive"
                              size="sm"
                              className="w-full"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove Item
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Total and Submit */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between bg-orange-50 rounded-lg p-4">
              <span className="font-semibold text-slate-900">Total Amount:</span>
              <span className="text-2xl font-bold text-orange-600">
                R$ {totalAmount.toFixed(2)}
              </span>
            </div>

            <Button
              onClick={handleSubmit}
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Purchase Order
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
