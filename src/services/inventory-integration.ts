import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { 
  inventoryReservations,
  NewInventoryReservation
} from '../db/schema';
import { generateId, getCurrentTimestamp } from '../utils';

// Import Transfer type separately to avoid circular dependency
export interface Transfer {
  id: string;
  tenantId: string;
  productId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  quantityRequested: number;
  quantityShipped: number | null;
  quantityReceived: number | null;
  status: string;
  priority: string;
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: number | null;
  shippedBy: string | null;
  shippedAt: number | null;
  receivedBy: string | null;
  receivedAt: number | null;
  cancelledBy: string | null;
  cancelledAt: number | null;
  cancellationReason: string | null;
  varianceReason: string | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

// Core interfaces as defined in the design document
export interface InventoryTransaction {
  transactionId: string;
  operations: InventoryOperation[];
  timestamp: Date;
  rollbackable: boolean;
}

export interface InventoryOperation {
  locationId: string;
  productId: string;
  quantityChange: number;
  operationType: 'DECREMENT_ON_HAND' | 'INCREMENT_IN_TRANSIT' | 'DECREMENT_IN_TRANSIT' | 'INCREMENT_ON_HAND' | 'RECORD_SHRINKAGE';
  previousQuantity: number;
  newQuantity: number;
}

export interface ReservationResult {
  reservationId: string;
  reserved: boolean;
  expiresAt: Date;
  reservedQuantity: number;
}

export interface AvailabilityResult {
  available: boolean;
  currentQuantity: number;
  availableQuantity: number; // Excluding reserved/in-transit
  reservedQuantity: number;
  inTransitQuantity: number;
}

export interface InventoryLock {
  lockId: string;
  locationId: string;
  productId: string;
  lockedBy: string;
  lockedAt: Date;
  expiresAt: Date;
  priority: number; // For deadlock resolution
  waitingFor?: string[]; // Lock IDs this lock is waiting for
}

export interface DeadlockDetectionResult {
  hasDeadlock: boolean;
  cycle?: string[]; // Lock IDs involved in the cycle
  victimLockId?: string; // Lock to abort to resolve deadlock
}

export interface TransactionIsolationLevel {
  level: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
  lockTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

// For now, we'll use a simple in-memory inventory tracking system
// In a production system, this would be a proper inventory table
interface InventoryRecord {
  locationId: string;
  productId: string;
  onHandQuantity: number;
  inTransitQuantity: number;
  reservedQuantity: number;
  lastUpdated: Date;
}

export interface InventoryIntegrationService {
  executeTransferShipment(transfer: Transfer): Promise<InventoryTransaction>;
  executeTransferReceipt(transfer: Transfer, quantityReceived: number): Promise<InventoryTransaction>;
  rollbackTransferOperation(transactionId: string): Promise<void>;
  reserveInventoryForTransfer(productId: string, locationId: string, quantity: number, transferId: string, reservedBy: string, tenantId: string): Promise<ReservationResult>;
  releaseInventoryReservation(reservationId: string): Promise<void>;
  checkInventoryAvailability(productId: string, locationId: string): Promise<AvailabilityResult>;
  acquireInventoryLock(locationId: string, productId: string, lockedBy: string, timeoutMs?: number, priority?: number): Promise<InventoryLock>;
  acquireMultipleInventoryLocks(lockRequests: Array<{locationId: string, productId: string}>, lockedBy: string, timeoutMs?: number, priority?: number): Promise<InventoryLock[]>;
  releaseInventoryLock(lockId: string): Promise<void>;
  releaseMultipleInventoryLocks(lockIds: string[]): Promise<void>;
  detectDeadlocks(): Promise<DeadlockDetectionResult>;
  resolveDeadlock(victimLockId: string): Promise<void>;
  executeWithIsolation<T>(operation: () => Promise<T>, isolationLevel: TransactionIsolationLevel): Promise<T>;
  cleanupExpiredReservations(): Promise<number>;
  cleanupExpiredLocks(): Promise<number>;
}

export class InventoryIntegrationServiceImpl implements InventoryIntegrationService {
  // In-memory inventory tracking (would be database table in production)
  private inventoryRecords = new Map<string, InventoryRecord>();
  
  // In-memory lock tracking (would be database table in production)
  private inventoryLocks = new Map<string, InventoryLock>();
  
  // Lock dependency graph for deadlock detection
  private lockDependencies = new Map<string, Set<string>>();
  
  // Transaction history for rollback capability
  private transactionHistory = new Map<string, InventoryTransaction>();

  // Default isolation level
  private defaultIsolationLevel: TransactionIsolationLevel = {
    level: 'READ_COMMITTED',
    lockTimeout: 10000,
    retryAttempts: 3,
    retryDelay: 100
  };

  constructor(private db: DrizzleD1Database) {}

  /**
   * Execute atomic inventory operations for transfer shipment
   * Requirements: 3.1, 3.2, 3.3, 3.4
   */
  async executeTransferShipment(transfer: Transfer): Promise<InventoryTransaction> {
    const transactionId = `txn_${generateId()}`;
    const timestamp = new Date();
    const operations: InventoryOperation[] = [];

    try {
      // Validate transfer is in correct state
      if (transfer.status !== 'APPROVED') {
        throw new Error('Transfer must be in APPROVED status to ship');
      }

      // Acquire locks for both locations to prevent concurrent modifications
      const lockRequests = [
        { locationId: transfer.sourceLocationId, productId: transfer.productId },
        { locationId: transfer.destinationLocationId, productId: transfer.productId }
      ];

      const locks = await this.acquireMultipleInventoryLocks(
        lockRequests,
        `transfer_${transfer.id}`,
        30000, // 30 second timeout
        1 // Normal priority
      );

      try {
        // Check inventory availability at source
        const sourceAvailability = await this.checkInventoryAvailability(
          transfer.productId, 
          transfer.sourceLocationId
        );

        if (!sourceAvailability.available || sourceAvailability.availableQuantity < transfer.quantityRequested) {
          throw new Error(`Insufficient inventory at source location. Available: ${sourceAvailability.availableQuantity}, Requested: ${transfer.quantityRequested}`);
        }

        // Phase 1: Decrement source location on-hand inventory
        const sourceKey = `${transfer.sourceLocationId}_${transfer.productId}`;
        const sourceRecord = this.getOrCreateInventoryRecord(transfer.sourceLocationId, transfer.productId);
        
        const sourceOperation: InventoryOperation = {
          locationId: transfer.sourceLocationId,
          productId: transfer.productId,
          quantityChange: -transfer.quantityRequested,
          operationType: 'DECREMENT_ON_HAND',
          previousQuantity: sourceRecord.onHandQuantity,
          newQuantity: sourceRecord.onHandQuantity - transfer.quantityRequested
        };

        // Apply source operation
        sourceRecord.onHandQuantity = sourceOperation.newQuantity;
        sourceRecord.lastUpdated = timestamp;
        this.inventoryRecords.set(sourceKey, sourceRecord);
        operations.push(sourceOperation);

        // Phase 2: Increment destination location in-transit inventory
        const destinationKey = `${transfer.destinationLocationId}_${transfer.productId}`;
        const destinationRecord = this.getOrCreateInventoryRecord(transfer.destinationLocationId, transfer.productId);
        
        const destinationOperation: InventoryOperation = {
          locationId: transfer.destinationLocationId,
          productId: transfer.productId,
          quantityChange: transfer.quantityRequested,
          operationType: 'INCREMENT_IN_TRANSIT',
          previousQuantity: destinationRecord.inTransitQuantity,
          newQuantity: destinationRecord.inTransitQuantity + transfer.quantityRequested
        };

        // Apply destination operation
        destinationRecord.inTransitQuantity = destinationOperation.newQuantity;
        destinationRecord.lastUpdated = timestamp;
        this.inventoryRecords.set(destinationKey, destinationRecord);
        operations.push(destinationOperation);

        // Create transaction record
        const transaction: InventoryTransaction = {
          transactionId,
          operations,
          timestamp,
          rollbackable: true
        };

        // Store transaction for potential rollback
        this.transactionHistory.set(transactionId, transaction);

        return transaction;

      } finally {
        // Always release locks
        await this.releaseMultipleInventoryLocks(locks.map(lock => lock.lockId));
      }

    } catch (error) {
      // Rollback any partial operations
      for (const operation of operations.reverse()) {
        await this.rollbackOperation(operation);
      }
      throw error;
    }
  }

  /**
   * Execute atomic inventory operations for transfer receipt
   * Requirements: 3.1, 3.2, 3.3, 3.4
   */
  async executeTransferReceipt(transfer: Transfer, quantityReceived: number): Promise<InventoryTransaction> {
    const transactionId = `txn_${generateId()}`;
    const timestamp = new Date();
    const operations: InventoryOperation[] = [];

    try {
      // Validate transfer is in correct state
      if (transfer.status !== 'SHIPPED') {
        throw new Error('Transfer must be in SHIPPED status to receive');
      }

      // Validate received quantity
      if (quantityReceived < 0) {
        throw new Error('Quantity received cannot be negative');
      }

      if (quantityReceived > (transfer.quantityShipped || 0)) {
        throw new Error('Quantity received cannot exceed quantity shipped');
      }

      // Acquire lock for destination location
      const destinationLock = await this.acquireInventoryLock(
        transfer.destinationLocationId, 
        transfer.productId, 
        `transfer_${transfer.id}`,
        30000,
        1 // Normal priority
      );

      try {
        const destinationKey = `${transfer.destinationLocationId}_${transfer.productId}`;
        const destinationRecord = this.getOrCreateInventoryRecord(transfer.destinationLocationId, transfer.productId);

        // Phase 1: Decrement in-transit inventory
        const decrementInTransitOperation: InventoryOperation = {
          locationId: transfer.destinationLocationId,
          productId: transfer.productId,
          quantityChange: -(transfer.quantityShipped || 0),
          operationType: 'DECREMENT_IN_TRANSIT',
          previousQuantity: destinationRecord.inTransitQuantity,
          newQuantity: destinationRecord.inTransitQuantity - (transfer.quantityShipped || 0)
        };

        destinationRecord.inTransitQuantity = decrementInTransitOperation.newQuantity;
        operations.push(decrementInTransitOperation);

        // Phase 2: Increment on-hand inventory with received quantity
        const incrementOnHandOperation: InventoryOperation = {
          locationId: transfer.destinationLocationId,
          productId: transfer.productId,
          quantityChange: quantityReceived,
          operationType: 'INCREMENT_ON_HAND',
          previousQuantity: destinationRecord.onHandQuantity,
          newQuantity: destinationRecord.onHandQuantity + quantityReceived
        };

        destinationRecord.onHandQuantity = incrementOnHandOperation.newQuantity;
        operations.push(incrementOnHandOperation);

        // Phase 3: Record shrinkage if any
        const shrinkage = (transfer.quantityShipped || 0) - quantityReceived;
        if (shrinkage > 0) {
          const shrinkageOperation: InventoryOperation = {
            locationId: transfer.destinationLocationId,
            productId: transfer.productId,
            quantityChange: -shrinkage,
            operationType: 'RECORD_SHRINKAGE',
            previousQuantity: 0, // Shrinkage doesn't affect current quantities
            newQuantity: shrinkage
          };
          operations.push(shrinkageOperation);
        }

        // Update record timestamp
        destinationRecord.lastUpdated = timestamp;
        this.inventoryRecords.set(destinationKey, destinationRecord);

        // Create transaction record
        const transaction: InventoryTransaction = {
          transactionId,
          operations,
          timestamp,
          rollbackable: true
        };

        // Store transaction for potential rollback
        this.transactionHistory.set(transactionId, transaction);

        return transaction;

      } finally {
        // Always release lock
        await this.releaseInventoryLock(destinationLock.lockId);
      }

    } catch (error) {
      // Rollback any partial operations
      for (const operation of operations.reverse()) {
        await this.rollbackOperation(operation);
      }
      throw error;
    }
  }

  /**
   * Rollback a transfer operation
   * Requirements: 3.4
   */
  async rollbackTransferOperation(transactionId: string): Promise<void> {
    const transaction = this.transactionHistory.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (!transaction.rollbackable) {
      throw new Error(`Transaction ${transactionId} is not rollbackable`);
    }

    // Rollback operations in reverse order
    for (const operation of transaction.operations.reverse()) {
      await this.rollbackOperation(operation);
    }

    // Mark transaction as rolled back
    transaction.rollbackable = false;
    this.transactionHistory.set(transactionId, transaction);
  }

  /**
   * Reserve inventory for a transfer
   * Requirements: 3.1, 3.2
   */
  async reserveInventoryForTransfer(
    productId: string, 
    locationId: string, 
    quantity: number, 
    transferId: string, 
    reservedBy: string,
    tenantId: string
  ): Promise<ReservationResult> {
    if (quantity <= 0) {
      throw new Error('Reservation quantity must be positive');
    }

    // Check if there's already a reservation for this transfer
    const existingReservations = await this.db
      .select()
      .from(inventoryReservations)
      .where(and(
        eq(inventoryReservations.transferId, transferId),
        eq(inventoryReservations.productId, productId),
        eq(inventoryReservations.locationId, locationId),
        sql`${inventoryReservations.releasedAt} IS NULL`
      ));

    if (existingReservations.length > 0) {
      throw new Error('Inventory already reserved for this transfer');
    }

    // Check availability
    const availability = await this.checkInventoryAvailability(productId, locationId);
    if (!availability.available || availability.availableQuantity < quantity) {
      return {
        reservationId: '',
        reserved: false,
        expiresAt: new Date(),
        reservedQuantity: 0
      };
    }

    // Create reservation
    const reservationId = `res_${generateId()}`;
    const currentTime = getCurrentTimestamp();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    const newReservation: NewInventoryReservation = {
      id: reservationId,
      tenantId,
      transferId,
      productId,
      locationId,
      quantityReserved: quantity,
      reservedBy,
      reservedAt: currentTime,
      expiresAt: expiresAt.getTime(),
      releasedAt: null
    };

    await this.db
      .insert(inventoryReservations)
      .values(newReservation);

    // Update in-memory inventory record
    const key = `${locationId}_${productId}`;
    const record = this.getOrCreateInventoryRecord(locationId, productId);
    record.reservedQuantity += quantity;
    record.lastUpdated = new Date();
    this.inventoryRecords.set(key, record);

    return {
      reservationId,
      reserved: true,
      expiresAt,
      reservedQuantity: quantity
    };
  }

  /**
   * Release an inventory reservation
   * Requirements: 3.2
   */
  async releaseInventoryReservation(reservationId: string): Promise<void> {
    const currentTime = getCurrentTimestamp();

    // Get the reservation
    const [reservation] = await this.db
      .select()
      .from(inventoryReservations)
      .where(and(
        eq(inventoryReservations.id, reservationId),
        sql`${inventoryReservations.releasedAt} IS NULL`
      ))
      .limit(1);

    if (!reservation) {
      throw new Error('Active reservation not found');
    }

    // Release the reservation
    await this.db
      .update(inventoryReservations)
      .set({ releasedAt: currentTime })
      .where(eq(inventoryReservations.id, reservationId));

    // Update in-memory inventory record
    const key = `${reservation.locationId}_${reservation.productId}`;
    const record = this.getOrCreateInventoryRecord(reservation.locationId, reservation.productId);
    record.reservedQuantity = Math.max(0, record.reservedQuantity - reservation.quantityReserved);
    record.lastUpdated = new Date();
    this.inventoryRecords.set(key, record);
  }

  /**
   * Check inventory availability
   * Requirements: 3.1, 3.2
   */
  async checkInventoryAvailability(productId: string, locationId: string): Promise<AvailabilityResult> {
    const record = this.getOrCreateInventoryRecord(locationId, productId);
    
    // Get active reservations from database
    const activeReservations = await this.db
      .select()
      .from(inventoryReservations)
      .where(and(
        eq(inventoryReservations.productId, productId),
        eq(inventoryReservations.locationId, locationId),
        sql`${inventoryReservations.releasedAt} IS NULL`,
        sql`${inventoryReservations.expiresAt} > ${getCurrentTimestamp()}`
      ));

    const totalReserved = activeReservations.reduce((sum, res) => sum + res.quantityReserved, 0);
    const availableQuantity = Math.max(0, record.onHandQuantity - totalReserved);

    return {
      available: availableQuantity > 0,
      currentQuantity: record.onHandQuantity,
      availableQuantity,
      reservedQuantity: totalReserved,
      inTransitQuantity: record.inTransitQuantity
    };
  }

  /**
   * Acquire an inventory lock for concurrency control
   * Requirements: 3.5
   */
  async acquireInventoryLock(
    locationId: string, 
    productId: string, 
    lockedBy: string, 
    timeoutMs: number = 10000,
    priority: number = 1
  ): Promise<InventoryLock> {
    const lockKey = `${locationId}_${productId}`;
    const lockId = `lock_${generateId()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + timeoutMs);

    // Check for deadlocks before acquiring lock
    const potentialDeadlock = await this.wouldCauseDeadlock(lockKey, lockedBy);
    if (potentialDeadlock) {
      throw new Error(`Lock acquisition would cause deadlock. Aborting transaction.`);
    }

    // Check if already locked
    const existingLock = this.inventoryLocks.get(lockKey);
    if (existingLock && existingLock.expiresAt > now) {
      // Add to waiting list for deadlock detection
      this.addLockDependency(lockId, existingLock.lockId);
      
      // Wait with timeout
      const startTime = Date.now();
      while (this.inventoryLocks.has(lockKey) && (Date.now() - startTime) < timeoutMs) {
        await this.sleep(50); // Wait 50ms before checking again
        
        // Check for deadlocks while waiting
        const deadlockResult = await this.detectDeadlocks();
        if (deadlockResult.hasDeadlock && deadlockResult.cycle?.includes(lockId)) {
          if (deadlockResult.victimLockId === lockId) {
            this.removeLockDependency(lockId);
            throw new Error(`Transaction aborted to resolve deadlock`);
          }
        }
      }
      
      // Remove from waiting list
      this.removeLockDependency(lockId);
      
      // Check if lock is still held
      const currentLock = this.inventoryLocks.get(lockKey);
      if (currentLock && currentLock.expiresAt > new Date()) {
        throw new Error(`Timeout waiting for inventory lock. Locked by ${currentLock.lockedBy}`);
      }
    }

    // Create new lock
    const lock: InventoryLock = {
      lockId,
      locationId,
      productId,
      lockedBy,
      lockedAt: now,
      expiresAt,
      priority,
      waitingFor: []
    };

    this.inventoryLocks.set(lockKey, lock);
    return lock;
  }

  /**
   * Acquire multiple inventory locks atomically with deadlock prevention
   * Requirements: 3.5
   */
  async acquireMultipleInventoryLocks(
    lockRequests: Array<{locationId: string, productId: string}>, 
    lockedBy: string, 
    timeoutMs: number = 10000,
    priority: number = 1
  ): Promise<InventoryLock[]> {
    // Sort lock requests by key to prevent deadlocks (ordered locking)
    const sortedRequests = lockRequests
      .map(req => ({ ...req, key: `${req.locationId}_${req.productId}` }))
      .sort((a, b) => a.key.localeCompare(b.key));

    const acquiredLocks: InventoryLock[] = [];
    
    try {
      for (const request of sortedRequests) {
        const lock = await this.acquireInventoryLock(
          request.locationId,
          request.productId,
          lockedBy,
          timeoutMs,
          priority
        );
        acquiredLocks.push(lock);
      }
      
      return acquiredLocks;
    } catch (error) {
      // Release any locks we managed to acquire
      await this.releaseMultipleInventoryLocks(acquiredLocks.map(lock => lock.lockId));
      throw error;
    }
  }

  /**
   * Release multiple inventory locks
   * Requirements: 3.5
   */
  async releaseMultipleInventoryLocks(lockIds: string[]): Promise<void> {
    for (const lockId of lockIds) {
      try {
        await this.releaseInventoryLock(lockId);
      } catch (error) {
        // Continue releasing other locks even if one fails
        console.error(`Failed to release lock ${lockId}:`, error);
      }
    }
  }

  /**
   * Detect deadlocks in the lock dependency graph
   * Requirements: 3.5
   */
  async detectDeadlocks(): Promise<DeadlockDetectionResult> {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    // Check each lock for cycles
    for (const lockId of Array.from(this.lockDependencies.keys())) {
      if (!visited.has(lockId)) {
        const cycle = this.detectCycleDFS(lockId, visited, recursionStack, []);
        if (cycle.length > 0) {
          // Find victim lock (lowest priority or oldest)
          const victimLockId = this.selectDeadlockVictim(cycle);
          return {
            hasDeadlock: true,
            cycle,
            victimLockId
          };
        }
      }
    }
    
    return { hasDeadlock: false };
  }

  /**
   * Resolve deadlock by aborting the victim transaction
   * Requirements: 3.5
   */
  async resolveDeadlock(victimLockId: string): Promise<void> {
    // Find and release the victim lock
    for (const [key, lock] of this.inventoryLocks.entries()) {
      if (lock.lockId === victimLockId) {
        this.inventoryLocks.delete(key);
        this.removeLockDependency(victimLockId);
        break;
      }
    }
  }

  /**
   * Execute operation with specified transaction isolation level
   * Requirements: 3.5
   */
  async executeWithIsolation<T>(
    operation: () => Promise<T>, 
    isolationLevel: TransactionIsolationLevel = this.defaultIsolationLevel
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < isolationLevel.retryAttempts; attempt++) {
      try {
        // Set isolation level context (in a real implementation, this would configure database isolation)
        const startTime = Date.now();
        
        // Execute operation with timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Transaction timeout')), isolationLevel.lockTimeout);
        });
        
        const result = await Promise.race([operation(), timeoutPromise]);
        
        // Log transaction metrics
        const duration = Date.now() - startTime;
        console.log(`Transaction completed in ${duration}ms with isolation level ${isolationLevel.level}`);
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable (deadlock, timeout, etc.)
        if (this.isRetryableError(error as Error) && attempt < isolationLevel.retryAttempts - 1) {
          // Wait before retry with exponential backoff
          const delay = isolationLevel.retryDelay * Math.pow(2, attempt);
          await this.sleep(delay);
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError || new Error('Transaction failed after all retry attempts');
  }

  /**
   * Release an inventory lock
   * Requirements: 3.5
   */
  async releaseInventoryLock(lockId: string): Promise<void> {
    // Find and remove the lock
    for (const [key, lock] of Array.from(this.inventoryLocks.entries())) {
      if (lock.lockId === lockId) {
        this.inventoryLocks.delete(key);
        return;
      }
    }
  }

  /**
   * Clean up expired reservations
   * Requirements: 3.2
   */
  async cleanupExpiredReservations(): Promise<number> {
    const currentTime = getCurrentTimestamp();
    
    // Get expired reservations
    const expiredReservations = await this.db
      .select()
      .from(inventoryReservations)
      .where(and(
        sql`${inventoryReservations.releasedAt} IS NULL`,
        sql`${inventoryReservations.expiresAt} <= ${currentTime}`
      ));

    if (expiredReservations.length === 0) {
      return 0;
    }

    // Release expired reservations
    const expiredIds = expiredReservations.map(r => r.id);
    await this.db
      .update(inventoryReservations)
      .set({ releasedAt: currentTime })
      .where(inArray(inventoryReservations.id, expiredIds));

    // Update in-memory records
    for (const reservation of expiredReservations) {
      const key = `${reservation.locationId}_${reservation.productId}`;
      const record = this.getOrCreateInventoryRecord(reservation.locationId, reservation.productId);
      record.reservedQuantity = Math.max(0, record.reservedQuantity - reservation.quantityReserved);
      record.lastUpdated = new Date();
      this.inventoryRecords.set(key, record);
    }

    return expiredReservations.length;
  }

  /**
   * Clean up expired locks
   * Requirements: 3.5
   */
  async cleanupExpiredLocks(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [key, lock] of Array.from(this.inventoryLocks.entries())) {
      if (lock.expiresAt <= now) {
        this.inventoryLocks.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  // Private helper methods

  private getOrCreateInventoryRecord(locationId: string, productId: string): InventoryRecord {
    const key = `${locationId}_${productId}`;
    let record = this.inventoryRecords.get(key);
    
    if (!record) {
      record = {
        locationId,
        productId,
        onHandQuantity: 0, // In production, this would be loaded from database
        inTransitQuantity: 0,
        reservedQuantity: 0,
        lastUpdated: new Date()
      };
      this.inventoryRecords.set(key, record);
    }
    
    return record;
  }

  private async rollbackOperation(operation: InventoryOperation): Promise<void> {
    const key = `${operation.locationId}_${operation.productId}`;
    const record = this.getOrCreateInventoryRecord(operation.locationId, operation.productId);

    switch (operation.operationType) {
      case 'DECREMENT_ON_HAND':
        record.onHandQuantity = operation.previousQuantity;
        break;
      case 'INCREMENT_ON_HAND':
        record.onHandQuantity = operation.previousQuantity;
        break;
      case 'INCREMENT_IN_TRANSIT':
        record.inTransitQuantity = operation.previousQuantity;
        break;
      case 'DECREMENT_IN_TRANSIT':
        record.inTransitQuantity = operation.previousQuantity;
        break;
      case 'RECORD_SHRINKAGE':
        // Shrinkage operations don't affect current quantities, so no rollback needed
        break;
    }

    record.lastUpdated = new Date();
    this.inventoryRecords.set(key, record);
  }

  private async wouldCauseDeadlock(lockKey: string, lockedBy: string): Promise<boolean> {
    const existingLock = this.inventoryLocks.get(lockKey);
    if (!existingLock) {
      return false;
    }

    // Check if the lock holder is waiting for any locks held by the requester
    const holderDependencies = this.lockDependencies.get(existingLock.lockId);
    if (!holderDependencies) {
      return false;
    }

    // Check if any of the dependencies are held by the requester
    for (const lock of Array.from(this.inventoryLocks.values())) {
      if (lock.lockedBy === lockedBy && holderDependencies.has(lock.lockId)) {
        return true;
      }
    }

    return false;
  }

  private addLockDependency(waitingLockId: string, targetLockId: string): void {
    if (!this.lockDependencies.has(waitingLockId)) {
      this.lockDependencies.set(waitingLockId, new Set());
    }
    const dependencies = this.lockDependencies.get(waitingLockId);
    if (dependencies) {
      dependencies.add(targetLockId);
    }
  }

  private removeLockDependency(lockId: string): void {
    this.lockDependencies.delete(lockId);
    
    // Remove this lock from other dependencies
    for (const dependencies of Array.from(this.lockDependencies.values())) {
      dependencies.delete(lockId);
    }
  }

  private detectCycleDFS(
    lockId: string, 
    visited: Set<string>, 
    recursionStack: Set<string>, 
    path: string[]
  ): string[] {
    visited.add(lockId);
    recursionStack.add(lockId);
    path.push(lockId);

    const dependencies = this.lockDependencies.get(lockId);
    if (dependencies) {
      for (const dependentLockId of Array.from(dependencies)) {
        if (!visited.has(dependentLockId)) {
          const cycle = this.detectCycleDFS(dependentLockId, visited, recursionStack, [...path]);
          if (cycle.length > 0) {
            return cycle;
          }
        } else if (recursionStack.has(dependentLockId)) {
          // Found a cycle
          const cycleStart = path.indexOf(dependentLockId);
          return path.slice(cycleStart);
        }
      }
    }

    recursionStack.delete(lockId);
    return [];
  }

  private selectDeadlockVictim(cycle: string[]): string {
    if (cycle.length === 0) {
      throw new Error('Cannot select victim from empty cycle');
    }
    
    let victimLockId = cycle[0];
    let lowestPriority = Number.MAX_SAFE_INTEGER;
    let oldestTime = new Date();

    // Find the lock with lowest priority, or oldest if priorities are equal
    for (const lockId of cycle) {
      for (const lock of Array.from(this.inventoryLocks.values())) {
        if (lock.lockId === lockId) {
          if (lock.priority < lowestPriority || 
              (lock.priority === lowestPriority && lock.lockedAt < oldestTime)) {
            victimLockId = lockId;
            lowestPriority = lock.priority;
            oldestTime = lock.lockedAt;
          }
          break;
        }
      }
    }

    return victimLockId || cycle[0] || '';
  }

  private isRetryableError(error: Error): boolean {
    const retryableMessages = [
      'deadlock',
      'timeout',
      'lock',
      'concurrent',
      'conflict'
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableMessages.some(msg => errorMessage.includes(msg));
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function for creating inventory integration service
export function createInventoryIntegrationService(db: DrizzleD1Database): InventoryIntegrationService {
  return new InventoryIntegrationServiceImpl(db);
}