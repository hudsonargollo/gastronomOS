/**
 * Comprehensive Error Handling Demo
 * Demonstrates all error handling capabilities
 */

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  Wifi, 
  Zap, 
  RefreshCw, 
  Bug,
  Network,
  Server,
  Shield,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
// import { ComprehensiveErrorHandler } from '@/components/ui/comprehensive-error-handler';
import { AnimationErrorTrigger } from '@/components/ui/animation-error-boundary';
import { PerformanceConditional } from '@/components/ui/performance-degradation-handler';

export default function ComprehensiveErrorHandlingDemo() {
  const [triggerAnimationError, setTriggerAnimationError] = useState(false);
  const [simulateSlowPerformance, setSimulateSlowPerformance] = useState(false);
  
  // Mock error handling functions for demo
  const reportError = (error: Error, type: string, context?: any) => {
    console.error('Demo error:', error, type, context);
  };
  
  const reportValidationError = (message: string, details?: string) => {
    console.error('Demo validation error:', message, details);
  };
  
  const reportNetworkError = (context: any) => {
    console.error('Demo network error:', context);
  };
  
  const reportServerError = (context: any) => {
    console.error('Demo server error:', context);
  };
  
  const handleAsyncOperation = async (operation: () => Promise<any>, context?: any) => {
    try {
      return await operation();
    } catch (error) {
      console.error('Demo async error:', error, context);
      return null;
    }
  };
  
  const handleSyncOperation = (operation: () => any, fallback: any, context?: any) => {
    try {
      return operation();
    } catch (error) {
      console.error('Demo sync error:', error, context);
      return fallback;
    }
  };
  
  const networkStatus = { isOnline: true, isConnected: true, latency: 45 };
  const networkErrors = [];
  const performanceLevel = 'high';
  const performanceMetrics = { fps: 60, memory: 128 };
  const isPerformanceDegraded = false;

  // Simulate different types of errors
  const simulateClientError = () => {
    reportError(new Error('Simulated client-side error'), 'client', {
      page: '/demo',
      operation: 'simulate_client_error',
    });
  };

  const simulateValidationError = () => {
    reportValidationError(
      'Please enter a valid email address',
      'The email field must contain a valid email format (e.g., user@example.com)'
    );
  };

  const simulateNetworkError = () => {
    reportNetworkError({
      operation: 'fetch_data',
      url: '/api/demo',
      method: 'GET',
    });
  };

  const simulateServerError = () => {
    reportServerError({
      operation: 'save_data',
      url: '/api/demo',
      method: 'POST',
      statusCode: 500,
    });
  };

  const simulateAsyncError = async () => {
    const result = await handleAsyncOperation(async () => {
      // Simulate an async operation that fails
      await new Promise(resolve => setTimeout(resolve, 1000));
      throw new Error('Async operation failed');
    }, {
      operation: 'async_demo',
      page: '/demo',
    });

    if (!result) {
      console.log('Async operation was handled gracefully');
    }
  };

  const simulateSyncError = () => {
    const result = handleSyncOperation(
      () => {
        throw new Error('Sync operation failed');
      },
      'fallback_value',
      {
        operation: 'sync_demo',
        page: '/demo',
      }
    );

    console.log('Sync operation result:', result);
  };

  const simulateUnhandledError = () => {
    // This will be caught by the global error handler
    setTimeout(() => {
      throw new Error('Unhandled error for testing');
    }, 100);
  };

  const simulateUnhandledPromiseRejection = () => {
    // This will be caught by the global promise rejection handler
    Promise.reject(new Error('Unhandled promise rejection for testing'));
  };

  // Performance simulation
  const simulatePerformanceIssue = () => {
    setSimulateSlowPerformance(true);
    
    // Simulate heavy computation
    const start = Date.now();
    while (Date.now() - start < 100) {
      // Busy wait to simulate slow performance
    }
    
    setTimeout(() => setSimulateSlowPerformance(false), 5000);
  };

  const getPerformanceLevelColor = (level: string) => {
    switch (level) {
      case 'severe': return 'text-red-600';
      case 'moderate': return 'text-orange-600';
      case 'minimal': return 'text-yellow-600';
      default: return 'text-green-600';
    }
  };

  const getNetworkStatusColor = (isOnline: boolean, isConnected: boolean) => {
    if (!isOnline || !isConnected) return 'text-red-600';
    return 'text-green-600';
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <h1 className="text-4xl font-bold">Comprehensive Error Handling Demo</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          This demo showcases the complete error handling system including animation errors, 
          performance degradation, network issues, and user-friendly error messages.
        </p>
      </motion.div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Status
          </CardTitle>
          <CardDescription>
            Current status of error handling systems
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Wifi className={`h-4 w-4 ${getNetworkStatusColor(networkStatus.isOnline, networkStatus.isConnected)}`} />
                <span className="text-sm font-medium">Network</span>
              </div>
              <Badge variant={networkStatus.isOnline && networkStatus.isConnected ? 'default' : 'destructive'}>
                {networkStatus.isOnline && networkStatus.isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Zap className={`h-4 w-4 ${getPerformanceLevelColor(performanceLevel)}`} />
                <span className="text-sm font-medium">Performance</span>
              </div>
              <Badge variant={isPerformanceDegraded ? 'destructive' : 'default'}>
                {performanceLevel.charAt(0).toUpperCase() + performanceLevel.slice(1)}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Error Handler</span>
              </div>
              <Badge variant="default">Active</Badge>
            </div>
          </div>

          {networkStatus.isConnected && (
            <div className="text-sm text-muted-foreground">
              Network latency: {networkStatus.latency}ms | 
              FPS: {Math.round(performanceMetrics.fps)} | 
              Memory: {Math.round(performanceMetrics.memory)}MB
            </div>
          )}

          {networkErrors.length > 0 && (
            <div className="text-sm text-red-600">
              Active network errors: {networkErrors.length}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Simulation Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Client-Side Errors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Client-Side Errors
            </CardTitle>
            <CardDescription>
              Test different types of client-side error handling
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={simulateClientError}
              variant="outline"
              className="w-full justify-start"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Simulate Client Error
            </Button>

            <Button 
              onClick={simulateValidationError}
              variant="outline"
              className="w-full justify-start"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Simulate Validation Error
            </Button>

            <Button 
              onClick={simulateSyncError}
              variant="outline"
              className="w-full justify-start"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Simulate Sync Error (with fallback)
            </Button>

            <Button 
              onClick={simulateAsyncError}
              variant="outline"
              className="w-full justify-start"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Simulate Async Error (with handling)
            </Button>

            <Separator />

            <Button 
              onClick={simulateUnhandledError}
              variant="destructive"
              className="w-full justify-start"
            >
              <Bug className="h-4 w-4 mr-2" />
              Simulate Unhandled Error
            </Button>

            <Button 
              onClick={simulateUnhandledPromiseRejection}
              variant="destructive"
              className="w-full justify-start"
            >
              <Bug className="h-4 w-4 mr-2" />
              Simulate Promise Rejection
            </Button>
          </CardContent>
        </Card>

        {/* Network & Server Errors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Network & Server Errors
            </CardTitle>
            <CardDescription>
              Test network and server error handling with retry mechanisms
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={simulateNetworkError}
              variant="outline"
              className="w-full justify-start"
            >
              <Wifi className="h-4 w-4 mr-2" />
              Simulate Network Error
            </Button>

            <Button 
              onClick={simulateServerError}
              variant="outline"
              className="w-full justify-start"
            >
              <Server className="h-4 w-4 mr-2" />
              Simulate Server Error
            </Button>

            <div className="text-sm text-muted-foreground p-3 bg-muted rounded">
              Network errors will show retry options and automatic retry mechanisms.
              Server errors will provide recovery actions and error reporting options.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Animation & Performance Testing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Animation Error Testing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Animation Error Boundary
            </CardTitle>
            <CardDescription>
              Test animation error handling and graceful degradation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Button 
                onClick={() => setTriggerAnimationError(!triggerAnimationError)}
                variant={triggerAnimationError ? "destructive" : "outline"}
                className="w-full"
              >
                {triggerAnimationError ? 'Stop' : 'Trigger'} Animation Error
              </Button>
              
              <div className="min-h-[100px] border rounded-lg p-4 flex items-center justify-center">
                <AnimationErrorTrigger 
                  triggerError={triggerAnimationError}
                  errorType="animation"
                />
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              When animation errors occur, the system will show error boundaries with 
              retry options and fallback to static content when needed.
            </div>
          </CardContent>
        </Card>

        {/* Performance Degradation Testing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Performance Degradation
            </CardTitle>
            <CardDescription>
              Test performance monitoring and automatic degradation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={simulatePerformanceIssue}
              variant="outline"
              className="w-full"
              disabled={simulateSlowPerformance}
            >
              {simulateSlowPerformance ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Simulating Performance Issue...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Simulate Performance Issue
                </>
              )}
            </Button>

            <PerformanceConditional
              feature="complex-animations"
              fallback={
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                  Complex animations disabled due to performance constraints
                </div>
              }
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.05, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800"
              >
                Complex animations are running normally
              </motion.div>
            </PerformanceConditional>

            <div className="text-sm text-muted-foreground">
              Performance degradation automatically reduces animation complexity 
              and enables optimizations when system performance drops.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Handling Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle>Error Handling Best Practices</CardTitle>
          <CardDescription>
            Guidelines for implementing robust error handling in your application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold">Client-Side Errors</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Use error boundaries for component-level errors</li>
                <li>• Provide fallback UI for failed components</li>
                <li>• Implement graceful degradation for animations</li>
                <li>• Log errors for debugging and monitoring</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">Network Errors</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Implement automatic retry with exponential backoff</li>
                <li>• Show clear error messages with recovery options</li>
                <li>• Handle offline scenarios gracefully</li>
                <li>• Provide manual retry mechanisms</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">Performance Issues</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Monitor frame rates and memory usage</li>
                <li>• Automatically degrade animations when needed</li>
                <li>• Implement virtual scrolling for large lists</li>
                <li>• Use lazy loading for heavy components</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold">User Experience</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Show user-friendly error messages</li>
                <li>• Provide clear recovery actions</li>
                <li>• Maintain application state during errors</li>
                <li>• Offer help and support options</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}