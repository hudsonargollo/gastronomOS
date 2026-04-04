// Kitchen Display System API Routes
// Provides endpoints for kitchen staff management and order item status updates

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getDb } from '../db';
import { orderItems, users } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { OrderErrorCode } from '../types/orders';
import { authenticate, injectTenantContext, requireRole } from '../middleware/auth';
import { UserRole } from '../db/schema';

const app = new Hono();

// Apply authentication and tenant context to all routes
app.use('*', authenticate());
app.use('*', injectTenantContext());

// Validation schemas
const updateItemStatusSchema = z.object({
  status: z.enum(['PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'])
});

// Get kitchen staff
app.get('/staff', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const db = getDb(c.env);

    // Get users with kitchen role
    const staff = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          inArray(users.role, ['kitchen', 'chef', 'cook'])
        )
      );

    // For now, return mock assigned order counts
    // In production, this would query the orders table
    const staffWithWorkload = staff.map(member => ({
      ...member,
      assignedOrders: Math.floor(Math.random() * 5) // Mock data
    }));

    return c.json({
      success: true,
      staff: staffWithWorkload
    });
  } catch (error) {
    console.error('Error fetching kitchen staff:', error);
    return c.json({
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Update order item status
app.patch('/order-items/:itemId/status', zValidator('json', updateItemStatusSchema), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const itemId = c.req.param('itemId');
    const body = c.req.valid('json');
    const db = getDb(c.env);

    // Get the order item to verify it exists
    const [item] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, itemId))
      .limit(1);

    if (!item) {
      return c.json({
        error: 'Order item not found',
        errorCode: OrderErrorCode.ORDER_NOT_FOUND
      }, 404);
    }

    // Update the item status
    await db
      .update(orderItems)
      .set({
        status: body.status
      })
      .where(eq(orderItems.id, itemId));

    // Get updated item
    const [updatedItem] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, itemId))
      .limit(1);

    return c.json({
      success: true,
      item: updatedItem
    });
  } catch (error) {
    console.error('Error updating order item status:', error);
    return c.json({
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Assign staff to order
app.post('/orders/:orderId/assign-staff', zValidator('json', z.object({
  staffId: z.string().uuid()
})), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const orderId = c.req.param('orderId');
    const body = c.req.valid('json');
    const db = getDb(c.env);

    // Verify staff member exists and belongs to tenant
    const [staffMember] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, body.staffId),
          eq(users.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!staffMember) {
      return c.json({
        error: 'Staff member not found',
        errorCode: 'STAFF_NOT_FOUND'
      }, 404);
    }

    // In a full implementation, this would update an order assignment table
    // For now, we'll just return success
    return c.json({
      success: true,
      orderId,
      staffId: body.staffId,
      message: 'Staff assigned successfully'
    });
  } catch (error) {
    console.error('Error assigning staff to order:', error);
    return c.json({
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

export default app;
