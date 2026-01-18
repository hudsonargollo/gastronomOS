import { z } from 'zod';
import { UserRole, LocationType, POStatus, AllocationStatus, TransferStatus, TransferPriority } from '../db/schema';

// Common validation schemas
export const idSchema = z.string().min(1, 'ID is required');
export const tenantIdSchema = z.string().min(1, 'Tenant ID is required');
export const emailSchema = z.string().email('Invalid email format');
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');
export const nameSchema = z.string().min(1, 'Name is required').max(255, 'Name too long');
export const descriptionSchema = z.string().max(1000, 'Description too long').optional();

// Pagination schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Search and filter schema
export const searchSchema = z.object({
  search: z.string().optional(),
  active: z.coerce.boolean().optional(),
});

// User validation schemas
export const userRoleSchema = z.enum([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.VIEWER]);

export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  role: userRoleSchema,
  locationId: idSchema.optional(),
  active: z.boolean().default(true),
});

export const updateUserSchema = z.object({
  email: emailSchema.optional(),
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  role: userRoleSchema.optional(),
  locationId: idSchema.optional(),
  active: z.boolean().optional(),
});

export const userQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  role: userRoleSchema.optional(),
  locationId: idSchema.optional(),
  active: z.coerce.boolean().optional(),
});

// Location validation schemas
export const locationTypeSchema = z.enum([
  LocationType.RESTAURANT,
  LocationType.COMMISSARY,
  LocationType.WAREHOUSE,
  LocationType.POP_UP
]);

export const createLocationSchema = z.object({
  name: nameSchema,
  type: locationTypeSchema,
  address: z.string().max(500, 'Address too long').optional(),
  managerId: idSchema.optional(),
  active: z.boolean().default(true),
});

export const updateLocationSchema = z.object({
  name: nameSchema.optional(),
  type: locationTypeSchema.optional(),
  address: z.string().max(500, 'Address too long').optional(),
  managerId: idSchema.optional(),
  active: z.boolean().optional(),
});

export const locationQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  type: locationTypeSchema.optional(),
  managerId: idSchema.optional(),
  active: z.coerce.boolean().optional(),
});

// Category validation schemas
export const createCategorySchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  parentId: idSchema.optional(),
  sortOrder: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

export const updateCategorySchema = z.object({
  name: nameSchema.optional(),
  description: descriptionSchema,
  parentId: idSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const categoryQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  parentId: idSchema.optional(),
  active: z.coerce.boolean().optional(),
});

// Product validation schemas
export const productStatusSchema = z.enum(['ACTIVE', 'DISCONTINUED', 'ARCHIVED', 'PENDING_APPROVAL']);

export const createProductSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  categoryId: idSchema.optional(),
  unit: z.string().min(1, 'Unit is required').max(50, 'Unit too long'),
  price: z.number().int().min(0, 'Price must be non-negative').default(0),
  sku: z.string().max(100, 'SKU too long').optional(),
  barcode: z.string().max(100, 'Barcode too long').optional(),
  imageUrl: z.string().url('Invalid image URL').optional(),
  status: productStatusSchema.default('ACTIVE'),
  minStock: z.number().int().min(0, 'Min stock must be non-negative').default(0),
  maxStock: z.number().int().min(0, 'Max stock must be non-negative').default(0),
  reorderPoint: z.number().int().min(0, 'Reorder point must be non-negative').default(0),
  costCents: z.number().int().min(0, 'Cost must be non-negative').default(0),
  weight: z.number().min(0, 'Weight must be non-negative').optional(),
  dimensions: z.object({
    length: z.number().min(0).optional(),
    width: z.number().min(0).optional(),
    height: z.number().min(0).optional(),
  }).optional(),
  allergens: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  seasonalAvailability: z.object({
    startMonth: z.number().int().min(1).max(12).optional(),
    endMonth: z.number().int().min(1).max(12).optional(),
    notes: z.string().optional(),
  }).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(2000, 'Notes too long').optional(),
  active: z.boolean().default(true),
});

export const updateProductSchema = z.object({
  name: nameSchema.optional(),
  description: descriptionSchema,
  categoryId: idSchema.optional(),
  unit: z.string().min(1, 'Unit is required').max(50, 'Unit too long').optional(),
  price: z.number().int().min(0, 'Price must be non-negative').optional(),
  sku: z.string().max(100, 'SKU too long').optional(),
  barcode: z.string().max(100, 'Barcode too long').optional(),
  imageUrl: z.string().url('Invalid image URL').optional(),
  status: productStatusSchema.optional(),
  minStock: z.number().int().min(0, 'Min stock must be non-negative').optional(),
  maxStock: z.number().int().min(0, 'Max stock must be non-negative').optional(),
  reorderPoint: z.number().int().min(0, 'Reorder point must be non-negative').optional(),
  costCents: z.number().int().min(0, 'Cost must be non-negative').optional(),
  weight: z.number().min(0, 'Weight must be non-negative').optional(),
  dimensions: z.object({
    length: z.number().min(0).optional(),
    width: z.number().min(0).optional(),
    height: z.number().min(0).optional(),
  }).optional(),
  allergens: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  seasonalAvailability: z.object({
    startMonth: z.number().int().min(1).max(12).optional(),
    endMonth: z.number().int().min(1).max(12).optional(),
    notes: z.string().optional(),
  }).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(2000, 'Notes too long').optional(),
  active: z.boolean().optional(),
});

export const productQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  categoryId: idSchema.optional(),
  status: productStatusSchema.optional(),
  tags: z.array(z.string()).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  minStock: z.coerce.number().int().min(0).optional(),
  maxStock: z.coerce.number().int().min(0).optional(),
  hasVariants: z.coerce.boolean().optional(),
  active: z.coerce.boolean().optional(),
});

// Product variant schemas
export const createProductVariantSchema = z.object({
  name: nameSchema,
  sku: z.string().max(100, 'SKU too long').optional(),
  barcode: z.string().max(100, 'Barcode too long').optional(),
  price: z.number().int().min(0, 'Price must be non-negative').default(0),
  costCents: z.number().int().min(0, 'Cost must be non-negative').default(0),
  attributes: z.record(z.any()).optional(),
});

export const updateProductVariantSchema = createProductVariantSchema.partial();

// Product relationship schemas
export const productRelationshipTypeSchema = z.enum(['SUBSTITUTE', 'COMPLEMENT', 'BUNDLE', 'UPSELL', 'CROSS_SELL']);

export const createProductRelationshipSchema = z.object({
  relatedProductId: idSchema,
  relationshipType: productRelationshipTypeSchema,
  strength: z.number().min(0).max(1).default(1.0),
  notes: z.string().max(500, 'Notes too long').optional(),
});

// Product template schemas
export const createProductTemplateSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  categoryId: idSchema.optional(),
  templateData: z.record(z.any()),
});

// Bulk operations schemas
export const bulkUpdateProductsSchema = z.object({
  productIds: z.array(idSchema).min(1, 'At least one product ID is required'),
  updates: updateProductSchema,
});

// Import/Export schemas
export const importProductSchema = z.object({
  name: nameSchema,
  description: z.string().optional(),
  categoryName: z.string().optional(),
  unit: z.string().min(1, 'Unit is required'),
  price: z.number().min(0).optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  minStock: z.number().int().min(0).optional(),
  maxStock: z.number().int().min(0).optional(),
  reorderPoint: z.number().int().min(0).optional(),
  costCents: z.number().int().min(0).optional(),
  tags: z.string().optional(),
  notes: z.string().optional(),
});

export const importProductsSchema = z.array(importProductSchema);

// Inventory item validation schemas
export const createInventoryItemSchema = z.object({
  productId: idSchema,
  locationId: idSchema,
  quantity: z.number().int().min(0, 'Quantity must be non-negative').default(0),
  unitCost: z.number().int().min(0, 'Unit cost must be non-negative').default(0),
});

export const updateInventoryItemSchema = z.object({
  quantity: z.number().int().min(0, 'Quantity must be non-negative').optional(),
  unitCost: z.number().int().min(0, 'Unit cost must be non-negative').optional(),
});

export const inventoryQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  productId: idSchema.optional(),
  locationId: idSchema.optional(),
  minQuantity: z.coerce.number().int().min(0).optional(),
  maxQuantity: z.coerce.number().int().min(0).optional(),
});

// Supplier validation schemas
export const createSupplierSchema = z.object({
  name: nameSchema,
  contactEmail: emailSchema.optional(),
  contactPhone: z.string().max(50, 'Phone too long').optional(),
  address: z.string().max(500, 'Address too long').optional(),
  paymentTerms: z.string().max(200, 'Payment terms too long').optional(),
});

export const updateSupplierSchema = z.object({
  name: nameSchema.optional(),
  contactEmail: emailSchema.optional(),
  contactPhone: z.string().max(50, 'Phone too long').optional(),
  address: z.string().max(500, 'Address too long').optional(),
  paymentTerms: z.string().max(200, 'Payment terms too long').optional(),
});

export const supplierQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
});

// Purchase order validation schemas
export const poStatusSchema = z.enum([
  POStatus.DRAFT,
  POStatus.PENDING_APPROVAL,
  POStatus.APPROVED,
  POStatus.SENT_TO_SUPPLIER,
  POStatus.PARTIALLY_RECEIVED,
  POStatus.RECEIVED,
  POStatus.CANCELLED
]);

export const createPurchaseOrderSchema = z.object({
  supplierId: idSchema,
  poNumber: z.string().max(100, 'PO number too long').optional(),
  status: poStatusSchema.default(POStatus.DRAFT),
  notes: z.string().max(1000, 'Notes too long').optional(),
});

export const updatePurchaseOrderSchema = z.object({
  supplierId: idSchema.optional(),
  poNumber: z.string().max(100, 'PO number too long').optional(),
  status: poStatusSchema.optional(),
  notes: z.string().max(1000, 'Notes too long').optional(),
});

export const purchaseOrderQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  supplierId: idSchema.optional(),
  status: poStatusSchema.optional(),
  createdBy: idSchema.optional(),
});

// PO item validation schemas
export const createPOItemSchema = z.object({
  productId: idSchema,
  quantityOrdered: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPriceCents: z.number().int().min(0, 'Unit price must be non-negative'),
  notes: z.string().max(500, 'Notes too long').optional(),
});

export const updatePOItemSchema = z.object({
  quantityOrdered: z.number().int().min(1, 'Quantity must be at least 1').optional(),
  unitPriceCents: z.number().int().min(0, 'Unit price must be non-negative').optional(),
  quantityReceived: z.number().int().min(0, 'Quantity received must be non-negative').optional(),
  notes: z.string().max(500, 'Notes too long').optional(),
});

// Allocation validation schemas
export const allocationStatusSchema = z.enum([
  AllocationStatus.PENDING,
  AllocationStatus.ALLOCATED,
  AllocationStatus.PARTIALLY_RECEIVED,
  AllocationStatus.RECEIVED,
  AllocationStatus.CANCELLED
]);

export const createAllocationSchema = z.object({
  poItemId: idSchema,
  targetLocationId: idSchema,
  quantityAllocated: z.number().int().min(1, 'Quantity must be at least 1'),
  notes: z.string().max(500, 'Notes too long').optional(),
});

export const updateAllocationSchema = z.object({
  quantityAllocated: z.number().int().min(1, 'Quantity must be at least 1').optional(),
  quantityReceived: z.number().int().min(0, 'Quantity received must be non-negative').optional(),
  status: allocationStatusSchema.optional(),
  notes: z.string().max(500, 'Notes too long').optional(),
});

export const allocationQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  poItemId: idSchema.optional(),
  targetLocationId: idSchema.optional(),
  status: allocationStatusSchema.optional(),
  createdBy: idSchema.optional(),
});

// Transfer validation schemas
export const transferStatusSchema = z.enum([
  TransferStatus.REQUESTED,
  TransferStatus.APPROVED,
  TransferStatus.SHIPPED,
  TransferStatus.RECEIVED,
  TransferStatus.CANCELLED
]);

export const transferPrioritySchema = z.enum([
  TransferPriority.NORMAL,
  TransferPriority.HIGH,
  TransferPriority.EMERGENCY
]);

export const createTransferSchema = z.object({
  productId: idSchema,
  sourceLocationId: idSchema,
  destinationLocationId: idSchema,
  quantityRequested: z.number().int().min(1, 'Quantity must be at least 1'),
  priority: transferPrioritySchema.default(TransferPriority.NORMAL),
  notes: z.string().max(1000, 'Notes too long').optional(),
}).refine(data => data.sourceLocationId !== data.destinationLocationId, {
  message: 'Source and destination locations must be different',
  path: ['destinationLocationId'],
});

export const updateTransferSchema = z.object({
  quantityRequested: z.number().int().min(1, 'Quantity must be at least 1').optional(),
  quantityShipped: z.number().int().min(0, 'Quantity shipped must be non-negative').optional(),
  quantityReceived: z.number().int().min(0, 'Quantity received must be non-negative').optional(),
  status: transferStatusSchema.optional(),
  priority: transferPrioritySchema.optional(),
  varianceReason: z.string().max(500, 'Variance reason too long').optional(),
  cancellationReason: z.string().max(500, 'Cancellation reason too long').optional(),
  notes: z.string().max(1000, 'Notes too long').optional(),
});

export const transferQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  productId: idSchema.optional(),
  sourceLocationId: idSchema.optional(),
  destinationLocationId: idSchema.optional(),
  status: transferStatusSchema.optional(),
  priority: transferPrioritySchema.optional(),
  requestedBy: idSchema.optional(),
});

// Bulk operation schemas
export const bulkDeleteSchema = z.object({
  ids: z.array(idSchema).min(1, 'At least one ID is required'),
});

export const bulkUpdateSchema = z.object({
  ids: z.array(idSchema).min(1, 'At least one ID is required'),
  updates: z.record(z.any()),
});

// Export all schemas for easy import
export const validationSchemas = {
  // Common
  id: idSchema,
  tenantId: tenantIdSchema,
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  description: descriptionSchema,
  pagination: paginationSchema,
  search: searchSchema,
  
  // Users
  userRole: userRoleSchema,
  createUser: createUserSchema,
  updateUser: updateUserSchema,
  userQuery: userQuerySchema,
  
  // Locations
  locationType: locationTypeSchema,
  createLocation: createLocationSchema,
  updateLocation: updateLocationSchema,
  locationQuery: locationQuerySchema,
  
  // Categories
  createCategory: createCategorySchema,
  updateCategory: updateCategorySchema,
  categoryQuery: categoryQuerySchema,
  
  // Products
  productStatus: productStatusSchema,
  createProduct: createProductSchema,
  updateProduct: updateProductSchema,
  productQuery: productQuerySchema,
  createProductVariant: createProductVariantSchema,
  updateProductVariant: updateProductVariantSchema,
  productRelationshipType: productRelationshipTypeSchema,
  createProductRelationship: createProductRelationshipSchema,
  createProductTemplate: createProductTemplateSchema,
  bulkUpdateProducts: bulkUpdateProductsSchema,
  importProduct: importProductSchema,
  importProducts: importProductsSchema,
  
  // Inventory
  createInventoryItem: createInventoryItemSchema,
  updateInventoryItem: updateInventoryItemSchema,
  inventoryQuery: inventoryQuerySchema,
  
  // Suppliers
  createSupplier: createSupplierSchema,
  updateSupplier: updateSupplierSchema,
  supplierQuery: supplierQuerySchema,
  
  // Purchase Orders
  poStatus: poStatusSchema,
  createPurchaseOrder: createPurchaseOrderSchema,
  updatePurchaseOrder: updatePurchaseOrderSchema,
  purchaseOrderQuery: purchaseOrderQuerySchema,
  
  // PO Items
  createPOItem: createPOItemSchema,
  updatePOItem: updatePOItemSchema,
  
  // Allocations
  allocationStatus: allocationStatusSchema,
  createAllocation: createAllocationSchema,
  updateAllocation: updateAllocationSchema,
  allocationQuery: allocationQuerySchema,
  
  // Transfers
  transferStatus: transferStatusSchema,
  transferPriority: transferPrioritySchema,
  createTransfer: createTransferSchema,
  updateTransfer: updateTransferSchema,
  transferQuery: transferQuerySchema,
  
  // Bulk operations
  bulkDelete: bulkDeleteSchema,
  bulkUpdate: bulkUpdateSchema,
};