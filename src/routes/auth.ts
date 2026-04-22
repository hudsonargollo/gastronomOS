import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { createUserService, IUserService } from '../services/user';
import { createTenantService, ITenantService } from '../services/tenant';
import { createAuditService, IAuditService, extractAuditContext } from '../services/audit';
import { createJWTService, IJWTService } from '../services/jwt';
import { RegisterUserRequest, LoginRequest, LoginResponse, UserRole } from '../types';
import { createErrorResponse } from '../utils';
import { z } from 'zod';
import { createDemoSessionManager, IDemoSessionManager, shouldUseDemoExpiration } from '../services/demo-session-manager';

// Environment bindings interface
interface Env extends Record<string, unknown> {
  DB: D1Database;
  JWT_SECRET: string;
  ENVIRONMENT?: string;
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
    // Ensure JWT service is available (should be set by main app middleware)
    if (!c.get('jwtService')) {
      try {
        const secret = c.env.JWT_SECRET || 'pontal-stock-demo-secret-minimum-32-chars-required';
        const jwtService = createJWTService(secret, c.env.ENVIRONMENT || 'production');
        c.set('jwtService', jwtService);
      } catch (jwtError) {
        console.warn('JWT service initialization failed:', jwtError);
      }
    }
    
    return await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return await next();
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
  let auditService = c.get('auditService');
  
  try {
    // Parse and validate request body
    const body = await c.req.json();
    
    // Handle demo login
    if (body.email === 'demo@pontal-stock.com' && body.password === 'demo123') {
      try {
        const jwtService = c.get('jwtService');
        let demoSessionManager = c.get('demoSessionManager');
        
        // Create demo user response
        const demoUser = {
          id: 'demo-user-id',
          email: 'demo@pontal-stock.com',
          role: 'ADMIN' as UserRole,
          tenantId: 'demo-tenant-id',
          locationId: 'demo-location-id'
        };

        // Generate JWT token for demo user with shorter expiration
        // Requirements: 8.5 - Configure shorter expiration times for demo sessions
        const demoExpiration = demoSessionManager?.getDemoSessionExpiration?.() || 28800;
        const jwtClaims = {
          sub: demoUser.id,
          tenant_id: demoUser.tenantId,
          role: demoUser.role,
          location_id: demoUser.locationId,
        };
        
        let token: string;
        if (jwtService) {
          try {
            token = await jwtService.sign(jwtClaims, demoExpiration);
          } catch (tokenError) {
            console.error('Failed to sign JWT token:', tokenError);
            // Fallback token if JWT signing fails
            token = 'demo-token-' + Date.now();
          }
        } else {
          token = 'demo-token-' + Date.now();
        }

        // Log demo login if audit service is available
        if (auditService) {
          try {
            await auditService.logAuthenticationEvent('LOGIN', {
              ...auditContext,
              tenantId: demoUser.tenantId,
              userId: demoUser.id,
              resource: `Demo user login (session expires in ${demoExpiration / 3600} hours)`
            });
          } catch (auditError) {
            console.warn('Failed to log demo login:', auditError);
            // Continue even if audit logging fails
          }
        }

        const response: LoginResponse = {
          token,
          user: demoUser,
        };

        return c.json(response, 200);
      } catch (demoLoginError) {
        console.error('Demo login error:', demoLoginError);
        // Return error response for demo login
        return c.json(createErrorResponse(
          'Demo Login Failed',
          'An error occurred during demo login',
          'DEMO_LOGIN_ERROR'
        ), 500);
      }
    }
    
    // Validate regular login data
    const validatedData = loginSchema.parse(body);
    
    const userService = c.get('userService');
    const tenantService = c.get('tenantService');
    const jwtService = c.get('jwtService');

    // If services aren't available, return error
    if (!userService || !tenantService || !jwtService) {
      console.error('[Auth] Services unavailable in login:', {
        userService: !!userService,
        tenantService: !!tenantService,
        jwtService: !!jwtService,
      });
      return c.json(createErrorResponse(
        'Service Unavailable',
        'Database services are not available. Please try again later.',
        'SERVICE_UNAVAILABLE'
      ), 503);
    }

    // Find tenant by slug using raw SQL as fallback
    let tenant;
    try {
      tenant = await tenantService.getTenantBySlug(validatedData.tenantSlug);
      
      // If tenant service fails, try raw SQL
      if (!tenant && c.env.DB) {
        console.log('[Auth] Tenant service returned null, trying raw SQL...');
        const rawTenant = await c.env.DB.prepare(
          'SELECT id, name, slug FROM tenants WHERE slug = ?'
        ).bind(validatedData.tenantSlug.toLowerCase()).first() as any;
        
        if (rawTenant) {
          tenant = rawTenant;
          console.log('[Auth] Found tenant via raw SQL:', tenant.id);
        }
      }
    } catch (tenantError) {
      console.error('[Auth] Tenant lookup error:', tenantError instanceof Error ? tenantError.message : tenantError);
      return c.json(createErrorResponse(
        'Authentication Failed',
        'An error occurred during authentication',
        'AUTHENTICATION_ERROR'
      ), 500);
    }
    
    if (!tenant) {
      // Log failed login attempt - tenant not found
      if (auditService) {
        try {
          await auditService.logAuthenticationEvent('LOGIN_FAILED', {
            ...auditContext,
            resource: `Login failed - tenant not found: ${validatedData.tenantSlug}, email: ${validatedData.email}`
          });
        } catch (auditError) {
          console.warn('[Auth] Audit logging failed:', auditError);
        }
      }
      
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
    let user;
    try {
      user = await userService.authenticateUser(tenant.id, credentials);
    } catch (authError) {
      console.error('[Auth] User authentication error:', authError instanceof Error ? authError.message : authError);
      return c.json(createErrorResponse(
        'Authentication Failed',
        'An error occurred during authentication',
        'AUTHENTICATION_ERROR'
      ), 500);
    }
    
    if (!user) {
      // Log failed login attempt - invalid credentials
      if (auditService) {
        try {
          await auditService.logAuthenticationEvent('LOGIN_FAILED', {
            ...auditContext,
            tenantId: tenant.id,
            resource: `Login failed - invalid credentials for email: ${validatedData.email}`
          });
        } catch (auditError) {
          console.warn('[Auth] Audit logging failed:', auditError);
        }
      }
      
      // Return generic error to prevent user enumeration (Requirement 2.4)
      return c.json(createErrorResponse(
        'Authentication Failed',
        'Invalid credentials',
        'INVALID_CREDENTIALS'
      ), 401);
    }

    // Check if this is a demo account and get appropriate expiration
    // Requirements: 8.5 - Configure shorter expiration times for demo sessions
    let demoSessionManager = c.get('demoSessionManager');
    
    const isDemoAccount = demoSessionManager ? await demoSessionManager.isDemoAccount(user.email) : false;
    const isDemoTenant = demoSessionManager ? demoSessionManager.isDemoTenant(user.tenantId) : false;
    const isDemo = isDemoAccount || isDemoTenant;
    
    // Get appropriate expiration time
    const expirationSeconds = isDemo && demoSessionManager ? demoSessionManager.getDemoSessionExpiration() : undefined;

    // Generate JWT token (Requirement 2.3)
    const jwtClaims: any = {
      sub: user.id,
      tenant_id: user.tenantId,
      role: user.role,
    };
    
    if (user.locationId) {
      jwtClaims.location_id = user.locationId;
    }
    
    let token;
    try {
      token = await jwtService.sign(jwtClaims, expirationSeconds);
    } catch (tokenError) {
      console.error('[Auth] JWT token generation error:', tokenError instanceof Error ? tokenError.message : tokenError);
      return c.json(createErrorResponse(
        'Authentication Failed',
        'An error occurred during authentication',
        'AUTHENTICATION_ERROR'
      ), 500);
    }

    // Log successful login
    const sessionType = isDemo ? 'demo session' : 'regular session';
    const expirationInfo = isDemo ? ` (expires in ${expirationSeconds! / 3600} hours)` : '';
    if (auditService) {
      try {
        await auditService.logAuthenticationEvent('LOGIN', {
          ...auditContext,
          tenantId: user.tenantId,
          userId: user.id,
          resource: `Successful login for user: ${user.email} - ${sessionType}${expirationInfo}`
        });
      } catch (auditError) {
        console.warn('[Auth] Audit logging failed:', auditError);
      }
    }

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
          'Use demo@pontal-stock.com / demo123 for demo access',
          'DEMO_LOGIN_INFO'
        ), 400);
      }
      
      // Log validation error
      if (auditService) {
        await auditService.logAuthenticationEvent('LOGIN_FAILED', {
          ...auditContext,
          resource: `Login validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        });
      }
      
      return c.json(createErrorResponse(
        'Validation Error',
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        'VALIDATION_ERROR'
      ), 400);
    }

    // Log generic login error
    if (auditService) {
      await auditService.logAuthenticationEvent('LOGIN_FAILED', {
        ...auditContext,
        resource: `Login failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

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
 * This endpoint requires a valid JWT token
 */
auth.get('/me', async (c) => {
  try {
    // Extract auth context from middleware
    const authContext = c.get('authContext');
    
    // For now, return mock data if no auth context
    // This allows testing without full auth setup
    if (!authContext) {
      return c.json({
        success: true,
        data: {
          id: 'demo-user-id',
          tenantId: 'demo-tenant-id',
          role: 'ADMIN',
          locationId: 'demo-location-id',
        }
      }, 200);
    }

    // Return current user information
    return c.json({
      success: true,
      data: {
        id: authContext.user_id,
        tenantId: authContext.tenant_id,
        role: authContext.role,
        locationId: authContext.location_id,
      }
    }, 200);
  } catch (error) {
    console.error('Get user profile error:', error);
    
    return c.json(createErrorResponse(
      'Profile Fetch Failed',
      'An error occurred while fetching user profile',
      'PROFILE_ERROR'
    ), 500);
  }
});

/**
 * POST /auth/create-admin - Create admin account (internal endpoint)
 * This endpoint creates an admin user for the specified tenant
 */
auth.post('/create-admin', async (c) => {
  const auditContext = extractAuditContext(c);
  const auditService = c.get('auditService');
  
  try {
    // Parse request body
    const body = await c.req.json();
    const { email, password, tenantSlug } = body;

    // Validate required fields
    if (!email || !password || !tenantSlug) {
      return c.json(createErrorResponse(
        'Validation Error',
        'email, password, and tenantSlug are required',
        'VALIDATION_ERROR'
      ), 400);
    }

    // Validate email format
    if (!email.includes('@')) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Invalid email format',
        'VALIDATION_ERROR'
      ), 400);
    }

    // Validate password length
    if (password.length < 8) {
      return c.json(createErrorResponse(
        'Validation Error',
        'Password must be at least 8 characters long',
        'VALIDATION_ERROR'
      ), 400);
    }

    const userService = c.get('userService');
    const tenantService = c.get('tenantService');
    const jwtService = c.get('jwtService');

    // If services aren't initialized, return error
    if (!userService || !tenantService || !jwtService) {
      return c.json(createErrorResponse(
        'Service Unavailable',
        'Database services are not available. Please try again later.',
        'SERVICE_UNAVAILABLE'
      ), 503);
    }

    // Find tenant by slug
    const tenant = await tenantService.getTenantBySlug(tenantSlug);
    if (!tenant) {
      return c.json(createErrorResponse(
        'Tenant Not Found',
        `Tenant with slug '${tenantSlug}' does not exist`,
        'TENANT_NOT_FOUND'
      ), 404);
    }

    // Register admin user
    const registerData: RegisterUserRequest = {
      email,
      password,
      role: 'ADMIN',
    };

    const user = await userService.registerUser(tenant.id, registerData);

    // Log admin user creation
    await auditService.logSensitiveOperation('ADMIN_USER_CREATED', {
      ...auditContext,
      tenantId: tenant.id,
      userId: user.id,
      resource: `Admin user created: ${user.email}`
    });

    // Generate JWT token
    const jwtClaims: any = {
      sub: user.id,
      tenant_id: user.tenantId,
      role: user.role,
    };
    
    if (user.locationId) {
      jwtClaims.location_id = user.locationId;
    }
    
    const token = await jwtService.sign(jwtClaims);

    // Prepare response
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
    console.error('Admin creation error:', error);

    // Handle known business logic errors
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        await auditService.logSensitiveOperation('ADMIN_CREATION_FAILED', {
          ...auditContext,
          resource: `Admin creation failed - email already exists: ${error.message}`
        });
        
        return c.json(createErrorResponse(
          'Admin Creation Failed',
          error.message,
          'EMAIL_ALREADY_EXISTS'
        ), 409);
      }
    }

    // Log generic error
    await auditService.logSensitiveOperation('ADMIN_CREATION_FAILED', {
      ...auditContext,
      resource: `Admin creation failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });

    return c.json(createErrorResponse(
      'Admin Creation Failed',
      'An error occurred while creating admin account',
      'ADMIN_CREATION_ERROR'
    ), 500);
  }
});

export default auth;