import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, like, desc, sql, asc, inArray, or, gte, lte, isNull } from 'drizzle-orm';
import { 
  products, 
  productVariants,
  productRelationships,
  productTemplates,
  productAuditLog,
  productAnalytics,
  categories,
  poItems,
  purchaseOrders,
  priceHistory,
  suppliers,
  inventoryItems,
  locations,
  users,
  Product, 
  NewProduct,
  ProductVariant,
  NewProductVariant,
  ProductRelationship,
  NewProductRelationship,
  ProductTemplate,
  NewProductTemplate,
  ProductAuditLog,
  NewProductAuditLog,
  ProductAnalytics,
  NewProductAnalytics,
  POStatusType,
  POStatus,
  ProductStatus,
  ProductStatusType,
  ProductRelationshipType,
  ProductAuditActionType
} from '../db/schema';
import { generateId, getCurrentTimestamp } from '../utils';

// Enhanced product interfaces
export interface CreateProductRequest {
  name: string;
  description?: string;
  categoryId?: string;
  unit: string;
  price?: number;
  sku?: string;
  barcode?: string;
  imageUrl?: string;
  status?: ProductStatus;
  minStock?: number;
  maxStock?: number;
  reorderPoint?: number;
  costCents?: number;
  weight?: number;
  dimensions?: { length?: number; width?: number; height?: number };
  allergens?: string[];
  certifications?: string[];
  seasonalAvailability?: { 
    startMonth?: number; 
    endMonth?: number; 
    notes?: string; 
  };
  tags?: string[];
  notes?: string;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  categoryId?: string;
  unit?: string;
  price?: number;
  sku?: string;
  barcode?: string;
  imageUrl?: string;
  status?: ProductStatus;
  minStock?: number;
  maxStock?: number;
  reorderPoint?: number;
  costCents?: number;
  weight?: number;
  dimensions?: { length?: number; width?: number; height?: number };
  allergens?: string[];
  certifications?: string[];
  seasonalAvailability?: { 
    startMonth?: number; 
    endMonth?: number; 
    notes?: string; 
  };
  tags?: string[];
  notes?: string;
  active?: boolean;
}

export interface ProductSearchFilters {
  name?: string;
  categoryId?: string;
  status?: ProductStatus;
  tags?: string[];
  minPrice?: number;
  maxPrice?: number;
  minStock?: number;
  maxStock?: number;
  hasVariants?: boolean;
  active?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'price' | 'createdAt' | 'updatedAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface ProductWithDetails extends Product {
  category?: { id: string; name: string };
  variants?: ProductVariant[];
  relationships?: (ProductRelationship & { relatedProduct: Product })[];
  inventoryItems?: { locationId: string; quantity: number; location: { name: string } }[];
  analytics?: ProductAnalytics;
}

export interface CreateVariantRequest {
  name: string;
  sku?: string;
  barcode?: string;
  price?: number;
  costCents?: number;
  attributes?: Record<string, any>;
}

export interface CreateRelationshipRequest {
  relatedProductId: string;
  relationshipType: keyof typeof ProductRelationshipType;
  strength?: number;
  notes?: string;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  categoryId?: string;
  templateData: Partial<CreateProductRequest>;
}

export interface ProductPurchaseHistoryEntry {
  poId: string;
  poNumber: string | null;
  supplierName: string;
  quantityOrdered: number;
  unitPriceCents: number;
  lineTotalCents: number;
  orderDate: Date;
  status: POStatusType;
}

export interface ProductAnalyticsData {
  totalOrdered: number;
  totalReceived: number;
  totalCostCents: number;
  avgUnitCostCents: number;
  orderCount: number;
  supplierCount: number;
  locationCount: number;
  trends: { date: string; ordered: number; cost: number }[];
}

export interface BulkUpdateRequest {
  productIds: string[];
  updates: Partial<UpdateProductRequest>;
}

export interface ImportProductData {
  name: string;
  description?: string;
  categoryName?: string;
  unit: string;
  price?: number;
  sku?: string;
  barcode?: string;
  minStock?: number;
  maxStock?: number;
  reorderPoint?: number;
  costCents?: number;
  tags?: string;
  notes?: string;
}

export interface IProductService {
  // Basic CRUD
  createProduct(data: CreateProductRequest, tenantId: string, userId: string): Promise<Product>;
  getProduct(productId: string, tenantId: string): Promise<ProductWithDetails | null>;
  listProducts(tenantId: string, filters?: ProductSearchFilters): Promise<{ products: ProductWithDetails[]; total: number }>;
  updateProduct(productId: string, updates: UpdateProductRequest, tenantId: string, userId: string): Promise<Product>;
  deleteProduct(productId: string, tenantId: string, userId: string): Promise<void>;
  searchProducts(query: string, tenantId: string, limit?: number): Promise<Product[]>;
  
  // Advanced features
  duplicateProduct(productId: string, tenantId: string, userId: string, newName?: string): Promise<Product>;
  bulkUpdateProducts(request: BulkUpdateRequest, tenantId: string, userId: string): Promise<Product[]>;
  archiveProduct(productId: string, tenantId: string, userId: string): Promise<Product>;
  restoreProduct(productId: string, tenantId: string, userId: string): Promise<Product>;
  
  // Variants
  createVariant(productId: string, data: CreateVariantRequest, tenantId: string): Promise<ProductVariant>;
  getVariants(productId: string, tenantId: string): Promise<ProductVariant[]>;
  updateVariant(variantId: string, updates: Partial<CreateVariantRequest>, tenantId: string): Promise<ProductVariant>;
  deleteVariant(variantId: string, tenantId: string): Promise<void>;
  
  // Relationships
  createRelationship(productId: string, data: CreateRelationshipRequest, tenantId: string): Promise<ProductRelationship>;
  getRelationships(productId: string, tenantId: string): Promise<(ProductRelationship & { relatedProduct: Product })[]>;
  deleteRelationship(relationshipId: string, tenantId: string): Promise<void>;
  
  // Templates
  createTemplate(data: CreateTemplateRequest, tenantId: string, userId: string): Promise<ProductTemplate>;
  getTemplates(tenantId: string): Promise<ProductTemplate[]>;
  createFromTemplate(templateId: string, overrides: Partial<CreateProductRequest>, tenantId: string, userId: string): Promise<Product>;
  deleteTemplate(templateId: string, tenantId: string): Promise<void>;
  
  // Analytics and reporting
  getProductAnalytics(productId: string, tenantId: string, days?: number): Promise<ProductAnalyticsData>;
  getProductPurchaseHistory(productId: string, tenantId: string, limit?: number): Promise<ProductPurchaseHistoryEntry[]>;
  getLowStockProducts(tenantId: string, threshold?: number): Promise<ProductWithDetails[]>;
  getTopProducts(tenantId: string, metric: 'ordered' | 'cost' | 'frequency', limit?: number): Promise<ProductWithDetails[]>;
  
  // Import/Export
  importProducts(data: ImportProductData[], tenantId: string, userId: string): Promise<{ created: number; errors: string[] }>;
  exportProducts(tenantId: string, filters?: ProductSearchFilters): Promise<any[]>;
  
  // Barcode and SKU generation
  generateSKU(tenantId: string, categoryId?: string): Promise<string>;
  generateBarcode(tenantId: string): Promise<string>;
  
  // Validation
  validateProductExists(productId: string, tenantId: string): Promise<boolean>;
  validateSKU(sku: string, tenantId: string, excludeProductId?: string): Promise<boolean>;
  validateBarcode(barcode: string, tenantId: string, excludeProductId?: string): Promise<boolean>;
}

export class ProductService implements IProductService {
  constructor(private db: DrizzleD1Database) {}

  private async logAudit(
    productId: string,
    action: keyof typeof ProductAuditActionType,
    tenantId: string,
    userId: string,
    oldValues?: any,
    newValues?: any,
    notes?: string
  ) {
    const auditEntry: NewProductAuditLog = {
      id: `audit_${generateId()}`,
      tenantId,
      productId,
      action,
      oldValues: oldValues ? JSON.stringify(oldValues) : null,
      newValues: newValues ? JSON.stringify(newValues) : null,
      performedBy: userId,
      performedAt: getCurrentTimestamp(),
      notes: notes || null,
      ipAddress: null, // Could be passed from request context
      userAgent: null, // Could be passed from request context
    };

    await this.db.insert(productAuditLog).values(auditEntry);
  }

  async createProduct(data: CreateProductRequest, tenantId: string, userId: string): Promise<Product> {
    const now = getCurrentTimestamp();
    
    // Validate required fields
    if (!data.name?.trim()) {
      throw new Error('Product name is required');
    }
    
    if (!data.unit?.trim()) {
      throw new Error('Product unit is required');
    }

    // Check for duplicate product name within tenant
    const [existingProduct] = await this.db
      .select()
      .from(products)
      .where(and(
        eq(products.tenantId, tenantId),
        eq(products.name, data.name.trim())
      ))
      .limit(1);

    if (existingProduct) {
      throw new Error('Product with this name already exists in your organization');
    }

    // Validate SKU uniqueness if provided
    if (data.sku) {
      const isValidSKU = await this.validateSKU(data.sku, tenantId);
      if (!isValidSKU) {
        throw new Error('SKU already exists in your organization');
      }
    }

    // Validate barcode uniqueness if provided
    if (data.barcode) {
      const isValidBarcode = await this.validateBarcode(data.barcode, tenantId);
      if (!isValidBarcode) {
        throw new Error('Barcode already exists in your organization');
      }
    }

    // Generate SKU if not provided
    const sku = data.sku || await this.generateSKU(tenantId, data.categoryId);

    const newProduct: NewProduct = {
      id: `prod_${generateId()}`,
      tenantId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      categoryId: data.categoryId || null,
      unit: data.unit.trim(),
      price: data.price || 0,
      sku,
      barcode: data.barcode || null,
      imageUrl: data.imageUrl || null,
      status: data.status || ProductStatusType.ACTIVE,
      minStock: data.minStock || 0,
      maxStock: data.maxStock || 0,
      reorderPoint: data.reorderPoint || 0,
      costCents: data.costCents || 0,
      marginPercent: data.price && data.costCents ? ((data.price - data.costCents) / data.price) * 100 : 0,
      weight: data.weight || null,
      dimensions: data.dimensions ? JSON.stringify(data.dimensions) : null,
      allergens: data.allergens ? JSON.stringify(data.allergens) : null,
      certifications: data.certifications ? JSON.stringify(data.certifications) : null,
      seasonalAvailability: data.seasonalAvailability ? JSON.stringify(data.seasonalAvailability) : null,
      tags: data.tags ? JSON.stringify(data.tags) : null,
      notes: data.notes || null,
      createdBy: userId,
      updatedBy: userId,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    const [createdProduct] = await this.db
      .insert(products)
      .values(newProduct)
      .returning();

    // Log audit
    await this.logAudit(createdProduct.id, 'CREATED', tenantId, userId, null, newProduct);

    return createdProduct;
  }

  async getProduct(productId: string, tenantId: string): Promise<ProductWithDetails | null> {
    const [product] = await this.db
      .select({
        id: products.id,
        tenantId: products.tenantId,
        name: products.name,
        description: products.description,
        categoryId: products.categoryId,
        unit: products.unit,
        price: products.price,
        sku: products.sku,
        barcode: products.barcode,
        imageUrl: products.imageUrl,
        status: products.status,
        minStock: products.minStock,
        maxStock: products.maxStock,
        reorderPoint: products.reorderPoint,
        costCents: products.costCents,
        marginPercent: products.marginPercent,
        weight: products.weight,
        dimensions: products.dimensions,
        allergens: products.allergens,
        certifications: products.certifications,
        seasonalAvailability: products.seasonalAvailability,
        tags: products.tags,
        notes: products.notes,
        createdBy: products.createdBy,
        updatedBy: products.updatedBy,
        active: products.active,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        category: {
          id: categories.id,
          name: categories.name,
        },
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(
        and(
          eq(products.id, productId),
          eq(products.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!product) return null;

    // Get variants
    const variants = await this.getVariants(productId, tenantId);

    // Get relationships
    const relationships = await this.getRelationships(productId, tenantId);

    // Get inventory items
    const inventoryData = await this.db
      .select({
        locationId: inventoryItems.locationId,
        quantity: inventoryItems.quantity,
        location: {
          name: locations.name,
        },
      })
      .from(inventoryItems)
      .leftJoin(locations, eq(inventoryItems.locationId, locations.id))
      .where(
        and(
          eq(inventoryItems.productId, productId),
          eq(inventoryItems.tenantId, tenantId)
        )
      );

    // Get latest analytics
    const [analytics] = await this.db
      .select()
      .from(productAnalytics)
      .where(
        and(
          eq(productAnalytics.productId, productId),
          eq(productAnalytics.tenantId, tenantId)
        )
      )
      .orderBy(desc(productAnalytics.dateBucket))
      .limit(1);

    return {
      ...product,
      variants,
      relationships,
      inventoryItems: inventoryData,
      analytics: analytics || undefined,
    };
  }

  async listProducts(tenantId: string, filters: ProductSearchFilters = {}): Promise<{ products: ProductWithDetails[]; total: number }> {
    const { 
      name, 
      categoryId, 
      status, 
      tags, 
      minPrice, 
      maxPrice, 
      minStock, 
      maxStock, 
      hasVariants, 
      active, 
      limit = 50, 
      offset = 0,
      sortBy = 'name',
      sortOrder = 'asc'
    } = filters;
    
    let query = this.db
      .select({
        id: products.id,
        tenantId: products.tenantId,
        name: products.name,
        description: products.description,
        categoryId: products.categoryId,
        unit: products.unit,
        price: products.price,
        sku: products.sku,
        barcode: products.barcode,
        imageUrl: products.imageUrl,
        status: products.status,
        minStock: products.minStock,
        maxStock: products.maxStock,
        reorderPoint: products.reorderPoint,
        costCents: products.costCents,
        marginPercent: products.marginPercent,
        weight: products.weight,
        dimensions: products.dimensions,
        allergens: products.allergens,
        certifications: products.certifications,
        seasonalAvailability: products.seasonalAvailability,
        tags: products.tags,
        notes: products.notes,
        createdBy: products.createdBy,
        updatedBy: products.updatedBy,
        active: products.active,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        category: {
          id: categories.id,
          name: categories.name,
        },
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id));

    // Build conditions
    const conditions = [eq(products.tenantId, tenantId)];
    
    if (name) {
      conditions.push(like(products.name, `%${name}%`));
    }
    
    if (categoryId) {
      conditions.push(eq(products.categoryId, categoryId));
    }

    if (status) {
      conditions.push(eq(products.status, status));
    }

    if (active !== undefined) {
      conditions.push(eq(products.active, active));
    }

    if (minPrice !== undefined) {
      conditions.push(gte(products.price, minPrice));
    }

    if (maxPrice !== undefined) {
      conditions.push(lte(products.price, maxPrice));
    }

    if (tags && tags.length > 0) {
      // This is a simplified tag search - in production you might want more sophisticated JSON querying
      const tagConditions = tags.map(tag => like(products.tags, `%"${tag}"%`));
      conditions.push(or(...tagConditions));
    }

    if (conditions.length > 1) {
      query = query.where(and(...conditions));
    } else {
      query = query.where(conditions[0]);
    }

    // Apply sorting
    const sortField = sortBy === 'price' ? products.price : 
                     sortBy === 'createdAt' ? products.createdAt :
                     sortBy === 'updatedAt' ? products.updatedAt :
                     sortBy === 'status' ? products.status :
                     products.name;
    
    query = query.orderBy(
      sortOrder === 'asc' ? asc(sortField) : desc(sortField)
    );

    // Get total count
    const totalQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0]);

    const [{ count: total }] = await totalQuery;

    // Apply pagination
    const results = await query.limit(limit).offset(offset);

    // For each product, get additional details if needed
    const productsWithDetails: ProductWithDetails[] = await Promise.all(
      results.map(async (product) => {
        const variants = hasVariants ? await this.getVariants(product.id, tenantId) : [];
        return {
          ...product,
          variants,
        };
      })
    );

    return { products: productsWithDetails, total };
  }

  async updateProduct(productId: string, updates: UpdateProductRequest, tenantId: string, userId: string): Promise<Product> {
    // Get existing product for audit log
    const existingProduct = await this.getProduct(productId, tenantId);
    if (!existingProduct) {
      throw new Error('Product not found in this organization');
    }

    // Check for duplicate name if name is being updated
    if (updates.name && updates.name.trim() !== existingProduct.name) {
      const [duplicateProduct] = await this.db
        .select()
        .from(products)
        .where(and(
          eq(products.tenantId, tenantId),
          eq(products.name, updates.name.trim())
        ))
        .limit(1);

      if (duplicateProduct) {
        throw new Error('Product with this name already exists in your organization');
      }
    }

    // Validate SKU uniqueness if being updated
    if (updates.sku && updates.sku !== existingProduct.sku) {
      const isValidSKU = await this.validateSKU(updates.sku, tenantId, productId);
      if (!isValidSKU) {
        throw new Error('SKU already exists in your organization');
      }
    }

    // Validate barcode uniqueness if being updated
    if (updates.barcode && updates.barcode !== existingProduct.barcode) {
      const isValidBarcode = await this.validateBarcode(updates.barcode, tenantId, productId);
      if (!isValidBarcode) {
        throw new Error('Barcode already exists in your organization');
      }
    }

    const updateData: Partial<NewProduct> = {
      updatedAt: getCurrentTimestamp(),
      updatedBy: userId,
    };

    if (updates.name !== undefined) {
      updateData.name = updates.name.trim();
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description?.trim() || null;
    }
    if (updates.categoryId !== undefined) {
      updateData.categoryId = updates.categoryId || null;
    }
    if (updates.unit !== undefined) {
      updateData.unit = updates.unit.trim();
    }
    if (updates.price !== undefined) {
      updateData.price = updates.price;
    }
    if (updates.sku !== undefined) {
      updateData.sku = updates.sku;
    }
    if (updates.barcode !== undefined) {
      updateData.barcode = updates.barcode;
    }
    if (updates.imageUrl !== undefined) {
      updateData.imageUrl = updates.imageUrl;
    }
    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }
    if (updates.minStock !== undefined) {
      updateData.minStock = updates.minStock;
    }
    if (updates.maxStock !== undefined) {
      updateData.maxStock = updates.maxStock;
    }
    if (updates.reorderPoint !== undefined) {
      updateData.reorderPoint = updates.reorderPoint;
    }
    if (updates.costCents !== undefined) {
      updateData.costCents = updates.costCents;
    }
    if (updates.weight !== undefined) {
      updateData.weight = updates.weight;
    }
    if (updates.dimensions !== undefined) {
      updateData.dimensions = updates.dimensions ? JSON.stringify(updates.dimensions) : null;
    }
    if (updates.allergens !== undefined) {
      updateData.allergens = updates.allergens ? JSON.stringify(updates.allergens) : null;
    }
    if (updates.certifications !== undefined) {
      updateData.certifications = updates.certifications ? JSON.stringify(updates.certifications) : null;
    }
    if (updates.seasonalAvailability !== undefined) {
      updateData.seasonalAvailability = updates.seasonalAvailability ? JSON.stringify(updates.seasonalAvailability) : null;
    }
    if (updates.tags !== undefined) {
      updateData.tags = updates.tags ? JSON.stringify(updates.tags) : null;
    }
    if (updates.notes !== undefined) {
      updateData.notes = updates.notes;
    }
    if (updates.active !== undefined) {
      updateData.active = updates.active;
    }

    // Calculate margin if price or cost changed
    if (updates.price !== undefined || updates.costCents !== undefined) {
      const newPrice = updates.price ?? existingProduct.price;
      const newCost = updates.costCents ?? existingProduct.costCents;
      updateData.marginPercent = newPrice && newCost ? ((newPrice - newCost) / newPrice) * 100 : 0;
    }

    const [updatedProduct] = await this.db
      .update(products)
      .set(updateData)
      .where(
        and(
          eq(products.id, productId),
          eq(products.tenantId, tenantId)
        )
      )
      .returning();

    // Log audit
    await this.logAudit(productId, 'UPDATED', tenantId, userId, existingProduct, updateData);

    return updatedProduct;
  }

  async deleteProduct(productId: string, tenantId: string, userId: string): Promise<void> {
    // Get existing product for audit log
    const existingProduct = await this.getProduct(productId, tenantId);
    if (!existingProduct) {
      throw new Error('Product not found in this organization');
    }

    // Check if product is used in any purchase orders
    const [poItemUsage] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(poItems)
      .where(eq(poItems.productId, productId))
      .limit(1);

    if (poItemUsage.count > 0) {
      throw new Error('Cannot delete product that is used in purchase orders. Consider archiving instead.');
    }

    // Check if product has inventory
    const [inventoryUsage] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryItems)
      .where(eq(inventoryItems.productId, productId))
      .limit(1);

    if (inventoryUsage.count > 0) {
      throw new Error('Cannot delete product that has inventory. Consider archiving instead.');
    }

    await this.db
      .delete(products)
      .where(and(
        eq(products.id, productId),
        eq(products.tenantId, tenantId)
      ));

    // Log audit
    await this.logAudit(productId, 'DELETED', tenantId, userId, existingProduct);
  }

  async searchProducts(query: string, tenantId: string, limit: number = 20): Promise<Product[]> {
    if (!query.trim()) {
      return [];
    }

    const searchTerm = `%${query.trim()}%`;
    
    const result = await this.db
      .select()
      .from(products)
      .where(and(
        eq(products.tenantId, tenantId),
        eq(products.active, true),
        or(
          like(products.name, searchTerm),
          like(products.sku, searchTerm),
          like(products.barcode, searchTerm),
          like(products.description, searchTerm)
        )
      ))
      .orderBy(products.name)
      .limit(limit);

    return result;
  }

  async duplicateProduct(productId: string, tenantId: string, userId: string, newName?: string): Promise<Product> {
    const existingProduct = await this.getProduct(productId, tenantId);
    if (!existingProduct) {
      throw new Error('Product not found in this organization');
    }

    const duplicateData: CreateProductRequest = {
      name: newName || `${existingProduct.name} (Copy)`,
      description: existingProduct.description || undefined,
      categoryId: existingProduct.categoryId || undefined,
      unit: existingProduct.unit,
      price: existingProduct.price,
      // Don't copy SKU or barcode - they must be unique
      imageUrl: existingProduct.imageUrl || undefined,
      status: existingProduct.status as ProductStatus,
      minStock: existingProduct.minStock || undefined,
      maxStock: existingProduct.maxStock || undefined,
      reorderPoint: existingProduct.reorderPoint || undefined,
      costCents: existingProduct.costCents || undefined,
      weight: existingProduct.weight || undefined,
      dimensions: existingProduct.dimensions ? JSON.parse(existingProduct.dimensions) : undefined,
      allergens: existingProduct.allergens ? JSON.parse(existingProduct.allergens) : undefined,
      certifications: existingProduct.certifications ? JSON.parse(existingProduct.certifications) : undefined,
      seasonalAvailability: existingProduct.seasonalAvailability ? JSON.parse(existingProduct.seasonalAvailability) : undefined,
      tags: existingProduct.tags ? JSON.parse(existingProduct.tags) : undefined,
      notes: existingProduct.notes || undefined,
    };

    return this.createProduct(duplicateData, tenantId, userId);
  }

  async bulkUpdateProducts(request: BulkUpdateRequest, tenantId: string, userId: string): Promise<Product[]> {
    const { productIds, updates } = request;

    if (productIds.length === 0) {
      throw new Error('No products specified for bulk update');
    }

    // Validate all products exist and belong to tenant
    const existingProducts = await this.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.tenantId, tenantId),
          inArray(products.id, productIds)
        )
      );

    if (existingProducts.length !== productIds.length) {
      throw new Error('Some products not found in this organization');
    }

    const updateData: Partial<NewProduct> = {
      updatedAt: getCurrentTimestamp(),
      updatedBy: userId,
    };

    // Apply updates
    Object.keys(updates).forEach(key => {
      const value = updates[key as keyof UpdateProductRequest];
      if (value !== undefined) {
        if (['dimensions', 'allergens', 'certifications', 'seasonalAvailability', 'tags'].includes(key)) {
          updateData[key as keyof NewProduct] = value ? JSON.stringify(value) : null;
        } else {
          updateData[key as keyof NewProduct] = value as any;
        }
      }
    });

    const updatedProducts = await this.db
      .update(products)
      .set(updateData)
      .where(
        and(
          eq(products.tenantId, tenantId),
          inArray(products.id, productIds)
        )
      )
      .returning();

    // Log audit for each product
    for (const product of existingProducts) {
      await this.logAudit(product.id, 'UPDATED', tenantId, userId, product, updateData, 'Bulk update');
    }

    return updatedProducts;
  }

  async archiveProduct(productId: string, tenantId: string, userId: string): Promise<Product> {
    const updatedProduct = await this.updateProduct(
      productId, 
      { status: ProductStatusType.ARCHIVED, active: false }, 
      tenantId, 
      userId
    );

    await this.logAudit(productId, 'ARCHIVED', tenantId, userId);
    return updatedProduct;
  }

  async restoreProduct(productId: string, tenantId: string, userId: string): Promise<Product> {
    const updatedProduct = await this.updateProduct(
      productId, 
      { status: ProductStatusType.ACTIVE, active: true }, 
      tenantId, 
      userId
    );

    await this.logAudit(productId, 'RESTORED', tenantId, userId);
    return updatedProduct;
  }

  // Variants implementation
  async createVariant(productId: string, data: CreateVariantRequest, tenantId: string): Promise<ProductVariant> {
    // Verify product exists
    const product = await this.getProduct(productId, tenantId);
    if (!product) {
      throw new Error('Product not found in this organization');
    }

    // Validate SKU uniqueness if provided
    if (data.sku) {
      const [existing] = await this.db
        .select()
        .from(productVariants)
        .where(and(
          eq(productVariants.tenantId, tenantId),
          eq(productVariants.sku, data.sku)
        ))
        .limit(1);

      if (existing) {
        throw new Error('Variant SKU already exists');
      }
    }

    const newVariant: NewProductVariant = {
      id: `var_${generateId()}`,
      tenantId,
      productId,
      name: data.name,
      sku: data.sku || null,
      barcode: data.barcode || null,
      price: data.price || 0,
      costCents: data.costCents || 0,
      attributes: data.attributes ? JSON.stringify(data.attributes) : null,
      active: true,
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
    };

    const [createdVariant] = await this.db
      .insert(productVariants)
      .values(newVariant)
      .returning();

    return createdVariant;
  }

  async getVariants(productId: string, tenantId: string): Promise<ProductVariant[]> {
    return this.db
      .select()
      .from(productVariants)
      .where(
        and(
          eq(productVariants.productId, productId),
          eq(productVariants.tenantId, tenantId),
          eq(productVariants.active, true)
        )
      )
      .orderBy(productVariants.name);
  }

  async updateVariant(variantId: string, updates: Partial<CreateVariantRequest>, tenantId: string): Promise<ProductVariant> {
    const updateData: Partial<NewProductVariant> = {
      updatedAt: getCurrentTimestamp(),
    };

    Object.keys(updates).forEach(key => {
      const value = updates[key as keyof CreateVariantRequest];
      if (value !== undefined) {
        if (key === 'attributes') {
          updateData.attributes = value ? JSON.stringify(value) : null;
        } else {
          updateData[key as keyof NewProductVariant] = value as any;
        }
      }
    });

    const [updatedVariant] = await this.db
      .update(productVariants)
      .set(updateData)
      .where(
        and(
          eq(productVariants.id, variantId),
          eq(productVariants.tenantId, tenantId)
        )
      )
      .returning();

    return updatedVariant;
  }

  async deleteVariant(variantId: string, tenantId: string): Promise<void> {
    await this.db
      .delete(productVariants)
      .where(
        and(
          eq(productVariants.id, variantId),
          eq(productVariants.tenantId, tenantId)
        )
      );
  }

  // Relationships implementation
  async createRelationship(productId: string, data: CreateRelationshipRequest, tenantId: string): Promise<ProductRelationship> {
    // Verify both products exist
    const [product, relatedProduct] = await Promise.all([
      this.getProduct(productId, tenantId),
      this.getProduct(data.relatedProductId, tenantId)
    ]);

    if (!product || !relatedProduct) {
      throw new Error('One or both products not found');
    }

    if (productId === data.relatedProductId) {
      throw new Error('Product cannot be related to itself');
    }

    // Check if relationship already exists
    const [existing] = await this.db
      .select()
      .from(productRelationships)
      .where(
        and(
          eq(productRelationships.tenantId, tenantId),
          eq(productRelationships.productId, productId),
          eq(productRelationships.relatedProductId, data.relatedProductId),
          eq(productRelationships.relationshipType, data.relationshipType)
        )
      )
      .limit(1);

    if (existing) {
      throw new Error('Relationship already exists');
    }

    const newRelationship: NewProductRelationship = {
      id: `rel_${generateId()}`,
      tenantId,
      productId,
      relatedProductId: data.relatedProductId,
      relationshipType: data.relationshipType,
      strength: data.strength || 1.0,
      notes: data.notes || null,
      createdAt: getCurrentTimestamp(),
    };

    const [createdRelationship] = await this.db
      .insert(productRelationships)
      .values(newRelationship)
      .returning();

    return createdRelationship;
  }

  async getRelationships(productId: string, tenantId: string): Promise<(ProductRelationship & { relatedProduct: Product })[]> {
    return this.db
      .select({
        id: productRelationships.id,
        tenantId: productRelationships.tenantId,
        productId: productRelationships.productId,
        relatedProductId: productRelationships.relatedProductId,
        relationshipType: productRelationships.relationshipType,
        strength: productRelationships.strength,
        notes: productRelationships.notes,
        createdAt: productRelationships.createdAt,
        relatedProduct: {
          id: products.id,
          tenantId: products.tenantId,
          name: products.name,
          description: products.description,
          categoryId: products.categoryId,
          unit: products.unit,
          price: products.price,
          sku: products.sku,
          barcode: products.barcode,
          imageUrl: products.imageUrl,
          status: products.status,
          minStock: products.minStock,
          maxStock: products.maxStock,
          reorderPoint: products.reorderPoint,
          costCents: products.costCents,
          marginPercent: products.marginPercent,
          weight: products.weight,
          dimensions: products.dimensions,
          allergens: products.allergens,
          certifications: products.certifications,
          seasonalAvailability: products.seasonalAvailability,
          tags: products.tags,
          notes: products.notes,
          createdBy: products.createdBy,
          updatedBy: products.updatedBy,
          active: products.active,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
        },
      })
      .from(productRelationships)
      .innerJoin(products, eq(productRelationships.relatedProductId, products.id))
      .where(
        and(
          eq(productRelationships.productId, productId),
          eq(productRelationships.tenantId, tenantId)
        )
      )
      .orderBy(productRelationships.relationshipType, products.name);
  }

  async deleteRelationship(relationshipId: string, tenantId: string): Promise<void> {
    await this.db
      .delete(productRelationships)
      .where(
        and(
          eq(productRelationships.id, relationshipId),
          eq(productRelationships.tenantId, tenantId)
        )
      );
  }

  // Templates implementation
  async createTemplate(data: CreateTemplateRequest, tenantId: string, userId: string): Promise<ProductTemplate> {
    // Check for duplicate template name
    const [existing] = await this.db
      .select()
      .from(productTemplates)
      .where(
        and(
          eq(productTemplates.tenantId, tenantId),
          eq(productTemplates.name, data.name)
        )
      )
      .limit(1);

    if (existing) {
      throw new Error('Template with this name already exists');
    }

    const newTemplate: NewProductTemplate = {
      id: `tpl_${generateId()}`,
      tenantId,
      name: data.name,
      description: data.description || null,
      categoryId: data.categoryId || null,
      templateData: JSON.stringify(data.templateData),
      createdBy: userId,
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
    };

    const [createdTemplate] = await this.db
      .insert(productTemplates)
      .values(newTemplate)
      .returning();

    return createdTemplate;
  }

  async getTemplates(tenantId: string): Promise<ProductTemplate[]> {
    return this.db
      .select()
      .from(productTemplates)
      .where(eq(productTemplates.tenantId, tenantId))
      .orderBy(productTemplates.name);
  }

  async createFromTemplate(templateId: string, overrides: Partial<CreateProductRequest>, tenantId: string, userId: string): Promise<Product> {
    const [template] = await this.db
      .select()
      .from(productTemplates)
      .where(
        and(
          eq(productTemplates.id, templateId),
          eq(productTemplates.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!template) {
      throw new Error('Template not found');
    }

    const templateData = JSON.parse(template.templateData) as Partial<CreateProductRequest>;
    const productData: CreateProductRequest = {
      ...templateData,
      ...overrides,
      name: overrides.name || templateData.name || 'Untitled Product',
      unit: overrides.unit || templateData.unit || 'each',
    };

    return this.createProduct(productData, tenantId, userId);
  }

  async deleteTemplate(templateId: string, tenantId: string): Promise<void> {
    await this.db
      .delete(productTemplates)
      .where(
        and(
          eq(productTemplates.id, templateId),
          eq(productTemplates.tenantId, tenantId)
        )
      );
  }

  // Analytics implementation
  async getProductAnalytics(productId: string, tenantId: string, days: number = 30): Promise<ProductAnalyticsData> {
    // Get aggregated analytics for the specified period
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const analytics = await this.db
      .select()
      .from(productAnalytics)
      .where(
        and(
          eq(productAnalytics.productId, productId),
          eq(productAnalytics.tenantId, tenantId),
          gte(productAnalytics.dateBucket, startDate.toISOString().split('T')[0]),
          lte(productAnalytics.dateBucket, endDate.toISOString().split('T')[0])
        )
      )
      .orderBy(productAnalytics.dateBucket);

    const totals = analytics.reduce(
      (acc, record) => ({
        totalOrdered: acc.totalOrdered + (record.totalOrdered || 0),
        totalReceived: acc.totalReceived + (record.totalReceived || 0),
        totalCostCents: acc.totalCostCents + (record.totalCostCents || 0),
        orderCount: acc.orderCount + (record.orderCount || 0),
        supplierCount: Math.max(acc.supplierCount, record.supplierCount || 0),
        locationCount: Math.max(acc.locationCount, record.locationCount || 0),
      }),
      {
        totalOrdered: 0,
        totalReceived: 0,
        totalCostCents: 0,
        orderCount: 0,
        supplierCount: 0,
        locationCount: 0,
      }
    );

    const avgUnitCostCents = totals.totalReceived > 0 ? Math.round(totals.totalCostCents / totals.totalReceived) : 0;

    const trends = analytics.map(record => ({
      date: record.dateBucket,
      ordered: record.totalOrdered || 0,
      cost: record.totalCostCents || 0,
    }));

    return {
      ...totals,
      avgUnitCostCents,
      trends,
    };
  }

  async getProductPurchaseHistory(productId: string, tenantId: string, limit: number = 50): Promise<ProductPurchaseHistoryEntry[]> {
    // Verify product exists and belongs to tenant
    const product = await this.getProduct(productId, tenantId);
    if (!product) {
      throw new Error('Product not found in this organization');
    }

    const result = await this.db
      .select({
        poId: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        supplierName: suppliers.name,
        quantityOrdered: poItems.quantityOrdered,
        unitPriceCents: poItems.unitPriceCents,
        lineTotalCents: poItems.lineTotalCents,
        orderDate: purchaseOrders.createdAt,
        status: purchaseOrders.status,
      })
      .from(poItems)
      .innerJoin(purchaseOrders, eq(poItems.poId, purchaseOrders.id))
      .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(and(
        eq(poItems.productId, productId),
        eq(purchaseOrders.tenantId, tenantId)
      ))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(limit);

    return result.map(row => ({
      ...row,
      orderDate: new Date(row.orderDate),
      status: row.status as POStatusType,
    }));
  }

  async getLowStockProducts(tenantId: string, threshold?: number): Promise<ProductWithDetails[]> {
    // Get products where current stock is below reorder point or specified threshold
    const query = this.db
      .select({
        product: products,
        totalStock: sql<number>`COALESCE(SUM(${inventoryItems.quantity}), 0)`,
      })
      .from(products)
      .leftJoin(inventoryItems, eq(products.id, inventoryItems.productId))
      .where(
        and(
          eq(products.tenantId, tenantId),
          eq(products.active, true),
          eq(products.status, ProductStatusType.ACTIVE)
        )
      )
      .groupBy(products.id)
      .having(
        threshold 
          ? sql`COALESCE(SUM(${inventoryItems.quantity}), 0) <= ${threshold}`
          : sql`COALESCE(SUM(${inventoryItems.quantity}), 0) <= ${products.reorderPoint}`
      )
      .orderBy(sql`COALESCE(SUM(${inventoryItems.quantity}), 0)`);

    const results = await query;

    return results.map(result => ({
      ...result.product,
      totalStock: result.totalStock,
    })) as ProductWithDetails[];
  }

  async getTopProducts(tenantId: string, metric: 'ordered' | 'cost' | 'frequency', limit: number = 10): Promise<ProductWithDetails[]> {
    // Get top products based on analytics data from last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    const sortField = metric === 'ordered' ? productAnalytics.totalOrdered :
                     metric === 'cost' ? productAnalytics.totalCostCents :
                     productAnalytics.orderCount;

    const results = await this.db
      .select({
        product: products,
        metricValue: sql<number>`COALESCE(SUM(${sortField}), 0)`,
      })
      .from(products)
      .leftJoin(productAnalytics, eq(products.id, productAnalytics.productId))
      .where(
        and(
          eq(products.tenantId, tenantId),
          eq(products.active, true),
          or(
            isNull(productAnalytics.dateBucket),
            and(
              gte(productAnalytics.dateBucket, startDate.toISOString().split('T')[0]),
              lte(productAnalytics.dateBucket, endDate.toISOString().split('T')[0])
            )
          )
        )
      )
      .groupBy(products.id)
      .orderBy(desc(sql`COALESCE(SUM(${sortField}), 0)`))
      .limit(limit);

    return results.map(result => result.product) as ProductWithDetails[];
  }

  // Import/Export implementation
  async importProducts(data: ImportProductData[], tenantId: string, userId: string): Promise<{ created: number; errors: string[] }> {
    let created = 0;
    const errors: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      try {
        // Find category by name if provided
        let categoryId: string | undefined;
        if (item.categoryName) {
          const [category] = await this.db
            .select()
            .from(categories)
            .where(
              and(
                eq(categories.tenantId, tenantId),
                eq(categories.name, item.categoryName)
              )
            )
            .limit(1);
          categoryId = category?.id;
        }

        const productData: CreateProductRequest = {
          name: item.name,
          description: item.description,
          categoryId,
          unit: item.unit,
          price: item.price,
          sku: item.sku,
          barcode: item.barcode,
          minStock: item.minStock,
          maxStock: item.maxStock,
          reorderPoint: item.reorderPoint,
          costCents: item.costCents,
          tags: item.tags ? item.tags.split(',').map(t => t.trim()) : undefined,
          notes: item.notes,
        };

        await this.createProduct(productData, tenantId, userId);
        created++;
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { created, errors };
  }

  async exportProducts(tenantId: string, filters?: ProductSearchFilters): Promise<any[]> {
    const { products: productList } = await this.listProducts(tenantId, { ...filters, limit: 10000 });

    return productList.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category?.name || '',
      unit: product.unit,
      price: product.price / 100, // Convert cents to dollars
      sku: product.sku,
      barcode: product.barcode,
      status: product.status,
      minStock: product.minStock,
      maxStock: product.maxStock,
      reorderPoint: product.reorderPoint,
      costCents: product.costCents / 100, // Convert cents to dollars
      marginPercent: product.marginPercent,
      weight: product.weight,
      tags: product.tags ? JSON.parse(product.tags).join(', ') : '',
      notes: product.notes,
      active: product.active,
      createdAt: new Date(product.createdAt).toISOString(),
      updatedAt: new Date(product.updatedAt).toISOString(),
    }));
  }

  // Utility methods
  async generateSKU(tenantId: string, categoryId?: string): Promise<string> {
    let prefix = 'PRD';
    
    if (categoryId) {
      const [category] = await this.db
        .select()
        .from(categories)
        .where(eq(categories.id, categoryId))
        .limit(1);
      
      if (category) {
        prefix = category.name.substring(0, 3).toUpperCase();
      }
    }

    // Get next sequence number
    const [lastProduct] = await this.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.tenantId, tenantId),
          like(products.sku, `${prefix}%`)
        )
      )
      .orderBy(desc(products.sku))
      .limit(1);

    let nextNumber = 1;
    if (lastProduct?.sku) {
      const match = lastProduct.sku.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
  }

  async generateBarcode(tenantId: string): Promise<string> {
    // Generate a simple 12-digit barcode (UPC-A format without check digit)
    let barcode: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      // Generate random 12-digit number
      barcode = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
      attempts++;
      
      if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique barcode');
      }
    } while (!(await this.validateBarcode(barcode, tenantId)));

    return barcode;
  }

  async validateProductExists(productId: string, tenantId: string): Promise<boolean> {
    const product = await this.getProduct(productId, tenantId);
    return product !== null;
  }

  async validateSKU(sku: string, tenantId: string, excludeProductId?: string): Promise<boolean> {
    const conditions = [
      eq(products.tenantId, tenantId),
      eq(products.sku, sku)
    ];

    if (excludeProductId) {
      conditions.push(sql`${products.id} != ${excludeProductId}`);
    }

    const [existing] = await this.db
      .select()
      .from(products)
      .where(and(...conditions))
      .limit(1);

    return !existing;
  }

  async validateBarcode(barcode: string, tenantId: string, excludeProductId?: string): Promise<boolean> {
    const conditions = [
      eq(products.tenantId, tenantId),
      eq(products.barcode, barcode)
    ];

    if (excludeProductId) {
      conditions.push(sql`${products.id} != ${excludeProductId}`);
    }

    const [existing] = await this.db
      .select()
      .from(products)
      .where(and(...conditions))
      .limit(1);

    return !existing;
  }
}

// Factory function for creating ProductService instances
export function createProductService(db: DrizzleD1Database): IProductService {
  return new ProductService(db);
}