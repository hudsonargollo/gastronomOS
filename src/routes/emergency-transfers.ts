import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';
import { 
  authenticate, 
  injectTenantContext,
  getAuthContext
} from '../middleware/auth';
import { validateBody, validateQuery, getValidatedBody, getValidatedQuery } from '../middleware/error';
import { 
  createEmergencyTransferService,
  EmergencyTransferConfig
} from '../services/emergency-transfer';
import { createTransferService } from '../services/transfer';

// Validation schemas for emergency transfer operations
const emergencyConfigSchema = z.object({
  autoApprovalEnabled: z.boolean().optional(),
  autoApprovalThresholds: z.object({
    maxQuantity: z.number().int().positive().optional(),
    maxValuePerUnit: z.number().positive().optional(),
    allowedSourceLocations: z.array(z.string()).optional(),
    allowedDestinationLocations: z.array(z.string()).optional(),
    allowedProducts: z.array(z.string()).optional(),
    requiresJustification: z.boolean().optional(),
  }).optional(),
  expeditedApprovalTimeoutMinutes: z.number().int().positive().optional(),
  emergencyNotificationRecipients: z.array(z.string()).optional(),
  frequencyLimits: z.object({
    maxEmergencyTransfersPerDay: z.number().int().positive().optional(),
    maxEmergencyTransfersPerWeek: z.number().int().positive().optional(),
    cooldownPeriodHours: z.number().positive().optional(),
  }).optional(),
  escalationRules: z.object({
    escalateAfterMinutes: z.number().int().positive().optional(),
    escalationRecipients: z.array(z.string()).optional(),
    maxEscalationLevels: z.number().int().positive().optional(),
  }).optional(),
  priorityQueue: z.object({
    enabled: z.boolean().optional(),
    maxQueueSize: z.number().int().positive().optional(),
    processingIntervalMinutes: z.number().int().positive().optional(),
  }).optional(),
});

const emergencyApprovalSchema = z.object({
  notes: z.string().optional(),
  expedited: z.boolean().default(true),
});

const emergencyAnalyticsFiltersSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  locationId: z.string().optional(),
  limit: z.number().int().positive().max(1000).default(100).optional(),
  offset: z.number().int().min(0).default(0).optional(),
});

const app = new Hono<{
  Bindings: {
    DB: D1Database;
  };
  Variables: {
    tenantId: string;
    userId: string;
    userRole: string;
  };
}>();

// Apply authentication middleware to all routes
app.use('*', authenticate());
app.use('*', injectTenantContext());

/**
 * GET /emergency-transfers/config - Get emergency transfer configuration
 * Requirements: 10.1
 */
app.get('/config', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const emergencyService = createEmergencyTransferService(db);
    const { tenant_id } = getAuthContext(c);
    
    const config = await emergencyService.getEmergencyConfig(tenant_id);

    return c.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error getting emergency transfer config:', error);
    return c.json({
      success: false,
      error: 'Failed to get emergency transfer configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * PUT /emergency-transfers/config - Update emergency transfer configuration
 * Requirements: 10.1
 */
app.put('/config', validateBody(emergencyConfigSchema), async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const emergencyService = createEmergencyTransferService(db);
    const { tenant_id, user_role } = getAuthContext(c);
    
    // Only admins can update emergency configuration
    if (user_role !== 'ADMIN') {
      return c.json({
        success: false,
        error: 'Insufficient permissions',
        message: 'Only administrators can update emergency transfer configuration'
      }, 403);
    }
    
    const configUpdates = getValidatedBody(c) as Partial<EmergencyTransferConfig>;
    
    const updatedConfig = await emergencyService.updateEmergencyConfig(tenant_id, configUpdates);

    return c.json({
      success: true,
      data: updatedConfig,
      message: 'Emergency transfer configuration updated successfully'
    });
  } catch (error) {
    console.error('Error updating emergency transfer config:', error);
    return c.json({
      success: false,
      error: 'Failed to update emergency transfer configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * POST /emergency-transfers/:id/approve - Expedited approval for emergency transfers
 * Requirements: 10.1, 10.2
 */
app.post('/:id/approve', validateBody(emergencyApprovalSchema), async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const emergencyService = createEmergencyTransferService(db);
    const transferService = createTransferService(db);
    const { tenant_id, user_id } = getAuthContext(c);
    
    const transferId = c.req.param('id');
    const { notes } = getValidatedBody(c) as { notes?: string; expedited: boolean };
    
    // Get the transfer to verify it's an emergency transfer
    const transfer = await transferService.getTransfer(transferId, tenant_id);
    if (!transfer) {
      return c.json({
        success: false,
        error: 'Transfer not found',
        message: 'The requested transfer does not exist or you do not have access to it'
      }, 404);
    }

    if (transfer.priority !== 'EMERGENCY') {
      return c.json({
        success: false,
        error: 'Not an emergency transfer',
        message: 'This endpoint is only for emergency transfers'
      }, 400);
    }

    // Handle emergency-specific approval
    const approvedTransfer = await emergencyService.handleEmergencyApproval(transfer, user_id);

    return c.json({
      success: true,
      data: approvedTransfer,
      message: 'Emergency transfer approved with expedited processing'
    });
  } catch (error) {
    console.error('Error approving emergency transfer:', error);
    return c.json({
      success: false,
      error: 'Failed to approve emergency transfer',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /emergency-transfers/analytics - Get emergency transfer analytics
 * Requirements: 10.4, 10.5
 */
app.get('/analytics', validateQuery(emergencyAnalyticsFiltersSchema), async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const emergencyService = createEmergencyTransferService(db);
    const { tenant_id } = getAuthContext(c);
    
    const filters = getValidatedQuery(c) as any;
    
    const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
    const dateTo = filters.dateTo ? new Date(filters.dateTo) : undefined;
    
    const analytics = await emergencyService.getEmergencyTransferAnalytics(tenant_id, dateFrom, dateTo);

    return c.json({
      success: true,
      data: analytics,
      count: analytics.length,
      filters: {
        dateFrom,
        dateTo,
        locationId: filters.locationId
      }
    });
  } catch (error) {
    console.error('Error getting emergency transfer analytics:', error);
    return c.json({
      success: false,
      error: 'Failed to get emergency transfer analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /emergency-transfers/frequency - Get emergency transfer frequency metrics
 * Requirements: 10.4, 10.5
 */
app.get('/frequency', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const emergencyService = createEmergencyTransferService(db);
    const { tenant_id } = getAuthContext(c);
    
    const locationId = c.req.query('locationId');
    
    const frequency = await emergencyService.getEmergencyFrequency(tenant_id, locationId);

    return c.json({
      success: true,
      data: frequency,
      locationId: locationId || 'all'
    });
  } catch (error) {
    console.error('Error getting emergency transfer frequency:', error);
    return c.json({
      success: false,
      error: 'Failed to get emergency transfer frequency',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /emergency-transfers/can-create - Check if emergency transfer can be created
 * Requirements: 10.4, 10.5
 */
app.get('/can-create', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const emergencyService = createEmergencyTransferService(db);
    const { tenant_id } = getAuthContext(c);
    
    const sourceLocationId = c.req.query('sourceLocationId');
    const destinationLocationId = c.req.query('destinationLocationId');
    
    if (!sourceLocationId || !destinationLocationId) {
      return c.json({
        success: false,
        error: 'Missing required parameters',
        message: 'sourceLocationId and destinationLocationId are required'
      }, 400);
    }
    
    const canCreate = await emergencyService.canCreateEmergencyTransfer(
      tenant_id,
      sourceLocationId,
      destinationLocationId
    );

    return c.json({
      success: true,
      data: canCreate
    });
  } catch (error) {
    console.error('Error checking emergency transfer eligibility:', error);
    return c.json({
      success: false,
      error: 'Failed to check emergency transfer eligibility',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * POST /emergency-transfers/:id/process - Manually trigger emergency processing
 * Requirements: 10.1, 10.2, 10.3
 */
app.post('/:id/process', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const emergencyService = createEmergencyTransferService(db);
    const transferService = createTransferService(db);
    const { tenant_id, user_role } = getAuthContext(c);
    
    // Only admins can manually trigger emergency processing
    if (user_role !== 'ADMIN') {
      return c.json({
        success: false,
        error: 'Insufficient permissions',
        message: 'Only administrators can manually trigger emergency processing'
      }, 403);
    }
    
    const transferId = c.req.param('id');
    
    // Get the transfer
    const transfer = await transferService.getTransfer(transferId, tenant_id);
    if (!transfer) {
      return c.json({
        success: false,
        error: 'Transfer not found',
        message: 'The requested transfer does not exist or you do not have access to it'
      }, 404);
    }

    if (transfer.priority !== 'EMERGENCY') {
      return c.json({
        success: false,
        error: 'Not an emergency transfer',
        message: 'This endpoint is only for emergency transfers'
      }, 400);
    }

    // Process emergency transfer
    const result = await emergencyService.processEmergencyTransfer(transfer);

    return c.json({
      success: true,
      data: {
        transferId: transfer.id,
        ...result
      },
      message: 'Emergency transfer processing completed'
    });
  } catch (error) {
    console.error('Error processing emergency transfer:', error);
    return c.json({
      success: false,
      error: 'Failed to process emergency transfer',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /emergency-transfers/queue-status - Get emergency transfer queue status
 * Requirements: 10.4, 10.5
 */
app.get('/queue-status', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const emergencyService = createEmergencyTransferService(db);
    const { tenant_id } = getAuthContext(c);
    
    const queueStatus = await emergencyService.getEmergencyQueueStatus(tenant_id);

    return c.json({
      success: true,
      data: queueStatus
    });
  } catch (error) {
    console.error('Error getting emergency queue status:', error);
    return c.json({
      success: false,
      error: 'Failed to get emergency queue status',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * POST /emergency-transfers/:id/escalate - Manually escalate emergency transfer
 * Requirements: 10.1, 10.2
 */
app.post('/:id/escalate', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const emergencyService = createEmergencyTransferService(db);
    const transferService = createTransferService(db);
    const { tenant_id, user_role } = getAuthContext(c);
    
    // Only managers and admins can escalate
    if (user_role !== 'ADMIN' && user_role !== 'MANAGER') {
      return c.json({
        success: false,
        error: 'Insufficient permissions',
        message: 'Only managers and administrators can escalate emergency transfers'
      }, 403);
    }
    
    const transferId = c.req.param('id');
    const level = parseInt(c.req.query('level') || '1');
    
    // Get the transfer to verify it's an emergency transfer
    const transfer = await transferService.getTransfer(transferId, tenant_id);
    if (!transfer) {
      return c.json({
        success: false,
        error: 'Transfer not found',
        message: 'The requested transfer does not exist or you do not have access to it'
      }, 404);
    }

    if (transfer.priority !== 'EMERGENCY') {
      return c.json({
        success: false,
        error: 'Not an emergency transfer',
        message: 'This endpoint is only for emergency transfers'
      }, 400);
    }

    // Escalate the emergency transfer
    await emergencyService.escalateEmergencyTransfer(transfer, level);

    return c.json({
      success: true,
      message: `Emergency transfer escalated to level ${level}`,
      data: {
        transferId: transfer.id,
        escalationLevel: level
      }
    });
  } catch (error) {
    console.error('Error escalating emergency transfer:', error);
    return c.json({
      success: false,
      error: 'Failed to escalate emergency transfer',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * POST /emergency-transfers/:id/validate - Validate emergency transfer rules
 * Requirements: 10.1, 10.2
 */
app.post('/:id/validate', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const emergencyService = createEmergencyTransferService(db);
    const transferService = createTransferService(db);
    const { tenant_id } = getAuthContext(c);
    
    const transferId = c.req.param('id');
    
    // Get the transfer
    const transfer = await transferService.getTransfer(transferId, tenant_id);
    if (!transfer) {
      return c.json({
        success: false,
        error: 'Transfer not found',
        message: 'The requested transfer does not exist or you do not have access to it'
      }, 404);
    }

    if (transfer.priority !== 'EMERGENCY') {
      return c.json({
        success: false,
        error: 'Not an emergency transfer',
        message: 'This endpoint is only for emergency transfers'
      }, 400);
    }

    // Get emergency configuration and validate
    const config = await emergencyService.getEmergencyConfig(tenant_id);
    await emergencyService.validateEmergencyTransferRules(transfer, config);

    return c.json({
      success: true,
      message: 'Emergency transfer validation passed',
      data: {
        transferId: transfer.id,
        validationPassed: true
      }
    });
  } catch (error) {
    console.error('Error validating emergency transfer:', error);
    return c.json({
      success: false,
      error: 'Emergency transfer validation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      data: {
        validationPassed: false
      }
    }, 400);
  }
});

/**
 * GET /emergency-transfers/monitoring/frequency - Get emergency frequency tracking
 * Requirements: 10.4, 10.5
 */
app.get('/monitoring/frequency', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const emergencyService = createEmergencyTransferService(db);
    const { tenant_id } = getAuthContext(c);
    
    const locationId = c.req.query('locationId');
    
    const frequencyMetrics = await emergencyService.trackEmergencyFrequency(tenant_id, locationId);

    return c.json({
      success: true,
      data: frequencyMetrics
    });
  } catch (error) {
    console.error('Error getting emergency frequency tracking:', error);
    return c.json({
      success: false,
      error: 'Failed to get emergency frequency tracking',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /emergency-transfers/monitoring/trends - Get emergency frequency trends
 * Requirements: 10.4, 10.5
 */
app.get('/monitoring/trends', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const emergencyService = createEmergencyTransferService(db);
    const { tenant_id } = getAuthContext(c);
    
    const periodDays = parseInt(c.req.query('periodDays') || '30');
    
    const trends = await emergencyService.getFrequencyTrends(tenant_id, periodDays);

    return c.json({
      success: true,
      data: trends,
      period: {
        days: periodDays,
        from: new Date(Date.now() - (periodDays * 24 * 60 * 60 * 1000)),
        to: new Date()
      }
    });
  } catch (error) {
    console.error('Error getting emergency frequency trends:', error);
    return c.json({
      success: false,
      error: 'Failed to get emergency frequency trends',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /emergency-transfers/monitoring/reasons - Get emergency reason analysis
 * Requirements: 10.4, 10.5
 */
app.get('/monitoring/reasons', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const emergencyService = createEmergencyTransferService(db);
    const { tenant_id } = getAuthContext(c);
    
    const dateFrom = c.req.query('dateFrom') ? new Date(c.req.query('dateFrom')!) : undefined;
    const dateTo = c.req.query('dateTo') ? new Date(c.req.query('dateTo')!) : undefined;
    
    const reasonAnalysis = await emergencyService.analyzeEmergencyReasons(tenant_id, dateFrom, dateTo);

    return c.json({
      success: true,
      data: reasonAnalysis,
      period: {
        from: dateFrom || new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)),
        to: dateTo || new Date()
      }
    });
  } catch (error) {
    console.error('Error getting emergency reason analysis:', error);
    return c.json({
      success: false,
      error: 'Failed to get emergency reason analysis',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /emergency-transfers/monitoring/reason-trends - Get emergency reason trends
 * Requirements: 10.4, 10.5
 */
app.get('/monitoring/reason-trends', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const emergencyService = createEmergencyTransferService(db);
    const { tenant_id } = getAuthContext(c);
    
    const periodDays = parseInt(c.req.query('periodDays') || '30');
    
    const reasonTrends = await emergencyService.getReasonTrends(tenant_id, periodDays);

    return c.json({
      success: true,
      data: reasonTrends,
      period: {
        days: periodDays,
        from: new Date(Date.now() - (periodDays * 24 * 60 * 60 * 1000)),
        to: new Date()
      }
    });
  } catch (error) {
    console.error('Error getting emergency reason trends:', error);
    return c.json({
      success: false,
      error: 'Failed to get emergency reason trends',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /emergency-transfers/monitoring/alerts - Get emergency alerts
 * Requirements: 10.4, 10.5
 */
app.get('/monitoring/alerts', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const emergencyService = createEmergencyTransferService(db);
    const { tenant_id } = getAuthContext(c);
    
    const alerts = await emergencyService.getEmergencyAlerts(tenant_id);

    return c.json({
      success: true,
      data: alerts,
      count: alerts.length,
      summary: {
        critical: alerts.filter(a => a.severity === 'CRITICAL').length,
        high: alerts.filter(a => a.severity === 'HIGH').length,
        medium: alerts.filter(a => a.severity === 'MEDIUM').length,
        low: alerts.filter(a => a.severity === 'LOW').length
      }
    });
  } catch (error) {
    console.error('Error getting emergency alerts:', error);
    return c.json({
      success: false,
      error: 'Failed to get emergency alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /emergency-transfers/monitoring/performance - Get emergency performance metrics
 * Requirements: 10.4, 10.5
 */
app.get('/monitoring/performance', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const emergencyService = createEmergencyTransferService(db);
    const { tenant_id } = getAuthContext(c);
    
    const dateFrom = c.req.query('dateFrom') ? new Date(c.req.query('dateFrom')!) : undefined;
    const dateTo = c.req.query('dateTo') ? new Date(c.req.query('dateTo')!) : undefined;
    
    const performanceMetrics = await emergencyService.getEmergencyPerformanceMetrics(tenant_id, dateFrom, dateTo);

    return c.json({
      success: true,
      data: performanceMetrics,
      period: {
        from: dateFrom || new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)),
        to: dateTo || new Date()
      }
    });
  } catch (error) {
    console.error('Error getting emergency performance metrics:', error);
    return c.json({
      success: false,
      error: 'Failed to get emergency performance metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * POST /emergency-transfers/monitoring/report - Generate emergency transfer report
 * Requirements: 10.4, 10.5
 */
app.post('/monitoring/report', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const emergencyService = createEmergencyTransferService(db);
    const { tenant_id } = getAuthContext(c);
    
    const body = await c.req.json();
    const options = {
      dateFrom: body.dateFrom ? new Date(body.dateFrom) : undefined,
      dateTo: body.dateTo ? new Date(body.dateTo) : undefined,
      locationIds: body.locationIds,
      includeReasonAnalysis: body.includeReasonAnalysis !== false,
      includePerformanceMetrics: body.includePerformanceMetrics !== false,
      includeFrequencyTrends: body.includeFrequencyTrends !== false,
      format: body.format || 'json'
    };
    
    const report = await emergencyService.generateEmergencyTransferReport(tenant_id, options);

    return c.json({
      success: true,
      data: report,
      message: 'Emergency transfer report generated successfully'
    });
  } catch (error) {
    console.error('Error generating emergency transfer report:', error);
    return c.json({
      success: false,
      error: 'Failed to generate emergency transfer report',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

export default app;