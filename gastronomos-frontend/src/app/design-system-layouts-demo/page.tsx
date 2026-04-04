'use client';

/**
 * Layout Components Demo Page
 * Showcases all Adaptive Gastronomy layout components
 */

import React, { useState } from 'react';
import {
  BentoBox,
  BentoItem,
  FloatingStack,
  StackItem,
  AsymmetricCard,
  CardHeader,
  CardContent,
  CardFooter,
  InsumosBar,
  StatusRibbon,
  CommissionTicker,
  CommissionTickerCompact,
} from '@/components/design-system/layouts';

export default function LayoutsDemoPage() {
  const [activeTab, setActiveTab] = useState('bento');
  const [currentCommission, setCurrentCommission] = useState(245.50);

  // Sample data
  const ingredients = [
    { id: '1', name: 'Tomate', quantity: 2, unit: 'un', color: '#ef4444' },
    { id: '2', name: 'Alface', quantity: 100, unit: 'g', color: '#22c55e' },
    { id: '3', name: 'Queijo', quantity: 50, unit: 'g', color: '#f59e0b' },
    { id: '4', name: 'Pão', quantity: 1, unit: 'un', color: '#a16207' },
  ];

  const orderSteps = [
    { 
      id: '1', 
      label: 'Pedido Recebido', 
      description: 'Aguardando preparo',
      timestamp: new Date(Date.now() - 600000)
    },
    { 
      id: '2', 
      label: 'Em Preparo', 
      description: 'Cozinha trabalhando',
      timestamp: new Date(Date.now() - 300000)
    },
    { 
      id: '3', 
      label: 'Pronto', 
      description: 'Aguardando entrega'
    },
    { 
      id: '4', 
      label: 'Entregue', 
      description: 'Pedido finalizado'
    },
  ];

  const recentEarnings = [
    { id: '1', amount: 12.50, timestamp: new Date(Date.now() - 120000), orderNumber: '1234' },
    { id: '2', amount: 8.75, timestamp: new Date(Date.now() - 240000), orderNumber: '1233' },
    { id: '3', amount: 15.00, timestamp: new Date(Date.now() - 360000), orderNumber: '1232' },
  ];

  return (
    <div className="min-h-screen bg-[var(--token-surface-base)] p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[var(--token-text-primary)] mb-2">
            Layout Components Demo
          </h1>
          <p className="text-[var(--token-text-secondary)]">
            Adaptive Gastronomy Design System - Non-Grid Grid Layout System
          </p>
        </div>

        {/* Navigation */}
        <FloatingStack>
          <StackItem active={activeTab === 'bento'} onClick={() => setActiveTab('bento')}>
            Bento Box
          </StackItem>
          <StackItem active={activeTab === 'stack'} onClick={() => setActiveTab('stack')}>
            Floating Stack
          </StackItem>
          <StackItem active={activeTab === 'cards'} onClick={() => setActiveTab('cards')}>
            Asymmetric Cards
          </StackItem>
          <StackItem active={activeTab === 'insumos'} onClick={() => setActiveTab('insumos')}>
            Insumos Bar
          </StackItem>
          <StackItem active={activeTab === 'ribbon'} onClick={() => setActiveTab('ribbon')}>
            Status Ribbon
          </StackItem>
          <StackItem active={activeTab === 'ticker'} onClick={() => setActiveTab('ticker')}>
            Commission Ticker
          </StackItem>
        </FloatingStack>

        {/* Bento Box Demo */}
        {activeTab === 'bento' && (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-[var(--token-text-primary)]">
              Bento Box Layout
            </h2>
            <p className="text-[var(--token-text-secondary)] mb-4">
              Dashboard layout with asymmetric grid cells
            </p>
            
            <BentoBox columns={4} gap="md">
              <BentoItem span={2} rowSpan={2} variant="elevated">
                <h3 className="text-lg font-bold mb-2">Featured Item</h3>
                <p className="text-sm text-[var(--token-text-secondary)]">
                  This is a large featured item spanning 2 columns and 2 rows
                </p>
              </BentoItem>
              
              <BentoItem span={1} variant="default">
                <h3 className="text-sm font-bold mb-1">Small Item</h3>
                <p className="text-xs text-[var(--token-text-secondary)]">
                  Single cell
                </p>
              </BentoItem>
              
              <BentoItem span={1} variant="outlined">
                <h3 className="text-sm font-bold mb-1">Outlined</h3>
                <p className="text-xs text-[var(--token-text-secondary)]">
                  Outlined style
                </p>
              </BentoItem>
              
              <BentoItem span={2} variant="default">
                <h3 className="text-sm font-bold mb-1">Wide Item</h3>
                <p className="text-xs text-[var(--token-text-secondary)]">
                  Spans 2 columns
                </p>
              </BentoItem>
              
              <BentoItem span={1} variant="elevated">
                <h3 className="text-sm font-bold mb-1">Stats</h3>
                <p className="text-2xl font-bold text-[var(--token-action-primary)]">
                  42
                </p>
              </BentoItem>
              
              <BentoItem span={1} variant="elevated">
                <h3 className="text-sm font-bold mb-1">Orders</h3>
                <p className="text-2xl font-bold text-[var(--token-action-primary)]">
                  128
                </p>
              </BentoItem>
              
              <BentoItem span={2} variant="default">
                <h3 className="text-sm font-bold mb-1">Revenue</h3>
                <p className="text-2xl font-bold text-[var(--token-status-success)]">
                  R$ 3,450.00
                </p>
              </BentoItem>
            </BentoBox>
          </section>
        )}

        {/* Floating Stack Demo */}
        {activeTab === 'stack' && (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-[var(--token-text-primary)]">
              Floating Stack
            </h2>
            <p className="text-[var(--token-text-secondary)] mb-4">
              Layered navigation for menus
            </p>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-2">Horizontal Stack</h3>
                <FloatingStack orientation="horizontal">
                  <StackItem active>Entradas</StackItem>
                  <StackItem badge={5}>Pratos Principais</StackItem>
                  <StackItem>Sobremesas</StackItem>
                  <StackItem badge="3">Bebidas</StackItem>
                </FloatingStack>
              </div>
              
              <div>
                <h3 className="text-sm font-semibold mb-2">Vertical Stack</h3>
                <FloatingStack orientation="vertical" className="w-64">
                  <StackItem active>Dashboard</StackItem>
                  <StackItem badge={12}>Pedidos</StackItem>
                  <StackItem>Cardápio</StackItem>
                  <StackItem>Relatórios</StackItem>
                  <StackItem>Configurações</StackItem>
                </FloatingStack>
              </div>
            </div>
          </section>
        )}

        {/* Asymmetric Cards Demo */}
        {activeTab === 'cards' && (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-[var(--token-text-primary)]">
              Asymmetric Cards
            </h2>
            <p className="text-[var(--token-text-secondary)] mb-4">
              Non-uniform content display cards
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <AsymmetricCard 
                variant="featured"
                imagePosition="top"
                image="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400"
                imageAlt="Food"
              >
                <CardHeader>
                  <h3 className="text-lg font-bold">Featured Dish</h3>
                </CardHeader>
                <CardContent>
                  <p>Delicious meal with fresh ingredients</p>
                </CardContent>
                <CardFooter>
                  <span className="text-lg font-bold text-[var(--token-action-primary)]">
                    R$ 45.00
                  </span>
                </CardFooter>
              </AsymmetricCard>
              
              <AsymmetricCard 
                variant="default"
                imagePosition="left"
                image="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400"
                imageAlt="Pizza"
              >
                <CardHeader>
                  <h3 className="text-lg font-bold">Pizza Margherita</h3>
                </CardHeader>
                <CardContent>
                  <p>Classic Italian pizza</p>
                </CardContent>
                <CardFooter>
                  <span className="text-lg font-bold text-[var(--token-action-primary)]">
                    R$ 38.00
                  </span>
                </CardFooter>
              </AsymmetricCard>
              
              <AsymmetricCard variant="compact">
                <CardHeader>
                  <h3 className="text-base font-bold">Simple Card</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-xs">No image, compact variant</p>
                </CardContent>
              </AsymmetricCard>
              
              <AsymmetricCard 
                variant="default"
                imagePosition="right"
                image="https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400"
                imageAlt="Pasta"
              >
                <CardHeader>
                  <h3 className="text-lg font-bold">Pasta Carbonara</h3>
                </CardHeader>
                <CardContent>
                  <p>Creamy Italian pasta</p>
                </CardContent>
                <CardFooter>
                  <span className="text-lg font-bold text-[var(--token-action-primary)]">
                    R$ 42.00
                  </span>
                </CardFooter>
              </AsymmetricCard>
            </div>
          </section>
        )}

        {/* Insumos Bar Demo */}
        {activeTab === 'insumos' && (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-[var(--token-text-primary)]">
              Horizontal Insumos Bar
            </h2>
            <p className="text-[var(--token-text-secondary)] mb-4">
              Ingredient breakdown visualization
            </p>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-2">Default Variant</h3>
                <InsumosBar ingredients={ingredients} variant="default" />
              </div>
              
              <div>
                <h3 className="text-sm font-semibold mb-2">Compact Variant</h3>
                <InsumosBar ingredients={ingredients} variant="compact" />
              </div>
              
              <div>
                <h3 className="text-sm font-semibold mb-2">Detailed Variant</h3>
                <InsumosBar ingredients={ingredients} variant="detailed" />
              </div>
              
              <div>
                <h3 className="text-sm font-semibold mb-2">Without Quantities</h3>
                <InsumosBar ingredients={ingredients} showQuantities={false} />
              </div>
            </div>
          </section>
        )}

        {/* Status Ribbon Demo */}
        {activeTab === 'ribbon' && (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-[var(--token-text-primary)]">
              Vertical Status Ribbon
            </h2>
            <p className="text-[var(--token-text-secondary)] mb-4">
              Order workflow status visualization
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold mb-2">Vertical Ribbon</h3>
                <StatusRibbon 
                  steps={orderSteps} 
                  currentStep={1}
                  variant="default"
                  orientation="vertical"
                />
              </div>
              
              <div>
                <h3 className="text-sm font-semibold mb-2">Detailed Variant</h3>
                <StatusRibbon 
                  steps={orderSteps} 
                  currentStep={2}
                  variant="detailed"
                  orientation="vertical"
                />
              </div>
              
              <div className="col-span-2">
                <h3 className="text-sm font-semibold mb-2">Horizontal Ribbon</h3>
                <StatusRibbon 
                  steps={orderSteps} 
                  currentStep={1}
                  variant="default"
                  orientation="horizontal"
                />
              </div>
            </div>
          </section>
        )}

        {/* Commission Ticker Demo */}
        {activeTab === 'ticker' && (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-[var(--token-text-primary)]">
              Live Commission Ticker
            </h2>
            <p className="text-[var(--token-text-secondary)] mb-4">
              Real-time earnings display
            </p>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-2">Default Variant</h3>
                <CommissionTicker 
                  currentCommission={currentCommission}
                  targetCommission={500}
                  variant="default"
                  showProgress
                />
              </div>
              
              <div>
                <h3 className="text-sm font-semibold mb-2">Detailed Variant with Recent Earnings</h3>
                <CommissionTicker 
                  currentCommission={currentCommission}
                  targetCommission={500}
                  variant="detailed"
                  showProgress
                  recentEarnings={recentEarnings}
                />
              </div>
              
              <div>
                <h3 className="text-sm font-semibold mb-2">Compact Variant</h3>
                <CommissionTicker 
                  currentCommission={currentCommission}
                  variant="compact"
                />
              </div>
              
              <div>
                <h3 className="text-sm font-semibold mb-2">Compact Ticker (for headers)</h3>
                <CommissionTickerCompact currentCommission={currentCommission} />
              </div>
              
              <div className="mt-4">
                <button
                  onClick={() => setCurrentCommission(prev => prev + 12.50)}
                  className="px-4 py-2 bg-[var(--token-action-primary)] text-white rounded-lg hover:opacity-90"
                >
                  Simulate New Commission (+R$ 12.50)
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
