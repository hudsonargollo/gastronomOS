/**
 * Pix Generator Service
 * Handles Pix QR code generation, validation, and payment status tracking
 * with 15-minute expiration as per requirements 5.2
 */

import { eq, and, lt } from 'drizzle-orm';
import { 
  payments, 
  PaymentMethod, 
  PaymentStatus,
  type NewPayment 
} from '../db/schema';
import { PaymentGatewayService, type PaymentGatewayCredentials } from './payment-gateway';
import { generateId } from '../utils';

export interface PixQRCodeRequest {
  orderId: string;
  amount: number; // in cents
  description: string;
  customerEmail: string;
  externalReference?: string;
}

export interface PixQRCodeResult {
  success: boolean;
  pixId?: string;
  qrCode?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  expirationDate?: Date;
  gatewayTransactionId?: string;
  error?: string;
  errorCode?: string;
}

export interface PixPaymentStatus {
  pixId: string;
  orderId: string;
  status: PaymentStatus;
  amount: number;
  createdAt: Date;
  expirationDate: Date;
  isExpired: boolean;
  gatewayTransactionId?: string;
  processedAt?: Date;
}

export interface PixValidationResult {
  isValid: boolean;
  isExpired: boolean;
  status: PaymentStatus;
  error?: string;
}

export class PixGenerator {
  private static readonly EXPIRATION_MINUTES = 15;
  
  constructor(
    private db: any,
    private paymentGatewayService: PaymentGatewayService
  ) {}

  /**
   * Generate a new Pix QR code with 15-minute expiration
   */
  async generatePixQRCode(
    tenantId: string,
    request: PixQRCodeRequest
  ): Promise<PixQRCodeResult> {
    try {
      // Get payment gateway credentials
      const credentials = await this.paymentGatewayService.getCredentials(tenantId);
      if (!credentials) {
        return {
          success: false,
          error: 'Payment gateway not configured',
          errorCode: 'GATEWAY_NOT_CONFIGURED'
        };
      }

      // Generate unique Pix ID
      const pixId = generateId();
      
      // Set expiration to exactly 15 minutes from now
      const expirationDate = new Date(Date.now() + PixGenerator.EXPIRATION_MINUTES * 60 * 1000);

      // Create Mercado Pago Pix request
      const pixRequest = {
        transaction_amount: request.amount / 100, // Convert cents to currency
        description: request.description,
        payment_method_id: 'pix' as const,
        payer: {
          email: request.customerEmail
        },
        external_reference: request.externalReference || pixId,
        notification_url: credentials.webhookUrl,
        date_of_expiration: expirationDate.toISOString()
      };

      // Call Mercado Pago API
      const response = await this.callMercadoPagoAPI(
        credentials.accessToken,
        'POST',
        '/v1/payments',
        pixRequest
      );

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: (errorData as any)?.message || 'Pix QR code generation failed',
          errorCode: 'PIX_GENERATION_FAILED'
        };
      }

      const paymentData = await response.json();

      // Store Pix payment record
      const payment: NewPayment = {
        id: pixId,
        tenantId,
        orderId: request.orderId,
        method: PaymentMethod.PIX,
        amount: request.amount,
        status: PaymentStatus.PENDING,
        gatewayTransactionId: paymentData.id.toString(),
        gatewayResponse: JSON.stringify(paymentData),
        createdAt: Date.now()
      };

      await this.db.insert(payments).values(payment);

      return {
        success: true,
        pixId,
        qrCode: paymentData.point_of_interaction?.transaction_data?.qr_code,
        qrCodeBase64: paymentData.point_of_interaction?.transaction_data?.qr_code_base64,
        ticketUrl: paymentData.point_of_interaction?.transaction_data?.ticket_url,
        expirationDate,
        gatewayTransactionId: paymentData.id.toString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Pix generation failed',
        errorCode: 'PIX_ERROR'
      };
    }
  }

  /**
   * Validate a Pix QR code and check expiration
   */
  async validatePixQRCode(
    tenantId: string,
    pixId: string
  ): Promise<PixValidationResult> {
    try {
      const payment = await this.db.query.payments.findFirst({
        where: and(
          eq(payments.tenantId, tenantId),
          eq(payments.id, pixId),
          eq(payments.method, PaymentMethod.PIX)
        )
      });

      if (!payment) {
        return {
          isValid: false,
          isExpired: false,
          status: PaymentStatus.FAILED,
          error: 'Pix payment not found'
        };
      }

      // Check if expired (15 minutes from creation)
      const expirationTime = payment.createdAt + (PixGenerator.EXPIRATION_MINUTES * 60 * 1000);
      const isExpired = Date.now() > expirationTime;

      // If expired and still pending, mark as failed
      if (isExpired && payment.status === PaymentStatus.PENDING) {
        await this.expirePixPayment(tenantId, pixId);
        return {
          isValid: false,
          isExpired: true,
          status: PaymentStatus.FAILED,
          error: 'Pix payment expired'
        };
      }

      return {
        isValid: true,
        isExpired,
        status: payment.status as PaymentStatus
      };
    } catch (error) {
      return {
        isValid: false,
        isExpired: false,
        status: PaymentStatus.FAILED,
        error: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  }

  /**
   * Get Pix payment status with expiration check
   */
  async getPixPaymentStatus(
    tenantId: string,
    pixId: string
  ): Promise<PixPaymentStatus | null> {
    try {
      const payment = await this.db.query.payments.findFirst({
        where: and(
          eq(payments.tenantId, tenantId),
          eq(payments.id, pixId),
          eq(payments.method, PaymentMethod.PIX)
        )
      });

      if (!payment) {
        return null;
      }

      const expirationDate = new Date(payment.createdAt + (PixGenerator.EXPIRATION_MINUTES * 60 * 1000));
      const isExpired = Date.now() > expirationDate.getTime();

      return {
        pixId: payment.id,
        orderId: payment.orderId,
        status: payment.status as PaymentStatus,
        amount: payment.amount,
        createdAt: new Date(payment.createdAt),
        expirationDate,
        isExpired,
        gatewayTransactionId: payment.gatewayTransactionId || undefined,
        processedAt: payment.processedAt ? new Date(payment.processedAt) : undefined
      };
    } catch (error) {
      console.error('Failed to get Pix payment status:', error);
      return null;
    }
  }

  /**
   * Update Pix payment status (typically called by webhook handler)
   */
  async updatePixPaymentStatus(
    tenantId: string,
    gatewayTransactionId: string,
    status: PaymentStatus,
    gatewayResponse?: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = {
        status,
        updatedAt: Date.now()
      };

      if (status === PaymentStatus.COMPLETED) {
        updateData.processedAt = Date.now();
      } else if (status === PaymentStatus.FAILED) {
        updateData.failedAt = Date.now();
        if (gatewayResponse?.failure_reason) {
          updateData.errorMessage = gatewayResponse.failure_reason;
        }
      }

      if (gatewayResponse) {
        updateData.gatewayResponse = JSON.stringify(gatewayResponse);
      }

      const result = await this.db.update(payments)
        .set(updateData)
        .where(
          and(
            eq(payments.tenantId, tenantId),
            eq(payments.gatewayTransactionId, gatewayTransactionId),
            eq(payments.method, PaymentMethod.PIX)
          )
        );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Status update failed'
      };
    }
  }

  /**
   * Expire a Pix payment (mark as failed due to timeout)
   */
  async expirePixPayment(
    tenantId: string,
    pixId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.db.update(payments)
        .set({
          status: PaymentStatus.FAILED,
          failedAt: Date.now(),
          errorMessage: 'Payment expired after 15 minutes',
          updatedAt: Date.now()
        })
        .where(
          and(
            eq(payments.tenantId, tenantId),
            eq(payments.id, pixId),
            eq(payments.method, PaymentMethod.PIX),
            eq(payments.status, PaymentStatus.PENDING)
          )
        );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Expiration failed'
      };
    }
  }

  /**
   * Clean up expired Pix payments (batch operation)
   */
  async cleanupExpiredPixPayments(tenantId: string): Promise<{ 
    success: boolean; 
    expiredCount?: number; 
    error?: string; 
  }> {
    try {
      const expirationThreshold = Date.now() - (PixGenerator.EXPIRATION_MINUTES * 60 * 1000);

      const result = await this.db.update(payments)
        .set({
          status: PaymentStatus.FAILED,
          failedAt: Date.now(),
          errorMessage: 'Payment expired after 15 minutes',
          updatedAt: Date.now()
        })
        .where(
          and(
            eq(payments.tenantId, tenantId),
            eq(payments.method, PaymentMethod.PIX),
            eq(payments.status, PaymentStatus.PENDING),
            lt(payments.createdAt, expirationThreshold)
          )
        );

      return { 
        success: true, 
        expiredCount: result.changes || 0 
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cleanup failed'
      };
    }
  }

  /**
   * Get all Pix payments for an order
   */
  async getPixPaymentsForOrder(
    tenantId: string,
    orderId: string
  ): Promise<PixPaymentStatus[]> {
    try {
      const orderPayments = await this.db.query.payments.findMany({
        where: and(
          eq(payments.tenantId, tenantId),
          eq(payments.orderId, orderId),
          eq(payments.method, PaymentMethod.PIX)
        ),
        orderBy: [payments.createdAt]
      });

      return orderPayments.map(payment => {
        const expirationDate = new Date(payment.createdAt + (PixGenerator.EXPIRATION_MINUTES * 60 * 1000));
        const isExpired = Date.now() > expirationDate.getTime();

        return {
          pixId: payment.id,
          orderId: payment.orderId,
          status: payment.status as PaymentStatus,
          amount: payment.amount,
          createdAt: new Date(payment.createdAt),
          expirationDate,
          isExpired,
          gatewayTransactionId: payment.gatewayTransactionId || undefined,
          processedAt: payment.processedAt ? new Date(payment.processedAt) : undefined
        };
      });
    } catch (error) {
      console.error('Failed to get Pix payments for order:', error);
      return [];
    }
  }

  /**
   * Call Mercado Pago API (private helper method)
   */
  private async callMercadoPagoAPI(
    accessToken: string,
    method: string,
    endpoint: string,
    body?: any
  ): Promise<Response> {
    const url = `https://api.mercadopago.com${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': generateId() // Prevent duplicate requests
      }
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    return fetch(url, options);
  }
}