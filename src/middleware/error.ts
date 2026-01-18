import { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createErrorResponse } from '../utils';
import { z } from 'zod';

/**
 * Error handling middleware for consistent error responses
 * Requirements: 2.4, 3.3, 6.3, 7.4
 */
export function errorHandler(): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      await next();
    } catch (error) {
      console.error('Request error:', error);

      // Generate request ID for tracking
      const requestId = crypto.randomUUID();

      // Handle Hono HTTP exceptions
      if (error instanceof HTTPException) {
        return c.json(createErrorResponse(
          error.message,
          error.message,
          `HTTP_${error.status}`,
          requestId
        ), error.status);
      }

      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(e => 
          `${e.path.join('.')}: ${e.message}`
        ).join(', ');

        return c.json(createErrorResponse(
          'Validation Error',
          validationErrors,
          'VALIDATION_ERROR',
          requestId
        ), 400);
      }

      // Handle known application errors
      if (error instanceof Error) {
        // Authentication errors
        if (error.message.includes('JWT') || 
            error.message.includes('token') ||
            error.message.includes('Authentication required')) {
          return c.json(createErrorResponse(
            'Unauthorized',
            error.message,
            'AUTHENTICATION_ERROR',
            requestId
          ), 401);
        }

        // Authorization errors
        if (error.message.includes('Access denied') ||
            error.message.includes('Forbidden') ||
            error.message.includes('permission')) {
          return c.json(createErrorResponse(
            'Forbidden',
            error.message,
            'AUTHORIZATION_ERROR',
            requestId
          ), 403);
        }

        // Not found errors
        if (error.message.includes('not found') ||
            error.message.includes('does not exist')) {
          return c.json(createErrorResponse(
            'Not Found',
            error.message,
            'RESOURCE_NOT_FOUND',
            requestId
          ), 404);
        }

        // Conflict errors (duplicate resources)
        if (error.message.includes('already exists') ||
            error.message.includes('duplicate')) {
          return c.json(createErrorResponse(
            'Conflict',
            error.message,
            'RESOURCE_CONFLICT',
            requestId
          ), 409);
        }

        // Validation errors
        if (error.message.includes('Invalid') ||
            error.message.includes('must be') ||
            error.message.includes('required')) {
          return c.json(createErrorResponse(
            'Bad Request',
            error.message,
            'VALIDATION_ERROR',
            requestId
          ), 400);
        }
      }

      // Generic internal server error
      return c.json(createErrorResponse(
        'Internal Server Error',
        'An unexpected error occurred',
        'INTERNAL_ERROR',
        requestId
      ), 500);
    }
  };
}

/**
 * Custom error classes for specific error types
 */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

/**
 * Helper function to throw authentication errors
 */
export function throwAuthenticationError(message: string): never {
  throw new AuthenticationError(message);
}

/**
 * Helper function to throw authorization errors
 */
export function throwAuthorizationError(message: string): never {
  throw new AuthorizationError(message);
}

/**
 * Helper function to throw validation errors
 */
export function throwValidationError(message: string): never {
  throw new ValidationError(message);
}

/**
 * Helper function to throw not found errors
 */
export function throwNotFoundError(message: string): never {
  throw new NotFoundError(message);
}

/**
 * Helper function to throw conflict errors
 */
export function throwConflictError(message: string): never {
  throw new ConflictError(message);
}

/**
 * Middleware to handle 404 errors for unmatched routes
 */
export function notFoundHandler(): MiddlewareHandler {
  return async (c: Context) => {
    const requestId = crypto.randomUUID();
    
    return c.json(createErrorResponse(
      'Not Found',
      `The requested resource '${c.req.path}' was not found`,
      'ROUTE_NOT_FOUND',
      requestId
    ), 404);
  };
}

/**
 * Validation middleware for request body
 */
export function validateBody<T>(schema: z.ZodSchema<T>): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      const body = await c.req.json();
      const validatedData = schema.parse(body);
      
      // Store validated data in context for use in route handlers
      c.set('validatedBody', validatedData);
      
      return await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(e => 
          `${e.path.join('.')}: ${e.message}`
        ).join(', ');

        const requestId = crypto.randomUUID();
        return c.json(createErrorResponse(
          'Validation Error',
          validationErrors,
          'VALIDATION_ERROR',
          requestId
        ), 400);
      }
      
      throw error; // Re-throw non-validation errors
    }
  };
}

/**
 * Validation middleware for query parameters
 */
export function validateQuery<T>(schema: z.ZodSchema<T>): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      const query = c.req.query();
      const validatedQuery = schema.parse(query);
      
      // Store validated query in context for use in route handlers
      c.set('validatedQuery', validatedQuery);
      
      return await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(e => 
          `${e.path.join('.')}: ${e.message}`
        ).join(', ');

        const requestId = crypto.randomUUID();
        return c.json(createErrorResponse(
          'Validation Error',
          validationErrors,
          'VALIDATION_ERROR',
          requestId
        ), 400);
      }
      
      throw error; // Re-throw non-validation errors
    }
  };
}

/**
 * Helper function to get validated body from context
 */
export function getValidatedBody<T>(c: Context): T {
  const validatedBody = c.get('validatedBody');
  if (!validatedBody) {
    throw new Error('No validated body found in context');
  }
  return validatedBody as T;
}

/**
 * Helper function to get validated query from context
 */
export function getValidatedQuery<T>(c: Context): T {
  const validatedQuery = c.get('validatedQuery');
  if (!validatedQuery) {
    throw new Error('No validated query found in context');
  }
  return validatedQuery as T;
}