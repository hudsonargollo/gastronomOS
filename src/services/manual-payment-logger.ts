/**
 * Manual Payment Logger Service
 * Handles logging of payments made through external card machines
 * Provides validation, audit trails, and compliance tracking
 */

import { eq, and } from 'drizzle-orm';
import { 
  payments, 
  orders,
  orderStateTransitions,
  PaymentMethod,
  PaymentStatus,
  OrderState,
  type NewPayment,
  type NewOrderStateTransition
} from '../db/schema';
import { generateId } from '../utils';

// Manual payment specific types
export interface ManualPaymentRequest {
  orderId: string;
  method: 'MANUAL_CARD' | 'CASH';
  amount: number; // in cents
  referenceNumber: string;
  processedBy: string;
  notes?: string;
}

export interface ManualPaymentResult {
  success: boolean;
  paymentId?: string;
  validationResult?: {
    warnings: string[];
    amountMismatch?: boolean;
  };
  error?: string;
  errorCode?: ManualPaymentErrorCode;
}

export interface ManualPaymentValidationResult {
  success: boolean;
  error?: string;
  errorCode?: ManualPaymentErrorCode;
}

export interface ManualPaymentAuditEntry {
  id: string;
  orderId: string;
  paymentId: string;
  method: string;
  amount: number;
  referenceNumber: string;
  processedBy: string;
  timestamp: number;
  notes?: string;
}

export enum ManualPaymentErrorCode {
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  INVALID_ORDER_STATE = 'INVALID_ORDER_STATE',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DUPLICATE_REFERENCE = 'DUPLICATE_REFERENCE',
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS'
}

export class ManualPaymentLogger {
  constructor(private db: any) {}

  /**
   * Log a manual payment entry
   */
  async logPayment(
    tenantId: string, 
    request: ManualPaymentRequest
  ): Promise<ManualPaymentResult> {
    try {
      // Validate request first
      const validation = await this.validatePaymentRequest(tenantId, request);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error,
          errorCode: validation.errorCode
        };
      }

      // Get order details
      const order = await this.getOrderDetails(tenantId, request.orderId);
      if (!order) {
        return {
          success: false,
          error: 'Order not found',
          errorCode: ManualPaymentErrorCode.ORDER_NOT_FOUND
        };
      }

      // Validate order state
      if (order.state === OrderState.CANCELLED) {
        return {
          success: false,
          error: 'Cannot process payment for cancelled order',
          errorCode: ManualPaymentErrorCode.INVALID_ORDER_STATE
        };
      }

      if (order.state === OrderState.DELIVERED) {
        return {
          success: false,
          error: 'Order has already been delivered',
          errorCode: ManualPaymentErrorCode.INVALID_ORDER_STATE
        };
      }

      // Check for duplicate reference number
      const isDuplicate = await this.checkDuplicateReference(tenantId, request.referenceNumber);
      if (isDuplicate) {
        return {
          success: false,
          error: `Reference number ${request.referenceNumber} has already been used`,
          errorCode: ManualPaymentErrorCode.DUPLICATE_REFERENCE
        };
      }

      // Check if order is already fully paid
      const existingPayments = await this.getOrderPayments(tenantId, request.orderId);
      const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
      
      if (totalPaid >= order.totalAmount) {
        return {
          success: false,
          error: 'Order is already fully paid',
          errorCode: ManualPaymentErrorCode.INVALID_ORDER_STATE
        };
      }

      // Create payment record
      const paymentId = generateId();
      const payment: NewPayment = {
        id: paymentId,
        tenantId,
        orderId: request.orderId,
        method: request.method,
        amount: request.amount,
        status: PaymentStatus.COMPLETED,
        gatewayTransactionId: request.referenceNumber,
        gatewayResponse: JSON.stringify({
          type: 'manual_payment',
          referenceNumber: request.referenceNumber,
          notes: request.notes
        }),
        processedBy: request.processedBy,
        createdAt: Date.now(),
        processedAt: Date.now()
      };

      await this.db.insert(payments).values(payment);

      // Create audit trail
      await this.createAuditTrail(tenantId, request, paymentId);

      // Check if order should be marked as delivered
      const newTotalPaid = totalPaid + request.amount;
      let validationResult: ManualPaymentResult['validationResult'] = { warnings: [] };

      if (newTotalPaid >= order.totalAmount && order.state === OrderState.READY) {
        await this.markOrderAsDelivered(tenantId, request.orderId, request.processedBy);
      }

      // Check for amount mismatches and add warnings
      if (request.amount !== order.totalAmount) {
        validationResult.warnings.push(
          `Payment amount (${request.amount / 100}) differs from order total (${order.totalAmount / 100})`
        );
        validationResult.amountMismatch = true;
      }

      if (newTotalPaid > order.totalAmount) {
        validationResult.warnings.push(
          `Total payments (${newTotalPaid / 100}) exceed order total (${order.totalAmount / 100})`
        );
      }

      return {
        success: true,
        paymentId,
        validationResult: validationResult.warnings.length > 0 ? validationResult : undefined
      };

    } catch (error) {
      console.error('Error logging manual payment:', error);
      return {
        success: false,
        error: 'Database error occurred while logging payment',
        errorCode: ManualPaymentErrorCode.DATABASE_ERROR
      };
    }
  }

  /**
   * Validate manual payment request
   */
  private async validatePaymentRequest(
    tenantId: string, 
    request: ManualPaymentRequest
  ): Promise<ManualPaymentValidationResult> {
    // Validate required fields
    if (!request.orderId) {
      return {
        success: false,
        error: 'Order ID is required',
        errorCode: ManualPaymentErrorCode.VALIDATION_ERROR
      };
    }

    if (!request.method) {
      return {
        success: false,
        error: 'Payment method is required',
        errorCode: ManualPaymentErrorCode.VALIDATION_ERROR
      };
    }

    if (!['MANUAL_CARD', 'CASH'].includes(request.method)) {
      return {
        success: false,
        error: 'Invalid payment method for manual payments',
        errorCode: ManualPaymentErrorCode.VALIDATION_ERROR
      };
    }

    if (!request.amount || request.amount <= 0) {
      return {
        success: false,
        error: 'Payment amount must be greater than zero',
        errorCode: ManualPaymentErrorCode.VALIDATION_ERROR
      };
    }

    if (!request.referenceNumber || request.referenceNumber.trim().length === 0) {
      return {
        success: false,
        error: 'Reference number is required',
        errorCode: ManualPaymentErrorCode.VALIDATION_ERROR
      };
    }

    // Validate reference number format
    if (request.referenceNumber.length < 3 || request.referenceNumber.length > 50) {
      return {
        success: false,
        error: 'Reference number must be between 3 and 50 characters',
        errorCode: ManualPaymentErrorCode.VALIDATION_ERROR
      };
    }

    if (!request.processedBy) {
      return {
        success: false,
        error: 'Processed by user ID is required',
        errorCode: ManualPaymentErrorCode.VALIDATION_ERROR
      };
    }

    return { success: true };
  }

  /**
   * Get order details
   */
  private async getOrderDetails(tenantId: string, orderId: string) {
    const result = await this.db
      .select()
      .from(orders)
      .where(and(
        eq(orders.tenantId, tenantId),
        eq(orders.id, orderId)
      ))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Check for duplicate reference number
   */
  private async checkDuplicateReference(tenantId: string, referenceNumber: string): Promise<boolean> {
    const result = await this.db
      .select()
      .from(payments)
      .where(and(
        eq(payments.tenantId, tenantId),
        eq(payments.gatewayTransactionId, referenceNumber)
      ))
      .limit(1);

    return result.length > 0;
  }

  /**
   * Get existing payments for an order
   */
  private async getOrderPayments(tenantId: string, orderId: string) {
    return await this.db
      .select()
      .from(payments)
      .where(and(
        eq(payments.tenantId, tenantId),
        eq(payments.orderId, orderId),
        eq(payments.status, PaymentStatus.COMPLETED)
      ));
  }

  /**
   * Create audit trail for manual payment
   */
  private async createAuditTrail(
    tenantId: string, 
    request: ManualPaymentRequest, 
    paymentId: string
  ): Promise<void> {
    const auditEntry: NewOrderStateTransition = {
      id: generateId(),
      tenantId,
      orderId: request.orderId,
      fromState: null,
      toState: 'MANUAL_PAYMENT_LOGGED' as any, // Custom audit entry
      transitionedBy: request.processedBy,
      transitionedAt: Date.now(),
      reason: 'MANUAL_PAYMENT_LOGGED',
      metadata: JSON.stringify({
        auditType: 'MANUAL_PAYMENT',
        paymentId,
        method: request.method,
        amount: request.amount,
        referenceNumber: request.referenceNumber,
        notes: request.notes
      })
    };

    await this.db.insert(orderStateTransitions).values(auditEntry);
  }

  /**
   * Mark order as delivered when payment is complete
   */
  private async markOrderAsDelivered(
    tenantId: string, 
    orderId: string, 
    processedBy: string
  ): Promise<void> {
    // Update order state
    await this.db
      .update(orders)
      .set({ 
        state: OrderState.DELIVERED,
        updatedAt: Date.now()
      })
      .where(and(
        eq(orders.tenantId, tenantId),
        eq(orders.id, orderId)
      ));

    // Create state transition audit
    const transition: NewOrderStateTransition = {
      id: generateId(),
      tenantId,
      orderId,
      fromState: OrderState.READY,
      toState: OrderState.DELIVERED,
      transitionedBy: processedBy,
      transitionedAt: Date.now(),
      reason: 'Payment completed via manual entry'
    };

    await this.db.insert(orderStateTransitions).values(transition);
  }

  /**
   * Get audit trail for manual payments
   */
  async getAuditTrail(tenantId: string, orderId?: string): Promise<ManualPaymentAuditEntry[]> {
    let whereConditions = [
      eq(orderStateTransitions.tenantId, tenantId),
      eq(orderStateTransitions.reason, 'MANUAL_PAYMENT_LOGGED')
    ];

    if (orderId) {
      whereConditions.push(eq(orderStateTransitions.orderId, orderId));
    }

    const results = await this.db
      .select()
      .from(orderStateTransitions)
      .where(and(...whereConditions))
      .orderBy(orderStateTransitions.transitionedAt);

    return results.map(entry => {
      const metadata = entry.metadata ? JSON.parse(entry.metadata) : {};
      return {
        id: entry.id,
        orderId: entry.orderId,
        paymentId: metadata.paymentId,
        method: metadata.method,
        amount: metadata.amount,
        referenceNumber: metadata.referenceNumber,
        processedBy: entry.transitionedBy || '',
        timestamp: entry.transitionedAt,
        notes: metadata.notes
      };
    });
  }

  /**
   * Validate configuration for manual payment logging
   */
  async validateConfiguration(tenantId: string): Promise<ManualPaymentValidationResult> {
    try {
      // Test database connection
      await this.db.select().from(orders).limit(1);
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'Database connection failed',
        errorCode: ManualPaymentErrorCode.DATABASE_ERROR
      };
    }
  }

  /**
   * Get payment summary for an order
   */
  async getPaymentSummary(tenantId: string, orderId: string) {
    const order = await this.getOrderDetails(tenantId, orderId);
    if (!order) {
      return null;
    }

    const payments = await this.getOrderPayments(tenantId, orderId);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingAmount = Math.max(0, order.totalAmount - totalPaid);

    return {
      orderId,
      orderTotal: order.totalAmount,
      totalPaid,
      remainingAmount,
      isFullyPaid: remainingAmount === 0,
      paymentCount: payments.length,
      payments: payments.map(p => ({
        id: p.id,
        method: p.method,
        amount: p.amount,
        referenceNumber: p.gatewayTransactionId,
        processedAt: p.processedAt,
        processedBy: p.processedBy
      }))
    };
  }

  /**
   * Get payment history for an order
   */
  async getPaymentHistory(tenantId: string, orderId: string) {
    return await this.getOrderPayments(tenantId, orderId);
  }
}