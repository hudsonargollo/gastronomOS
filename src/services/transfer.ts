import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, sql } from 'drizzle-orm';
import { 
  transfers,
  transferAuditLog,
  locations,
  users,
  products,
  Transfer,
  NewTransfer,
  TransferAuditLog,
  NewTransferAuditLog,
  TransferStatus,
  TransferStatusType,
  TransferPriorityType,
  TransferAuditAction,
  TransferAuditActionType,
  Location,
  Product,
  User
} from '../db';
import { generateId, getCurrentTimestamp } from '../utils';

// Export types for use in routes
export { TransferStatusType, TransferPriorityType } from '../db';

// Core transfer interfaces as defined in the design document
export interface CreateTransferRequest {
  productId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  quantityRequested: number;
  priority: TransferPriorityType;
  notes?: string;
  reasonCode?: string;
}

export interface UpdateTransferRequest {
  quantityRequested?: number;
  notes?: string;
  reasonCode?: string;
}

export interface ReceivingData {
  quantityReceived: number;
  receivedBy: string;
  receivedAt: Date;
  varianceReason?: string | undefined;
  notes?: string | undefined;
  damageReport?: string | undefined;
}

export interface TransferFilters {
  status?: TransferStatusType;
  sourceLocationId?: string;
  destinationLocationId?: string;
  productId?: string;
  priority?: TransferPriorityType;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface TransferWithDetails {
  transfer: Transfer;
  sourceLocation: Location;
  destinationLocation: Location;
  product: Product;
  auditTrail: TransferAuditLog[];
  relatedAllocations?: any[]; // Would be Allocation[] if we had the type
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TransferService {
  createTransferRequest(request: CreateTransferRequest, tenantId: string, requestedBy: string): Promise<Transfer>;
  approveTransfer(transferId: string, approverId: string, notes?: string): Promise<Transfer>;
  rejectTransfer(transferId: string, approverId: string, reason: string): Promise<Transfer>;
  shipTransfer(transferId: string, shipperId: string, shippingNotes?: string): Promise<Transfer>;
  receiveTransfer(transferId: string, receivingData: ReceivingData): Promise<Transfer>;
  cancelTransfer(transferId: string, cancellerId: string, reason: string): Promise<Transfer>;
  getTransfersForLocation(locationId: string, tenantId: string, filters?: TransferFilters): Promise<Transfer[]>;
  getTransferDetails(transferId: string, tenantId: string): Promise<TransferWithDetails | null>;
  getTransfersByStatus(status: TransferStatusType, tenantId: string, filters?: TransferFilters): Promise<Transfer[]>;
  updateTransfer(transferId: string, updates: UpdateTransferRequest, tenantId: string, updatedBy: string): Promise<Transfer>;
  getTransfer(transferId: string, tenantId: string): Promise<Transfer | null>;
}

export class TransferServiceImpl implements TransferService {
  constructor(private db: DrizzleD1Database) {}

  /**
   * Create a new transfer request
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
   */
  async createTransferRequest(request: CreateTransferRequest, tenantId: string, requestedBy: string): Promise<Transfer> {
    if (!request.productId || !request.sourceLocationId || !request.destinationLocationId || !request.quantityRequested || request.quantityRequested <= 0) {
      throw new Error('Product ID, source location ID, destination location ID, and positive quantity are required');
    }

    if (request.sourceLocationId === request.destinationLocationId) {
      throw new Error('Source and destination locations cannot be the same');
    }

    // Validate product exists and belongs to tenant
    await this.validateProductAccess(request.productId, tenantId);
    
    // Validate locations exist and belong to tenant
    await this.validateLocationAccess(request.sourceLocationId, tenantId);
    await this.validateLocationAccess(request.destinationLocationId, tenantId);
    
    // Validate user exists and belongs to tenant
    await this.validateUserAccess(requestedBy, tenantId);

    // TODO: Validate inventory availability at source location
    // This would require integration with inventory system

    // Create the transfer request
    const currentTime = getCurrentTimestamp();
    const newTransfer: NewTransfer = {
      id: `transfer_${generateId()}`,
      tenantId,
      productId: request.productId,
      sourceLocationId: request.sourceLocationId,
      destinationLocationId: request.destinationLocationId,
      quantityRequested: request.quantityRequested,
      quantityShipped: 0,
      quantityReceived: 0,
      status: TransferStatus.REQUESTED,
      priority: request.priority,
      requestedBy,
      approvedBy: null,
      approvedAt: null,
      shippedBy: null,
      shippedAt: null,
      receivedBy: null,
      receivedAt: null,
      cancelledBy: null,
      cancelledAt: null,
      cancellationReason: null,
      varianceReason: null,
      notes: request.notes || null,
      createdAt: currentTime,
      updatedAt: currentTime,
    };

    const [createdTransfer] = await this.db
      .insert(transfers)
      .values(newTransfer)
      .returning();

    if (!createdTransfer) {
      throw new Error('Failed to create transfer request');
    }

    // Log transfer creation in audit trail
    await this.logTransferAudit({
      tenantId,
      transferId: createdTransfer.id,
      action: TransferAuditAction.CREATED,
      oldStatus: null,
      newStatus: TransferStatus.REQUESTED,
      oldValues: null,
      newValues: JSON.stringify(createdTransfer),
      performedBy: requestedBy,
      notes: 'Transfer request created'
    });

    // Handle emergency transfer processing or send regular notification
    try {
      if (request.priority === 'EMERGENCY') {
        // Process emergency transfer with expedited workflows
        const { createEmergencyTransferService } = await import('./emergency-transfer');
        const emergencyService = createEmergencyTransferService(this.db);
        
        const emergencyResult = await emergencyService.processEmergencyTransfer(createdTransfer);
        
        console.log(`Emergency transfer ${createdTransfer.id} processed:`, {
          autoApproved: emergencyResult.autoApproved,
          expedited: emergencyResult.expedited,
          processingTimeMinutes: emergencyResult.processingTimeMinutes,
          notificationsSent: emergencyResult.notificationsSent
        });
      } else {
        // Send regular transfer request notification
        const { createTransferNotificationService } = await import('./transfer-notification');
        const notificationService = createTransferNotificationService(this.db);
        await notificationService.notifyTransferRequested(createdTransfer);
      }
    } catch (error) {
      console.error(`Failed to process transfer request for ${createdTransfer.id}:`, error);
      // Don't fail the creation if notification/emergency processing fails
    }

    return createdTransfer;
  }

  /**
   * Approve a transfer request
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
   */
  async approveTransfer(transferId: string, approverId: string, notes?: string): Promise<Transfer> {
    if (!transferId || !approverId) {
      throw new Error('Transfer ID and approver ID are required');
    }

    // Get existing transfer
    const existingTransfer = await this.getTransfer(transferId, ''); // We'll validate tenant in the method
    if (!existingTransfer) {
      throw new Error('Transfer not found');
    }

    // Validate user access
    await this.validateUserAccess(approverId, existingTransfer.tenantId);

    // Check if transfer can be approved (only REQUESTED transfers can be approved)
    if (existingTransfer.status !== TransferStatus.REQUESTED) {
      throw new Error('Can only approve transfers in REQUESTED status');
    }

    // Update the transfer
    const currentTime = getCurrentTimestamp();
    const [updatedTransfer] = await this.db
      .update(transfers)
      .set({
        status: TransferStatus.APPROVED,
        approvedBy: approverId,
        approvedAt: currentTime,
        notes: notes || existingTransfer.notes,
        updatedAt: currentTime,
      })
      .where(and(
        eq(transfers.id, transferId),
        eq(transfers.tenantId, existingTransfer.tenantId)
      ))
      .returning();

    if (!updatedTransfer) {
      throw new Error('Failed to approve transfer');
    }

    // Log transfer approval in audit trail
    await this.logTransferAudit({
      tenantId: existingTransfer.tenantId,
      transferId: updatedTransfer.id,
      action: TransferAuditAction.APPROVED,
      oldStatus: existingTransfer.status,
      newStatus: TransferStatus.APPROVED,
      oldValues: JSON.stringify(existingTransfer),
      newValues: JSON.stringify(updatedTransfer),
      performedBy: approverId,
      notes: notes || 'Transfer approved'
    });

    // Send approval notification
    try {
      const { createTransferNotificationService } = await import('./transfer-notification');
      const notificationService = createTransferNotificationService(this.db);
      await notificationService.notifyTransferApproved(updatedTransfer, approverId, notes);
    } catch (error) {
      console.error(`Failed to send transfer approval notification for ${updatedTransfer.id}:`, error);
      // Don't fail the approval if notification fails
    }

    return updatedTransfer;
  }

  /**
   * Reject a transfer request
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
   */
  async rejectTransfer(transferId: string, approverId: string, reason: string): Promise<Transfer> {
    if (!transferId || !approverId || !reason) {
      throw new Error('Transfer ID, approver ID, and reason are required');
    }

    // Get existing transfer
    const existingTransfer = await this.getTransfer(transferId, '');
    if (!existingTransfer) {
      throw new Error('Transfer not found');
    }

    // Validate user access
    await this.validateUserAccess(approverId, existingTransfer.tenantId);

    // Check if transfer can be rejected (only REQUESTED transfers can be rejected)
    if (existingTransfer.status !== TransferStatus.REQUESTED) {
      throw new Error('Can only reject transfers in REQUESTED status');
    }

    // Update the transfer
    const currentTime = getCurrentTimestamp();
    const [updatedTransfer] = await this.db
      .update(transfers)
      .set({
        status: TransferStatus.CANCELLED,
        cancelledBy: approverId,
        cancelledAt: currentTime,
        cancellationReason: reason,
        updatedAt: currentTime,
      })
      .where(and(
        eq(transfers.id, transferId),
        eq(transfers.tenantId, existingTransfer.tenantId)
      ))
      .returning();

    if (!updatedTransfer) {
      throw new Error('Failed to reject transfer');
    }

    // Log transfer rejection in audit trail
    await this.logTransferAudit({
      tenantId: existingTransfer.tenantId,
      transferId: updatedTransfer.id,
      action: TransferAuditAction.REJECTED,
      oldStatus: existingTransfer.status,
      newStatus: TransferStatus.CANCELLED,
      oldValues: JSON.stringify(existingTransfer),
      newValues: JSON.stringify(updatedTransfer),
      performedBy: approverId,
      notes: `Transfer rejected: ${reason}`
    });

    // Send rejection notification
    try {
      const { createTransferNotificationService } = await import('./transfer-notification');
      const notificationService = createTransferNotificationService(this.db);
      await notificationService.notifyTransferRejected(updatedTransfer, approverId, reason);
    } catch (error) {
      console.error(`Failed to send transfer rejection notification for ${updatedTransfer.id}:`, error);
      // Don't fail the rejection if notification fails
    }

    return updatedTransfer;
  }

  /**
   * Ship a transfer
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
   */
  async shipTransfer(transferId: string, shipperId: string, shippingNotes?: string): Promise<Transfer> {
    if (!transferId || !shipperId) {
      throw new Error('Transfer ID and shipper ID are required');
    }

    // Get existing transfer
    const existingTransfer = await this.getTransfer(transferId, '');
    if (!existingTransfer) {
      throw new Error('Transfer not found');
    }

    // Validate user access
    await this.validateUserAccess(shipperId, existingTransfer.tenantId);

    // Check if transfer can be shipped (only APPROVED transfers can be shipped)
    if (existingTransfer.status !== TransferStatus.APPROVED) {
      throw new Error('Can only ship transfers in APPROVED status');
    }

    // TODO: Implement two-phase commit inventory operations
    // This would involve:
    // 1. Decrement source location inventory
    // 2. Increment destination location in-transit inventory
    // 3. Handle rollback if either operation fails

    // Update the transfer
    const currentTime = getCurrentTimestamp();
    const [updatedTransfer] = await this.db
      .update(transfers)
      .set({
        status: TransferStatus.SHIPPED,
        shippedBy: shipperId,
        shippedAt: currentTime,
        quantityShipped: existingTransfer.quantityRequested, // For now, assume full quantity shipped
        notes: shippingNotes || existingTransfer.notes,
        updatedAt: currentTime,
      })
      .where(and(
        eq(transfers.id, transferId),
        eq(transfers.tenantId, existingTransfer.tenantId)
      ))
      .returning();

    if (!updatedTransfer) {
      throw new Error('Failed to ship transfer');
    }

    // Log transfer shipping in audit trail
    await this.logTransferAudit({
      tenantId: existingTransfer.tenantId,
      transferId: updatedTransfer.id,
      action: TransferAuditAction.SHIPPED,
      oldStatus: existingTransfer.status,
      newStatus: TransferStatus.SHIPPED,
      oldValues: JSON.stringify(existingTransfer),
      newValues: JSON.stringify(updatedTransfer),
      performedBy: shipperId,
      notes: shippingNotes || 'Transfer shipped'
    });

    // Send shipping notification
    try {
      const { createTransferNotificationService } = await import('./transfer-notification');
      const notificationService = createTransferNotificationService(this.db);
      await notificationService.notifyTransferShipped(updatedTransfer, shipperId, shippingNotes);
    } catch (error) {
      console.error(`Failed to send transfer shipping notification for ${updatedTransfer.id}:`, error);
      // Don't fail the shipping if notification fails
    }

    return updatedTransfer;
  }

  /**
   * Receive a transfer with comprehensive receipt processing
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
   */
  async receiveTransfer(transferId: string, receivingData: ReceivingData): Promise<Transfer> {
    if (!transferId || receivingData.quantityReceived === undefined || receivingData.quantityReceived < 0) {
      throw new Error('Transfer ID and non-negative quantity received are required');
    }

    // Get existing transfer
    const existingTransfer = await this.getTransfer(transferId, '');
    if (!existingTransfer) {
      throw new Error('Transfer not found');
    }

    // Validate user access
    await this.validateUserAccess(receivingData.receivedBy, existingTransfer.tenantId);

    // Check if transfer can be received (only SHIPPED transfers can be received)
    if (existingTransfer.status !== TransferStatus.SHIPPED) {
      throw new Error('Can only receive transfers in SHIPPED status');
    }

    // Validate received quantity doesn't exceed shipped quantity
    const quantityShipped = existingTransfer.quantityShipped || 0;
    if (receivingData.quantityReceived > quantityShipped) {
      throw new Error('Quantity received cannot exceed quantity shipped');
    }

    // Calculate variance (shrinkage)
    const variance = quantityShipped - receivingData.quantityReceived;
    const hasVariance = variance > 0;

    // Process receipt with inventory finalization
    const receiptResult = await this.processTransferReceipt(existingTransfer, receivingData, variance);

    // Update the transfer with receipt information
    const currentTime = getCurrentTimestamp();
    const [updatedTransfer] = await this.db
      .update(transfers)
      .set({
        status: TransferStatus.RECEIVED,
        receivedBy: receivingData.receivedBy,
        receivedAt: receivingData.receivedAt.getTime(),
        quantityReceived: receivingData.quantityReceived,
        varianceReason: hasVariance ? (receivingData.varianceReason || 'Shrinkage during transfer') : null,
        notes: receivingData.notes || existingTransfer.notes,
        updatedAt: currentTime,
      })
      .where(and(
        eq(transfers.id, transferId),
        eq(transfers.tenantId, existingTransfer.tenantId)
      ))
      .returning();

    if (!updatedTransfer) {
      throw new Error('Failed to receive transfer');
    }

    // Log transfer receipt in audit trail with detailed variance information
    await this.logTransferAudit({
      tenantId: existingTransfer.tenantId,
      transferId: updatedTransfer.id,
      action: TransferAuditAction.RECEIVED,
      oldStatus: existingTransfer.status,
      newStatus: TransferStatus.RECEIVED,
      oldValues: JSON.stringify(existingTransfer),
      newValues: JSON.stringify(updatedTransfer),
      performedBy: receivingData.receivedBy,
      notes: this.generateReceiptAuditNotes(receivingData, variance, receiptResult)
    });

    // Send receipt notification
    try {
      const { createTransferNotificationService } = await import('./transfer-notification');
      const notificationService = createTransferNotificationService(this.db);
      await notificationService.notifyTransferReceived(updatedTransfer, receivingData.receivedBy, variance);
    } catch (error) {
      console.error(`Failed to send transfer receipt notification for ${updatedTransfer.id}:`, error);
      // Don't fail the receipt if notification fails
    }

    return updatedTransfer;
  }

  /**
   * Process transfer receipt with inventory finalization and variance handling
   * Requirements: 5.1, 5.2, 5.3, 5.5
   */
  private async processTransferReceipt(
    transfer: Transfer, 
    receivingData: ReceivingData, 
    variance: number
  ): Promise<{
    inventoryUpdated: boolean;
    shrinkageRecorded: boolean;
    varianceAlertTriggered: boolean;
  }> {
    try {
      // Import inventory integration service dynamically to avoid circular dependency
      const { createInventoryIntegrationService } = await import('./inventory-integration');
      const inventoryService = createInventoryIntegrationService(this.db);

      // Execute inventory finalization through two-phase commit
      const inventoryTransaction = await inventoryService.executeTransferReceipt(
        transfer,
        receivingData.quantityReceived
      );

      // Check if variance alert should be triggered
      const varianceAlertTriggered = await this.checkVarianceAlertThreshold(
        transfer,
        variance,
        receivingData.quantityReceived
      );

      return {
        inventoryUpdated: inventoryTransaction.operations.length > 0,
        shrinkageRecorded: variance > 0,
        varianceAlertTriggered
      };
    } catch (error) {
      console.error('Error processing transfer receipt:', error);
      // Continue with transfer update even if inventory integration fails
      // This ensures the transfer status is updated for audit purposes
      return {
        inventoryUpdated: false,
        shrinkageRecorded: variance > 0,
        varianceAlertTriggered: false
      };
    }
  }

  /**
   * Check if variance exceeds alert thresholds and trigger alerts
   * Requirements: 5.3, 5.4
   */
  private async checkVarianceAlertThreshold(
    transfer: Transfer,
    variance: number,
    quantityReceived: number
  ): Promise<boolean> {
    if (variance <= 0) {
      return false;
    }

    const quantityShipped = transfer.quantityShipped || 0;
    const variancePercentage = quantityShipped > 0 ? (variance / quantityShipped) * 100 : 0;

    // Define variance alert thresholds
    const VARIANCE_THRESHOLD_PERCENTAGE = 5; // 5% variance threshold
    const VARIANCE_THRESHOLD_ABSOLUTE = 10; // 10 units absolute threshold

    // Trigger alert if variance exceeds either threshold
    const exceedsPercentageThreshold = variancePercentage > VARIANCE_THRESHOLD_PERCENTAGE;
    const exceedsAbsoluteThreshold = variance > VARIANCE_THRESHOLD_ABSOLUTE;

    if (exceedsPercentageThreshold || exceedsAbsoluteThreshold) {
      try {
        // Import variance reporting service dynamically to avoid circular dependency
        const { createVarianceReportingService } = await import('./variance-reporting');
        const varianceService = createVarianceReportingService(this.db);
        
        // Trigger variance alert through the variance reporting service
        await varianceService.triggerVarianceAlert(transfer, variance, variancePercentage);
        
        console.warn(`Variance alert triggered for transfer ${transfer.id}: ${variance} units (${variancePercentage.toFixed(2)}%)`);
        return true;
      } catch (error) {
        console.error('Error triggering variance alert:', error);
        // Continue processing even if alert fails
        return false;
      }
    }

    return false;
  }

  /**
   * Generate detailed audit notes for receipt processing
   * Requirements: 5.1, 5.2, 5.3
   */
  private generateReceiptAuditNotes(
    receivingData: ReceivingData,
    variance: number,
    receiptResult: {
      inventoryUpdated: boolean;
      shrinkageRecorded: boolean;
      varianceAlertTriggered: boolean;
    }
  ): string {
    const notes = [`Transfer received: ${receivingData.quantityReceived} units`];

    if (variance > 0) {
      notes.push(`Shrinkage detected: ${variance} units`);
      if (receivingData.varianceReason) {
        notes.push(`Variance reason: ${receivingData.varianceReason}`);
      }
      if (receiptResult.varianceAlertTriggered) {
        notes.push('Variance alert triggered due to high shrinkage');
      }
    }

    if (receivingData.damageReport) {
      notes.push(`Damage report: ${receivingData.damageReport}`);
    }

    if (receiptResult.inventoryUpdated) {
      notes.push('Inventory finalized successfully');
    } else {
      notes.push('Warning: Inventory finalization failed - manual reconciliation may be required');
    }

    if (receivingData.notes) {
      notes.push(`Additional notes: ${receivingData.notes}`);
    }

    return notes.join('. ');
  }

  /**
   * Cancel a transfer with comprehensive validation and inventory restoration
   * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
   */
  async cancelTransfer(transferId: string, cancellerId: string, reason: string): Promise<Transfer> {
    if (!transferId || !cancellerId || !reason) {
      throw new Error('Transfer ID, canceller ID, and reason are required');
    }

    // Get existing transfer
    const existingTransfer = await this.getTransfer(transferId, '');
    if (!existingTransfer) {
      throw new Error('Transfer not found');
    }

    // Validate user access
    await this.validateUserAccess(cancellerId, existingTransfer.tenantId);

    // Requirement 7.1: Status-based cancellation rules
    if (!this.canCancelTransfer(existingTransfer.status as TransferStatusType)) {
      throw new Error(`Cannot cancel transfer in ${existingTransfer.status} status. Only REQUESTED or APPROVED transfers can be cancelled.`);
    }

    // Requirement 7.2: Authorization checking
    await this.validateCancellationAuthorization(existingTransfer, cancellerId);

    // Requirement 7.3: Inventory restoration for cancelled transfers
    let inventoryRestored = false;
    if (existingTransfer.status === TransferStatus.APPROVED) {
      inventoryRestored = await this.restoreInventoryForCancelledTransfer(existingTransfer);
    }

    // Update the transfer
    const currentTime = getCurrentTimestamp();
    const [updatedTransfer] = await this.db
      .update(transfers)
      .set({
        status: TransferStatus.CANCELLED,
        cancelledBy: cancellerId,
        cancelledAt: currentTime,
        cancellationReason: reason,
        updatedAt: currentTime,
      })
      .where(and(
        eq(transfers.id, transferId),
        eq(transfers.tenantId, existingTransfer.tenantId)
      ))
      .returning();

    if (!updatedTransfer) {
      throw new Error('Failed to cancel transfer');
    }

    // Log transfer cancellation in audit trail with detailed information
    await this.logTransferAudit({
      tenantId: existingTransfer.tenantId,
      transferId: updatedTransfer.id,
      action: TransferAuditAction.CANCELLED,
      oldStatus: existingTransfer.status,
      newStatus: TransferStatus.CANCELLED,
      oldValues: JSON.stringify(existingTransfer),
      newValues: JSON.stringify(updatedTransfer),
      performedBy: cancellerId,
      notes: this.generateCancellationAuditNotes(reason, inventoryRestored, existingTransfer.status)
    });

    // Requirement 7.4: Send cancellation notifications
    await this.sendCancellationNotifications(updatedTransfer, reason);

    return updatedTransfer;
  }

  /**
   * Check if a transfer can be cancelled based on its current status
   * Requirements: 7.1
   */
  private canCancelTransfer(status: TransferStatusType): boolean {
    // Only REQUESTED or APPROVED transfers can be cancelled
    return status === TransferStatus.REQUESTED || status === TransferStatus.APPROVED;
  }

  /**
   * Validate that the user has authorization to cancel the transfer
   * Requirements: 7.2
   */
  private async validateCancellationAuthorization(transfer: Transfer, cancellerId: string): Promise<void> {
    const user = await this.validateUserAccess(cancellerId, transfer.tenantId);
    
    // Check if user is the original requester
    const isOriginalRequester = transfer.requestedBy === cancellerId;
    
    // Check if user has manager/admin role
    const hasManagerRole = user.role === 'ADMIN' || user.role === 'MANAGER';
    
    // Check if user has access to source location (for approved transfers)
    let hasSourceLocationAccess = false;
    if (transfer.status === TransferStatus.APPROVED) {
      // For approved transfers, only source location managers can cancel
      hasSourceLocationAccess = user.locationId === transfer.sourceLocationId || hasManagerRole;
    }

    // Authorization rules:
    // - Original requester can cancel REQUESTED transfers
    // - Source location managers can cancel APPROVED transfers
    // - Admins can cancel any cancellable transfer
    const canCancel = 
      (transfer.status === TransferStatus.REQUESTED && (isOriginalRequester || hasManagerRole)) ||
      (transfer.status === TransferStatus.APPROVED && (hasSourceLocationAccess || hasManagerRole));

    if (!canCancel) {
      throw new Error(
        `Insufficient authorization to cancel transfer. ` +
        `${transfer.status === TransferStatus.REQUESTED 
          ? 'Only the original requester or managers can cancel requested transfers.' 
          : 'Only source location managers or admins can cancel approved transfers.'}`
      );
    }
  }

  /**
   * Restore inventory reservations for cancelled approved transfers
   * Requirements: 7.3
   */
  private async restoreInventoryForCancelledTransfer(transfer: Transfer): Promise<boolean> {
    try {
      // Import inventory integration service dynamically to avoid circular dependency
      const { createInventoryIntegrationService } = await import('./inventory-integration');
      const inventoryService = createInventoryIntegrationService(this.db);

      // Release any inventory reservations for this transfer
      await inventoryService.releaseInventoryReservation(`transfer_${transfer.id}`);

      console.log(`Inventory restored for cancelled transfer ${transfer.id}`);
      return true;
    } catch (error) {
      console.error(`Failed to restore inventory for cancelled transfer ${transfer.id}:`, error);
      // Don't fail the cancellation if inventory restoration fails
      // This should be handled by a background reconciliation process
      return false;
    }
  }

  /**
   * Generate detailed audit notes for transfer cancellation
   * Requirements: 7.5
   */
  private generateCancellationAuditNotes(reason: string, inventoryRestored: boolean, originalStatus: string): string {
    const notes = [`Transfer cancelled from ${originalStatus} status: ${reason}`];
    
    if (originalStatus === TransferStatus.APPROVED) {
      if (inventoryRestored) {
        notes.push('Inventory reservations released successfully');
      } else {
        notes.push('Warning: Inventory restoration failed - manual reconciliation may be required');
      }
    }
    
    return notes.join('. ');
  }

  /**
   * Send notifications for transfer cancellation
   * Requirements: 7.4, 7.5
   */
  private async sendCancellationNotifications(transfer: Transfer, reason: string): Promise<void> {
    try {
      // Import notification service dynamically to avoid circular dependency
      const { createTransferNotificationService } = await import('./transfer-notification');
      const notificationService = createTransferNotificationService(this.db);
      
      // Send cancellation notification through the notification service
      await notificationService.notifyTransferCancelled(transfer, transfer.cancelledBy!, reason);
      
    } catch (error) {
      console.error(`Failed to send cancellation notifications for transfer ${transfer.id}:`, error);
      // Don't fail the cancellation if notifications fail
    }
  }

  /**
   * Get transfers for a specific location
   * Requirements: 4.4, 5.1, 5.4
   */
  async getTransfersForLocation(locationId: string, tenantId: string, filters?: TransferFilters): Promise<Transfer[]> {
    if (!locationId) {
      throw new Error('Location ID is required');
    }

    // Validate location access
    await this.validateLocationAccess(locationId, tenantId);

    // Apply filters
    const conditions = [
      eq(transfers.tenantId, tenantId),
      sql`(${transfers.sourceLocationId} = ${locationId} OR ${transfers.destinationLocationId} = ${locationId})`
    ];

    if (filters?.status) {
      conditions.push(eq(transfers.status, filters.status));
    }

    if (filters?.productId) {
      conditions.push(eq(transfers.productId, filters.productId));
    }

    if (filters?.priority) {
      conditions.push(eq(transfers.priority, filters.priority));
    }

    if (filters?.dateFrom) {
      conditions.push(sql`${transfers.createdAt} >= ${filters.dateFrom.getTime()}`);
    }

    if (filters?.dateTo) {
      conditions.push(sql`${transfers.createdAt} <= ${filters.dateTo.getTime()}`);
    }

    const result = await this.db
      .select()
      .from(transfers)
      .where(and(...conditions))
      .orderBy(desc(transfers.createdAt))
      .limit(filters?.limit || 100)
      .offset(filters?.offset || 0);

    return result;
  }

  /**
   * Get detailed transfer information
   * Requirements: 4.4, 4.5
   */
  async getTransferDetails(transferId: string, tenantId: string): Promise<TransferWithDetails | null> {
    if (!transferId) {
      throw new Error('Transfer ID is required');
    }

    // Get the transfer
    const transfer = await this.getTransfer(transferId, tenantId);
    if (!transfer) {
      return null;
    }

    // Get related data
    const [sourceLocation, destinationLocation, product, auditTrail] = await Promise.all([
      this.getLocation(transfer.sourceLocationId, tenantId),
      this.getLocation(transfer.destinationLocationId, tenantId),
      this.getProduct(transfer.productId, tenantId),
      this.getTransferAuditTrail(transferId, tenantId)
    ]);

    if (!sourceLocation || !destinationLocation || !product) {
      throw new Error('Failed to load transfer details');
    }

    return {
      transfer,
      sourceLocation,
      destinationLocation,
      product,
      auditTrail,
      // TODO: Add related allocations if needed
    };
  }

  /**
   * Get transfers by status
   * Requirements: 4.2, 4.3, 4.5
   */
  async getTransfersByStatus(status: TransferStatusType, tenantId: string, filters?: TransferFilters): Promise<Transfer[]> {
    if (!status) {
      throw new Error('Status is required');
    }

    // Validate status is valid
    const validStatuses: TransferStatusType[] = ['REQUESTED', 'APPROVED', 'SHIPPED', 'RECEIVED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Valid statuses are: ${validStatuses.join(', ')}`);
    }

    const conditions = [
      eq(transfers.tenantId, tenantId),
      eq(transfers.status, status)
    ];

    if (filters?.sourceLocationId) {
      conditions.push(eq(transfers.sourceLocationId, filters.sourceLocationId));
    }

    if (filters?.destinationLocationId) {
      conditions.push(eq(transfers.destinationLocationId, filters.destinationLocationId));
    }

    if (filters?.productId) {
      conditions.push(eq(transfers.productId, filters.productId));
    }

    if (filters?.priority) {
      conditions.push(eq(transfers.priority, filters.priority));
    }

    if (filters?.dateFrom) {
      conditions.push(sql`${transfers.createdAt} >= ${filters.dateFrom.getTime()}`);
    }

    if (filters?.dateTo) {
      conditions.push(sql`${transfers.createdAt} <= ${filters.dateTo.getTime()}`);
    }

    const result = await this.db
      .select()
      .from(transfers)
      .where(and(...conditions))
      .orderBy(desc(transfers.createdAt))
      .limit(filters?.limit || 100)
      .offset(filters?.offset || 0);

    return result;
  }

  /**
   * Update a transfer
   * Requirements: 1.1, 1.2, 4.4
   */
  async updateTransfer(transferId: string, updates: UpdateTransferRequest, tenantId: string, updatedBy: string): Promise<Transfer> {
    if (!transferId) {
      throw new Error('Transfer ID is required');
    }

    // Get existing transfer
    const existingTransfer = await this.getTransfer(transferId, tenantId);
    if (!existingTransfer) {
      throw new Error('Transfer not found');
    }

    // Validate user access
    await this.validateUserAccess(updatedBy, tenantId);

    // Check if transfer can be modified (only REQUESTED transfers can be modified)
    if (existingTransfer.status !== TransferStatus.REQUESTED) {
      throw new Error('Can only modify transfers in REQUESTED status');
    }

    // Validate quantity if being updated
    if (updates.quantityRequested !== undefined && updates.quantityRequested <= 0) {
      throw new Error('Quantity requested must be positive');
    }

    // Update the transfer
    const currentTime = getCurrentTimestamp();
    const updateData: Partial<NewTransfer> = {
      updatedAt: currentTime,
    };

    if (updates.quantityRequested !== undefined) {
      updateData.quantityRequested = updates.quantityRequested;
    }
    if (updates.notes !== undefined) {
      updateData.notes = updates.notes;
    }
    if (updates.reasonCode !== undefined) {
      // Store reason code in notes for now, could be separate field
      updateData.notes = updates.reasonCode + (updates.notes ? `: ${updates.notes}` : '');
    }

    const [updatedTransfer] = await this.db
      .update(transfers)
      .set(updateData)
      .where(and(
        eq(transfers.id, transferId),
        eq(transfers.tenantId, tenantId)
      ))
      .returning();

    if (!updatedTransfer) {
      throw new Error('Failed to update transfer');
    }

    // Log transfer update in audit trail
    await this.logTransferAudit({
      tenantId,
      transferId: updatedTransfer.id,
      action: TransferAuditAction.CREATED, // Using CREATED as there's no UPDATE action defined
      oldStatus: existingTransfer.status,
      newStatus: updatedTransfer.status,
      oldValues: JSON.stringify(existingTransfer),
      newValues: JSON.stringify(updatedTransfer),
      performedBy: updatedBy,
      notes: 'Transfer updated'
    });

    return updatedTransfer;
  }

  /**
   * Get a single transfer
   */
  async getTransfer(transferId: string, tenantId: string): Promise<Transfer | null> {
    if (!transferId) {
      throw new Error('Transfer ID is required');
    }

    const conditions = [eq(transfers.id, transferId)];
    if (tenantId) {
      conditions.push(eq(transfers.tenantId, tenantId));
    }

    const [transfer] = await this.db
      .select()
      .from(transfers)
      .where(and(...conditions))
      .limit(1);

    return transfer || null;
  }

  // Private helper methods

  private async validateProductAccess(productId: string, tenantId: string): Promise<Product> {
    const [product] = await this.db
      .select()
      .from(products)
      .where(and(
        eq(products.id, productId),
        eq(products.tenantId, tenantId)
      ))
      .limit(1);

    if (!product) {
      throw new Error('Product not found in this organization');
    }

    return product;
  }

  private async validateLocationAccess(locationId: string, tenantId: string): Promise<Location> {
    const [location] = await this.db
      .select()
      .from(locations)
      .where(and(
        eq(locations.id, locationId),
        eq(locations.tenantId, tenantId)
      ))
      .limit(1);

    if (!location) {
      throw new Error('Location not found in this organization');
    }

    return location;
  }

  private async validateUserAccess(userId: string, tenantId: string): Promise<User> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);

    if (!user) {
      throw new Error('User not found in this organization');
    }

    return user;
  }

  private async getLocation(locationId: string, tenantId: string): Promise<Location | null> {
    const [location] = await this.db
      .select()
      .from(locations)
      .where(and(
        eq(locations.id, locationId),
        eq(locations.tenantId, tenantId)
      ))
      .limit(1);

    return location || null;
  }

  private async getProduct(productId: string, tenantId: string): Promise<Product | null> {
    const [product] = await this.db
      .select()
      .from(products)
      .where(and(
        eq(products.id, productId),
        eq(products.tenantId, tenantId)
      ))
      .limit(1);

    return product || null;
  }

  private async getTransferAuditTrail(transferId: string, tenantId: string): Promise<TransferAuditLog[]> {
    const auditTrail = await this.db
      .select()
      .from(transferAuditLog)
      .where(and(
        eq(transferAuditLog.transferId, transferId),
        eq(transferAuditLog.tenantId, tenantId)
      ))
      .orderBy(desc(transferAuditLog.performedAt));

    return auditTrail;
  }

  private async logTransferAudit(auditData: {
    tenantId: string;
    transferId: string;
    action: TransferAuditActionType;
    oldStatus: string | null;
    newStatus: string;
    oldValues: string | null;
    newValues: string;
    performedBy: string;
    notes?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const currentTime = getCurrentTimestamp();
    const newAuditLog: NewTransferAuditLog = {
      id: `audit_${generateId()}`,
      tenantId: auditData.tenantId,
      transferId: auditData.transferId,
      action: auditData.action,
      oldStatus: auditData.oldStatus,
      newStatus: auditData.newStatus,
      oldValues: auditData.oldValues,
      newValues: auditData.newValues,
      performedBy: auditData.performedBy,
      performedAt: currentTime,
      notes: auditData.notes || null,
      ipAddress: auditData.ipAddress || null,
      userAgent: auditData.userAgent || null,
    };

    await this.db
      .insert(transferAuditLog)
      .values(newAuditLog);
  }
}

// Factory function for creating transfer service
export function createTransferService(db: DrizzleD1Database): TransferService {
  return new TransferServiceImpl(db);
}