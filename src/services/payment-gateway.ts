/**
 * Payment Gateway Service
 * Handles Mercado Pago API integration for Pix, credit card, and debit card processing
 * Implements secure credential storage with encryption
 * 
 * Requirements: 5.1, 5.3, 5.4, 12.1, 12.4
 */

import { eq, and } from 'drizzle-orm';
import { 
  paymentGatewayConfigs,
  PaymentGatewayProvider,
  PaymentMethod,
  PaymentStatus,
  type PaymentGatewayConfig,
  type NewPaymentGatewayConfig
} from '../db/schema';
import { EncryptionService, type EncryptionResult, type DecryptionInput } from '../utils/encryption';
import { generateId } from '../utils';

// Mercado Pago API types
export interface MercadoPagoPaymentRequest {
  transaction_amount: number;
  description: string;
  payment_method_id: string;
  payer: {
    email: string;
    first_name?: string;
    last_name?: string;
    identification?: {
      type: string;
      number: string;
    };
  };
  external_reference?: string;
  notification_url?: string;
  date_of_expiration?: string;
  installments?: number;
  token?: string; // Card token
  issuer_id?: string;
}

export interface MercadoPagoPaymentResponse {
  id: number;
  status: string;
  status_detail: string;
  payment_method_id: string;
  payment_type_id: string;
  transaction_amount: number;
  transaction_amount_refunded: number;
  currency_id: string;
  description: string;
  date_created: string;
  date_of_expiration?: string;
  date_approved?: string;
  point_of_interaction?: {
    transaction_data: {
      qr_code: string;
      qr_code_base64: string;
      ticket_url: string;
    };
  };
  payer: {
    email: string;
  };
  external_reference: string;
  notification_url?: string;
}

export interface PaymentGatewayCredentials {
  accessToken: string;
  publicKey: string;
  webhookUrl?: string;
  isActive: boolean;
}

export interface PaymentProcessingRequest {
  orderId: string;
  amount: number; // in cents
  method: PaymentMethod;
  description: string;
  customerEmail: string;
  externalReference?: string;
  cardToken?: string; // For card payments
  installments?: number; // For credit card
  issuerId?: string; // For card payments
}

export interface PaymentProcessingResult {
  success: boolean;
  paymentId?: string;
  gatewayTransactionId?: string;
  status: PaymentStatus;
  qrCode?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  expirationDate?: Date;
  gatewayResponse?: MercadoPagoPaymentResponse;
  error?: string;
  errorCode?: string;
}

export interface WebhookNotification {
  action: string;
  api_version: string;
  data: {
    id: string;
  };
  date_created: string;
  id: number;
  live_mode: boolean;
  type: string;
  user_id: string;
}

export interface CredentialValidationResult {
  isValid: boolean;
  error?: string;
  errorCode?: string;
}

export class PaymentGatewayService {
  private static readonly MERCADO_PAGO_API = 'https://api.mercadopago.com';
  private static readonly ENCRYPTION_KEY_ENV = 'PAYMENT_ENCRYPTION_KEY';
  
  constructor(
    private db: any,
    private encryptionKey?: string
  ) {
    // Use provided key or get from environment
    this.encryptionKey = encryptionKey || process.env.PAYMENT_ENCRYPTION_KEY;
    if (!this.encryptionKey) {
      console.warn('Payment encryption key not configured. Using default key (not recommended for production).');
      this.encryptionKey = 'default-dev-key-please-change-in-production';
    }
  }

  /**
   * Configure payment gateway for a tenant
   */
  async configureGateway(
    tenantId: string,
    provider: PaymentGatewayProvider,
    accessToken: string,
    publicKey: string,
    webhookUrl?: string
  ): Promise<{ success: boolean; configId?: string; error?: string }> {
    try {
      // Validate credentials before storing
      const validation = await this.validateCredentials(accessToken, publicKey);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Encrypt access token
      const encryptedToken = await EncryptionService.encrypt(accessToken, this.encryptionKey!);

      // Check if config already exists
      const existing = await this.db.query.paymentGatewayConfigs.findFirst({
        where: and(
          eq(paymentGatewayConfigs.tenantId, tenantId),
          eq(paymentGatewayConfigs.provider, provider)
        )
      });

      if (existing) {
        // Update existing config
        await this.db.update(paymentGatewayConfigs)
          .set({
            accessToken: JSON.stringify(encryptedToken),
            publicKey,
            webhookUrl,
            isActive: true,
            updatedAt: Date.now()
          })
          .where(eq(paymentGatewayConfigs.id, existing.id));

        return { success: true, configId: existing.id };
      }

      // Create new config
      const configId = generateId();
      const config: NewPaymentGatewayConfig = {
        id: configId,
        tenantId,
        provider,
        accessToken: JSON.stringify(encryptedToken),
        publicKey,
        webhookUrl,
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await this.db.insert(paymentGatewayConfigs).values(config);

      return { success: true, configId };
    } catch (error) {
      console.error('Error configuring payment gateway:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Configuration failed'
      };
    }
  }

  /**
   * Get payment gateway credentials for a tenant
   */
  async getCredentials(tenantId: string): Promise<PaymentGatewayCredentials | null> {
    try {
      const config = await this.db.query.paymentGatewayConfigs.findFirst({
        where: and(
          eq(paymentGatewayConfigs.tenantId, tenantId),
          eq(paymentGatewayConfigs.provider, 'MERCADO_PAGO'),
          eq(paymentGatewayConfigs.isActive, true)
        )
      });

      if (!config) {
        return null;
      }

      // Decrypt access token
      const encryptedData: EncryptionResult = JSON.parse(config.accessToken);
      const accessToken = await EncryptionService.decrypt(
        {
          encryptedData: encryptedData.encryptedData,
          iv: encryptedData.iv,
          salt: encryptedData.salt
        },
        this.encryptionKey!
      );

      return {
        accessToken,
        publicKey: config.publicKey,
        webhookUrl: config.webhookUrl || undefined,
        isActive: config.isActive
      };
    } catch (error) {
      console.error('Error getting payment credentials:', error);
      return null;
    }
  }

  /**
   * Process a payment through Mercado Pago
   */
  async processPayment(
    tenantId: string,
    request: PaymentProcessingRequest
  ): Promise<PaymentProcessingResult> {
    try {
      const credentials = await this.getCredentials(tenantId);
      if (!credentials) {
        return {
          success: false,
          status: PaymentStatus.FAILED,
          error: 'Payment gateway not configured',
          errorCode: 'GATEWAY_NOT_CONFIGURED'
        };
      }

      // Build Mercado Pago request based on payment method
      const mpRequest: MercadoPagoPaymentRequest = {
        transaction_amount: request.amount / 100, // Convert cents to currency
        description: request.description,
        payment_method_id: this.getPaymentMethodId(request.method),
        payer: {
          email: request.customerEmail
        },
        external_reference: request.externalReference,
        notification_url: credentials.webhookUrl
      };

      // Add method-specific fields
      if (request.method === PaymentMethod.PIX) {
        // Pix expires in 15 minutes
        const expirationDate = new Date(Date.now() + 15 * 60 * 1000);
        mpRequest.date_of_expiration = expirationDate.toISOString();
      } else if (request.method === PaymentMethod.CREDIT_CARD) {
        if (!request.cardToken) {
          return {
            success: false,
            status: PaymentStatus.FAILED,
            error: 'Card token is required for card payments',
            errorCode: 'CARD_TOKEN_REQUIRED'
          };
        }
        mpRequest.token = request.cardToken;
        mpRequest.installments = request.installments || 1;
        if (request.issuerId) {
          mpRequest.issuer_id = request.issuerId;
        }
      } else if (request.method === PaymentMethod.DEBIT_CARD) {
        if (!request.cardToken) {
          return {
            success: false,
            status: PaymentStatus.FAILED,
            error: 'Card token is required for card payments',
            errorCode: 'CARD_TOKEN_REQUIRED'
          };
        }
        mpRequest.token = request.cardToken;
      }

      // Call Mercado Pago API
      const response = await this.callMercadoPagoAPI(
        credentials.accessToken,
        'POST',
        '/v1/payments',
        mpRequest
      );

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          status: PaymentStatus.FAILED,
          error: (errorData as any)?.message || 'Payment processing failed',
          errorCode: 'PAYMENT_FAILED'
        };
      }

      const paymentData: MercadoPagoPaymentResponse = await response.json();
      const status = this.mapPaymentStatus(paymentData.status);

      const result: PaymentProcessingResult = {
        success: status === PaymentStatus.COMPLETED || status === PaymentStatus.PENDING,
        paymentId: generateId(),
        gatewayTransactionId: paymentData.id.toString(),
        status,
        gatewayResponse: paymentData
      };

      // Add Pix-specific fields
      if (request.method === PaymentMethod.PIX && paymentData.point_of_interaction) {
        result.qrCode = paymentData.point_of_interaction.transaction_data.qr_code;
        result.qrCodeBase64 = paymentData.point_of_interaction.transaction_data.qr_code_base64;
        result.ticketUrl = paymentData.point_of_interaction.transaction_data.ticket_url;
        result.expirationDate = paymentData.date_of_expiration 
          ? new Date(paymentData.date_of_expiration) 
          : new Date(Date.now() + 15 * 60 * 1000);
      }

      return result;
    } catch (error) {
      console.error('Error processing payment:', error);
      return {
        success: false,
        status: PaymentStatus.FAILED,
        error: error instanceof Error ? error.message : 'Payment processing failed',
        errorCode: 'PAYMENT_ERROR'
      };
    }
  }

  /**
   * Get payment status from Mercado Pago
   */
  async getPaymentStatus(
    tenantId: string,
    gatewayTransactionId: string
  ): Promise<{ status: PaymentStatus; gatewayResponse?: MercadoPagoPaymentResponse; error?: string }> {
    try {
      const credentials = await this.getCredentials(tenantId);
      if (!credentials) {
        return {
          status: PaymentStatus.FAILED,
          error: 'Payment gateway not configured'
        };
      }

      const response = await this.callMercadoPagoAPI(
        credentials.accessToken,
        'GET',
        `/v1/payments/${gatewayTransactionId}`
      );

      if (!response.ok) {
        return {
          status: PaymentStatus.FAILED,
          error: 'Failed to get payment status'
        };
      }

      const paymentData: MercadoPagoPaymentResponse = await response.json();
      
      return {
        status: this.mapPaymentStatus(paymentData.status),
        gatewayResponse: paymentData
      };
    } catch (error) {
      return {
        status: PaymentStatus.FAILED,
        error: error instanceof Error ? error.message : 'Failed to get payment status'
      };
    }
  }

  /**
   * Cancel a payment
   */
  async cancelPayment(
    tenantId: string,
    gatewayTransactionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const credentials = await this.getCredentials(tenantId);
      if (!credentials) {
        return {
          success: false,
          error: 'Payment gateway not configured'
        };
      }

      const response = await this.callMercadoPagoAPI(
        credentials.accessToken,
        'PUT',
        `/v1/payments/${gatewayTransactionId}`,
        { status: 'cancelled' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: (errorData as any)?.message || 'Cancellation failed'
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cancellation failed'
      };
    }
  }

  /**
   * Refund a payment
   */
  async refundPayment(
    tenantId: string,
    gatewayTransactionId: string,
    amount?: number // in cents, partial refund if specified
  ): Promise<{ success: boolean; refundId?: string; error?: string }> {
    try {
      const credentials = await this.getCredentials(tenantId);
      if (!credentials) {
        return {
          success: false,
          error: 'Payment gateway not configured'
        };
      }

      const refundData: any = {};
      if (amount) {
        refundData.amount = amount / 100; // Convert to currency
      }

      const response = await this.callMercadoPagoAPI(
        credentials.accessToken,
        'POST',
        `/v1/payments/${gatewayTransactionId}/refunds`,
        refundData
      );

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: (errorData as any)?.message || 'Refund failed'
        };
      }

      const refundResponse = await response.json();
      
      return {
        success: true,
        refundId: refundResponse.id?.toString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Refund failed'
      };
    }
  }

  /**
   * Handle webhook notification from Mercado Pago
   */
  async handleWebhook(
    tenantId: string,
    notification: WebhookNotification
  ): Promise<{ success: boolean; paymentId?: string; status?: PaymentStatus; error?: string }> {
    try {
      // Validate notification type
      if (notification.type !== 'payment') {
        return { success: true }; // Ignore non-payment notifications
      }

      const paymentId = notification.data.id;
      
      // Get payment status from Mercado Pago
      const result = await this.getPaymentStatus(tenantId, paymentId);
      
      return {
        success: true,
        paymentId,
        status: result.status
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Webhook processing failed'
      };
    }
  }

  /**
   * Validate Mercado Pago credentials
   */
  async validateCredentials(
    accessToken: string,
    publicKey: string
  ): Promise<CredentialValidationResult> {
    try {
      // Validate format
      if (!accessToken || accessToken.length < 20) {
        return {
          isValid: false,
          error: 'Invalid access token format',
          errorCode: 'INVALID_ACCESS_TOKEN'
        };
      }

      if (!publicKey || publicKey.length < 20) {
        return {
          isValid: false,
          error: 'Invalid public key format',
          errorCode: 'INVALID_PUBLIC_KEY'
        };
      }

      // Test credentials by making a simple API call
      const response = await fetch(`${PaymentGatewayService.MERCADO_PAGO_API}/users/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        return {
          isValid: false,
          error: 'Invalid credentials - API authentication failed',
          errorCode: 'AUTHENTICATION_FAILED'
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
        errorCode: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * Deactivate payment gateway for a tenant
   */
  async deactivateGateway(tenantId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.db.update(paymentGatewayConfigs)
        .set({
          isActive: false,
          updatedAt: Date.now()
        })
        .where(eq(paymentGatewayConfigs.tenantId, tenantId));

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deactivation failed'
      };
    }
  }

  /**
   * Check if payment gateway is available
   */
  async isGatewayAvailable(tenantId: string): Promise<boolean> {
    try {
      const credentials = await this.getCredentials(tenantId);
      return credentials !== null && credentials.isActive;
    } catch {
      return false;
    }
  }

  /**
   * Validate payment gateway configuration for a tenant
   */
  async validateConfiguration(tenantId: string): Promise<{ isValid: boolean; error?: string; errorCode?: string }> {
    try {
      const credentials = await this.getCredentials(tenantId);
      
      if (!credentials) {
        return {
          isValid: false,
          error: 'Payment gateway not configured',
          errorCode: 'GATEWAY_NOT_CONFIGURED'
        };
      }

      // Test credentials by making a simple API call
      const response = await fetch(`${PaymentGatewayService.MERCADO_PAGO_API}/users/me`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`
        }
      });

      if (!response.ok) {
        return {
          isValid: false,
          error: 'Invalid credentials - API authentication failed',
          errorCode: 'AUTHENTICATION_FAILED'
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
        errorCode: 'VALIDATION_ERROR'
      };
    }
  }

  /**
   * Get payment methods available for a tenant
   */
  async getAvailablePaymentMethods(tenantId: string): Promise<PaymentMethod[]> {
    const isAvailable = await this.isGatewayAvailable(tenantId);
    
    if (isAvailable) {
      return [
        PaymentMethod.PIX,
        PaymentMethod.CREDIT_CARD,
        PaymentMethod.DEBIT_CARD
      ];
    }
    
    // Fallback to manual payment methods
    return [
      PaymentMethod.MANUAL_CARD,
      PaymentMethod.CASH
    ];
  }

  // Private helper methods

  /**
   * Call Mercado Pago API
   */
  private async callMercadoPagoAPI(
    accessToken: string,
    method: string,
    endpoint: string,
    body?: any
  ): Promise<Response> {
    const url = `${PaymentGatewayService.MERCADO_PAGO_API}${endpoint}`;
    
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

  /**
   * Map Mercado Pago payment method to internal type
   */
  private getPaymentMethodId(method: PaymentMethod): string {
    const mapping: Record<string, string> = {
      [PaymentMethod.PIX]: 'pix',
      [PaymentMethod.CREDIT_CARD]: 'credit_card',
      [PaymentMethod.DEBIT_CARD]: 'debit_card'
    };

    return mapping[method] || method.toLowerCase();
  }

  /**
   * Map Mercado Pago status to internal PaymentStatus
   */
  private mapPaymentStatus(mpStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'pending': PaymentStatus.PENDING,
      'in_process': PaymentStatus.PROCESSING,
      'approved': PaymentStatus.COMPLETED,
      'authorized': PaymentStatus.PROCESSING,
      'in_mediation': PaymentStatus.PROCESSING,
      'rejected': PaymentStatus.FAILED,
      'cancelled': PaymentStatus.CANCELLED,
      'refunded': PaymentStatus.CANCELLED,
      'charged_back': PaymentStatus.FAILED
    };

    return statusMap[mpStatus] || PaymentStatus.FAILED;
  }
}