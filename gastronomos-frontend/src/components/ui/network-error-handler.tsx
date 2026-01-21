/**
 * Network Error Handler Component
 * Handles network errors with retry mechanisms and user-friendly messages
 */

'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Button } from './button';
import { Card } from './card';
import { Badge } from './badge';
import { Progress } from './progress';

// Network error types
export type NetworkErrorType = 
  | 'connection'
  | 'timeout'
  | 'server'
  | 'authentication'
  | 'rate_limit'
  | 'unknown';

// Network error severity levels
export type NetworkErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Network error interface
export interface NetworkError {
  id: string;
  type: NetworkErrorType;
  severity: NetworkErrorSeverity;
  message: string;
  originalError?: Error;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  retryDelay: number;
  context?: {
    url?: string;
    method?: string;
    statusCode?: number;
    operation?: string;
  };
}

// Retry strategy configuration
export interface RetryStrategy {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

// Network status
export interface NetworkStatus {
  isOnline: boolean;
  isConnected: boolean;
  latency: number;
  lastCheck: number;
}

// Network error handler state
interface NetworkErrorHandlerState {
  errors: NetworkError[];
  networkStatus: NetworkStatus;
  isRetrying: boolean;
  retryQueue: string[];
  globalRetryStrategy: RetryStrategy;
  showNotifications: boolean;
}

// Context for network error handling
interface NetworkErrorHandlerContextType {
  state: NetworkErrorHandlerState;
  actions: {
    reportError: (error: Error, context?: NetworkError['context']) => string;
    retryError: (errorId: string) => Promise<boolean>;
    dismissError: (errorId: string) => void;
    clearAllErrors: () => void;
    updateRetryStrategy: (strategy: Partial<RetryStrategy>) => void;
    setShowNotifications: (show: boolean) => void;
  };
  utils: {
    getErrorsByType: (type: NetworkErrorType) => NetworkError[];
    getErrorsBySeverity: (severity: NetworkErrorSeverity) => NetworkError[];
    hasActiveErrors: () => boolean;
    isErrorRetryable: (error: NetworkError) => boolean;
  };
}

const NetworkErrorHandlerContext = createContext<NetworkErrorHandlerContextType | undefined>(undefined);

export function useNetworkErrorHandler() {
  const context = useContext(NetworkErrorHandlerContext);
  if (!context) {
    throw new Error('useNetworkErrorHandler must be used within a NetworkErrorHandlerProvider');
  }
  return context;
}

// Default retry strategy
const defaultRetryStrategy: RetryStrategy = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

interface NetworkErrorHandlerProviderProps {
  children: ReactNode;
  retryStrategy?: Partial<RetryStrategy>;
  showNotifications?: boolean;
  onError?: (error: NetworkError) => void;
  onRetrySuccess?: (errorId: string) => void;
  onRetryFailure?: (errorId: string) => void;
}

export function NetworkErrorHandlerProvider({
  children,
  retryStrategy: customRetryStrategy = {},
  showNotifications = true,
  onError,
  onRetrySuccess,
  onRetryFailure,
}: NetworkErrorHandlerProviderProps) {
  const [state, setState] = useState<NetworkErrorHandlerState>({
    errors: [],
    networkStatus: {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isConnected: true,
      latency: 0,
      lastCheck: Date.now(),
    },
    isRetrying: false,
    retryQueue: [],
    globalRetryStrategy: { ...defaultRetryStrategy, ...customRetryStrategy },
    showNotifications,
  });

  // Monitor network status
  useEffect(() => {
    const updateOnlineStatus = () => {
      setState(prev => ({
        ...prev,
        networkStatus: {
          ...prev.networkStatus,
          isOnline: navigator.onLine,
          lastCheck: Date.now(),
        },
      }));
    };

    const checkConnection = async () => {
      try {
        const start = Date.now();
        const response = await fetch('/api/health', { 
          method: 'HEAD',
          cache: 'no-cache',
        });
        const latency = Date.now() - start;
        
        setState(prev => ({
          ...prev,
          networkStatus: {
            ...prev.networkStatus,
            isConnected: response.ok,
            latency,
            lastCheck: Date.now(),
          },
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          networkStatus: {
            ...prev.networkStatus,
            isConnected: false,
            lastCheck: Date.now(),
          },
        }));
      }
    };

    // Listen for online/offline events
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Check connection periodically
    const connectionInterval = setInterval(checkConnection, 30000);
    checkConnection(); // Initial check

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      clearInterval(connectionInterval);
    };
  }, []);

  // Classify error type and severity
  const classifyError = useCallback((error: Error, context?: NetworkError['context']): {
    type: NetworkErrorType;
    severity: NetworkErrorSeverity;
  } => {
    const message = error.message.toLowerCase();
    const statusCode = context?.statusCode;

    // Determine error type
    let type: NetworkErrorType = 'unknown';
    if (message.includes('network') || message.includes('fetch')) {
      type = 'connection';
    } else if (message.includes('timeout')) {
      type = 'timeout';
    } else if (statusCode && statusCode >= 500) {
      type = 'server';
    } else if (statusCode === 401 || statusCode === 403) {
      type = 'authentication';
    } else if (statusCode === 429) {
      type = 'rate_limit';
    }

    // Determine severity
    let severity: NetworkErrorSeverity = 'medium';
    if (type === 'authentication') {
      severity = 'critical';
    } else if (type === 'server' || type === 'connection') {
      severity = 'high';
    } else if (type === 'rate_limit' || type === 'timeout') {
      severity = 'medium';
    } else {
      severity = 'low';
    }

    return { type, severity };
  }, []);

  // Calculate retry delay with exponential backoff
  const calculateRetryDelay = useCallback((
    retryCount: number,
    strategy: RetryStrategy
  ): number => {
    let delay = strategy.baseDelay * Math.pow(strategy.backoffMultiplier, retryCount);
    delay = Math.min(delay, strategy.maxDelay);
    
    if (strategy.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }, []);

  // Context actions
  const actions = {
    reportError: (error: Error, context?: NetworkError['context']): string => {
      const { type, severity } = classifyError(error, context);
      const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const networkError: NetworkError = {
        id: errorId,
        type,
        severity,
        message: error.message,
        originalError: error,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: state.globalRetryStrategy.maxRetries,
        retryDelay: calculateRetryDelay(0, state.globalRetryStrategy),
        context,
      };

      setState(prev => ({
        ...prev,
        errors: [...prev.errors, networkError],
      }));

      // Call custom error handler
      if (onError) {
        onError(networkError);
      }

      // Auto-retry for certain error types
      if (utils.isErrorRetryable(networkError)) {
        setTimeout(() => {
          actions.retryError(errorId);
        }, networkError.retryDelay);
      }

      return errorId;
    },

    retryError: async (errorId: string): Promise<boolean> => {
      const error = state.errors.find(e => e.id === errorId);
      if (!error || error.retryCount >= error.maxRetries) {
        return false;
      }

      setState(prev => ({
        ...prev,
        isRetrying: true,
        retryQueue: [...prev.retryQueue, errorId],
      }));

      try {
        // Simulate retry logic - in real implementation, this would re-execute the failed operation
        await new Promise(resolve => setTimeout(resolve, error.retryDelay));
        
        // For demonstration, randomly succeed or fail
        const success = Math.random() > 0.3;
        
        if (success) {
          setState(prev => ({
            ...prev,
            errors: prev.errors.filter(e => e.id !== errorId),
            isRetrying: false,
            retryQueue: prev.retryQueue.filter(id => id !== errorId),
          }));

          if (onRetrySuccess) {
            onRetrySuccess(errorId);
          }

          return true;
        } else {
          // Update retry count and schedule next retry
          setState(prev => ({
            ...prev,
            errors: prev.errors.map(e => 
              e.id === errorId 
                ? {
                    ...e,
                    retryCount: e.retryCount + 1,
                    retryDelay: calculateRetryDelay(e.retryCount + 1, state.globalRetryStrategy),
                  }
                : e
            ),
            isRetrying: false,
            retryQueue: prev.retryQueue.filter(id => id !== errorId),
          }));

          if (onRetryFailure) {
            onRetryFailure(errorId);
          }

          return false;
        }
      } catch (retryError) {
        setState(prev => ({
          ...prev,
          isRetrying: false,
          retryQueue: prev.retryQueue.filter(id => id !== errorId),
        }));

        return false;
      }
    },

    dismissError: (errorId: string) => {
      setState(prev => ({
        ...prev,
        errors: prev.errors.filter(e => e.id !== errorId),
      }));
    },

    clearAllErrors: () => {
      setState(prev => ({
        ...prev,
        errors: [],
        retryQueue: [],
      }));
    },

    updateRetryStrategy: (strategy: Partial<RetryStrategy>) => {
      setState(prev => ({
        ...prev,
        globalRetryStrategy: { ...prev.globalRetryStrategy, ...strategy },
      }));
    },

    setShowNotifications: (show: boolean) => {
      setState(prev => ({
        ...prev,
        showNotifications: show,
      }));
    },
  };

  // Context utilities
  const utils = {
    getErrorsByType: (type: NetworkErrorType) => 
      state.errors.filter(error => error.type === type),

    getErrorsBySeverity: (severity: NetworkErrorSeverity) => 
      state.errors.filter(error => error.severity === severity),

    hasActiveErrors: () => state.errors.length > 0,

    isErrorRetryable: (error: NetworkError): boolean => {
      return (
        error.retryCount < error.maxRetries &&
        error.type !== 'authentication' &&
        error.severity !== 'critical'
      );
    },
  };

  const contextValue: NetworkErrorHandlerContextType = {
    state,
    actions,
    utils,
  };

  return (
    <NetworkErrorHandlerContext.Provider value={contextValue}>
      {children}
      {state.showNotifications && <NetworkErrorNotifications />}
      <NetworkStatusIndicator />
    </NetworkErrorHandlerContext.Provider>
  );
}

// Network error notifications component
function NetworkErrorNotifications() {
  const { state, actions, utils } = useNetworkErrorHandler();
  const [dismissedErrors, setDismissedErrors] = useState<Set<string>>(new Set());

  const visibleErrors = state.errors.filter(error => 
    !dismissedErrors.has(error.id) && 
    (error.severity === 'high' || error.severity === 'critical')
  );

  const handleDismiss = (errorId: string) => {
    setDismissedErrors(prev => new Set([...prev, errorId]));
    setTimeout(() => {
      actions.dismissError(errorId);
    }, 300);
  };

  const getSeverityColor = (severity: NetworkErrorSeverity) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-500 bg-orange-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  const getErrorIcon = (type: NetworkErrorType) => {
    switch (type) {
      case 'connection': return <WifiOff className="h-4 w-4" />;
      case 'server': return <AlertCircle className="h-4 w-4" />;
      case 'authentication': return <AlertCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      <AnimatePresence>
        {visibleErrors.map((error) => (
          <motion.div
            key={error.id}
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className={`border-l-4 ${getSeverityColor(error.severity)}`}
          >
            <Card>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="text-red-600 mt-0.5">
                    {getErrorIcon(error.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">
                        Network Error
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismiss(error.id)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {error.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {error.type}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {error.severity}
                      </Badge>
                      {error.retryCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          Retry {error.retryCount}/{error.maxRetries}
                        </Badge>
                      )}
                    </div>
                    {utils.isErrorRetryable(error) && (
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => actions.retryError(error.id)}
                          disabled={state.retryQueue.includes(error.id)}
                          className="h-6 text-xs"
                        >
                          {state.retryQueue.includes(error.id) ? (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              Retrying...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Retry Now
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Network status indicator
function NetworkStatusIndicator() {
  const { state } = useNetworkErrorHandler();
  const [showDetails, setShowDetails] = useState(false);

  const getStatusColor = () => {
    if (!state.networkStatus.isOnline) return 'text-red-500';
    if (!state.networkStatus.isConnected) return 'text-orange-500';
    if (state.networkStatus.latency > 1000) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusIcon = () => {
    if (!state.networkStatus.isOnline || !state.networkStatus.isConnected) {
      return <WifiOff className="h-4 w-4" />;
    }
    return <Wifi className="h-4 w-4" />;
  };

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowDetails(!showDetails)}
        className={`h-8 w-8 p-0 ${getStatusColor()}`}
      >
        {getStatusIcon()}
      </Button>
      
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-10 left-0"
          >
            <Card className="p-3 min-w-[200px]">
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>Status:</span>
                  <div className="flex items-center gap-1">
                    {getStatusIcon()}
                    <span className={getStatusColor()}>
                      {state.networkStatus.isOnline && state.networkStatus.isConnected 
                        ? 'Connected' 
                        : 'Disconnected'
                      }
                    </span>
                  </div>
                </div>
                {state.networkStatus.isConnected && (
                  <div className="flex items-center justify-between">
                    <span>Latency:</span>
                    <span>{state.networkStatus.latency}ms</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>Active Errors:</span>
                  <Badge variant="outline" className="text-xs">
                    {state.errors.length}
                  </Badge>
                </div>
                {state.isRetrying && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    <span>Retrying...</span>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Hook for handling network operations with automatic error handling
export function useNetworkOperation() {
  const { actions } = useNetworkErrorHandler();

  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    context?: NetworkError['context']
  ): Promise<T | null> => {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Error) {
        actions.reportError(error, context);
      }
      return null;
    }
  }, [actions]);

  return { executeWithErrorHandling };
}

// Higher-order component for automatic network error handling
export function withNetworkErrorHandling<P extends object>(
  Component: React.ComponentType<P>,
  context?: NetworkError['context']
) {
  const WrappedComponent = (props: P) => {
    const { actions } = useNetworkErrorHandler();

    // Wrap component in error boundary for network-related errors
    const handleError = (error: Error) => {
      actions.reportError(error, context);
    };

    return (
      <NetworkErrorBoundary onError={handleError}>
        <Component {...props} />
      </NetworkErrorBoundary>
    );
  };

  WrappedComponent.displayName = `withNetworkErrorHandling(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Simple error boundary for network errors
class NetworkErrorBoundary extends React.Component<
  { children: ReactNode; onError: (error: Error) => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onError: (error: Error) => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p>Something went wrong. Please try again.</p>
        </div>
      );
    }

    return this.props.children;
  }
}