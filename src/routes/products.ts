import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { createProductService, IProductService, CreateProductRequest, UpdateProductRequest, ProductSearchFilters } from '../services/product';
import { createPurchaseOrderService, PurchaseOrderService, POLineItemRequest } from '../services/purchase-order';
import { authenticate, requireRole, injectTenantContext } from '../middleware/auth';
import { Env } from '../index';

type Variables = {
  user: {
    id: string;
    tenantId: string;
    role: string;
    locationId?: string;
  };
  productService: IProductService;
  purchaseOrderService: PurchaseOrderService;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Middleware to initialize services
app.use('*', authenticate());
app.use('*', injectTenantContext());
app.use('*', async (c, next) => {
  const db = drizzle(c.env.DB);
  c.set('productService', createProductService(db));
  c.set('purchaseOrderService', createPurchaseOrderService(db));
  await next();
});

// GET /products/search - Search products for PO line item selection
app.get('/products/search', async (c) => {
  try {
    const productService = c.get('productService');
    const user = c.get('user');
    
    const query = c.req.query('q') || '';
    const limit = parseInt(c.req.query('limit') || '20');
    
    if (!query.trim()) {
      return c.json({ products: [] });
    }
    
    const products = await productService.searchProducts(query, user.tenantId, limit);
    
    return c.json({ products });
  } catch (error) {
    console.error('Product search error:', error);
    return c.json({ 
      error: 'Search Failed', 
      message: error instanceof Error ? error.message : 'Failed to search products' 
    }, 500);
  }
});

// GET /products - List all products with optional filters
app.get('/products', async (c) => {
  try {
    const productService = c.get('productService');
    const user = c.get('user');
    
    const filters: ProductSearchFilters = {
      name: c.req.query('name') || undefined,
      category: c.req.query('category') || undefined,
      limit: parseInt(c.req.query('limit') || '50'),
      offset: parseInt(c.req.query('offset') || '0'),
    };
    
    const products = await productService.listProducts(user.tenantId, filters);
    
    return c.json({ products });
  } catch (error) {
    console.error('Product list error:', error);
    return c.json({ 
      error: 'List Failed', 
      message: error instanceof Error ? error.message : 'Failed to list products' 
    }, 500);
  }
});

// POST /products - Create a new product
app.post('/products', async (c) => {
  try {
    const productService = c.get('productService');
    const user = c.get('user');
    
    const data: CreateProductRequest = await c.req.json();
    
    const product = await productService.createProduct(data, user.tenantId);
    
    return c.json({ product }, 201);
  } catch (error) {
    console.error('Product creation error:', error);
    return c.json({ 
      error: 'Creation Failed', 
      message: error instanceof Error ? error.message : 'Failed to create product' 
    }, 400);
  }
});

// GET /products/:id - Get a specific product
app.get('/products/:id', async (c) => {
  try {
    const productService = c.get('productService');
    const user = c.get('user');
    const productId = c.req.param('id');
    
    const product = await productService.getProduct(productId, user.tenantId);
    
    if (!product) {
      return c.json({ error: 'Not Found', message: 'Product not found' }, 404);
    }
    
    return c.json({ product });
  } catch (error) {
    console.error('Product get error:', error);
    return c.json({ 
      error: 'Get Failed', 
      message: error instanceof Error ? error.message : 'Failed to get product' 
    }, 500);
  }
});

// PUT /products/:id - Update a product
app.put('/products/:id', async (c) => {
  try {
    const productService = c.get('productService');
    const user = c.get('user');
    const productId = c.req.param('id');
    
    const updates: UpdateProductRequest = await c.req.json();
    
    const product = await productService.updateProduct(productId, updates, user.tenantId);
    
    return c.json({ product });
  } catch (error) {
    console.error('Product update error:', error);
    return c.json({ 
      error: 'Update Failed', 
      message: error instanceof Error ? error.message : 'Failed to update product' 
    }, 400);
  }
});

// DELETE /products/:id - Delete a product
app.delete('/products/:id', async (c) => {
  try {
    const productService = c.get('productService');
    const user = c.get('user');
    const productId = c.req.param('id');
    
    await productService.deleteProduct(productId, user.tenantId);
    
    return c.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Product deletion error:', error);
    return c.json({ 
      error: 'Deletion Failed', 
      message: error instanceof Error ? error.message : 'Failed to delete product' 
    }, 400);
  }
});

// GET /products/:id/purchase-history - Get purchase history for a product
app.get('/products/:id/purchase-history', async (c) => {
  try {
    const productService = c.get('productService');
    const user = c.get('user');
    const productId = c.req.param('id');
    const limit = parseInt(c.req.query('limit') || '50');
    
    const history = await productService.getProductPurchaseHistory(productId, user.tenantId, limit);
    
    return c.json({ history });
  } catch (error) {
    console.error('Product purchase history error:', error);
    return c.json({ 
      error: 'History Failed', 
      message: error instanceof Error ? error.message : 'Failed to get purchase history' 
    }, 500);
  }
});

// POST /purchase-orders/:id/items/from-catalog - Add line item from product catalog
app.post('/purchase-orders/:id/items/from-catalog', async (c) => {
  try {
    const purchaseOrderService = c.get('purchaseOrderService');
    const productService = c.get('productService');
    const user = c.get('user');
    const poId = c.req.param('id');
    
    const { productId, quantityOrdered, unitPriceCents, notes } = await c.req.json();
    
    // Validate that the product exists in the catalog
    const productExists = await productService.validateProductExists(productId, user.tenantId);
    if (!productExists) {
      return c.json({ 
        error: 'Invalid Product', 
        message: 'Product not found in catalog' 
      }, 400);
    }
    
    const lineItemRequest: POLineItemRequest = {
      productId,
      quantityOrdered,
      unitPriceCents,
      notes,
    };
    
    const lineItem = await purchaseOrderService.addLineItem(poId, lineItemRequest, user.tenantId);
    
    return c.json({ lineItem }, 201);
  } catch (error) {
    console.error('Add line item from catalog error:', error);
    return c.json({ 
      error: 'Add Failed', 
      message: error instanceof Error ? error.message : 'Failed to add line item from catalog' 
    }, 400);
  }
});

export default app;