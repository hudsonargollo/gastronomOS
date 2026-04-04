'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BentoBox, BentoItem } from '@/components/design-system/layouts/bento-box';
import { useTheme } from '@/contexts/theme-context';
import {
  Plus,
  Trash2,
  Save,
  X,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import { ReceiptScanner } from './receipt-scanner';

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
  const { palette } = useTheme();
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

  const inputStyle = {
    backgroundColor: palette.surface,
    color: palette.text,
    borderColor: palette.accent,
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

      {/* Form */}
      <BentoBox columns={3} gap="md">
        {/* Supplier Info */}
        <BentoItem span={2} variant="elevated">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ color: palette.text }}>
                Purchase Order Details
              </h3>
              <button
                onClick={() => setShowScanner(!showScanner)}
                className="px-3 py-1 rounded-lg text-sm font-medium transition-all hover:shadow-md"
                style={{
                  backgroundColor: `${palette.accent}20`,
                  color: palette.accent,
                }}
              >
                📸 Scan Receipt
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: palette.text }}>
                  Supplier *
                </label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Enter supplier name"
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-all"
                  style={{
                    ...inputStyle,
                    borderWidth: '1px',
                    focusRingColor: palette.accent,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: palette.text }}>
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="NF-000001"
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-all"
                  style={{
                    ...inputStyle,
                    borderWidth: '1px',
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: palette.text }}>
                  Date *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-all"
                  style={{
                    ...inputStyle,
                    borderWidth: '1px',
                  }}
                />
              </div>
            </div>
          </div>
        </BentoItem>

        {/* Items Section */}
        <BentoItem span={3} variant="elevated">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold" style={{ color: palette.text }}>
                Items
              </h3>
              <button
                onClick={handleAddItem}
                className="px-3 py-1 rounded-lg text-sm font-medium transition-all hover:shadow-md flex items-center space-x-1"
                style={{
                  backgroundColor: `${palette.primary}20`,
                  color: palette.primary,
                }}
              >
                <Plus className="h-4 w-4" />
                <span>Add Item</span>
              </button>
            </div>

            {items.length === 0 ? (
              <div
                className="rounded-lg p-6 text-center"
                style={{ backgroundColor: `${palette.accent}10` }}
              >
                <AlertCircle className="h-8 w-8 mx-auto mb-2" style={{ color: palette.accent }} />
                <p style={{ color: palette.text }} className="font-medium">
                  No items added yet
                </p>
                <p style={{ color: palette.textSecondary }} className="text-sm">
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
                    <div
                      className="rounded-lg overflow-hidden border"
                      style={{ borderColor: palette.accent }}
                    >
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
                        className="w-full px-4 py-3 flex items-center justify-between transition-colors"
                        style={{
                          backgroundColor: palette.surface,
                          color: palette.text,
                        }}
                      >
                        <div className="flex-1 text-left">
                          <p className="font-medium">
                            {item.description || 'Untitled Item'}
                          </p>
                          <p style={{ color: palette.textSecondary }} className="text-sm">
                            {item.quantity} × R$ {item.unitPrice.toFixed(2)} = R${' '}
                            {item.totalPrice.toFixed(2)}
                          </p>
                        </div>
                        <ChevronDown
                          className={`h-5 w-5 transition-transform ${
                            expandedItems.has(item.id) ? 'rotate-180' : ''
                          }`}
                          style={{ color: palette.textSecondary }}
                        />
                      </button>

                      <AnimatePresence>
                        {expandedItems.has(item.id) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="p-4 space-y-3"
                            style={{
                              backgroundColor: `${palette.accent}08`,
                              borderTopColor: palette.accent,
                              borderTopWidth: '1px',
                            }}
                          >
                            <div>
                              <label className="block text-sm font-medium mb-1" style={{ color: palette.text }}>
                                Description
                              </label>
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) =>
                                  handleUpdateItem(item.id, 'description', e.target.value)
                                }
                                placeholder="Item description"
                                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-all"
                                style={{
                                  ...inputStyle,
                                  borderWidth: '1px',
                                }}
                              />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: palette.text }}>
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
                                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-all"
                                  style={{
                                    ...inputStyle,
                                    borderWidth: '1px',
                                  }}
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: palette.text }}>
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
                                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-all"
                                  style={{
                                    ...inputStyle,
                                    borderWidth: '1px',
                                  }}
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: palette.text }}>
                                  Total
                                </label>
                                <div
                                  className="px-3 py-2 rounded-lg font-medium"
                                  style={{
                                    backgroundColor: palette.surface,
                                    color: palette.primary,
                                    border: `1px solid ${palette.accent}`,
                                  }}
                                >
                                  R$ {item.totalPrice.toFixed(2)}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="w-full px-3 py-2 rounded-lg font-medium transition-all hover:shadow-md flex items-center justify-center space-x-2"
                              style={{
                                backgroundColor: `${palette.accent}20`,
                                color: palette.accent,
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>Remove Item</span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </BentoItem>

        {/* Notes */}
        <BentoItem span={2} variant="elevated">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: palette.text }}>
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-all resize-none"
              style={{
                ...inputStyle,
                borderWidth: '1px',
              }}
            />
          </div>
        </BentoItem>

        {/* Total */}
        <BentoItem span={1} variant="elevated">
          <div className="space-y-2">
            <p style={{ color: palette.textSecondary }} className="text-sm font-medium">
              Total Amount
            </p>
            <p
              className="text-2xl font-bold"
              style={{ color: palette.primary }}
            >
              R$ {totalAmount.toFixed(2)}
            </p>
          </div>
        </BentoItem>

        {/* Submit Button */}
        <BentoItem span={3} variant="elevated">
          <button
            onClick={handleSubmit}
            className="w-full px-4 py-3 rounded-lg font-semibold transition-all hover:shadow-lg flex items-center justify-center space-x-2"
            style={{
              backgroundColor: palette.primary,
              color: palette.surface,
            }}
          >
            <Save className="h-5 w-5" />
            <span>Save Purchase Order</span>
          </button>
        </BentoItem>
      </BentoBox>
    </div>
  );
}
