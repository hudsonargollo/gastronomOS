/**
 * Comprehensive UI Workflow Demo
 * Demonstrates all enhanced UI workflow features in a single comprehensive example
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  AnimatedPage,
  AnimatedList,
  AnimatedModal,
  Spinner,
  PulsingDots,
  AnimatedProgress,
  Skeleton,
  CardSkeleton,
  TableSkeleton,
  LoadingOverlay,
  LoadingButton,
  PulseLoader,
  PerformanceMonitor,
  MemoryManager,
  LazyLoadingProvider,
} from '@/components/ui';
import { 
  Wizard,
  createWizardConfig,
  AnimatedCRUDTable,
  EnhancedModalForm,
} from '@/components/ui';
import { useAnimationPerformance } from '@/hooks/use-animation-performance';
import { useEnhancedCRUD } from '@/hooks/use-crud';
import { FormFieldConfig } from '@/hooks/use-enhanced-form-validation';
import { fadeInOut, staggerContainer, slideInFromRight } from '@/lib/animation-utils';
import { 
  Zap, 
  Database, 
  Workflow, 
  BarChart3, 
  Settings, 
  Play, 
  Pause,
  RefreshCw,
  Monitor,
  Cpu,
  HardDrive,
} from 'lucide-react';

// Mock data types
interface DemoItem {
  id: string;
  name: string;
  category: string;
  status: 'active' | 'inactive' | 'pending';
  value: number;
  description: string;
  createdAt: string;
}

// Demo configuration
const DEMO_SECTIONS = [
  {
    id: 'animations',
    title: 'Animation System',
    description: 'Smooth transitions and micro-interactions',
    icon: Zap,
    color: 'text-blue-500',
  },
  {
    id: 'crud',
    title: 'Enhanced CRUD',
    description: 'Animated data operations with validation',
    icon: Database,
    color: 'text-green-500',
  },
  {
    id: 'wizards',
    title: 'Wizard Workflows',
    description: 'Multi-step guided processes',
    icon: Workflow,
    color: 'text-purple-500',
  },
  {
    id: 'performance',
    title: 'Performance Optimization',
    description: 'Memory management and monitoring',
    icon: BarChart3,
    color: 'text-orange-500',
  },
];

export function ComprehensiveUIWorkflowDemo() {
  const [activeSection, setActiveSection] = useState('animations');
  const [isRunning, setIsRunning] = useState(false);
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(true);

  const { performance: currentMetrics, isPerformanceGood: isOptimal } = useAnimationPerformance();

  return (
    <LazyLoadingProvider>
      <MemoryManager
        config={{
          maxMemoryUsage: 150,
          enableAutoCleanup: true,
          warningThreshold: 100,
        }}
      >
        <AnimatedPage className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="container mx-auto p-6 space-y-8">
            {/* Header */}
            <motion.div
              variants={fadeInOut}
              initial="initial"
              animate="animate"
              className="text-center space-y-4"
            >
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Enhanced UI Workflow Demo
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Experience the complete enhanced UI system with animations, CRUD operations, 
                wizard workflows, and performance optimization features.
              </p>
              
              {/* Status Bar */}
              <div className="flex items-center justify-center gap-4 p-4 bg-white rounded-lg shadow-sm">
                <Badge variant={isOptimal ? 'default' : 'destructive'}>
                  {isOptimal ? 'Optimal Performance' : 'Performance Issues'}
                </Badge>
                <div className="text-sm text-gray-600">
                  FPS: {Math.round(currentMetrics?.fps || 0)}
                </div>
                <div className="text-sm text-gray-600">
                  Memory: {Math.round(currentMetrics?.memoryUsage || 0)}MB
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPerformanceMonitor(!showPerformanceMonitor)}
                >
                  <Monitor className="w-4 h-4 mr-2" />
                  {showPerformanceMonitor ? 'Hide' : 'Show'} Monitor
                </Button>
              </div>
            </motion.div>

            {/* Performance Monitor */}
            <PerformanceMonitor
              visible={showPerformanceMonitor}
              position="top-right"
              showHistory={true}
            />

            {/* Section Navigation */}
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              {DEMO_SECTIONS.map((section) => {
                const Icon = section.icon;
                return (
                  <motion.div
                    key={section.id}
                    variants={fadeInOut}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card
                      className={`cursor-pointer transition-all ${
                        activeSection === section.id
                          ? 'ring-2 ring-blue-500 shadow-lg'
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => setActiveSection(section.id)}
                    >
                      <CardContent className="p-4 text-center">
                        <Icon className={`w-8 h-8 mx-auto mb-2 ${section.color}`} />
                        <h3 className="font-semibold">{section.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {section.description}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Demo Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                variants={slideInFromRight}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-6"
              >
                {activeSection === 'animations' && <AnimationSystemDemo />}
                {activeSection === 'crud' && <EnhancedCRUDDemo />}
                {activeSection === 'wizards' && <WizardWorkflowDemo />}
                {activeSection === 'performance' && <PerformanceOptimizationDemo />}
              </motion.div>
            </AnimatePresence>

            {/* Global Controls */}
            <motion.div
              variants={fadeInOut}
              className="fixed bottom-6 right-6 space-y-2"
            >
              <Button
                onClick={() => setIsRunning(!isRunning)}
                className="w-12 h-12 rounded-full shadow-lg"
                variant={isRunning ? 'destructive' : 'default'}
              >
                {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </Button>
            </motion.div>
          </div>
        </AnimatedPage>
      </MemoryManager>
    </LazyLoadingProvider>
  );
}

// Animation System Demo Component
function AnimationSystemDemo() {
  const [animationDemo, setAnimationDemo] = useState<string | null>(null);
  const [items, setItems] = useState([
    { id: '1', name: 'Item 1', status: 'active' },
    { id: '2', name: 'Item 2', status: 'inactive' },
    { id: '3', name: 'Item 3', status: 'active' },
  ]);

  const addItem = () => {
    const newItem = {
      id: Date.now().toString(),
      name: `Item ${items.length + 1}`,
      status: Math.random() > 0.5 ? 'active' : 'inactive',
    };
    setItems(prev => [...prev, newItem]);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-500" />
            Animation System Showcase
          </CardTitle>
          <CardDescription>
            Experience smooth page transitions, micro-interactions, and list animations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Page Transition Demo */}
          <div>
            <h3 className="font-semibold mb-3">Page Transitions</h3>
            <div className="flex gap-2">
              <Button onClick={() => setAnimationDemo('fade')}>
                Fade Transition
              </Button>
              <Button onClick={() => setAnimationDemo('slide')}>
                Slide Transition
              </Button>
              <Button onClick={() => setAnimationDemo('scale')}>
                Scale Transition
              </Button>
            </div>
            
            <AnimatePresence mode="wait">
              {animationDemo && (
                <motion.div
                  key={animationDemo}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mt-4 p-4 bg-blue-50 rounded-lg"
                >
                  <h4 className="font-medium">
                    {animationDemo.charAt(0).toUpperCase() + animationDemo.slice(1)} Animation
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    This content animated in with a {animationDemo} transition.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAnimationDemo(null)}
                    className="mt-2"
                  >
                    Close
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* List Animation Demo */}
          <div>
            <h3 className="font-semibold mb-3">List Animations</h3>
            <div className="flex gap-2 mb-4">
              <Button onClick={addItem}>Add Item</Button>
              <Button 
                onClick={() => removeItem(items[items.length - 1]?.id)}
                disabled={items.length === 0}
                variant="outline"
              >
                Remove Item
              </Button>
            </div>

            <AnimatedList
              items={items}
              renderItem={(item: any) => (
                <div className="flex items-center justify-between p-3 bg-white rounded border">
                  <div>
                    <span className="font-medium">{item.name}</span>
                    <Badge 
                      variant={item.status === 'active' ? 'default' : 'secondary'}
                      className="ml-2"
                    >
                      {item.status}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => removeItem(item.id)}
                  >
                    Remove
                  </Button>
                </div>
              )}
              keyExtractor={(item: any) => item.id}
              className="space-y-2"
            />
          </div>

          {/* Loading States Demo */}
          <div>
            <h3 className="font-semibold mb-3">Loading States</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded">
                <h4 className="font-medium mb-2">Spinner Loading</h4>
                <Spinner />
              </div>
              <div className="p-4 border rounded">
                <h4 className="font-medium mb-2">Skeleton Loading</h4>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="p-4 border rounded">
                <h4 className="font-medium mb-2">Progress Loading</h4>
                <AnimatedProgress value={65} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Enhanced CRUD Demo Component
function EnhancedCRUDDemo() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Mock CRUD hook
  const crudHook = {
    items: [
      {
        id: '1',
        name: 'Product A',
        category: 'Electronics',
        status: 'active' as const,
        value: 299.99,
        description: 'High-quality electronic device',
        createdAt: '2024-01-15',
      },
      {
        id: '2',
        name: 'Product B',
        category: 'Clothing',
        status: 'inactive' as const,
        value: 49.99,
        description: 'Comfortable clothing item',
        createdAt: '2024-01-16',
      },
    ],
    loading: false,
    error: null,
    create: async (data: any) => console.log('Create:', data),
    update: async (id: string, data: any) => console.log('Update:', id, data),
    delete: async (id: string) => console.log('Delete:', id),
    bulkDelete: async (ids: string[]) => console.log('Bulk delete:', ids),
    selectedItems,
    selectItem: (id: string) => {
      setSelectedItems(prev => 
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
    },
    selectAll: () => setSelectedItems(crudHook.items.map(item => item.id)),
    clearSelection: () => setSelectedItems([]),
  };

  const formFields: FormFieldConfig[] = [
    {
      name: 'name',
      label: 'Product Name',
      type: 'text',
      placeholder: 'Enter product name',
      validation: { required: true, minLength: 2 },
      realTimeValidation: true,
    },
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      options: [
        { value: 'electronics', label: 'Electronics' },
        { value: 'clothing', label: 'Clothing' },
        { value: 'books', label: 'Books' },
      ],
      validation: { required: true },
    },
    {
      name: 'value',
      label: 'Price ($)',
      type: 'number',
      placeholder: '0.00',
      validation: { required: true, min: 0 },
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      placeholder: 'Enter product description',
      validation: { maxLength: 500 },
    },
  ];

  const columns = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }: any) => (
        <div className="font-medium">{row.getValue('name')}</div>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }: any) => (
        <Badge variant="outline" className="capitalize">
          {row.getValue('category')}
        </Badge>
      ),
    },
    {
      accessorKey: 'value',
      header: 'Price',
      cell: ({ row }: any) => {
        const price = parseFloat(row.getValue('value'));
        return <div className="font-mono">${price.toFixed(2)}</div>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => {
        const status = row.getValue('status');
        return (
          <Badge variant={status === 'active' ? 'default' : 'secondary'}>
            {status}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-green-500" />
            Enhanced CRUD Operations
          </CardTitle>
          <CardDescription>
            Animated data operations with validation, bulk actions, and export functionality
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* <AnimatedCRUDTable
            columns={columns}
            crudHook={crudHook}
            searchPlaceholder="Search products..."
            addLabel="Add Product"
            emptyMessage="No products found. Create your first product to get started."
            enableBulkOperations={true}
            enableExport={true}
            enableDuplicate={true}
            onCreateNew={() => setIsCreateModalOpen(true)}
            onEditItem={(item) => console.log('Edit:', item)}
            onView={(item) => console.log('View:', item)}
            className="border rounded-lg"
          /> */}
          <div className="mt-6 p-8 border-2 border-dashed border-gray-300 rounded-lg text-center">
            <p className="text-gray-500">CRUD Table Demo (temporarily disabled for build)</p>
          </div>

          <EnhancedModalForm
            open={isCreateModalOpen}
            onOpenChange={setIsCreateModalOpen}
            title="Create New Product"
            description="Add a new product to your inventory."
            fields={formFields}
            onSubmit={async (data) => {
              console.log('Submit:', data);
              setIsCreateModalOpen(false);
            }}
            submitLabel="Create Product"
            size="lg"
            showValidationSummary={true}
            enableRealTimeValidation={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// Wizard Workflow Demo Component
function WizardWorkflowDemo() {
  const [showWizard, setShowWizard] = useState(false);

  const wizardConfig = createWizardConfig(
    'demo-wizard',
    'Demo Wizard',
    [
      {
        id: 'welcome',
        title: 'Welcome',
        description: 'Get started with the demo',
        component: ({ onDataChange }: any) => (
          <div className="text-center space-y-4">
            <h3 className="text-lg font-semibold">Welcome to the Demo Wizard</h3>
            <p className="text-gray-600">
              This wizard demonstrates the multi-step workflow system.
            </p>
            <Button onClick={() => onDataChange?.({ acknowledged: true })}>
              Get Started
            </Button>
          </div>
        ),
        validation: (data) => data?.acknowledged === true,
      },
      {
        id: 'details',
        title: 'Details',
        description: 'Enter your details',
        component: ({ stepData = {}, onDataChange }: any) => (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Enter Details</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={stepData.name || ''}
                onChange={(e) => onDataChange?.({ ...stepData, name: e.target.value })}
                className="w-full p-2 border rounded"
                placeholder="Enter your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={stepData.email || ''}
                onChange={(e) => onDataChange?.({ ...stepData, email: e.target.value })}
                className="w-full p-2 border rounded"
                placeholder="Enter your email"
              />
            </div>
          </div>
        ),
        validation: (data) => !!data?.name && !!data?.email,
      },
      {
        id: 'review',
        title: 'Review',
        description: 'Review your information',
        component: ({ wizardData }: any) => (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Review Information</h3>
            <div className="p-4 bg-gray-50 rounded">
              <p><strong>Name:</strong> {wizardData?.details?.name || 'Not provided'}</p>
              <p><strong>Email:</strong> {wizardData?.details?.email || 'Not provided'}</p>
            </div>
          </div>
        ),
        validation: () => true,
      },
    ],
    {
      onComplete: async (data) => {
        console.log('Wizard completed:', data);
        alert('Wizard completed successfully!');
        setShowWizard(false);
      },
      onCancel: () => setShowWizard(false),
    }
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="w-5 h-5 text-purple-500" />
            Wizard Workflow System
          </CardTitle>
          <CardDescription>
            Multi-step guided processes with validation and progress tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showWizard ? (
            <div className="text-center space-y-4">
              <p className="text-gray-600">
                Experience the wizard workflow system with this interactive demo.
              </p>
              <Button onClick={() => setShowWizard(true)}>
                Start Demo Wizard
              </Button>
            </div>
          ) : (
            <div className="h-96">
              <Wizard
                config={wizardConfig}
                showProgress={true}
                showNavigation={true}
                animated={true}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Performance Optimization Demo Component
function PerformanceOptimizationDemo() {
  const [memoryTest, setMemoryTest] = useState(false);
  const [renderTest, setRenderTest] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);

  const runMemoryTest = () => {
    setMemoryTest(true);
    const startMemory = (performance as any).memory?.usedJSHeapSize || 0;
    
    // Create memory pressure
    const largeArray = new Array(100000).fill(0).map(() => ({
      data: Math.random().toString(36),
      timestamp: Date.now(),
    }));

    setTimeout(() => {
      const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
      setTestResults(prev => [...prev, {
        test: 'Memory Test',
        memoryDelta: (endMemory - startMemory) / 1024 / 1024,
        timestamp: new Date().toLocaleTimeString(),
      }]);
      
      // Cleanup
      largeArray.length = 0;
      setMemoryTest(false);
    }, 2000);
  };

  const runRenderTest = () => {
    setRenderTest(true);
    const startTime = performance.now();
    
    // Simulate heavy rendering
    const elements = Array.from({ length: 1000 }, () => 
      document.createElement('div')
    );
    
    elements.forEach(el => {
      el.textContent = Math.random().toString();
      document.body.appendChild(el);
    });
    
    setTimeout(() => {
      elements.forEach(el => document.body.removeChild(el));
      const endTime = performance.now();
      
      setTestResults(prev => [...prev, {
        test: 'Render Test',
        duration: endTime - startTime,
        timestamp: new Date().toLocaleTimeString(),
      }]);
      
      setRenderTest(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-orange-500" />
            Performance Optimization
          </CardTitle>
          <CardDescription>
            Memory management, monitoring, and performance testing tools
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Performance Tests */}
          <div>
            <h3 className="font-semibold mb-3">Performance Tests</h3>
            <div className="flex gap-2 mb-4">
              <Button
                onClick={runMemoryTest}
                disabled={memoryTest}
                className="flex items-center gap-2"
              >
                <HardDrive className="w-4 h-4" />
                {memoryTest ? 'Running...' : 'Memory Test'}
              </Button>
              <Button
                onClick={runRenderTest}
                disabled={renderTest}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Cpu className="w-4 h-4" />
                {renderTest ? 'Running...' : 'Render Test'}
              </Button>
              <Button
                onClick={() => setTestResults([])}
                variant="outline"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            {(memoryTest || renderTest) && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse" />
                  <span className="font-medium">
                    {memoryTest ? 'Memory Test' : 'Render Test'} Running...
                  </span>
                </div>
                <Progress value={memoryTest ? 50 : renderTest ? 75 : 0} />
              </div>
            )}
          </div>

          {/* Test Results */}
          {testResults.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Test Results</h3>
              <div className="space-y-2">
                {testResults.map((result, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 border rounded-lg"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">{result.test}</span>
                        <span className="text-sm text-gray-500 ml-2">
                          {result.timestamp}
                        </span>
                      </div>
                      <div className="text-sm">
                        {result.duration && `${result.duration.toFixed(2)}ms`}
                        {result.memoryDelta && `${result.memoryDelta.toFixed(2)}MB`}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Performance Tips */}
          <div>
            <h3 className="font-semibold mb-3">Performance Tips</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Animation Performance</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Use transform properties</li>
                  <li>• Enable hardware acceleration</li>
                  <li>• Limit concurrent animations</li>
                  <li>• Clean up animation frames</li>
                </ul>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Memory Management</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Monitor memory usage</li>
                  <li>• Implement cleanup strategies</li>
                  <li>• Use weak references</li>
                  <li>• Limit cache sizes</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ComprehensiveUIWorkflowDemo;