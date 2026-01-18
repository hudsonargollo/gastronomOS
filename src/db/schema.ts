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
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  tenantIdx: index('location_tenant_idx').on(table.tenantId),
  tenantTypeIdx: index('location_tenant_type_idx').on(table.tenantId, table.type),
  tenantNameIdx: index('location_tenant_name_idx').on(table.tenantId, table.name),
  typeIdx: index('location_type_idx').on(table.type),
  nameIdx: index('location_name_idx').on(table.name),
}));

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull(),
  locationId: text('location_id').references(() => locations.id),
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
  updatedAtIdx: index('user_updated_at_idx').on(table.updatedAt),
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

// Products table
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  unit: text('unit').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  tenantIdx: index('product_tenant_idx').on(table.tenantId),
  tenantNameIdx: index('product_tenant_name_idx').on(table.tenantId, table.name),
  categoryIdx: index('product_category_idx').on(table.category),
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

// Type definitions
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

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
export const POStatus = POStatusType;
export const ReceiptProcessingStatus = ReceiptProcessingStatusType;
export const AllocationStatus = AllocationStatusType;
export const AllocationAuditAction = AllocationAuditActionType;
export const TransferStatus = TransferStatusType;
export const TransferPriority = TransferPriorityType;
export const TransferAuditAction = TransferAuditActionType;
export const POAuditAction = POAuditActionType;