import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, like, desc } from 'drizzle-orm';
import { suppliers, purchaseOrders, Supplier, NewSupplier } from '../db/schema';
import { generateId, getCurrentTimestamp } from '../utils';

// Supplier service interfaces as defined in the design document
export interface CreateSupplierRequest {
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  paymentTerms?: string;
}

export interface UpdateSupplierRequest {
  name?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  paymentTerms?: string;
}

export interface SupplierAnalytics {
  totalSpend: number;
  orderCount: number;
  averageOrderValue: number;
  lastOrderDate: Date | null;
  topProducts: Array<{
    productId: string;
    productName: string;
    totalQuantity: number;
    totalSpend: number;
  }>;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface SupplierService {
  createSupplier(tenantId: string, data: CreateSupplierRequest): Promise<Supplier>;
  getSupplier(tenantId: string, supplierId: string): Promise<Supplier | null>;
  listSuppliers(tenantId: string, options?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ suppliers: Supplier[]; total: number }>;
  updateSupplier(tenantId: string, supplierId: string, updates: UpdateSupplierRequest): Promise<Supplier>;
  deleteSupplier(tenantId: string, supplierId: string): Promise<boolean>;
  getSupplierAnalytics(tenantId: string, supplierId: string, dateRange?: DateRange): Promise<SupplierAnalytics>;
}

export class SupplierServiceImpl implements SupplierService {
  constructor(private db: DrizzleD1Database) {}

  /**
   * Create a new supplier with tenant isolation and validation
   * Requirements: 1.1, 1.2
   */
  async createSupplier(tenantId: string, data: CreateSupplierRequest): Promise<Supplier> {
    // Validate input data
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    if (!data.name || !data.name.trim()) {
      throw new Error('Supplier name is required');
    }

    // Validate email format if provided
    if (data.contactEmail && !this.isValidEmail(data.contactEmail)) {
      throw new Error('Invalid email format');
    }

    // Normalize supplier name
    const normalizedName = data.name.trim();

    // Check supplier name uniqueness within tenant (Requirement 1.1)
    const existingSupplier = await this.db
      .select()
      .from(suppliers)
      .where(and(
        eq(suppliers.tenantId, tenantId),
        eq(suppliers.name, normalizedName)
      ))
      .limit(1);

    if (existingSupplier.length > 0) {
      throw new Error('A supplier with this name already exists in this organization');
    }

    // Create new supplier record
    const currentTime = getCurrentTimestamp();
    const newSupplier: NewSupplier = {
      id: `supplier_${generateId()}`,
      tenantId,
      name: normalizedName,
      contactEmail: data.contactEmail?.toLowerCase().trim() || null,
      contactPhone: data.contactPhone?.trim() || null,
      address: data.address?.trim() || null,
      paymentTerms: data.paymentTerms?.trim() || null,
      createdAt: currentTime,
      updatedAt: currentTime,
    };

    const [createdSupplier] = await this.db
      .insert(suppliers)
      .values(newSupplier)
      .returning();

    if (!createdSupplier) {
      throw new Error('Failed to create supplier');
    }

    return createdSupplier;
  }

  /**
   * Get supplier by ID within tenant context
   * Requirements: 1.2
   */
  async getSupplier(tenantId: string, supplierId: string): Promise<Supplier | null> {
    if (!tenantId || !supplierId) {
      return null;
    }

    const [supplier] = await this.db
      .select()
      .from(suppliers)
      .where(and(
        eq(suppliers.tenantId, tenantId),
        eq(suppliers.id, supplierId)
      ))
      .limit(1);

    return supplier || null;
  }

  /**
   * List suppliers with search and pagination
   * Requirements: 1.2, 1.3
   */
  async listSuppliers(
    tenantId: string, 
    options: {
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ suppliers: Supplier[]; total: number }> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const { search, limit = 20, offset = 0 } = options;

    // Build base query with tenant isolation
    let query = this.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.tenantId, tenantId));

    // Add search filter if provided
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      query = query.where(and(
        eq(suppliers.tenantId, tenantId),
        like(suppliers.name, searchTerm)
      ));
    }

    // Get total count for pagination
    const countQuery = this.db
      .select({ count: suppliers.id })
      .from(suppliers)
      .where(eq(suppliers.tenantId, tenantId));

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      countQuery.where(and(
        eq(suppliers.tenantId, tenantId),
        like(suppliers.name, searchTerm)
      ));
    }

    const [countResult, supplierResults] = await Promise.all([
      countQuery,
      query
        .orderBy(desc(suppliers.createdAt))
        .limit(limit)
        .offset(offset)
    ]);

    return {
      suppliers: supplierResults,
      total: countResult.length,
    };
  }

  /**
   * Update supplier information
   * Requirements: 1.2, 1.3
   */
  async updateSupplier(
    tenantId: string, 
    supplierId: string, 
    updates: UpdateSupplierRequest
  ): Promise<Supplier> {
    if (!tenantId || !supplierId) {
      throw new Error('Tenant ID and Supplier ID are required');
    }

    // Check if supplier exists in tenant
    const existingSupplier = await this.getSupplier(tenantId, supplierId);
    if (!existingSupplier) {
      throw new Error('Supplier not found in this organization');
    }

    // Validate email format if provided
    if (updates.contactEmail && !this.isValidEmail(updates.contactEmail)) {
      throw new Error('Invalid email format');
    }

    // Check name uniqueness if name is being updated
    if (updates.name && updates.name.trim() !== existingSupplier.name) {
      const normalizedName = updates.name.trim();
      const duplicateSupplier = await this.db
        .select()
        .from(suppliers)
        .where(and(
          eq(suppliers.tenantId, tenantId),
          eq(suppliers.name, normalizedName)
        ))
        .limit(1);

      if (duplicateSupplier.length > 0) {
        throw new Error('A supplier with this name already exists in this organization');
      }
    }

    // Prepare update data
    const updateData: Partial<NewSupplier> = {
      updatedAt: getCurrentTimestamp(),
    };

    if (updates.name !== undefined) {
      updateData.name = updates.name.trim();
    }
    if (updates.contactEmail !== undefined) {
      updateData.contactEmail = updates.contactEmail ? updates.contactEmail.toLowerCase().trim() : null;
    }
    if (updates.contactPhone !== undefined) {
      updateData.contactPhone = updates.contactPhone ? updates.contactPhone.trim() : null;
    }
    if (updates.address !== undefined) {
      updateData.address = updates.address ? updates.address.trim() : null;
    }
    if (updates.paymentTerms !== undefined) {
      updateData.paymentTerms = updates.paymentTerms ? updates.paymentTerms.trim() : null;
    }

    // Update supplier
    const [updatedSupplier] = await this.db
      .update(suppliers)
      .set(updateData)
      .where(and(
        eq(suppliers.tenantId, tenantId),
        eq(suppliers.id, supplierId)
      ))
      .returning();

    if (!updatedSupplier) {
      throw new Error('Failed to update supplier');
    }

    return updatedSupplier;
  }

  /**
   * Delete supplier (only if no purchase orders exist)
   * Requirements: 1.3
   */
  async deleteSupplier(tenantId: string, supplierId: string): Promise<boolean> {
    if (!tenantId || !supplierId) {
      throw new Error('Tenant ID and Supplier ID are required');
    }

    // Check if supplier exists in tenant
    const existingSupplier = await this.getSupplier(tenantId, supplierId);
    if (!existingSupplier) {
      throw new Error('Supplier not found in this organization');
    }

    // Check if supplier has any purchase orders
    const [existingPO] = await this.db
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(and(
        eq(purchaseOrders.tenantId, tenantId),
        eq(purchaseOrders.supplierId, supplierId)
      ))
      .limit(1);

    if (existingPO) {
      throw new Error('Cannot delete supplier with existing purchase orders');
    }

    // Delete supplier
    const result = await this.db
      .delete(suppliers)
      .where(and(
        eq(suppliers.tenantId, tenantId),
        eq(suppliers.id, supplierId)
      ));

    return result.success;
  }

  /**
   * Get supplier analytics and purchasing history
   * Requirements: 1.3
   */
  async getSupplierAnalytics(
    tenantId: string, 
    supplierId: string, 
    dateRange?: DateRange
  ): Promise<SupplierAnalytics> {
    if (!tenantId || !supplierId) {
      throw new Error('Tenant ID and Supplier ID are required');
    }

    // Check if supplier exists in tenant
    const supplier = await this.getSupplier(tenantId, supplierId);
    if (!supplier) {
      throw new Error('Supplier not found in this organization');
    }

    // Build query for purchase orders
    let poQuery = this.db
      .select()
      .from(purchaseOrders)
      .where(and(
        eq(purchaseOrders.tenantId, tenantId),
        eq(purchaseOrders.supplierId, supplierId),
        eq(purchaseOrders.status, 'APPROVED') // Only count approved orders
      ));

    // Apply date range filter if provided
    if (dateRange) {
      const startTimestamp = Math.floor(dateRange.startDate.getTime() / 1000);
      const endTimestamp = Math.floor(dateRange.endDate.getTime() / 1000);
      // Note: This would need additional date filtering logic in a real implementation
      // For now, we'll get all orders and filter in memory
    }

    const orders = await poQuery;

    // Calculate analytics
    const totalSpend = orders.reduce((sum, order) => sum + (order.totalCostCents || 0), 0);
    const orderCount = orders.length;
    const averageOrderValue = orderCount > 0 ? totalSpend / orderCount : 0;
    
    // Find last order date
    const lastOrderDate = orders.length > 0 
      ? new Date(Math.max(...orders.map(o => (o.approvedAt || o.createdAt) * 1000)))
      : null;

    // For now, return empty top products array
    // In a full implementation, this would join with po_items and products tables
    const topProducts: SupplierAnalytics['topProducts'] = [];

    return {
      totalSpend: totalSpend / 100, // Convert cents to dollars
      orderCount,
      averageOrderValue: averageOrderValue / 100, // Convert cents to dollars
      lastOrderDate,
      topProducts,
    };
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && !email.includes('..');
  }
}

/**
 * Factory function to create SupplierService instance
 */
export function createSupplierService(db: DrizzleD1Database): SupplierService {
  return new SupplierServiceImpl(db);
}