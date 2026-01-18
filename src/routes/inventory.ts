import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, desc, asc, gte, lte } from 'drizzle-orm';
import { inventoryItems, products, locations, type InventoryItem, type NewInventoryItem } from '../db/schema';
import { authenticate, getAuthContext, getDatabase } from '../middleware/auth';
import { validateBody, validateQuery, getValidatedBody, getValidatedQuery } from '../middleware/error';
import { createSuccessResponse, createErrorResponse } from '../utils';
import { 
  createInventoryItemSchema, 
  updateInventoryItemSchema, 
  inventoryQuerySchema,
  bulkDeleteSchema 
} from '../schemas/validation';

const app = new Hono();

// Apply authentication to all routes
app.use('*', authenticate());

/**
 * GET /inventory - List inventory items with pagination, search, and filtering
 */
app.get('/', validateQuery(inventoryQuerySchema), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const query = getValidatedQuery<z.infer<typeof inventoryQuerySchema>>(c);

    // Build the query with joins
    let dbQuery = db
      .select({
        id: inventoryItems.id,
        tenantId: inventoryItems.tenantId,
        productId: inventoryItems.productId,
        locationId: inventoryItems.locationId,
        quantity: inventoryItems.quantity,
        unitCost: inventoryItems.unitCost,
        lastUpdated: inventoryItems.lastUpdated,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt,
        product: {
          id: products.id,
          name: products.name,
          description: products.description,
          unit: products.unit,
          sku: products.sku,
        },
        location: {
          id: locations.id,
          name: locations.name,
          type: locations.type,
        },
      })
      .from(inventoryItems)
      .leftJoin(products, eq(inventoryItems.productId, products.id))
      .leftJoin(locations, eq(inventoryItems.locationId, locations.id))
      .where(eq(inventoryItems.tenantId, authContext.tenant_id));

    // Apply filters
    if (query.productId) {
      dbQuery = dbQuery.where(
        and(
          eq(inventoryItems.tenantId, authContext.tenant_id),
          eq(inventoryItems.productId, query.productId)
        )
      );
    }

    if (query.locationId) {
      dbQuery = dbQuery.where(
        and(
          eq(inventoryItems.tenantId, authContext.tenant_id),
          eq(inventoryItems.locationId, query.locationId)
        )
      );
    }

    if (query.minQuantity !== undefined) {
      dbQuery = dbQuery.where(
        and(
          eq(inventoryItems.tenantId, authContext.tenant_id),
          gte(inventoryItems.quantity, query.minQuantity)
        )
      );
    }

    if (query.maxQuantity !== undefined) {
      dbQuery = dbQuery.where(
        and(
          eq(inventoryItems.tenantId, authContext.tenant_id),
          lte(inventoryItems.quantity, query.maxQuantity)
        )
      );
    }

    // Apply sorting
    const sortField = query.sortBy === 'quantity' ? inventoryItems.quantity : 
                     query.sortBy === 'unitCost' ? inventoryItems.unitCost :
                     query.sortBy === 'lastUpdated' ? inventoryItems.lastUpdated :
                     inventoryItems.createdAt;
    
    dbQuery = dbQuery.orderBy(
      query.sortOrder === 'asc' ? asc(sortField) : desc(sortField)
    );

    // Apply pagination
    const offset = (query.page - 1) * query.limit;
    dbQuery = dbQuery.limit(query.limit).offset(offset);

    const results = await dbQuery;

    // Get total count for pagination
    const totalQuery = db
      .select({ count: inventoryItems.id })
      .from(inventoryItems)
      .where(eq(inventoryItems.tenantId, authContext.tenant_id));

    // Apply same filters to count query
    if (query.productId) {
      totalQuery.where(eq(inventoryItems.productId, query.productId));
    }
    if (query.locationId) {
      totalQuery.where(eq(inventoryItems.locationId, query.locationId));
    }
    if (query.minQuantity !== undefined) {
      totalQuery.where(gte(inventoryItems.quantity, query.minQuantity));
    }
    if (query.maxQuantity !== undefined) {
      totalQuery.where(lte(inventoryItems.quantity, query.maxQuantity));
    }

    const totalResults = await totalQuery;
    const total = totalResults.length;

    return c.json(createSuccessResponse({
      inventory: results,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    }));
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return c.json(createErrorResponse(
      'Internal Server Error',
      'Failed to fetch inventory',
      'FETCH_ERROR'
    ), 500);
  }
});

/**
 * GET /inventory/:id - Get inventory item by ID
 */
app.get('/:id', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const inventoryId = c.req.param('id');

    const result = await db
      .select({
        id: inventoryItems.id,
        tenantId: inventoryItems.tenantId,
        productId: inventoryItems.productId,
        locationId: inventoryItems.locationId,
        quantity: inventoryItems.quantity,
        unitCost: inventoryItems.unitCost,
        lastUpdated: inventoryItems.lastUpdated,
        createdAt: inventoryItems.createdAt,
        updatedAt: inventoryItems.updatedAt,
        product: {
          id: products.id,
          name: products.name,
          description: products.description,
          unit: products.unit,
          sku: products.sku,
        },
        location: {
          id: locations.id,
          name: locations.name,
          type: locations.type,
        },
      })
      .from(inventoryItems)
      .leftJoin(products, eq(inventoryItems.productId, products.id))
      .leftJoin(locations, eq(inventoryItems.locationId, locations.id))
      .where(
        and(
          eq(inventoryItems.id, inventoryId),
          eq(inventoryItems.tenantId, authContext.tenant_id)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return c.json(createErrorResponse(
        'Not Found',
        'Inventory item not found',
        'INVENTORY_NOT_FOUND'
      ), 404);
    }

    return c.json(createSuccessResponse({
      inventory: result[0],
    }));
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    return c.json(createErrorResponse(
      'Internal Server Error',
      'Failed to fetch inventory item',
      'FETCH_ERROR'
    ), 500);
  }
});

/**
 * POST /inventory - Create new inventory item
 */
app.post('/', validateBody(createInventoryItemSchema), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const data = getValidatedBody<z.infer<typeof createInventoryItemSchema>>(c);

    // Check if inventory item already exists for this product/location combination
    const existing = await db
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.tenantId, authContext.tenant_id),
          eq(inventoryItems.productId, data.productId),
          eq(inventoryItems.locationId, data.locationId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return c.json(createErrorResponse(
        'Conflict',
        'Inventory item already exists for this product and location',
        'INVENTORY_EXISTS'
      ), 409);
    }

    // Validate product exists
    const product = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, data.productId),
          eq(products.tenantId, authContext.tenant_id)
        )
      )
      .limit(1);

    if (product.length === 0) {
      return c.json(createErrorResponse(
        'Bad Request',
        'Product not found',
        'PRODUCT_NOT_FOUND'
      ), 400);
    }

    // Validate location exists
    const location = await db
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.id, data.locationId),
          eq(locations.tenantId, authContext.tenant_id)
        )
      )
      .limit(1);

    if (location.length === 0) {
      return c.json(createErrorResponse(
        'Bad Request',
        'Location not found',
        'LOCATION_NOT_FOUND'
      ), 400);
    }

    const newInventoryItem: NewInventoryItem = {
      id: crypto.randomUUID(),
      tenantId: authContext.tenant_id,
      productId: data.productId,
      locationId: data.locationId,
      quantity: data.quantity,
      unitCost: data.unitCost,
      lastUpdated: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.insert(inventoryItems).values(newInventoryItem);

    return c.json(createSuccessResponse({
      inventory: newInventoryItem,
    }), 201);
  } catch (error) {
    console.error('Error creating inventory item:', error);
    return c.json(createErrorResponse(
      'Internal Server Error',
      'Failed to create inventory item',
      'CREATE_ERROR'
    ), 500);
  }
});

/**
 * PUT /inventory/:id - Update inventory item
 */
app.put('/:id', validateBody(updateInventoryItemSchema), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const inventoryId = c.req.param('id');
    const data = getValidatedBody<z.infer<typeof updateInventoryItemSchema>>(c);

    // Check if inventory item exists
    const existing = await db
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.id, inventoryId),
          eq(inventoryItems.tenantId, authContext.tenant_id)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return c.json(createErrorResponse(
        'Not Found',
        'Inventory item not found',
        'INVENTORY_NOT_FOUND'
      ), 404);
    }

    const updateData = {
      ...data,
      lastUpdated: Date.now(),
      updatedAt: Date.now(),
    };

    await db
      .update(inventoryItems)
      .set(updateData)
      .where(
        and(
          eq(inventoryItems.id, inventoryId),
          eq(inventoryItems.tenantId, authContext.tenant_id)
        )
      );

    // Fetch updated inventory item
    const updated = await db
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.id, inventoryId),
          eq(inventoryItems.tenantId, authContext.tenant_id)
        )
      )
      .limit(1);

    return c.json(createSuccessResponse({
      inventory: updated[0],
    }));
  } catch (error) {
    console.error('Error updating inventory item:', error);
    return c.json(createErrorResponse(
      'Internal Server Error',
      'Failed to update inventory item',
      'UPDATE_ERROR'
    ), 500);
  }
});

/**
 * DELETE /inventory/:id - Delete inventory item
 */
app.delete('/:id', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const inventoryId = c.req.param('id');

    // Check if inventory item exists
    const existing = await db
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.id, inventoryId),
          eq(inventoryItems.tenantId, authContext.tenant_id)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return c.json(createErrorResponse(
        'Not Found',
        'Inventory item not found',
        'INVENTORY_NOT_FOUND'
      ), 404);
    }

    // Hard delete inventory item
    await db
      .delete(inventoryItems)
      .where(
        and(
          eq(inventoryItems.id, inventoryId),
          eq(inventoryItems.tenantId, authContext.tenant_id)
        )
      );

    return c.json(createSuccessResponse({
      message: 'Inventory item deleted successfully',
    }));
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    return c.json(createErrorResponse(
      'Internal Server Error',
      'Failed to delete inventory item',
      'DELETE_ERROR'
    ), 500);
  }
});

/**
 * GET /inventory/low-stock - Get low stock items
 */
app.get('/low-stock', validateQuery(inventoryQuerySchema), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const query = getValidatedQuery<z.infer<typeof inventoryQuerySchema>>(c);

    // Default threshold for low stock
    const threshold = query.maxQuantity || 10;

    const results = await db
      .select({
        id: inventoryItems.id,
        tenantId: inventoryItems.tenantId,
        productId: inventoryItems.productId,
        locationId: inventoryItems.locationId,
        quantity: inventoryItems.quantity,
        unitCost: inventoryItems.unitCost,
        lastUpdated: inventoryItems.lastUpdated,
        product: {
          id: products.id,
          name: products.name,
          description: products.description,
          unit: products.unit,
          sku: products.sku,
        },
        location: {
          id: locations.id,
          name: locations.name,
          type: locations.type,
        },
      })
      .from(inventoryItems)
      .leftJoin(products, eq(inventoryItems.productId, products.id))
      .leftJoin(locations, eq(inventoryItems.locationId, locations.id))
      .where(
        and(
          eq(inventoryItems.tenantId, authContext.tenant_id),
          lte(inventoryItems.quantity, threshold)
        )
      )
      .orderBy(asc(inventoryItems.quantity));

    return c.json(createSuccessResponse({
      lowStockItems: results,
      threshold,
    }));
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    return c.json(createErrorResponse(
      'Internal Server Error',
      'Failed to fetch low stock items',
      'FETCH_ERROR'
    ), 500);
  }
});

export default app;