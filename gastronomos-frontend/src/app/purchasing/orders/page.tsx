'use client';

import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { PurchaseOrderForm } from '@/components/purchasing/purchase-order-form';
import { useTheme } from '@/contexts/theme-context';
import { useTranslations } from '@/hooks/use-translations';
import { motion } from 'framer-motion';

export default function PurchaseOrdersPage() {
  const { palette } = useTheme();
  const { t } = useTranslations();
  const [orders, setOrders] = useState<any[]>([]);

  const handleSubmitOrder = async (formData: any) => {
    try {
      const response = await fetch('/api/purchasing/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const newOrder = await response.json();
        setOrders([newOrder, ...orders]);
        alert('Purchase order saved successfully!');
      } else {
        alert('Failed to save purchase order');
      }
    } catch (error) {
      console.error('Error saving order:', error);
      alert('Error saving purchase order');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold" style={{ color: palette.text }}>
            {t('navigation.purchaseOrders')}
          </h1>
          <p className="mt-1" style={{ color: palette.textSecondary }}>
            Create and manage purchase orders with automatic receipt scanning
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <PurchaseOrderForm onSubmit={handleSubmitOrder} />
        </motion.div>
      </div>
    </MainLayout>
  );
}
