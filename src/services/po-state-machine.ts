import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { 
  purchaseOrders, 
  poItems,
  poAuditLog,
  PurchaseOrder, 
  POStatusType,
  NewPOAuditLog
} from '../db/schema';
import { generateId, getCurrentTimestamp } from '../utils';
import { PONumberGenerator, createPONumberGenerator } from './po-number-generator';

// State machine interfaces as defined in the design document
export interface TransitionContext {
  userId: string;
  tenantId: string;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface POStateMachine {
  canTransition(from: POStatusType, to: POStatusType): boolean;
  validateTransition(po: PurchaseOrder, newStatus: POStatusType, context: TransitionContext): Promise<ValidationResult>;
  executeTransition(po: PurchaseOrder, newStatus: POStatusType, context: TransitionContext): Promise<PurchaseOrder>;
}

/**
 * Purchase Order State Machine Implementation
 * Enforces proper workflow transitions and business rules
 * Requirements: 2.4, 2.5
 */
export class POStateMachineImpl implements POStateMachine {
  constructor(
    private db: DrizzleD1Database,
    private poNumberGenerator: PONumberGenerator
  ) {}

  /**
   * Check if a state transition is allowed based on business rules
   * Requirements: 2.4
   */
  canTransition(from: POStatusType, to: POStatusType): boolean {
    // Define valid state transitions using string literals
    const validTransitions: Record<string, string[]> = {
      'DRAFT': ['APPROVED', 'CANCELLED'],
      'APPROVED': ['RECEIVED', 'CANCELLED'],
      'RECEIVED': [], // Terminal state - no further transitions
      'CANCELLED': [], // Terminal state - no further transitions
    };

    return validTransitions[from]?.includes(to) || false;
  }

  /**
   * Validate that a state transition can be performed with current PO data
   * Requirements: 2.4, 2.5
   */
  async validateTransition(
    po: PurchaseOrder, 
    newStatus: POStatusType, 
    context: TransitionContext
  ): Promise<ValidationResult> {
    const errors: string[] = [];

    // Check if transition is allowed
    if (!this.canTransition(po.status as POStatusType, newStatus)) {
      errors.push(`Cannot transition from ${po.status} to ${newStatus}`);
      return { isValid: false, errors };
    }

    // Validate tenant isolation
    if (po.tenantId !== context.tenantId) {
      errors.push('Purchase order does not belong to the specified tenant');
      return { isValid: false, errors };
    }

    // Status-specific validations
    switch (newStatus) {
      case 'APPROVED':
        await this.validateApprovalTransition(po, context, errors);
        break;
      
      case 'RECEIVED':
        await this.validateReceivingTransition(po, context, errors);
        break;
      
      case 'CANCELLED':
        await this.validateCancellationTransition(po, context, errors);
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Execute a state transition with proper audit logging
   * Requirements: 2.4, 2.5, 2.9
   */
  async executeTransition(
    po: PurchaseOrder, 
    newStatus: POStatusType, 
    context: TransitionContext
  ): Promise<PurchaseOrder> {
    // Validate transition first
    const validation = await this.validateTransition(po, newStatus, context);
    if (!validation.isValid) {
      throw new Error(`Transition validation failed: ${validation.errors.join(', ')}`);
    }

    const currentTime = getCurrentTimestamp();
    const oldValues = { ...po };

    // Prepare update data based on new status
    const updateData: Partial<PurchaseOrder> = {
      status: newStatus,
      updatedAt: currentTime,
    };

    // Status-specific updates
    switch (newStatus) {
      case 'APPROVED':
        try {
          // Generate PO number on approval
          const poNumber = await this.poNumberGenerator.generatePONumber(context.tenantId);
          updateData.poNumber = poNumber;
          updateData.approvedBy = context.userId;
          updateData.approvedAt = currentTime;
        } catch (error) {
          throw new Error(`Failed to generate PO number: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        break;
      
      case 'RECEIVED':
        updateData.receivedBy = context.userId;
        updateData.receivedAt = currentTime;
        break;
      
      case 'CANCELLED':
        // No additional fields needed for cancellation
        break;
    }

    // Execute the database transaction
    const [updatedPO] = await this.db
      .update(purchaseOrders)
      .set(updateData)
      .where(and(
        eq(purchaseOrders.id, po.id),
        eq(purchaseOrders.tenantId, context.tenantId)
      ))
      .returning();

    if (!updatedPO) {
      throw new Error('Failed to update purchase order status');
    }

    // Log the state transition for audit purposes
    await this.logStateTransition(po, updatedPO, context, oldValues);

    return updatedPO;
  }

  /**
   * Validate approval transition requirements
   * Requirements: 2.4
   */
  private async validateApprovalTransition(
    po: PurchaseOrder, 
    context: TransitionContext, 
    errors: string[]
  ): Promise<void> {
    // Check that PO has line items
    const items = await this.db
      .select()
      .from(poItems)
      .where(eq(poItems.poId, po.id));

    if (items.length === 0) {
      errors.push('Cannot approve purchase order without line items');
      return;
    }

    // Validate all line items have valid quantities and prices
    for (const item of items) {
      if (item.quantityOrdered <= 0) {
        errors.push(`Line item ${item.id} has invalid quantity: ${item.quantityOrdered}`);
      }
      if (item.unitPriceCents <= 0) {
        errors.push(`Line item ${item.id} has invalid unit price: ${item.unitPriceCents}`);
      }
    }

    // Validate PO has a positive total
    if (!po.totalCostCents || po.totalCostCents <= 0) {
      errors.push('Purchase order must have a positive total cost');
    }
  }

  /**
   * Validate receiving transition requirements
   * Requirements: 2.5
   */
  private async validateReceivingTransition(
    po: PurchaseOrder, 
    context: TransitionContext, 
    errors: string[]
  ): Promise<void> {
    // PO must be approved to be received
    if (po.status !== 'APPROVED') {
      errors.push('Only approved purchase orders can be received');
    }

    // PO must have a PO number (generated on approval)
    if (!po.poNumber) {
      errors.push('Purchase order must have a PO number to be received');
    }
  }

  /**
   * Validate cancellation transition requirements
   * Requirements: 2.4, 2.5
   */
  private async validateCancellationTransition(
    po: PurchaseOrder, 
    context: TransitionContext, 
    errors: string[]
  ): Promise<void> {
    // Can cancel from DRAFT or APPROVED status
    if (po.status !== 'DRAFT' && po.status !== 'APPROVED') {
      errors.push(`Cannot cancel purchase order in ${po.status} status`);
    }

    // For approved POs, require a reason for cancellation
    if (po.status === 'APPROVED' && !context.reason) {
      errors.push('Reason is required when cancelling an approved purchase order');
    }
  }

  /**
   * Log state transition for audit trail
   * Requirements: 2.9
   */
  private async logStateTransition(
    oldPO: PurchaseOrder,
    newPO: PurchaseOrder,
    context: TransitionContext,
    oldValues: PurchaseOrder
  ): Promise<void> {
    try {
      const auditEntry: NewPOAuditLog = {
        id: `audit_${generateId()}`,
        tenantId: context.tenantId,
        poId: oldPO.id,
        action: this.getAuditActionForTransition(newPO.status as POStatusType),
        oldValues: JSON.stringify({
          status: oldValues.status,
          poNumber: oldValues.poNumber,
          approvedBy: oldValues.approvedBy,
          approvedAt: oldValues.approvedAt,
          receivedBy: oldValues.receivedBy,
          receivedAt: oldValues.receivedAt,
        }),
        newValues: JSON.stringify({
          status: newPO.status,
          poNumber: newPO.poNumber,
          approvedBy: newPO.approvedBy,
          approvedAt: newPO.approvedAt,
          receivedBy: newPO.receivedBy,
          receivedAt: newPO.receivedAt,
        }),
        performedBy: context.userId,
        performedAt: getCurrentTimestamp(),
        notes: context.reason || null,
      };

      await this.db
        .insert(poAuditLog)
        .values(auditEntry);

    } catch (error) {
      // Audit logging failures should not break the main flow
      console.error('Failed to log state transition:', {
        poId: oldPO.id,
        transition: `${oldPO.status} -> ${newPO.status}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Map status transitions to audit actions
   */
  private getAuditActionForTransition(newStatus: POStatusType): string {
    switch (newStatus) {
      case 'APPROVED':
        return 'APPROVED';
      case 'RECEIVED':
        return 'RECEIVED';
      case 'CANCELLED':
        return 'CANCELLED';
      default:
        return 'STATUS_CHANGED';
    }
  }
}

/**
 * Factory function to create POStateMachine instance
 */
export function createPOStateMachine(db: DrizzleD1Database): POStateMachine {
  const poNumberGenerator = createPONumberGenerator(db);
  return new POStateMachineImpl(db, poNumberGenerator);
}