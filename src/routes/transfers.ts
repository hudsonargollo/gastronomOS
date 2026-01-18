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
  createTransferService, 
  CreateTransferRequest, 
  UpdateTransferRequest,
  ReceivingData,
  TransferFilters,
  TransferPriorityType,
  TransferStatusType
} from '../services/transfer';
import { createTransferStateMachine, TransitionContext } from '../services/transfer-state-machine';

// Validation schemas
const createTransferSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  sourceLocationId: z.string().min(1, 'Source location ID is required'),
  destinationLocationId: z.string().min(1, 'Destination location ID is required'),
  quantityRequested: z.number().int().positive('Quantity must be a positive integer'),
  priority: z.enum(['NORMAL', 'HIGH', 'EMERGENCY']).default('NORMAL'),
  notes: z.string().optional(),
  reasonCode: z.string().optional(),
});

const updateTransferSchema = z.object({
  quantityRequested: z.number().int().positive().optional(),
  notes: z.string().optional(),
  reasonCode: z.string().optional(),
});

const approveTransferSchema = z.object({
  notes: z.string().optional(),
});

const rejectTransferSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

const shipTransferSchema = z.object({
  shippingNotes: z.string().optional(),
});

const receiveTransferSchema = z.object({
  quantityReceived: z.number().int().min(0, 'Quantity received must be non-negative'),
  varianceReason: z.string().optional(),
  notes: z.string().optional(),
  damageReport: z.string().optional(),
});

const cancelTransferSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
});

const transferFiltersSchema = z.object({
  status: z.enum(['REQUESTED', 'APPROVED', 'SHIPPED', 'RECEIVED', 'CANCELLED']).optional(),
  sourceLocationId: z.string().optional(),
  destinationLocationId: z.string().optional(),
  productId: z.string().optional(),
  priority: z.enum(['NORMAL', 'HIGH', 'EMERGENCY']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
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
 * POST /transfers - Create a new transfer request
 * Requirements: 1.1, 1.2, 4.4
 */
app.post('/', validateBody(createTransferSchema), async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const transferService = createTransferService(db);
    const { tenant_id, user_id } = getAuthContext(c);
    
    const requestData = getValidatedBody(c) as CreateTransferRequest;
    
    const transfer = await transferService.createTransferRequest(
      requestData,
      tenant_id,
      user_id
    );

    return c.json({
      success: true,
      data: transfer,
      message: 'Transfer request created successfully'
    }, 201);
  } catch (error) {
    console.error('Error creating transfer:', error);
    return c.json({
      success: false,
      error: 'Failed to create transfer request',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /transfers - List transfers with filtering
 * Requirements: 4.4
 */
app.get('/', validateQuery(transferFiltersSchema), async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const transferService = createTransferService(db);
    const { tenant_id } = getAuthContext(c);
    
    const filters = getValidatedQuery(c) as any;
    
    // Convert date strings to Date objects
    const transferFilters: TransferFilters = {
      ...filters,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
      dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
    };

    // For now, get all transfers for the tenant
    // TODO: Implement location-based filtering based on user permissions
    const transfers = await transferService.getTransfersByStatus(
      filters.status || 'REQUESTED',
      tenant_id,
      transferFilters
    );

    return c.json({
      success: true,
      data: transfers,
      count: transfers.length,
      filters: transferFilters
    });
  } catch (error) {
    console.error('Error listing transfers:', error);
    return c.json({
      success: false,
      error: 'Failed to list transfers',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /transfers/:id - Get detailed transfer information
 * Requirements: 4.4
 */
app.get('/:id', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const transferService = createTransferService(db);
    const { tenant_id } = getAuthContext(c);
    
    const transferId = c.req.param('id');
    
    const transferDetails = await transferService.getTransferDetails(transferId, tenant_id);
    
    if (!transferDetails) {
      return c.json({
        success: false,
        error: 'Transfer not found',
        message: 'The requested transfer does not exist or you do not have access to it'
      }, 404);
    }

    return c.json({
      success: true,
      data: transferDetails
    });
  } catch (error) {
    console.error('Error getting transfer details:', error);
    return c.json({
      success: false,
      error: 'Failed to get transfer details',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * PUT /transfers/:id - Update a transfer request
 * Requirements: 1.1, 1.2, 4.4
 */
app.put('/:id', validateBody(updateTransferSchema), async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const transferService = createTransferService(db);
    const { tenant_id, user_id } = getAuthContext(c);
    
    const transferId = c.req.param('id');
    const updates = getValidatedBody(c) as UpdateTransferRequest;
    
    const updatedTransfer = await transferService.updateTransfer(
      transferId,
      updates,
      tenant_id,
      user_id
    );

    return c.json({
      success: true,
      data: updatedTransfer,
      message: 'Transfer updated successfully'
    });
  } catch (error) {
    console.error('Error updating transfer:', error);
    return c.json({
      success: false,
      error: 'Failed to update transfer',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * POST /transfers/:id/approve - Approve a transfer request
 * Requirements: 2.3, 2.4
 */
app.post('/:id/approve', validateBody(approveTransferSchema), async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const transferService = createTransferService(db);
    const stateMachine = createTransferStateMachine(db);
    const { tenant_id, user_id } = getAuthContext(c);
    
    const transferId = c.req.param('id');
    const { notes } = getValidatedBody(c) as { notes?: string };
    
    // Get the current transfer
    const currentTransfer = await transferService.getTransfer(transferId, tenant_id);
    if (!currentTransfer) {
      return c.json({
        success: false,
        error: 'Transfer not found',
        message: 'The requested transfer does not exist or you do not have access to it'
      }, 404);
    }

    // Create transition context
    const context: TransitionContext = {
      userId: user_id,
      tenantId: tenant_id,
      reason: notes,
      ipAddress: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for'),
      userAgent: c.req.header('user-agent'),
    };

    // Execute state transition
    const approvedTransfer = await stateMachine.executeTransition(
      currentTransfer,
      'APPROVED',
      context
    );

    return c.json({
      success: true,
      data: approvedTransfer,
      message: 'Transfer approved successfully'
    });
  } catch (error) {
    console.error('Error approving transfer:', error);
    return c.json({
      success: false,
      error: 'Failed to approve transfer',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * POST /transfers/:id/reject - Reject a transfer request
 * Requirements: 2.3, 2.4
 */
app.post('/:id/reject', validateBody(rejectTransferSchema), async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const transferService = createTransferService(db);
    const stateMachine = createTransferStateMachine(db);
    const { tenant_id, user_id } = getAuthContext(c);
    
    const transferId = c.req.param('id');
    const { reason } = getValidatedBody(c) as { reason: string };
    
    // Get the current transfer
    const currentTransfer = await transferService.getTransfer(transferId, tenant_id);
    if (!currentTransfer) {
      return c.json({
        success: false,
        error: 'Transfer not found',
        message: 'The requested transfer does not exist or you do not have access to it'
      }, 404);
    }

    // Create transition context
    const context: TransitionContext = {
      userId: user_id,
      tenantId: tenant_id,
      reason: reason,
      ipAddress: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for'),
      userAgent: c.req.header('user-agent'),
    };

    // Execute state transition (rejection = cancellation)
    const rejectedTransfer = await stateMachine.executeTransition(
      currentTransfer,
      'CANCELLED',
      context
    );

    return c.json({
      success: true,
      data: rejectedTransfer,
      message: 'Transfer rejected successfully'
    });
  } catch (error) {
    console.error('Error rejecting transfer:', error);
    return c.json({
      success: false,
      error: 'Failed to reject transfer',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * POST /transfers/:id/ship - Mark a transfer as shipped
 * Requirements: 4.1, 4.2
 */
app.post('/:id/ship', validateBody(shipTransferSchema), async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const transferService = createTransferService(db);
    const stateMachine = createTransferStateMachine(db);
    const { tenant_id, user_id } = getAuthContext(c);
    
    const transferId = c.req.param('id');
    const { shippingNotes } = getValidatedBody(c) as { shippingNotes?: string };
    
    // Get the current transfer
    const currentTransfer = await transferService.getTransfer(transferId, tenant_id);
    if (!currentTransfer) {
      return c.json({
        success: false,
        error: 'Transfer not found',
        message: 'The requested transfer does not exist or you do not have access to it'
      }, 404);
    }

    // Create transition context
    const context: TransitionContext = {
      userId: user_id,
      tenantId: tenant_id,
      reason: shippingNotes,
      ipAddress: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for'),
      userAgent: c.req.header('user-agent'),
    };

    // Execute state transition
    const shippedTransfer = await stateMachine.executeTransition(
      currentTransfer,
      'SHIPPED',
      context
    );

    return c.json({
      success: true,
      data: shippedTransfer,
      message: 'Transfer shipped successfully'
    });
  } catch (error) {
    console.error('Error shipping transfer:', error);
    return c.json({
      success: false,
      error: 'Failed to ship transfer',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * POST /transfers/:id/receive - Confirm receipt of a transfer
 * Requirements: 5.1, 5.2, 5.3
 */
app.post('/:id/receive', validateBody(receiveTransferSchema), async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const transferService = createTransferService(db);
    const stateMachine = createTransferStateMachine(db);
    const { tenant_id, user_id } = getAuthContext(c);
    
    const transferId = c.req.param('id');
    const receiveData = getValidatedBody(c) as {
      quantityReceived: number;
      varianceReason?: string;
      notes?: string;
      damageReport?: string;
    };
    
    // Get the current transfer
    const currentTransfer = await transferService.getTransfer(transferId, tenant_id);
    if (!currentTransfer) {
      return c.json({
        success: false,
        error: 'Transfer not found',
        message: 'The requested transfer does not exist or you do not have access to it'
      }, 404);
    }

    // Prepare receiving data
    const receivingData: ReceivingData = {
      quantityReceived: receiveData.quantityReceived,
      receivedBy: user_id,
      receivedAt: new Date(),
      ...(receiveData.varianceReason && { varianceReason: receiveData.varianceReason }),
      ...(receiveData.notes && { notes: receiveData.notes }),
      ...(receiveData.damageReport && { damageReport: receiveData.damageReport }),
    };

    // Create transition context
    const context: TransitionContext = {
      userId: user_id,
      tenantId: tenant_id,
      receivingData: receivingData,
      ipAddress: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for'),
      userAgent: c.req.header('user-agent'),
    };

    // Execute state transition
    const receivedTransfer = await stateMachine.executeTransition(
      currentTransfer,
      'RECEIVED',
      context
    );

    return c.json({
      success: true,
      data: receivedTransfer,
      message: 'Transfer received successfully'
    });
  } catch (error) {
    console.error('Error receiving transfer:', error);
    return c.json({
      success: false,
      error: 'Failed to receive transfer',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * POST /transfers/:id/cancel - Cancel a transfer
 * Requirements: 7.1, 7.2, 7.3
 */
app.post('/:id/cancel', validateBody(cancelTransferSchema), async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const transferService = createTransferService(db);
    const stateMachine = createTransferStateMachine(db);
    const { tenant_id, user_id } = getAuthContext(c);
    
    const transferId = c.req.param('id');
    const { reason } = getValidatedBody(c) as { reason: string };
    
    // Get the current transfer
    const currentTransfer = await transferService.getTransfer(transferId, tenant_id);
    if (!currentTransfer) {
      return c.json({
        success: false,
        error: 'Transfer not found',
        message: 'The requested transfer does not exist or you do not have access to it'
      }, 404);
    }

    // Create transition context
    const context: TransitionContext = {
      userId: user_id,
      tenantId: tenant_id,
      reason: reason,
      ipAddress: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for'),
      userAgent: c.req.header('user-agent'),
    };

    // Execute state transition
    const cancelledTransfer = await stateMachine.executeTransition(
      currentTransfer,
      'CANCELLED',
      context
    );

    return c.json({
      success: true,
      data: cancelledTransfer,
      message: 'Transfer cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling transfer:', error);
    return c.json({
      success: false,
      error: 'Failed to cancel transfer',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /transfers/:id/transitions - Get valid transitions for a transfer
 * Requirements: 2.4, 2.5
 */
app.get('/:id/transitions', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const transferService = createTransferService(db);
    const stateMachine = createTransferStateMachine(db);
    const { tenant_id } = getAuthContext(c);
    
    const transferId = c.req.param('id');
    
    // Get the current transfer
    const currentTransfer = await transferService.getTransfer(transferId, tenant_id);
    if (!currentTransfer) {
      return c.json({
        success: false,
        error: 'Transfer not found',
        message: 'The requested transfer does not exist or you do not have access to it'
      }, 404);
    }

    // Get valid transitions
    const validTransitions = stateMachine.getValidTransitions(currentTransfer.status as TransferStatusType);

    return c.json({
      success: true,
      data: {
        currentStatus: currentTransfer.status,
        validTransitions: validTransitions,
        transferId: transferId
      }
    });
  } catch (error) {
    console.error('Error getting valid transitions:', error);
    return c.json({
      success: false,
      error: 'Failed to get valid transitions',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /transfers/location/:locationId - Get transfers for a specific location
 * Requirements: 4.4, 6.1, 6.2, 6.3
 */
app.get('/location/:locationId', validateQuery(transferFiltersSchema), async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const transferService = createTransferService(db);
    const { tenant_id } = getAuthContext(c);
    
    const locationId = c.req.param('locationId');
    const filters = getValidatedQuery(c) as any;
    
    // Convert date strings to Date objects
    const transferFilters: TransferFilters = {
      ...filters,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
      dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
    };
    
    const transfers = await transferService.getTransfersForLocation(
      locationId,
      tenant_id,
      transferFilters
    );

    return c.json({
      success: true,
      data: transfers,
      count: transfers.length,
      locationId,
      filters: transferFilters
    });
  } catch (error) {
    console.error('Error getting transfers for location:', error);
    return c.json({
      success: false,
      error: 'Failed to get transfers for location',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

export default app;