import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, sql } from 'drizzle-orm';
import { 
  purchaseOrders, 
  poItems, 
  suppliers,
  products,
  users,
  PurchaseOrder, 
  NewPurchaseOrder,
  POItem,
  NewPOItem,
  POStatus,
  POStatusType
} from '../db/schema';
import { generateId, getCurrentTimestamp } from '../utils';
import { POStateMachine, createPOStateMachine, TransitionContext } from './po-state-machine';
import { PriceHistoryService, createPriceHistoryService } from './price-history';
import { IPOAuditService, createPOAuditService } from './po-audit';
import { IProductService, createProductService } from './product';
import { POAuditAction } from '../db/schema';

// Purchase Order service interfaces as defined in the design document
export interface POLineItemRequest {
  productId: string;
  quantityOrdered: number;
  unitPriceCents: number;
  notes?: string;
}

export interface ReceivingData {
  receivedItems: Array<{
    poItemId: string;
    quantityReceived: number;
    variance?: string;
    notes?: string;
  }>;
  receivedDate: Date;
  receivedBy: string;
}

export interface PurchaseOrderWithItems {
  id: string;
  tenantId: string;
  supplierId: string;
  poNumber: string | null;
  status: string;
  totalCostCents: number | null;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: number | null;
  receivedBy: string | null;
  receivedAt: number | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
  items: POItem[];
  supplier?: {
    id: string;
    name: string;
    contactEmail: string | null;
    contactPhone: string | null;
  };
}

// Bulk operations interfaces
export interface BulkPOTemplate {
  supplierId: string;
  notes?: string;
  items: POLineItemRequest[];
}

export interface BulkLineItemImport {
  productId: string;
  quantityOrdered: number;
  unitPriceCents: number;
  notes?: string;
}

export interface BulkApprovalRequest {
  poIds: string[];
  approverId: string;
  reason?: string;
}

export interface BulkOperationResult<T> {
  successful: Array<{ id: string; data: T }>;
  failed: Array<{ id: string; error: string }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface PurchaseOrderService {
  createDraft(supplierId: string, tenantId: string, createdBy: string): Promise<PurchaseOrder>;
  addLineItem(poId: string, tenantId: string, item: POLineItemRequest): Promise<POItem>;
  updateLineItem(itemId: string, tenantId: string, updates: Partial<POLineItemRequest>): Promise<POItem>;
  removeLineItem(itemId: string, tenantId: string): Promise<void>;
  approvePO(poId: string, tenantId: string, approverId: string): Promise<PurchaseOrder>;
  receivePO(poId: string, tenantId: string, receivingData: ReceivingData): Promise<PurchaseOrder>;
  cancelPO(poId: string, tenantId: string, cancelledBy: string, reason?: string): Promise<PurchaseOrder>;
  getPOWithItems(poId: string, tenantId: string): Promise<PurchaseOrderWithItems | null>;
  listPurchaseOrders(tenantId: string, options?: {
    status?: POStatusType;
    supplierId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ purchaseOrders: PurchaseOrderWithItems[]; total: number }>;
  validatePONumberUniqueness(poNumber: string, tenantId: string): Promise<boolean>;
  getPONumber(poId: string, tenantId: string): Promise<string | null>;
  
  // Bulk operations
  createBulkPOsFromTemplates(templates: BulkPOTemplate[], tenantId: string, createdBy: string): Promise<BulkOperationResult<PurchaseOrder>>;
  addBulkLineItems(poId: string, tenantId: string, items: BulkLineItemImport[]): Promise<BulkOperationResult<POItem>>;
  bulkApprovePOs(request: BulkApprovalRequest, tenantId: string): Promise<BulkOperationResult<PurchaseOrder>>;
}

export class PurchaseOrderServiceImpl implements PurchaseOrderService {
  private stateMachine: POStateMachine;
  private priceHistoryService: PriceHistoryService;
  private auditService: IPOAuditService;
  private productService: IProductService;

  constructor(private db: DrizzleD1Database) {
    this.stateMachine = createPOStateMachine(db);
    this.priceHistoryService = createPriceHistoryService(db);
    this.auditService = createPOAuditService(db);
    this.productService = createProductService(db);
  }

  /**
   * Create a new purchase order draft
   * Requirements: 2.1
   */
  async createDraft(supplierId: string, tenantId: string, createdBy: string): Promise<PurchaseOrder> {
    if (!supplierId || !tenantId || !createdBy) {
      throw new Error('Supplier ID, tenant ID, and created by user ID are required');
    }

    // Verify supplier exists and belongs to tenant
    const [supplier] = await this.db
      .select()
      .from(suppliers)
      .where(and(
        eq(suppliers.id, supplierId),
        eq(suppliers.tenantId, tenantId)
      ))
      .limit(1);

    if (!supplier) {
      throw new Error('Supplier not found in this organization');
    }

    // Verify user exists and belongs to tenant
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.id, createdBy),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);

    if (!user) {
      throw new Error('User not found in this organization');
    }

    // Create new purchase order draft
    const currentTime = getCurrentTimestamp();
    const newPO: NewPurchaseOrder = {
      id: `po_${generateId()}`,
      tenantId,
      supplierId,
      poNumber: null, // Generated on approval
      status: POStatus.DRAFT,
      totalCostCents: 0, // Will be calculated when items are added
      createdBy,
      approvedBy: null,
      approvedAt: null,
      receivedBy: null,
      receivedAt: null,
      notes: null,
      createdAt: currentTime,
      updatedAt: currentTime,
    };

    const [createdPO] = await this.db
      .insert(purchaseOrders)
      .values(newPO)
      .returning();

    if (!createdPO) {
      throw new Error('Failed to create purchase order');
    }

    // Log PO creation in audit trail
    await this.auditService.logPOCreation({
      tenantId,
      userId: createdBy,
      poId: createdPO.id,
      action: POAuditAction.CREATED,
      newValues: {
        supplierId: createdPO.supplierId,
        status: createdPO.status,
        createdBy: createdPO.createdBy,
      },
      notes: 'Purchase order draft created',
    });

    return createdPO;
  }

  /**
   * Add a line item to a purchase order
   * Requirements: 2.1, 2.2
   */
  async addLineItem(poId: string, tenantId: string, item: POLineItemRequest): Promise<POItem> {
    if (!poId || !tenantId) {
      throw new Error('Purchase order ID and tenant ID are required');
    }

    // Validate line item data
    if (!item.productId || item.quantityOrdered <= 0 || item.unitPriceCents <= 0) {
      throw new Error('Valid product ID, quantity, and unit price are required');
    }

    // Get purchase order and verify it's in DRAFT status
    const po = await this.getPurchaseOrder(poId, tenantId);
    if (!po) {
      throw new Error('Purchase order not found');
    }

    if (po.status !== POStatus.DRAFT) {
      throw new Error('Can only add items to draft purchase orders');
    }

    // Verify product exists and belongs to tenant using product service
    const productExists = await this.productService.validateProductExists(item.productId, tenantId);
    if (!productExists) {
      throw new Error('Product not found in this organization');
    }

    // Check if product already exists in this PO
    const [existingItem] = await this.db
      .select()
      .from(poItems)
      .where(and(
        eq(poItems.poId, poId),
        eq(poItems.productId, item.productId)
      ))
      .limit(1);

    if (existingItem) {
      throw new Error('Product already exists in this purchase order. Use update instead.');
    }

    // Create new line item
    const currentTime = getCurrentTimestamp();
    const lineTotalCents = item.quantityOrdered * item.unitPriceCents;
    
    const newItem: NewPOItem = {
      id: `poi_${generateId()}`,
      poId,
      productId: item.productId,
      quantityOrdered: item.quantityOrdered,
      unitPriceCents: item.unitPriceCents,
      quantityReceived: 0,
      lineTotalCents,
      notes: item.notes || null,
      createdAt: currentTime,
      updatedAt: currentTime,
    };

    const [createdItem] = await this.db
      .insert(poItems)
      .values(newItem)
      .returning();

    if (!createdItem) {
      throw new Error('Failed to add line item');
    }

    // Update purchase order total
    await this.recalculatePOTotal(poId);

    // Log line item addition in audit trail
    await this.auditService.logItemAdded({
      tenantId,
      userId: po.createdBy, // Use the PO creator as the context user
      poId,
      action: POAuditAction.ITEM_ADDED,
      newValues: {
        itemId: createdItem.id,
        productId: createdItem.productId,
        quantityOrdered: createdItem.quantityOrdered,
        unitPriceCents: createdItem.unitPriceCents,
        lineTotalCents: createdItem.lineTotalCents,
      },
      notes: `Line item added: Product ${item.productId}, Quantity ${item.quantityOrdered}`,
    });

    return createdItem;
  }

  /**
   * Update a line item in a purchase order
   * Requirements: 2.1, 2.2
   */
  async updateLineItem(itemId: string, tenantId: string, updates: Partial<POLineItemRequest>): Promise<POItem> {
    if (!itemId || !tenantId) {
      throw new Error('Line item ID and tenant ID are required');
    }

    // Get existing line item and verify PO is in DRAFT status
    const [existingItem] = await this.db
      .select({
        item: poItems,
        po: purchaseOrders,
      })
      .from(poItems)
      .innerJoin(purchaseOrders, eq(poItems.poId, purchaseOrders.id))
      .where(and(
        eq(poItems.id, itemId),
        eq(purchaseOrders.tenantId, tenantId)
      ))
      .limit(1);

    if (!existingItem) {
      throw new Error('Line item not found');
    }

    if (existingItem.po.status !== POStatus.DRAFT) {
      throw new Error('Can only update items in draft purchase orders');
    }

    // Validate updates
    if (updates.quantityOrdered !== undefined && updates.quantityOrdered <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
    if (updates.unitPriceCents !== undefined && updates.unitPriceCents <= 0) {
      throw new Error('Unit price must be greater than 0');
    }

    // Verify product exists if productId is being updated
    if (updates.productId && updates.productId !== existingItem.item.productId) {
      const productExists = await this.productService.validateProductExists(updates.productId, tenantId);
      if (!productExists) {
        throw new Error('Product not found in this organization');
      }

      // Check if new product already exists in this PO
      const [duplicateItem] = await this.db
        .select()
        .from(poItems)
        .where(and(
          eq(poItems.poId, existingItem.item.poId),
          eq(poItems.productId, updates.productId)
        ))
        .limit(1);

      if (duplicateItem) {
        throw new Error('Product already exists in this purchase order');
      }
    }

    // Prepare update data
    const updateData: Partial<NewPOItem> = {
      updatedAt: getCurrentTimestamp(),
    };

    if (updates.productId !== undefined) {
      updateData.productId = updates.productId;
    }
    if (updates.quantityOrdered !== undefined) {
      updateData.quantityOrdered = updates.quantityOrdered;
    }
    if (updates.unitPriceCents !== undefined) {
      updateData.unitPriceCents = updates.unitPriceCents;
    }
    if (updates.notes !== undefined) {
      updateData.notes = updates.notes || null;
    }

    // Calculate new line total if quantity or price changed
    const finalQuantity = updates.quantityOrdered ?? existingItem.item.quantityOrdered;
    const finalPrice = updates.unitPriceCents ?? existingItem.item.unitPriceCents;
    updateData.lineTotalCents = finalQuantity * finalPrice;

    // Update line item
    const [updatedItem] = await this.db
      .update(poItems)
      .set(updateData)
      .where(eq(poItems.id, itemId))
      .returning();

    if (!updatedItem) {
      throw new Error('Failed to update line item');
    }

    // Update purchase order total
    await this.recalculatePOTotal(existingItem.item.poId);

    // Log line item update in audit trail
    await this.auditService.logItemUpdated({
      tenantId,
      userId: existingItem.po.createdBy, // Use the PO creator as the context user
      poId: existingItem.item.poId,
      action: POAuditAction.ITEM_UPDATED,
      oldValues: {
        itemId: existingItem.item.id,
        productId: existingItem.item.productId,
        quantityOrdered: existingItem.item.quantityOrdered,
        unitPriceCents: existingItem.item.unitPriceCents,
        lineTotalCents: existingItem.item.lineTotalCents,
      },
      newValues: {
        itemId: updatedItem.id,
        productId: updatedItem.productId,
        quantityOrdered: updatedItem.quantityOrdered,
        unitPriceCents: updatedItem.unitPriceCents,
        lineTotalCents: updatedItem.lineTotalCents,
      },
      notes: `Line item updated: ${Object.keys(updates).join(', ')}`,
    });

    return updatedItem;
  }

  /**
   * Remove a line item from a purchase order
   * Requirements: 2.1
   */
  async removeLineItem(itemId: string, tenantId: string): Promise<void> {
    if (!itemId || !tenantId) {
      throw new Error('Line item ID and tenant ID are required');
    }

    // Get existing line item and verify PO is in DRAFT status
    const [existingItem] = await this.db
      .select({
        item: poItems,
        po: purchaseOrders,
      })
      .from(poItems)
      .innerJoin(purchaseOrders, eq(poItems.poId, purchaseOrders.id))
      .where(and(
        eq(poItems.id, itemId),
        eq(purchaseOrders.tenantId, tenantId)
      ))
      .limit(1);

    if (!existingItem) {
      throw new Error('Line item not found');
    }

    if (existingItem.po.status !== POStatus.DRAFT) {
      throw new Error('Can only remove items from draft purchase orders');
    }

    // Log line item removal before deletion
    await this.auditService.logItemRemoved({
      tenantId,
      userId: existingItem.po.createdBy, // Use the PO creator as the context user
      poId: existingItem.item.poId,
      action: POAuditAction.ITEM_REMOVED,
      oldValues: {
        itemId: existingItem.item.id,
        productId: existingItem.item.productId,
        quantityOrdered: existingItem.item.quantityOrdered,
        unitPriceCents: existingItem.item.unitPriceCents,
        lineTotalCents: existingItem.item.lineTotalCents,
      },
      notes: `Line item removed: Product ${existingItem.item.productId}`,
    });

    // Delete line item
    const result = await this.db
      .delete(poItems)
      .where(eq(poItems.id, itemId));

    if (!result.success) {
      throw new Error('Failed to remove line item');
    }

    // Update purchase order total
    await this.recalculatePOTotal(existingItem.item.poId);
  }

  /**
   * Approve a purchase order using state machine
   * Requirements: 2.4, 2.5
   */
  async approvePO(poId: string, tenantId: string, approverId: string): Promise<PurchaseOrder> {
    if (!poId || !tenantId || !approverId) {
      throw new Error('Purchase order ID, tenant ID, and approver ID are required');
    }

    // Get the current purchase order
    const po = await this.getPurchaseOrder(poId, tenantId);
    if (!po) {
      throw new Error('Purchase order not found');
    }

    // Verify approver exists and belongs to tenant
    const [approver] = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.id, approverId),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);

    if (!approver) {
      throw new Error('Approver not found in this organization');
    }

    // Use state machine to execute approval transition with retry logic for PO number conflicts
    const transitionContext: TransitionContext = {
      userId: approverId,
      tenantId,
      reason: 'Purchase order approved',
    };

    let approvedPO: PurchaseOrder;
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        approvedPO = await this.stateMachine.executeTransition(po, POStatus.APPROVED, transitionContext);
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error as Error;
        
        // If it's a PO number generation conflict, retry
        if (error instanceof Error && error.message.includes('PO number')) {
          console.warn(`PO approval attempt ${attempt} failed due to PO number conflict, retrying...`);
          // Small delay to reduce contention
          await new Promise(resolve => setTimeout(resolve, 50 * attempt));
          continue;
        }
        
        // For other errors, don't retry
        throw error;
      }
    }

    if (!approvedPO!) {
      throw new Error(`Failed to approve purchase order after ${maxRetries} attempts: ${lastError?.message}`);
    }

    // Log PO approval in audit trail
    await this.auditService.logPOApproval({
      tenantId,
      userId: approverId,
      poId,
      action: POAuditAction.APPROVED,
      oldValues: {
        status: po.status,
        approvedBy: po.approvedBy,
        approvedAt: po.approvedAt,
      },
      newValues: {
        status: approvedPO.status,
        approvedBy: approvedPO.approvedBy,
        approvedAt: approvedPO.approvedAt,
        poNumber: approvedPO.poNumber,
      },
      notes: `Purchase order approved by ${approverId}`,
    });

    // Record price history for all line items after successful approval
    // Requirements: 2.2, 2.6
    try {
      const items = await this.db
        .select()
        .from(poItems)
        .where(eq(poItems.poId, poId));

      for (const item of items) {
        await this.priceHistoryService.recordPriceHistory(item);
      }
    } catch (error) {
      // Log error but don't fail the approval - price history is supplementary
      console.error(`Failed to record price history for PO ${poId}:`, error);
    }

    return approvedPO;
  }

  /**
   * Receive a purchase order using state machine
   * Requirements: 2.5
   */
  async receivePO(poId: string, tenantId: string, receivingData: ReceivingData): Promise<PurchaseOrder> {
    if (!poId || !tenantId || !receivingData) {
      throw new Error('Purchase order ID, tenant ID, and receiving data are required');
    }

    // Get the current purchase order
    const po = await this.getPurchaseOrder(poId, tenantId);
    if (!po) {
      throw new Error('Purchase order not found');
    }

    // Verify receiver exists and belongs to tenant
    const [receiver] = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.id, receivingData.receivedBy),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);

    if (!receiver) {
      throw new Error('Receiver not found in this organization');
    }

    // Update line item quantities received
    for (const receivedItem of receivingData.receivedItems) {
      // Verify the line item exists and belongs to this PO
      const [existingItem] = await this.db
        .select()
        .from(poItems)
        .where(and(
          eq(poItems.id, receivedItem.poItemId),
          eq(poItems.poId, poId)
        ))
        .limit(1);

      if (!existingItem) {
        throw new Error(`Line item ${receivedItem.poItemId} not found in this purchase order`);
      }

      // Update the received quantity
      await this.db
        .update(poItems)
        .set({
          quantityReceived: receivedItem.quantityReceived,
          notes: receivedItem.notes || existingItem.notes,
          updatedAt: getCurrentTimestamp(),
        })
        .where(eq(poItems.id, receivedItem.poItemId));
    }

    // Use state machine to execute receiving transition
    const transitionContext: TransitionContext = {
      userId: receivingData.receivedBy,
      tenantId,
      reason: 'Purchase order received',
      metadata: {
        receivedDate: receivingData.receivedDate.toISOString(),
        itemsReceived: receivingData.receivedItems.length,
      },
    };

    const receivedPO = await this.stateMachine.executeTransition(po, POStatus.RECEIVED, transitionContext);

    // Log PO receiving in audit trail
    await this.auditService.logPOReceived({
      tenantId,
      userId: receivingData.receivedBy,
      poId,
      action: POAuditAction.RECEIVED,
      oldValues: {
        status: po.status,
        receivedBy: po.receivedBy,
        receivedAt: po.receivedAt,
      },
      newValues: {
        status: receivedPO.status,
        receivedBy: receivedPO.receivedBy,
        receivedAt: receivedPO.receivedAt,
        itemsReceived: receivingData.receivedItems.map(item => ({
          poItemId: item.poItemId,
          quantityReceived: item.quantityReceived,
          variance: item.variance,
        })),
      },
      notes: `Purchase order received with ${receivingData.receivedItems.length} items`,
    });

    return receivedPO;
  }

  /**
   * Cancel a purchase order using state machine
   * Requirements: 2.4, 2.5
   */
  async cancelPO(poId: string, tenantId: string, cancelledBy: string, reason?: string): Promise<PurchaseOrder> {
    if (!poId || !tenantId || !cancelledBy) {
      throw new Error('Purchase order ID, tenant ID, and cancelled by user ID are required');
    }

    // Get the current purchase order
    const po = await this.getPurchaseOrder(poId, tenantId);
    if (!po) {
      throw new Error('Purchase order not found');
    }

    // Verify canceller exists and belongs to tenant
    const [canceller] = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.id, cancelledBy),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);

    if (!canceller) {
      throw new Error('Canceller not found in this organization');
    }

    // Use state machine to execute cancellation transition
    const transitionContext: TransitionContext = {
      userId: cancelledBy,
      tenantId,
      reason: reason || 'Purchase order cancelled',
    };

    const cancelledPO = await this.stateMachine.executeTransition(po, POStatus.CANCELLED, transitionContext);

    // Log PO cancellation in audit trail
    await this.auditService.logPOCancelled({
      tenantId,
      userId: cancelledBy,
      poId,
      action: POAuditAction.CANCELLED,
      oldValues: {
        status: po.status,
      },
      newValues: {
        status: cancelledPO.status,
      },
      notes: reason || 'Purchase order cancelled',
    });

    return cancelledPO;
  }

  /**
   * Get purchase order with line items and supplier details
   * Requirements: 2.1, 2.2
   */
  async getPOWithItems(poId: string, tenantId: string): Promise<PurchaseOrderWithItems | null> {
    if (!poId || !tenantId) {
      return null;
    }

    // Get purchase order with supplier info
    const [poWithSupplier] = await this.db
      .select({
        po: purchaseOrders,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          contactEmail: suppliers.contactEmail,
          contactPhone: suppliers.contactPhone,
        },
      })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(and(
        eq(purchaseOrders.id, poId),
        eq(purchaseOrders.tenantId, tenantId)
      ))
      .limit(1);

    if (!poWithSupplier) {
      return null;
    }

    // Get line items for this PO
    const items = await this.db
      .select()
      .from(poItems)
      .where(eq(poItems.poId, poId))
      .orderBy(desc(poItems.createdAt));

    return {
      ...poWithSupplier.po,
      items,
      supplier: poWithSupplier.supplier,
    };
  }

  /**
   * List purchase orders with filtering and pagination
   * Requirements: 2.1, 2.3
   */
  async listPurchaseOrders(
    tenantId: string,
    options: {
      status?: POStatusType;
      supplierId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ purchaseOrders: PurchaseOrderWithItems[]; total: number }> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const { status, supplierId, limit = 20, offset = 0 } = options;

    // Build base query with tenant isolation
    let whereConditions = [eq(purchaseOrders.tenantId, tenantId)];

    if (status) {
      whereConditions.push(eq(purchaseOrders.status, status));
    }

    if (supplierId) {
      whereConditions.push(eq(purchaseOrders.supplierId, supplierId));
    }

    const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

    // Get purchase orders with supplier info
    const posWithSuppliers = await this.db
      .select({
        po: purchaseOrders,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          contactEmail: suppliers.contactEmail,
          contactPhone: suppliers.contactPhone,
        },
      })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(whereClause)
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(limit)
      .offset(offset);

    // Get line items for all POs
    const poIds = posWithSuppliers.map(p => p.po.id);
    const allItems = poIds.length > 0 ? await this.db
      .select()
      .from(poItems)
      .where(sql`${poItems.poId} IN (${sql.join(poIds.map((id: string) => sql`${id}`), sql`, `)})`)
      .orderBy(desc(poItems.createdAt)) : [];

    // Get total count for pagination
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseOrders)
      .where(whereClause);

    // Group items by PO ID
    const itemsByPO = allItems.reduce((acc, item) => {
      const poId = item.poId;
      if (!acc[poId]) {
        acc[poId] = [];
      }
      acc[poId].push(item);
      return acc;
    }, {} as Record<string, POItem[]>);

    // Combine POs with their items
    const purchaseOrdersWithItems: PurchaseOrderWithItems[] = posWithSuppliers.map(({ po, supplier }) => ({
      ...po,
      items: itemsByPO[po.id] || [],
      supplier,
    }));

    return {
      purchaseOrders: purchaseOrdersWithItems,
      total: countResult?.count || 0,
    };
  }

  /**
   * Get a purchase order by ID (internal helper)
   */
  private async getPurchaseOrder(poId: string, tenantId: string): Promise<PurchaseOrder | null> {
    const [po] = await this.db
      .select()
      .from(purchaseOrders)
      .where(and(
        eq(purchaseOrders.id, poId),
        eq(purchaseOrders.tenantId, tenantId)
      ))
      .limit(1);

    return po || null;
  }

  /**
   * Recalculate purchase order total based on line items
   * Requirements: 2.2
   */
  private async recalculatePOTotal(poId: string): Promise<void> {
    // Get all line items for this PO
    const items = await this.db
      .select()
      .from(poItems)
      .where(eq(poItems.poId, poId));

    // Calculate total
    const totalCostCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);

    // Update PO total
    await this.db
      .update(purchaseOrders)
      .set({
        totalCostCents,
        updatedAt: getCurrentTimestamp(),
      })
      .where(eq(purchaseOrders.id, poId));
  }

  /**
   * Validate that a PO number is unique within the tenant
   * Requirements: 2.4
   */
  async validatePONumberUniqueness(poNumber: string, tenantId: string): Promise<boolean> {
    if (!poNumber || !tenantId) {
      return false;
    }

    const [existingPO] = await this.db
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(and(
        eq(purchaseOrders.tenantId, tenantId),
        eq(purchaseOrders.poNumber, poNumber)
      ))
      .limit(1);

    return !existingPO; // Returns true if PO number is available
  }

  /**
   * Get PO number for a purchase order (if approved)
   * Requirements: 2.4
   */
  async getPONumber(poId: string, tenantId: string): Promise<string | null> {
    const po = await this.getPurchaseOrder(poId, tenantId);
    return po?.poNumber || null;
  }

  /**
   * Create multiple purchase orders from templates
   * Requirements: 2.3
   */
  async createBulkPOsFromTemplates(
    templates: BulkPOTemplate[], 
    tenantId: string, 
    createdBy: string
  ): Promise<BulkOperationResult<PurchaseOrder>> {
    const result: BulkOperationResult<PurchaseOrder> = {
      successful: [],
      failed: [],
      summary: {
        total: templates.length,
        successful: 0,
        failed: 0,
      },
    };

    for (const template of templates) {
      try {
        // Create the PO draft
        const po = await this.createDraft(template.supplierId, tenantId, createdBy);
        
        // Add all line items
        for (const item of template.items) {
          await this.addLineItem(po.id, tenantId, item);
        }

        // Update notes if provided
        if (template.notes) {
          await this.db
            .update(purchaseOrders)
            .set({
              notes: template.notes,
              updatedAt: getCurrentTimestamp(),
            })
            .where(eq(purchaseOrders.id, po.id));
        }

        result.successful.push({ id: po.id, data: po });
        result.summary.successful++;
      } catch (error) {
        result.failed.push({
          id: `template_${result.failed.length}`,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        result.summary.failed++;
      }
    }

    return result;
  }

  /**
   * Add multiple line items to a purchase order
   * Requirements: 2.3
   */
  async addBulkLineItems(
    poId: string, 
    tenantId: string, 
    items: BulkLineItemImport[]
  ): Promise<BulkOperationResult<POItem>> {
    const result: BulkOperationResult<POItem> = {
      successful: [],
      failed: [],
      summary: {
        total: items.length,
        successful: 0,
        failed: 0,
      },
    };

    // Verify PO exists and is in DRAFT status
    const po = await this.getPurchaseOrder(poId, tenantId);
    if (!po) {
      throw new Error('Purchase order not found');
    }

    if (po.status !== POStatus.DRAFT) {
      throw new Error('Can only add bulk items to draft purchase orders');
    }

    for (const item of items) {
      try {
        const addedItem = await this.addLineItem(poId, tenantId, item);
        result.successful.push({ id: addedItem.id, data: addedItem });
        result.summary.successful++;
      } catch (error) {
        result.failed.push({
          id: item.productId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        result.summary.failed++;
      }
    }

    return result;
  }

  /**
   * Approve multiple purchase orders in bulk
   * Requirements: 2.3
   */
  async bulkApprovePOs(
    request: BulkApprovalRequest, 
    tenantId: string
  ): Promise<BulkOperationResult<PurchaseOrder>> {
    const result: BulkOperationResult<PurchaseOrder> = {
      successful: [],
      failed: [],
      summary: {
        total: request.poIds.length,
        successful: 0,
        failed: 0,
      },
    };

    // Verify approver exists and belongs to tenant
    const [approver] = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.id, request.approverId),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);

    if (!approver) {
      throw new Error('Approver not found in this organization');
    }

    for (const poId of request.poIds) {
      try {
        const approvedPO = await this.approvePO(poId, tenantId, request.approverId);
        result.successful.push({ id: poId, data: approvedPO });
        result.summary.successful++;
      } catch (error) {
        result.failed.push({
          id: poId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        result.summary.failed++;
      }
    }

    return result;
  }
}

/**
 * Factory function to create PurchaseOrderService instance
 */
export function createPurchaseOrderService(db: DrizzleD1Database): PurchaseOrderService {
  return new PurchaseOrderServiceImpl(db);
}