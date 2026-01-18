import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, sql } from 'drizzle-orm';
import { 
  allocations,
  transfers,
  transferAllocations,
  locations,
  users,
  products,
  poItems,
  Allocation,
  Transfer,
  TransferAllocation,
  NewTransfer,
  NewTransferAllocation,
  TransferStatus,
  TransferPriority,
  AllocationStatus,
  Location,
  Product,
  User,
  POItem
} from '../db/schema';
import { generateId, getCurrentTimestamp } from '../utils';
import { createTransferService, TransferService } from './transfer';
import { createAllocationService, AllocationService } from './allocation';

// Core interfaces for allocation-transfer integration
export interface CreateTransferFromAllocationRequest {
  allocationId: string;
  priority?: 'NORMAL' | 'HIGH' | 'EMERGENCY';
  notes?: string;
  reasonCode?: string;
}

export interface AllocationTransferLink {
  id: string;
  tenantId: string;
  transferId: string;
  allocationId: string;
  createdAt: number;
  transfer?: Transfer | undefined;
  allocation?: Allocation | undefined;
}

export interface AllocationTransferSyncResult {
  allocationId: string;
  transferId: string;
  allocationStatusUpdated: boolean;
  transferStatusUpdated: boolean;
  syncedAt: number;
}

export interface AllocationTransferIntegrationService {
  createTransferFromAllocationWithDestination(allocationId: string, destinationLocationId: string, tenantId: string, createdBy: string, options?: { priority?: 'NORMAL' | 'HIGH' | 'EMERGENCY'; notes?: string; reasonCode?: string; }): Promise<{ transfer: Transfer; link: TransferAllocation }>;
  linkTransferToAllocation(transferId: string, allocationId: string, tenantId: string, createdBy: string): Promise<TransferAllocation>;
  getTransferAllocationLinks(transferId: string, tenantId: string): Promise<AllocationTransferLink[]>;
  getAllocationTransferLinks(allocationId: string, tenantId: string): Promise<AllocationTransferLink[]>;
  syncAllocationTransferStatus(allocationId: string, tenantId: string): Promise<AllocationTransferSyncResult[]>;
  handlePartialTransferScenario(allocationId: string, partialQuantity: number, tenantId: string, createdBy: string): Promise<{ originalTransfer: Transfer; partialTransfer: Transfer; links: TransferAllocation[] }>;
  getTraceabilityChain(allocationId: string, tenantId: string): Promise<{ allocation: Allocation; transfers: Transfer[]; locations: Location[]; product: Product }>;
}

export class AllocationTransferIntegrationServiceImpl implements AllocationTransferIntegrationService {
  private transferService: TransferService;
  private allocationService: AllocationService;

  constructor(private db: DrizzleD1Database) {
    this.transferService = createTransferService(db);
    this.allocationService = createAllocationService(db);
  }

  /**
   * Create a transfer from an allocation
   * Requirements: 9.1, 9.2, 9.3
   */
  async createTransferFromAllocation(
    request: CreateTransferFromAllocationRequest, 
    tenantId: string, 
    createdBy: string
  ): Promise<{ transfer: Transfer; link: TransferAllocation }> {
    if (!request.allocationId) {
      throw new Error('Allocation ID is required');
    }

    // Get the allocation with related data
    const allocation = await this.allocationService.getAllocation(request.allocationId, tenantId);
    if (!allocation) {
      throw new Error('Allocation not found');
    }

    // Validate allocation is in SHIPPED status (ready for transfer)
    if (allocation.status !== AllocationStatus.SHIPPED) {
      throw new Error('Can only create transfers from allocations in SHIPPED status');
    }

    // Get allocation details including PO item and product information
    const allocationDetails = await this.getAllocationWithDetails(request.allocationId, tenantId);
    if (!allocationDetails) {
      throw new Error('Failed to load allocation details');
    }

    // Determine source location (central/commissary location where allocation was shipped to)
    // For now, we'll assume the allocation's target location is the source for the transfer
    const sourceLocationId = allocation.targetLocationId;

    // For this implementation, we'll need the user to specify destination location
    // In a real scenario, this might be determined by business rules or user input
    // For now, we'll throw an error asking for destination location specification
    throw new Error('Destination location must be specified for transfer creation. This should be handled by the API endpoint.');
  }

  /**
   * Create transfer from allocation with destination location
   * Requirements: 9.1, 9.2, 9.3
   */
  async createTransferFromAllocationWithDestination(
    allocationId: string,
    destinationLocationId: string,
    tenantId: string,
    createdBy: string,
    options?: {
      priority?: 'NORMAL' | 'HIGH' | 'EMERGENCY';
      notes?: string;
      reasonCode?: string;
    }
  ): Promise<{ transfer: Transfer; link: TransferAllocation }> {
    // Get the allocation
    const allocation = await this.allocationService.getAllocation(allocationId, tenantId);
    if (!allocation) {
      throw new Error('Allocation not found');
    }

    // Validate allocation is in SHIPPED status
    if (allocation.status !== AllocationStatus.SHIPPED) {
      throw new Error('Can only create transfers from allocations in SHIPPED status');
    }

    // Get allocation details
    const allocationDetails = await this.getAllocationWithDetails(allocationId, tenantId);
    if (!allocationDetails) {
      throw new Error('Failed to load allocation details');
    }

    // Create transfer request
    const transferRequest = {
      productId: allocationDetails.product.id,
      sourceLocationId: allocation.targetLocationId, // Allocation target becomes transfer source
      destinationLocationId: destinationLocationId,
      quantityRequested: allocation.quantityReceived || allocation.quantityAllocated, // Use received quantity if available
      priority: (options?.priority || 'NORMAL') as 'NORMAL' | 'HIGH' | 'EMERGENCY',
      notes: options?.notes || undefined,
      reasonCode: options?.reasonCode || undefined
    };

    // Create the transfer
    const transfer = await this.transferService.createTransferRequest(transferRequest, tenantId, createdBy);

    // Create the allocation-transfer link
    const link = await this.linkTransferToAllocation(transfer.id, allocationId, tenantId, createdBy);

    return { transfer, link };
  }

  /**
   * Link an existing transfer to an allocation
   * Requirements: 9.2, 9.5
   */
  async linkTransferToAllocation(
    transferId: string, 
    allocationId: string, 
    tenantId: string, 
    createdBy: string
  ): Promise<TransferAllocation> {
    if (!transferId || !allocationId) {
      throw new Error('Transfer ID and allocation ID are required');
    }

    // Validate transfer exists and belongs to tenant
    const transfer = await this.transferService.getTransfer(transferId, tenantId);
    if (!transfer) {
      throw new Error('Transfer not found');
    }

    // Validate allocation exists and belongs to tenant
    const allocation = await this.allocationService.getAllocation(allocationId, tenantId);
    if (!allocation) {
      throw new Error('Allocation not found');
    }

    // Validate user access
    await this.validateUserAccess(createdBy, tenantId);

    // Check if link already exists
    const existingLink = await this.db
      .select()
      .from(transferAllocations)
      .where(and(
        eq(transferAllocations.transferId, transferId),
        eq(transferAllocations.allocationId, allocationId),
        eq(transferAllocations.tenantId, tenantId)
      ))
      .limit(1);

    if (existingLink.length > 0) {
      throw new Error('Transfer is already linked to this allocation');
    }

    // Create the link
    const currentTime = getCurrentTimestamp();
    const newLink: NewTransferAllocation = {
      id: `link_${generateId()}`,
      tenantId,
      transferId,
      allocationId,
      createdAt: currentTime,
    };

    const [createdLink] = await this.db
      .insert(transferAllocations)
      .values(newLink)
      .returning();

    if (!createdLink) {
      throw new Error('Failed to create transfer-allocation link');
    }

    return createdLink;
  }

  /**
   * Get all allocation links for a transfer
   * Requirements: 9.4, 9.5
   */
  async getTransferAllocationLinks(transferId: string, tenantId: string): Promise<AllocationTransferLink[]> {
    if (!transferId) {
      throw new Error('Transfer ID is required');
    }

    const links = await this.db
      .select({
        link: transferAllocations,
        transfer: transfers,
        allocation: allocations,
      })
      .from(transferAllocations)
      .leftJoin(transfers, eq(transferAllocations.transferId, transfers.id))
      .leftJoin(allocations, eq(transferAllocations.allocationId, allocations.id))
      .where(and(
        eq(transferAllocations.transferId, transferId),
        eq(transferAllocations.tenantId, tenantId)
      ))
      .orderBy(desc(transferAllocations.createdAt));

    return links.map(row => ({
      id: row.link.id,
      tenantId: row.link.tenantId,
      transferId: row.link.transferId,
      allocationId: row.link.allocationId,
      createdAt: row.link.createdAt,
      transfer: row.transfer || undefined,
      allocation: row.allocation || undefined,
    }));
  }

  /**
   * Get all transfer links for an allocation
   * Requirements: 9.4, 9.5
   */
  async getAllocationTransferLinks(allocationId: string, tenantId: string): Promise<AllocationTransferLink[]> {
    if (!allocationId) {
      throw new Error('Allocation ID is required');
    }

    const links = await this.db
      .select({
        link: transferAllocations,
        transfer: transfers,
        allocation: allocations,
      })
      .from(transferAllocations)
      .leftJoin(transfers, eq(transferAllocations.transferId, transfers.id))
      .leftJoin(allocations, eq(transferAllocations.allocationId, allocations.id))
      .where(and(
        eq(transferAllocations.allocationId, allocationId),
        eq(transferAllocations.tenantId, tenantId)
      ))
      .orderBy(desc(transferAllocations.createdAt));

    return links.map(row => ({
      id: row.link.id,
      tenantId: row.link.tenantId,
      transferId: row.link.transferId,
      allocationId: row.link.allocationId,
      createdAt: row.link.createdAt,
      transfer: row.transfer || undefined,
      allocation: row.allocation || undefined,
    }));
  }

  /**
   * Synchronize allocation and transfer statuses
   * Requirements: 9.2, 9.3
   */
  async syncAllocationTransferStatus(allocationId: string, tenantId: string): Promise<AllocationTransferSyncResult[]> {
    if (!allocationId) {
      throw new Error('Allocation ID is required');
    }

    // Get allocation and its linked transfers
    const allocation = await this.allocationService.getAllocation(allocationId, tenantId);
    if (!allocation) {
      throw new Error('Allocation not found');
    }

    const transferLinks = await this.getAllocationTransferLinks(allocationId, tenantId);
    const results: AllocationTransferSyncResult[] = [];

    for (const link of transferLinks) {
      if (!link.transfer) continue;

      let allocationStatusUpdated = false;
      let transferStatusUpdated = false;
      const currentTime = getCurrentTimestamp();

      // Sync logic based on transfer status
      switch (link.transfer.status) {
        case TransferStatus.RECEIVED:
          // If transfer is received, mark allocation as received
          if (allocation.status !== AllocationStatus.RECEIVED) {
            await this.allocationService.updateAllocationStatus(
              allocationId, 
              AllocationStatus.RECEIVED, 
              tenantId, 
              'system' // System user for automated sync
            );
            allocationStatusUpdated = true;
          }
          break;

        case TransferStatus.CANCELLED:
          // If transfer is cancelled, we might need to handle allocation status
          // This depends on business rules - for now, we'll leave allocation as-is
          break;

        default:
          // For other statuses, no automatic sync needed
          break;
      }

      results.push({
        allocationId,
        transferId: link.transferId,
        allocationStatusUpdated,
        transferStatusUpdated,
        syncedAt: currentTime,
      });
    }

    return results;
  }

  /**
   * Handle partial transfer scenarios
   * Requirements: 9.4, 9.5
   */
  async handlePartialTransferScenario(
    allocationId: string, 
    partialQuantity: number, 
    tenantId: string, 
    createdBy: string
  ): Promise<{ originalTransfer: Transfer; partialTransfer: Transfer; links: TransferAllocation[] }> {
    if (!allocationId || partialQuantity <= 0) {
      throw new Error('Allocation ID and positive partial quantity are required');
    }

    // Get allocation and its transfers
    const allocation = await this.allocationService.getAllocation(allocationId, tenantId);
    if (!allocation) {
      throw new Error('Allocation not found');
    }

    const transferLinks = await this.getAllocationTransferLinks(allocationId, tenantId);
    if (transferLinks.length === 0) {
      throw new Error('No transfers found for this allocation');
    }

    // Get the most recent transfer
    const originalTransferLink = transferLinks[0];
    if (!originalTransferLink?.transfer) {
      throw new Error('Original transfer not found');
    }

    const originalTransfer = originalTransferLink.transfer;

    // Validate partial quantity doesn't exceed original quantity
    if (partialQuantity >= originalTransfer.quantityRequested) {
      throw new Error('Partial quantity must be less than original transfer quantity');
    }

    // Create partial transfer for the remaining quantity
    const remainingQuantity = originalTransfer.quantityRequested - partialQuantity;
    
    const partialTransferRequest = {
      productId: originalTransfer.productId,
      sourceLocationId: originalTransfer.sourceLocationId,
      destinationLocationId: originalTransfer.destinationLocationId,
      quantityRequested: remainingQuantity,
      priority: originalTransfer.priority as 'NORMAL' | 'HIGH' | 'EMERGENCY',
      notes: `Partial transfer created from original transfer ${originalTransfer.id}`,
      reasonCode: 'PARTIAL_TRANSFER'
    };

    const partialTransfer = await this.transferService.createTransferRequest(
      partialTransferRequest, 
      tenantId, 
      createdBy
    );

    // Link the partial transfer to the same allocation
    const partialLink = await this.linkTransferToAllocation(
      partialTransfer.id, 
      allocationId, 
      tenantId, 
      createdBy
    );

    return {
      originalTransfer,
      partialTransfer,
      links: [originalTransferLink, partialLink].filter(Boolean) as TransferAllocation[]
    };
  }

  /**
   * Get complete traceability chain for an allocation
   * Requirements: 9.1, 9.2, 9.5
   */
  async getTraceabilityChain(allocationId: string, tenantId: string): Promise<{
    allocation: Allocation;
    transfers: Transfer[];
    locations: Location[];
    product: Product;
  }> {
    if (!allocationId) {
      throw new Error('Allocation ID is required');
    }

    // Get allocation
    const allocation = await this.allocationService.getAllocation(allocationId, tenantId);
    if (!allocation) {
      throw new Error('Allocation not found');
    }

    // Get allocation details
    const allocationDetails = await this.getAllocationWithDetails(allocationId, tenantId);
    if (!allocationDetails) {
      throw new Error('Failed to load allocation details');
    }

    // Get linked transfers
    const transferLinks = await this.getAllocationTransferLinks(allocationId, tenantId);
    const transfers = transferLinks
      .map(link => link.transfer)
      .filter(Boolean) as Transfer[];

    // Get all unique locations involved
    const locationIds = new Set<string>();
    locationIds.add(allocation.targetLocationId);
    
    transfers.forEach(transfer => {
      locationIds.add(transfer.sourceLocationId);
      locationIds.add(transfer.destinationLocationId);
    });

    const locationsList = await this.getLocationsByIds(Array.from(locationIds), tenantId);

    return {
      allocation,
      transfers,
      locations: locationsList,
      product: allocationDetails.product
    };
  }

  // Private helper methods

  private async getAllocationWithDetails(allocationId: string, tenantId: string): Promise<{
    allocation: Allocation;
    product: Product;
    targetLocation: Location;
  } | null> {
    const result = await this.db
      .select({
        allocation: allocations,
        product: products,
        location: locations,
      })
      .from(allocations)
      .innerJoin(poItems, eq(allocations.poItemId, poItems.id))
      .innerJoin(products, eq(poItems.productId, products.id))
      .innerJoin(locations, eq(allocations.targetLocationId, locations.id))
      .where(and(
        eq(allocations.id, allocationId),
        eq(allocations.tenantId, tenantId)
      ))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    if (!row) {
      return null;
    }

    return {
      allocation: row.allocation,
      product: row.product,
      targetLocation: row.location,
    };
  }

  private async getLocationsByIds(locationIds: string[], tenantId: string): Promise<Location[]> {
    if (locationIds.length === 0) {
      return [];
    }

    const locationsList = await this.db
      .select()
      .from(locations)
      .where(and(
        sql`${locations.id} IN (${sql.join(locationIds.map(id => sql`${id}`), sql`, `)})`,
        eq(locations.tenantId, tenantId)
      ));

    return locationsList;
  }

  private async validateUserAccess(userId: string, tenantId: string): Promise<User> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);

    if (!user) {
      throw new Error('User not found in this organization');
    }

    return user;
  }
}

// Factory function for creating allocation-transfer integration service
export function createAllocationTransferIntegrationService(db: DrizzleD1Database): AllocationTransferIntegrationService {
  return new AllocationTransferIntegrationServiceImpl(db);
}