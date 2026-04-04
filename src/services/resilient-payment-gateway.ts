/**
 * Resilient Payment Gateway Service
 * Wraps PaymentGatewayService with error handling and fallback mechanisms
 * 
 * Implements:
 * - Automatic retry with exponential backoff
 * - Graceful fallback to manual payment logging
 * - Comprehensive error logging
 * 
 * Validates: Requirements 15.1, 15.3, 15.4
 */

import { PaymentGatewayService, type PaymentProcessingRequest, type PaymentProcessingResult } from './payment-gateway';
import { SystemResilienceService } from './system-resilience';

export interface ResilientPaymentResult extends PaymentProcessingResult {
  fallbackRequired?: boolean;
  fallbackReason?: string;
  attemptsMade?: number;
  totalDurationMs?: number;
}

export class ResilientPaymentGatewayService {
  private resilienceService: SystemResilienceService;

  constructor(
    private paymentGateway: PaymentGatewayService,
    resilienceService?: SystemResilienceService
  ) {
    this.resilienceService = resilienceService || new SystemResilienceService();
  }

  /**
   * Process payment with automatic retry and fallback
   * Validates: Requirement 15.1
   */
  async processPayment(
    tenantId: string,
    request: PaymentProcessingRequest
  ): Promise<ResilientPaymentResult> {
    const context = {
      service: 'payment-gateway',
      operation: 'processPayment',
      tenantId,
      metadata: {
        orderId: request.orderId,
        amount: request.amount,
        method: request.method
      }
    };

    // Execute payment with fallback capability
    const result = await this.resilienceService.executePaymentWithFallback(
      () => this.paymentGateway.processPayment(tenantId, request),
      context
    );

    if (result.success && result.result) {
      return {
        ...result.result,
        fallbackRequired: false
      };
    }

    // Payment gateway failed, return result with fallback indication
    return {
      success: false,
      status: 'FAILED' as any,
      error: result.error,
      errorCode: result.errorCode,
      fallbackRequired: result.fallbackRequired,
      fallbackReason: result.fallbackReason
    };
  }

  /**
   * Get payment status with retry
   */
  async getPaymentStatus(
    tenantId: string,
    gatewayTransactionId: string
  ): Promise<{
    status: any;
    gatewayResponse?: any;
    error?: string;
    attemptsMade?: number;
  }> {
    const context = {
      service: 'payment-gateway',
      operation: 'getPaymentStatus',
      tenantId,
      metadata: {
        gatewayTransactionId
      }
    };

    const result = await this.resilienceService.executeWithRetry(
      () => this.paymentGateway.getPaymentStatus(tenantId, gatewayTransactionId),
      context
    );

    if (result.success && result.result) {
      return {
        ...result.result,
        attemptsMade: result.attemptsMade
      };
    }

    return {
      status: 'FAILED',
      error: result.error,
      attemptsMade: result.attemptsMade
    };
  }

  /**
   * Cancel payment with retry
   */
  async cancelPayment(
    tenantId: string,
    gatewayTransactionId: string
  ): Promise<{
    success: boolean;
    error?: string;
    attemptsMade?: number;
  }> {
    const context = {
      service: 'payment-gateway',
      operation: 'cancelPayment',
      tenantId,
      metadata: {
        gatewayTransactionId
      }
    };

    const result = await this.resilienceService.executeWithRetry(
      () => this.paymentGateway.cancelPayment(tenantId, gatewayTransactionId),
      context
    );

    if (result.success && result.result) {
      return {
        ...result.result,
        attemptsMade: result.attemptsMade
      };
    }

    return {
      success: false,
      error: result.error,
      attemptsMade: result.attemptsMade
    };
  }

  /**
   * Refund payment with retry
   */
  async refundPayment(
    tenantId: string,
    gatewayTransactionId: string,
    amount?: number
  ): Promise<{
    success: boolean;
    refundId?: string;
    error?: string;
    attemptsMade?: number;
  }> {
    const context = {
      service: 'payment-gateway',
      operation: 'refundPayment',
      tenantId,
      metadata: {
        gatewayTransactionId,
        amount
      }
    };

    const result = await this.resilienceService.executeWithRetry(
      () => this.paymentGateway.refundPayment(tenantId, gatewayTransactionId, amount),
      context
    );

    if (result.success && result.result) {
      return {
        ...result.result,
        attemptsMade: result.attemptsMade
      };
    }

    return {
      success: false,
      error: result.error,
      attemptsMade: result.attemptsMade
    };
  }

  /**
   * Check if gateway is available
   */
  async isGatewayAvailable(tenantId: string): Promise<boolean> {
    try {
      return await this.paymentGateway.isGatewayAvailable(tenantId);
    } catch (error) {
      this.resilienceService.logError({
        context: {
          service: 'payment-gateway',
          operation: 'isGatewayAvailable',
          tenantId
        },
        error: error instanceof Error ? error.message : 'Gateway availability check failed',
        severity: 'MEDIUM'
      });
      return false;
    }
  }

  /**
   * Validate gateway configuration
   */
  async validateConfiguration(tenantId: string): Promise<{
    isValid: boolean;
    error?: string;
    errorCode?: string;
  }> {
    const context = {
      service: 'payment-gateway',
      operation: 'validateConfiguration',
      tenantId
    };

    const result = await this.resilienceService.executeWithRetry(
      () => this.paymentGateway.validateConfiguration(tenantId),
      context
    );

    if (result.success && result.result) {
      return result.result;
    }

    return {
      isValid: false,
      error: result.error,
      errorCode: result.errorCode
    };
  }
}

/**
 * Factory function to create ResilientPaymentGatewayService
 */
export function createResilientPaymentGateway(
  paymentGateway: PaymentGatewayService,
  resilienceService?: SystemResilienceService
): ResilientPaymentGatewayService {
  return new ResilientPaymentGatewayService(paymentGateway, resilienceService);
}
