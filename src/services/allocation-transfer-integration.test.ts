import { describe, it, expect, beforeEach, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { createAllocationTransferIntegrationService } from './allocation-transfer-integration';

// Mock the database
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
} as any;

// Mock the services
vi.mock('./transfer', () => ({
  createTransferService: vi.fn(() => ({
    createTransferRequest: vi.fn(),
    getTransfer: vi.fn(),
  })),
}));

vi.mock('./allocation', () => ({
  createAllocationService: vi.fn(() => ({
    getAllocation: vi.fn(),
    updateAllocationStatus: vi.fn(),
  })),
}));

describe('AllocationTransferIntegrationService', () => {
  let service: ReturnType<typeof createAllocationTransferIntegrationService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createAllocationTransferIntegrationService(mockDb);
  });

  describe('createTransferFromAllocationWithDestination', () => {
    it('should throw error when allocation ID is missing', async () => {
      await expect(
        service.createTransferFromAllocationWithDestination('', 'dest-1', 'tenant-1', 'user-1')
      ).rejects.toThrow('Allocation ID is required');
    });

    it('should throw error when destination location ID is missing', async () => {
      await expect(
        service.createTransferFromAllocationWithDestination('alloc-1', '', 'tenant-1', 'user-1')
      ).rejects.toThrow('Destination location ID is required');
    });
  });

  describe('linkTransferToAllocation', () => {
    it('should throw error when transfer ID is missing', async () => {
      await expect(
        service.linkTransferToAllocation('', 'alloc-1', 'tenant-1', 'user-1')
      ).rejects.toThrow('Transfer ID and allocation ID are required');
    });

    it('should throw error when allocation ID is missing', async () => {
      await expect(
        service.linkTransferToAllocation('transfer-1', '', 'tenant-1', 'user-1')
      ).rejects.toThrow('Transfer ID and allocation ID are required');
    });
  });

  describe('getTransferAllocationLinks', () => {
    it('should throw error when transfer ID is missing', async () => {
      await expect(
        service.getTransferAllocationLinks('', 'tenant-1')
      ).rejects.toThrow('Transfer ID is required');
    });
  });

  describe('getAllocationTransferLinks', () => {
    it('should throw error when allocation ID is missing', async () => {
      await expect(
        service.getAllocationTransferLinks('', 'tenant-1')
      ).rejects.toThrow('Allocation ID is required');
    });
  });

  describe('syncAllocationTransferStatus', () => {
    it('should throw error when allocation ID is missing', async () => {
      await expect(
        service.syncAllocationTransferStatus('', 'tenant-1')
      ).rejects.toThrow('Allocation ID is required');
    });
  });

  describe('handlePartialTransferScenario', () => {
    it('should throw error when allocation ID is missing', async () => {
      await expect(
        service.handlePartialTransferScenario('', 10, 'tenant-1', 'user-1')
      ).rejects.toThrow('Allocation ID and positive partial quantity are required');
    });

    it('should throw error when partial quantity is not positive', async () => {
      await expect(
        service.handlePartialTransferScenario('alloc-1', 0, 'tenant-1', 'user-1')
      ).rejects.toThrow('Allocation ID and positive partial quantity are required');
    });
  });

  describe('getTraceabilityChain', () => {
    it('should throw error when allocation ID is missing', async () => {
      await expect(
        service.getTraceabilityChain('', 'tenant-1')
      ).rejects.toThrow('Allocation ID is required');
    });
  });
});