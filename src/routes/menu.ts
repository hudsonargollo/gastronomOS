/**
 * Menu Management API Routes
 * Handles menu item CRUD operations and availability management
 * 
 * Requirements: 1.1, 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getDb } from '../db';
import { menuItems, recipes, recipeIngredients, categories } from '../db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { authenticate, injectTenantContext, requireRole } from '../middleware/auth';
import { UserRole } from '../db/schema';

const app = new Hono();

// Apply authentication and tenant context to all routes
app.use('*', authenticate());
app.use('*', injectTenantContext());

// Validation schemas
const createMenuItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  price: z.number().int().positive(),
  categoryId: z.string().uuid().optional(),
  preparationTime: z.number().int().positive().default(15),
  imageUrl: z.string().url().optional(),
  allergens: z.array(z.string()).optional(),
  nutritionalInfo: z.record(z.any()).optional(),
  recipe: z.object({
    instructions: z.string().optional(),
    preparationTime: z.number().int().positive(),
    servingSize: z.number().int().positive().default(1),
    ingredients: z.array(z.object({
      productId: z.string().uuid(),
      quantity: z.number().positive(),
      unit: z.string(),
      isOptional: z.boolean().default(false),
      notes: z.string().optional()
    }))
  }).optional()
});

const updateMenuItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  price: z.number().int().positive().optional(),
  categoryId: z.string().uuid().optional(),
  preparationTime: z.number().int().positive().optional(),
  imageUrl: z.string().url().optional(),
  allergens: z.array(z.string()).optional(),
  nutritionalInfo: z.record(z.any()).optional(),
  isAvailable: z.boolean().optional(),
  active: z.boolean().optional()
});

const updateAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
  reason: z.string().optional()
});

// Get all menu items with filtering
app.get('/', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const categoryId = c.req.query('categoryId');
    const available = c.req.query('available');
    const active = c.req.query('active');
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 50;
    const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : 0;

    const db = getDb(c.env);

    // Build where conditions
    const conditions = [eq(menuItems.tenantId, tenantId)];
    
    if (categoryId) {
      conditions.push(eq(menuItems.categoryId, categoryId));
    }
    
    if (available !== undefined) {
      conditions.push(eq(menuItems.isAvailable, available === 'true'));
    }
    
    if (active !== undefined) {
      conditions.push(eq(menuItems.active, active === 'true'));
    }

    const items = await db
      .select()
      .from(menuItems)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)
      .orderBy(asc(menuItems.name));

    return c.json({
      success: true,
      items,
      pagination: {
        limit,
        offset,
        total: items.length
      }
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

// Get specific menu item with recipe details
app.get('/:itemId', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const itemId = c.req.param('itemId');

    const db = getDb(c.env);

    // Get menu item
    const [item] = await db
      .select()
      .from(menuItems)
      .where(and(
        eq(menuItems.id, itemId),
        eq(menuItems.tenantId, tenantId)
      ))
      .limit(1);

    if (!item) {
      return c.json({
        error: 'Menu item not found'
      }, 404);
    }

    // Get recipe if exists
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.menuItemId, itemId))
      .limit(1);

    let ingredients = [];
    if (recipe) {
      ingredients = await db
        .select()
        .from(recipeIngredients)
        .where(eq(recipeIngredients.recipeId, recipe.id));
    }

    return c.json({
      success: true,
      item: {
        ...item,
        recipe: recipe ? {
          ...recipe,
          ingredients
        } : null
      }
    });
  } catch (error) {
    console.error('Error fetching menu item:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

// Create new menu item (Manager/Admin only)
app.post('/', requireRole([UserRole.ADMIN, UserRole.MANAGER]), zValidator('json', createMenuItemSchema), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const userId = c.get('userId') as string;
    const body = c.req.valid('json');

    const db = getDb(c.env);
    const itemId = crypto.randomUUID();
    const now = Date.now();

    // Create menu item
    await db.insert(menuItems).values({
      id: itemId,
      tenantId,
      name: body.name,
      description: body.description,
      price: body.price,
      categoryId: body.categoryId,
      preparationTime: body.preparationTime,
      imageUrl: body.imageUrl,
      allergens: body.allergens ? JSON.stringify(body.allergens) : null,
      nutritionalInfo: body.nutritionalInfo ? JSON.stringify(body.nutritionalInfo) : null,
      isAvailable: true,
      active: true,
      createdAt: now,
      updatedAt: now
    });

    // Create recipe if provided
    if (body.recipe) {
      const recipeId = crypto.randomUUID();
      
      await db.insert(recipes).values({
        id: recipeId,
        menuItemId: itemId,
        instructions: body.recipe.instructions,
        preparationTime: body.recipe.preparationTime,
        servingSize: body.recipe.servingSize,
        createdAt: now,
        updatedAt: now
      });

      // Create recipe ingredients
      if (body.recipe.ingredients && body.recipe.ingredients.length > 0) {
        await db.insert(recipeIngredients).values(
          body.recipe.ingredients.map(ing => ({
            id: crypto.randomUUID(),
            recipeId,
            productId: ing.productId,
            quantity: ing.quantity,
            unit: ing.unit,
            isOptional: ing.isOptional,
            notes: ing.notes,
            createdAt: now
          }))
        );
      }
    }

    // Fetch created item
    const [createdItem] = await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, itemId))
      .limit(1);

    return c.json({
      success: true,
      item: createdItem
    }, 201);
  } catch (error) {
    console.error('Error creating menu item:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

// Update menu item (Manager/Admin only)
app.put('/:itemId', requireRole([UserRole.ADMIN, UserRole.MANAGER]), zValidator('json', updateMenuItemSchema), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const itemId = c.req.param('itemId');
    const body = c.req.valid('json');

    const db = getDb(c.env);

    // Verify item exists and belongs to tenant
    const [existingItem] = await db
      .select()
      .from(menuItems)
      .where(and(
        eq(menuItems.id, itemId),
        eq(menuItems.tenantId, tenantId)
      ))
      .limit(1);

    if (!existingItem) {
      return c.json({
        error: 'Menu item not found'
      }, 404);
    }

    // Update menu item
    const updateData: any = {
      updatedAt: Date.now()
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.price !== undefined) updateData.price = body.price;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.preparationTime !== undefined) updateData.preparationTime = body.preparationTime;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.allergens !== undefined) updateData.allergens = JSON.stringify(body.allergens);
    if (body.nutritionalInfo !== undefined) updateData.nutritionalInfo = JSON.stringify(body.nutritionalInfo);
    if (body.isAvailable !== undefined) updateData.isAvailable = body.isAvailable;
    if (body.active !== undefined) updateData.active = body.active;

    await db
      .update(menuItems)
      .set(updateData)
      .where(eq(menuItems.id, itemId));

    // Fetch updated item
    const [updatedItem] = await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, itemId))
      .limit(1);

    return c.json({
      success: true,
      item: updatedItem
    });
  } catch (error) {
    console.error('Error updating menu item:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

// Update menu item availability (manual override)
app.patch('/:itemId/availability', zValidator('json', updateAvailabilitySchema), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const itemId = c.req.param('itemId');
    const body = c.req.valid('json');

    const db = getDb(c.env);

    // Verify item exists and belongs to tenant
    const [existingItem] = await db
      .select()
      .from(menuItems)
      .where(and(
        eq(menuItems.id, itemId),
        eq(menuItems.tenantId, tenantId)
      ))
      .limit(1);

    if (!existingItem) {
      return c.json({
        error: 'Menu item not found'
      }, 404);
    }

    // Update availability
    await db
      .update(menuItems)
      .set({
        isAvailable: body.isAvailable,
        updatedAt: Date.now()
      })
      .where(eq(menuItems.id, itemId));

    // Broadcast availability change via WebSocket
    try {
      const { WebSocketService } = await import('../services/websocket-service');
      const wsService = new WebSocketService(c.env.WEBSOCKET_DO);
      await wsService.broadcastInventoryUpdate(
        tenantId,
        itemId,
        body.isAvailable,
        body.reason
      );
    } catch (wsError) {
      console.error('WebSocket broadcast error:', wsError);
      // Continue even if WebSocket fails
    }

    // Fetch updated item
    const [updatedItem] = await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, itemId))
      .limit(1);

    return c.json({
      success: true,
      item: updatedItem
    });
  } catch (error) {
    console.error('Error updating menu item availability:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

// Delete menu item (soft delete) (Manager/Admin only)
app.delete('/:itemId', requireRole([UserRole.ADMIN, UserRole.MANAGER]), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const itemId = c.req.param('itemId');

    const db = getDb(c.env);

    // Verify item exists and belongs to tenant
    const [existingItem] = await db
      .select()
      .from(menuItems)
      .where(and(
        eq(menuItems.id, itemId),
        eq(menuItems.tenantId, tenantId)
      ))
      .limit(1);

    if (!existingItem) {
      return c.json({
        error: 'Menu item not found'
      }, 404);
    }

    // Soft delete by setting active to false
    await db
      .update(menuItems)
      .set({
        active: false,
        updatedAt: Date.now()
      })
      .where(eq(menuItems.id, itemId));

    return c.json({
      success: true,
      message: 'Menu item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

// Get menu categories
app.get('/categories/list', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;

    const db = getDb(c.env);

    const cats = await db
      .select()
      .from(categories)
      .where(and(
        eq(categories.tenantId, tenantId),
        eq(categories.active, true)
      ))
      .orderBy(asc(categories.sortOrder), asc(categories.name));

    return c.json({
      success: true,
      categories: cats
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

export default app;
