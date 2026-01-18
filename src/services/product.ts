import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, like, desc, sql } from 'drizzle-orm';
import { 
  products, 
  poItems,
  purchaseOrders,
  priceHistory,
  suppliers,
  Product, 
  NewProduct,
  POStatusType,
  POStatus
} from '../db/schema';
import { generateId, getCurrentTimestamp } from '../utils';

// Product service interfaces
export interface CreateProductRequest {
  name: string;
  description?: string;
  category?: string;
  unit: string;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  category?: string;
  unit?: string;
}

export interface ProductSearchFilters {
  name?: string;
  category?: string;
  limit?: number;
  offset?: number;
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

export interface IProductService {
  createProduct(data: CreateProductRequest, tenantId: string): Promise<Product>;
  getProduct(productId: string, tenantId: string): Promise<Product | null>;
  listProducts(tenantId: string, filters?: ProductSearchFilters): Promise<Product[]>;
  updateProduct(productId: string, updates: UpdateProductRequest, tenantId: string): Promise<Product>;
  deleteProduct(productId: string, tenantId: string): Promise<void>;
  searchProducts(query: string, tenantId: string, limit?: number): Promise<Product[]>;
  getProductPurchaseHistory(productId: string, tenantId: string, limit?: number): Promise<ProductPurchaseHistoryEntry[]>;
  validateProductExists(productId: string, tenantId: string): Promise<boolean>;
}

export class ProductService implements IProductService {
  constructor(private db: DrizzleD1Database) {}

  async createProduct(data: CreateProductRequest, tenantId: string): Promise<Product> {
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

    const newProduct: NewProduct = {
      id: `prod_${generateId()}`,
      tenantId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      category: data.category?.trim() || null,
      unit: data.unit.trim(),
      createdAt: now,
      updatedAt: now,
    };

    const [createdProduct] = await this.db
      .insert(products)
      .values(newProduct)
      .returning();

    return createdProduct;
  }

  async getProduct(productId: string, tenantId: string): Promise<Product | null> {
    const [product] = await this.db
      .select()
      .from(products)
      .where(and(
        eq(products.id, productId),
        eq(products.tenantId, tenantId)
      ))
      .limit(1);

    return product || null;
  }

  async listProducts(tenantId: string, filters: ProductSearchFilters = {}): Promise<Product[]> {
    const { name, category, limit = 50, offset = 0 } = filters;
    
    let query = this.db
      .select()
      .from(products)
      .where(eq(products.tenantId, tenantId));

    // Apply filters
    const conditions = [eq(products.tenantId, tenantId)];
    
    if (name) {
      conditions.push(like(products.name, `%${name}%`));
    }
    
    if (category) {
      conditions.push(eq(products.category, category));
    }

    if (conditions.length > 1) {
      query = query.where(and(...conditions));
    }

    const result = await query
      .orderBy(products.name)
      .limit(limit)
      .offset(offset);

    return result;
  }

  async updateProduct(productId: string, updates: UpdateProductRequest, tenantId: string): Promise<Product> {
    // Verify product exists and belongs to tenant
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

    const updateData: Partial<NewProduct> = {
      updatedAt: getCurrentTimestamp(),
    };

    if (updates.name !== undefined) {
      updateData.name = updates.name.trim();
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description?.trim() || null;
    }
    if (updates.category !== undefined) {
      updateData.category = updates.category?.trim() || null;
    }
    if (updates.unit !== undefined) {
      updateData.unit = updates.unit.trim();
    }

    const [updatedProduct] = await this.db
      .update(products)
      .set(updateData)
      .where(and(
        eq(products.id, productId),
        eq(products.tenantId, tenantId)
      ))
      .returning();

    return updatedProduct;
  }

  async deleteProduct(productId: string, tenantId: string): Promise<void> {
    // Verify product exists and belongs to tenant
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
      throw new Error('Cannot delete product that is used in purchase orders');
    }

    await this.db
      .delete(products)
      .where(and(
        eq(products.id, productId),
        eq(products.tenantId, tenantId)
      ));
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
        like(products.name, searchTerm)
      ))
      .orderBy(products.name)
      .limit(limit);

    return result;
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

  async validateProductExists(productId: string, tenantId: string): Promise<boolean> {
    const product = await this.getProduct(productId, tenantId);
    return product !== null;
  }
}

// Factory function for creating ProductService instances
export function createProductService(db: DrizzleD1Database): IProductService {
  return new ProductService(db);
}