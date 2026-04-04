/**
 * Split Payment Manager Service
 * Handles multiple partial payments for a single order with real-time balance tracking
 * Supports mixed payment methods within a single split payment session
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { eq, and } from 'drizzle-orm';
import { 
  payments, 
  splitPayments, 
  orders,
  orderStateTransitions,
  PaymentMethod,
  PaymentStatus,
  OrderState,
  type Payment,
  type SplitPayment,
  type NewPayment,
  type NewSplitPayment,
  type NewOrderStateTransition
} from '../db/schema';
import { generateId } from '../utils';

// Split payment request types
export interface SplitPaymentRequest {
  orderId: string;
  method: PaymentMethod;
  amount: number; // in cents
  processedBy: string;
  customerEmail?: string;
  cardToken?: string; // For card payments
  installments?: number; // For credit card
  issuerId?: string;
  notes?: string;
}

export interface SplitPaymentResult {
  success: boolean;
  paymentId?: string;
  splitPaymentId?: string;
  balanceInfo?: BalanceInfo;
  changeAmount?: number; // in cents, when overpayment occurs
  error?: string;
  errorCode?: SplitPaymentErrorCode;
}

export interface BalanceInfo {
  totalAmount: number; // in cents
  paidAmount: number; // in cents
  remainingAmount: number; // in cents
  isComplete: boolean;
  paymentCount: number;
  payments: PaymentSummary[];
}

export interface PaymentSummary {
  id: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  createdAt: number;
  processedAt?: number;
}

export interface SplitPaymentStatus {
  id: string;
  orderId: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  isComplete: boolean;
  payments: PaymentSummary[];
  createdAt: number;
  completedAt?: number;
}

export enum SplitPaymentErrorCode {
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  INVALID_ORDER_STATE = 'INVALID_ORDER_STATE',
  PAYMENT_ALREADY_COMPLETE = 'PAYMENT_ALREADY_COMPLETE',
  INVALID_PAYMENT_AMOUNT = 'INVALID_PAYMENT_AMOUNT',
  PAYMENT_PROCESSING_FAILED = 'PAYMENT_PROCESSING_FAILED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  SPLIT_PAYMENT_NOT_FOUND = 'SPLIT_PAYMENT_NOT_FOUND'
}

/**
 * SplitPaymentManager class
 * Manages split payments with real-time balance tracking
 */
export class SplitPaymentManager {
  constructor(
    private db: any,
    private paymentGatewayService?: any // Optional PaymentGatewayService for gateway payments
  ) {}

  /**
   * Initialize a split payment session for an order
   * Creates a new split payment record if one doesn't exist
   */
  async initializeSplitPayment(
    tenantId: string,
    orderId: string
  ): Promise<{ success: boolean; splitPaymentId?: string; error?: string }> {
    try {
      // Check if split payment already exists
      const existing = await this.getSplitPaymentByOrder(tenantId, orderId);
      if (existing) {
        return { success: true, splitPaymentId: existing.id };
      }

      // Get order details
      const order = await this.getOrderDetails(tenantId, orderId);
      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      // Create new split payment record
      const splitPaymentId = generateId();
      const now = Date.now();
      
      const newSplitPayment: NewSplitPayment = {
        id: splitPaymentId,
        tenantId,
        orderId,
        totalAmount: order.totalAmount,
        paidAmount: 0,
        remainingAmount: order.totalAmount,
        isComplete: false,
        createdAt: now
      };

      await this.db.insert(splitPayments).values(newSplitPayment);

      return { success: true, splitPaymentId };
    } catch (error) {
      console.error('Error initializing split payment:', error);
      return { success: false, error: 'Failed to initialize split payment' };
    }
  }

  /**
   * Process a partial payment for an order
   * Supports mixed payment methods within a single split payment session
   */
  async processPayment(
    tenantId: string,
    request: SplitPaymentRequest
  ): Promise<SplitPaymentResult> {
    try {
      // Validate request
      const validation = this.validatePaymentRequest(request);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error,
          errorCode: SplitPaymentErrorCode.VALIDATION_ERROR
        };
      }

      // Get order details
      const order = await this.getOrderDetails(tenantId, request.orderId);
      if (!order) {
        return {
          success: false,
          error: 'Order not found',
          errorCode: SplitPaymentErrorCode.ORDER_NOT_FOUND
        };
      }

      // Validate order state - must be READY or earlier
      if (order.state === OrderState.CANCELLED) {
        return {
          success: false,
          error: 'Cannot process payment for cancelled order',
          errorCode: SplitPaymentErrorCode.INVALID_ORDER_STATE
        };
      }

      if (order.state === OrderState.DELIVERED) {
        return {
          success: false,
          error: 'Order has already been delivered',
          errorCode: SplitPaymentErrorCode.INVALID_ORDER_STATE
        };
      }

      // Initialize or get split payment
      const initResult = await this.initializeSplitPayment(tenantId, request.orderId);
      if (!initResult.success) {
        return {
          success: false,
          error: initResult.error,
          errorCode: SplitPaymentErrorCode.DATABASE_ERROR
        };
      }

      const splitPaymentId = initResult.splitPaymentId!;

      // Get current balance
      const balanceInfo = await this.getBalanceInfo(tenantId, request.orderId);
      if (!balanceInfo) {
        return {
          success: false,
          error: 'Failed to get payment balance',
          errorCode: SplitPaymentErrorCode.DATABASE_ERROR
        };
      }

      // Check if already fully paid
      if (balanceInfo.isComplete) {
        return {
          success: false,
          error: 'Order is already fully paid',
          errorCode: SplitPaymentErrorCode.PAYMENT_ALREADY_COMPLETE
        };
      }

      // Validate payment amount
      if (request.amount <= 0) {
        return {
          success: false,
          error: 'Payment amount must be greater than zero',
          errorCode: SplitPaymentErrorCode.INVALID_PAYMENT_AMOUNT
        };
      }

      // Process payment based on method
      let paymentStatus = PaymentStatus.COMPLETED;
      let gatewayTransactionId: string | undefined;
      let gatewayResponse: any;

      // For PIX, CREDIT_CARD, DEBIT_CARD - use payment gateway if available
      if ([PaymentMethod.PIX, PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD].includes(request.method)) {
        if (this.paymentGatewayService) {
          const gatewayResult = await this.paymentGatewayService.processPayment(tenantId, {
            orderId: request.orderId,
            amount: request.amount,
            method: request.method,
            description: `Split payment for order ${request.orderId}`,
            customerEmail: request.customerEmail || 'customer@example.com',
            cardToken: request.cardToken,
            installments: request.installments,
            issuerId: request.issuerId
          });

          if (!gatewayResult.success) {
            return {
              success: false,
              error: gatewayResult.error || 'Payment gateway processing failed',
              errorCode: SplitPaymentErrorCode.PAYMENT_PROCESSING_FAILED
            };
          }

          paymentStatus = gatewayResult.status;
          gatewayTransactionId = gatewayResult.gatewayTransactionId;
          gatewayResponse = gatewayResult.gatewayResponse;
        } else {
          // No gateway configured - mark as manual entry
          gatewayTransactionId = `manual_${generateId()}`;
          gatewayResponse = { type: 'manual', method: request.method };
        }
      } else {
        // For MANUAL_CARD and CASH - generate reference
        gatewayTransactionId = `manual_${generateId()}`;
        gatewayResponse = { type: 'manual', method: request.method, notes: request.notes };
      }

      // Create payment record
      const paymentId = generateId();
      const now = Date.now();

      const newPayment: NewPayment = {
        id: paymentId,
        tenantId,
        orderId: request.orderId,
        method: request.method,
        amount: request.amount,
        status: paymentStatus,
        gatewayTransactionId,
        gatewayResponse: gatewayResponse ? JSON.stringify(gatewayResponse) : undefined,
        processedBy: request.processedBy,
        createdAt: now,
        processedAt: paymentStatus === PaymentStatus.COMPLETED ? now : undefined
      };

      await this.db.insert(payments).values(newPayment);

      // Update split payment balance
      const newPaidAmount = balanceInfo.paidAmount + request.amount;
      const newRemainingAmount = Math.max(0, balanceInfo.totalAmount - newPaidAmount);
      const isComplete = newPaidAmount >= balanceInfo.totalAmount;

      await this.db.update(splitPayments)
        .set({
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          isComplete,
          completedAt: isComplete ? now : undefined
        })
        .where(eq(splitPayments.id, splitPaymentId));

      // Calculate change if overpayment
      let changeAmount: number | undefined;
      if (newPaidAmount > balanceInfo.totalAmount) {
        changeAmount = newPaidAmount - balanceInfo.totalAmount;
      }

      // If payment is complete and order is READY, transition to DELIVERED
      if (isComplete && order.state === OrderState.READY) {
        await this.markOrderAsDelivered(tenantId, request.orderId, request.processedBy);
      }

      // Get updated balance info
      const updatedBalance = await this.getBalanceInfo(tenantId, request.orderId);

      return {
        success: true,
        paymentId,
        splitPaymentId,
        balanceInfo: updatedBalance || undefined,
        changeAmount
      };
    } catch (error) {
      console.error('Error processing split payment:', error);
      return {
        success: false,
        error: 'Database error occurred while processing payment',
        errorCode: SplitPaymentErrorCode.DATABASE_ERROR
      };
    }
  }

  /**
   * Get real-time balance information for an order
   * Requirement 7.2: Track remaining balance in real-time
   */
  async getBalanceInfo(tenantId: string, orderId: string): Promise<BalanceInfo | null> {
    try {
      const splitPayment = await this.getSplitPaymentByOrder(tenantId, orderId);
      if (!splitPayment) {
        // Get order to create initial balance info
        const order = await this.getOrderDetails(tenantId, orderId);
        if (!order) {
          return null;
        }
        
        return {
          totalAmount: order.totalAmount,
          paidAmount: 0,
          remainingAmount: order.totalAmount,
          isComplete: false,
          paymentCount: 0,
          payments: []
        };
      }

      // Get all completed payments for this order
      const orderPayments = await this.getOrderPayments(tenantId, orderId);

      return {
        totalAmount: splitPayment.totalAmount,
        paidAmount: splitPayment.paidAmount,
        remainingAmount: splitPayment.remainingAmount,
        isComplete: splitPayment.isComplete,
        paymentCount: orderPayments.length,
        payments: orderPayments.map(p => ({
          id: p.id,
          method: p.method as PaymentMethod,
          amount: p.amount,
          status: p.status as PaymentStatus,
          createdAt: p.createdAt,
          processedAt: p.processedAt || undefined
        }))
      };
    } catch (error) {
      console.error('Error getting balance info:', error);
      return null;
    }
  }

  /**
   * Get split payment status for an order
   */
  async getSplitPaymentStatus(tenantId: string, orderId: string): Promise<SplitPaymentStatus | null> {
    try {
      const splitPayment = await this.getSplitPaymentByOrder(tenantId, orderId);
      if (!splitPayment) {
        return null;
      }

      const payments = await this.getOrderPayments(tenantId, orderId);

      return {
        id: splitPayment.id,
        orderId: splitPayment.orderId,
        totalAmount: splitPayment.totalAmount,
        paidAmount: splitPayment.paidAmount,
        remainingAmount: splitPayment.remainingAmount,
        isComplete: splitPayment.isComplete,
        payments: payments.map(p => ({
          id: p.id,
          method: p.method as PaymentMethod,
          amount: p.amount,
          status: p.status as PaymentStatus,
          createdAt: p.createdAt,
          processedAt: p.processedAt || undefined
        })),
        createdAt: splitPayment.createdAt,
        completedAt: splitPayment.completedAt || undefined
      };
    } catch (error) {
      console.error('Error getting split payment status:', error);
      return null;
    }
  }

  /**
   * Check if order can be completed
   * Requirement 7.4: Prevent order completion until total payments equal or exceed order amount
   */
  async canCompleteOrder(tenantId: string, orderId: string): Promise<boolean> {
    try {
      const balanceInfo = await this.getBalanceInfo(tenantId, orderId);
      if (!balanceInfo) {
        return false;
      }

      return balanceInfo.isComplete;
    } catch (error) {
      console.error('Error checking order completion:', error);
      return false;
    }
  }

  /**
   * Calculate change for overpayment
   * Requirement 7.5: Calculate and display change due
   */
  calculateChange(totalAmount: number, paidAmount: number): number {
    if (paidAmount <= totalAmount) {
      return 0;
    }
    return paidAmount - totalAmount;
  }

  /**
   * Get payment history for an order
   */
  async getPaymentHistory(tenantId: string, orderId: string): Promise<PaymentSummary[]> {
    try {
      const payments = await this.getOrderPayments(tenantId, orderId);
      return payments.map(p => ({
        id: p.id,
        method: p.method as PaymentMethod,
        amount: p.amount,
        status: p.status as PaymentStatus,
        createdAt: p.createdAt,
        processedAt: p.processedAt || undefined
      }));
    } catch (error) {
      console.error('Error getting payment history:', error);
      return [];
    }
  }

  /**
   * Cancel a pending payment
   */
  async cancelPayment(
    tenantId: string,
    paymentId: string,
    cancelledBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get payment details
      const payment = await this.db.query.payments.findFirst({
        where: and(
          eq(payments.tenantId, tenantId),
          eq(payments.id, paymentId)
        )
      });

      if (!payment) {
        return { success: false, error: 'Payment not found' };
      }

      if (payment.status !== PaymentStatus.PENDING) {
        return { success: false, error: 'Only pending payments can be cancelled' };
      }

      // Update payment status
      await this.db.update(payments)
        .set({
          status: PaymentStatus.CANCELLED,
          failedAt: Date.now(),
          errorMessage: 'Cancelled by user'
        })
        .where(eq(payments.id, paymentId));

      // Recalculate split payment balance
      await this.recalculateBalance(tenantId, payment.orderId);

      return { success: true };
    } catch (error) {
      console.error('Error cancelling payment:', error);
      return { success: false, error: 'Failed to cancel payment' };
    }
  }

  // Private helper methods

  /**
   * Validate payment request
   */
  private validatePaymentRequest(request: SplitPaymentRequest): { success: boolean; error?: string } {
    if (!request.orderId) {
      return { success: false, error: 'Order ID is required' };
    }

    if (!request.method) {
      return { success: false, error: 'Payment method is required' };
    }

    const validMethods = [
      PaymentMethod.PIX,
      PaymentMethod.CREDIT_CARD,
      PaymentMethod.DEBIT_CARD,
      PaymentMethod.MANUAL_CARD,
      PaymentMethod.CASH
    ];

    if (!validMethods.includes(request.method)) {
      return { success: false, error: 'Invalid payment method' };
    }

    if (!request.amount || request.amount <= 0) {
      return { success: false, error: 'Payment amount must be greater than zero' };
    }

    if (!request.processedBy) {
      return { success: false, error: 'Processed by user ID is required' };
    }

    // Card payments require card token
    if ([PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD].includes(request.method)) {
      if (!request.cardToken && this.paymentGatewayService) {
        return { success: false, error: 'Card token is required for card payments' };
      }
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
   * Get split payment by order ID
   */
  private async getSplitPaymentByOrder(tenantId: string, orderId: string): Promise<SplitPayment | null> {
    const result = await this.db
      .select()
      .from(splitPayments)
      .where(and(
        eq(splitPayments.tenantId, tenantId),
        eq(splitPayments.orderId, orderId)
      ))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get all completed payments for an order
   */
  private async getOrderPayments(tenantId: string, orderId: string): Promise<Payment[]> {
    return await this.db
      .select()
      .from(payments)
      .where(and(
        eq(payments.tenantId, tenantId),
        eq(payments.orderId, orderId),
        eq(payments.status, PaymentStatus.COMPLETED)
      ))
      .orderBy(payments.createdAt);
  }

  /**
   * Recalculate split payment balance after changes
   */
  private async recalculateBalance(tenantId: string, orderId: string): Promise<void> {
    const splitPayment = await this.getSplitPaymentByOrder(tenantId, orderId);
    if (!splitPayment) {
      return;
    }

    const payments = await this.getOrderPayments(tenantId, orderId);
    const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingAmount = Math.max(0, splitPayment.totalAmount - paidAmount);
    const isComplete = paidAmount >= splitPayment.totalAmount;

    await this.db.update(splitPayments)
      .set({
        paidAmount,
        remainingAmount,
        isComplete,
        completedAt: isComplete ? Date.now() : undefined
      })
      .where(eq(splitPayments.id, splitPayment.id));
  }

  /**
   * Mark order as delivered when payment is complete
   */
  private async markOrderAsDelivered(
    tenantId: string,
    orderId: string,
    processedBy: string
  ): Promise<void> {
    const now = Date.now();

    // Update order state
    await this.db
      .update(orders)
      .set({
        state: OrderState.DELIVERED,
        updatedAt: now
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
      transitionedAt: now,
      reason: 'Payment completed via split payment'
    };

    await this.db.insert(orderStateTransitions).values(transition);
  }
}

/**
 * Factory function to create SplitPaymentManager instance
 */
export function createSplitPaymentManager(db: any, paymentGatewayService?: any): SplitPaymentManager {
  return new SplitPaymentManager(db, paymentGatewayService);
}