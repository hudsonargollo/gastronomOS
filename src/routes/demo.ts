import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { createDemoInitializationService } from '../services/demo-initialization';
import { createErrorResponse, createSuccessResponse } from '../utils';

/**
 * Demo Data Management Routes
 * 
 * Provides endpoints for managing demo data, including reset functionality
 * and status checking. These endpoints are typically used for maintenance
 * and administrative purposes.
 */

const demo = new Hono<{
  Bindings: {
    DB: D1Database;
  };
  Variables: {
    db: DrizzleD1Database;
  };
}>();

/**
 * GET /demo/info
 * 
 * Get information about the demo environment
 * Returns details about demo tenant, users, and sample data
 */
demo.get('/info', async (c) => {
  return c.json({ message: 'Demo info endpoint working' }, 200);
});

/**
 * GET /demo/credentials
 * 
 * Get demo account credentials for UI integration
 * Returns available demo accounts with their credentials
 * 
 * Requirements: 8.2 - Provide demo credentials for login form population
 */
demo.get('/credentials', async (c) => {
  try {
    // Return demo credentials for frontend integration
    const demoAccounts = [
      {
        role: 'admin',
        email: 'demo@gastronomos.com',
        password: 'demo123',
        description: 'Full system access with all permissions'
      },
      {
        role: 'manager',
        email: 'manager@demo-restaurant.com',
        password: 'manager123',
        description: 'Location manager with inventory and purchasing access'
      },
      {
        role: 'staff',
        email: 'staff@demo-restaurant.com',
        password: 'staff123',
        description: 'Basic staff access for inventory viewing'
      }
    ];

    return c.json(createSuccessResponse({
      accounts: demoAccounts,
      defaultAccount: demoAccounts[0], // Admin account as default
      message: 'Demo credentials retrieved successfully'
    }), 200);
    
  } catch (error) {
    console.error('Error retrieving demo credentials:', error);
    return c.json(createErrorResponse(
      'Demo Credentials Error',
      'Unable to retrieve demo credentials',
      'DEMO_CREDENTIALS_ERROR'
    ), 500);
  }
});

// Database connection middleware for database-dependent endpoints
demo.use('/status', async (c, next) => {
  try {
    const db = drizzle(c.env.DB, { schema });
    c.set('db', db as any);
    await next();
  } catch (error) {
    console.error('Database connection error:', error);
    return c.json(createErrorResponse(
      'Database Error',
      'Unable to connect to database',
      'DB_CONNECTION_ERROR'
    ), 500);
  }
});

demo.use('/initialize', async (c, next) => {
  try {
    const db = drizzle(c.env.DB, { schema });
    c.set('db', db as any);
    await next();
  } catch (error) {
    console.error('Database connection error:', error);
    return c.json(createErrorResponse(
      'Database Error',
      'Unable to connect to database',
      'DB_CONNECTION_ERROR'
    ), 500);
  }
});

demo.use('/reset', async (c, next) => {
  try {
    const db = drizzle(c.env.DB, { schema });
    c.set('db', db as any);
    await next();
  } catch (error) {
    console.error('Database connection error:', error);
    return c.json(createErrorResponse(
      'Database Error',
      'Unable to connect to database',
      'DB_CONNECTION_ERROR'
    ), 500);
  }
});

/**
 * GET /demo/status
 * 
 * Check the status of demo data
 * Returns information about whether demo data is seeded and ready
 */
demo.get('/status', async (c) => {
  try {
    const db = c.get('db');
    const demoService = createDemoInitializationService(db);
    
    const isReady = await demoService.isDemoDataReady();
    
    return c.json(createSuccessResponse({
      demoDataReady: isReady,
      message: isReady ? 'Demo data is ready' : 'Demo data not found',
      timestamp: new Date().toISOString()
    }), 200);
    
  } catch (error) {
    console.error('Error checking demo status:', error);
    return c.json(createErrorResponse(
      'Demo Status Check Failed',
      'Unable to check demo data status',
      'DEMO_STATUS_ERROR'
    ), 500);
  }
});

/**
 * POST /demo/initialize
 * 
 * Initialize demo data if it doesn't exist
 * This endpoint is idempotent - it won't recreate data if it already exists
 */
demo.post('/initialize', async (c) => {
  try {
    const db = c.get('db');
    const demoService = createDemoInitializationService(db);
    
    await demoService.initializeDemoData();
    
    return c.json(createSuccessResponse({
      message: 'Demo data initialization completed',
      timestamp: new Date().toISOString()
    }), 200);
    
  } catch (error) {
    console.error('Error initializing demo data:', error);
    return c.json(createErrorResponse(
      'Demo Initialization Failed',
      error.message || 'Unable to initialize demo data',
      'DEMO_INIT_ERROR'
    ), 500);
  }
});

/**
 * POST /demo/reset
 * 
 * Reset demo data to initial state
 * WARNING: This will delete all existing demo data and recreate it
 * 
 * Requirements: 8.5 - Implement demo data reset functionality
 */
demo.post('/reset', async (c) => {
  try {
    const db = c.get('db');
    const demoService = createDemoInitializationService(db);
    
    console.log('Demo data reset requested');
    await demoService.resetDemoData();
    
    return c.json(createSuccessResponse({
      message: 'Demo data reset completed successfully',
      timestamp: new Date().toISOString(),
      warning: 'All previous demo data has been replaced with fresh sample data',
      nextAutoReset: 'Demo data will automatically reset daily at 2 AM UTC'
    }), 200);
    
  } catch (error) {
    console.error('Error resetting demo data:', error);
    return c.json(createErrorResponse(
      'Demo Reset Failed',
      error.message || 'Unable to reset demo data',
      'DEMO_RESET_ERROR'
    ), 500);
  }
});

/**
 * GET /demo/session-config
 * 
 * Get demo session configuration and security restrictions
 * Returns information about demo session expiration and security measures
 * 
 * Requirements: 8.5 - Add demo account security measures
 */
demo.get('/session-config', async (c) => {
  try {
    const db = drizzle(c.env.DB, { schema });
    const { createDemoSessionManager } = await import('../services/demo-session-manager');
    const demoSessionManager = createDemoSessionManager(db as any);
    
    const config = demoSessionManager.getConfig();
    const restrictions = demoSessionManager.getSessionSecurityRestrictions();
    
    return c.json(createSuccessResponse({
      sessionConfig: {
        expirationHours: config.expirationSeconds / 3600,
        resetIntervalHours: config.resetIntervalHours,
        maxConcurrentSessions: config.maxConcurrentSessions,
        autoResetEnabled: config.enableAutoReset
      },
      securityRestrictions: restrictions,
      message: 'Demo session configuration retrieved successfully'
    }), 200);
    
  } catch (error) {
    console.error('Error retrieving demo session config:', error);
    return c.json(createErrorResponse(
      'Config Retrieval Error',
      'Unable to retrieve demo session configuration',
      'DEMO_CONFIG_ERROR'
    ), 500);
  }
});

export default demo;