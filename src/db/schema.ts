import { sqliteTable, text, integer, real, index, uniqueIndex, check } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Tenants table
export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  createdAt: integer('created_at').notNull(),
  settings: text('settings'),
}, (table) => ({
  slugUnique: uniqueIndex('tenants_slug_unique').on(table.slug),
}));

// Locations table
export const locations = sqliteTable('locations', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  type: text('type').notNull(),
  address: text('address'),
  managerId: text('manager_id').references(() => users.id),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantIdx: index('location_tenant_idx').on(table.tenantId),
  tenantTypeIdx: index('location_tenant_type_idx').on(table.tenantId, table.type),
  tenantNameIdx: index('location_tenant_name_idx').on(table.tenantId, table.name),
  typeIdx: index('location_type_idx').on(table.type),
  nameIdx: index('location_name_idx').on(table.name),
  managerIdx: index('location_manager_idx').on(table.managerId),
  activeIdx: index('location_active_idx').on(table.active),
  updatedAtIdx: index('location_updated_at_idx').on(table.updatedAt),
  typeCheck: check("type IN ('RESTAURANT', 'COMMISSARY', 'WAREHOUSE', 'POP_UP')"),
}));

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull(),
  locationId: text('location_id').references(() => locations.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  lastLoginAt: integer('last_login_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantIdx: index('user_tenant_idx').on(table.tenantId),
  emailIdx: index('user_email_idx').on(table.email),
  locationIdx: index('user_location_idx').on(table.locationId),
  tenantEmailUnique: uniqueIndex('users_tenant_id_email_unique').on(table.tenantId, table.email),
  tenantEmailIdx: index('user_tenant_email_idx').on(table.tenantId, table.email),
  tenantRoleIdx: index('user_tenant_role_idx').on(table.tenantId, table.role),
  tenantLocationIdx: index('user_tenant_location_idx').on(table.tenantId, table.locationId),
  roleIdx: index('user_role_idx').on(table.role),
  activeIdx: index('user_active_idx').on(table.active),
  lastLoginIdx: index('user_last_login_idx').on(table.lastLoginAt),
  updatedAtIdx: index('user_updated_at_idx').on(table.updatedAt),
}));

// Inventory items table
export const inventoryItems = sqliteTable('inventory_items', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  productId: text('product_id').notNull().references(() => products.id),
  locationId: text('location_id').notNull().references(() => locations.id),
  quantity: integer('quantity').notNull().default(0),
  unitCost: integer('unit_cost_cents').notNull().default(0),
  lastUpdated: integer('last_updated').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantIdx: index('inventory_item_tenant_idx').on(table.tenantId),
  productIdx: index('inventory_item_product_idx').on(table.productId),
  locationIdx: index('inventory_item_location_idx').on(table.locationId),
  tenantLocationIdx: index('inventory_item_tenant_location_idx').on(table.tenantId, table.locationId),
  tenantProductIdx: index('inventory_item_tenant_product_idx').on(table.tenantId, table.productId),
  locationProductIdx: index('inventory_item_location_product_idx').on(table.locationId, table.productId),
  productLocationUnique: uniqueIndex('inventory_items_product_id_location_id_unique').on(table.productId, table.locationId),
  quantityCheck: check('quantity >= 0'),
  unitCostCheck: check('unit_cost_cents >= 0'),
}));

// Auth audit log table
export const authAuditLog = sqliteTable('auth_audit_log', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id'),
  userId: text('user_id'),
  eventType: text('event_type').notNull(),
  resource: text('resource'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  tenantIdx: index('audit_tenant_idx').on(table.tenantId),
  userIdx: index('audit_user_idx').on(table.userId),
  eventTypeIdx: index('audit_event_type_idx').on(table.eventType),
  createdAtIdx: index('audit_created_at_idx').on(table.createdAt),
  tenantUserIdx: index('audit_tenant_user_idx').on(table.tenantId, table.userId),
  tenantEventTypeIdx: index('audit_tenant_event_type_idx').on(table.tenantId, table.eventType),
  tenantCreatedAtIdx: index('audit_tenant_created_at_idx').on(table.tenantId, table.createdAt),
  userEventTypeIdx: index('audit_user_event_type_idx').on(table.userId, table.eventType),
  eventTypeCreatedAtIdx: index('audit_event_type_created_at_idx').on(table.eventType, table.createdAt),
}));

// Categories table
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  description: text('description'),
  parentId: text('parent_id').references(() => categories.id),
  sortOrder: integer('sort_order').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantIdx: index('category_tenant_idx').on(table.tenantId),
  tenantNameIdx: index('category_tenant_name_idx').on(table.tenantId, table.name),
  parentIdx: index('category_parent_idx').on(table.parentId),
  sortOrderIdx: index('category_sort_order_idx').on(table.sortOrder),
  activeIdx: index('category_active_idx').on(table.active),
  tenantNameUnique: uniqueIndex('categories_tenant_id_name_unique').on(table.tenantId, table.name),
}));

// Products table
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  description: text('description'),
  categoryId: text('category_id').references(() => categories.id),
  unit: text('unit').notNull(),
  price: integer('price_cents').notNull().default(0),
  sku: text('sku'),
  barcode: text('barcode'),
  imageUrl: text('image_url'),
  status: text('status').notNull().default('ACTIVE'),
  minStock: integer('min_stock').default(0),
  maxStock: integer('max_stock').default(0),
  reorderPoint: integer('reorder_point').default(0),
  costCents: integer('cost_cents').default(0),
  marginPercent: real('margin_percent').default(0),
  weight: real('weight'),
  dimensions: text('dimensions'), // JSON string for length, width, height
  allergens: text('allergens'), // JSON array of allergen strings
  certifications: text('certifications'), // JSON array of certification strings
  seasonalAvailability: text('seasonal_availability'), // JSON object for seasonal data
  tags: text('tags'), // JSON array of tag strings
  notes: text('notes'),
  createdBy: text('created_by').references(() => users.id),
  updatedBy: text('updated_by').references(() => users.id),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantIdx: index('product_tenant_idx').on(table.tenantId),
  tenantNameIdx: index('product_tenant_name_idx').on(table.tenantId, table.name),
  categoryIdx: index('product_category_idx').on(table.categoryId),
  skuIdx: index('product_sku_idx').on(table.sku),
  barcodeIdx: index('product_barcode_idx').on(table.barcode),
  statusIdx: index('product_status_idx').on(table.status),
  activeIdx: index('product_active_idx').on(table.active),
  tenantSkuUnique: uniqueIndex('products_tenant_id_sku_unique').on(table.tenantId, table.sku),
  tenantBarcodeUnique: uniqueIndex('products_tenant_id_barcode_unique').on(table.tenantId, table.barcode),
  statusCheck: check("status IN ('ACTIVE', 'DISCONTINUED', 'ARCHIVED', 'PENDING_APPROVAL')"),
}));

// Suppliers table
export const suppliers = sqliteTable('suppliers', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  address: text('address'),
  paymentTerms: text('payment_terms'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantIdx: index('supplier_tenant_idx').on(table.tenantId),
  tenantNameIdx: index('supplier_tenant_name_idx').on(table.tenantId, table.name),
  tenantNameUnique: uniqueIndex('suppliers_tenant_id_name_unique').on(table.tenantId, table.name),
}));

// Purchase orders table
export const purchaseOrders = sqliteTable('purchase_orders', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  supplierId: text('supplier_id').notNull().references(() => suppliers.id),
  poNumber: text('po_number'),
  status: text('status').notNull(),
  totalCostCents: integer('total_cost_cents'),
  createdBy: text('created_by').notNull().references(() => users.id),
  approvedBy: text('approved_by').references(() => users.id),
  approvedAt: integer('approved_at'),
  receivedBy: text('received_by').references(() => users.id),
  receivedAt: integer('received_at'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantIdx: index('po_tenant_idx').on(table.tenantId),
  tenantStatusIdx: index('po_tenant_status_idx').on(table.tenantId, table.status),
  tenantSupplierIdx: index('po_tenant_supplier_idx').on(table.tenantId, table.supplierId),
  statusIdx: index('po_status_idx').on(table.status),
  supplierIdx: index('po_supplier_idx').on(table.supplierId),
  createdByIdx: index('po_created_by_idx').on(table.createdBy),
  approvedAtIdx: index('po_approved_at_idx').on(table.approvedAt),
  tenantPoNumberUnique: uniqueIndex('purchase_orders_tenant_id_po_number_unique').on(table.tenantId, table.poNumber),
}));

// PO items table
export const poItems = sqliteTable('po_items', {
  id: text('id').primaryKey(),
  poId: text('po_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => products.id),
  quantityOrdered: integer('quantity_ordered').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  quantityReceived: integer('quantity_received').default(0),
  lineTotalCents: integer('line_total_cents').notNull(),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  poIdx: index('po_item_po_idx').on(table.poId),
  productIdx: index('po_item_product_idx').on(table.productId),
  poProductIdx: index('po_item_po_product_idx').on(table.poId, table.productId),
}));

// Price history table
export const priceHistory = sqliteTable('price_history', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  supplierId: text('supplier_id').notNull().references(() => suppliers.id),
  productId: text('product_id').notNull().references(() => products.id),
  unitPriceCents: integer('unit_price_cents').notNull(),
  poId: text('po_id').notNull().references(() => purchaseOrders.id),
  recordedAt: integer('recorded_at').notNull(),
}, (table) => ({
  lookupIdx: index('price_history_lookup_idx').on(table.tenantId, table.supplierId, table.productId, table.recordedAt),
  tenantIdx: index('price_history_tenant_idx').on(table.tenantId),
  supplierProductIdx: index('price_history_supplier_product_idx').on(table.supplierId, table.productId),
  recordedAtIdx: index('price_history_recorded_at_idx').on(table.recordedAt),
}));

// PO audit log table
export const poAuditLog = sqliteTable('po_audit_log', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  poId: text('po_id').notNull().references(() => purchaseOrders.id),
  action: text('action').notNull(),
  oldValues: text('old_values'),
  newValues: text('new_values'),
  performedBy: text('performed_by').notNull().references(() => users.id),
  performedAt: integer('performed_at').notNull(),
  notes: text('notes'),
}, (table) => ({
  tenantIdx: index('po_audit_tenant_idx').on(table.tenantId),
  tenantPoIdx: index('po_audit_tenant_po_idx').on(table.tenantId, table.poId),
  poIdx: index('po_audit_po_idx').on(table.poId),
  actionIdx: index('po_audit_action_idx').on(table.action),
  performedByIdx: index('po_audit_performed_by_idx').on(table.performedBy),
  performedAtIdx: index('po_audit_performed_at_idx').on(table.performedAt),
}));

// Receipt processing jobs table
export const receiptProcessingJobs = sqliteTable('receipt_processing_jobs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  userId: text('user_id').notNull().references(() => users.id),
  r2Key: text('r2_key').notNull(),
  status: text('status').notNull(),
  processingOptions: text('processing_options'),
  createdAt: integer('created_at').notNull(),
  startedAt: integer('started_at'),
  completedAt: integer('completed_at'),
  retryCount: integer('retry_count').default(0),
  errorMessage: text('error_message'),
}, (table) => ({
  tenantStatusIdx: index('receipt_jobs_tenant_status_idx').on(table.tenantId, table.status),
  userIdx: index('receipt_jobs_user_idx').on(table.userId),
  statusIdx: index('receipt_jobs_status_idx').on(table.status),
  createdAtIdx: index('receipt_jobs_created_at_idx').on(table.createdAt),
}));

// Receipts table
export const receipts = sqliteTable('receipts', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  processingJobId: text('processing_job_id').notNull().references(() => receiptProcessingJobs.id),
  r2Key: text('r2_key').notNull(),
  vendorName: text('vendor_name'),
  transactionDate: integer('transaction_date'),
  totalAmountCents: integer('total_amount_cents'),
  subtotalCents: integer('subtotal_cents'),
  taxCents: integer('tax_cents'),
  currency: text('currency').default('USD'),
  confidenceScore: real('confidence_score'),
  requiresManualReview: integer('requires_manual_review').default(false),
  linkedPoId: text('linked_po_id').references(() => purchaseOrders.id),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantDateIdx: index('receipts_tenant_date_idx').on(table.tenantId, table.transactionDate),
  jobIdx: index('receipts_job_idx').on(table.processingJobId),
  tenantVendorIdx: index('receipts_tenant_vendor_idx').on(table.tenantId, table.vendorName),
  linkedPoIdx: index('receipts_linked_po_idx').on(table.linkedPoId),
  reviewIdx: index('receipts_review_idx').on(table.requiresManualReview),
}));

// Receipt line items table
export const receiptLineItems = sqliteTable('receipt_line_items', {
  id: text('id').primaryKey(),
  receiptId: text('receipt_id').notNull().references(() => receipts.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: real('quantity'),
  unitPriceCents: integer('unit_price_cents'),
  totalPriceCents: integer('total_price_cents'),
  matchedProductId: text('matched_product_id').references(() => products.id),
  matchConfidence: real('match_confidence'),
  requiresManualReview: integer('requires_manual_review').default(false),
  rawText: text('raw_text'),
  coordinates: text('coordinates'),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  receiptIdx: index('receipt_line_items_receipt_idx').on(table.receiptId),
  productIdx: index('receipt_line_items_product_idx').on(table.matchedProductId),
  reviewIdx: index('receipt_line_items_review_idx').on(table.requiresManualReview),
}));

// Product match candidates table
export const productMatchCandidates = sqliteTable('product_match_candidates', {
  id: text('id').primaryKey(),
  receiptLineItemId: text('receipt_line_item_id').notNull().references(() => receiptLineItems.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => products.id),
  similarityScore: real('similarity_score').notNull(),
  matchType: text('match_type').notNull(),
  confidence: real('confidence').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  lineItemIdx: index('product_matches_line_item_idx').on(table.receiptLineItemId),
  productIdx: index('product_matches_product_idx').on(table.productId),
  similarityIdx: index('product_matches_similarity_idx').on(table.similarityScore),
}));

// Receipt processing stats table
export const receiptProcessingStats = sqliteTable('receipt_processing_stats', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  dateBucket: text('date_bucket').notNull(),
  totalProcessed: integer('total_processed').default(0),
  successfulProcessed: integer('successful_processed').default(0),
  failedProcessed: integer('failed_processed').default(0),
  manualReviewRequired: integer('manual_review_required').default(0),
  avgProcessingTimeMs: integer('avg_processing_time_ms').default(0),
  avgConfidenceScore: real('avg_confidence_score').default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantDateIdx: index('receipt_stats_tenant_date_idx').on(table.tenantId, table.dateBucket),
  dateBucketIdx: index('receipt_stats_date_bucket_idx').on(table.dateBucket),
  tenantDateUnique: uniqueIndex('receipt_processing_stats_tenant_id_date_bucket_unique').on(table.tenantId, table.dateBucket),
}));

// Allocations table
export const allocations = sqliteTable('allocations', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  poItemId: text('po_item_id').notNull().references(() => poItems.id),
  targetLocationId: text('target_location_id').notNull().references(() => locations.id),
  quantityAllocated: integer('quantity_allocated').notNull(),
  quantityReceived: integer('quantity_received').default(0),
  status: text('status').notNull(),
  notes: text('notes'),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantIdx: index('allocation_tenant_idx').on(table.tenantId),
  poItemIdx: index('allocation_po_item_idx').on(table.poItemId),
  locationIdx: index('allocation_location_idx').on(table.targetLocationId),
  statusIdx: index('allocation_status_idx').on(table.status),
  tenantStatusIdx: index('allocation_tenant_status_idx').on(table.tenantId, table.status),
  tenantLocationIdx: index('allocation_tenant_location_idx').on(table.tenantId, table.targetLocationId),
  createdByIdx: index('allocation_created_by_idx').on(table.createdBy),
  poItemLocationUnique: uniqueIndex('allocations_po_item_id_target_location_id_unique').on(table.poItemId, table.targetLocationId),
}));

// Allocation templates table
export const allocationTemplates = sqliteTable('allocation_templates', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  description: text('description'),
  templateData: text('template_data').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantIdx: index('allocation_template_tenant_idx').on(table.tenantId),
  tenantNameIdx: index('allocation_template_tenant_name_idx').on(table.tenantId, table.name),
  createdByIdx: index('allocation_template_created_by_idx').on(table.createdBy),
  tenantNameUnique: uniqueIndex('allocation_templates_tenant_id_name_unique').on(table.tenantId, table.name),
}));

// Allocation audit log table
export const allocationAuditLog = sqliteTable('allocation_audit_log', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  allocationId: text('allocation_id').notNull().references(() => allocations.id),
  action: text('action').notNull(),
  oldValues: text('old_values'),
  newValues: text('new_values'),
  performedBy: text('performed_by').notNull().references(() => users.id),
  performedAt: integer('performed_at').notNull(),
  notes: text('notes'),
}, (table) => ({
  tenantIdx: index('allocation_audit_tenant_idx').on(table.tenantId),
  allocationIdx: index('allocation_audit_allocation_idx').on(table.allocationId),
  tenantAllocationIdx: index('allocation_audit_tenant_allocation_idx').on(table.tenantId, table.allocationId),
  actionIdx: index('allocation_audit_action_idx').on(table.action),
  performedByIdx: index('allocation_audit_performed_by_idx').on(table.performedBy),
  performedAtIdx: index('allocation_audit_performed_at_idx').on(table.performedAt),
}));

// Transfers table
export const transfers = sqliteTable('transfers', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  productId: text('product_id').notNull().references(() => products.id),
  sourceLocationId: text('source_location_id').notNull().references(() => locations.id),
  destinationLocationId: text('destination_location_id').notNull().references(() => locations.id),
  quantityRequested: integer('quantity_requested').notNull(),
  quantityShipped: integer('quantity_shipped').default(0),
  quantityReceived: integer('quantity_received').default(0),
  status: text('status').notNull(),
  priority: text('priority').notNull(),
  requestedBy: text('requested_by').notNull().references(() => users.id),
  approvedBy: text('approved_by').references(() => users.id),
  approvedAt: integer('approved_at'),
  shippedBy: text('shipped_by').references(() => users.id),
  shippedAt: integer('shipped_at'),
  receivedBy: text('received_by').references(() => users.id),
  receivedAt: integer('received_at'),
  cancelledBy: text('cancelled_by').references(() => users.id),
  cancelledAt: integer('cancelled_at'),
  cancellationReason: text('cancellation_reason'),
  varianceReason: text('variance_reason'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantStatusIdx: index('transfers_tenant_status_idx').on(table.tenantId, table.status),
  sourceLocationIdx: index('transfers_source_location_idx').on(table.sourceLocationId, table.status),
  destinationLocationIdx: index('transfers_destination_location_idx').on(table.destinationLocationId, table.status),
  productIdx: index('transfers_product_idx').on(table.productId, table.status),
  requestedByIdx: index('transfers_requested_by_idx').on(table.requestedBy),
  statusIdx: index('transfers_status_idx').on(table.status),
  priorityIdx: index('transfers_priority_idx').on(table.priority),
  createdAtIdx: index('transfers_created_at_idx').on(table.createdAt),
  sourceDestinationCheck: check('source_location_id != destination_location_id'),
  quantityRequestedCheck: check('quantity_requested > 0'),
  quantityShippedCheck: check('quantity_shipped >= 0'),
  quantityReceivedCheck: check('quantity_received >= 0'),
  statusCheck: check("status IN ('REQUESTED', 'APPROVED', 'SHIPPED', 'RECEIVED', 'CANCELLED')"),
  priorityCheck: check("priority IN ('NORMAL', 'HIGH', 'EMERGENCY')"),
}));

// Transfer audit log table
export const transferAuditLog = sqliteTable('transfer_audit_log', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  transferId: text('transfer_id').notNull().references(() => transfers.id),
  action: text('action').notNull(),
  oldStatus: text('old_status'),
  newStatus: text('new_status'),
  oldValues: text('old_values'),
  newValues: text('new_values'),
  performedBy: text('performed_by').notNull().references(() => users.id),
  performedAt: integer('performed_at').notNull(),
  notes: text('notes'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
}, (table) => ({
  tenantIdx: index('transfer_audit_tenant_idx').on(table.tenantId),
  transferIdx: index('transfer_audit_transfer_idx').on(table.transferId),
  tenantTransferIdx: index('transfer_audit_tenant_transfer_idx').on(table.tenantId, table.transferId),
  actionIdx: index('transfer_audit_action_idx').on(table.action),
  performedByIdx: index('transfer_audit_performed_by_idx').on(table.performedBy),
  performedAtIdx: index('transfer_audit_performed_at_idx').on(table.performedAt),
  actionCheck: check("action IN ('CREATED', 'APPROVED', 'REJECTED', 'SHIPPED', 'RECEIVED', 'CANCELLED')"),
}));

// Inventory reservations table
export const inventoryReservations = sqliteTable('inventory_reservations', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  transferId: text('transfer_id').notNull().references(() => transfers.id),
  productId: text('product_id').notNull().references(() => products.id),
  locationId: text('location_id').notNull().references(() => locations.id),
  quantityReserved: integer('quantity_reserved').notNull(),
  reservedBy: text('reserved_by').notNull().references(() => users.id),
  reservedAt: integer('reserved_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  releasedAt: integer('released_at'),
}, (table) => ({
  tenantIdx: index('inventory_reservations_tenant_idx').on(table.tenantId),
  transferIdx: index('inventory_reservations_transfer_idx').on(table.transferId),
  locationProductIdx: index('inventory_reservations_location_product_idx').on(table.locationId, table.productId),
  activeIdx: index('inventory_reservations_active_idx').on(table.locationId, table.productId, table.releasedAt),
  expiresAtIdx: index('inventory_reservations_expires_at_idx').on(table.expiresAt),
  productLocationTransferUnique: uniqueIndex('inventory_reservations_product_id_location_id_transfer_id_unique').on(table.productId, table.locationId, table.transferId),
  quantityReservedCheck: check('quantity_reserved > 0'),
}));

// Transfer allocations table
export const transferAllocations = sqliteTable('transfer_allocations', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  transferId: text('transfer_id').notNull().references(() => transfers.id),
  allocationId: text('allocation_id').notNull().references(() => allocations.id),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  tenantIdx: index('transfer_allocations_tenant_idx').on(table.tenantId),
  transferIdx: index('transfer_allocations_transfer_idx').on(table.transferId),
  allocationIdx: index('transfer_allocations_allocation_idx').on(table.allocationId),
  transferAllocationUnique: uniqueIndex('transfer_allocations_transfer_id_allocation_id_unique').on(table.transferId, table.allocationId),
}));

// Product variants table
export const productVariants = sqliteTable('product_variants', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sku: text('sku'),
  barcode: text('barcode'),
  price: integer('price_cents').notNull().default(0),
  costCents: integer('cost_cents').default(0),
  attributes: text('attributes'), // JSON object for variant attributes
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantIdx: index('product_variant_tenant_idx').on(table.tenantId),
  productIdx: index('product_variant_product_idx').on(table.productId),
  skuIdx: index('product_variant_sku_idx').on(table.sku),
  barcodeIdx: index('product_variant_barcode_idx').on(table.barcode),
  tenantSkuUnique: uniqueIndex('product_variants_tenant_id_sku_unique').on(table.tenantId, table.sku),
  tenantBarcodeUnique: uniqueIndex('product_variants_tenant_id_barcode_unique').on(table.tenantId, table.barcode),
}));

// Product relationships table (substitutes, complements, etc.)
export const productRelationships = sqliteTable('product_relationships', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  relatedProductId: text('related_product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  relationshipType: text('relationship_type').notNull(),
  strength: real('strength').default(1.0), // Relationship strength (0.0 to 1.0)
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  tenantIdx: index('product_relationship_tenant_idx').on(table.tenantId),
  productIdx: index('product_relationship_product_idx').on(table.productId),
  relatedProductIdx: index('product_relationship_related_product_idx').on(table.relatedProductId),
  typeIdx: index('product_relationship_type_idx').on(table.relationshipType),
  productRelatedUnique: uniqueIndex('product_relationships_product_id_related_product_id_type_unique').on(table.productId, table.relatedProductId, table.relationshipType),
  typeCheck: check("relationship_type IN ('SUBSTITUTE', 'COMPLEMENT', 'BUNDLE', 'UPSELL', 'CROSS_SELL')"),
}));

// Product templates table
export const productTemplates = sqliteTable('product_templates', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  description: text('description'),
  categoryId: text('category_id').references(() => categories.id),
  templateData: text('template_data').notNull(), // JSON object with default values
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantIdx: index('product_template_tenant_idx').on(table.tenantId),
  tenantNameIdx: index('product_template_tenant_name_idx').on(table.tenantId, table.name),
  categoryIdx: index('product_template_category_idx').on(table.categoryId),
  createdByIdx: index('product_template_created_by_idx').on(table.createdBy),
  tenantNameUnique: uniqueIndex('product_templates_tenant_id_name_unique').on(table.tenantId, table.name),
}));

// Product audit log table
export const productAuditLog = sqliteTable('product_audit_log', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  productId: text('product_id').notNull().references(() => products.id),
  action: text('action').notNull(),
  oldValues: text('old_values'),
  newValues: text('new_values'),
  performedBy: text('performed_by').notNull().references(() => users.id),
  performedAt: integer('performed_at').notNull(),
  notes: text('notes'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
}, (table) => ({
  tenantIdx: index('product_audit_tenant_idx').on(table.tenantId),
  productIdx: index('product_audit_product_idx').on(table.productId),
  tenantProductIdx: index('product_audit_tenant_product_idx').on(table.tenantId, table.productId),
  actionIdx: index('product_audit_action_idx').on(table.action),
  performedByIdx: index('product_audit_performed_by_idx').on(table.performedBy),
  performedAtIdx: index('product_audit_performed_at_idx').on(table.performedAt),
  actionCheck: check("action IN ('CREATED', 'UPDATED', 'DELETED', 'ARCHIVED', 'RESTORED', 'STATUS_CHANGED')"),
}));

// Product analytics table
export const productAnalytics = sqliteTable('product_analytics', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  productId: text('product_id').notNull().references(() => products.id),
  dateBucket: text('date_bucket').notNull(), // YYYY-MM-DD format
  totalOrdered: integer('total_ordered').default(0),
  totalReceived: integer('total_received').default(0),
  totalCostCents: integer('total_cost_cents').default(0),
  avgUnitCostCents: integer('avg_unit_cost_cents').default(0),
  orderCount: integer('order_count').default(0),
  supplierCount: integer('supplier_count').default(0),
  locationCount: integer('location_count').default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantIdx: index('product_analytics_tenant_idx').on(table.tenantId),
  productIdx: index('product_analytics_product_idx').on(table.productId),
  dateBucketIdx: index('product_analytics_date_bucket_idx').on(table.dateBucket),
  tenantDateIdx: index('product_analytics_tenant_date_idx').on(table.tenantId, table.dateBucket),
  productDateIdx: index('product_analytics_product_date_idx').on(table.productId, table.dateBucket),
  tenantProductDateUnique: uniqueIndex('product_analytics_tenant_id_product_id_date_bucket_unique').on(table.tenantId, table.productId, table.dateBucket),
}));

// Type definitions
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;

export type AuthAuditLog = typeof authAuditLog.$inferSelect;
export type NewAuthAuditLog = typeof authAuditLog.$inferInsert;

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert;

export type POItem = typeof poItems.$inferSelect;
export type NewPOItem = typeof poItems.$inferInsert;

export type PriceHistory = typeof priceHistory.$inferSelect;
export type NewPriceHistory = typeof priceHistory.$inferInsert;

export type POAuditLog = typeof poAuditLog.$inferSelect;
export type NewPOAuditLog = typeof poAuditLog.$inferInsert;

export type ReceiptProcessingJob = typeof receiptProcessingJobs.$inferSelect;
export type NewReceiptProcessingJob = typeof receiptProcessingJobs.$inferInsert;

export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;

export type ReceiptLineItem = typeof receiptLineItems.$inferSelect;
export type NewReceiptLineItem = typeof receiptLineItems.$inferInsert;

export type ProductMatchCandidate = typeof productMatchCandidates.$inferSelect;
export type NewProductMatchCandidate = typeof productMatchCandidates.$inferInsert;

export type ReceiptProcessingStats = typeof receiptProcessingStats.$inferSelect;
export type NewReceiptProcessingStats = typeof receiptProcessingStats.$inferInsert;

export type Allocation = typeof allocations.$inferSelect;
export type NewAllocation = typeof allocations.$inferInsert;

export type AllocationTemplate = typeof allocationTemplates.$inferSelect;
export type NewAllocationTemplate = typeof allocationTemplates.$inferInsert;

export type AllocationAuditLog = typeof allocationAuditLog.$inferSelect;
export type NewAllocationAuditLog = typeof allocationAuditLog.$inferInsert;

export type Transfer = typeof transfers.$inferSelect;
export type NewTransfer = typeof transfers.$inferInsert;

export type TransferAuditLog = typeof transferAuditLog.$inferSelect;
export type NewTransferAuditLog = typeof transferAuditLog.$inferInsert;

export type InventoryReservation = typeof inventoryReservations.$inferSelect;
export type NewInventoryReservation = typeof inventoryReservations.$inferInsert;

export type TransferAllocation = typeof transferAllocations.$inferSelect;
export type NewTransferAllocation = typeof transferAllocations.$inferInsert;

export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;

export type ProductRelationship = typeof productRelationships.$inferSelect;
export type NewProductRelationship = typeof productRelationships.$inferInsert;

export type ProductTemplate = typeof productTemplates.$inferSelect;
export type NewProductTemplate = typeof productTemplates.$inferInsert;

export type ProductAuditLog = typeof productAuditLog.$inferSelect;
export type NewProductAuditLog = typeof productAuditLog.$inferInsert;

export type ProductAnalytics = typeof productAnalytics.$inferSelect;
export type NewProductAnalytics = typeof productAnalytics.$inferInsert;

// Digital Menu System Types
export type MenuItem = typeof menuItems.$inferSelect;
export type NewMenuItem = typeof menuItems.$inferInsert;

export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;

export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type NewRecipeIngredient = typeof recipeIngredients.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

export type OrderStateTransition = typeof orderStateTransitions.$inferSelect;
export type NewOrderStateTransition = typeof orderStateTransitions.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type SplitPayment = typeof splitPayments.$inferSelect;
export type NewSplitPayment = typeof splitPayments.$inferInsert;

export type Commission = typeof commissions.$inferSelect;
export type NewCommission = typeof commissions.$inferInsert;

export type CommissionConfig = typeof commissionConfigs.$inferSelect;
export type NewCommissionConfig = typeof commissionConfigs.$inferInsert;

export type PaymentGatewayConfig = typeof paymentGatewayConfigs.$inferSelect;
export type NewPaymentGatewayConfig = typeof paymentGatewayConfigs.$inferInsert;

export type InventoryConsumption = typeof inventoryConsumptions.$inferSelect;
export type NewInventoryConsumption = typeof inventoryConsumptions.$inferInsert;

export type StockAlertConfig = typeof stockAlertConfigs.$inferSelect;
export type NewStockAlertConfig = typeof stockAlertConfigs.$inferInsert;

export type StockAlert = typeof stockAlerts.$inferSelect;
export type NewStockAlert = typeof stockAlerts.$inferInsert;

export type StockAlertNotification = typeof stockAlertNotifications.$inferSelect;
export type NewStockAlertNotification = typeof stockAlertNotifications.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

// Enum types and values
export const UserRoleType = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  STAFF: 'STAFF',
  VIEWER: 'VIEWER'
} as const;

export type UserRole = typeof UserRoleType[keyof typeof UserRoleType];

export const POStatusType = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  SENT_TO_SUPPLIER: 'SENT_TO_SUPPLIER',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED'
} as const;

export type POStatus = typeof POStatusType[keyof typeof POStatusType];

export const ReceiptProcessingStatusType = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REQUIRES_REVIEW: 'REQUIRES_REVIEW'
} as const;

export type ReceiptProcessingStatus = typeof ReceiptProcessingStatusType[keyof typeof ReceiptProcessingStatusType];

export const AllocationStatusType = {
  PENDING: 'PENDING',
  ALLOCATED: 'ALLOCATED',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED'
} as const;

export type AllocationStatus = typeof AllocationStatusType[keyof typeof AllocationStatusType];

export const AllocationAuditActionType = {
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  CANCELLED: 'CANCELLED',
  RECEIVED: 'RECEIVED'
} as const;

export type AllocationAuditAction = typeof AllocationAuditActionType[keyof typeof AllocationAuditActionType];

export const TransferStatusType = {
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  SHIPPED: 'SHIPPED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED'
} as const;

export type TransferStatus = typeof TransferStatusType[keyof typeof TransferStatusType];

export const TransferPriorityType = {
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  EMERGENCY: 'EMERGENCY'
} as const;

export type TransferPriority = typeof TransferPriorityType[keyof typeof TransferPriorityType];

export const TransferAuditActionType = {
  CREATED: 'CREATED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SHIPPED: 'SHIPPED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED'
} as const;

export type TransferAuditAction = typeof TransferAuditActionType[keyof typeof TransferAuditActionType];

export const POAuditActionType = {
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  APPROVED: 'APPROVED',
  SENT_TO_SUPPLIER: 'SENT_TO_SUPPLIER',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED'
} as const;

export type POAuditAction = typeof POAuditActionType[keyof typeof POAuditActionType];

// Export enum values for runtime usage
export const UserRole = UserRoleType;

export const LocationType = {
  RESTAURANT: 'RESTAURANT',
  COMMISSARY: 'COMMISSARY',
  WAREHOUSE: 'WAREHOUSE',
  POP_UP: 'POP_UP'
} as const;

export type LocationTypeValue = typeof LocationType[keyof typeof LocationType];

export const POStatus = POStatusType;
export const ReceiptProcessingStatus = ReceiptProcessingStatusType;
export const AllocationStatus = AllocationStatusType;
export const AllocationAuditAction = AllocationAuditActionType;
export const TransferStatus = TransferStatusType;
export const TransferPriority = TransferPriorityType;
export const TransferAuditAction = TransferAuditActionType;
export const POAuditAction = POAuditActionType;

// Product status types
export const ProductStatusType = {
  ACTIVE: 'ACTIVE',
  DISCONTINUED: 'DISCONTINUED',
  ARCHIVED: 'ARCHIVED',
  PENDING_APPROVAL: 'PENDING_APPROVAL'
} as const;

export type ProductStatus = typeof ProductStatusType[keyof typeof ProductStatusType];

// Product relationship types
export const ProductRelationshipType = {
  SUBSTITUTE: 'SUBSTITUTE',
  COMPLEMENT: 'COMPLEMENT',
  BUNDLE: 'BUNDLE',
  UPSELL: 'UPSELL',
  CROSS_SELL: 'CROSS_SELL'
} as const;

export type ProductRelationshipTypeValue = typeof ProductRelationshipType[keyof typeof ProductRelationshipType];

// Product audit action types
export const ProductAuditActionType = {
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  DELETED: 'DELETED',
  ARCHIVED: 'ARCHIVED',
  RESTORED: 'RESTORED',
  STATUS_CHANGED: 'STATUS_CHANGED'
} as const;

export type ProductAuditAction = typeof ProductAuditActionType[keyof typeof ProductAuditActionType];

export const ProductStatus = ProductStatusType;
export const ProductRelationshipTypeEnum = ProductRelationshipType;
export const ProductAuditAction = ProductAuditActionType;

// Order system enum types
export const OrderStateType = {
  PLACED: 'PLACED',
  PREPARING: 'PREPARING',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED'
} as const;

export type OrderState = typeof OrderStateType[keyof typeof OrderStateType];

export const OrderItemStatusType = {
  PENDING: 'PENDING',
  PREPARING: 'PREPARING',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED'
} as const;

export type OrderItemStatus = typeof OrderItemStatusType[keyof typeof OrderItemStatusType];

export const PaymentMethodType = {
  PIX: 'PIX',
  CREDIT_CARD: 'CREDIT_CARD',
  DEBIT_CARD: 'DEBIT_CARD',
  MANUAL_CARD: 'MANUAL_CARD',
  CASH: 'CASH'
} as const;

export type PaymentMethod = typeof PaymentMethodType[keyof typeof PaymentMethodType];

export const PaymentStatusType = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
} as const;

export type PaymentStatus = typeof PaymentStatusType[keyof typeof PaymentStatusType];

export const CommissionTypeEnum = {
  PERCENTAGE: 'PERCENTAGE',
  FIXED_VALUE: 'FIXED_VALUE'
} as const;

export type CommissionType = typeof CommissionTypeEnum[keyof typeof CommissionTypeEnum];

export const PaymentGatewayProviderType = {
  MERCADO_PAGO: 'MERCADO_PAGO'
} as const;

export type PaymentGatewayProvider = typeof PaymentGatewayProviderType[keyof typeof PaymentGatewayProviderType];

// Export enum values for runtime usage
export const OrderState = OrderStateType;
export const OrderItemStatus = OrderItemStatusType;
export const PaymentMethod = PaymentMethodType;
export const PaymentStatus = PaymentStatusType;
export const CommissionType = CommissionTypeEnum;
export const PaymentGatewayProvider = PaymentGatewayProviderType;

// Stock alert enum types
export const StockAlertType = {
  LOW_STOCK: 'LOW_STOCK',
  CRITICAL_STOCK: 'CRITICAL_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK'
} as const;

export type StockAlertTypeValue = typeof StockAlertType[keyof typeof StockAlertType];

export const StockAlertSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
} as const;

export type StockAlertSeverityValue = typeof StockAlertSeverity[keyof typeof StockAlertSeverity];

export const NotificationType = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  PUSH: 'PUSH',
  WEBHOOK: 'WEBHOOK'
} as const;

export type NotificationTypeValue = typeof NotificationType[keyof typeof NotificationType];

export const NotificationStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
} as const;

export type NotificationStatusValue = typeof NotificationStatus[keyof typeof NotificationStatus];

// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  locations: many(locations),
  users: many(users),
  categories: many(categories),
  products: many(products),
  inventoryItems: many(inventoryItems),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [locations.tenantId],
    references: [tenants.id],
  }),
  manager: one(users, {
    fields: [locations.managerId],
    references: [users.id],
  }),
  users: many(users),
  inventoryItems: many(inventoryItems),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  location: one(locations, {
    fields: [users.locationId],
    references: [locations.id],
  }),
  managedLocations: many(locations),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [categories.tenantId],
    references: [tenants.id],
  }),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
  }),
  children: many(categories),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [products.tenantId],
    references: [tenants.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  createdByUser: one(users, {
    fields: [products.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [products.updatedBy],
    references: [users.id],
  }),
  inventoryItems: many(inventoryItems),
  variants: many(productVariants),
  relationships: many(productRelationships),
  relatedFrom: many(productRelationships),
  auditLogs: many(productAuditLog),
  analytics: many(productAnalytics),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  tenant: one(tenants, {
    fields: [productVariants.tenantId],
    references: [tenants.id],
  }),
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
}));

export const productRelationshipsRelations = relations(productRelationships, ({ one }) => ({
  tenant: one(tenants, {
    fields: [productRelationships.tenantId],
    references: [tenants.id],
  }),
  product: one(products, {
    fields: [productRelationships.productId],
    references: [products.id],
  }),
  relatedProduct: one(products, {
    fields: [productRelationships.relatedProductId],
    references: [products.id],
  }),
}));

export const productTemplatesRelations = relations(productTemplates, ({ one }) => ({
  tenant: one(tenants, {
    fields: [productTemplates.tenantId],
    references: [tenants.id],
  }),
  category: one(categories, {
    fields: [productTemplates.categoryId],
    references: [categories.id],
  }),
  createdByUser: one(users, {
    fields: [productTemplates.createdBy],
    references: [users.id],
  }),
}));

export const productAuditLogRelations = relations(productAuditLog, ({ one }) => ({
  tenant: one(tenants, {
    fields: [productAuditLog.tenantId],
    references: [tenants.id],
  }),
  product: one(products, {
    fields: [productAuditLog.productId],
    references: [products.id],
  }),
  performedByUser: one(users, {
    fields: [productAuditLog.performedBy],
    references: [users.id],
  }),
}));

export const productAnalyticsRelations = relations(productAnalytics, ({ one }) => ({
  tenant: one(tenants, {
    fields: [productAnalytics.tenantId],
    references: [tenants.id],
  }),
  product: one(products, {
    fields: [productAnalytics.productId],
    references: [products.id],
  }),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [inventoryItems.tenantId],
    references: [tenants.id],
  }),
  product: one(products, {
    fields: [inventoryItems.productId],
    references: [products.id],
  }),
  location: one(locations, {
    fields: [inventoryItems.locationId],
    references: [locations.id],
  }),
}));

// Digital Menu System Tables

// Menu items table
export const menuItems = sqliteTable('menu_items', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  description: text('description'),
  price: integer('price_cents').notNull(),
  categoryId: text('category_id').references(() => categories.id),
  isAvailable: integer('is_available', { mode: 'boolean' }).notNull().default(true),
  preparationTime: integer('preparation_time').notNull().default(15), // minutes
  imageUrl: text('image_url'),
  allergens: text('allergens'), // JSON array
  nutritionalInfo: text('nutritional_info'), // JSON object
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantIdx: index('menu_item_tenant_idx').on(table.tenantId),
  tenantNameIdx: index('menu_item_tenant_name_idx').on(table.tenantId, table.name),
  categoryIdx: index('menu_item_category_idx').on(table.categoryId),
  availableIdx: index('menu_item_available_idx').on(table.isAvailable),
  activeIdx: index('menu_item_active_idx').on(table.active),
  tenantNameUnique: uniqueIndex('menu_items_tenant_id_name_unique').on(table.tenantId, table.name),
}));

// Recipes table
export const recipes = sqliteTable('recipes', {
  id: text('id').primaryKey(),
  menuItemId: text('menu_item_id').notNull().references(() => menuItems.id, { onDelete: 'cascade' }),
  instructions: text('instructions'),
  preparationTime: integer('preparation_time').notNull(), // minutes
  servingSize: integer('serving_size').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  menuItemIdx: index('recipe_menu_item_idx').on(table.menuItemId),
  menuItemUnique: uniqueIndex('recipes_menu_item_id_unique').on(table.menuItemId),
}));

// Recipe ingredients table
export const recipeIngredients = sqliteTable('recipe_ingredients', {
  id: text('id').primaryKey(),
  recipeId: text('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => products.id),
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  isOptional: integer('is_optional', { mode: 'boolean' }).notNull().default(false),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  recipeIdx: index('recipe_ingredient_recipe_idx').on(table.recipeId),
  productIdx: index('recipe_ingredient_product_idx').on(table.productId),
  recipeProductUnique: uniqueIndex('recipe_ingredients_recipe_id_product_id_unique').on(table.recipeId, table.productId),
}));

// Orders table
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  orderNumber: text('order_number').notNull(),
  state: text('state').notNull(),
  tableNumber: text('table_number'),
  waiterId: text('waiter_id').references(() => users.id),
  locationId: text('location_id').notNull().references(() => locations.id),
  totalAmount: integer('total_amount_cents').notNull().default(0),
  subtotalAmount: integer('subtotal_amount_cents').notNull().default(0),
  taxAmount: integer('tax_amount_cents').notNull().default(0),
  specialInstructions: text('special_instructions'),
  estimatedReadyTime: integer('estimated_ready_time'),
  actualReadyTime: integer('actual_ready_time'),
  version: integer('version').notNull().default(1), // for optimistic locking
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantIdx: index('order_tenant_idx').on(table.tenantId),
  tenantStateIdx: index('order_tenant_state_idx').on(table.tenantId, table.state),
  tenantLocationIdx: index('order_tenant_location_idx').on(table.tenantId, table.locationId),
  waiterIdx: index('order_waiter_idx').on(table.waiterId),
  locationIdx: index('order_location_idx').on(table.locationId),
  stateIdx: index('order_state_idx').on(table.state),
  createdAtIdx: index('order_created_at_idx').on(table.createdAt),
  tenantOrderNumberUnique: uniqueIndex('orders_tenant_id_order_number_unique').on(table.tenantId, table.orderNumber),
  stateCheck: check("state IN ('PLACED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED')"),
}));

// Order items table
export const orderItems = sqliteTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  menuItemId: text('menu_item_id').notNull().references(() => menuItems.id),
  quantity: integer('quantity').notNull(),
  unitPrice: integer('unit_price_cents').notNull(),
  totalPrice: integer('total_price_cents').notNull(),
  specialInstructions: text('special_instructions'),
  status: text('status').notNull().default('PENDING'),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  orderIdx: index('order_item_order_idx').on(table.orderId),
  menuItemIdx: index('order_item_menu_item_idx').on(table.menuItemId),
  statusIdx: index('order_item_status_idx').on(table.status),
  statusCheck: check("status IN ('PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED')"),
  quantityCheck: check('quantity > 0'),
  unitPriceCheck: check('unit_price_cents >= 0'),
  totalPriceCheck: check('total_price_cents >= 0'),
}));

// Order state transitions audit log
export const orderStateTransitions = sqliteTable('order_state_transitions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  orderId: text('order_id').notNull().references(() => orders.id),
  fromState: text('from_state'),
  toState: text('to_state').notNull(),
  transitionedBy: text('transitioned_by').references(() => users.id),
  transitionedAt: integer('transitioned_at').notNull(),
  reason: text('reason'),
  metadata: text('metadata'), // JSON object for additional data
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
}, (table) => ({
  tenantIdx: index('order_transition_tenant_idx').on(table.tenantId),
  orderIdx: index('order_transition_order_idx').on(table.orderId),
  tenantOrderIdx: index('order_transition_tenant_order_idx').on(table.tenantId, table.orderId),
  transitionedByIdx: index('order_transition_transitioned_by_idx').on(table.transitionedBy),
  transitionedAtIdx: index('order_transition_transitioned_at_idx').on(table.transitionedAt),
  fromStateIdx: index('order_transition_from_state_idx').on(table.fromState),
  toStateIdx: index('order_transition_to_state_idx').on(table.toState),
}));

// Payments table
export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  orderId: text('order_id').notNull().references(() => orders.id),
  method: text('method').notNull(),
  amount: integer('amount_cents').notNull(),
  status: text('status').notNull(),
  gatewayTransactionId: text('gateway_transaction_id'),
  gatewayResponse: text('gateway_response'), // JSON object
  processedBy: text('processed_by').references(() => users.id),
  createdAt: integer('created_at').notNull(),
  processedAt: integer('processed_at'),
  failedAt: integer('failed_at'),
  errorMessage: text('error_message'),
}, (table) => ({
  tenantIdx: index('payment_tenant_idx').on(table.tenantId),
  orderIdx: index('payment_order_idx').on(table.orderId),
  tenantOrderIdx: index('payment_tenant_order_idx').on(table.tenantId, table.orderId),
  methodIdx: index('payment_method_idx').on(table.method),
  statusIdx: index('payment_status_idx').on(table.status),
  processedByIdx: index('payment_processed_by_idx').on(table.processedBy),
  createdAtIdx: index('payment_created_at_idx').on(table.createdAt),
  methodCheck: check("method IN ('PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'MANUAL_CARD', 'CASH')"),
  statusCheck: check("status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')"),
  amountCheck: check('amount_cents > 0'),
}));

// Split payments table
export const splitPayments = sqliteTable('split_payments', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  orderId: text('order_id').notNull().references(() => orders.id),
  totalAmount: integer('total_amount_cents').notNull(),
  paidAmount: integer('paid_amount_cents').notNull().default(0),
  remainingAmount: integer('remaining_amount_cents').notNull(),
  isComplete: integer('is_complete', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  completedAt: integer('completed_at'),
}, (table) => ({
  tenantIdx: index('split_payment_tenant_idx').on(table.tenantId),
  orderIdx: index('split_payment_order_idx').on(table.orderId),
  tenantOrderIdx: index('split_payment_tenant_order_idx').on(table.tenantId, table.orderId),
  isCompleteIdx: index('split_payment_is_complete_idx').on(table.isComplete),
  orderUnique: uniqueIndex('split_payments_order_id_unique').on(table.orderId),
  totalAmountCheck: check('total_amount_cents > 0'),
  paidAmountCheck: check('paid_amount_cents >= 0'),
  remainingAmountCheck: check('remaining_amount_cents >= 0'),
}));

// Commissions table
export const commissions = sqliteTable('commissions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  waiterId: text('waiter_id').notNull().references(() => users.id),
  orderId: text('order_id').notNull().references(() => orders.id),
  orderAmount: integer('order_amount_cents').notNull(),
  commissionRate: real('commission_rate').notNull(),
  commissionAmount: integer('commission_amount_cents').notNull(),
  commissionType: text('commission_type').notNull(),
  calculatedAt: integer('calculated_at').notNull(),
  paidAt: integer('paid_at'),
  notes: text('notes'),
}, (table) => ({
  tenantIdx: index('commission_tenant_idx').on(table.tenantId),
  waiterIdx: index('commission_waiter_idx').on(table.waiterId),
  orderIdx: index('commission_order_idx').on(table.orderId),
  tenantWaiterIdx: index('commission_tenant_waiter_idx').on(table.tenantId, table.waiterId),
  calculatedAtIdx: index('commission_calculated_at_idx').on(table.calculatedAt),
  paidAtIdx: index('commission_paid_at_idx').on(table.paidAt),
  orderUnique: uniqueIndex('commissions_order_id_unique').on(table.orderId),
  commissionTypeCheck: check("commission_type IN ('PERCENTAGE', 'FIXED_VALUE')"),
  orderAmountCheck: check('order_amount_cents > 0'),
  commissionRateCheck: check('commission_rate >= 0'),
  commissionAmountCheck: check('commission_amount_cents >= 0'),
}));

// Commission configurations table
export const commissionConfigs = sqliteTable('commission_configs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  defaultType: text('default_type').notNull(),
  defaultRate: real('default_rate').notNull(),
  menuItemId: text('menu_item_id').references(() => menuItems.id),
  itemSpecificType: text('item_specific_type'),
  itemSpecificRate: real('item_specific_rate'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantIdx: index('commission_config_tenant_idx').on(table.tenantId),
  menuItemIdx: index('commission_config_menu_item_idx').on(table.menuItemId),
  activeIdx: index('commission_config_active_idx').on(table.active),
  tenantMenuItemUnique: uniqueIndex('commission_configs_tenant_id_menu_item_id_unique').on(table.tenantId, table.menuItemId),
  defaultTypeCheck: check("default_type IN ('PERCENTAGE', 'FIXED_VALUE')"),
  itemSpecificTypeCheck: check("item_specific_type IN ('PERCENTAGE', 'FIXED_VALUE') OR item_specific_type IS NULL"),
  defaultRateCheck: check('default_rate >= 0'),
  itemSpecificRateCheck: check('item_specific_rate >= 0 OR item_specific_rate IS NULL'),
}));

// Payment gateway configurations table
export const paymentGatewayConfigs = sqliteTable('payment_gateway_configs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  provider: text('provider').notNull(),
  accessToken: text('access_token').notNull(), // encrypted
  publicKey: text('public_key').notNull(),
  webhookUrl: text('webhook_url'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantIdx: index('payment_gateway_config_tenant_idx').on(table.tenantId),
  providerIdx: index('payment_gateway_config_provider_idx').on(table.provider),
  isActiveIdx: index('payment_gateway_config_is_active_idx').on(table.isActive),
  tenantProviderUnique: uniqueIndex('payment_gateway_configs_tenant_id_provider_unique').on(table.tenantId, table.provider),
  providerCheck: check("provider IN ('MERCADO_PAGO')"),
}));

// Inventory consumption log table
export const inventoryConsumptions = sqliteTable('inventory_consumptions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  orderId: text('order_id').notNull().references(() => orders.id),
  productId: text('product_id').notNull().references(() => products.id),
  locationId: text('location_id').notNull().references(() => locations.id),
  quantityConsumed: real('quantity_consumed').notNull(),
  unit: text('unit').notNull(),
  consumedAt: integer('consumed_at').notNull(),
  reversedAt: integer('reversed_at'), // if order was cancelled
  reversedBy: text('reversed_by').references(() => users.id),
  notes: text('notes'),
}, (table) => ({
  tenantIdx: index('inventory_consumption_tenant_idx').on(table.tenantId),
  orderIdx: index('inventory_consumption_order_idx').on(table.orderId),
  productIdx: index('inventory_consumption_product_idx').on(table.productId),
  locationIdx: index('inventory_consumption_location_idx').on(table.locationId),
  tenantOrderIdx: index('inventory_consumption_tenant_order_idx').on(table.tenantId, table.orderId),
  consumedAtIdx: index('inventory_consumption_consumed_at_idx').on(table.consumedAt),
  reversedAtIdx: index('inventory_consumption_reversed_at_idx').on(table.reversedAt),
  quantityConsumedCheck: check('quantity_consumed > 0'),
}));

// Digital Menu System Relations
export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [menuItems.tenantId],
    references: [tenants.id],
  }),
  category: one(categories, {
    fields: [menuItems.categoryId],
    references: [categories.id],
  }),
  recipe: one(recipes),
  orderItems: many(orderItems),
  commissionConfigs: many(commissionConfigs),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  menuItem: one(menuItems, {
    fields: [recipes.menuItemId],
    references: [menuItems.id],
  }),
  ingredients: many(recipeIngredients),
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeIngredients.recipeId],
    references: [recipes.id],
  }),
  product: one(products, {
    fields: [recipeIngredients.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [orders.tenantId],
    references: [tenants.id],
  }),
  waiter: one(users, {
    fields: [orders.waiterId],
    references: [users.id],
  }),
  location: one(locations, {
    fields: [orders.locationId],
    references: [locations.id],
  }),
  items: many(orderItems),
  stateTransitions: many(orderStateTransitions),
  payments: many(payments),
  splitPayment: one(splitPayments),
  commission: one(commissions),
  inventoryConsumptions: many(inventoryConsumptions),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  menuItem: one(menuItems, {
    fields: [orderItems.menuItemId],
    references: [menuItems.id],
  }),
}));

export const orderStateTransitionsRelations = relations(orderStateTransitions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [orderStateTransitions.tenantId],
    references: [tenants.id],
  }),
  order: one(orders, {
    fields: [orderStateTransitions.orderId],
    references: [orders.id],
  }),
  transitionedByUser: one(users, {
    fields: [orderStateTransitions.transitionedBy],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
  processedByUser: one(users, {
    fields: [payments.processedBy],
    references: [users.id],
  }),
}));

export const splitPaymentsRelations = relations(splitPayments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [splitPayments.tenantId],
    references: [tenants.id],
  }),
  order: one(orders, {
    fields: [splitPayments.orderId],
    references: [orders.id],
  }),
}));

export const commissionsRelations = relations(commissions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [commissions.tenantId],
    references: [tenants.id],
  }),
  waiter: one(users, {
    fields: [commissions.waiterId],
    references: [users.id],
  }),
  order: one(orders, {
    fields: [commissions.orderId],
    references: [orders.id],
  }),
}));

export const commissionConfigsRelations = relations(commissionConfigs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [commissionConfigs.tenantId],
    references: [tenants.id],
  }),
  menuItem: one(menuItems, {
    fields: [commissionConfigs.menuItemId],
    references: [menuItems.id],
  }),
}));

export const paymentGatewayConfigsRelations = relations(paymentGatewayConfigs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [paymentGatewayConfigs.tenantId],
    references: [tenants.id],
  }),
}));

export const inventoryConsumptionsRelations = relations(inventoryConsumptions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [inventoryConsumptions.tenantId],
    references: [tenants.id],
  }),
  order: one(orders, {
    fields: [inventoryConsumptions.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [inventoryConsumptions.productId],
    references: [products.id],
  }),
  location: one(locations, {
    fields: [inventoryConsumptions.locationId],
    references: [locations.id],
  }),
  reversedByUser: one(users, {
    fields: [inventoryConsumptions.reversedBy],
    references: [users.id],
  }),
}));

// Stock alert configurations table
export const stockAlertConfigs = sqliteTable('stock_alert_configs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  productId: text('product_id').notNull().references(() => products.id),
  locationId: text('location_id').notNull().references(() => locations.id),
  lowStockThreshold: integer('low_stock_threshold').notNull(),
  criticalStockThreshold: integer('critical_stock_threshold').notNull(),
  outOfStockThreshold: integer('out_of_stock_threshold').notNull().default(0),
  alertEnabled: integer('alert_enabled', { mode: 'boolean' }).notNull().default(true),
  emailNotifications: integer('email_notifications', { mode: 'boolean' }).notNull().default(true),
  smsNotifications: integer('sms_notifications', { mode: 'boolean' }).notNull().default(false),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantIdx: index('stock_alert_config_tenant_idx').on(table.tenantId),
  productIdx: index('stock_alert_config_product_idx').on(table.productId),
  locationIdx: index('stock_alert_config_location_idx').on(table.locationId),
  tenantProductLocationIdx: index('stock_alert_config_tenant_product_location_idx').on(table.tenantId, table.productId, table.locationId),
  alertEnabledIdx: index('stock_alert_config_alert_enabled_idx').on(table.alertEnabled),
  tenantProductLocationUnique: uniqueIndex('stock_alert_configs_tenant_id_product_id_location_id_unique').on(table.tenantId, table.productId, table.locationId),
  lowStockCheck: check('low_stock_threshold >= critical_stock_threshold'),
  criticalStockCheck: check('critical_stock_threshold >= out_of_stock_threshold'),
  outOfStockCheck: check('out_of_stock_threshold >= 0'),
}));

// Stock alerts table
export const stockAlerts = sqliteTable('stock_alerts', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  productId: text('product_id').notNull().references(() => products.id),
  locationId: text('location_id').notNull().references(() => locations.id),
  alertType: text('alert_type').notNull(),
  currentStock: integer('current_stock').notNull(),
  threshold: integer('threshold').notNull(),
  severity: text('severity').notNull(),
  message: text('message').notNull(),
  acknowledged: integer('acknowledged', { mode: 'boolean' }).notNull().default(false),
  acknowledgedBy: text('acknowledged_by').references(() => users.id),
  acknowledgedAt: integer('acknowledged_at'),
  resolved: integer('resolved', { mode: 'boolean' }).notNull().default(false),
  resolvedAt: integer('resolved_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantIdx: index('stock_alert_tenant_idx').on(table.tenantId),
  productIdx: index('stock_alert_product_idx').on(table.productId),
  locationIdx: index('stock_alert_location_idx').on(table.locationId),
  tenantProductLocationIdx: index('stock_alert_tenant_product_location_idx').on(table.tenantId, table.productId, table.locationId),
  alertTypeIdx: index('stock_alert_alert_type_idx').on(table.alertType),
  severityIdx: index('stock_alert_severity_idx').on(table.severity),
  acknowledgedIdx: index('stock_alert_acknowledged_idx').on(table.acknowledged),
  resolvedIdx: index('stock_alert_resolved_idx').on(table.resolved),
  createdAtIdx: index('stock_alert_created_at_idx').on(table.createdAt),
  tenantUnresolvedIdx: index('stock_alert_tenant_unresolved_idx').on(table.tenantId, table.resolved),
  alertTypeCheck: check("alert_type IN ('LOW_STOCK', 'CRITICAL_STOCK', 'OUT_OF_STOCK')"),
  severityCheck: check("severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')"),
  currentStockCheck: check('current_stock >= 0'),
  thresholdCheck: check('threshold >= 0'),
}));

// Stock alert notifications table
export const stockAlertNotifications = sqliteTable('stock_alert_notifications', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  alertId: text('alert_id').notNull().references(() => stockAlerts.id, { onDelete: 'cascade' }),
  notificationType: text('notification_type').notNull(),
  recipient: text('recipient').notNull(),
  status: text('status').notNull(),
  sentAt: integer('sent_at'),
  deliveredAt: integer('delivered_at'),
  failedAt: integer('failed_at'),
  errorMessage: text('error_message'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  tenantIdx: index('stock_alert_notification_tenant_idx').on(table.tenantId),
  alertIdx: index('stock_alert_notification_alert_idx').on(table.alertId),
  typeIdx: index('stock_alert_notification_type_idx').on(table.notificationType),
  statusIdx: index('stock_alert_notification_status_idx').on(table.status),
  sentAtIdx: index('stock_alert_notification_sent_at_idx').on(table.sentAt),
  typeCheck: check("notification_type IN ('EMAIL', 'SMS', 'PUSH', 'WEBHOOK')"),
  statusCheck: check("status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED')"),
  retryCountCheck: check('retry_count >= 0'),
}));

// Stock alert relations
export const stockAlertConfigsRelations = relations(stockAlertConfigs, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [stockAlertConfigs.tenantId],
    references: [tenants.id],
  }),
  product: one(products, {
    fields: [stockAlertConfigs.productId],
    references: [products.id],
  }),
  location: one(locations, {
    fields: [stockAlertConfigs.locationId],
    references: [locations.id],
  }),
  createdByUser: one(users, {
    fields: [stockAlertConfigs.createdBy],
    references: [users.id],
  }),
  alerts: many(stockAlerts),
}));

export const stockAlertsRelations = relations(stockAlerts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [stockAlerts.tenantId],
    references: [tenants.id],
  }),
  product: one(products, {
    fields: [stockAlerts.productId],
    references: [products.id],
  }),
  location: one(locations, {
    fields: [stockAlerts.locationId],
    references: [locations.id],
  }),
  acknowledgedByUser: one(users, {
    fields: [stockAlerts.acknowledgedBy],
    references: [users.id],
  }),
  notifications: many(stockAlertNotifications),
}));

export const stockAlertNotificationsRelations = relations(stockAlertNotifications, ({ one }) => ({
  tenant: one(tenants, {
    fields: [stockAlertNotifications.tenantId],
    references: [tenants.id],
  }),
  alert: one(stockAlerts, {
    fields: [stockAlertNotifications.alertId],
    references: [stockAlerts.id],
  }),
}));

// Comprehensive audit logs table for all system operations
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  entityType: text('entity_type').notNull(), // 'order', 'payment', 'inventory', etc.
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(), // 'CREATE', 'UPDATE', 'DELETE', 'STATE_CHANGE', etc.
  oldValue: text('old_value'), // JSON string of old values
  newValue: text('new_value'), // JSON string of new values
  userId: text('user_id').references(() => users.id),
  userType: text('user_type').notNull(), // 'waiter', 'kitchen', 'cashier', 'manager', 'system'
  timestamp: integer('timestamp').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  metadata: text('metadata'), // JSON string for additional context
}, (table) => ({
  tenantIdx: index('audit_log_tenant_idx').on(table.tenantId),
  entityTypeIdx: index('audit_log_entity_type_idx').on(table.entityType),
  entityIdIdx: index('audit_log_entity_id_idx').on(table.entityId),
  tenantEntityIdx: index('audit_log_tenant_entity_idx').on(table.tenantId, table.entityType, table.entityId),
  actionIdx: index('audit_log_action_idx').on(table.action),
  userIdIdx: index('audit_log_user_id_idx').on(table.userId),
  userTypeIdx: index('audit_log_user_type_idx').on(table.userType),
  timestampIdx: index('audit_log_timestamp_idx').on(table.timestamp),
  tenantTimestampIdx: index('audit_log_tenant_timestamp_idx').on(table.tenantId, table.timestamp),
  userTypeCheck: check("user_type IN ('waiter', 'kitchen', 'cashier', 'manager', 'system', 'customer')"),
}));

// Audit logs relations
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [auditLogs.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));