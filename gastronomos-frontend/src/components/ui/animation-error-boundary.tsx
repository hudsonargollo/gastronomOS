/**
 * Animation Error Boundary Component
 * Handles animation failures and provides graceful degradation
 */

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button } from './button';
import { Card } from './card';
import { Badge } from './badge';

interface AnimationErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  retryCount: number;
  isRecovering: boolean;
  fallbackMode: 'minimal' | 'static' | 'hidden';
}

interface AnimationErrorBoundaryProps {
  children: ReactNode;
  fallbackComponent?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
  enableFallback?: boolean;
  showErrorDetails?: boolean;
  className?: string;
}

export class AnimationErrorBoundary extends Component<
  AnimationErrorBoundaryProps,
  AnimationErrorBoundaryState
> {
  private retryTimeout: NodeJS.Timeout | null = null;

  constructor(props: AnimationErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0,
      isRecovering: false,
      fallbackMode: 'minimal',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AnimationErrorBoundaryState> {
    // Generate unique error ID for tracking
    const errorId = `anim-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine fallback mode based on error type
    let fallbackMode: 'minimal' | 'static' | 'hidden' = 'minimal';
    
    if (error.message.includes('Framer Motion') || error.message.includes('animation')) {
      fallbackMode = 'static';
    } else if (error.message.includes('render') || error.message.includes('component')) {
      fallbackMode = 'hidden';
    }

    return {
      hasError: true,
      error,
      errorId,
      fallbackMode,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error details
    console.error('Animation Error Boundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report to error tracking service (if available)
    this.reportError(error, errorInfo);

    // Auto-retry for certain types of errors
    this.attemptAutoRecovery(error);
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // In a real application, you would send this to an error tracking service
    // like Sentry, LogRocket, or Bugsnag
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'exception', {
        description: error.message,
        fatal: false,
        custom_map: {
          error_id: this.state.errorId,
          component_stack: errorInfo.componentStack,
        },
      });
    }
  };

  private attemptAutoRecovery = (error: Error) => {
    const { maxRetries = 3 } = this.props;
    
    // Only auto-retry for certain types of recoverable errors
    const isRecoverable = 
      error.message.includes('animation') ||
      error.message.includes('transition') ||
      error.message.includes('motion');

    if (isRecoverable && this.state.retryCount < maxRetries) {
      this.setState({ isRecovering: true });
      
      this.retryTimeout = setTimeout(() => {
        this.handleRetry();
      }, 1000 * (this.state.retryCount + 1)); // Exponential backoff
    }
  };

  private handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
      isRecovering: false,
    }));
  };

  private handleManualRetry = () => {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    this.handleRetry();
  };

  private handleDismiss = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isRecovering: false,
    });
  };

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  render() {
    const { hasError, error, isRecovering, fallbackMode, retryCount } = this.state;
    const { 
      children, 
      fallbackComponent, 
      maxRetries = 3, 
      enableFallback = true,
      showErrorDetails = process.env.NODE_ENV === 'development',
      className = '',
    } = this.props;

    if (hasError && error) {
      // If we have a custom fallback component, use it
      if (fallbackComponent) {
        return fallbackComponent;
      }

      // If fallback is disabled, return null (hide component)
      if (!enableFallback) {
        return null;
      }

      // Show recovery indicator
      if (isRecovering) {
        return (
          <div className={`flex items-center justify-center p-4 ${className}`}>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Recovering from animation error...
            </div>
          </div>
        );
      }

      // Render error fallback based on fallback mode
      return this.renderErrorFallback();
    }

    // Wrap children in error boundary context
    return (
      <ErrorBoundaryProvider errorBoundary={this}>
        {children}
      </ErrorBoundaryProvider>
    );
  }

  private renderErrorFallback() {
    const { error, fallbackMode, retryCount } = this.state;
    const { maxRetries = 3, showErrorDetails, className = '' } = this.props;

    if (fallbackMode === 'hidden') {
      return null;
    }

    if (fallbackMode === 'static') {
      return (
        <div className={`opacity-75 ${className}`}>
          <div className="text-sm text-muted-foreground p-2 bg-muted/50 rounded border-l-2 border-orange-500">
            Animation disabled due to error
          </div>
        </div>
      );
    }

    // Minimal fallback with error details
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="error-fallback"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`${className}`}
        >
          <Card className="border-destructive/50 bg-destructive/5">
            <div className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-destructive">
                      Animation Error
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={this.handleDismiss}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    An animation component encountered an error and has been disabled.
                  </p>

                  {showErrorDetails && error && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Error Details
                      </summary>
                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                        {error.message}
                      </pre>
                    </details>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Attempt {retryCount + 1}/{maxRetries + 1}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        Mode: {fallbackMode}
                      </Badge>
                    </div>
                    
                    {retryCount < maxRetries && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={this.handleManualRetry}
                        className="h-7 text-xs"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
    );
  }
}

// Context for accessing error boundary from child components
const ErrorBoundaryContext = React.createContext<AnimationErrorBoundary | null>(null);

interface ErrorBoundaryProviderProps {
  children: ReactNode;
  errorBoundary: AnimationErrorBoundary;
}

function ErrorBoundaryProvider({ children, errorBoundary }: ErrorBoundaryProviderProps) {
  return (
    <ErrorBoundaryContext.Provider value={errorBoundary}>
      {children}
    </ErrorBoundaryContext.Provider>
  );
}

// Hook for accessing error boundary from child components
export function useAnimationErrorBoundary() {
  const errorBoundary = React.useContext(ErrorBoundaryContext);
  
  return {
    reportError: (error: Error) => {
      if (errorBoundary) {
        errorBoundary.componentDidCatch(error, { componentStack: '' });
      }
    },
    hasError: errorBoundary?.state.hasError || false,
    retry: () => {
      if (errorBoundary) {
        errorBoundary['handleManualRetry']();
      }
    },
  };
}

// Higher-order component for wrapping components with animation error boundary
export function withAnimationErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Partial<AnimationErrorBoundaryProps>
) {
  const WrappedComponent = (props: P) => (
    <AnimationErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </AnimationErrorBoundary>
  );

  WrappedComponent.displayName = `withAnimationErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Utility function to safely execute animation-related code
export function safeAnimationExecution<T>(
  fn: () => T,
  fallback: T,
  onError?: (error: Error) => void
): T {
  try {
    return fn();
  } catch (error) {
    console.warn('Animation execution failed, using fallback:', error);
    
    if (onError && error instanceof Error) {
      onError(error);
    }
    
    return fallback;
  }
}

// Component for testing animation error boundary
export function AnimationErrorTrigger({ 
  triggerError = false,
  errorType = 'animation'
}: { 
  triggerError?: boolean;
  errorType?: 'animation' | 'render' | 'motion';
}) {
  if (triggerError) {
    if (errorType === 'animation') {
      throw new Error('Test animation error for error boundary');
    } else if (errorType === 'render') {
      throw new Error('Test render error for error boundary');
    } else if (errorType === 'motion') {
      throw new Error('Framer Motion test error for error boundary');
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-2 bg-green-100 text-green-800 rounded"
    >
      Animation working correctly
    </motion.div>
  );
}