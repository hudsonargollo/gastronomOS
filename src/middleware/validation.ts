import { Context, Next } from 'hono';
import { z } from 'zod';

/**
 * Middleware to validate request body against a Zod schema
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json();
      const validatedData = schema.parse(body);
      c.set('validatedBody', validatedData);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: 'Validation failed',
          details: error.errors
        }, 400);
      }
      return c.json({
        success: false,
        error: 'Invalid request body'
      }, 400);
    }
  };
}

/**
 * Helper function to get validated body from context
 */
export function getValidatedBody<T>(c: Context): T {
  return c.get('validatedBody') as T;
}

/**
 * Middleware to validate query parameters against a Zod schema
 */
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return async (c: Context, next: Next) => {
    try {
      const query = c.req.query();
      const validatedData = schema.parse(query);
      c.set('validatedQuery', validatedData);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: 'Query validation failed',
          details: error.errors
        }, 400);
      }
      return c.json({
        success: false,
        error: 'Invalid query parameters'
      }, 400);
    }
  };
}

/**
 * Helper function to get validated query from context
 */
export function getValidatedQuery<T>(c: Context): T {
  return c.get('validatedQuery') as T;
}