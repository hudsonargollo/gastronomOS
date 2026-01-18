import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, desc, asc, like, isNull } from 'drizzle-orm';
import { categories, type Category, type NewCategory } from '../db/schema';
import { authenticate, getAuthContext, getDatabase } from '../middleware/auth';
import { validateBody, validateQuery, getValidatedBody, getValidatedQuery } from '../middleware/error';
import { createSuccessResponse, createErrorResponse } from '../utils';
import { 
  createCategorySchema, 
  updateCategorySchema, 
  categoryQuerySchema,
  bulkDeleteSchema 
} from '../schemas/validation';
import { PaginationService, advancedPaginationSchema } from '../services/pagination';
import { BulkOperationsService, bulkUpdateSchema } from '../services/bulk-operations';
import { DataExportService } from '../services/data-export';
import { FullTextSearchService } from '../services/full-text-search';
import { ComprehensiveAuditService } from '../services/comprehensive-audit';
import { WebhookEvents } from '../services/webhook-system';

const app = new Hono();

// Apply authentication to all routes
app.use('*', authenticate());

/**
 * GET /categories - List categories with advanced pagination, search, and filtering
 */
app.get('/', validateQuery(advancedPaginationSchema), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const auditService = c.get('auditService') as ComprehensiveAuditService;
    const cacheService = c.get('cacheService');
    const query = getValidatedQuery<z.infer<typeof advancedPaginationSchema>>(c);

    // Generate cache key
    const cacheKey = `categories:${authContext.tenant_id}:${JSON.stringify(query)}`;
    
    // Try cache first
    const cached = await cacheService?.get(cacheKey);
    if (cached) {
      return c.json(cached);
    }

    // Build the base query
    let dbQuery = db
      .select()
      .from(categories)
      .where(eq(categories.tenantId, authContext.tenant_id));

    // Use advanced pagination service
    const result = await PaginationService.paginate(
      dbQuery,
      categories,
      query,
      {
        fields: ['name', 'description'],
        operator: 'or',
      },
      ['name', 'sortOrder', 'createdAt', 'updatedAt'],
      'createdAt'
    );

    const response = createSuccessResponse({
      categories: result.data,
      pagination: result.pagination,
      meta: result.meta,
    });

    // Cache the response
    await cacheService?.set(cacheKey, response, { 
      ttl: 300, // 5 minutes
      tags: [`tenant:${authContext.tenant_id}`, 'categories'],
    });

    // Log audit event for data access
    await auditService?.logCrudOperation(
      'READ',
      authContext.tenant_id,
      authContext.user_id,
      'categories',
      'list',
      undefined,
      undefined,
      c.req.header('CF-Connecting-IP'),
      c.req.header('User-Agent')
    );

    return c.json(response);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return c.json(createErrorResponse(
      'Internal Server Error',
      'Failed to fetch categories',
      'FETCH_ERROR'
    ), 500);
  }
});

/**
 * GET /categories/:id - Get category by ID
 */
app.get('/:id', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const categoryId = c.req.param('id');

    const result = await db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.id, categoryId),
          eq(categories.tenantId, authContext.tenant_id)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return c.json(createErrorResponse(
        'Not Found',
        'Category not found',
        'CATEGORY_NOT_FOUND'
      ), 404);
    }

    return c.json(createSuccessResponse({
      category: result[0],
    }));
  } catch (error) {
    console.error('Error fetching category:', error);
    return c.json(createErrorResponse(
      'Internal Server Error',
      'Failed to fetch category',
      'FETCH_ERROR'
    ), 500);
  }
});

/**
 * POST /categories - Create new category with audit logging and webhooks
 */
app.post('/', validateBody(createCategorySchema), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const auditService = c.get('auditService') as ComprehensiveAuditService;
    const webhookService = c.get('webhookService');
    const cacheService = c.get('cacheService');
    const data = getValidatedBody<z.infer<typeof createCategorySchema>>(c);

    // Check if category name already exists for this tenant
    const existing = await db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.tenantId, authContext.tenant_id),
          eq(categories.name, data.name)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return c.json(createErrorResponse(
        'Conflict',
        'Category with this name already exists',
        'CATEGORY_EXISTS'
      ), 409);
    }

    // Validate parent category exists if provided
    if (data.parentId) {
      const parent = await db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.id, data.parentId),
            eq(categories.tenantId, authContext.tenant_id)
          )
        )
        .limit(1);

      if (parent.length === 0) {
        return c.json(createErrorResponse(
          'Bad Request',
          'Parent category not found',
          'PARENT_NOT_FOUND'
        ), 400);
      }
    }

    const newCategory: NewCategory = {
      id: crypto.randomUUID(),
      tenantId: authContext.tenant_id,
      name: data.name,
      description: data.description,
      parentId: data.parentId,
      sortOrder: data.sortOrder,
      active: data.active,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.insert(categories).values(newCategory);

    // Invalidate cache
    await cacheService?.invalidateByTags([`tenant:${authContext.tenant_id}`, 'categories']);

    // Log audit event
    await auditService?.logCrudOperation(
      'CREATE',
      authContext.tenant_id,
      authContext.user_id,
      'categories',
      newCategory.id,
      undefined,
      newCategory,
      c.req.header('CF-Connecting-IP'),
      c.req.header('User-Agent')
    );

    // Trigger webhook
    await webhookService?.triggerEvent(
      authContext.tenant_id,
      WebhookEvents.PRODUCT_CREATED, // Using product event as example
      {
        category: newCategory,
        createdBy: authContext.user_id,
      }
    );

    return c.json(createSuccessResponse({
      category: newCategory,
    }), 201);
  } catch (error) {
    console.error('Error creating category:', error);
    return c.json(createErrorResponse(
      'Internal Server Error',
      'Failed to create category',
      'CREATE_ERROR'
    ), 500);
  }
});

/**
 * PUT /categories/:id - Update category
 */
app.put('/:id', validateBody(updateCategorySchema), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const categoryId = c.req.param('id');
    const data = getValidatedBody<z.infer<typeof updateCategorySchema>>(c);

    // Check if category exists
    const existing = await db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.id, categoryId),
          eq(categories.tenantId, authContext.tenant_id)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return c.json(createErrorResponse(
        'Not Found',
        'Category not found',
        'CATEGORY_NOT_FOUND'
      ), 404);
    }

    // Check if new name conflicts with existing categories
    if (data.name && data.name !== existing[0].name) {
      const nameConflict = await db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.tenantId, authContext.tenant_id),
            eq(categories.name, data.name)
          )
        )
        .limit(1);

      if (nameConflict.length > 0) {
        return c.json(createErrorResponse(
          'Conflict',
          'Category with this name already exists',
          'CATEGORY_EXISTS'
        ), 409);
      }
    }

    // Validate parent category exists if provided
    if (data.parentId) {
      const parent = await db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.id, data.parentId),
            eq(categories.tenantId, authContext.tenant_id)
          )
        )
        .limit(1);

      if (parent.length === 0) {
        return c.json(createErrorResponse(
          'Bad Request',
          'Parent category not found',
          'PARENT_NOT_FOUND'
        ), 400);
      }

      // Prevent circular references
      if (data.parentId === categoryId) {
        return c.json(createErrorResponse(
          'Bad Request',
          'Category cannot be its own parent',
          'CIRCULAR_REFERENCE'
        ), 400);
      }
    }

    const updateData = {
      ...data,
      updatedAt: Date.now(),
    };

    await db
      .update(categories)
      .set(updateData)
      .where(
        and(
          eq(categories.id, categoryId),
          eq(categories.tenantId, authContext.tenant_id)
        )
      );

    // Fetch updated category
    const updated = await db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.id, categoryId),
          eq(categories.tenantId, authContext.tenant_id)
        )
      )
      .limit(1);

    return c.json(createSuccessResponse({
      category: updated[0],
    }));
  } catch (error) {
    console.error('Error updating category:', error);
    return c.json(createErrorResponse(
      'Internal Server Error',
      'Failed to update category',
      'UPDATE_ERROR'
    ), 500);
  }
});

/**
 * DELETE /categories/:id - Delete category
 */
app.delete('/:id', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const categoryId = c.req.param('id');

    // Check if category exists
    const existing = await db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.id, categoryId),
          eq(categories.tenantId, authContext.tenant_id)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return c.json(createErrorResponse(
        'Not Found',
        'Category not found',
        'CATEGORY_NOT_FOUND'
      ), 404);
    }

    // Check if category has child categories
    const children = await db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.parentId, categoryId),
          eq(categories.tenantId, authContext.tenant_id)
        )
      )
      .limit(1);

    if (children.length > 0) {
      return c.json(createErrorResponse(
        'Conflict',
        'Cannot delete category with child categories',
        'HAS_CHILDREN'
      ), 409);
    }

    // Soft delete by setting active to false
    await db
      .update(categories)
      .set({
        active: false,
        updatedAt: Date.now(),
      })
      .where(
        and(
          eq(categories.id, categoryId),
          eq(categories.tenantId, authContext.tenant_id)
        )
      );

    return c.json(createSuccessResponse({
      message: 'Category deleted successfully',
    }));
  } catch (error) {
    console.error('Error deleting category:', error);
    return c.json(createErrorResponse(
      'Internal Server Error',
      'Failed to delete category',
      'DELETE_ERROR'
    ), 500);
  }
});

/**
 * POST /categories/bulk-delete - Bulk delete categories
 */
app.post('/bulk-delete', validateBody(bulkDeleteSchema), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const auditService = c.get('auditService') as ComprehensiveAuditService;
    const cacheService = c.get('cacheService');
    const { ids } = getValidatedBody<z.infer<typeof bulkDeleteSchema>>(c);

    const result = await BulkOperationsService.bulkDelete(
      db,
      categories,
      {
        ids,
        tenantId: authContext.tenant_id,
        softDelete: true,
      },
      auditService
    );

    // Invalidate cache
    await cacheService?.invalidateByTags([`tenant:${authContext.tenant_id}`, 'categories']);

    return c.json(createSuccessResponse({
      message: `Bulk delete completed. Processed: ${result.processed}, Failed: ${result.failed}`,
      result,
    }));
  } catch (error) {
    console.error('Error bulk deleting categories:', error);
    return c.json(createErrorResponse(
      'Internal Server Error',
      'Failed to delete categories',
      'BULK_DELETE_ERROR'
    ), 500);
  }
});

/**
 * POST /categories/bulk-update - Bulk update categories
 */
app.post('/bulk-update', validateBody(bulkUpdateSchema), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const auditService = c.get('auditService') as ComprehensiveAuditService;
    const cacheService = c.get('cacheService');
    const { ids, updates } = getValidatedBody<z.infer<typeof bulkUpdateSchema>>(c);

    const result = await BulkOperationsService.bulkUpdate(
      db,
      categories,
      {
        ids,
        updates,
        tenantId: authContext.tenant_id,
      },
      updateCategorySchema.partial(),
      auditService
    );

    // Invalidate cache
    await cacheService?.invalidateByTags([`tenant:${authContext.tenant_id}`, 'categories']);

    return c.json(createSuccessResponse({
      message: `Bulk update completed. Processed: ${result.processed}, Failed: ${result.failed}`,
      result,
    }));
  } catch (error) {
    console.error('Error bulk updating categories:', error);
    return c.json(createErrorResponse(
      'Internal Server Error',
      'Failed to update categories',
      'BULK_UPDATE_ERROR'
    ), 500);
  }
});

/**
 * GET /categories/export - Export categories data
 */
app.get('/export', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const auditService = c.get('auditService') as ComprehensiveAuditService;
    
    const format = c.req.query('format') as 'csv' | 'json' | 'xlsx' | 'pdf' || 'json';
    const fields = c.req.query('fields')?.split(',');

    // Get all categories for export
    const data = await db
      .select()
      .from(categories)
      .where(eq(categories.tenantId, authContext.tenant_id))
      .orderBy(asc(categories.name));

    const exportResult = await DataExportService.exportData(
      data,
      {
        format,
        fields,
        filename: `categories_${authContext.tenant_id}_${Date.now()}`,
      }
    );

    if (!exportResult.success) {
      return c.json(createErrorResponse(
        'Export Error',
        exportResult.error || 'Failed to export data',
        'EXPORT_ERROR'
      ), 500);
    }

    // Log audit event
    await auditService?.logDataOperation(
      'EXPORT',
      authContext.tenant_id,
      authContext.user_id,
      'categories',
      {
        format,
        recordCount: exportResult.recordCount,
        fileSize: exportResult.size,
      },
      c.req.header('CF-Connecting-IP'),
      c.req.header('User-Agent')
    );

    // Set appropriate headers
    c.header('Content-Type', exportResult.mimeType);
    c.header('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
    c.header('Content-Length', exportResult.size.toString());

    return c.body(exportResult.data as string);
  } catch (error) {
    console.error('Error exporting categories:', error);
    return c.json(createErrorResponse(
      'Internal Server Error',
      'Failed to export categories',
      'EXPORT_ERROR'
    ), 500);
  }
});

/**
 * GET /categories/search - Full-text search categories
 */
app.get('/search', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const auditService = c.get('auditService') as ComprehensiveAuditService;
    
    const query = c.req.query('q');
    const fields = c.req.query('fields')?.split(',') || ['name', 'description'];
    const limit = parseInt(c.req.query('limit') || '50');

    if (!query) {
      return c.json(createErrorResponse(
        'Bad Request',
        'Search query is required',
        'MISSING_QUERY'
      ), 400);
    }

    const searchService = new FullTextSearchService(db);
    const searchResult = await searchService.search(
      categories,
      {
        query,
        fields,
        operator: 'or',
        maxResults: limit,
      },
      authContext.tenant_id
    );

    // Log audit event
    await auditService?.logCrudOperation(
      'READ',
      authContext.tenant_id,
      authContext.user_id,
      'categories',
      'search',
      undefined,
      { query, fields, results: searchResult.total },
      c.req.header('CF-Connecting-IP'),
      c.req.header('User-Agent')
    );

    return c.json(createSuccessResponse({
      search: searchResult,
    }));
  } catch (error) {
    console.error('Error searching categories:', error);
    return c.json(createErrorResponse(
      'Internal Server Error',
      'Failed to search categories',
      'SEARCH_ERROR'
    ), 500);
  }
});

export default app;