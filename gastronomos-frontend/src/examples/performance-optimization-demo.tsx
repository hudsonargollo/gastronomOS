/**
 * Performance Optimization Demo
 * Demonstrates all performance optimization features
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  VirtualizedList,
  VirtualizedTable,
  LazyLoadingProvider,
  LazyImage,
  MemoryManager,
  MemoryUsageDisplay,
  PerformanceMonitor,
  usePerformanceMonitoring,
  useLazyLoading,
  useMemoryManager,
  useComponentCleanup,
  useCacheCleanup,
  useAnimationCleanup,
} from '@/components/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Sample data generators
const generateLargeDataset = (size: number) => {
  return Array.from({ length: size }, (_, index) => ({
    id: index,
    name: `Item ${index + 1}`,
    description: `This is a description for item ${index + 1}`,
    value: Math.floor(Math.random() * 1000),
    category: ['Category A', 'Category B', 'Category C'][index % 3],
    imageUrl: `https://picsum.photos/200/150?random=${index}`,
  }));
};

const generateImageUrls = (count: number) => {
  return Array.from({ length: count }, (_, index) => 
    `https://picsum.photos/300/200?random=${index + 100}`
  );
};

export function PerformanceOptimizationDemo() {
  const [datasetSize, setDatasetSize] = useState(1000);
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(true);
  const [memoryPressureTest, setMemoryPressureTest] = useState(false);

  // Generate large dataset
  const largeDataset = useMemo(() => generateLargeDataset(datasetSize), [datasetSize]);
  const imageUrls = useMemo(() => generateImageUrls(50), []);

  // Performance monitoring
  const { currentMetrics, isOptimal } = usePerformanceMonitoring({
    onPerformanceIssue: (metrics) => {
      console.warn('Performance issue in demo:', metrics);
    },
  });

  // Memory pressure test
  useEffect(() => {
    if (!memoryPressureTest) return;

    const interval = setInterval(() => {
      // Create memory pressure by generating large arrays
      const largeArray = new Array(100000).fill(0).map(() => ({
        data: Math.random().toString(36),
        timestamp: Date.now(),
      }));
      
      // Keep reference briefly then release
      setTimeout(() => {
        largeArray.length = 0;
      }, 1000);
    }, 2000);

    return () => clearInterval(interval);
  }, [memoryPressureTest]);

  return (
    <LazyLoadingProvider>
      <MemoryManager
        config={{
          maxMemoryUsage: 150,
          enableAutoCleanup: true,
          warningThreshold: 80,
        }}
        onMemoryWarning={(usage) => {
          console.warn('Memory warning:', usage);
        }}
        onMemoryCritical={(usage) => {
          console.error('Critical memory usage:', usage);
        }}
      >
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Performance Optimization Demo</h1>
              <p className="text-gray-600 mt-2">
                Showcasing virtualization, lazy loading, memory management, and performance monitoring
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <Badge variant={isOptimal ? 'default' : 'destructive'}>
                {isOptimal ? 'Optimal Performance' : 'Performance Issues'}
              </Badge>
              <Button
                variant="outline"
                onClick={() => setShowPerformanceMonitor(!showPerformanceMonitor)}
              >
                {showPerformanceMonitor ? 'Hide' : 'Show'} Monitor
              </Button>
            </div>
          </div>

          {/* Performance Monitor */}
          <PerformanceMonitor
            visible={showPerformanceMonitor}
            position="top-right"
            showHistory={true}
            onPerformanceIssue={(metrics) => {
              console.log('Performance metrics:', metrics);
            }}
          />

          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Demo Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Dataset Size:</label>
                <select
                  value={datasetSize}
                  onChange={(e) => setDatasetSize(Number(e.target.value))}
                  className="px-3 py-1 border rounded"
                >
                  <option value={100}>100 items</option>
                  <option value={1000}>1,000 items</option>
                  <option value={5000}>5,000 items</option>
                  <option value={10000}>10,000 items</option>
                  <option value={50000}>50,000 items</option>
                </select>
              </div>

              <div className="flex items-center gap-4">
                <Button
                  variant={memoryPressureTest ? 'destructive' : 'outline'}
                  onClick={() => setMemoryPressureTest(!memoryPressureTest)}
                >
                  {memoryPressureTest ? 'Stop' : 'Start'} Memory Pressure Test
                </Button>
                <MemoryUsageDisplay showDetails={true} />
              </div>
            </CardContent>
          </Card>

          {/* Demo Tabs */}
          <Tabs defaultValue="virtualization" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="virtualization">Virtualization</TabsTrigger>
              <TabsTrigger value="lazy-loading">Lazy Loading</TabsTrigger>
              <TabsTrigger value="memory-management">Memory Management</TabsTrigger>
              <TabsTrigger value="performance-monitoring">Performance Monitoring</TabsTrigger>
            </TabsList>

            {/* Virtualization Demo */}
            <TabsContent value="virtualization" className="space-y-4">
              <VirtualizationDemo dataset={largeDataset} />
            </TabsContent>

            {/* Lazy Loading Demo */}
            <TabsContent value="lazy-loading" className="space-y-4">
              <LazyLoadingDemo imageUrls={imageUrls} />
            </TabsContent>

            {/* Memory Management Demo */}
            <TabsContent value="memory-management" className="space-y-4">
              <MemoryManagementDemo />
            </TabsContent>

            {/* Performance Monitoring Demo */}
            <TabsContent value="performance-monitoring" className="space-y-4">
              <PerformanceMonitoringDemo currentMetrics={currentMetrics} />
            </TabsContent>
          </Tabs>
        </div>
      </MemoryManager>
    </LazyLoadingProvider>
  );
}

// Virtualization Demo Component
function VirtualizationDemo({ dataset }: { dataset: any[] }) {
  const [viewType, setViewType] = useState<'list' | 'table'>('list');

  const renderListItem = (item: any, index: number) => (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-4 p-4 border-b hover:bg-gray-50"
    >
      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
        {item.id}
      </div>
      <div className="flex-1">
        <h3 className="font-medium">{item.name}</h3>
        <p className="text-sm text-gray-600">{item.description}</p>
      </div>
      <Badge>{item.category}</Badge>
      <span className="font-mono text-sm">${item.value}</span>
    </motion.div>
  );

  const tableColumns = [
    { key: 'id', title: 'ID', width: 80 },
    { key: 'name', title: 'Name', width: 200 },
    { key: 'description', title: 'Description' },
    { key: 'category', title: 'Category', width: 120 },
    { key: 'value', title: 'Value', width: 100, render: (item: any) => `$${item.value}` },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Virtualized Rendering ({dataset.length.toLocaleString()} items)</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={viewType === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewType('list')}
              >
                List View
              </Button>
              <Button
                variant={viewType === 'table' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewType('table')}
              >
                Table View
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewType === 'list' ? (
            <VirtualizedList
              items={dataset}
              itemHeight={80}
              containerHeight={400}
              renderItem={renderListItem}
              keyExtractor={(item) => item.id}
              className="border rounded"
            />
          ) : (
            <VirtualizedTable
              items={dataset}
              columns={tableColumns}
              containerHeight={400}
              keyExtractor={(item) => item.id}
              onRowClick={(item) => console.log('Clicked:', item)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Lazy Loading Demo Component
function LazyLoadingDemo({ imageUrls }: { imageUrls: string[] }) {
  const { preloadAsset, getAssetState } = useLazyLoading();
  const [preloadEnabled, setPreloadEnabled] = useState(false);

  const handlePreloadAll = () => {
    imageUrls.forEach(url => preloadAsset(url, 'image'));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lazy Loading Images ({imageUrls.length} images)</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreloadAll}
              >
                Preload All
              </Button>
              <Button
                variant={preloadEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreloadEnabled(!preloadEnabled)}
              >
                Auto Preload: {preloadEnabled ? 'On' : 'Off'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
            {imageUrls.map((url, index) => {
              const assetState = getAssetState(url);
              return (
                <div key={index} className="relative">
                  <LazyImage
                    src={url}
                    alt={`Demo image ${index + 1}`}
                    className="w-full h-32 rounded"
                    preload={preloadEnabled}
                    placeholder={
                      <div className="w-full h-32 bg-gray-200 rounded flex items-center justify-center">
                        <span className="text-gray-500 text-sm">Loading...</span>
                      </div>
                    }
                    errorComponent={
                      <div className="w-full h-32 bg-red-100 rounded flex items-center justify-center">
                        <span className="text-red-500 text-sm">Error</span>
                      </div>
                    }
                  />
                  <div className="absolute top-2 right-2">
                    <Badge variant={assetState.loaded ? 'default' : assetState.loading ? 'secondary' : 'outline'}>
                      {assetState.loaded ? '✓' : assetState.loading ? '...' : '○'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Memory Management Demo Component
function MemoryManagementDemo() {
  const { memoryUsage, forceCleanup, isMemoryPressure } = useMemoryManager();
  const [cacheSize, setCacheSize] = useState(0);
  const [animationCount, setAnimationCount] = useState(0);

  // Demo cache for cleanup testing
  const demoCache = useMemo(() => new Map<string, any>(), []);
  useCacheCleanup(demoCache, 50, { priority: 2 });

  // Demo animation cleanup
  const { addAnimationFrame, removeAnimationFrame } = useAnimationCleanup();

  // Component cleanup demo
  useComponentCleanup(
    () => {
      console.log('Demo component cleanup executed');
    },
    [],
    { priority: 1, description: 'Demo component cleanup' }
  );

  const addToCacheDemo = () => {
    const key = `item-${Date.now()}`;
    demoCache.set(key, { data: new Array(1000).fill(0), timestamp: Date.now() });
    setCacheSize(demoCache.size);
  };

  const startAnimationDemo = () => {
    const animate = () => {
      const id = requestAnimationFrame(animate);
      addAnimationFrame(id);
      setAnimationCount(prev => prev + 1);
      
      // Stop after 100 frames
      if (animationCount > 100) {
        removeAnimationFrame(id);
        setAnimationCount(0);
      }
    };
    animate();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Memory Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-medium">Memory Usage</h3>
              <MemoryUsageDisplay showDetails={true} />
              {isMemoryPressure && (
                <Badge variant="destructive">Memory Pressure Detected</Badge>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Cleanup Controls</h3>
              <div className="space-y-2">
                <Button onClick={forceCleanup} variant="outline" size="sm">
                  Force Cleanup
                </Button>
                <div className="text-sm text-gray-600">
                  Current cache size: {cacheSize} items
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-medium">Cache Demo</h3>
              <Button onClick={addToCacheDemo} variant="outline" size="sm">
                Add to Cache
              </Button>
              <div className="text-sm text-gray-600">
                Cache will auto-cleanup when it exceeds 50 items
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Animation Demo</h3>
              <Button onClick={startAnimationDemo} variant="outline" size="sm">
                Start Animation Test
              </Button>
              <div className="text-sm text-gray-600">
                Active animations: {animationCount}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Performance Monitoring Demo Component
function PerformanceMonitoringDemo({ currentMetrics }: { currentMetrics: any }) {
  const [stressTest, setStressTest] = useState(false);

  useEffect(() => {
    if (!stressTest) return;

    const interval = setInterval(() => {
      // Create CPU stress
      const start = Date.now();
      while (Date.now() - start < 50) {
        Math.random();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [stressTest]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Performance Monitoring</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-medium">Current Metrics</h3>
              {currentMetrics ? (
                <div className="space-y-1 text-sm">
                  <div>FPS: {Math.round(currentMetrics.fps)}</div>
                  <div>Memory: {Math.round(currentMetrics.memoryUsage)}MB</div>
                  <div>Render Time: {Math.round(currentMetrics.renderTime)}ms</div>
                  <div>Components: {currentMetrics.componentCount}</div>
                  <div>Animations: {currentMetrics.animationCount}</div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">No metrics available</div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Stress Test</h3>
              <Button
                onClick={() => setStressTest(!stressTest)}
                variant={stressTest ? 'destructive' : 'outline'}
                size="sm"
              >
                {stressTest ? 'Stop' : 'Start'} CPU Stress Test
              </Button>
              <div className="text-sm text-gray-600">
                This will intentionally degrade performance to test monitoring
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            <p>
              Use Ctrl/Cmd + Shift + P to toggle the performance monitor overlay.
              Use Ctrl/Cmd + Shift + H to toggle performance history charts.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}