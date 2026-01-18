import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';
import { getAuthContext } from '../middleware/auth';
import { validateBody, getValidatedBody } from '../middleware/validation';
import { createTransferNotificationService, NotificationMethodType } from '../services/transfer-notification';

const app = new Hono();

// Validation schemas
const notificationPreferencesSchema = z.object({
  locationId: z.string().optional(),
  enableTransferNotifications: z.boolean().optional(),
  enableEmergencyNotifications: z.boolean().optional(),
  enableVarianceAlerts: z.boolean().optional(),
  enableStatusUpdates: z.boolean().optional(),
  methods: z.array(z.enum(['EMAIL', 'SMS', 'IN_APP', 'PUSH'])).optional(),
  quietHours: z.object({
    start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/), // HH:MM format
    end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),   // HH:MM format
    timezone: z.string()
  }).optional()
});

/**
 * GET /transfer-notifications/preferences - Get user notification preferences
 * Requirements: 2.2, 2.5
 */
app.get('/preferences', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const notificationService = createTransferNotificationService(db);
    const { user_id } = getAuthContext(c);
    
    const preferences = await notificationService.getUserPreferences(user_id);
    
    return c.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    return c.json({
      success: false,
      error: 'Failed to get notification preferences',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * PUT /transfer-notifications/preferences - Update user notification preferences
 * Requirements: 2.2, 2.5
 */
app.put('/preferences', validateBody(notificationPreferencesSchema), async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const notificationService = createTransferNotificationService(db);
    const { user_id } = getAuthContext(c);
    
    const preferences = getValidatedBody(c);
    
    const updatedPreferences = await notificationService.updateUserPreferences(user_id, preferences);
    
    return c.json({
      success: true,
      data: updatedPreferences
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return c.json({
      success: false,
      error: 'Failed to update notification preferences',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /transfer-notifications/history/:transferId - Get notification history for a transfer
 * Requirements: 4.5
 */
app.get('/history/:transferId', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const notificationService = createTransferNotificationService(db);
    const { user_id, tenant_id } = getAuthContext(c);
    const transferId = c.req.param('transferId');
    
    if (!transferId) {
      return c.json({
        success: false,
        error: 'Transfer ID is required'
      }, 400);
    }
    
    const history = await notificationService.getNotificationHistory(transferId);
    
    return c.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error getting notification history:', error);
    return c.json({
      success: false,
      error: 'Failed to get notification history',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /transfer-notifications/user - Get user notifications
 * Requirements: 2.2, 2.5
 */
app.get('/user', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const notificationService = createTransferNotificationService(db);
    const { user_id } = getAuthContext(c);
    
    const unreadOnly = c.req.query('unread_only') === 'true';
    
    const notifications = await notificationService.getUserNotifications(user_id, unreadOnly);
    
    return c.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Error getting user notifications:', error);
    return c.json({
      success: false,
      error: 'Failed to get user notifications',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * POST /transfer-notifications/:notificationId/read - Mark notification as read
 * Requirements: 2.2, 2.5
 */
app.post('/:notificationId/read', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const notificationService = createTransferNotificationService(db);
    const { user_id } = getAuthContext(c);
    const notificationId = c.req.param('notificationId');
    
    if (!notificationId) {
      return c.json({
        success: false,
        error: 'Notification ID is required'
      }, 400);
    }
    
    await notificationService.markNotificationAsRead(notificationId, user_id);
    
    return c.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return c.json({
      success: false,
      error: 'Failed to mark notification as read',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

/**
 * GET /transfer-notifications/templates - Get notification templates
 * Requirements: 2.2, 2.5
 */
app.get('/templates', async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const notificationService = createTransferNotificationService(db);
    
    const templates = await notificationService.getNotificationTemplates();
    
    return c.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error getting notification templates:', error);
    return c.json({
      success: false,
      error: 'Failed to get notification templates',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

export default app;