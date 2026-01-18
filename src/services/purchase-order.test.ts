import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPurchaseOrderService, PurchaseOrderServiceImpl } from './purchase-order';

// Mock the database
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
} as any;

// Mock the schema imports
vi.mock('../db/schema', () => ({
  purchaseOrders: { id: 'id', tenantId: 'tenant_id' },
  poItems: { id: 'id', poId: 'po_id' },
  suppliers: { id: 'id', tenantId: 'tenant_id' },
  products: { id: 'id', tenantId: 'tenant_id' },
  users: { id: 'id', tenantId: 'tenant_id' },
  POStatus: {
    DRAFT: 'DRAFT',
    APPROVED: 'APPROVED',
    RECEIVED: 'RECEIVED',
    CANCELLED: 'CANCELLED',
  },
}));

// Mock the utils
vi.mock('../utils', () => ({
  generateId: () => 'test-id',
  getCurrentTimestamp: () => 1234567890,
}));

describe('PurchaseOrderService', () => {
  let service: PurchaseOrderServiceImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PurchaseOrderServiceImpl(mockDb);
  });

  describe('createDraft', () => {
    it('should validate required parameters', async () => {
      await expect(service.createDraft('', 'tenant1', 'user1')).rejects.toThrow(
        'Supplier ID, tenant ID, and created by user ID are required'
      );
    });

    it('should create a purchase order service instance', () => {
      const service = createPurchaseOrderService(mockDb);
      expect(service).toBeInstanceOf(PurchaseOrderServiceImpl);
    });
  });

  describe('addLineItem', () => {
    it('should validate required parameters', async () => {
      await expect(service.addLineItem('', 'tenant1', {
        productId: 'prod1',
        quantityOrdered: 1,
        unitPriceCents: 100,
      })).rejects.toThrow('Purchase order ID and tenant ID are required');
    });

    it('should validate line item data', async () => {
      await expect(service.addLineItem('po1', 'tenant1', {
        productId: '',
        quantityOrdered: 0,
        unitPriceCents: 0,
      })).rejects.toThrow('Valid product ID, quantity, and unit price are required');
    });
  });

  describe('updateLineItem', () => {
    it('should validate required parameters', async () => {
      await expect(service.updateLineItem('', 'tenant1', {})).rejects.toThrow(
        'Line item ID and tenant ID are required'
      );
    });
  });

  describe('removeLineItem', () => {
    it('should validate required parameters', async () => {
      await expect(service.removeLineItem('', 'tenant1')).rejects.toThrow(
        'Line item ID and tenant ID are required'
      );
    });
  });

  describe('listPurchaseOrders', () => {
    it('should validate tenant ID', async () => {
      await expect(service.listPurchaseOrders('')).rejects.toThrow(
        'Tenant ID is required'
      );
    });
  });
});