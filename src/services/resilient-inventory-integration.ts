/**
 * Resilient Inventory Integration Service
 * Wraps InventoryIntegrationService with error handling and override capabilities
 * 
 * Implements:
 * - Automatic retry with exponential backoff
 * - Manual override with warnings when inventory system is unavailable
 * - Comprehensive error logging
 * 
 * Validates: Requirements 15.2, 15.3, 15.4
 */

import { 
  InventoryIntegrationService,
  type ReservationResult,
  type AvailabilityResult,
  type InventoryLock
} from './inventory-integration';
import { SystemResilienceService } from './system-resilience';

export interface ResilientReservationResult extends ReservationResult {
  overrideUsed?: boolean;
  overrideWarning?: string;
  attemptsMade?: number;
}

export interface ResilientAvailabilityResult extends AvailabilityResult {
  overrideAvailable?: boolean;
  overrideWarning?: string;
  attemptsMade?: number;
}

export class ResilientInventoryIntegrationService {
  private resilienceService: SystemResilienceService;

  constructor(
    private inventoryService: InventoryIntegrationService,
    resilienceService?: SystemResilienceService
  ) {
    this.resilienceService = resilienceService || new SystemResilienceService();
  }

  /**
   * Reserve inventory with retry and override capability
   * Validates: Requirement 15.2
   */
  async reserveInventoryForTransfer(
    productId: string,
    locationId: string,
    quantity: number,
    transferId: string,
    reservedBy: string,
    tenantId: string,
    allowOverride: boolean = true
  ): Promise<ResilientReservationResult> {
    const context = {
      service: 'inventory-system',
      operation: 'reserveInventoryForTransfer',
      tenantId,
      metadata: {
        productId,
        locationId,
        quantity,
        transferId
      }
    };

    // Execute with override capability
    const result = await this.resilienceService.executeInventoryWithOverride(
      () => this.inventoryService.reserveInventoryForTransfer(
        productId,
        locationId,
        quantity,
        transferId,
        reservedBy,
        tenantId
      ),
      context,
      allowOverride
    );

    if (result.success && result.result) {
      return {
        ...result.result,
        overrideUsed: false,
        attemptsMade: 1
      };
    }

    // If override is required and allowed, return special result
    if (result.overrideRequired && allowOverride) {
      return {
        success: false,
        error: result.error,
        errorCode: result.errorCode || 'INVENTORY_UNAVAILABLE',
        overrideUsed: false,
        overrideWarning: result.overrideWarning
      };
    }

    return {
      success: false,
      error: result.error,
      errorCode: result.errorCode || 'INVENTORY_UNAVAILABLE'
    };
  }

  /**
   * Check inventory availability with retry and override info
   * Validates: Requirement 15.2
   */
  async checkInventoryAvailability(
    productId: string,
    locationId: string,
    tenantId: string,
    allowOverride: boolean = true
  ): Promise<ResilientAvailabilityResult> {
    const context = {
      service: 'inventory-system',
      operation: 'checkInventoryAvailability',
      tenantId,
      metadata: {
        productId,
        locationId
      }
    };

    const result = await this.resilienceService.executeInventoryWithOverride(
      () => this.inventoryService.checkInventoryAvailability(productId, locationId),
      context,
      allowOverride
    );

    if (result.success && result.result) {
      return {
        ...result.result,
        overrideAvailable: false,
        attemptsMade: 1
      };
    }

    // If override is available, include that information
    if (result.overrideRequired && allowOverride) {
      return {
        available: false,
        quantityAvailable: 0,
        quantityReserved: 0,
        overrideAvailable: true,
        overrideWarning: result.overrideWarning
      };
    }

    return {
      available: false,
      quantityAvailable: 0,
      quantityReserved: 0,
      overrideAvailable: false
    };
  }

  /**
   * Acquire inventory lock with retry
   */
  async acquireInventoryLock(
    locationId: string,
    productId: string,
    lockedBy: string,
    tenantId: string,
    timeoutMs?: number,
    priority?: number
  ): Promise<{
    lock?: InventoryLock;
    error?: string;
    attemptsMade?: number;
  }> {
    const context = {
      service: 'inventory-system',
      operation: 'acquireInventoryLock',
      tenantId,
      metadata: {
        locationId,
        productId,
        lockedBy
      }
    };

    const result = await this.resilienceService.executeWithRetry(
      () => this.inventoryService.acquireInventoryLock(
        locationId,
        productId,
        lockedBy,
        timeoutMs,
        priority
      ),
      context,
      {
        maxRetries: 3,
        initialDelayMs: 500,
        maxDelayMs: 4000,
        backoffMultiplier: 2,
        retryableErrors: ['LOCK_TIMEOUT', 'DEADLOCK_DETECTED']
      }
    );

    if (result.success && result.result) {
      return {
        lock: result.result,
        attemptsMade: result.attemptsMade
      };
    }

    return {
      error: result.error,
      attemptsMade: result.attemptsMade
    };
  }

  /**
   * Release inventory lock with retry
   */
  async releaseInventoryLock(
    lockId: string,
    tenantId: string
  ): Promise<{
    success: boolean;
    error?: string;
    attemptsMade?: number;
  }> {
    const context = {
      service: 'inventory-system',
      operation: 'releaseInventoryLock',
      tenantId,
      metadata: {
        lockId
      }
    };

    const result = await this.resilienceService.executeWithRetry(
      async () => {
        await this.inventoryService.releaseInventoryLock(lockId);
        return { success: true };
      },
      context
    );

    if (result.success && result.result) {
      return {
        success: true,
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
   * Release inventory reservation with retry
   */
  async releaseInventoryReservation(
    reservationId: string,
    tenantId: string
  ): Promise<{
    success: boolean;
    error?: string;
    attemptsMade?: number;
  }> {
    const context = {
      service: 'inventory-system',
      operation: 'releaseInventoryReservation',
      tenantId,
      metadata: {
        reservationId
      }
    };

    const result = await this.resilienceService.executeWithRetry(
      async () => {
        await this.inventoryService.releaseInventoryReservation(reservationId);
        return { success: true };
      },
      context
    );

    if (result.success && result.result) {
      return {
        success: true,
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
   * Execute manual inventory override
   * This should be called when inventory system is unavailable and user confirms override
   */
  async executeManualOverride(
    productId: string,
    locationId: string,
    quantity: number,
    transferId: string,
    overriddenBy: string,
    tenantId: string,
    reason: string
  ): Promise<{
    success: boolean;
    reservationId?: string;
    warning: string;
  }> {
    // Log the manual override
    this.resilienceService.logError({
      context: {
        service: 'inventory-system',
        operation: 'manualOverride',
        tenantId,
        userId: overriddenBy,
        metadata: {
          productId,
          locationId,
          quantity,
          transferId,
          reason
        }
      },
      error: 'Manual inventory override executed',
      errorCode: 'MANUAL_OVERRIDE',
      severity: 'MEDIUM',
      recoveryAction: 'Manual override - inventory checks bypassed'
    });

    // Generate a pseudo-reservation ID for tracking
    const reservationId = `manual_override_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      reservationId,
      warning: 'WARNING: This operation bypassed inventory checks. Ensure sufficient stock is available.'
    };
  }
}

/**
 * Factory function to create ResilientInventoryIntegrationService
 */
export function createResilientInventoryIntegration(
  inventoryService: InventoryIntegrationService,
  resilienceService?: SystemResilienceService
): ResilientInventoryIntegrationService {
  return new ResilientInventoryIntegrationService(inventoryService, resilienceService);
}
