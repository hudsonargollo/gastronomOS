/**
 * User-Friendly Error Messages Component
 * Provides user-friendly error messages with recovery options
 */

'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  RefreshCw, 
  Home, 
  ArrowLeft, 
  HelpCircle, 
  Mail,
  ExternalLink,
  Copy,
  CheckCircle,
  X
} from 'lucide-react';
import { Button } from './button';
import { Card } from './card';
import { Badge } from './badge';
import { Separator } from './separator';

// Error message types
export type ErrorMessageType = 
  | 'validation'
  | 'network'
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'server'
  | 'client'
  | 'timeout'
  | 'rate_limit'
  | 'maintenance'
  | 'unknown';

// Error severity levels
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

// Recovery action types
export type RecoveryActionType = 
  | 'retry'
  | 'refresh'
  | 'navigate'
  | 'contact_support'
  | 'report_issue'
  | 'custom';

// Recovery action interface
export interface RecoveryAction {
  type: RecoveryActionType;
  label: string;
  description?: string;
  action: () => void | Promise<void>;
  isPrimary?: boolean;
  isDestructive?: boolean;
  icon?: React.ReactNode;
}

// User-friendly error message interface
export interface UserFriendlyError {
  id: string;
  type: ErrorMessageType;
  severity: ErrorSeverity;
  title: string;
  message: string;
  details?: string;
  technicalDetails?: string;
  timestamp: number;
  context?: {
    page?: string;
    action?: string;
    userId?: string;
    sessionId?: string;
  };
  recoveryActions: RecoveryAction[];
  showTechnicalDetails?: boolean;
  isDismissible?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
}

// Error message templates
const errorMessageTemplates: Record<ErrorMessageType, {
  title: string;
  getMessage: (details?: string) => string;
  severity: ErrorSeverity;
}> = {
  validation: {
    title: 'Input Error',
    getMessage: (details) => details || 'Please check your input and try again.',
    severity: 'warning',
  },
  network: {
    title: 'Connection Problem',
    getMessage: () => 'We\'re having trouble connecting to our servers. Please check your internet connection and try again.',
    severity: 'error',
  },
  authentication: {
    title: 'Authentication Required',
    getMessage: () => 'You need to sign in to access this feature.',
    severity: 'warning',
  },
  authorization: {
    title: 'Access Denied',
    getMessage: () => 'You don\'t have permission to perform this action.',
    severity: 'error',
  },
  not_found: {
    title: 'Not Found',
    getMessage: (details) => details || 'The page or resource you\'re looking for doesn\'t exist.',
    severity: 'warning',
  },
  server: {
    title: 'Server Error',
    getMessage: () => 'Something went wrong on our end. We\'re working to fix it.',
    severity: 'error',
  },
  client: {
    title: 'Application Error',
    getMessage: () => 'Something unexpected happened. Please try refreshing the page.',
    severity: 'error',
  },
  timeout: {
    title: 'Request Timeout',
    getMessage: () => 'The request took too long to complete. Please try again.',
    severity: 'warning',
  },
  rate_limit: {
    title: 'Too Many Requests',
    getMessage: () => 'You\'re making requests too quickly. Please wait a moment and try again.',
    severity: 'warning',
  },
  maintenance: {
    title: 'Maintenance Mode',
    getMessage: () => 'We\'re currently performing maintenance. Please try again later.',
    severity: 'info',
  },
  unknown: {
    title: 'Unexpected Error',
    getMessage: () => 'Something unexpected happened. Please try again or contact support if the problem persists.',
    severity: 'error',
  },
};

// Error message handler state
interface ErrorMessageHandlerState {
  errors: UserFriendlyError[];
  showTechnicalDetails: boolean;
  globalRecoveryActions: RecoveryAction[];
}

// Context for error message handling
interface ErrorMessageHandlerContextType {
  state: ErrorMessageHandlerState;
  actions: {
    showError: (error: Partial<UserFriendlyError>) => string;
    dismissError: (errorId: string) => void;
    clearAllErrors: () => void;
    setShowTechnicalDetails: (show: boolean) => void;
    addGlobalRecoveryAction: (action: RecoveryAction) => void;
    removeGlobalRecoveryAction: (actionType: RecoveryActionType) => void;
  };
  utils: {
    createErrorFromException: (error: Error, type?: ErrorMessageType, context?: UserFriendlyError['context']) => UserFriendlyError;
    getErrorsByType: (type: ErrorMessageType) => UserFriendlyError[];
    getErrorsBySeverity: (severity: ErrorSeverity) => UserFriendlyError[];
    hasActiveErrors: () => boolean;
  };
}

const ErrorMessageHandlerContext = createContext<ErrorMessageHandlerContextType | undefined>(undefined);

export function useErrorMessageHandler() {
  const context = useContext(ErrorMessageHandlerContext);
  if (!context) {
    throw new Error('useErrorMessageHandler must be used within an ErrorMessageHandlerProvider');
  }
  return context;
}

interface ErrorMessageHandlerProviderProps {
  children: ReactNode;
  showTechnicalDetails?: boolean;
  globalRecoveryActions?: RecoveryAction[];
  onError?: (error: UserFriendlyError) => void;
}

export function ErrorMessageHandlerProvider({
  children,
  showTechnicalDetails = process.env.NODE_ENV === 'development',
  globalRecoveryActions = [],
  onError,
}: ErrorMessageHandlerProviderProps) {
  const [state, setState] = useState<ErrorMessageHandlerState>({
    errors: [],
    showTechnicalDetails,
    globalRecoveryActions: [
      ...getDefaultRecoveryActions(),
      ...globalRecoveryActions,
    ],
  });

  // Default recovery actions
  function getDefaultRecoveryActions(): RecoveryAction[] {
    return [
      {
        type: 'refresh',
        label: 'Refresh Page',
        description: 'Reload the current page',
        action: () => window.location.reload(),
        icon: <RefreshCw className="h-4 w-4" />,
      },
      {
        type: 'navigate',
        label: 'Go Home',
        description: 'Return to the home page',
        action: () => window.location.href = '/',
        icon: <Home className="h-4 w-4" />,
      },
      {
        type: 'contact_support',
        label: 'Contact Support',
        description: 'Get help from our support team',
        action: () => window.open('mailto:support@gastronomos.com', '_blank'),
        icon: <Mail className="h-4 w-4" />,
      },
    ];
  }

  // Generate default recovery actions based on error type
  const generateRecoveryActions = useCallback((
    type: ErrorMessageType,
    context?: UserFriendlyError['context']
  ): RecoveryAction[] => {
    const actions: RecoveryAction[] = [];

    switch (type) {
      case 'network':
        actions.push({
          type: 'retry',
          label: 'Try Again',
          description: 'Retry the failed operation',
          action: () => window.location.reload(),
          isPrimary: true,
          icon: <RefreshCw className="h-4 w-4" />,
        });
        break;

      case 'authentication':
        actions.push({
          type: 'navigate',
          label: 'Sign In',
          description: 'Go to the sign in page',
          action: () => window.location.href = '/login',
          isPrimary: true,
          icon: <ArrowLeft className="h-4 w-4" />,
        });
        break;

      case 'not_found':
        actions.push({
          type: 'navigate',
          label: 'Go Back',
          description: 'Return to the previous page',
          action: () => window.history.back(),
          isPrimary: true,
          icon: <ArrowLeft className="h-4 w-4" />,
        });
        break;

      case 'server':
      case 'timeout':
        actions.push({
          type: 'retry',
          label: 'Try Again',
          description: 'Retry the failed operation',
          action: () => window.location.reload(),
          isPrimary: true,
          icon: <RefreshCw className="h-4 w-4" />,
        });
        actions.push({
          type: 'report_issue',
          label: 'Report Issue',
          description: 'Let us know about this problem',
          action: () => {
            // In a real app, this would open a bug report form
            console.log('Report issue:', { type, context });
          },
          icon: <HelpCircle className="h-4 w-4" />,
        });
        break;

      case 'rate_limit':
        actions.push({
          type: 'custom',
          label: 'Wait and Retry',
          description: 'Wait a moment before trying again',
          action: async () => {
            await new Promise(resolve => setTimeout(resolve, 5000));
            window.location.reload();
          },
          isPrimary: true,
          icon: <RefreshCw className="h-4 w-4" />,
        });
        break;
    }

    return actions;
  }, []);

  // Context actions
  const actions = {
    showError: (errorData: Partial<UserFriendlyError>): string => {
      const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const template = errorMessageTemplates[errorData.type || 'unknown'];
      
      const error: UserFriendlyError = {
        id: errorId,
        type: errorData.type || 'unknown',
        severity: errorData.severity || template.severity,
        title: errorData.title || template.title,
        message: errorData.message || template.getMessage(errorData.details),
        details: errorData.details,
        technicalDetails: errorData.technicalDetails,
        timestamp: Date.now(),
        context: errorData.context,
        recoveryActions: errorData.recoveryActions || [
          ...generateRecoveryActions(errorData.type || 'unknown', errorData.context),
          ...state.globalRecoveryActions,
        ],
        showTechnicalDetails: errorData.showTechnicalDetails ?? state.showTechnicalDetails,
        isDismissible: errorData.isDismissible ?? true,
        autoHide: errorData.autoHide ?? false,
        autoHideDelay: errorData.autoHideDelay ?? 5000,
      };

      setState(prev => ({
        ...prev,
        errors: [...prev.errors, error],
      }));

      // Auto-hide if configured
      if (error.autoHide) {
        setTimeout(() => {
          actions.dismissError(errorId);
        }, error.autoHideDelay);
      }

      // Call custom error handler
      if (onError) {
        onError(error);
      }

      return errorId;
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
      }));
    },

    setShowTechnicalDetails: (show: boolean) => {
      setState(prev => ({
        ...prev,
        showTechnicalDetails: show,
      }));
    },

    addGlobalRecoveryAction: (action: RecoveryAction) => {
      setState(prev => ({
        ...prev,
        globalRecoveryActions: [...prev.globalRecoveryActions, action],
      }));
    },

    removeGlobalRecoveryAction: (actionType: RecoveryActionType) => {
      setState(prev => ({
        ...prev,
        globalRecoveryActions: prev.globalRecoveryActions.filter(a => a.type !== actionType),
      }));
    },
  };

  // Context utilities
  const utils = {
    createErrorFromException: (
      error: Error,
      type: ErrorMessageType = 'unknown',
      context?: UserFriendlyError['context']
    ): UserFriendlyError => {
      const template = errorMessageTemplates[type];
      
      return {
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        severity: template.severity,
        title: template.title,
        message: template.getMessage(),
        details: error.message,
        technicalDetails: error.stack,
        timestamp: Date.now(),
        context,
        recoveryActions: [
          ...generateRecoveryActions(type, context),
          ...state.globalRecoveryActions,
        ],
        showTechnicalDetails: state.showTechnicalDetails,
        isDismissible: true,
        autoHide: false,
      };
    },

    getErrorsByType: (type: ErrorMessageType) => 
      state.errors.filter(error => error.type === type),

    getErrorsBySeverity: (severity: ErrorSeverity) => 
      state.errors.filter(error => error.severity === severity),

    hasActiveErrors: () => state.errors.length > 0,
  };

  const contextValue: ErrorMessageHandlerContextType = {
    state,
    actions,
    utils,
  };

  return (
    <ErrorMessageHandlerContext.Provider value={contextValue}>
      {children}
      <ErrorMessageDisplay />
    </ErrorMessageHandlerContext.Provider>
  );
}

// Error message display component
function ErrorMessageDisplay() {
  const { state, actions } = useErrorMessageHandler();
  const [copiedErrorId, setCopiedErrorId] = useState<string | null>(null);

  const getSeverityColor = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50 text-red-900';
      case 'error': return 'border-red-400 bg-red-50 text-red-800';
      case 'warning': return 'border-yellow-400 bg-yellow-50 text-yellow-800';
      case 'info': return 'border-blue-400 bg-blue-50 text-blue-800';
      default: return 'border-gray-400 bg-gray-50 text-gray-800';
    }
  };

  const getSeverityIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'critical':
      case 'error':
        return <AlertTriangle className="h-5 w-5" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />;
      case 'info':
        return <HelpCircle className="h-5 w-5" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const copyErrorDetails = async (error: UserFriendlyError) => {
    const errorDetails = {
      id: error.id,
      type: error.type,
      severity: error.severity,
      title: error.title,
      message: error.message,
      details: error.details,
      technicalDetails: error.technicalDetails,
      timestamp: new Date(error.timestamp).toISOString(),
      context: error.context,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2));
      setCopiedErrorId(error.id);
      setTimeout(() => setCopiedErrorId(null), 2000);
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  };

  const executeRecoveryAction = async (action: RecoveryAction) => {
    try {
      await action.action();
    } catch (error) {
      console.error('Recovery action failed:', error);
      actions.showError({
        type: 'unknown',
        title: 'Recovery Failed',
        message: 'The recovery action failed to execute. Please try a different option.',
        technicalDetails: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 space-y-4 max-w-2xl w-full px-4">
      <AnimatePresence>
        {state.errors.map((error) => (
          <motion.div
            key={error.id}
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <Card className={`border-l-4 ${getSeverityColor(error.severity)}`}>
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    {getSeverityIcon(error.severity)}
                  </div>
                  
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{error.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {error.type}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {error.severity}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(error.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      
                      {error.isDismissible && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => actions.dismissError(error.id)}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <p className="text-sm leading-relaxed">{error.message}</p>

                    {error.details && (
                      <div className="p-3 bg-muted rounded-md">
                        <p className="text-sm text-muted-foreground">{error.details}</p>
                      </div>
                    )}

                    {error.showTechnicalDetails && error.technicalDetails && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground mb-2">
                          Technical Details
                        </summary>
                        <div className="p-3 bg-muted rounded-md font-mono text-xs overflow-auto max-h-32">
                          <pre className="whitespace-pre-wrap">{error.technicalDetails}</pre>
                        </div>
                      </details>
                    )}

                    {error.recoveryActions.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm">What would you like to do?</h4>
                          <div className="flex flex-wrap gap-2">
                            {error.recoveryActions.slice(0, 3).map((action, index) => (
                              <Button
                                key={index}
                                variant={action.isPrimary ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => executeRecoveryAction(action)}
                                className="h-8"
                              >
                                {action.icon && <span className="mr-2">{action.icon}</span>}
                                {action.label}
                              </Button>
                            ))}
                            
                            {error.showTechnicalDetails && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyErrorDetails(error)}
                                className="h-8"
                              >
                                {copiedErrorId === error.id ? (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Copied!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Copy Details
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                          
                          {error.recoveryActions.length > 3 && (
                            <details>
                              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                                More options ({error.recoveryActions.length - 3})
                              </summary>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {error.recoveryActions.slice(3).map((action, index) => (
                                  <Button
                                    key={index + 3}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => executeRecoveryAction(action)}
                                    className="h-8"
                                  >
                                    {action.icon && <span className="mr-2">{action.icon}</span>}
                                    {action.label}
                                  </Button>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      </>
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

// Hook for easy error reporting
export function useErrorReporting() {
  const { actions, utils } = useErrorMessageHandler();

  const reportError = useCallback((
    error: Error | string,
    type: ErrorMessageType = 'unknown',
    context?: UserFriendlyError['context']
  ) => {
    if (typeof error === 'string') {
      return actions.showError({
        type,
        message: error,
        context,
      });
    } else {
      const userFriendlyError = utils.createErrorFromException(error, type, context);
      return actions.showError(userFriendlyError);
    }
  }, [actions, utils]);

  const reportValidationError = useCallback((message: string, details?: string) => {
    return actions.showError({
      type: 'validation',
      message,
      details,
      autoHide: true,
      autoHideDelay: 3000,
    });
  }, [actions]);

  const reportNetworkError = useCallback((context?: UserFriendlyError['context']) => {
    return actions.showError({
      type: 'network',
      context,
    });
  }, [actions]);

  const reportServerError = useCallback((context?: UserFriendlyError['context']) => {
    return actions.showError({
      type: 'server',
      context,
    });
  }, [actions]);

  return {
    reportError,
    reportValidationError,
    reportNetworkError,
    reportServerError,
    dismissError: actions.dismissError,
    clearAllErrors: actions.clearAllErrors,
  };
}

// Higher-order component for automatic error reporting
export function withErrorReporting<P extends object>(
  Component: React.ComponentType<P>,
  errorType: ErrorMessageType = 'unknown'
) {
  const WrappedComponent = (props: P) => {
    const { reportError } = useErrorReporting();

    const handleError = (error: Error) => {
      reportError(error, errorType);
    };

    return (
      <ErrorReportingBoundary onError={handleError}>
        <Component {...props} />
      </ErrorReportingBoundary>
    );
  };

  WrappedComponent.displayName = `withErrorReporting(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Simple error boundary for error reporting
class ErrorReportingBoundary extends React.Component<
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
        <div className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-4">
            We've been notified about this error and are working to fix it.
          </p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}