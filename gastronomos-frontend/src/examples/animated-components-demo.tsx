/**
 * Animated Components Demo
 * Demonstrates the enhanced UI components with Framer Motion animations
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  AnimatedList, 
  SimpleAnimatedList, 
  AnimatedGrid 
} from '@/components/ui/animated-list';
import { 
  AnimatedModal, 
  AnimatedModalTrigger, 
  AnimatedModalContent, 
  AnimatedModalHeader, 
  AnimatedModalTitle, 
  AnimatedModalDescription,
  ConfirmationModal 
} from '@/components/ui/animated-modal';
import { 
  Spinner, 
  PulsingDots, 
  AnimatedProgress, 
  Skeleton, 
  CardSkeleton, 
  LoadingOverlay, 
  LoadingButton 
} from '@/components/ui/loading-states';

export function AnimatedComponentsDemo() {
  const [items, setItems] = useState(['Item 1', 'Item 2', 'Item 3']);
  const [showModal, setShowModal] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const addItem = () => {
    setItems(prev => [...prev, `Item ${prev.length + 1}`]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const simulateLoading = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 3000);
  };

  const simulateProgress = () => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold">Animated Components Demo</h1>

      {/* Enhanced Button */}
      <Card>
        <CardHeader>
          <CardTitle>Enhanced Button Component</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <Button onClick={addItem}>Add Item</Button>
            <Button variant="outline" onClick={simulateLoading}>
              Simulate Loading
            </Button>
            <Button variant="destructive" onClick={() => setShowConfirmation(true)}>
              Delete Something
            </Button>
          </div>
          <LoadingButton 
            isLoading={isLoading} 
            loadingText="Processing..."
            onClick={simulateLoading}
          >
            Loading Button Demo
          </LoadingButton>
        </CardContent>
      </Card>

      {/* Enhanced Input */}
      <Card>
        <CardHeader>
          <CardTitle>Enhanced Input Component</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Type something..." />
          <Input placeholder="Error state" aria-invalid={true} />
        </CardContent>
      </Card>

      {/* Animated List */}
      <Card>
        <CardHeader>
          <CardTitle>Animated List Component</CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleAnimatedList 
            items={items}
            onItemClick={(item, index) => removeItem(index)}
            itemClassName="cursor-pointer hover:bg-destructive/10"
          />
        </CardContent>
      </Card>

      {/* Loading States */}
      <Card>
        <CardHeader>
          <CardTitle>Loading States</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
          </div>
          
          <div className="flex items-center gap-4">
            <PulsingDots count={3} />
            <PulsingDots count={5} size="lg" color="secondary" />
          </div>

          <div className="space-y-2">
            <AnimatedProgress value={progress} showPercentage />
            <Button onClick={simulateProgress} size="sm">
              Simulate Progress
            </Button>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium">Skeleton Loading</h4>
            <Skeleton variant="text" lines={3} />
            <Skeleton variant="rectangular" width={200} height={100} />
            <Skeleton variant="circular" width={50} height={50} />
          </div>

          <CardSkeleton />
        </CardContent>
      </Card>

      {/* Modal Demo */}
      <Card>
        <CardHeader>
          <CardTitle>Animated Modal</CardTitle>
        </CardHeader>
        <CardContent>
          <AnimatedModal open={showModal} onOpenChange={setShowModal}>
            <AnimatedModalTrigger asChild>
              <Button>Open Modal</Button>
            </AnimatedModalTrigger>
            <AnimatedModalContent>
              <AnimatedModalHeader>
                <AnimatedModalTitle>Demo Modal</AnimatedModalTitle>
                <AnimatedModalDescription>
                  This is an animated modal with smooth scaling and opacity transitions.
                </AnimatedModalDescription>
              </AnimatedModalHeader>
              <div className="py-4">
                <p>Modal content goes here...</p>
              </div>
            </AnimatedModalContent>
          </AnimatedModal>
        </CardContent>
      </Card>

      {/* Loading Overlay Demo */}
      <LoadingOverlay isLoading={isLoading} message="Loading demo content...">
        <Card>
          <CardHeader>
            <CardTitle>Loading Overlay Demo</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This content will be overlaid with a loading indicator when the loading button is clicked.</p>
          </CardContent>
        </Card>
      </LoadingOverlay>

      {/* Confirmation Modal */}
      <ConfirmationModal
        open={showConfirmation}
        onOpenChange={setShowConfirmation}
        title="Confirm Deletion"
        description="Are you sure you want to delete this item? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={() => console.log('Confirmed deletion')}
      />
    </div>
  );
}