import { Context, MiddlewareHandler } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { createConstraintSolver, AllocationInput, AllocationContext, AllocationOperation } from '../services/constraint-solver';
import { getAuthContext } from './auth';
import { createErrorResponse } from '../utils';

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
}

/**
 * Constraint validation middleware for allocation operations
 * Requirements: 2.5, 7.4
 * 
 * This middleware provides real-time constraint validation for allocation operations,
 * ensuring that all business rules and mathematical constraints are enforced
 * before operations are executed.
 */

/**
 * Middleware to validate allocation constraints before creation
 * Validates quantity constraints, location access, and business rules
 */
export function validateAllocationConstraints(): MiddlewareHandler {
  return async (c: Context, next) => {
    const authContext = getAuthContext(c);
    const validatedBody = c.get('validatedBody') as any;
    
    if (!validatedBody) {
      return c.json(createErrorResponse(
        'Validation Error',
        'No validated request body found',
        'VALIDATION_ERROR',
        crypto.randomUUID()
      ), 400);
    }

    try {
      const db = drizzle((c.env as Env).DB);
      const constraintSolver = createConstraintSolver(db);

      // Create allocation input from validated body
      const allocationInput: AllocationInput = {
        poItemId: validatedBody.poItemId,
        targetLocationId: validatedBody.targetLocationId,
        quantityAllocated: validatedBody.quantityAllocated,
      };

      // Create constraint context
      const constraintContext: AllocationContext = {
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        userRole: authContext.role,
        userLocationId: authContext.location_id,
      };

      // Validate all constraints
      const constraintResult = await constraintSolver.validateConstraints(allocationInput, constraintContext);

      if (!constraintResult.valid) {
        // Log constraint violations
        await logConstraintViolations(c, constraintResult.violations, 'ALLOCATION_CONSTRAINT_VIOLATION');

        // Format constraint violation response
        const errorResponse = formatConstraintViolationResponse(constraintResult.violations);
        return c.json(errorResponse, 400);
      }

      // Log warnings if any
      if (constraintResult.warnings.length > 0) {
        await logConstraintWarnings(c, constraintResult.warnings, 'ALLOCATION_CONSTRAINT_WARNING');
      }

      // Store constraint result in context for potential use by route handlers
      c.set('constraintResult', constraintResult);

      return await next();
    } catch (error) {
      // Log constraint validation error
      await logConstraintValidationError(c, error, 'CONSTRAINT_VALIDATION_ERROR');
      
      return c.json(createErrorResponse(
        'Constraint Validation Error',
        error instanceof Error ? error.message : 'Unknown constraint validation error',
        'CONSTRAINT_VALIDATION_ERROR',
        crypto.randomUUID()
      ), 500);
    }
  };
}

/**
 * Middleware to validate allocation update constraints
 * Validates constraints for allocation modifications
 */
export function validateAllocationUpdateConstraints(): MiddlewareHandler {
  return async (c: Context, next) => {
    const authContext = getAuthContext(c);
    const validatedBody = c.get('validatedBody') as any;
    const allocationId = c.req.param('id');
    
    if (!validatedBody || !allocationId) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Missing allocation ID or validated request body',
        'VALIDATION_ERROR',
        crypto.randomUUID()
      ), 400);
    }

    try {
      const db = drizzle((c.env as Env).DB);
      const constraintSolver = createConstraintSolver(db);

      // First, check status constraints for UPDATE operation
      const statusResult = await constraintSolver.enforceStatusConstraints(
        allocationId, 
        'UPDATE', 
        authContext.tenant_id
      );

      if (!statusResult.valid) {
        await logConstraintViolations(c, statusResult.violations, 'ALLOCATION_STATUS_CONSTRAINT_VIOLATION');
        const errorResponse = formatConstraintViolationResponse(statusResult.violations);
        return c.json(errorResponse, 400);
      }

      // If quantity is being updated, validate quantity constraints
      if (validatedBody.quantityAllocated !== undefined) {
        // Import required modules
        const { allocations } = await import('../db/schema');
        const { and, eq } = await import('drizzle-orm');
        
        // Get current allocation to create input for validation
        const [currentAllocation] = await db.select()
          .from(allocations)
          .where(and(
            eq(allocations.id, allocationId),
            eq(allocations.tenantId, authContext.tenant_id)
          ))
          .limit(1);

        if (!currentAllocation) {
          return c.json(createErrorResponse(
            'Not Found',
            'Allocation not found',
            'RESOURCE_NOT_FOUND',
            crypto.randomUUID()
          ), 404);
        }

        const allocationInput: AllocationInput = {
          poItemId: currentAllocation.poItemId,
          targetLocationId: currentAllocation.targetLocationId,
          quantityAllocated: validatedBody.quantityAllocated,
        };

        const constraintContext: AllocationContext = {
          tenantId: authContext.tenant_id,
          userId: authContext.user_id,
          userRole: authContext.role,
          userLocationId: authContext.location_id,
          excludeAllocationId: allocationId, // Exclude current allocation from validation
        };

        // Validate quantity constraints
        const quantityResult = await constraintSolver.checkQuantityConstraints(
          allocationInput.poItemId,
          [allocationInput],
          constraintContext
        );

        if (!quantityResult.valid) {
          await logConstraintViolations(c, quantityResult.violations, 'ALLOCATION_QUANTITY_CONSTRAINT_VIOLATION');
          const errorResponse = formatConstraintViolationResponse(quantityResult.violations);
          return c.json(errorResponse, 400);
        }
      }

      return await next();
    } catch (error) {
      await logConstraintValidationError(c, error, 'CONSTRAINT_UPDATE_VALIDATION_ERROR');
      
      return c.json(createErrorResponse(
        'Constraint Validation Error',
        error instanceof Error ? error.message : 'Unknown constraint validation error',
        'CONSTRAINT_VALIDATION_ERROR',
        crypto.randomUUID()
      ), 500);
    }
  };
}

/**
 * Middleware to validate allocation deletion constraints
 * Validates constraints for allocation deletions
 */
export function validateAllocationDeleteConstraints(): MiddlewareHandler {
  return async (c: Context, next) => {
    const authContext = getAuthContext(c);
    const allocationId = c.req.param('id');
    
    if (!allocationId) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Allocation ID is required',
        'VALIDATION_ERROR',
        crypto.randomUUID()
      ), 400);
    }

    try {
      const db = drizzle((c.env as Env).DB);
      const constraintSolver = createConstraintSolver(db);

      // Check status constraints for DELETE operation
      const statusResult = await constraintSolver.enforceStatusConstraints(
        allocationId, 
        'DELETE', 
        authContext.tenant_id
      );

      if (!statusResult.valid) {
        await logConstraintViolations(c, statusResult.violations, 'ALLOCATION_DELETE_CONSTRAINT_VIOLATION');
        const errorResponse = formatConstraintViolationResponse(statusResult.violations);
        return c.json(errorResponse, 400);
      }

      return await next();
    } catch (error) {
      await logConstraintValidationError(c, error, 'CONSTRAINT_DELETE_VALIDATION_ERROR');
      
      return c.json(createErrorResponse(
        'Constraint Validation Error',
        error instanceof Error ? error.message : 'Unknown constraint validation error',
        'CONSTRAINT_VALIDATION_ERROR',
        crypto.randomUUID()
      ), 500);
    }
  };
}

/**
 * Middleware to validate allocation status change constraints
 * Validates constraints for status transitions
 */
export function validateAllocationStatusConstraints(): MiddlewareHandler {
  return async (c: Context, next) => {
    const authContext = getAuthContext(c);
    const allocationId = c.req.param('id');
    
    if (!allocationId) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Allocation ID is required',
        'VALIDATION_ERROR',
        crypto.randomUUID()
      ), 400);
    }

    try {
      const db = drizzle((c.env as Env).DB);
      const constraintSolver = createConstraintSolver(db);

      // Check status constraints for STATUS_CHANGE operation
      const statusResult = await constraintSolver.enforceStatusConstraints(
        allocationId, 
        'STATUS_CHANGE', 
        authContext.tenant_id
      );

      if (!statusResult.valid) {
        await logConstraintViolations(c, statusResult.violations, 'ALLOCATION_STATUS_CHANGE_CONSTRAINT_VIOLATION');
        const errorResponse = formatConstraintViolationResponse(statusResult.violations);
        return c.json(errorResponse, 400);
      }

      return await next();
    } catch (error) {
      await logConstraintValidationError(c, error, 'CONSTRAINT_STATUS_VALIDATION_ERROR');
      
      return c.json(createErrorResponse(
        'Constraint Validation Error',
        error instanceof Error ? error.message : 'Unknown constraint validation error',
        'CONSTRAINT_VALIDATION_ERROR',
        crypto.randomUUID()
      ), 500);
    }
  };
}

/**
 * Format constraint violations into a structured error response
 * Requirements: 2.5, 7.4
 */
function formatConstraintViolationResponse(violations: any[]): any {
  const requestId = crypto.randomUUID();
  
  // Group violations by type for better error reporting
  const violationsByType = violations.reduce((acc, violation) => {
    if (!acc[violation.type]) {
      acc[violation.type] = [];
    }
    acc[violation.type].push(violation);
    return acc;
  }, {} as Record<string, any[]>);

  // Create detailed error response
  const errorDetails: any = {
    violations: violationsByType,
    summary: {
      totalViolations: violations.length,
      violationTypes: Object.keys(violationsByType),
    }
  };

  // Add specific details for quantity violations
  if (violationsByType.QUANTITY_EXCEEDED) {
    const quantityViolation = violationsByType.QUANTITY_EXCEEDED[0];
    errorDetails.quantityDetails = {
      requestedQuantity: quantityViolation.currentValue,
      maxAllowedQuantity: quantityViolation.allowedValue,
      overAllocation: quantityViolation.currentValue - quantityViolation.allowedValue
    };
  }

  // Add specific details for location access violations
  if (violationsByType.LOCATION_ACCESS) {
    const accessViolation = violationsByType.LOCATION_ACCESS[0];
    errorDetails.accessDetails = {
      requestedLocation: accessViolation.currentValue,
      allowedLocations: accessViolation.allowedValue
    };
  }

  // Add specific details for status violations
  if (violationsByType.STATUS_INVALID) {
    const statusViolation = violationsByType.STATUS_INVALID[0];
    errorDetails.statusDetails = {
      currentStatus: statusViolation.currentValue,
      allowedOperations: statusViolation.allowedValue
    };
  }

  return {
    error: 'Constraint Violation',
    message: violations.map(v => v.message).join('; '),
    code: 'CONSTRAINT_VIOLATION',
    details: errorDetails,
    timestamp: new Date().toISOString(),
    request_id: requestId
  };
}

/**
 * Log constraint violations for audit and monitoring
 */
async function logConstraintViolations(c: Context, violations: any[], eventType: string): Promise<void> {
  try {
    const auditService = c.get('auditService');
    const authContext = getAuthContext(c);
    
    if (auditService) {
      await auditService.logSensitiveOperation(eventType, {
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Constraint violations: ${violations.length} violations`,
        ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
        userAgent: c.req.header('User-Agent') || 'unknown',
        details: {
          violations: violations.map(v => ({
            type: v.type,
            message: v.message,
            field: v.field,
            currentValue: v.currentValue,
            allowedValue: v.allowedValue
          }))
        }
      });
    }
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('Failed to log constraint violations:', error);
  }
}

/**
 * Log constraint warnings for monitoring
 */
async function logConstraintWarnings(c: Context, warnings: any[], eventType: string): Promise<void> {
  try {
    const auditService = c.get('auditService');
    const authContext = getAuthContext(c);
    
    if (auditService) {
      await auditService.logSensitiveOperation(eventType, {
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Constraint warnings: ${warnings.length} warnings`,
        ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
        userAgent: c.req.header('User-Agent') || 'unknown',
        details: {
          warnings: warnings.map(w => ({
            type: w.type,
            message: w.message,
            field: w.field
          }))
        }
      });
    }
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('Failed to log constraint warnings:', error);
  }
}

/**
 * Log constraint validation errors for debugging
 */
async function logConstraintValidationError(c: Context, error: unknown, eventType: string): Promise<void> {
  try {
    const auditService = c.get('auditService');
    const authContext = getAuthContext(c);
    
    if (auditService) {
      await auditService.logSensitiveOperation(eventType, {
        tenantId: authContext.tenant_id,
        userId: authContext.user_id,
        resource: `Constraint validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
        userAgent: c.req.header('User-Agent') || 'unknown',
        details: {
          error: error instanceof Error ? {
            message: error.message,
            stack: error.stack
          } : { error: String(error) }
        }
      });
    }
  } catch (auditError) {
    // Don't fail the request if audit logging fails
    console.error('Failed to log constraint validation error:', auditError);
  }
}

/**
 * Helper function to get constraint result from context
 */
export function getConstraintResult(c: Context): any {
  return c.get('constraintResult');
}