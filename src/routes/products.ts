import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and, desc, asc, gte, lte, like, or, inArray } from 'drizzle-orm';
import { 
  products, 
  productVariants,
  productRelationships,
  productTemplates,
  productAnalytics,
  categories,
  type Product, 
  type NewProduct,
  type ProductVariant,
  type ProductRelationship,
  type ProductTemplate,
  ProductStatus,
  ProductRelationshipType
} from '../db/schema';
import { authenticate, getAuthContext, getDatabase } from '../middleware/auth';
import { validateBody, validateQuery, getValidatedBody, getValidatedQuery } from '../middleware/error';
import { createSuccessResponse, createErrorResponse } from '../utils';
import { 
  createProductService, 
  IProductService, 
  CreateProductRequest, 
  UpdateProductRequest, 
  ProductSearchFilters,
  CreateVariantRequest,
  CreateRelationshipRequest,
  CreateTemplateRequest,
  BulkUpdateRequest,
  ImportProductData
} from '../services/product';
import { 
  createProductSchema, 
  updateProductSchema, 
  productQuerySchema,
  createProductVariantSchema,
  updateProductVariantSchema,
  createProductRelationshipSchema,
  createProductTemplateSchema,
  bulkUpdateProductsSchema,
  importProductsSchema,
  bulkDeleteSchema 
} from '../schemas/validation';

const app = new Hono();

// Apply authentication to all routes
app.use('*', authenticate());

/**
 * GET /products - List products with advanced filtering and pagination
 */
app.get('/', validateQuery(productQuerySchema), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const query = getValidatedQuery<z.infer<typeof productQuerySchema>>(c);

    const filters: ProductSearchFilters = {
      name: query.search,
      categoryId: query.categoryId,
      status: query.status as ProductStatus,
      tags: query.tags,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      minStock: query.minStock,
      maxStock: query.maxStock,
      hasVariants: query.hasVariants,
      active: query.active,
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
      sortBy: query.sortBy as any,
      sortOrder: query.sortOrder,
    };

    const result = await productService.listProducts(authContext.tenant_id, filters);

    return c.json(createSuccessResponse({
      products: result.products,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    }));
  } catch (error) {
    console.error('Error fetching products:', error);
    return c.json(createErrorResponse(
      'Internal Server Error',
      'Failed to fetch products',
      'FETCH_ERROR'
    ), 500);
  }
});

/**
 * GET /products/search - Search products for selection
 */
app.get('/search', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    
    const query = c.req.query('q') || '';
    const limit = parseInt(c.req.query('limit') || '20');
    
    if (!query.trim()) {
      return c.json(createSuccessResponse({ products: [] }));
    }
    
    const products = await productService.searchProducts(query, authContext.tenant_id, limit);
    
    return c.json(createSuccessResponse({ products }));
  } catch (error) {
    console.error('Product search error:', error);
    return c.json(createErrorResponse(
      'Search Failed',
      error instanceof Error ? error.message : 'Failed to search products',
      'SEARCH_ERROR'
    ), 500);
  }
});

/**
 * GET /products/low-stock - Get low stock products
 */
app.get('/low-stock', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    
    const threshold = parseInt(c.req.query('threshold') || '0');
    
    const products = await productService.getLowStockProducts(authContext.tenant_id, threshold || undefined);
    
    return c.json(createSuccessResponse({ 
      products,
      threshold: threshold || 'reorder_point'
    }));
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    return c.json(createErrorResponse(
      'Internal Server Error',
      'Failed to fetch low stock products',
      'FETCH_ERROR'
    ), 500);
  }
});

/**
 * GET /products/top - Get top products by metric
 */
app.get('/top', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    
    const metric = c.req.query('metric') as 'ordered' | 'cost' | 'frequency' || 'ordered';
    const limit = parseInt(c.req.query('limit') || '10');
    
    const products = await productService.getTopProducts(authContext.tenant_id, metric, limit);
    
    return c.json(createSuccessResponse({ 
      products,
      metric,
      limit
    }));
  } catch (error) {
    console.error('Error fetching top products:', error);
    return c.json(createErrorResponse(
      'Internal Server Error',
      'Failed to fetch top products',
      'FETCH_ERROR'
    ), 500);
  }
});

/**
 * POST /products - Create new product
 */
app.post('/', validateBody(createProductSchema), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const data = getValidatedBody<z.infer<typeof createProductSchema>>(c);

    const product = await productService.createProduct(data, authContext.tenant_id, authContext.user_id);

    return c.json(createSuccessResponse({ product }), 201);
  } catch (error) {
    console.error('Error creating product:', error);
    return c.json(createErrorResponse(
      'Creation Failed',
      error instanceof Error ? error.message : 'Failed to create product',
      'CREATE_ERROR'
    ), 400);
  }
});

/**
 * POST /products/bulk-update - Bulk update products
 */
app.post('/bulk-update', validateBody(bulkUpdateProductsSchema), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const data = getValidatedBody<z.infer<typeof bulkUpdateProductsSchema>>(c);

    const products = await productService.bulkUpdateProducts(data, authContext.tenant_id, authContext.user_id);

    return c.json(createSuccessResponse({ 
      products,
      updated: products.length
    }));
  } catch (error) {
    console.error('Error bulk updating products:', error);
    return c.json(createErrorResponse(
      'Bulk Update Failed',
      error instanceof Error ? error.message : 'Failed to bulk update products',
      'BULK_UPDATE_ERROR'
    ), 400);
  }
});

/**
 * POST /products/import - Import products from CSV/JSON
 */
app.post('/import', validateBody(importProductsSchema), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const data = getValidatedBody<ImportProductData[]>(c);

    const result = await productService.importProducts(data, authContext.tenant_id, authContext.user_id);

    return c.json(createSuccessResponse({
      created: result.created,
      errors: result.errors,
      total: data.length
    }));
  } catch (error) {
    console.error('Error importing products:', error);
    return c.json(createErrorResponse(
      'Import Failed',
      error instanceof Error ? error.message : 'Failed to import products',
      'IMPORT_ERROR'
    ), 400);
  }
});

/**
 * GET /products/export - Export products
 */
app.get('/export', validateQuery(productQuerySchema), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const query = getValidatedQuery<z.infer<typeof productQuerySchema>>(c);

    const filters: ProductSearchFilters = {
      name: query.search,
      categoryId: query.categoryId,
      status: query.status as ProductStatus,
      active: query.active,
    };

    const products = await productService.exportProducts(authContext.tenant_id, filters);

    return c.json(createSuccessResponse({ products }));
  } catch (error) {
    console.error('Error exporting products:', error);
    return c.json(createErrorResponse(
      'Export Failed',
      'Failed to export products',
      'EXPORT_ERROR'
    ), 500);
  }
});

/**
 * GET /products/:id - Get product by ID with full details
 */
app.get('/:id', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const productId = c.req.param('id');

    const product = await productService.getProduct(productId, authContext.tenant_id);

    if (!product) {
      return c.json(createErrorResponse(
        'Not Found',
        'Product not found',
        'PRODUCT_NOT_FOUND'
      ), 404);
    }

    return c.json(createSuccessResponse({ product }));
  } catch (error) {
    console.error('Error fetching product:', error);
    return c.json(createErrorResponse(
      'Internal Server Error',
      'Failed to fetch product',
      'FETCH_ERROR'
    ), 500);
  }
});

/**
 * PUT /products/:id - Update product
 */
app.put('/:id', validateBody(updateProductSchema), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const productId = c.req.param('id');
    const data = getValidatedBody<z.infer<typeof updateProductSchema>>(c);

    const product = await productService.updateProduct(productId, data, authContext.tenant_id, authContext.user_id);

    return c.json(createSuccessResponse({ product }));
  } catch (error) {
    console.error('Error updating product:', error);
    return c.json(createErrorResponse(
      'Update Failed',
      error instanceof Error ? error.message : 'Failed to update product',
      'UPDATE_ERROR'
    ), 400);
  }
});

/**
 * POST /products/:id/duplicate - Duplicate product
 */
app.post('/:id/duplicate', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const productId = c.req.param('id');
    const { name } = await c.req.json().catch(() => ({}));

    const product = await productService.duplicateProduct(productId, authContext.tenant_id, authContext.user_id, name);

    return c.json(createSuccessResponse({ product }), 201);
  } catch (error) {
    console.error('Error duplicating product:', error);
    return c.json(createErrorResponse(
      'Duplication Failed',
      error instanceof Error ? error.message : 'Failed to duplicate product',
      'DUPLICATE_ERROR'
    ), 400);
  }
});

/**
 * POST /products/:id/archive - Archive product
 */
app.post('/:id/archive', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const productId = c.req.param('id');

    const product = await productService.archiveProduct(productId, authContext.tenant_id, authContext.user_id);

    return c.json(createSuccessResponse({ product }));
  } catch (error) {
    console.error('Error archiving product:', error);
    return c.json(createErrorResponse(
      'Archive Failed',
      error instanceof Error ? error.message : 'Failed to archive product',
      'ARCHIVE_ERROR'
    ), 400);
  }
});

/**
 * POST /products/:id/restore - Restore archived product
 */
app.post('/:id/restore', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const productId = c.req.param('id');

    const product = await productService.restoreProduct(productId, authContext.tenant_id, authContext.user_id);

    return c.json(createSuccessResponse({ product }));
  } catch (error) {
    console.error('Error restoring product:', error);
    return c.json(createErrorResponse(
      'Restore Failed',
      error instanceof Error ? error.message : 'Failed to restore product',
      'RESTORE_ERROR'
    ), 400);
  }
});

/**
 * DELETE /products/:id - Delete product
 */
app.delete('/:id', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const productId = c.req.param('id');

    await productService.deleteProduct(productId, authContext.tenant_id, authContext.user_id);

    return c.json(createSuccessResponse({
      message: 'Product deleted successfully',
    }));
  } catch (error) {
    console.error('Error deleting product:', error);
    return c.json(createErrorResponse(
      'Deletion Failed',
      error instanceof Error ? error.message : 'Failed to delete product',
      'DELETE_ERROR'
    ), 400);
  }
});

/**
 * GET /products/:id/analytics - Get product analytics
 */
app.get('/:id/analytics', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const productId = c.req.param('id');
    const days = parseInt(c.req.query('days') || '30');

    const analytics = await productService.getProductAnalytics(productId, authContext.tenant_id, days);

    return c.json(createSuccessResponse({ analytics }));
  } catch (error) {
    console.error('Error fetching product analytics:', error);
    return c.json(createErrorResponse(
      'Analytics Failed',
      error instanceof Error ? error.message : 'Failed to fetch product analytics',
      'ANALYTICS_ERROR'
    ), 500);
  }
});

/**
 * GET /products/:id/purchase-history - Get product purchase history
 */
app.get('/:id/purchase-history', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const productId = c.req.param('id');
    const limit = parseInt(c.req.query('limit') || '50');

    const history = await productService.getProductPurchaseHistory(productId, authContext.tenant_id, limit);

    return c.json(createSuccessResponse({ history }));
  } catch (error) {
    console.error('Error fetching product purchase history:', error);
    return c.json(createErrorResponse(
      'History Failed',
      error instanceof Error ? error.message : 'Failed to fetch purchase history',
      'HISTORY_ERROR'
    ), 500);
  }
});

// Product Variants Routes

/**
 * GET /products/:id/variants - Get product variants
 */
app.get('/:id/variants', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const productId = c.req.param('id');

    const variants = await productService.getVariants(productId, authContext.tenant_id);

    return c.json(createSuccessResponse({ variants }));
  } catch (error) {
    console.error('Error fetching product variants:', error);
    return c.json(createErrorResponse(
      'Fetch Failed',
      'Failed to fetch product variants',
      'FETCH_ERROR'
    ), 500);
  }
});

/**
 * POST /products/:id/variants - Create product variant
 */
app.post('/:id/variants', validateBody(createProductVariantSchema), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const productId = c.req.param('id');
    const data = getValidatedBody<z.infer<typeof createProductVariantSchema>>(c);

    const variant = await productService.createVariant(productId, data, authContext.tenant_id);

    return c.json(createSuccessResponse({ variant }), 201);
  } catch (error) {
    console.error('Error creating product variant:', error);
    return c.json(createErrorResponse(
      'Creation Failed',
      error instanceof Error ? error.message : 'Failed to create variant',
      'CREATE_ERROR'
    ), 400);
  }
});

/**
 * PUT /products/:id/variants/:variantId - Update product variant
 */
app.put('/:id/variants/:variantId', validateBody(updateProductVariantSchema), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const variantId = c.req.param('variantId');
    const data = getValidatedBody<z.infer<typeof updateProductVariantSchema>>(c);

    const variant = await productService.updateVariant(variantId, data, authContext.tenant_id);

    return c.json(createSuccessResponse({ variant }));
  } catch (error) {
    console.error('Error updating product variant:', error);
    return c.json(createErrorResponse(
      'Update Failed',
      error instanceof Error ? error.message : 'Failed to update variant',
      'UPDATE_ERROR'
    ), 400);
  }
});

/**
 * DELETE /products/:id/variants/:variantId - Delete product variant
 */
app.delete('/:id/variants/:variantId', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const variantId = c.req.param('variantId');

    await productService.deleteVariant(variantId, authContext.tenant_id);

    return c.json(createSuccessResponse({
      message: 'Variant deleted successfully',
    }));
  } catch (error) {
    console.error('Error deleting product variant:', error);
    return c.json(createErrorResponse(
      'Deletion Failed',
      error instanceof Error ? error.message : 'Failed to delete variant',
      'DELETE_ERROR'
    ), 400);
  }
});

// Product Relationships Routes

/**
 * GET /products/:id/relationships - Get product relationships
 */
app.get('/:id/relationships', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const productId = c.req.param('id');

    const relationships = await productService.getRelationships(productId, authContext.tenant_id);

    return c.json(createSuccessResponse({ relationships }));
  } catch (error) {
    console.error('Error fetching product relationships:', error);
    return c.json(createErrorResponse(
      'Fetch Failed',
      'Failed to fetch product relationships',
      'FETCH_ERROR'
    ), 500);
  }
});

/**
 * POST /products/:id/relationships - Create product relationship
 */
app.post('/:id/relationships', validateBody(createProductRelationshipSchema), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const productId = c.req.param('id');
    const data = getValidatedBody<z.infer<typeof createProductRelationshipSchema>>(c);

    const relationship = await productService.createRelationship(productId, data, authContext.tenant_id);

    return c.json(createSuccessResponse({ relationship }), 201);
  } catch (error) {
    console.error('Error creating product relationship:', error);
    return c.json(createErrorResponse(
      'Creation Failed',
      error instanceof Error ? error.message : 'Failed to create relationship',
      'CREATE_ERROR'
    ), 400);
  }
});

/**
 * DELETE /products/:id/relationships/:relationshipId - Delete product relationship
 */
app.delete('/:id/relationships/:relationshipId', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const relationshipId = c.req.param('relationshipId');

    await productService.deleteRelationship(relationshipId, authContext.tenant_id);

    return c.json(createSuccessResponse({
      message: 'Relationship deleted successfully',
    }));
  } catch (error) {
    console.error('Error deleting product relationship:', error);
    return c.json(createErrorResponse(
      'Deletion Failed',
      error instanceof Error ? error.message : 'Failed to delete relationship',
      'DELETE_ERROR'
    ), 400);
  }
});

// Product Templates Routes

/**
 * GET /templates - Get product templates
 */
app.get('/templates', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);

    const templates = await productService.getTemplates(authContext.tenant_id);

    return c.json(createSuccessResponse({ templates }));
  } catch (error) {
    console.error('Error fetching product templates:', error);
    return c.json(createErrorResponse(
      'Fetch Failed',
      'Failed to fetch product templates',
      'FETCH_ERROR'
    ), 500);
  }
});

/**
 * POST /templates - Create product template
 */
app.post('/templates', validateBody(createProductTemplateSchema), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const data = getValidatedBody<z.infer<typeof createProductTemplateSchema>>(c);

    const template = await productService.createTemplate(data, authContext.tenant_id, authContext.user_id);

    return c.json(createSuccessResponse({ template }), 201);
  } catch (error) {
    console.error('Error creating product template:', error);
    return c.json(createErrorResponse(
      'Creation Failed',
      error instanceof Error ? error.message : 'Failed to create template',
      'CREATE_ERROR'
    ), 400);
  }
});

/**
 * POST /templates/:id/create-product - Create product from template
 */
app.post('/templates/:id/create-product', validateBody(createProductSchema.partial()), async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const templateId = c.req.param('id');
    const overrides = getValidatedBody<Partial<CreateProductRequest>>(c);

    const product = await productService.createFromTemplate(templateId, overrides, authContext.tenant_id, authContext.user_id);

    return c.json(createSuccessResponse({ product }), 201);
  } catch (error) {
    console.error('Error creating product from template:', error);
    return c.json(createErrorResponse(
      'Creation Failed',
      error instanceof Error ? error.message : 'Failed to create product from template',
      'CREATE_ERROR'
    ), 400);
  }
});

/**
 * DELETE /templates/:id - Delete product template
 */
app.delete('/templates/:id', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const templateId = c.req.param('id');

    await productService.deleteTemplate(templateId, authContext.tenant_id);

    return c.json(createSuccessResponse({
      message: 'Template deleted successfully',
    }));
  } catch (error) {
    console.error('Error deleting product template:', error);
    return c.json(createErrorResponse(
      'Deletion Failed',
      error instanceof Error ? error.message : 'Failed to delete template',
      'DELETE_ERROR'
    ), 400);
  }
});

// Utility Routes

/**
 * GET /generate-sku - Generate unique SKU
 */
app.get('/generate-sku', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);
    const categoryId = c.req.query('categoryId');

    const sku = await productService.generateSKU(authContext.tenant_id, categoryId || undefined);

    return c.json(createSuccessResponse({ sku }));
  } catch (error) {
    console.error('Error generating SKU:', error);
    return c.json(createErrorResponse(
      'Generation Failed',
      'Failed to generate SKU',
      'GENERATION_ERROR'
    ), 500);
  }
});

/**
 * GET /generate-barcode - Generate unique barcode
 */
app.get('/generate-barcode', async (c) => {
  try {
    const authContext = getAuthContext(c);
    const db = getDatabase(c);
    const productService = createProductService(db);

    const barcode = await productService.generateBarcode(authContext.tenant_id);

    return c.json(createSuccessResponse({ barcode }));
  } catch (error) {
    console.error('Error generating barcode:', error);
    return c.json(createErrorResponse(
      'Generation Failed',
      'Failed to generate barcode',
      'GENERATION_ERROR'
    ), 500);
  }
});

export default app;