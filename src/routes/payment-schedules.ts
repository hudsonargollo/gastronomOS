/**
 * Payment Schedules API Routes
 * Handles recurring payments, payment parcels, and reminders
 * 
 * Pontal Stock - Payment Scheduling System
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc, asc } from 'drizzle-orm';
import { getDb } from '../db';
import { paymentSchedules } from '../db/schema';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Validation schemas
const createPaymentScheduleSchema = z.object({
  purchaseOrderId: z.string().min(1),
  dueDate: z.string().datetime(),
  amountCents: z.number().int().positive(),
  reminderDays: z.number().int().min(0).max(30).default(3),
  notes: z.string().max(500).optional(),
});

const updatePaymentScheduleSchema = z.object({
  dueDate: z.string().datetime().optional(),
  amountCents: z.number().int().positive().optional(),
  reminderDays: z.number().int().min(0).max(30).optional(),
  notes: z.string().max(500).optional(),
});

const markPaidSchema = z.object({
  paidAt: z.number().int().optional(),
  paidAmount: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

// Middleware to extract tenant ID
app.use('*', async (c, next) => {
  const tenantId = c.req.header('x-tenant-id') || c.req.query('tenantId');
  if (!tenantId) {
    return c.json({ error: 'Tenant ID is required' }, 400);
  }
  c.set('tenantId', tenantId);
  await next();
});

/**
 * Create Payment Schedule
 * POST /api/v1/payment-schedules
 */
app.post('/', zValidator('json', createPaymentScheduleSchema), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const body = c.req.valid('json');
    const db = getDb(c.env);

    const id = `ps-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Math.floor(Date.now() / 1000);

    const result = await db.insert(paymentSchedules).values({
      id,
      tenantId,
      purchaseOrderId: body.purchaseOrderId,
      dueDate: Math.floor(new Date(body.dueDate).getTime() / 1000),
      amountCents: body.amountCents,
      status: 'PENDING',
      reminderDays: body.reminderDays,
      reminderSentAt: null,
      reminderCount: 0,
      notes: body.notes || null,
      createdAt: now,
      updatedAt: now,
    }).run();

    return c.json({
      success: true,
      data: {
        id,
        purchaseOrderId: body.purchaseOrderId,
        dueDate: body.dueDate,
        amountCents: body.amountCents,
        status: 'PENDING',
        reminderDays: body.reminderDays,
        reminderSentAt: null,
        reminderCount: 0,
        notes: body.notes || null,
        createdAt: now,
        updatedAt: now,
      },
    }, 201);
  } catch (error) {
    console.error('Error creating payment schedule:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * List Payment Schedules
 * GET /api/v1/payment-schedules
 */
app.get('/', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const status = c.req.query('status');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const sortBy = c.req.query('sortBy') || 'dueDate';
    const sortOrder = c.req.query('sortOrder') || 'asc';

    const db = getDb(c.env);
    const offset = (page - 1) * limit;

    // Build query
    let query = db.select().from(paymentSchedules).where(eq(paymentSchedules.tenantId, tenantId));

    if (status) {
      query = query.where(eq(paymentSchedules.status, status as any));
    }

    // Get total count
    const countResult = await db.select().from(paymentSchedules).where(eq(paymentSchedules.tenantId, tenantId)).run();
    const total = countResult.length;

    // Apply sorting
    const sortColumn = sortBy === 'dueDate' ? paymentSchedules.dueDate : paymentSchedules.createdAt;
    const sortFn = sortOrder === 'desc' ? desc : asc;

    const items = await query
      .orderBy(sortFn(sortColumn))
      .limit(limit)
      .offset(offset)
      .run();

    return c.json({
      success: true,
      data: {
        items: items.map(item => ({
          id: item.id,
          purchaseOrderId: item.purchaseOrderId,
          dueDate: new Date(item.dueDate * 1000).toISOString(),
          amountCents: item.amountCents,
          status: item.status,
          reminderDays: item.reminderDays,
          notes: item.notes,
          createdAt: item.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error listing payment schedules:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Get Payment Schedule Details
 * GET /api/v1/payment-schedules/:id
 */
app.get('/:id', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const id = c.req.param('id');
    const db = getDb(c.env);

    const result = await db
      .select()
      .from(paymentSchedules)
      .where(and(eq(paymentSchedules.id, id), eq(paymentSchedules.tenantId, tenantId)))
      .run();

    if (result.length === 0) {
      return c.json({ error: 'Payment schedule not found' }, 404);
    }

    const item = result[0];
    return c.json({
      success: true,
      data: {
        id: item.id,
        purchaseOrderId: item.purchaseOrderId,
        dueDate: new Date(item.dueDate * 1000).toISOString(),
        amountCents: item.amountCents,
        status: item.status,
        reminderDays: item.reminderDays,
        reminderSentAt: item.reminderSentAt ? new Date(item.reminderSentAt * 1000).toISOString() : null,
        reminderCount: item.reminderCount,
        notes: item.notes,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error getting payment schedule:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Update Payment Schedule
 * PUT /api/v1/payment-schedules/:id
 */
app.put('/:id', zValidator('json', updatePaymentScheduleSchema), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const id = c.req.param('id');
    const body = c.req.valid('json');
    const db = getDb(c.env);

    const now = Math.floor(Date.now() / 1000);
    const updates: any = { updatedAt: now };

    if (body.dueDate) {
      updates.dueDate = Math.floor(new Date(body.dueDate).getTime() / 1000);
    }
    if (body.amountCents) {
      updates.amountCents = body.amountCents;
    }
    if (body.reminderDays !== undefined) {
      updates.reminderDays = body.reminderDays;
    }
    if (body.notes !== undefined) {
      updates.notes = body.notes || null;
    }

    await db
      .update(paymentSchedules)
      .set(updates)
      .where(and(eq(paymentSchedules.id, id), eq(paymentSchedules.tenantId, tenantId)))
      .run();

    // Fetch updated record
    const result = await db
      .select()
      .from(paymentSchedules)
      .where(and(eq(paymentSchedules.id, id), eq(paymentSchedules.tenantId, tenantId)))
      .run();

    if (result.length === 0) {
      return c.json({ error: 'Payment schedule not found' }, 404);
    }

    const item = result[0];
    return c.json({
      success: true,
      data: {
        id: item.id,
        purchaseOrderId: item.purchaseOrderId,
        dueDate: new Date(item.dueDate * 1000).toISOString(),
        amountCents: item.amountCents,
        status: item.status,
        reminderDays: item.reminderDays,
        notes: item.notes,
        updatedAt: item.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating payment schedule:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Mark Payment as Paid
 * PUT /api/v1/payment-schedules/:id/mark-paid
 */
app.put('/:id/mark-paid', zValidator('json', markPaidSchema), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const id = c.req.param('id');
    const body = c.req.valid('json');
    const db = getDb(c.env);

    const now = Math.floor(Date.now() / 1000);
    const paidAt = body.paidAt || now;

    await db
      .update(paymentSchedules)
      .set({
        status: 'PAID',
        updatedAt: now,
      })
      .where(and(eq(paymentSchedules.id, id), eq(paymentSchedules.tenantId, tenantId)))
      .run();

    // Fetch updated record
    const result = await db
      .select()
      .from(paymentSchedules)
      .where(and(eq(paymentSchedules.id, id), eq(paymentSchedules.tenantId, tenantId)))
      .run();

    if (result.length === 0) {
      return c.json({ error: 'Payment schedule not found' }, 404);
    }

    const item = result[0];
    return c.json({
      success: true,
      data: {
        id: item.id,
        status: 'PAID',
        paidAt: new Date(paidAt * 1000).toISOString(),
        paidAmount: body.paidAmount || item.amountCents,
        notes: body.notes || item.notes,
        updatedAt: item.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error marking payment as paid:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Send Reminder
 * PUT /api/v1/payment-schedules/:id/send-reminder
 */
app.put('/:id/send-reminder', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const id = c.req.param('id');
    const db = getDb(c.env);

    const now = Math.floor(Date.now() / 1000);

    // Get current record
    const result = await db
      .select()
      .from(paymentSchedules)
      .where(and(eq(paymentSchedules.id, id), eq(paymentSchedules.tenantId, tenantId)))
      .run();

    if (result.length === 0) {
      return c.json({ error: 'Payment schedule not found' }, 404);
    }

    const item = result[0];

    // Update reminder info
    await db
      .update(paymentSchedules)
      .set({
        reminderSentAt: now,
        reminderCount: (item.reminderCount || 0) + 1,
        updatedAt: now,
      })
      .where(and(eq(paymentSchedules.id, id), eq(paymentSchedules.tenantId, tenantId)))
      .run();

    return c.json({
      success: true,
      data: {
        id,
        reminderSentAt: new Date(now * 1000).toISOString(),
        reminderCount: (item.reminderCount || 0) + 1,
        message: 'Reminder sent successfully',
      },
    });
  } catch (error) {
    console.error('Error sending reminder:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Delete Payment Schedule
 * DELETE /api/v1/payment-schedules/:id
 */
app.delete('/:id', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const id = c.req.param('id');
    const db = getDb(c.env);

    await db
      .delete(paymentSchedules)
      .where(and(eq(paymentSchedules.id, id), eq(paymentSchedules.tenantId, tenantId)))
      .run();

    return c.json({
      success: true,
      message: 'Payment schedule deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting payment schedule:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;
