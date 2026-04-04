import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { 
  inventoryConsumptions, 
  InventoryConsumption, 
  NewInventoryConsumption,
  orders,
  products,
  locations
} from '../db/schema';
import * as schema from '../db/schema';
import { generateId } from '../utils';
import { AuditLogger } from './audit-logger';

/**
 * Inventory Consumption Tracker Service
 * Requirements: 3.1, 3.2, 9.2
 * 
 * This service tracks inventory consumption for recipe execution,
 * handles consumption reversal for cancelled orders, and provides
 * consumption audit trails and reporting.
 */

export interface ConsumptionRecord {
  orderId: string;
  productId: string;
  locationId: string;
  quantityConsumed: number;
  unit: string;
  notes?: string;
}

export interface ConsumptionReversal {
  consumptionId: string;
  reason: string;
  reversedBy: string;
}

export interface ConsumptionReport {
  consumptions: InventoryConsumption[];
  total: number;
  summary: {
    totalQuantityByProduct: Record<string, { quantity: number; unit: string }>;
    totalConsumptions: number;
    totalReversals: number;
    consumptionsByOrder: Record<string, number>;
  };
}

export class InventoryConsumptionTracker {
  private auditLogger: AuditLogger;

  constructor(
    private db: DrizzleD1Database<typeof schema>,
    auditLogger?: AuditLogger
  ) {
    this.auditLogger = auditLogger || new AuditLogger(db);
  }

  /**
   * Log inventory consumption for an order
   * Requirements: 3.1, 3.2, 9.2
   * 
   * Records inventory consumption when an order transitions to PREPARING state.
   * Creates an immutable consumption record with timestamp and user tracking.
   */
  async logConsumption(
    tenantId: string,
    consumption: ConsumptionRecord,
    userId: string
  ): Promise<InventoryConsumption> {
    const consumptionId = `consumption_${generateId()}`;
    const currentTime = Date.now();

    const newConsumption: NewInventoryConsumption = {
      id: consumptionId,
      tenantId,
      orderId: consumption.orderId,
      productId: consumption.productId,
      locationId: consumption.locationId,
      quantityConsumed: consumption.quantityConsumed,
      unit: consumption.unit,
      consumedAt: currentTime,
      reversedAt: null,
      reversedBy: null,
      notes: consumption.notes || null,
    };

    // Insert consumption record
    await this.db.insert(inventoryConsumptions).values(newConsumption);

    // Log to audit trail
    await this.auditLogger.logInventoryConsumption(
      tenantId,
      consumptionId,
      consumption.orderId,
      consumption.productId,
      consumption.quantityConsumed,
      consumption.unit,
      userId,
      'system'
    );

    // Fetch and return the created consumption record
    const [created] = await this.db
      .select()
      .from(inventoryConsumptions)
      .where(eq(inventoryConsumptions.id, consumptionId));

    return created;
  }

  /**
   * Log multiple inventory consumptions for an order (batch operation)
   * Requirements: 3.1, 3.2
   */
  async logBatchConsumption(
    tenantId: string,
    consumptions: ConsumptionRecord[],
    userId: string
  ): Promise<InventoryConsumption[]> {
    const currentTime = Date.now();
    const newConsumptions: NewInventoryConsumption[] = consumptions.map(consumption => ({
      id: `consumption_${generateId()}`,
      tenantId,
      orderId: consumption.orderId,
      productId: consumption.productId,
      locationId: consumption.locationId,
      quantityConsumed: consumption.quantityConsumed,
      unit: consumption.unit,
      consumedAt: currentTime,
      reversedAt: null,
      reversedBy: null,
      notes: consumption.notes || null,
    }));

    // Insert all consumption records
    await this.db.insert(inventoryConsumptions).values(newConsumptions);

    // Log each consumption to audit trail
    for (const consumption of newConsumptions) {
      await this.auditLogger.logInventoryConsumption(
        tenantId,
        consumption.id,
        consumption.orderId,
        consumption.productId,
        consumption.quantityConsumed,
        consumption.unit,
        userId,
        'system'
      );
    }

    // Fetch and return the created consumption records
    const consumptionIds = newConsumptions.map(c => c.id);
    const created = await this.db
      .select()
      .from(inventoryConsumptions)
      .where(
        and(
          eq(inventoryConsumptions.tenantId, tenantId),
          eq(inventoryConsumptions.orderId, consumptions[0].orderId)
        )
      );

    return created;
  }

  /**
   * Reverse inventory consumption for a cancelled order
   * Requirements: 3.2, 9.2
   * 
   * Marks consumption records as reversed when an order is cancelled.
   * This does not delete the original consumption record (immutability),
   * but marks it as reversed with timestamp and user identification.
   */
  async reverseConsumption(
    tenantId: string,
    reversal: ConsumptionReversal
  ): Promise<InventoryConsumption> {
    const currentTime = Date.now();

    // Update the consumption record to mark it as reversed
    await this.db
      .update(inventoryConsumptions)
      .set({
        reversedAt: currentTime,
        reversedBy: reversal.reversedBy,
        notes: reversal.reason,
      })
      .where(
        and(
          eq(inventoryConsumptions.id, reversal.consumptionId),
          eq(inventoryConsumptions.tenantId, tenantId),
          isNull(inventoryConsumptions.reversedAt) // Only reverse if not already reversed
        )
      );

    // Fetch the updated consumption record
    const [updated] = await this.db
      .select()
      .from(inventoryConsumptions)
      .where(eq(inventoryConsumptions.id, reversal.consumptionId));

    if (!updated) {
      throw new Error(`Consumption record ${reversal.consumptionId} not found or already reversed`);
    }

    // Log reversal to audit trail
    await this.auditLogger.logInventoryConsumptionReversal(
      tenantId,
      reversal.consumptionId,
      updated.orderId,
      reversal.reason,
      reversal.reversedBy,
      'system'
    );

    return updated;
  }

  /**
   * Reverse all inventory consumptions for an order
   * Requirements: 3.2
   */
  async reverseOrderConsumptions(
    tenantId: string,
    orderId: string,
    reason: string,
    reversedBy: string
  ): Promise<InventoryConsumption[]> {
    // Get all non-reversed consumptions for the order
    const consumptions = await this.db
      .select()
      .from(inventoryConsumptions)
      .where(
        and(
          eq(inventoryConsumptions.tenantId, tenantId),
          eq(inventoryConsumptions.orderId, orderId),
          isNull(inventoryConsumptions.reversedAt)
        )
      );

    // Reverse each consumption
    const reversed: InventoryConsumption[] = [];
    for (const consumption of consumptions) {
      const reversedConsumption = await this.reverseConsumption(tenantId, {
        consumptionId: consumption.id,
        reason,
        reversedBy,
      });
      reversed.push(reversedConsumption);
    }

    return reversed;
  }

  /**
   * Get consumption records for an order
   * Requirements: 9.2
   */
  async getOrderConsumptions(
    tenantId: string,
    orderId: string
  ): Promise<InventoryConsumption[]> {
    return await this.db
      .select()
      .from(inventoryConsumptions)
      .where(
        and(
          eq(inventoryConsumptions.tenantId, tenantId),
          eq(inventoryConsumptions.orderId, orderId)
        )
      )
      .orderBy(desc(inventoryConsumptions.consumedAt));
  }

  /**
   * Get consumption records for a product
   * Requirements: 9.2
   */
  async getProductConsumptions(
    tenantId: string,
    productId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<InventoryConsumption[]> {
    const conditions = [
      eq(inventoryConsumptions.tenantId, tenantId),
      eq(inventoryConsumptions.productId, productId),
    ];

    if (dateFrom) {
      conditions.push(eq(inventoryConsumptions.consumedAt, dateFrom.getTime()));
    }

    if (dateTo) {
      conditions.push(eq(inventoryConsumptions.consumedAt, dateTo.getTime()));
    }

    return await this.db
      .select()
      .from(inventoryConsumptions)
      .where(and(...conditions))
      .orderBy(desc(inventoryConsumptions.consumedAt));
  }

  /**
   * Generate consumption audit trail report
   * Requirements: 9.2
   */
  async generateConsumptionReport(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date,
    locationId?: string
  ): Promise<ConsumptionReport> {
    const conditions = [
      eq(inventoryConsumptions.tenantId, tenantId),
    ];

    if (locationId) {
      conditions.push(eq(inventoryConsumptions.locationId, locationId));
    }

    const consumptions = await this.db
      .select()
      .from(inventoryConsumptions)
      .where(and(...conditions))
      .orderBy(desc(inventoryConsumptions.consumedAt));

    // Filter by date range in memory (since we need to compare timestamps)
    const filteredConsumptions = consumptions.filter(c => {
      const consumedAt = c.consumedAt;
      return consumedAt >= dateFrom.getTime() && consumedAt <= dateTo.getTime();
    });

    // Calculate summary statistics
    const totalQuantityByProduct: Record<string, { quantity: number; unit: string }> = {};
    const consumptionsByOrder: Record<string, number> = {};
    let totalReversals = 0;

    filteredConsumptions.forEach(consumption => {
      // Track quantity by product
      if (!totalQuantityByProduct[consumption.productId]) {
        totalQuantityByProduct[consumption.productId] = {
          quantity: 0,
          unit: consumption.unit,
        };
      }
      
      // Only count non-reversed consumptions in totals
      if (!consumption.reversedAt) {
        totalQuantityByProduct[consumption.productId].quantity += consumption.quantityConsumed;
      } else {
        totalReversals++;
      }

      // Track consumptions by order
      consumptionsByOrder[consumption.orderId] = (consumptionsByOrder[consumption.orderId] || 0) + 1;
    });

    return {
      consumptions: filteredConsumptions,
      total: filteredConsumptions.length,
      summary: {
        totalQuantityByProduct,
        totalConsumptions: filteredConsumptions.length - totalReversals,
        totalReversals,
        consumptionsByOrder,
      },
    };
  }

  /**
   * Export consumption records to CSV format
   * Requirements: 9.2
   */
  async exportConsumptionsToCSV(
    tenantId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<string> {
    const report = await this.generateConsumptionReport(tenantId, dateFrom, dateTo);

    // CSV header
    const header = [
      'Consumption ID',
      'Order ID',
      'Product ID',
      'Location ID',
      'Quantity Consumed',
      'Unit',
      'Consumed At',
      'Reversed At',
      'Reversed By',
      'Notes',
    ].join(',');

    // CSV rows
    const rows = report.consumptions.map(consumption => {
      const consumedAt = new Date(consumption.consumedAt).toISOString();
      const reversedAt = consumption.reversedAt ? new Date(consumption.reversedAt).toISOString() : '';
      const notes = consumption.notes ? consumption.notes.replace(/"/g, '""') : '';

      return [
        consumption.id,
        consumption.orderId,
        consumption.productId,
        consumption.locationId,
        consumption.quantityConsumed,
        consumption.unit,
        consumedAt,
        reversedAt,
        consumption.reversedBy || '',
        `"${notes}"`,
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  /**
   * Get consumption statistics for a location
   * Requirements: 9.2
   */
  async getLocationConsumptionStats(
    tenantId: string,
    locationId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<{
    totalConsumptions: number;
    totalReversals: number;
    topProducts: Array<{ productId: string; quantity: number; unit: string }>;
    consumptionsByDay: Record<string, number>;
  }> {
    const report = await this.generateConsumptionReport(tenantId, dateFrom, dateTo, locationId);

    // Calculate top products
    const topProducts = Object.entries(report.summary.totalQuantityByProduct)
      .map(([productId, data]) => ({
        productId,
        quantity: data.quantity,
        unit: data.unit,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // Calculate consumptions by day
    const consumptionsByDay: Record<string, number> = {};
    report.consumptions.forEach(consumption => {
      if (!consumption.reversedAt) {
        const date = new Date(consumption.consumedAt).toISOString().split('T')[0];
        consumptionsByDay[date] = (consumptionsByDay[date] || 0) + 1;
      }
    });

    return {
      totalConsumptions: report.summary.totalConsumptions,
      totalReversals: report.summary.totalReversals,
      topProducts,
      consumptionsByDay,
    };
  }
}

/**
 * Factory function to create InventoryConsumptionTracker instance
 */
export function createInventoryConsumptionTracker(
  db: DrizzleD1Database<typeof schema>,
  auditLogger?: AuditLogger
): InventoryConsumptionTracker {
  return new InventoryConsumptionTracker(db, auditLogger);
}
