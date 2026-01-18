import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { 
  transfers,
  transferAuditLog,
  Transfer,
  NewTransferAuditLog,
  TransferStatus,
  TransferStatusType,
  TransferAuditAction,
  TransferAuditActionType
} from '../db/schema';
import { generateId, getCurrentTimestamp } from '../utils';
import { ReceivingData } from './transfer';

// State machine interfaces as defined in the design document
export interface TransitionContext {
  userId: string;
  tenantId: string;
  reason?: string | undefined;
  metadata?: Record<string, any> | undefined;
  receivingData?: ReceivingData | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields?: string[];
}

export interface TransferStateMachine {
  canTransition(from: TransferStatusType, to: TransferStatusType): boolean;
  validateTransition(transfer: Transfer, newStatus: TransferStatusType, context: TransitionContext): Promise<ValidationResult>;
  executeTransition(transfer: Transfer, newStatus: TransferStatusType, context: TransitionContext): Promise<Transfer>;
  getValidTransitions(currentStatus: TransferStatusType): TransferStatusType[];
}

/**
 * Transfer State Machine Implementation
 * 
 * Enforces proper workflow transitions and business rules for transfer operations.
 * Implements the state transition rules defined in the design document:
 * 
 * - REQUESTED → APPROVED: Requires source location authorization
 * - REQUESTED → CANCELLED: Allowed by requester or source location manager
 * - APPROVED → SHIPPED: Requires inventory availability and two-phase commit
 * - APPROVED → CANCELLED: Requires authorization and reason
 * - SHIPPED → RECEIVED: Requires receiving confirmation and variance handling
 * - SHIPPED → CANCELLED: Not allowed (use variance handling instead)
 * 
 * Requirements: 2.4, 2.5, 4.1
 */
export class TransferStateMachineImpl implements TransferStateMachine {
  constructor(private db: DrizzleD1Database) {}

  /**
   * Check if a state transition is allowed based on business rules
   * Requirements: 2.4, 2.5
   */
  canTransition(from: TransferStatusType, to: TransferStatusType): boolean {
    // Define valid state transitions
    const validTransitions: Record<TransferStatusType, TransferStatusType[]> = {
      [TransferStatus.REQUESTED]: [TransferStatus.APPROVED, TransferStatus.CANCELLED],
      [TransferStatus.APPROVED]: [TransferStatus.SHIPPED, TransferStatus.CANCELLED],
      [TransferStatus.SHIPPED]: [TransferStatus.RECEIVED],
      [TransferStatus.RECEIVED]: [], // Terminal state
      [TransferStatus.CANCELLED]: [], // Terminal state
    };

    const allowedTransitions = validTransitions[from] || [];
    return allowedTransitions.includes(to);
  }

  /**
   * Validate a state transition with business logic and context
   * Requirements: 2.4, 2.5, 4.1
   */
  async validateTransition(
    transfer: Transfer, 
    newStatus: TransferStatusType, 
    context: TransitionContext
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      requiredFields: []
    };

    // Check if transition is allowed by state machine rules
    if (!this.canTransition(transfer.status as TransferStatusType, newStatus)) {
      result.valid = false;
      result.errors.push(
        `Invalid state transition from ${transfer.status} to ${newStatus}. ` +
        `Valid transitions from ${transfer.status} are: ${this.getValidTransitions(transfer.status as TransferStatusType).join(', ')}`
      );
      return result;
    }

    // Validate tenant context
    if (transfer.tenantId !== context.tenantId) {
      result.valid = false;
      result.errors.push('Transfer does not belong to the specified tenant');
      return result;
    }

    // Validate user ID is provided
    if (!context.userId) {
      result.valid = false;
      result.errors.push('User ID is required for state transitions');
      return result;
    }

    // Validate specific transition requirements
    switch (newStatus) {
      case TransferStatus.APPROVED:
        await this.validateApprovalTransition(transfer, context, result);
        break;
      
      case TransferStatus.CANCELLED:
        await this.validateCancellationTransition(transfer, context, result);
        break;
      
      case TransferStatus.SHIPPED:
        await this.validateShippingTransition(transfer, context, result);
        break;
      
      case TransferStatus.RECEIVED:
        await this.validateReceiptTransition(transfer, context, result);
        break;
    }

    return result;
  }

  /**
   * Execute a state transition with proper audit logging
   * Requirements: 2.4, 2.5, 4.1
   */
  async executeTransition(
    transfer: Transfer, 
    newStatus: TransferStatusType, 
    context: TransitionContext
  ): Promise<Transfer> {
    // Validate the transition first
    const validation = await this.validateTransition(transfer, newStatus, context);
    if (!validation.valid) {
      throw new Error(`Transition validation failed: ${validation.errors.join(', ')}`);
    }

    // Prepare update data based on new status
    const currentTime = getCurrentTimestamp();
    const updateData: Partial<Transfer> = {
      status: newStatus,
      updatedAt: currentTime,
    };

    // Set status-specific fields
    switch (newStatus) {
      case TransferStatus.APPROVED:
        updateData.approvedBy = context.userId;
        updateData.approvedAt = currentTime;
        break;
      
      case TransferStatus.CANCELLED:
        updateData.cancelledBy = context.userId;
        updateData.cancelledAt = currentTime;
        updateData.cancellationReason = context.reason || 'No reason provided';
        break;
      
      case TransferStatus.SHIPPED:
        updateData.shippedBy = context.userId;
        updateData.shippedAt = currentTime;
        updateData.quantityShipped = transfer.quantityRequested; // For now, assume full quantity shipped
        break;
      
      case TransferStatus.RECEIVED:
        if (context.receivingData) {
          updateData.receivedBy = context.receivingData.receivedBy;
          updateData.receivedAt = context.receivingData.receivedAt.getTime();
          updateData.quantityReceived = context.receivingData.quantityReceived;
          
          // Handle variance
          const quantityShipped = transfer.quantityShipped || 0;
          const variance = quantityShipped - context.receivingData.quantityReceived;
          if (variance > 0) {
            updateData.varianceReason = context.receivingData.varianceReason || 'Shrinkage during transfer';
          }
        }
        break;
    }

    // Update notes if provided
    if (context.reason && newStatus !== TransferStatus.CANCELLED) {
      updateData.notes = context.reason;
    }

    // Execute the database update
    const [updatedTransfer] = await this.db
      .update(transfers)
      .set(updateData)
      .where(and(
        eq(transfers.id, transfer.id),
        eq(transfers.tenantId, context.tenantId)
      ))
      .returning();

    if (!updatedTransfer) {
      throw new Error('Failed to update transfer status');
    }

    // Log the state transition in audit trail
    await this.logStateTransition(transfer, updatedTransfer, context);

    return updatedTransfer;
  }

  /**
   * Get valid transitions from a given status
   * Requirements: 2.4, 2.5
   */
  getValidTransitions(currentStatus: TransferStatusType): TransferStatusType[] {
    const validTransitions: Record<TransferStatusType, TransferStatusType[]> = {
      [TransferStatus.REQUESTED]: [TransferStatus.APPROVED, TransferStatus.CANCELLED],
      [TransferStatus.APPROVED]: [TransferStatus.SHIPPED, TransferStatus.CANCELLED],
      [TransferStatus.SHIPPED]: [TransferStatus.RECEIVED],
      [TransferStatus.RECEIVED]: [], // Terminal state
      [TransferStatus.CANCELLED]: [], // Terminal state
    };

    return validTransitions[currentStatus] || [];
  }

  // Private validation methods for specific transitions

  private async validateApprovalTransition(
    transfer: Transfer, 
    context: TransitionContext, 
    result: ValidationResult
  ): Promise<void> {
    // Only REQUESTED transfers can be approved
    if (transfer.status !== TransferStatus.REQUESTED) {
      result.valid = false;
      result.errors.push('Can only approve transfers in REQUESTED status');
      return;
    }

    // TODO: Validate user has authorization for source location
    // This would require checking user permissions against the source location
    // For now, we assume the user validation is handled at the service level
    
    // Use context for future authorization checks
    if (context.userId) {
      // Placeholder for authorization logic
    }
  }

  private async validateCancellationTransition(
    transfer: Transfer, 
    context: TransitionContext, 
    result: ValidationResult
  ): Promise<void> {
    // Only REQUESTED or APPROVED transfers can be cancelled
    if (transfer.status !== TransferStatus.REQUESTED && transfer.status !== TransferStatus.APPROVED) {
      result.valid = false;
      result.errors.push('Can only cancel transfers in REQUESTED or APPROVED status');
      return;
    }

    // Require cancellation reason
    if (!context.reason || context.reason.trim().length === 0) {
      result.valid = false;
      result.errors.push('Cancellation reason is required');
      result.requiredFields = ['reason'];
      return;
    }

    // TODO: Validate user has authorization to cancel
    // This could involve checking if user is the requester or has manager permissions
  }

  private async validateShippingTransition(
    transfer: Transfer, 
    context: TransitionContext, 
    result: ValidationResult
  ): Promise<void> {
    // Only APPROVED transfers can be shipped
    if (transfer.status !== TransferStatus.APPROVED) {
      result.valid = false;
      result.errors.push('Can only ship transfers in APPROVED status');
      return;
    }

    // TODO: Validate inventory availability at source location
    // This would require integration with inventory system to check:
    // 1. Sufficient quantity available at source location
    // 2. No conflicting reservations
    // 3. Inventory can be reserved for this transfer

    // TODO: Validate user has shipping permissions for source location
    // Use context for future authorization checks
    if (context.userId) {
      // Placeholder for authorization logic
    }
  }

  private async validateReceiptTransition(
    transfer: Transfer, 
    context: TransitionContext, 
    result: ValidationResult
  ): Promise<void> {
    // Only SHIPPED transfers can be received
    if (transfer.status !== TransferStatus.SHIPPED) {
      result.valid = false;
      result.errors.push('Can only receive transfers in SHIPPED status');
      return;
    }

    // Require receiving data
    if (!context.receivingData) {
      result.valid = false;
      result.errors.push('Receiving data is required for receipt confirmation');
      result.requiredFields = ['receivingData'];
      return;
    }

    const receivingData = context.receivingData;

    // Validate received quantity
    if (receivingData.quantityReceived < 0) {
      result.valid = false;
      result.errors.push('Quantity received cannot be negative');
      return;
    }

    // Validate received quantity doesn't exceed shipped quantity
    const quantityShipped = transfer.quantityShipped || 0;
    if (receivingData.quantityReceived > quantityShipped) {
      result.valid = false;
      result.errors.push(
        `Quantity received (${receivingData.quantityReceived}) cannot exceed quantity shipped (${quantityShipped})`
      );
      return;
    }

    // Require variance reason if there's shrinkage
    const variance = quantityShipped - receivingData.quantityReceived;
    if (variance > 0 && (!receivingData.varianceReason || receivingData.varianceReason.trim().length === 0)) {
      result.warnings.push(
        `Shrinkage detected: ${variance} units. Consider providing a variance reason for audit purposes.`
      );
    }

    // TODO: Validate user has receiving permissions for destination location
    // Use context for future authorization checks
    if (context.userId) {
      // Placeholder for authorization logic
    }
  }

  /**
   * Log state transition in audit trail
   * Requirements: 4.1
   */
  private async logStateTransition(
    oldTransfer: Transfer,
    newTransfer: Transfer,
    context: TransitionContext
  ): Promise<void> {
    // Determine audit action based on new status
    let auditAction: TransferAuditActionType;
    switch (newTransfer.status) {
      case TransferStatus.APPROVED:
        auditAction = TransferAuditAction.APPROVED;
        break;
      case TransferStatus.CANCELLED:
        auditAction = oldTransfer.status === TransferStatus.REQUESTED 
          ? TransferAuditAction.REJECTED 
          : TransferAuditAction.CANCELLED;
        break;
      case TransferStatus.SHIPPED:
        auditAction = TransferAuditAction.SHIPPED;
        break;
      case TransferStatus.RECEIVED:
        auditAction = TransferAuditAction.RECEIVED;
        break;
      default:
        auditAction = TransferAuditAction.CREATED; // Fallback
    }

    // Create audit log entry
    const auditEntry: NewTransferAuditLog = {
      id: `audit_${generateId()}`,
      tenantId: context.tenantId,
      transferId: newTransfer.id,
      action: auditAction,
      oldStatus: oldTransfer.status,
      newStatus: newTransfer.status,
      oldValues: JSON.stringify(oldTransfer),
      newValues: JSON.stringify(newTransfer),
      performedBy: context.userId,
      performedAt: getCurrentTimestamp(),
      notes: this.generateAuditNotes(oldTransfer, newTransfer, context),
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
    };

    await this.db
      .insert(transferAuditLog)
      .values(auditEntry);
  }

  /**
   * Generate descriptive audit notes for state transitions
   */
  private generateAuditNotes(
    oldTransfer: Transfer,
    newTransfer: Transfer,
    context: TransitionContext
  ): string {
    const statusChange = `Status changed from ${oldTransfer.status} to ${newTransfer.status}`;
    
    switch (newTransfer.status) {
      case TransferStatus.APPROVED:
        return `${statusChange}. Transfer approved${context.reason ? `: ${context.reason}` : ''}`;
      
      case TransferStatus.CANCELLED:
        const reason = context.reason || newTransfer.cancellationReason || 'No reason provided';
        return `${statusChange}. Transfer cancelled: ${reason}`;
      
      case TransferStatus.SHIPPED:
        return `${statusChange}. Transfer shipped (${newTransfer.quantityShipped} units)${context.reason ? `. Notes: ${context.reason}` : ''}`;
      
      case TransferStatus.RECEIVED:
        const receivingData = context.receivingData;
        if (receivingData) {
          const variance = (newTransfer.quantityShipped || 0) - receivingData.quantityReceived;
          const varianceNote = variance > 0 
            ? ` with ${variance} units shrinkage${receivingData.varianceReason ? ` (${receivingData.varianceReason})` : ''}`
            : '';
          return `${statusChange}. Transfer received (${receivingData.quantityReceived} units)${varianceNote}`;
        }
        return `${statusChange}. Transfer received`;
      
      default:
        return statusChange;
    }
  }
}

// Factory function for creating transfer state machine
export function createTransferStateMachine(db: DrizzleD1Database): TransferStateMachine {
  return new TransferStateMachineImpl(db);
}