/**
 * Allocation Status Management Service
 * 
 * Manages allocation status transitions, propagation from PO changes, and status-based operation controls.
 * Implements requirements 4.1, 4.2, 4.3, 8.1, 8.4 for the allocation system.
 */

import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, inArray } from 'drizzle-orm';
import { 
  allocations,
  allocationAuditLog,
  poItems,
  purchaseOrders,
  AllocationStatus,
  POStatus
} from '../db/schema';
import { generateId } from '../utils';

// Type definitions for status management
export interface StatusTransition {
  allocationId: string;
  fromStatus: AllocationStatusType;
  toStatus: AllocationStatusType;
  triggeredBy: string;
  triggeredAt: number;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface StatusTransitionResult {
  success: boolean;
  allocationId: string;
  fromStatus: AllocationStatusType;
  toStatus: AllocationStatusType;
  errors: string[];
  warnings: string[];
}

export interface BulkStatusTransitionResult {
  success: boolean;
  successfulTransitions: StatusTransitionResult[];
  failedTransitions: StatusTransitionResult[];
  summary: {
    totalProcessed: number;
    successCount: number;
    failureCount: number;
  };
}

export interface StatusPropagationResult {
  poId: string;
  affectedAllocations: string[];
  statusChanges: Array<{
    allocationId: string;
    fromStatus: AllocationStatusType;
    toStatus: AllocationStatusType;
  }>;
  errors: string[];
}

export interface AllocationStatusValidation {
  valid: boolean;
  currentStatus: AllocationStatusType;
  allowedTransitions: AllocationStatusType[];
  blockedOperations: string[];
  errors: string[];
}

export interface StatusBasedOperationControl {
  operation: AllocationOperation;
  allowed: boolean;
  reason: string;
  requiredStatus?: AllocationStatusType[];
  blockedStatus?: AllocationStatusType[];
}

export type AllocationStatusType = 'PENDING' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED';
export type AllocationOperation = 'UPDATE_QUANTITY' | 'DELETE' | 'MODIFY' | 'SHIP' | 'RECEIVE' | 'CANCEL';

// Status management service interface
export interface IAllocationStatusManager {
  transitionStatus(
    allocationId: string, 
    toStatus: AllocationStatusType, 
    triggeredBy: string, 
    reason?: string
  ): Promise<StatusTransitionResult>;
  
  bulkTransitionStatus(
    allocationIds: string[], 
    toStatus: AllocationStatusType, 
    triggeredBy: string, 
    reason?: string
  ): Promise<BulkStatusTransitionResult>;
  
  propagateStatusFromPO(
    poId: string, 
    poStatus: string, 
    triggeredBy: string
  ): Promise<StatusPropagationResult>;
  
  validateStatusTransition(
    allocationId: string, 
    toStatus: AllocationStatusType
  ): Promise<AllocationStatusValidation>;
  
  checkOperationPermissions(
    allocationId: string, 
    operation: AllocationOperation
  ): Promise<StatusBasedOperationControl>;
  
  getValidTransitions(currentStatus: AllocationStatusType): AllocationStatusType[];
  
  getStatusHistory(allocationId: string): Promise<StatusTransition[]>;
}

export class AllocationStatusManager implements IAllocationStatusManager {
  constructor(private db: DrizzleD1Database) {}

  // Define the status state machine
  private readonly statusTransitions: Record<AllocationStatusType, AllocationStatusType[]> = {
    'PENDING': ['SHIPPED', 'CANCELLED'],
    'SHIPPED': ['RECEIVED', 'CANCELLED'],
    'RECEIVED': [], // Terminal state
    'CANCELLED': [] // Terminal state
  };

  // Define operations allowed for each status
  private readonly statusOperations: Record<AllocationStatusType, AllocationOperation[]> = {
    'PENDING': ['UPDATE_QUANTITY', 'DELETE', 'MODIFY', 'SHIP', 'CANCEL'],
    'SHIPPED': ['RECEIVE', 'CANCEL'],
    'RECEIVED': [], // No modifications allowed
    'CANCELLED': [] // No modifications allowed
  };

  /**
   * Transition allocation status with validation and audit logging
   * Requirements: 4.1, 4.2, 4.4
   */
  async transitionStatus(
    allocationId: string, 
    toStatus: AllocationStatusType, 
    triggeredBy: string, 
    reason?: string
  ): Promise<StatusTransitionResult> {
    try {
      // Get current allocation
      const allocationResult = await this.db
        .select()
        .from(allocations)
        .where(eq(allocations.id, allocationId))
        .limit(1);

      if (allocationResult.length === 0) {
        return {
          success: false,
          allocationId,
          fromStatus: 'PENDING',
          toStatus,
          errors: ['Allocation not found'],
          warnings: []
        };
      }

      const allocation = allocationResult[0];
      const fromStatus = allocation.status as AllocationStatusType;

      // Validate transition
      const validation = await this.validateStatusTransition(allocationId, toStatus);
      if (!validation.valid) {
        return {
          success: false,
          allocationId,
          fromStatus,
          toStatus,
          errors: validation.errors,
          warnings: []
        };
      }

      // Perform the status transition
      const now = Date.now();
      await this.db
        .update(allocations)
        .set({
          status: toStatus,
          updatedAt: now
        })
        .where(eq(allocations.id, allocationId));

      // Log the transition in audit trail (pass allocation to avoid extra query)
      await this.logStatusTransition({
        allocationId,
        fromStatus,
        toStatus,
        triggeredBy,
        triggeredAt: now,
        reason
      }, allocation);

      return {
        success: true,
        allocationId,
        fromStatus,
        toStatus,
        errors: [],
        warnings: []
      };

    } catch (error) {
      return {
        success: false,
        allocationId,
        fromStatus: 'PENDING',
        toStatus,
        errors: [`Failed to transition status: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: []
      };
    }
  }

  /**
   * Bulk transition multiple allocations
   * Requirements: 4.1, 4.2
   */
  async bulkTransitionStatus(
    allocationIds: string[], 
    toStatus: AllocationStatusType, 
    triggeredBy: string, 
    reason?: string
  ): Promise<BulkStatusTransitionResult> {
    const successfulTransitions: StatusTransitionResult[] = [];
    const failedTransitions: StatusTransitionResult[] = [];

    for (const allocationId of allocationIds) {
      const result = await this.transitionStatus(allocationId, toStatus, triggeredBy, reason);
      
      if (result.success) {
        successfulTransitions.push(result);
      } else {
        failedTransitions.push(result);
      }
    }

    return {
      success: failedTransitions.length === 0,
      successfulTransitions,
      failedTransitions,
      summary: {
        totalProcessed: allocationIds.length,
        successCount: successfulTransitions.length,
        failureCount: failedTransitions.length
      }
    };
  }

  /**
   * Propagate status changes from PO to related allocations
   * Requirements: 4.2, 8.1, 8.4
   */
  async propagateStatusFromPO(
    poId: string, 
    poStatus: string, 
    triggeredBy: string
  ): Promise<StatusPropagationResult> {
    try {
      // Get all allocations for this PO
      const allocationsResult = await this.db
        .select({
          id: allocations.id,
          status: allocations.status,
          poItemId: allocations.poItemId
        })
        .from(allocations)
        .leftJoin(poItems, eq(allocations.poItemId, poItems.id))
        .where(eq(poItems.poId, poId));

      const statusChanges: Array<{
        allocationId: string;
        fromStatus: AllocationStatusType;
        toStatus: AllocationStatusType;
      }> = [];
      const errors: string[] = [];
      const affectedAllocations: string[] = [];

      // Determine target allocation status based on PO status
      let targetAllocationStatus: AllocationStatusType | null = null;
      let reason = '';

      switch (poStatus) {
        case POStatus.APPROVED:
          // PO approval doesn't change allocation status (they remain PENDING)
          reason = 'PO approved - allocations remain pending';
          break;
        case POStatus.RECEIVED:
          targetAllocationStatus = 'SHIPPED';
          reason = 'PO marked as received - allocations shipped';
          break;
        case POStatus.CANCELLED:
          targetAllocationStatus = 'CANCELLED';
          reason = 'PO cancelled - allocations cancelled';
          break;
        default:
          // No status propagation needed
          break;
      }

      // Apply status changes if needed
      if (targetAllocationStatus) {
        for (const allocation of allocationsResult) {
          const currentStatus = allocation.status as AllocationStatusType;
          
          // Only transition if the current status allows it
          const allowedTransitions = this.getValidTransitions(currentStatus);
          if (allowedTransitions.includes(targetAllocationStatus)) {
            const transitionResult = await this.transitionStatus(
              allocation.id,
              targetAllocationStatus,
              triggeredBy,
              reason
            );

            if (transitionResult.success) {
              statusChanges.push({
                allocationId: allocation.id,
                fromStatus: currentStatus,
                toStatus: targetAllocationStatus
              });
              affectedAllocations.push(allocation.id);
            } else {
              errors.push(`Failed to transition allocation ${allocation.id}: ${transitionResult.errors.join(', ')}`);
            }
          }
        }
      }

      return {
        poId,
        affectedAllocations,
        statusChanges,
        errors
      };

    } catch (error) {
      return {
        poId,
        affectedAllocations: [],
        statusChanges: [],
        errors: [`Failed to propagate status: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Validate if a status transition is allowed
   * Requirements: 4.1, 4.3
   */
  async validateStatusTransition(
    allocationId: string, 
    toStatus: AllocationStatusType
  ): Promise<AllocationStatusValidation> {
    try {
      // Get current allocation
      const allocationResult = await this.db
        .select()
        .from(allocations)
        .where(eq(allocations.id, allocationId))
        .limit(1);

      if (allocationResult.length === 0) {
        return {
          valid: false,
          currentStatus: 'PENDING',
          allowedTransitions: [],
          blockedOperations: [],
          errors: ['Allocation not found']
        };
      }

      const allocation = allocationResult[0];
      const currentStatus = allocation.status as AllocationStatusType;
      const allowedTransitions = this.getValidTransitions(currentStatus);
      const errors: string[] = [];

      // Check if transition is allowed
      if (!allowedTransitions.includes(toStatus)) {
        errors.push(`Invalid transition from ${currentStatus} to ${toStatus}. Allowed transitions: ${allowedTransitions.join(', ')}`);
      }

      // Additional business rule validations
      if (toStatus === 'RECEIVED' && currentStatus !== 'SHIPPED') {
        errors.push('Allocations can only be received after being shipped');
      }

      if (toStatus === 'SHIPPED' && allocation.quantityAllocated <= 0) {
        errors.push('Cannot ship allocation with zero or negative quantity');
      }

      const blockedOperations = this.getBlockedOperations(toStatus);

      return {
        valid: errors.length === 0,
        currentStatus,
        allowedTransitions,
        blockedOperations,
        errors
      };

    } catch (error) {
      return {
        valid: false,
        currentStatus: 'PENDING',
        allowedTransitions: [],
        blockedOperations: [],
        errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Check if an operation is allowed based on allocation status
   * Requirements: 2.4, 6.1, 6.4
   */
  async checkOperationPermissions(
    allocationId: string, 
    operation: AllocationOperation
  ): Promise<StatusBasedOperationControl> {
    try {
      // Get current allocation
      const allocationResult = await this.db
        .select()
        .from(allocations)
        .where(eq(allocations.id, allocationId))
        .limit(1);

      if (allocationResult.length === 0) {
        return {
          operation,
          allowed: false,
          reason: 'Allocation not found'
        };
      }

      const allocation = allocationResult[0];
      const currentStatus = allocation.status as AllocationStatusType;
      const allowedOperations = this.statusOperations[currentStatus] || [];

      const allowed = allowedOperations.includes(operation);
      let reason = '';

      if (allowed) {
        reason = `Operation ${operation} is allowed for status ${currentStatus}`;
      } else {
        reason = `Operation ${operation} is not allowed for status ${currentStatus}. Allowed operations: ${allowedOperations.join(', ')}`;
      }

      // Determine required/blocked statuses for this operation
      const requiredStatus = this.getRequiredStatusForOperation(operation);
      const blockedStatus = this.getBlockedStatusForOperation(operation);

      return {
        operation,
        allowed,
        reason,
        requiredStatus,
        blockedStatus
      };

    } catch (error) {
      return {
        operation,
        allowed: false,
        reason: `Permission check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get valid transitions for a given status
   * Requirements: 4.1
   */
  getValidTransitions(currentStatus: AllocationStatusType): AllocationStatusType[] {
    return this.statusTransitions[currentStatus] || [];
  }

  /**
   * Get status history for an allocation
   * Requirements: 4.4, 6.5
   */
  async getStatusHistory(allocationId: string): Promise<StatusTransition[]> {
    try {
      const auditResult = await this.db
        .select()
        .from(allocationAuditLog)
        .where(and(
          eq(allocationAuditLog.allocationId, allocationId),
          eq(allocationAuditLog.action, 'STATUS_CHANGED')
        ))
        .orderBy(allocationAuditLog.performedAt);

      return auditResult.map(audit => ({
        allocationId,
        fromStatus: audit.oldValues ? JSON.parse(audit.oldValues).status : 'PENDING',
        toStatus: audit.newValues ? JSON.parse(audit.newValues).status : 'PENDING',
        triggeredBy: audit.performedBy,
        triggeredAt: audit.performedAt,
        reason: audit.notes || undefined,
        metadata: audit.newValues ? JSON.parse(audit.newValues) : undefined
      }));

    } catch (error) {
      console.error('Failed to get status history:', error);
      return [];
    }
  }

  // Private helper methods

  private async logStatusTransition(transition: StatusTransition, allocation?: any): Promise<void> {
    try {
      const auditId = generateId();

      // Use provided allocation or query for it
      let allocationData = allocation;
      if (!allocationData) {
        const allocationResult = await this.db
          .select()
          .from(allocations)
          .where(eq(allocations.id, transition.allocationId))
          .limit(1);

        if (allocationResult.length === 0) {
          console.warn(`Allocation ${transition.allocationId} not found for audit logging`);
          return;
        }
        allocationData = allocationResult[0];
      }

      await this.db
        .insert(allocationAuditLog)
        .values({
          id: auditId,
          tenantId: allocationData.tenantId,
          allocationId: transition.allocationId,
          action: 'STATUS_CHANGED',
          oldValues: JSON.stringify({ status: transition.fromStatus }),
          newValues: JSON.stringify({ 
            status: transition.toStatus,
            reason: transition.reason,
            metadata: transition.metadata
          }),
          performedBy: transition.triggeredBy,
          performedAt: transition.triggeredAt,
          notes: transition.reason
        });

    } catch (error) {
      console.error('Failed to log status transition:', error);
      // Don't throw - audit logging failure shouldn't break the main operation
    }
  }

  private getBlockedOperations(status: AllocationStatusType): string[] {
    const allOperations: AllocationOperation[] = ['UPDATE_QUANTITY', 'DELETE', 'MODIFY', 'SHIP', 'RECEIVE', 'CANCEL'];
    const allowedOperations = this.statusOperations[status] || [];
    return allOperations.filter(op => !allowedOperations.includes(op));
  }

  private getRequiredStatusForOperation(operation: AllocationOperation): AllocationStatusType[] | undefined {
    switch (operation) {
      case 'UPDATE_QUANTITY':
      case 'DELETE':
      case 'MODIFY':
        return ['PENDING'];
      case 'SHIP':
        return ['PENDING'];
      case 'RECEIVE':
        return ['SHIPPED'];
      case 'CANCEL':
        return ['PENDING', 'SHIPPED'];
      default:
        return undefined;
    }
  }

  private getBlockedStatusForOperation(operation: AllocationOperation): AllocationStatusType[] | undefined {
    switch (operation) {
      case 'UPDATE_QUANTITY':
      case 'DELETE':
      case 'MODIFY':
        return ['SHIPPED', 'RECEIVED', 'CANCELLED'];
      case 'SHIP':
        return ['SHIPPED', 'RECEIVED', 'CANCELLED'];
      case 'RECEIVE':
        return ['PENDING', 'RECEIVED', 'CANCELLED'];
      default:
        return undefined;
    }
  }
}

/**
 * Factory function to create AllocationStatusManager instance
 */
export function createAllocationStatusManager(db: DrizzleD1Database): IAllocationStatusManager {
  return new AllocationStatusManager(db);
}