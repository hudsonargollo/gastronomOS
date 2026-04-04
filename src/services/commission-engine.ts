/**
 * Commission Engine Service
 * Handles commission calculation and tracking for waiters
 * Supports both percentage and fixed-value commission structures
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.5
 */

import { eq, and, inArray } from 'drizzle-orm';
import { 
  commissions,
  commissionConfigs,
  orders,
  orderItems,
  menuItems,
  OrderState,
  CommissionType,
  type Commission,
  type NewCommission,
  type CommissionConfig,
  type Order,
  type OrderItem,
  type MenuItem
} from '../db/schema';
import { generateId } from '../utils';

// Commission calculation request types
export interface CommissionCalculationRequest {
  orderId: string;
  tenantId: string;
}

export interface CommissionCalculationResult {
  success: boolean;
  commission?: Commission;
  error?: string;
  errorCode?: CommissionErrorCode;
}

export interface CommissionConfigRequest {
  tenantId: string;
  defaultType: CommissionType;
  defaultRate: number;
  itemSpecificRates?: CommissionItemRate[];
}

export interface CommissionItemRate {
  menuItemId: string;
  type: CommissionType;
  rate: number;
}

export interface WaiterCommissionSummary {
  waiterId: string;
  tenantId: string;
  periodStart: number;
  periodEnd: number;
  totalOrders: number;
  totalSales: number;
  totalCommission: number;
  averageOrderValue: number;
  commissions: Commission[];
}

export interface CommissionReportRequest {
  tenantId: string;
  waiterId?: string;
  dateFrom?: number;
  dateTo?: number;
  includePaid?: boolean;
}

export enum CommissionErrorCode {
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  ORDER_NOT_DELIVERED = 'ORDER_NOT_DELIVERED',
  ORDER_NO_WAITER = 'ORDER_NO_WAITER',
  COMMISSION_ALREADY_EXISTS = 'COMMISSION_ALREADY_EXISTS',
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  INVALID_COMMISSION_TYPE = 'INVALID_COMMISSION_TYPE',
  INVALID_COMMISSION_RATE = 'INVALID_COMMISSION_RATE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

/**
 * CommissionEngine class
 * Manages commission calculation, configuration, and reporting
 */
export class CommissionEngine {
  constructor(private db: any) {}

  /**
   * Calculate commission for a completed order
   * Requirements: 4.1, 4.2, 4.3, 4.5
   */
  async calculateCommission(request: CommissionCalculationRequest): Promise<CommissionCalculationResult> {
    try {
      const { orderId, tenantId } = request;

      // Get order details
      const order = await this.getOrderDetails(tenantId, orderId);
      if (!order) {
        return {
          success: false,
          error: 'Order not found',
          errorCode: CommissionErrorCode.ORDER_NOT_FOUND
        };
      }

      // Validate order has a waiter assigned
      if (!order.waiterId) {
        return {
          success: false,
          error: 'Order has no waiter assigned',
          errorCode: CommissionErrorCode.ORDER_NO_WAITER
        };
      }

      // Validate order is in DELIVERED state (Requirement 4.3)
      if (order.state !== OrderState.DELIVERED) {
        return {
          success: false,
          error: `Commission can only be calculated for DELIVERED orders. Current state: ${order.state}`,
          errorCode: CommissionErrorCode.ORDER_NOT_DELIVERED
        };
      }

      // Check if commission already exists for this order
      const existingCommission = await this.getCommissionByOrder(tenantId, orderId);
      if (existingCommission) {
        return {
          success: false,
          error: 'Commission already exists for this order',
          errorCode: CommissionErrorCode.COMMISSION_ALREADY_EXISTS
        };
      }

      // Get commission configuration for tenant
      const config = await this.getCommissionConfig(tenantId);
      if (!config) {
        return {
          success: false,
          error: 'No commission configuration found for tenant',
          errorCode: CommissionErrorCode.CONFIG_NOT_FOUND
        };
      }

      // Get order items for item-specific rates
      const orderItemsData = await this.getOrderItems(orderId);

      // Calculate commission based on configuration
      const calculation = await this.calculateCommissionAmount(
        order,
        orderItemsData,
        config
      );

      // Create commission record
      const commissionId = generateId();
      const now = Date.now();

      const newCommission: NewCommission = {
        id: commissionId,
        tenantId,
        waiterId: order.waiterId,
        orderId,
        orderAmount: order.totalAmount,
        commissionRate: calculation.effectiveRate,
        commissionAmount: calculation.commissionAmount,
        commissionType: calculation.commissionType,
        calculatedAt: now,
        paidAt: null,
        notes: calculation.notes
      };

      await this.db.insert(commissions).values(newCommission);

      // Fetch the created commission
      const createdCommission = await this.getCommissionById(commissionId);

      return {
        success: true,
        commission: createdCommission || undefined
      };

    } catch (error) {
      console.error('Error calculating commission:', error);
      return {
        success: false,
        error: 'Database error occurred while calculating commission',
        errorCode: CommissionErrorCode.DATABASE_ERROR
      };
    }
  }

  /**
   * Get commission configuration for a tenant
   * Requirements: 4.1, 4.5
   */
  async getCommissionConfig(tenantId: string): Promise<CommissionConfig | null> {
    try {
      const result = await this.db
        .select()
        .from(commissionConfigs)
        .where(and(
          eq(commissionConfigs.tenantId, tenantId),
          eq(commissionConfigs.active, true)
        ))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('Error getting commission config:', error);
      return null;
    }
  }

  /**
   * Create or update commission configuration for a tenant
   * Requirements: 4.1, 4.5
   */
  async upsertCommissionConfig(request: CommissionConfigRequest): Promise<{
    success: boolean;
    config?: CommissionConfig;
    error?: string;
  }> {
    try {
      const { tenantId, defaultType, defaultRate, itemSpecificRates } = request;

      // Validate commission type
      if (!Object.values(CommissionType).includes(defaultType)) {
        return {
          success: false,
          error: 'Invalid commission type'
        };
      }

      // Validate commission rate
      if (defaultRate < 0) {
        return {
          success: false,
          error: 'Commission rate must be non-negative'
        };
      }

      // Check if config already exists
      const existingConfig = await this.getCommissionConfig(tenantId);
      const now = Date.now();

      if (existingConfig) {
        // Update existing config
        await this.db
          .update(commissionConfigs)
          .set({
            defaultType,
            defaultRate,
            updatedAt: now
          })
          .where(eq(commissionConfigs.id, existingConfig.id));

        // Handle item-specific rates if provided
        if (itemSpecificRates && itemSpecificRates.length > 0) {
          await this.upsertItemSpecificRates(tenantId, itemSpecificRates);
        }

        const updatedConfig = await this.getCommissionConfig(tenantId);
        return { success: true, config: updatedConfig || undefined };
      }

      // Create new config
      const configId = generateId();
      await this.db.insert(commissionConfigs).values({
        id: configId,
        tenantId,
        defaultType,
        defaultRate,
        menuItemId: null,
        itemSpecificType: null,
        itemSpecificRate: null,
        active: true,
        createdAt: now,
        updatedAt: now
      });

      // Handle item-specific rates if provided
      if (itemSpecificRates && itemSpecificRates.length > 0) {
        await this.upsertItemSpecificRates(tenantId, itemSpecificRates);
      }

      const newConfig = await this.getCommissionConfig(tenantId);
      return { success: true, config: newConfig || undefined };

    } catch (error) {
      console.error('Error upserting commission config:', error);
      return {
        success: false,
        error: 'Database error occurred while saving commission configuration'
      };
    }
  }

  /**
   * Get commissions for a waiter within a time period
   * Requirements: 4.4
   */
  async getWaiterCommissions(
    tenantId: string,
    waiterId: string,
    dateFrom?: number,
    dateTo?: number
  ): Promise<Commission[]> {
    try {
      let query = this.db
        .select()
        .from(commissions)
        .where(and(
          eq(commissions.tenantId, tenantId),
          eq(commissions.waiterId, waiterId)
        ));

      if (dateFrom) {
        query = query.where(and(
          eq(commissions.tenantId, tenantId),
          eq(commissions.waiterId, waiterId),
          // Add date filter
        ));
      }

      if (dateTo) {
        query = query.where(and(
          eq(commissions.tenantId, tenantId),
          eq(commissions.waiterId, waiterId),
          // Add date filter
        ));
      }

      const results = await query.orderBy(commissions.calculatedAt);
      return results;
    } catch (error) {
      console.error('Error getting waiter commissions:', error);
      return [];
    }
  }

  /**
   * Generate commission summary for a waiter
   * Requirements: 4.4, 14.2, 14.3
   */
  async getWaiterCommissionSummary(
    tenantId: string,
    waiterId: string,
    periodStart: number,
    periodEnd: number
  ): Promise<WaiterCommissionSummary | null> {
    try {
      const commissionsList = await this.getWaiterCommissions(
        tenantId,
        waiterId,
        periodStart,
        periodEnd
      );

      // Filter by period
      const filteredCommissions = commissionsList.filter(
        c => c.calculatedAt >= periodStart && c.calculatedAt <= periodEnd
      );

      const totalOrders = filteredCommissions.length;
      const totalSales = filteredCommissions.reduce((sum, c) => sum + c.orderAmount, 0);
      const totalCommission = filteredCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);
      const averageOrderValue = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;

      return {
        waiterId,
        tenantId,
        periodStart,
        periodEnd,
        totalOrders,
        totalSales,
        totalCommission,
        averageOrderValue,
        commissions: filteredCommissions
      };
    } catch (error) {
      console.error('Error getting waiter commission summary:', error);
      return null;
    }
  }

  /**
   * Get all commissions for a tenant (for reporting)
   * Requirements: 4.4, 14.1
   */
  async getCommissionReport(request: CommissionReportRequest): Promise<Commission[]> {
    try {
      const { tenantId, waiterId, dateFrom, dateTo, includePaid = true } = request;

      let whereConditions: any[] = [eq(commissions.tenantId, tenantId)];

      if (waiterId) {
        whereConditions.push(eq(commissions.waiterId, waiterId));
      }

      const results = await this.db
        .select()
        .from(commissions)
        .where(and(...whereConditions))
        .orderBy(commissions.calculatedAt);

      // Filter by date range
      let filtered = results;
      if (dateFrom) {
        filtered = filtered.filter(c => c.calculatedAt >= dateFrom);
      }
      if (dateTo) {
        filtered = filtered.filter(c => c.calculatedAt <= dateTo);
      }
      if (!includePaid) {
        filtered = filtered.filter(c => c.paidAt === null);
      }

      return filtered;
    } catch (error) {
      console.error('Error getting commission report:', error);
      return [];
    }
  }

  /**
   * Mark commission as paid
   */
  async markCommissionPaid(
    tenantId: string,
    commissionId: string,
    paidAt?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const paidTimestamp = paidAt || Date.now();

      await this.db
        .update(commissions)
        .set({ paidAt: paidTimestamp })
        .where(and(
          eq(commissions.tenantId, tenantId),
          eq(commissions.id, commissionId)
        ));

      return { success: true };
    } catch (error) {
      console.error('Error marking commission as paid:', error);
      return { success: false, error: 'Failed to mark commission as paid' };
    }
  }

  /**
   * Batch mark commissions as paid
   */
  async batchMarkCommissionsPaid(
    tenantId: string,
    commissionIds: string[],
    paidAt?: number
  ): Promise<{ success: boolean; paidCount: number; error?: string }> {
    try {
      const paidTimestamp = paidAt || Date.now();
      let paidCount = 0;

      for (const commissionId of commissionIds) {
        await this.db
          .update(commissions)
          .set({ paidAt: paidTimestamp })
          .where(and(
            eq(commissions.tenantId, tenantId),
            eq(commissions.id, commissionId)
          ));
        paidCount++;
      }

      return { success: true, paidCount };
    } catch (error) {
      console.error('Error batch marking commissions as paid:', error);
      return { success: false, paidCount: 0, error: 'Failed to mark commissions as paid' };
    }
  }

  // Private helper methods

  /**
   * Calculate commission amount based on configuration
   * Requirements: 4.1, 4.5
   */
  private async calculateCommissionAmount(
    order: Order,
    orderItemsData: OrderItem[],
    config: CommissionConfig
  ): Promise<{
    commissionAmount: number;
    commissionType: CommissionType;
    effectiveRate: number;
    notes?: string;
  }> {
    // Check for item-specific rates (Requirement 4.5)
    const itemSpecificCommissions = await this.calculateItemSpecificCommissions(
      orderItemsData,
      config
    );

    if (itemSpecificCommissions.length > 0) {
      // Use item-specific rates
      const totalCommission = itemSpecificCommissions.reduce((sum, item) => sum + item.commissionAmount, 0);
      const effectiveRate = order.totalAmount > 0 
        ? (totalCommission / order.totalAmount) * 100 
        : 0;

      return {
        commissionAmount: totalCommission,
        commissionType: CommissionType.PERCENTAGE, // Mixed types, report as percentage
        effectiveRate,
        notes: 'Item-specific rates applied'
      };
    }

    // Use default configuration
    const commissionType = config.defaultType as CommissionType;
    const rate = config.defaultRate;

    let commissionAmount: number;
    if (commissionType === CommissionType.PERCENTAGE) {
      commissionAmount = Math.round((order.totalAmount * rate) / 100);
    } else {
      // Fixed value - rate is in cents
      commissionAmount = Math.round(rate);
    }

    return {
      commissionAmount,
      commissionType,
      effectiveRate: rate
    };
  }

  /**
   * Calculate item-specific commissions
   * Requirement 4.5
   */
  private async calculateItemSpecificCommissions(
    orderItemsData: OrderItem[],
    config: CommissionConfig
  ): Promise<{ menuItemId: string; commissionAmount: number }[]> {
    if (!orderItemsData || orderItemsData.length === 0) {
      return [];
    }

    const menuItemIds = orderItemsData.map(item => item.menuItemId);
    
    // Get item-specific configurations
    const itemConfigs = await this.db
      .select()
      .from(commissionConfigs)
      .where(and(
        eq(commissionConfigs.tenantId, config.tenantId),
        inArray(commissionConfigs.menuItemId, menuItemIds),
        eq(commissionConfigs.active, true)
      ));

    if (itemConfigs.length === 0) {
      return [];
    }

    // Create a map of menu item ID to config
    const configMap = new Map<string, CommissionConfig>();
    for (const itemConfig of itemConfigs) {
      if (itemConfig.menuItemId) {
        configMap.set(itemConfig.menuItemId, itemConfig);
      }
    }

    // Calculate commission for each item
    const itemCommissions: { menuItemId: string; commissionAmount: number }[] = [];

    for (const orderItem of orderItemsData) {
      const itemConfig = configMap.get(orderItem.menuItemId);
      if (!itemConfig) continue;

      const type = (itemConfig.itemSpecificType || itemConfig.defaultType) as CommissionType;
      const rate = itemConfig.itemSpecificRate ?? itemConfig.defaultRate;

      let commissionAmount: number;
      if (type === CommissionType.PERCENTAGE) {
        commissionAmount = Math.round((orderItem.totalPrice * rate) / 100);
      } else {
        // Fixed value per item
        commissionAmount = Math.round(rate * orderItem.quantity);
      }

      itemCommissions.push({
        menuItemId: orderItem.menuItemId,
        commissionAmount
      });
    }

    return itemCommissions;
  }

  /**
   * Upsert item-specific commission rates
   */
  private async upsertItemSpecificRates(
    tenantId: string,
    itemRates: CommissionItemRate[]
  ): Promise<void> {
    const now = Date.now();

    for (const itemRate of itemRates) {
      // Check if config exists for this menu item
      const existing = await this.db
        .select()
        .from(commissionConfigs)
        .where(and(
          eq(commissionConfigs.tenantId, tenantId),
          eq(commissionConfigs.menuItemId, itemRate.menuItemId)
        ))
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        await this.db
          .update(commissionConfigs)
          .set({
            itemSpecificType: itemRate.type,
            itemSpecificRate: itemRate.rate,
            updatedAt: now
          })
          .where(eq(commissionConfigs.id, existing[0].id));
      } else {
        // Create new
        const configId = generateId();
        await this.db.insert(commissionConfigs).values({
          id: configId,
          tenantId,
          defaultType: CommissionType.PERCENTAGE, // Default fallback
          defaultRate: 0,
          menuItemId: itemRate.menuItemId,
          itemSpecificType: itemRate.type,
          itemSpecificRate: itemRate.rate,
          active: true,
          createdAt: now,
          updatedAt: now
        });
      }
    }
  }

  /**
   * Get order details
   */
  private async getOrderDetails(tenantId: string, orderId: string): Promise<Order | null> {
    const result = await this.db
      .select()
      .from(orders)
      .where(and(
        eq(orders.tenantId, tenantId),
        eq(orders.id, orderId)
      ))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get order items
   */
  private async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
  }

  /**
   * Get commission by order ID
   */
  private async getCommissionByOrder(tenantId: string, orderId: string): Promise<Commission | null> {
    const result = await this.db
      .select()
      .from(commissions)
      .where(and(
        eq(commissions.tenantId, tenantId),
        eq(commissions.orderId, orderId)
      ))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get commission by ID
   */
  private async getCommissionById(commissionId: string): Promise<Commission | null> {
    const result = await this.db
      .select()
      .from(commissions)
      .where(eq(commissions.id, commissionId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Assign waiter to an order
   * Requirement 4.2
   */
  async assignWaiterToOrder(
    tenantId: string,
    orderId: string,
    waiterId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const order = await this.getOrderDetails(tenantId, orderId);
      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      // Check if order is in a state that allows waiter assignment
      if (order.state === OrderState.DELIVERED || order.state === OrderState.CANCELLED) {
        return { success: false, error: 'Cannot assign waiter to completed or cancelled order' };
      }

      await this.db
        .update(orders)
        .set({
          waiterId,
          updatedAt: Date.now()
        })
        .where(and(
          eq(orders.tenantId, tenantId),
          eq(orders.id, orderId)
        ));

      return { success: true };
    } catch (error) {
      console.error('Error assigning waiter to order:', error);
      return { success: false, error: 'Failed to assign waiter to order' };
    }
  }

  /**
   * Get orders eligible for commission calculation
   * (DELIVERED orders without commission)
   */
  async getOrdersEligibleForCommission(tenantId: string): Promise<Order[]> {
    try {
      // Get all DELIVERED orders with waiter assigned
      const deliveredOrders = await this.db
        .select()
        .from(orders)
        .where(and(
          eq(orders.tenantId, tenantId),
          eq(orders.state, OrderState.DELIVERED)
        ))
        .orderBy(orders.createdAt);

      // Filter out orders that already have commissions
      const ordersWithCommissions = await this.db
        .select()
        .from(commissions)
        .where(eq(commissions.tenantId, tenantId));

      const commissionedOrderIds = new Set(ordersWithCommissions.map(c => c.orderId));

      return deliveredOrders.filter(
        order => order.waiterId && !commissionedOrderIds.has(order.id)
      );
    } catch (error) {
      console.error('Error getting orders eligible for commission:', error);
      return [];
    }
  }

  /**
   * Batch calculate commissions for all eligible orders
   */
  async batchCalculateCommissions(tenantId: string): Promise<{
    success: boolean;
    calculatedCount: number;
    errors: string[];
  }> {
    try {
      const eligibleOrders = await this.getOrdersEligibleForCommission(tenantId);
      let calculatedCount = 0;
      const errors: string[] = [];

      for (const order of eligibleOrders) {
        const result = await this.calculateCommission({
          orderId: order.id,
          tenantId
        });

        if (result.success) {
          calculatedCount++;
        } else {
          errors.push(`Order ${order.id}: ${result.error}`);
        }
      }

      return { success: true, calculatedCount, errors };
    } catch (error) {
      console.error('Error batch calculating commissions:', error);
      return { success: false, calculatedCount: 0, errors: ['Batch calculation failed'] };
    }
  }
}

/**
 * Factory function to create CommissionEngine instance
 */
export function createCommissionEngine(db: any): CommissionEngine {
  return new CommissionEngine(db);
}