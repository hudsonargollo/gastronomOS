import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { 
  authenticate, 
  injectTenantContext,
  getAuthContext
} from '../middleware/auth';
import { createAllocationTransferIntegrationService } from '../services/allocation-transfer-integration';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Apply middleware
app.use('*', authenticate());
app.use('*', injectTenantContext());

/**
 * POST /allocations/:id/create-transfers
 * Create transfers from an allocation
 * Requirements: 9.1, 9.4, 9.5
 */
app.post('/allocations/:id/create-transfers', async (c) => {
  const allocationId = c.req.param('id');
  const authContext = getAuthContext(c);
  const tenantId = authContext.tenant_id;
  const userId = authContext.user_id;

  if (!allocationId) {
    return c.json({ error: 'Allocation ID is required' }, 400);
  }

  try {
    const body = await c.req.json();
    const { destinationLocationId, priority = 'NORMAL', notes, reasonCode } = body;

    if (!destinationLocationId) {
      return c.json({ 
        error: 'Destination location ID is required',
        details: 'Specify the location where the allocated inventory should be transferred to'
      }, 400);
    }

    const db = drizzle(c.env.DB);
    const integrationService = createAllocationTransferIntegrationService(db);

    const result = await integrationService.createTransferFromAllocationWithDestination(
      allocationId,
      destinationLocationId,
      tenantId,
      userId,
      {
        priority,
        notes,
        reasonCode
      }
    );

    return c.json({
      success: true,
      data: {
        transfer: result.transfer,
        allocationLink: result.link,
        message: 'Transfer created successfully from allocation'
      }
    }, 201);

  } catch (error) {
    console.error('Error creating transfer from allocation:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return c.json({ error: error.message }, 404);
      }
      if (error.message.includes('status') || error.message.includes('validation')) {
        return c.json({ error: error.message }, 422);
      }
    }

    return c.json({ 
      error: 'Failed to create transfer from allocation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /allocations/:id/create-transfers/bulk
 * Create multiple transfers from an allocation (for partial transfer scenarios)
 * Requirements: 9.4, 9.5
 */
app.post('/allocations/:id/create-transfers/bulk', async (c) => {
  const allocationId = c.req.param('id');
  const authContext = getAuthContext(c);
  const tenantId = authContext.tenant_id;
  const userId = authContext.user_id;

  if (!allocationId) {
    return c.json({ error: 'Allocation ID is required' }, 400);
  }

  try {
    const body = await c.req.json();
    const { transfers: transferRequests } = body;

    if (!transferRequests || !Array.isArray(transferRequests) || transferRequests.length === 0) {
      return c.json({ 
        error: 'Transfer requests array is required',
        details: 'Provide an array of transfer requests with destinationLocationId and quantity for each'
      }, 400);
    }

    const db = drizzle(c.env.DB);
    const integrationService = createAllocationTransferIntegrationService(db);

    const results = [];
    const errors = [];

    // Process each transfer request
    for (let i = 0; i < transferRequests.length; i++) {
      const request = transferRequests[i];
      
      try {
        if (!request.destinationLocationId || !request.quantity || request.quantity <= 0) {
          errors.push({
            index: i,
            error: 'Each transfer request must have destinationLocationId and positive quantity'
          });
          continue;
        }

        // For bulk transfers, we need to handle partial quantities
        // This is a simplified implementation - in practice, you'd need more sophisticated logic
        const result = await integrationService.createTransferFromAllocationWithDestination(
          allocationId,
          request.destinationLocationId,
          tenantId,
          userId,
          {
            priority: request.priority || 'NORMAL',
            notes: request.notes || `Bulk transfer ${i + 1} of ${transferRequests.length}`,
            reasonCode: request.reasonCode || 'BULK_TRANSFER'
          }
        );

        results.push({
          index: i,
          transfer: result.transfer,
          allocationLink: result.link
        });

      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return c.json({
      success: errors.length === 0,
      data: {
        successfulTransfers: results,
        failedTransfers: errors,
        summary: {
          total: transferRequests.length,
          successful: results.length,
          failed: errors.length
        }
      }
    }, errors.length === 0 ? 201 : 207); // 207 Multi-Status for partial success

  } catch (error) {
    console.error('Error creating bulk transfers from allocation:', error);
    return c.json({ 
      error: 'Failed to create bulk transfers from allocation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /transfers/:id/allocation-link
 * Get allocation links for a transfer
 * Requirements: 9.4, 9.5
 */
app.get('/transfers/:id/allocation-link', async (c) => {
  const transferId = c.req.param('id');
  const authContext = getAuthContext(c);
  const tenantId = authContext.tenant_id;

  if (!transferId) {
    return c.json({ error: 'Transfer ID is required' }, 400);
  }

  try {
    const db = drizzle(c.env.DB);
    const integrationService = createAllocationTransferIntegrationService(db);

    const links = await integrationService.getTransferAllocationLinks(transferId, tenantId);

    return c.json({
      success: true,
      data: {
        transferId,
        allocationLinks: links,
        linkCount: links.length
      }
    });

  } catch (error) {
    console.error('Error getting transfer allocation links:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ error: error.message }, 404);
    }

    return c.json({ 
      error: 'Failed to get transfer allocation links',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /allocations/:id/transfer-links
 * Get transfer links for an allocation
 * Requirements: 9.4, 9.5
 */
app.get('/allocations/:id/transfer-links', async (c) => {
  const allocationId = c.req.param('id');
  const authContext = getAuthContext(c);
  const tenantId = authContext.tenant_id;

  if (!allocationId) {
    return c.json({ error: 'Allocation ID is required' }, 400);
  }

  try {
    const db = drizzle(c.env.DB);
    const integrationService = createAllocationTransferIntegrationService(db);

    const links = await integrationService.getAllocationTransferLinks(allocationId, tenantId);

    return c.json({
      success: true,
      data: {
        allocationId,
        transferLinks: links,
        linkCount: links.length
      }
    });

  } catch (error) {
    console.error('Error getting allocation transfer links:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ error: error.message }, 404);
    }

    return c.json({ 
      error: 'Failed to get allocation transfer links',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /allocations/:id/traceability
 * Get complete traceability chain for an allocation
 * Requirements: 9.1, 9.2, 9.5
 */
app.get('/allocations/:id/traceability', async (c) => {
  const allocationId = c.req.param('id');
  const authContext = getAuthContext(c);
  const tenantId = authContext.tenant_id;

  if (!allocationId) {
    return c.json({ error: 'Allocation ID is required' }, 400);
  }

  try {
    const db = drizzle(c.env.DB);
    const integrationService = createAllocationTransferIntegrationService(db);

    const traceabilityChain = await integrationService.getTraceabilityChain(allocationId, tenantId);

    return c.json({
      success: true,
      data: {
        allocationId,
        traceability: {
          allocation: traceabilityChain.allocation,
          product: traceabilityChain.product,
          transfers: traceabilityChain.transfers,
          locations: traceabilityChain.locations,
          transferCount: traceabilityChain.transfers.length,
          locationCount: traceabilityChain.locations.length
        }
      }
    });

  } catch (error) {
    console.error('Error getting allocation traceability:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ error: error.message }, 404);
    }

    return c.json({ 
      error: 'Failed to get allocation traceability',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /allocations/:id/sync-status
 * Synchronize allocation and transfer statuses
 * Requirements: 9.2, 9.3
 */
app.post('/allocations/:id/sync-status', async (c) => {
  const allocationId = c.req.param('id');
  const authContext = getAuthContext(c);
  const tenantId = authContext.tenant_id;

  if (!allocationId) {
    return c.json({ error: 'Allocation ID is required' }, 400);
  }

  try {
    const db = drizzle(c.env.DB);
    const integrationService = createAllocationTransferIntegrationService(db);

    const syncResults = await integrationService.syncAllocationTransferStatus(allocationId, tenantId);

    return c.json({
      success: true,
      data: {
        allocationId,
        syncResults,
        syncCount: syncResults.length,
        updatedAllocations: syncResults.filter(r => r.allocationStatusUpdated).length,
        updatedTransfers: syncResults.filter(r => r.transferStatusUpdated).length
      }
    });

  } catch (error) {
    console.error('Error syncing allocation transfer status:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({ error: error.message }, 404);
    }

    return c.json({ 
      error: 'Failed to sync allocation transfer status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /transfers/:id/link-allocation
 * Link an existing transfer to an allocation
 * Requirements: 9.2, 9.5
 */
app.post('/transfers/:id/link-allocation', async (c) => {
  const transferId = c.req.param('id');
  const authContext = getAuthContext(c);
  const tenantId = authContext.tenant_id;
  const userId = authContext.user_id;

  if (!transferId) {
    return c.json({ error: 'Transfer ID is required' }, 400);
  }

  try {
    const body = await c.req.json();
    const { allocationId } = body;

    if (!allocationId) {
      return c.json({ 
        error: 'Allocation ID is required',
        details: 'Specify the allocation ID to link to this transfer'
      }, 400);
    }

    const db = drizzle(c.env.DB);
    const integrationService = createAllocationTransferIntegrationService(db);

    const link = await integrationService.linkTransferToAllocation(
      transferId,
      allocationId,
      tenantId,
      userId
    );

    return c.json({
      success: true,
      data: {
        link,
        message: 'Transfer successfully linked to allocation'
      }
    }, 201);

  } catch (error) {
    console.error('Error linking transfer to allocation:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return c.json({ error: error.message }, 404);
      }
      if (error.message.includes('already linked')) {
        return c.json({ error: error.message }, 409);
      }
    }

    return c.json({ 
      error: 'Failed to link transfer to allocation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;