/**
 * System Resilience Service
 * Comprehensive error handling and recovery mechanisms for the Digital Menu, Kitchen Orchestration & Payment System
 * 
 * Implements:
 * - Payment gateway error handling with fallbacks (Requirement 15.1)
 * - Inventory system error recovery (Requirement 15.2)
 * - Retry mechanisms with exponential backoff (Requirement 15.3)
 * - Comprehensive error logging (Requirement 15.4)
 * 
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4
 */

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: string;
  errorCode?: string;
  attemptsMade: number;
  totalDurationMs: number;
}

export interface ErrorContext {
  service: string;
  operation: string;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface SystemError {
  id: string;
  timestamp: number;
  context: ErrorContext;
  error: string;
  errorCode?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  stack?: string;
  attemptNumber?: number;
  recoveryAction?: string;
}

/**
 * Default retry configuration with exponential backoff
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 16000,
  backoffMultiplier: 2
};

/**
 * Payment gateway specific retry configuration
 */
export const PAYMENT_GATEWAY_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 16000,
  backoffMultiplier: 2,
  retryableErrors: [
    'GATEWAY_TIMEOUT',
    'NETWORK_ERROR',
    'TEMPORARY_UNAVAILABLE',
    'RATE_LIMIT_EXCEEDED'
  ]
};

/**
 * Inventory system retry configuration
 */
export const INVENTORY_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 8000,
  backoffMultiplier: 2,
  retryableErrors: [
    'LOCK_TIMEOUT',
    'DEADLOCK_DETECTED',
    'TEMPORARY_UNAVAILABLE',
    'CONNECTION_ERROR'
  ]
};

/**
 * System Resilience Service
 */
export class SystemResilienceService {
  private errorLog: SystemError[] = [];
  private readonly MAX_ERROR_LOG_SIZE = 1000;

  /**
   * Execute operation with retry logic and exponential backoff
   * Validates: Requirement 15.3
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    config: RetryConfig = DEFAULT_RETRY_CONFIG
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    let attemptsMade = 0;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      attemptsMade = attempt + 1;

      try {
        const result = await operation();
        
        // Log successful recovery if this wasn't the first attempt
        if (attempt > 0) {
          this.logError({
            context,
            error: `Operation succeeded after ${attempt} retries`,
            errorCode: 'RECOVERY_SUCCESS',
            severity: 'LOW',
            attemptNumber: attemptsMade,
            recoveryAction: 'Retry with exponential backoff'
          });
        }

        return {
          success: true,
          result,
          attemptsMade,
          totalDurationMs: Date.now() - startTime
        };
      } catch (error) {
        lastError = error as Error;
        const errorCode = (error as any).code || 'UNKNOWN_ERROR';

        // Check if error is retryable
        if (config.retryableErrors && !config.retryableErrors.includes(errorCode)) {
          // Non-retryable error, fail immediately
          this.logError({
            context,
            error: lastError.message,
            errorCode,
            severity: 'HIGH',
            stack: lastError.stack,
            attemptNumber: attemptsMade,
            recoveryAction: 'Non-retryable error, operation failed'
          });

          return {
            success: false,
            error: lastError.message,
            errorCode,
            attemptsMade,
            totalDurationMs: Date.now() - startTime
          };
        }

        // Log retry attempt
        this.logError({
          context,
          error: lastError.message,
          errorCode,
          severity: attempt < config.maxRetries ? 'MEDIUM' : 'HIGH',
          stack: lastError.stack,
          attemptNumber: attemptsMade,
          recoveryAction: attempt < config.maxRetries ? 'Retrying with exponential backoff' : 'Max retries exceeded'
        });

        // If not the last attempt, wait before retrying
        if (attempt < config.maxRetries) {
          const delay = Math.min(
            config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
            config.maxDelayMs
          );
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    return {
      success: false,
      error: lastError?.message || 'Operation failed after retries',
      errorCode: (lastError as any)?.code || 'MAX_RETRIES_EXCEEDED',
      attemptsMade,
      totalDurationMs: Date.now() - startTime
    };
  }

  /**
   * Execute payment gateway operation with fallback to manual payment
   * Validates: Requirement 15.1
   */
  async executePaymentWithFallback<T>(
    gatewayOperation: () => Promise<T>,
    context: ErrorContext
  ): Promise<{
    success: boolean;
    result?: T;
    fallbackRequired: boolean;
    fallbackReason?: string;
    error?: string;
    errorCode?: string;
  }> {
    // Try payment gateway with retry
    const retryResult = await this.executeWithRetry(
      gatewayOperation,
      { ...context, service: 'payment-gateway' },
      PAYMENT_GATEWAY_RETRY_CONFIG
    );

    if (retryResult.success) {
      return {
        success: true,
        result: retryResult.result,
        fallbackRequired: false
      };
    }

    // Payment gateway failed, log and indicate fallback required
    this.logError({
      context: { ...context, service: 'payment-gateway' },
      error: `Payment gateway unavailable: ${retryResult.error}`,
      errorCode: retryResult.errorCode || 'GATEWAY_UNAVAILABLE',
      severity: 'HIGH',
      attemptNumber: retryResult.attemptsMade,
      recoveryAction: 'Fallback to manual payment logging'
    });

    return {
      success: false,
      fallbackRequired: true,
      fallbackReason: 'Payment gateway is currently unavailable. Please use manual payment logging.',
      error: retryResult.error,
      errorCode: retryResult.errorCode
    };
  }

  /**
   * Execute inventory operation with override capability
   * Validates: Requirement 15.2
   */
  async executeInventoryWithOverride<T>(
    inventoryOperation: () => Promise<T>,
    context: ErrorContext,
    allowOverride: boolean = true
  ): Promise<{
    success: boolean;
    result?: T;
    overrideRequired: boolean;
    overrideWarning?: string;
    error?: string;
    errorCode?: string;
  }> {
    // Try inventory operation with retry
    const retryResult = await this.executeWithRetry(
      inventoryOperation,
      { ...context, service: 'inventory-system' },
      INVENTORY_RETRY_CONFIG
    );

    if (retryResult.success) {
      return {
        success: true,
        result: retryResult.result,
        overrideRequired: false
      };
    }

    // Inventory system failed
    const severity = allowOverride ? 'MEDIUM' : 'HIGH';
    
    this.logError({
      context: { ...context, service: 'inventory-system' },
      error: `Inventory system unavailable: ${retryResult.error}`,
      errorCode: retryResult.errorCode || 'INVENTORY_UNAVAILABLE',
      severity,
      attemptNumber: retryResult.attemptsMade,
      recoveryAction: allowOverride 
        ? 'Manual override available with warning' 
        : 'Operation blocked - inventory system required'
    });

    if (allowOverride) {
      return {
        success: false,
        overrideRequired: true,
        overrideWarning: 'WARNING: Inventory system is unavailable. Manual override will bypass inventory checks. Ensure sufficient stock before proceeding.',
        error: retryResult.error,
        errorCode: retryResult.errorCode
      };
    }

    return {
      success: false,
      overrideRequired: false,
      error: retryResult.error,
      errorCode: retryResult.errorCode
    };
  }

  /**
   * Execute order state transition with error recovery
   */
  async executeOrderStateTransition<T>(
    stateOperation: () => Promise<T>,
    context: ErrorContext
  ): Promise<RetryResult<T>> {
    return this.executeWithRetry(
      stateOperation,
      { ...context, service: 'order-state-engine' },
      {
        maxRetries: 3,
        initialDelayMs: 500,
        maxDelayMs: 4000,
        backoffMultiplier: 2,
        retryableErrors: [
          'CONCURRENT_MODIFICATION',
          'LOCK_TIMEOUT',
          'TEMPORARY_UNAVAILABLE'
        ]
      }
    );
  }

  /**
   * Execute WebSocket broadcast with retry
   */
  async executeWebSocketBroadcast<T>(
    broadcastOperation: () => Promise<T>,
    context: ErrorContext
  ): Promise<RetryResult<T>> {
    return this.executeWithRetry(
      broadcastOperation,
      { ...context, service: 'websocket' },
      {
        maxRetries: 2,
        initialDelayMs: 500,
        maxDelayMs: 2000,
        backoffMultiplier: 2,
        retryableErrors: [
          'CONNECTION_ERROR',
          'TEMPORARY_UNAVAILABLE',
          'NETWORK_ERROR'
        ]
      }
    );
  }

  /**
   * Log error with detailed context
   * Validates: Requirement 15.4
   */
  logError(params: {
    context: ErrorContext;
    error: string;
    errorCode?: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    stack?: string;
    attemptNumber?: number;
    recoveryAction?: string;
  }): void {
    const systemError: SystemError = {
      id: this.generateErrorId(),
      timestamp: Date.now(),
      context: params.context,
      error: params.error,
      errorCode: params.errorCode,
      severity: params.severity,
      stack: params.stack,
      attemptNumber: params.attemptNumber,
      recoveryAction: params.recoveryAction
    };

    // Add to in-memory log
    this.errorLog.push(systemError);

    // Trim log if it exceeds max size
    if (this.errorLog.length > this.MAX_ERROR_LOG_SIZE) {
      this.errorLog = this.errorLog.slice(-this.MAX_ERROR_LOG_SIZE);
    }

    // Log to console with structured format
    const logLevel = this.getLogLevel(params.severity);
    console[logLevel]('System Error:', {
      errorId: systemError.id,
      timestamp: new Date(systemError.timestamp).toISOString(),
      service: params.context.service,
      operation: params.context.operation,
      tenantId: params.context.tenantId,
      userId: params.context.userId,
      error: params.error,
      errorCode: params.errorCode,
      severity: params.severity,
      attemptNumber: params.attemptNumber,
      recoveryAction: params.recoveryAction,
      metadata: params.context.metadata
    });
  }

  /**
   * Get recent errors for monitoring
   */
  getRecentErrors(limit: number = 100): SystemError[] {
    return this.errorLog.slice(-limit);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', limit: number = 100): SystemError[] {
    return this.errorLog
      .filter(error => error.severity === severity)
      .slice(-limit);
  }

  /**
   * Get errors by service
   */
  getErrorsByService(service: string, limit: number = 100): SystemError[] {
    return this.errorLog
      .filter(error => error.context.service === service)
      .slice(-limit);
  }

  /**
   * Get errors by tenant
   */
  getErrorsByTenant(tenantId: string, limit: number = 100): SystemError[] {
    return this.errorLog
      .filter(error => error.context.tenantId === tenantId)
      .slice(-limit);
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    total: number;
    bySeverity: Record<string, number>;
    byService: Record<string, number>;
    recentErrors: SystemError[];
  } {
    const bySeverity: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0
    };

    const byService: Record<string, number> = {};

    for (const error of this.errorLog) {
      bySeverity[error.severity]++;
      byService[error.context.service] = (byService[error.context.service] || 0) + 1;
    }

    return {
      total: this.errorLog.length,
      bySeverity,
      byService,
      recentErrors: this.getRecentErrors(10)
    };
  }

  // Private helper methods

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getLogLevel(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): 'log' | 'warn' | 'error' {
    switch (severity) {
      case 'LOW':
        return 'log';
      case 'MEDIUM':
        return 'warn';
      case 'HIGH':
      case 'CRITICAL':
        return 'error';
    }
  }
}

/**
 * Factory function to create SystemResilienceService instance
 */
export function createSystemResilienceService(): SystemResilienceService {
  return new SystemResilienceService();
}
