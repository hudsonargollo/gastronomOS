'use client';

/**
 * QR Menu Page
 * Customer-facing digital menu interface
 * Part of Digital Menu, Kitchen Orchestration & Payment System
 */

import React, { useState, useEffect } from 'react';
import { MenuCatalog, OrderCart, OrderSubmission } from '@/components/qr-menu';
import type { MenuItemData, CartItem, OrderSubmissionData } from '@/components/qr-menu';
import { useMenuAvailability } from '@/hooks/use-menu-availability';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

export default function QRMenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItemData[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);

  // Real-time availability hook
  const { availabilityMap, isConnected: isRealTimeConnected } = useMenuAvailability();

  // Load menu items and categories
  useEffect(() => {
    loadMenuData();
  }, []);

  const loadMenuData = async () => {
    try {
      setIsLoading(true);
      
      // Load categories
      const categoriesResponse = await apiClient.getCategories({ active: true });
      if (categoriesResponse.success && categoriesResponse.data.categories) {
        setCategories(categoriesResponse.data.categories);
      }

      // Load menu items
      const menuResponse = await apiClient.getMenuItems({ isAvailable: true });
      if (menuResponse.success && menuResponse.data.menuItems) {
        setMenuItems(menuResponse.data.menuItems);
      }
    } catch (error) {
      console.error('Error loading menu:', error);
      toast.error('Erro ao carregar o menu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemSelect = (item: MenuItemData, quantity: number) => {
    // Check real-time availability before adding to cart
    const realtimeAvailability = availabilityMap.get(item.id);
    const isAvailable = realtimeAvailability?.isAvailable ?? item.isAvailable;

    if (!isAvailable) {
      toast.error('Este item não está mais disponível');
      return;
    }

    const existingItem = cartItems.find(ci => ci.menuItemId === item.id);

    if (existingItem) {
      setCartItems(
        cartItems.map(ci =>
          ci.menuItemId === item.id
            ? { ...ci, quantity: ci.quantity + quantity }
            : ci
        )
      );
    } else {
      setCartItems([
        ...cartItems,
        {
          id: `cart-${Date.now()}`,
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity
        }
      ]);
    }

    toast.success(`${item.name} adicionado ao carrinho`);
  };

  const handleUpdateQuantity = (menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(menuItemId);
      return;
    }

    setCartItems(
      cartItems.map(item =>
        item.menuItemId === menuItemId ? { ...item, quantity } : item
      )
    );
  };

  const handleRemoveItem = (menuItemId: string) => {
    setCartItems(cartItems.filter(item => item.menuItemId !== menuItemId));
    toast.info('Item removido do carrinho');
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast.error('Adicione itens ao carrinho primeiro');
      return;
    }
    setShowCheckout(true);
  };

  const handleSubmitOrder = async (data: OrderSubmissionData) => {
    try {
      const orderData = {
        tableNumber: data.tableNumber,
        specialInstructions: data.specialInstructions,
        items: data.items.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions
        }))
      };

      const response = await apiClient.createOrder(orderData);

      if (response.success) {
        toast.success('Pedido enviado com sucesso!');
        setCartItems([]);
        setShowCheckout(false);
        
        // Show order confirmation
        toast.info(`Número do pedido: ${response.data.order.orderNumber}`);
      } else {
        throw new Error(response.error || 'Erro ao criar pedido');
      }
    } catch (error) {
      console.error('Error submitting order:', error);
      throw error;
    }
  };

  const totalAmount = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--token-surface-base)]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[var(--token-action-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--token-text-secondary)]">Carregando menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--token-surface-base)]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[var(--token-surface-elevated)] border-b border-[var(--token-border-subtle)] shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[var(--token-text-primary)]">
                Menu Digital
              </h1>
              <p className="text-sm text-[var(--token-text-secondary)]">
                Faça seu pedido
              </p>
            </div>
            
            {/* Cart Badge */}
            {cartItems.length > 0 && !showCheckout && (
              <button
                onClick={handleCheckout}
                className="relative p-3 rounded-full bg-[var(--token-action-primary)] text-white hover:opacity-90 transition-opacity"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <span className="absolute -top-1 -right-1 w-6 h-6 bg-[var(--token-status-error)] text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {showCheckout ? (
          <div className="max-w-2xl mx-auto">
            <OrderSubmission
              items={cartItems}
              totalAmount={totalAmount}
              onSubmit={handleSubmitOrder}
              onCancel={() => setShowCheckout(false)}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Menu Catalog */}
            <div className="lg:col-span-2">
              <MenuCatalog
                categories={categories.map(cat => ({
                  id: cat.id,
                  name: cat.name,
                  description: cat.description,
                  itemCount: menuItems.filter(item => item.categoryId === cat.id).length
                }))}
                items={menuItems}
                onItemSelect={handleItemSelect}
                availabilityMap={availabilityMap}
                isRealTimeConnected={isRealTimeConnected}
              />
            </div>

            {/* Order Cart - Sticky on desktop */}
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-24">
                <OrderCart
                  items={cartItems}
                  onUpdateQuantity={handleUpdateQuantity}
                  onRemoveItem={handleRemoveItem}
                  onCheckout={handleCheckout}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
