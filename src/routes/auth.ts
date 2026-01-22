import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { createUserService, IUserService } from '../services/user';
import { createTenantService, ITenantService } from '../services/tenant';
import { createAuditService, IAuditService, extractAuditContext } from '../services/audit';
import { IJWTService } from '../services/jwt';
import { RegisterUserRequest, LoginRequest, LoginResponse, UserRole } from '../types';
import { createErrorResponse } from '../utils';
import { z } from 'zod';
import { createDemoSessionManager, IDemoSessionManager, shouldUseDemoExpiration } from '../services/demo-session-manager';

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
  JWT_SECRET: string;
}

// Extend Hono context with services
type Variables = {
  jwtService: IJWTService;
  userService: IUserService;
  tenantService: ITenantService;
  auditService: IAuditService;
  demoSessionManager: IDemoSessionManager;
};

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF'], {
    errorMap: () => ({ message: 'Role must be ADMIN, MANAGER, or STAFF' })
  }),
  locationId: z.string().optional(),
  tenantSlug: z.string().min(3, 'Tenant slug must be at least 3 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  tenantSlug: z.string().min(3, 'Tenant slug must be at least 3 characters'),
});

// Initialize auth router
const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

// Service initialization middleware
auth.use('*', async (c, next) => {
  try {
    const db = drizzle(c.env.DB, { schema });
    const userService = createUserService(db as any);
    const tenantService = createTenantService(db as any);
    const auditService = createAuditService(db);
    const demoSessionManager = createDemoSessionManager(db as any);
    
    c.set('userService', userService);
    c.set('tenantService', tenantService);
    c.set('auditService', auditService);
    c.set('demoSessionManager', demoSessionManager);
    
    return await next();
  } catch (error) {
    console.error('Service initialization error:', error);
    return c.json(createErrorResponse(
      'Service Error',
      'Failed to initialize services',
      'SERVICE_INIT_ERROR'
    ), 500);
  }
});

/**
 * POST /auth/register - User registration endpoint
 * Requirements: 2.1, 2.3, 2.4
 */
auth.post('/register', async (c) => {
  const auditContext = extractAuditContext(c);
  const auditService = c.get('auditService');
  
  try {
    // Parse and validate request body
    const body = await c.req.json();
    const validatedData = registerSchema.parse(body);
    
    const userService = c.get('userService');
    const tenantService = c.get('tenantService');
    const jwtService = c.get('jwtService');

    // Find tenant by slug
    const tenant = await tenantService.getTenantBySlug(validatedData.tenantSlug);
    if (!tenant) {
      // Log failed registration attempt
      await auditService.logSensitiveOperation('USER_REGISTRATION_FAILED', {
        ...auditContext,
        resource: `Registration failed - tenant not found: ${validatedData.tenantSlug}`
      });
      
      return c.json(createErrorResponse(
        'Tenant Not Found',
        'The specified organization does not exist',
        'TENANT_NOT_FOUND'
      ), 404);
    }

    // Prepare user registration data
    const registerData: RegisterUserRequest = {
      email: validatedData.email,
      password: validatedData.password,
      role: validatedData.role,
    };
    
    if (validatedData.locationId) {
      registerData.locationId = validatedData.locationId;
    }

    // Register user
    const user = await userService.registerUser(tenant.id, registerData);

    // Log successful user creation
    await auditService.logSensitiveOperation('USER_CREATED', {
      ...auditContext,
      tenantId: tenant.id,
      userId: user.id,
      resource: `User registered: ${user.email} with role: ${user.role}`
    });

    // Generate JWT token (Requirement 2.3)
    const jwtClaims: any = {
      sub: user.id,
      tenant_id: user.tenantId,
      role: user.role,
    };
    
    if (user.locationId) {
      jwtClaims.location_id = user.locationId;
    }
    
    const token = await jwtService.sign(jwtClaims);

    // Log successful authentication after registration
    await auditService.logAuthenticationEvent('LOGIN', {
      ...auditContext,
      tenantId: user.tenantId,
      userId: user.id,
      resource: 'User authenticated after registration'
    });

    // Prepare response (exclude sensitive data)
    const userResponse: any = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };
    
    if (user.locationId) {
      userResponse.locationId = user.locationId;
    }
    
    const response: LoginResponse = {
      token,
      user: userResponse,
    };

    return c.json(response, 201);

  } catch (error) {
    console.error('Registration error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      // Log validation error
      await auditService.logSensitiveOperation('USER_REGISTRATION_FAILED', {
        ...auditContext,
        resource: `Registration validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      });
      
      return c.json(createErrorResponse(
        'Validation Error',
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        'VALIDATION_ERROR'
      ), 400);
    }

    // Handle known business logic errors
    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes('already exists')) {
        // Log duplicate email attempt
        await auditService.logSensitiveOperation('USER_REGISTRATION_FAILED', {
          ...auditContext,
          resource: `Registration failed - email already exists: ${error.message}`
        });
        
        return c.json(createErrorResponse(
          'Registration Failed',
          error.message,
          'EMAIL_ALREADY_EXISTS'
        ), 409);
      }

      if (error.message.includes('Invalid role') || 
          error.message.includes('Invalid email') ||
          error.message.includes('Password must be')) {
        // Log validation error
        await auditService.logSensitiveOperation('USER_REGISTRATION_FAILED', {
          ...auditContext,
          resource: `Registration validation failed: ${error.message}`
        });
        
        return c.json(createErrorResponse(
          'Validation Error',
          error.message,
          'VALIDATION_ERROR'
        ), 400);
      }
    }

    // Log generic registration error
    await auditService.logSensitiveOperation('USER_REGISTRATION_FAILED', {
      ...auditContext,
      resource: `Registration failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    // Generic error response (Requirement 2.4)
    return c.json(createErrorResponse(
      'Registration Failed',
      'An error occurred during user registration',
      'REGISTRATION_ERROR'
    ), 500);
  }
});

/**
 * POST /auth/login - User authentication endpoint
 * Requirements: 2.3, 2.4
 */
auth.post('/login', async (c) => {
  const auditContext = extractAuditContext(c);
  const auditService = c.get('auditService');
  
  try {
    // Parse and validate request body
    const body = await c.req.json();
    
    // Handle demo login
    if (body.email === 'demo@gastronomos.com' && body.password === 'demo123') {
      const jwtService = c.get('jwtService');
      const demoSessionManager = c.get('demoSessionManager');
      
      // Create demo user response
      const demoUser = {
        id: 'demo-user-id',
        email: 'demo@gastronomos.com',
        role: 'ADMIN' as UserRole,
        tenantId: 'demo-tenant-id',
        locationId: 'demo-location-id'
      };

      // Generate JWT token for demo user with shorter expiration
      // Requirements: 8.5 - Configure shorter expiration times for demo sessions
      const demoExpiration = demoSessionManager.getDemoSessionExpiration();
      const jwtClaims = {
        sub: demoUser.id,
        tenant_id: demoUser.tenantId,
        role: demoUser.role,
        location_id: demoUser.locationId,
      };
      
      const token = await jwtService.sign(jwtClaims, demoExpiration);

      // Log demo login
      await auditService.logAuthenticationEvent('LOGIN', {
        ...auditContext,
        tenantId: demoUser.tenantId,
        userId: demoUser.id,
        resource: `Demo user login (session expires in ${demoExpiration / 3600} hours)`
      });

      const response: LoginResponse = {
        token,
        user: demoUser,
      };

      return c.json(response, 200);
    }
    
    // Validate regular login data
    const validatedData = loginSchema.parse(body);
    
    const userService = c.get('userService');
    const tenantService = c.get('tenantService');
    const jwtService = c.get('jwtService');

    // Find tenant by slug
    const tenant = await tenantService.getTenantBySlug(validatedData.tenantSlug);
    if (!tenant) {
      // Log failed login attempt - tenant not found
      await auditService.logAuthenticationEvent('LOGIN_FAILED', {
        ...auditContext,
        resource: `Login failed - tenant not found: ${validatedData.tenantSlug}, email: ${validatedData.email}`
      });
      
      // Return generic error to prevent tenant enumeration
      return c.json(createErrorResponse(
        'Authentication Failed',
        'Invalid credentials',
        'INVALID_CREDENTIALS'
      ), 401);
    }

    // Prepare login credentials
    const credentials: LoginRequest = {
      email: validatedData.email,
      password: validatedData.password,
    };

    // Authenticate user (Requirement 2.3)
    const user = await userService.authenticateUser(tenant.id, credentials);
    
    if (!user) {
      // Log failed login attempt - invalid credentials
      await auditService.logAuthenticationEvent('LOGIN_FAILED', {
        ...auditContext,
        tenantId: tenant.id,
        resource: `Login failed - invalid credentials for email: ${validatedData.email}`
      });
      
      // Return generic error to prevent user enumeration (Requirement 2.4)
      return c.json(createErrorResponse(
        'Authentication Failed',
        'Invalid credentials',
        'INVALID_CREDENTIALS'
      ), 401);
    }

    // Check if this is a demo account and get appropriate expiration
    // Requirements: 8.5 - Configure shorter expiration times for demo sessions
    const demoSessionManager = c.get('demoSessionManager');
    const isDemoAccount = await demoSessionManager.isDemoAccount(user.email);
    const isDemoTenant = demoSessionManager.isDemoTenant(user.tenantId);
    const isDemo = isDemoAccount || isDemoTenant;
    
    // Get appropriate expiration time
    const expirationSeconds = isDemo ? demoSessionManager.getDemoSessionExpiration() : undefined;

    // Generate JWT token (Requirement 2.3)
    const jwtClaims: any = {
      sub: user.id,
      tenant_id: user.tenantId,
      role: user.role,
    };
    
    if (user.locationId) {
      jwtClaims.location_id = user.locationId;
    }
    
    const token = await jwtService.sign(jwtClaims, expirationSeconds);

    // Log successful login
    const sessionType = isDemo ? 'demo session' : 'regular session';
    const expirationInfo = isDemo ? ` (expires in ${expirationSeconds! / 3600} hours)` : '';
    await auditService.logAuthenticationEvent('LOGIN', {
      ...auditContext,
      tenantId: user.tenantId,
      userId: user.id,
      resource: `Successful login for user: ${user.email} - ${sessionType}${expirationInfo}`
    });

    // Prepare response (exclude sensitive data)
    const userResponse: any = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };
    
    if (user.locationId) {
      userResponse.locationId = user.locationId;
    }
    
    const response: LoginResponse = {
      token,
      user: userResponse,
    };

    return c.json(response, 200);

  } catch (error) {
    console.error('Login error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      // For demo login, return a more helpful error
      if (error.errors.some(e => e.path.includes('tenantSlug'))) {
        return c.json(createErrorResponse(
          'Demo Login',
          'Use demo@gastronomos.com / demo123 for demo access',
          'DEMO_LOGIN_INFO'
        ), 400);
      }
      
      // Log validation error
      await auditService.logAuthenticationEvent('LOGIN_FAILED', {
        ...auditContext,
        resource: `Login validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      });
      
      return c.json(createErrorResponse(
        'Validation Error',
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        'VALIDATION_ERROR'
      ), 400);
    }

    // Log generic login error
    await auditService.logAuthenticationEvent('LOGIN_FAILED', {
      ...auditContext,
      resource: `Login failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    // Generic error response (Requirement 2.4)
    return c.json(createErrorResponse(
      'Authentication Failed',
      'An error occurred during authentication',
      'AUTHENTICATION_ERROR'
    ), 500);
  }
});

/**
 * POST /auth/logout - User logout endpoint (optional - JWT is stateless)
 * This endpoint exists for client-side token cleanup and audit logging
 */
auth.post('/logout', async (c) => {
  try {
    // In a stateless JWT system, logout is primarily client-side
    // This endpoint can be used for audit logging if needed
    
    return c.json({
      message: 'Logged out successfully',
      timestamp: new Date().toISOString(),
    }, 200);

  } catch (error) {
    console.error('Logout error:', error);
    
    return c.json(createErrorResponse(
      'Logout Failed',
      'An error occurred during logout',
      'LOGOUT_ERROR'
    ), 500);
  }
});

/**
 * GET /auth/me - Get current user information (requires authentication)
 * This endpoint would typically be protected by auth middleware
 */
auth.get('/me', async (c) => {
  // This endpoint would be implemented after authentication middleware is ready
  // For now, return a placeholder response
  return c.json({
    message: 'This endpoint requires authentication middleware',
    note: 'Will be implemented after auth middleware is complete'
  }, 501);
});

export default auth;