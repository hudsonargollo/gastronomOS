import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, sql } from 'drizzle-orm';
import { 
  transfers,
  locations,
  users,
  products,
  inventoryReservations,
  Transfer,
  TransferStatus,
  TransferPriority
} from '../db/schema';

// Core validation interfaces as defined in the design document
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields?: string[];
}

export interface AvailabilityResult {
  available: boolean;
  currentQuantity: number;
  availableQuantity: number; // Excluding reserved/in-transit
  reservedQuantity: number;
  inTransitQuantity: number;
}

export interface AccessResult {
  hasAccess: boolean;
  requiredRole?: string;
  requiredPermissions?: string[];
  locationRestrictions?: string[];
}

export interface ConstraintResult {
  valid: boolean;
  violations: ConstraintViolation[];
  businessRuleFailures: BusinessRuleFailure[];
}

export interface ConstraintViolation {
  field: string;
  value: any;
  constraint: string;
  message: string;
}

export interface BusinessRuleFailure {
  rule: string;
  message: string;
  context?: Record<string, any>;
}

export enum TransferOperation {
  CREATE = 'CREATE',
  APPROVE = 'APPROVE',
  SHIP = 'SHIP',
  RECEIVE = 'RECEIVE',
  CANCEL = 'CANCEL'
}

export interface CreateTransferRequest {
  productId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  quantityRequested: number;
  priority: string;
  requestedBy: string;
  notes?: string;
  reasonCode?: string;
}

// TransferValidator class implementation
export class TransferValidator {
  constructor(
    private db: DrizzleD1Database
  ) {}

  /**
   * Validates a transfer request according to requirements 1.1, 1.4, 1.5
   */
  async validateTransferRequest(request: CreateTransferRequest): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const requiredFields: string[] = [];

    // Validate required fields
    if (!request.productId) {
      requiredFields.push('productId');
      errors.push('Product ID is required');
    }
    if (!request.sourceLocationId) {
      requiredFields.push('sourceLocationId');
      errors.push('Source location ID is required');
    }
    if (!request.destinationLocationId) {
      requiredFields.push('destinationLocationId');
      errors.push('Destination location ID is required');
    }
    if (!request.quantityRequested || request.quantityRequested <= 0) {
      requiredFields.push('quantityRequested');
      errors.push('Quantity requested must be greater than 0');
    }
    if (!request.requestedBy) {
      requiredFields.push('requestedBy');
      errors.push('Requested by user ID is required');
    }
    if (!request.priority || !Object.values(TransferPriority).includes(request.priority as any)) {
      requiredFields.push('priority');
      errors.push('Valid priority is required (NORMAL, HIGH, EMERGENCY)');
    }

    // Early return if required fields are missing
    if (requiredFields.length > 0) {
      return {
        valid: false,
        errors,
        warnings,
        requiredFields
      };
    }

    // Requirement 1.3: Prevent self-transfers
    if (request.sourceLocationId === request.destinationLocationId) {
      errors.push('Source and destination locations cannot be the same');
    }

    // Validate that product exists
    const product = await this.db
      .select()
      .from(products)
      .where(eq(products.id, request.productId))
      .get();

    if (!product) {
      errors.push('Product not found');
    }

    // Validate that locations exist
    const [sourceLocation, destinationLocation] = await Promise.all([
      this.db
        .select()
        .from(locations)
        .where(eq(locations.id, request.sourceLocationId))
        .get(),
      this.db
        .select()
        .from(locations)
        .where(eq(locations.id, request.destinationLocationId))
        .get()
    ]);

    if (!sourceLocation) {
      errors.push('Source location not found');
    }
    if (!destinationLocation) {
      errors.push('Destination location not found');
    }

    // Validate that user exists
    const user = await this.db
      .select()
      .from(users)
      .where(eq(users.id, request.requestedBy))
      .get();

    if (!user) {
      errors.push('Requesting user not found');
    }

    // Requirement 1.1: Validate inventory availability at source location
    if (product && sourceLocation) {
      const availabilityResult = await this.validateInventoryAvailability(
        request.productId,
        request.sourceLocationId,
        request.quantityRequested
      );

      if (!availabilityResult.available) {
        errors.push(
          `Insufficient inventory at source location. Available: ${availabilityResult.availableQuantity}, Requested: ${request.quantityRequested}`
        );
      }

      if (availabilityResult.availableQuantity < request.quantityRequested * 1.1) {
        warnings.push('Requested quantity is close to available inventory limit');
      }
    }

    // Requirement 1.4: Validate user has access to destination location
    if (user && destinationLocation) {
      const accessResult = await this.validateLocationAccess(
        request.requestedBy,
        request.destinationLocationId,
        TransferOperation.CREATE
      );

      if (!accessResult.hasAccess) {
        errors.push('User does not have access to the destination location');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      ...(requiredFields.length > 0 && { requiredFields })
    };
  }

  /**
   * Validates inventory availability for transfer requests
   */
  async validateInventoryAvailability(
    productId: string,
    locationId: string,
    quantity: number
  ): Promise<AvailabilityResult> {
    // For now, we'll implement a basic check
    // In a real system, this would integrate with the inventory management system
    
    // Get current reservations for this product at this location
    const reservations = await this.db
      .select()
      .from(inventoryReservations)
      .where(
        and(
          eq(inventoryReservations.productId, productId),
          eq(inventoryReservations.locationId, locationId),
          sql`${inventoryReservations.releasedAt} IS NULL`
        )
      )
      .all();

    const reservedQuantity = reservations.reduce((sum, res) => sum + res.quantityReserved, 0);

    // Get in-transit quantities (shipped but not received)
    const inTransitTransfers = await this.db
      .select()
      .from(transfers)
      .where(
        and(
          eq(transfers.productId, productId),
          eq(transfers.destinationLocationId, locationId),
          eq(transfers.status, TransferStatus.SHIPPED)
        )
      )
      .all();

    const inTransitQuantity = inTransitTransfers.reduce((sum, transfer) => sum + (transfer.quantityShipped || 0), 0);

    // For this implementation, we'll assume a base inventory of 1000 units
    // In a real system, this would come from the inventory management system
    const currentQuantity = 1000;
    const availableQuantity = Math.max(0, currentQuantity - reservedQuantity);

    return {
      available: availableQuantity >= quantity,
      currentQuantity,
      availableQuantity,
      reservedQuantity,
      inTransitQuantity
    };
  }

  /**
   * Validates user access to locations for transfer operations
   */
  async validateLocationAccess(
    userId: string,
    locationId: string,
    operation: TransferOperation
  ): Promise<AccessResult> {
    const user = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!user) {
      return {
        hasAccess: false,
        requiredPermissions: ['valid_user']
      };
    }

    const location = await this.db
      .select()
      .from(locations)
      .where(eq(locations.id, locationId))
      .get();

    if (!location) {
      return {
        hasAccess: false,
        requiredPermissions: ['valid_location']
      };
    }

    // Check tenant access
    if (user.tenantId !== location.tenantId) {
      return {
        hasAccess: false,
        locationRestrictions: ['same_tenant_required']
      };
    }

    // Role-based access control
    const hasAccess = this.checkRoleAccess(user.role, operation);
    
    // Location-specific access (users can access their assigned location or if they're admin/manager)
    const hasLocationAccess = user.role === 'ADMIN' || 
                             user.role === 'MANAGER' || 
                             user.locationId === locationId;

    return {
      hasAccess: hasAccess && hasLocationAccess,
      ...(hasAccess ? {} : { requiredRole: 'MANAGER' }),
      ...(hasLocationAccess ? {} : { locationRestrictions: ['assigned_location_or_manager_role'] })
    };
  }

  /**
   * Validates transfer constraints and business rules
   */
  async validateTransferConstraints(
    transfer: Transfer,
    operation: TransferOperation
  ): Promise<ConstraintResult> {
    const violations: ConstraintViolation[] = [];
    const businessRuleFailures: BusinessRuleFailure[] = [];

    // Validate status-based operations
    const statusConstraints = this.validateStatusConstraints(transfer, operation);
    violations.push(...statusConstraints.violations);
    businessRuleFailures.push(...statusConstraints.businessRuleFailures);

    // Validate quantity constraints
    const quantityConstraints = this.validateQuantityConstraints(transfer, operation);
    violations.push(...quantityConstraints.violations);
    businessRuleFailures.push(...quantityConstraints.businessRuleFailures);

    // Validate timing constraints
    const timingConstraints = this.validateTimingConstraints(transfer, operation);
    violations.push(...timingConstraints.violations);
    businessRuleFailures.push(...timingConstraints.businessRuleFailures);

    // Validate business-specific constraints
    const businessConstraints = await this.validateBusinessConstraints(transfer, operation);
    violations.push(...businessConstraints.violations);
    businessRuleFailures.push(...businessConstraints.businessRuleFailures);

    return {
      valid: violations.length === 0 && businessRuleFailures.length === 0,
      violations,
      businessRuleFailures
    };
  }

  /**
   * Validates comprehensive business rules for transfers
   * Requirements: 1.3, 7.1, 7.3
   */
  async validateBusinessConstraints(
    transfer: Transfer,
    operation: TransferOperation
  ): Promise<ConstraintResult> {
    const violations: ConstraintViolation[] = [];
    const businessRuleFailures: BusinessRuleFailure[] = [];

    // Requirement 1.3: Prevent self-transfers
    if (transfer.sourceLocationId === transfer.destinationLocationId) {
      violations.push({
        field: 'destinationLocationId',
        value: transfer.destinationLocationId,
        constraint: 'no_self_transfer',
        message: 'Source and destination locations cannot be the same'
      });
    }

    // Requirement 7.1: Validate cancellation rules
    if (operation === TransferOperation.CANCEL) {
      const cancellationValidation = await this.validateCancellationRules(transfer);
      violations.push(...cancellationValidation.violations);
      businessRuleFailures.push(...cancellationValidation.businessRuleFailures);
    }

    // Validate emergency transfer rules
    if (transfer.priority === TransferPriority.EMERGENCY) {
      const emergencyValidation = this.validateEmergencyTransferRules(transfer, operation);
      violations.push(...emergencyValidation.violations);
      businessRuleFailures.push(...emergencyValidation.businessRuleFailures);
    }

    // Validate concurrent transfer limits
    const concurrencyValidation = await this.validateConcurrentTransferLimits(transfer);
    violations.push(...concurrencyValidation.violations);
    businessRuleFailures.push(...concurrencyValidation.businessRuleFailures);

    // Validate location operational status
    const locationValidation = await this.validateLocationOperationalStatus(transfer, operation);
    violations.push(...locationValidation.violations);
    businessRuleFailures.push(...locationValidation.businessRuleFailures);

    return {
      valid: violations.length === 0 && businessRuleFailures.length === 0,
      violations,
      businessRuleFailures
    };
  }

  /**
   * Validates transfer cancellation business rules
   * Requirements: 7.1, 7.3
   */
  private async validateCancellationRules(transfer: Transfer): Promise<ConstraintResult> {
    const violations: ConstraintViolation[] = [];
    const businessRuleFailures: BusinessRuleFailure[] = [];

    // Requirement 7.3: Cannot cancel shipped transfers
    if (transfer.status === TransferStatus.SHIPPED) {
      businessRuleFailures.push({
        rule: 'no_cancel_shipped',
        message: 'Cannot cancel transfers that have already been shipped',
        context: {
          transferId: transfer.id,
          status: transfer.status,
          shippedAt: transfer.shippedAt
        }
      });
    }

    // Cannot cancel already received transfers
    if (transfer.status === TransferStatus.RECEIVED) {
      businessRuleFailures.push({
        rule: 'no_cancel_received',
        message: 'Cannot cancel transfers that have already been received',
        context: {
          transferId: transfer.id,
          status: transfer.status,
          receivedAt: transfer.receivedAt
        }
      });
    }

    // Cannot cancel already cancelled transfers
    if (transfer.status === TransferStatus.CANCELLED) {
      businessRuleFailures.push({
        rule: 'no_cancel_cancelled',
        message: 'Transfer is already cancelled',
        context: {
          transferId: transfer.id,
          status: transfer.status,
          cancelledAt: transfer.cancelledAt
        }
      });
    }

    return {
      valid: violations.length === 0 && businessRuleFailures.length === 0,
      violations,
      businessRuleFailures
    };
  }

  /**
   * Validates emergency transfer specific rules
   */
  private validateEmergencyTransferRules(transfer: Transfer, _operation: TransferOperation): ConstraintResult {
    const violations: ConstraintViolation[] = [];
    const businessRuleFailures: BusinessRuleFailure[] = [];

    // Emergency transfers should have higher quantity limits
    if (transfer.quantityRequested > 10000) {
      businessRuleFailures.push({
        rule: 'emergency_quantity_limit',
        message: 'Emergency transfers cannot exceed 10,000 units',
        context: {
          requestedQuantity: transfer.quantityRequested,
          maxEmergencyQuantity: 10000
        }
      });
    }

    // Emergency transfers should have reason codes
    if (!transfer.notes || transfer.notes.trim().length < 10) {
      violations.push({
        field: 'notes',
        value: transfer.notes,
        constraint: 'emergency_reason_required',
        message: 'Emergency transfers must include detailed reason (minimum 10 characters)'
      });
    }

    return {
      valid: violations.length === 0 && businessRuleFailures.length === 0,
      violations,
      businessRuleFailures
    };
  }

  /**
   * Validates concurrent transfer limits to prevent system overload
   */
  private async validateConcurrentTransferLimits(transfer: Transfer): Promise<ConstraintResult> {
    const violations: ConstraintViolation[] = [];
    const businessRuleFailures: BusinessRuleFailure[] = [];

    // Check for too many pending transfers from same source location
    const pendingTransfers = await this.db
      .select()
      .from(transfers)
      .where(
        and(
          eq(transfers.sourceLocationId, transfer.sourceLocationId),
          eq(transfers.productId, transfer.productId),
          sql`${transfers.status} IN ('REQUESTED', 'APPROVED')`
        )
      )
      .all();

    if (pendingTransfers.length >= 5) {
      businessRuleFailures.push({
        rule: 'concurrent_transfer_limit',
        message: 'Too many pending transfers for this product from source location',
        context: {
          sourceLocationId: transfer.sourceLocationId,
          productId: transfer.productId,
          pendingCount: pendingTransfers.length,
          maxConcurrent: 5
        }
      });
    }

    // Check for duplicate active transfers
    const duplicateTransfers = pendingTransfers.filter(t => 
      t.destinationLocationId === transfer.destinationLocationId &&
      t.id !== transfer.id
    );

    if (duplicateTransfers.length > 0) {
      businessRuleFailures.push({
        rule: 'duplicate_transfer_prevention',
        message: 'Active transfer already exists between these locations for this product',
        context: {
          existingTransferIds: duplicateTransfers.map(t => t.id),
          sourceLocationId: transfer.sourceLocationId,
          destinationLocationId: transfer.destinationLocationId,
          productId: transfer.productId
        }
      });
    }

    return {
      valid: violations.length === 0 && businessRuleFailures.length === 0,
      violations,
      businessRuleFailures
    };
  }

  /**
   * Validates that locations are operational for transfers
   */
  private async validateLocationOperationalStatus(
    transfer: Transfer,
    _operation: TransferOperation
  ): Promise<ConstraintResult> {
    const violations: ConstraintViolation[] = [];
    const businessRuleFailures: BusinessRuleFailure[] = [];

    // Get location details
    const [sourceLocation, destinationLocation] = await Promise.all([
      this.db
        .select()
        .from(locations)
        .where(eq(locations.id, transfer.sourceLocationId))
        .get(),
      this.db
        .select()
        .from(locations)
        .where(eq(locations.id, transfer.destinationLocationId))
        .get()
    ]);

    if (!sourceLocation) {
      violations.push({
        field: 'sourceLocationId',
        value: transfer.sourceLocationId,
        constraint: 'location_exists',
        message: 'Source location not found'
      });
    }

    if (!destinationLocation) {
      violations.push({
        field: 'destinationLocationId',
        value: transfer.destinationLocationId,
        constraint: 'location_exists',
        message: 'Destination location not found'
      });
    }

    // Validate location types are compatible
    if (sourceLocation && destinationLocation) {
      const incompatibleTypes = this.checkLocationTypeCompatibility(
        sourceLocation.type,
        destinationLocation.type
      );

      if (incompatibleTypes.length > 0) {
        businessRuleFailures.push({
          rule: 'location_type_compatibility',
          message: 'Transfer not allowed between these location types',
          context: {
            sourceType: sourceLocation.type,
            destinationType: destinationLocation.type,
            incompatibleReasons: incompatibleTypes
          }
        });
      }
    }

    return {
      valid: violations.length === 0 && businessRuleFailures.length === 0,
      violations,
      businessRuleFailures
    };
  }

  /**
   * Checks compatibility between location types for transfers
   */
  private checkLocationTypeCompatibility(sourceType: string, destinationType: string): string[] {
    const incompatibleReasons: string[] = [];

    // Define business rules for location type compatibility
    const compatibilityRules: Record<string, string[]> = {
      'COMMISSARY': ['RESTAURANT', 'POP_UP'], // Commissary can send to restaurants and pop-ups
      'RESTAURANT': ['RESTAURANT', 'POP_UP'], // Restaurants can send to other restaurants and pop-ups
      'POP_UP': ['RESTAURANT'] // Pop-ups can only send back to restaurants
    };

    const allowedDestinations = compatibilityRules[sourceType] || [];
    
    if (!allowedDestinations.includes(destinationType)) {
      incompatibleReasons.push(
        `${sourceType} locations cannot transfer to ${destinationType} locations`
      );
    }

    return incompatibleReasons;
  }

  /**
   * Validates error reporting requirements and formats error responses
   */
  validateErrorReporting(validationResult: ValidationResult): {
    errorCode: string;
    httpStatus: number;
    userMessage: string;
    technicalDetails: any;
  } {
    if (validationResult.valid) {
      return {
        errorCode: 'VALIDATION_SUCCESS',
        httpStatus: 200,
        userMessage: 'Validation passed',
        technicalDetails: null
      };
    }

    // Determine error type and appropriate HTTP status
    const hasRequiredFieldErrors = validationResult.requiredFields && validationResult.requiredFields.length > 0;
    const hasConstraintViolations = validationResult.errors.some(error => 
      error.includes('constraint') || error.includes('violation')
    );
    const hasBusinessRuleFailures = validationResult.errors.some(error =>
      error.includes('business rule') || error.includes('not allowed')
    );

    let errorCode: string;
    let httpStatus: number;
    let userMessage: string;

    if (hasRequiredFieldErrors) {
      errorCode = 'VALIDATION_REQUIRED_FIELDS';
      httpStatus = 400;
      userMessage = 'Required fields are missing or invalid';
    } else if (hasConstraintViolations) {
      errorCode = 'VALIDATION_CONSTRAINT_VIOLATION';
      httpStatus = 422;
      userMessage = 'Request violates system constraints';
    } else if (hasBusinessRuleFailures) {
      errorCode = 'VALIDATION_BUSINESS_RULE_FAILURE';
      httpStatus = 422;
      userMessage = 'Request violates business rules';
    } else {
      errorCode = 'VALIDATION_GENERAL_ERROR';
      httpStatus = 400;
      userMessage = 'Validation failed';
    }

    return {
      errorCode,
      httpStatus,
      userMessage,
      technicalDetails: {
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        requiredFields: validationResult.requiredFields
      }
    };
  }

  private checkRoleAccess(role: string, operation: TransferOperation): boolean {
    switch (operation) {
      case TransferOperation.CREATE:
        return ['ADMIN', 'MANAGER', 'STAFF'].includes(role);
      case TransferOperation.APPROVE:
        return ['ADMIN', 'MANAGER'].includes(role);
      case TransferOperation.SHIP:
        return ['ADMIN', 'MANAGER', 'STAFF'].includes(role);
      case TransferOperation.RECEIVE:
        return ['ADMIN', 'MANAGER', 'STAFF'].includes(role);
      case TransferOperation.CANCEL:
        return ['ADMIN', 'MANAGER'].includes(role);
      default:
        return false;
    }
  }

  private validateStatusConstraints(transfer: Transfer, operation: TransferOperation): ConstraintResult {
    const violations: ConstraintViolation[] = [];
    const businessRuleFailures: BusinessRuleFailure[] = [];

    const validTransitions: Record<string, TransferOperation[]> = {
      [TransferStatus.REQUESTED]: [TransferOperation.APPROVE, TransferOperation.CANCEL],
      [TransferStatus.APPROVED]: [TransferOperation.SHIP, TransferOperation.CANCEL],
      [TransferStatus.SHIPPED]: [TransferOperation.RECEIVE],
      [TransferStatus.RECEIVED]: [],
      [TransferStatus.CANCELLED]: []
    };

    const allowedOperations = validTransitions[transfer.status] || [];
    
    if (!allowedOperations.includes(operation)) {
      businessRuleFailures.push({
        rule: 'status_transition',
        message: `Cannot perform ${operation} on transfer with status ${transfer.status}`,
        context: {
          currentStatus: transfer.status,
          attemptedOperation: operation,
          allowedOperations
        }
      });
    }

    return { valid: businessRuleFailures.length === 0, violations, businessRuleFailures };
  }

  private validateQuantityConstraints(transfer: Transfer, _operation: TransferOperation): ConstraintResult {
    const violations: ConstraintViolation[] = [];
    const businessRuleFailures: BusinessRuleFailure[] = [];

    // Validate positive quantities
    if (transfer.quantityRequested <= 0) {
      violations.push({
        field: 'quantityRequested',
        value: transfer.quantityRequested,
        constraint: 'positive_quantity',
        message: 'Quantity requested must be greater than 0'
      });
    }

    // Validate shipped quantity doesn't exceed requested
    if (transfer.quantityShipped && transfer.quantityShipped > transfer.quantityRequested) {
      violations.push({
        field: 'quantityShipped',
        value: transfer.quantityShipped,
        constraint: 'shipped_not_exceed_requested',
        message: 'Shipped quantity cannot exceed requested quantity'
      });
    }

    // Validate received quantity doesn't exceed shipped
    if (transfer.quantityReceived && transfer.quantityShipped && 
        transfer.quantityReceived > transfer.quantityShipped) {
      violations.push({
        field: 'quantityReceived',
        value: transfer.quantityReceived,
        constraint: 'received_not_exceed_shipped',
        message: 'Received quantity cannot exceed shipped quantity'
      });
    }

    return { valid: violations.length === 0, violations, businessRuleFailures };
  }

  private validateTimingConstraints(transfer: Transfer, _operation: TransferOperation): ConstraintResult {
    const violations: ConstraintViolation[] = [];
    const businessRuleFailures: BusinessRuleFailure[] = [];

    const now = Date.now();

    // Validate approval timing
    if (transfer.approvedAt && transfer.approvedAt > now) {
      violations.push({
        field: 'approvedAt',
        value: transfer.approvedAt,
        constraint: 'approval_not_future',
        message: 'Approval date cannot be in the future'
      });
    }

    // Validate shipping timing
    if (transfer.shippedAt && transfer.shippedAt > now) {
      violations.push({
        field: 'shippedAt',
        value: transfer.shippedAt,
        constraint: 'shipping_not_future',
        message: 'Shipping date cannot be in the future'
      });
    }

    // Validate receiving timing
    if (transfer.receivedAt && transfer.receivedAt > now) {
      violations.push({
        field: 'receivedAt',
        value: transfer.receivedAt,
        constraint: 'receiving_not_future',
        message: 'Receiving date cannot be in the future'
      });
    }

    // Validate logical sequence
    if (transfer.approvedAt && transfer.shippedAt && transfer.shippedAt < transfer.approvedAt) {
      businessRuleFailures.push({
        rule: 'shipping_after_approval',
        message: 'Shipping date must be after approval date',
        context: {
          approvedAt: transfer.approvedAt,
          shippedAt: transfer.shippedAt
        }
      });
    }

    if (transfer.shippedAt && transfer.receivedAt && transfer.receivedAt < transfer.shippedAt) {
      businessRuleFailures.push({
        rule: 'receiving_after_shipping',
        message: 'Receiving date must be after shipping date',
        context: {
          shippedAt: transfer.shippedAt,
          receivedAt: transfer.receivedAt
        }
      });
    }

    return { valid: violations.length === 0 && businessRuleFailures.length === 0, violations, businessRuleFailures };
  }
}

/**
 * Factory function to create TransferValidator instance
 */
export function createTransferValidator(db: DrizzleD1Database): TransferValidator {
  return new TransferValidator(db);
}