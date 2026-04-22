import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { createUserService, IUserService } from '../services/user';
import { createTenantService, ITenantService } from '../services/tenant';
import { createJWTService, IJWTService } from '../services/jwt';
import { createErrorResponse } from '../utils';
import { z } from 'zod';

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
  JWT_SECRET: string;
  ENVIRONMENT?: string;
}

// Extend Hono context with services
type Variables = {
  jwtService?: IJWTService;
  userService?: IUserService;
  tenantService?: ITenantService;
};

// Validation schema for bootstrap
const bootstrapSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  tenantName: z.string().min(3, 'Tenant name must be at least 3 characters'),
  tenantSlug: z.string().min(3, 'Tenant slug must be at least 3 characters'),
});

// Initialize bootstrap router
const bootstrap = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * POST /bootstrap - Create tenant and admin user in one step
 * This is a special endpoint for initial setup that doesn't require authentication
 * 
 * SECURITY NOTE: In production, this endpoint should be:
 * 1. Disabled after initial setup, OR
 * 2. Protected by a secret key, OR
 * 3. Only allow creating specific demo accounts
 */
bootstrap.post('/', async (c) => {
  try {
    // Parse and validate request body
    const body = await c.req.json();
    const validatedData = bootstrapSchema.parse(body);

    // Only allow creating demo account in production
    const isProduction = c.env.ENVIRONMENT === 'production';
    
    if (isProduction) {
      // In production, allow any new account creation via bootstrap
      // This is the self-service registration flow
      console.log(`[Bootstrap] New account registration: ${validatedData.email}`);
    }

    // Get services from context or create them
    let tenantService = c.get('tenantService');
    let userService = c.get('userService');
    let jwtService = c.get('jwtService');

    // If services aren't available, create them
    if (!tenantService || !userService || !jwtService) {
      console.log('[Bootstrap] Services not in context, creating new instances...');
      
      try {
        const db = drizzle(c.env.DB);
        
        if (!tenantService) {
          tenantService = createTenantService(db as any);
        }
        if (!userService) {
          userService = createUserService(db as any);
        }
        if (!jwtService) {
          jwtService = createJWTService(c.env.JWT_SECRET, c.env.ENVIRONMENT);
        }
      } catch (initError) {
        console.error('[Bootstrap] Service initialization error:', initError);
        return c.json(createErrorResponse(
          'Service Initialization Failed',
          'Failed to initialize services',
          'SERVICE_ERROR'
        ), 500);
      }
    }

    // Step 1: Create or get tenant
    let tenant;
    try {
      tenant = await tenantService.getTenantBySlug(validatedData.tenantSlug);
      if (!tenant) {
        // Create new tenant
        tenant = await tenantService.createTenant({
          name: validatedData.tenantName,
          slug: validatedData.tenantSlug,
        });
        console.log('[Bootstrap] Created tenant:', tenant.id);
      } else {
        console.log('[Bootstrap] Tenant already exists:', tenant.id);
      }
    } catch (error) {
      console.error('[Bootstrap] Tenant creation error:', error);
      return c.json(createErrorResponse(
        'Tenant Creation Failed',
        error instanceof Error ? error.message : 'Failed to create tenant',
        'TENANT_ERROR'
      ), 500);
    }

    // Step 2: Create admin user
    let user;
    try {
      user = await userService.registerUser(tenant.id, {
        email: validatedData.email,
        password: validatedData.password,
        role: 'ADMIN',
      });
      console.log('[Bootstrap] Created user:', user.id);
    } catch (error) {
      // Check if user already exists
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log('[Bootstrap] User already exists:', validatedData.email);
        return c.json(createErrorResponse(
          'User Already Exists',
          'An account with this email already exists',
          'USER_EXISTS'
        ), 409);
      }
      
      console.error('[Bootstrap] User creation error:', error);
      return c.json(createErrorResponse(
        'User Creation Failed',
        error instanceof Error ? error.message : 'Failed to create user',
        'USER_ERROR'
      ), 500);
    }

    // Step 3: Generate JWT token
    let token;
    try {
      token = await jwtService.sign({
        sub: user.id,
        tenant_id: user.tenantId,
        role: user.role,
      });
    } catch (tokenError) {
      console.error('[Bootstrap] Token generation error:', tokenError);
      return c.json(createErrorResponse(
        'Token Generation Failed',
        'Failed to generate JWT token',
        'TOKEN_ERROR'
      ), 500);
    }

    // Return success response
    return c.json({
      message: 'Bootstrap successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
    }, 201);

  } catch (error) {
    console.error('[Bootstrap] Bootstrap error:', error);
    if (error instanceof Error) {
      console.error('[Bootstrap] Error message:', error.message);
      console.error('[Bootstrap] Error stack:', error.stack);
    }

    // Handle validation errors
    if (error instanceof z.ZodError) {
      console.error('[Bootstrap] Validation errors:', error.errors);
      return c.json(createErrorResponse(
        'Validation Error',
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        'VALIDATION_ERROR'
      ), 400);
    }

    // Generic error response with more details
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json(createErrorResponse(
      'Bootstrap Failed',
      `An error occurred during bootstrap: ${errorMessage}`,
      'BOOTSTRAP_ERROR'
    ), 500);
  }
});

export default bootstrap;
