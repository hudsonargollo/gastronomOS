/**
 * Animation System Demo
 * Demonstrates the enhanced animation system functionality
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedPage, DashboardPage, FormPage, ListPage } from '@/components/ui/animated-page';
import { PerformanceMonitor } from '@/components/ui/performance-monitor';
import { useAnimation, useAnimationConfig, useReducedMotion } from '@/contexts/animation-context';
import { useAnimationPerformance, useFrameRate } from '@/hooks/use-animation-performance';
import { 
  fadeInOut, 
  slideInFromRight, 
  buttonVariants, 
  cardVariants,
  staggerContainer,
  listItemVariants,
  transitions 
} from '@/lib/animation-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function AnimationDemo() {
  const [currentDemo, setCurrentDemo] = useState<'page' | 'list' | 'cards' | 'performance'>('page');
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const [items, setItems] = useState([1, 2, 3, 4, 5]);
  
  const { config, updateConfig } = useAnimationConfig();
  const { performance, isPerformanceGood } = useAnimationPerformance();
  const { frameRate, isLowFrameRate } = useFrameRate();
  const reducedMotion = useReducedMotion();

  const addItem = () => {
    setItems(prev => [...prev, Math.max(...prev) + 1]);
  };

  const removeItem = (id: number) => {
    setItems(prev => prev.filter(item => item !== id));
  };

  const togglePerformanceMode = () => {
    const newMode = config.performanceMode === 'high' ? 'low' : 'high';
    updateConfig({ performanceMode: newMode });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Enhanced Animation System Demo
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Demonstrating Framer Motion integration with performance monitoring
          </p>
          
          {/* Performance Status */}
          <div className="flex justify-center gap-4 mb-6">
            <Badge variant={isPerformanceGood ? 'default' : 'destructive'}>
              Performance: {isPerformanceGood ? 'Good' : 'Issues'}
            </Badge>
            <Badge variant={isLowFrameRate ? 'destructive' : 'default'}>
              FPS: {Math.round(frameRate)}
            </Badge>
            <Badge variant={reducedMotion ? 'secondary' : 'default'}>
              Motion: {reducedMotion ? 'Reduced' : 'Full'}
            </Badge>
            <Badge variant="outline">
              Mode: {config.performanceMode}
            </Badge>
          </div>
        </motion.div>

        {/* Demo Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center gap-4 flex-wrap"
        >
          <Button
            variant={currentDemo === 'page' ? 'default' : 'outline'}
            onClick={() => setCurrentDemo('page')}
          >
            Page Transitions
          </Button>
          <Button
            variant={currentDemo === 'list' ? 'default' : 'outline'}
            onClick={() => setCurrentDemo('list')}
          >
            List Animations
          </Button>
          <Button
            variant={currentDemo === 'cards' ? 'default' : 'outline'}
            onClick={() => setCurrentDemo('cards')}
          >
            Card Interactions
          </Button>
          <Button
            variant={currentDemo === 'performance' ? 'default' : 'outline'}
            onClick={() => setCurrentDemo('performance')}
          >
            Performance Monitor
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowPerformanceMonitor(!showPerformanceMonitor)}
          >
            {showPerformanceMonitor ? 'Hide' : 'Show'} Performance
          </Button>
          <Button
            variant="secondary"
            onClick={togglePerformanceMode}
          >
            Toggle Performance Mode
          </Button>
        </motion.div>

        {/* Demo Content */}
        <AnimatePresence mode="wait">
          {currentDemo === 'page' && (
            <PageTransitionDemo key="page" />
          )}
          {currentDemo === 'list' && (
            <ListAnimationDemo 
              key="list" 
              items={items}
              onAddItem={addItem}
              onRemoveItem={removeItem}
            />
          )}
          {currentDemo === 'cards' && (
            <CardInteractionDemo key="cards" />
          )}
          {currentDemo === 'performance' && (
            <PerformanceDemo key="performance" performance={performance} />
          )}
        </AnimatePresence>
      </div>

      {/* Performance Monitor */}
      <PerformanceMonitor 
        visible={showPerformanceMonitor}
        position="top-right"
      />
    </div>
  );
}

function PageTransitionDemo() {
  const [pageType, setPageType] = useState<'dashboard' | 'form' | 'list'>('dashboard');

  return (
    <motion.div
      variants={fadeInOut}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Page Transition Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button
              variant={pageType === 'dashboard' ? 'default' : 'outline'}
              onClick={() => setPageType('dashboard')}
            >
              Dashboard Page
            </Button>
            <Button
              variant={pageType === 'form' ? 'default' : 'outline'}
              onClick={() => setPageType('form')}
            >
              Form Page
            </Button>
            <Button
              variant={pageType === 'list' ? 'default' : 'outline'}
              onClick={() => setPageType('list')}
            >
              List Page
            </Button>
          </div>

          <div className="h-64 border rounded-lg overflow-hidden">
            <AnimatePresence mode="wait">
              {pageType === 'dashboard' && (
                <DashboardPage key="dashboard" className="p-6">
                  <div className="text-center">
                    <h3 className="text-xl font-semibold mb-2">Dashboard Page</h3>
                    <p className="text-gray-600">Smooth scaling animation for dashboard content</p>
                  </div>
                </DashboardPage>
              )}
              {pageType === 'form' && (
                <FormPage key="form" className="p-6">
                  <div className="text-center">
                    <h3 className="text-xl font-semibold mb-2">Form Page</h3>
                    <p className="text-gray-600">Slide animation for form content</p>
                  </div>
                </FormPage>
              )}
              {pageType === 'list' && (
                <ListPage key="list" className="p-6">
                  <div className="text-center">
                    <h3 className="text-xl font-semibold mb-2">List Page</h3>
                    <p className="text-gray-600">Vertical slide animation for list content</p>
                  </div>
                </ListPage>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ListAnimationDemo({ items, onAddItem, onRemoveItem }: {
  items: number[];
  onAddItem: () => void;
  onRemoveItem: (id: number) => void;
}) {
  return (
    <motion.div
      variants={slideInFromRight}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>List Animation Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={onAddItem}>Add Item</Button>
          
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="space-y-2"
          >
            <AnimatePresence>
              {items.map((item) => (
                <motion.div
                  key={item}
                  variants={listItemVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  layout
                  className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border"
                >
                  <span>Item {item}</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onRemoveItem(item)}
                  >
                    Remove
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CardInteractionDemo() {
  return (
    <motion.div
      variants={fadeInOut}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Interactive Card Demo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <motion.div
                key={item}
                variants={cardVariants}
                initial="initial"
                whileHover="hover"
                className="cursor-pointer"
              >
                <Card className="h-32">
                  <CardContent className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <h4 className="font-semibold">Card {item}</h4>
                      <p className="text-sm text-gray-600">Hover me!</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PerformanceDemo({ performance }: { performance: any }) {
  return (
    <motion.div
      variants={fadeInOut}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Performance Monitoring Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900">Frame Rate</h4>
              <p className="text-2xl font-bold text-blue-600">{Math.round(performance.fps)} FPS</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <h4 className="font-semibold text-green-900">Frame Drops</h4>
              <p className="text-2xl font-bold text-green-600">{performance.frameDrops}</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <h4 className="font-semibold text-purple-900">Memory Usage</h4>
              <p className="text-2xl font-bold text-purple-600">{Math.round(performance.memoryUsage)}MB</p>
            </div>
          </div>
          
          <div className="text-sm text-gray-600">
            <p>• Performance monitoring tracks frame rate and memory usage in real-time</p>
            <p>• Animation system automatically adjusts based on performance metrics</p>
            <p>• Use Ctrl/Cmd + Shift + P to toggle the performance monitor overlay</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}