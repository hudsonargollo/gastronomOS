// Order Management Service

import { eq, and, desc } from 'drizzle-orm';
import { 
  orders, 
  orderItems, 
  menuItems,
  OrderState,
  type Order, 
  type NewOrder,
  type OrderItem,
  type NewOrderItem,
  type MenuItem
} from '../db/schema';
import { 
  CreateOrderRequest,
  CreateOrderResult,
  UpdateOrderRequest,
  UpdateOrderResult,
  OrderDetails,
  OrderItemDetails,
  OrderErrorCode
} from '../types/orders';

export class OrderManagementService {
  constructor(private db: any) {}

  /**
   * Create a new order with items
   */
  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResult> {
    const { tenantId, locationId, tableNumber, waiterId, items, specialInstructions } = request;

    try {
      return await this.db.transaction(async (tx: any) => {
        // Validate menu items and calculate totals
        const menuItemIds = items.map(item => item.menuItemId);
        const menuItemsData = await tx
          .select()
          .from(menuItems)
          .where(and(
            eq(menuItems.tenantId, tenantId),
            // TODO: Add IN clause for menuItemIds when available in drizzle
          ));

        if (menuItemsData.length !== menuItemIds.length) {
          return {
            success: false,
            error: 'One or more menu items not found',
            errorCode: OrderErrorCode.INVALID_MENU_ITEM
          };
        }

        // Check availability
        const unavailableItems = menuItemsData.filter(item => !item.isAvailable || !item.active);
        if (unavailableItems.length > 0) {
          return {
            success: false,
            error: `Menu items not available: ${unavailableItems.map(i => i.name).join(', ')}`,
            errorCode: OrderErrorCode.INVALID_MENU_ITEM
          };
        }

        // Calculate totals
        let subtotalAmount = 0;
        const orderItemsToCreate: NewOrderItem[] = [];

        for (const item of items) {
          const menuItem = menuItemsData.find(m => m.id === item.menuItemId);
          if (!menuItem) continue;

          if (item.quantity <= 0) {
            return {
              success: false,
              error: 'Invalid quantity for menu item',
              errorCode: OrderErrorCode.INVALID_QUANTITY
            };
          }

          const totalPrice = menuItem.price * item.quantity;
          subtotalAmount += totalPrice;

          orderItemsToCreate.push({
            id: crypto.randomUUID(),
            orderId: '', // Will be set after order creation
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            unitPrice: menuItem.price,
            totalPrice: totalPrice,
            specialInstructions: item.specialInstructions,
            status: 'PENDING',
            createdAt: Date.now()
          });
        }

        // Calculate tax (assuming 10% for now - should be configurable)
        const taxAmount = Math.round(subtotalAmount * 0.1);
        const totalAmount = subtotalAmount + taxAmount;

        // Generate order number
        const orderNumber = await this.generateOrderNumber(tenantId, tx);

        // Create order
        const orderId = crypto.randomUUID();
        const now = Date.now();

        const newOrder: NewOrder = {
          id: orderId,
          tenantId: tenantId,
          orderNumber: orderNumber,
          state: OrderState.PLACED,
          tableNumber: tableNumber,
          waiterId: waiterId,
          locationId: locationId,
          totalAmount: totalAmount,
          subtotalAmount: subtotalAmount,
          taxAmount: taxAmount,
          specialInstructions: specialInstructions,
          estimatedReadyTime: now + (Math.max(...menuItemsData.map(m => m.preparationTime)) * 60 * 1000),
          version: 1,
          createdAt: now,
          updatedAt: now
        };

        await tx.insert(orders).values(newOrder);

        // Create order items
        const orderItemsWithOrderId = orderItemsToCreate.map(item => ({
          ...item,
          orderId: orderId
        }));

        await tx.insert(orderItems).values(orderItemsWithOrderId);

        // Get complete order data
        const orderDetails = await this.getOrderById(orderId, tx);

        return {
          success: true,
          order: orderDetails
        };
      });
    } catch (error) {
      console.error('Error creating order:', error);
      return {
        success: false,
        error: 'Internal server error during order creation',
        errorCode: OrderErrorCode.VALIDATION_ERROR
      };
    }
  }

  /**
   * Update an existing order (only allowed in PLACED state)
   */
  async updateOrder(request: UpdateOrderRequest): Promise<UpdateOrderResult> {
    const { orderId, version, tableNumber, waiterId, specialInstructions, items } = request;

    try {
      return await this.db.transaction(async (tx: any) => {
        // Get current order
        const currentOrder = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);

        if (!currentOrder || currentOrder.length === 0) {
          return {
            success: false,
            error: 'Order not found',
            errorCode: OrderErrorCode.ORDER_NOT_FOUND
          };
        }

        const order = currentOrder[0] as Order;

        // Check version for optimistic locking
        if (order.version !== version) {
          return {
            success: false,
            error: 'Order was modified by another process. Please refresh and try again.',
            errorCode: OrderErrorCode.CONCURRENT_MODIFICATION
          };
        }

        // Check if order can be modified
        if (order.state !== OrderState.PLACED) {
          return {
            success: false,
            error: 'Order cannot be modified in current state',
            errorCode: OrderErrorCode.INVALID_STATE_TRANSITION
          };
        }

        const now = Date.now();
        let newSubtotal = order.subtotalAmount;
        let newTax = order.taxAmount;
        let newTotal = order.totalAmount;

        // Update items if provided
        if (items) {
          // Delete existing items
          await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));

          // Validate and create new items
          const menuItemIds = items.map(item => item.menuItemId);
          const menuItemsData = await tx
            .select()
            .from(menuItems)
            .where(and(
              eq(menuItems.tenantId, order.tenantId),
              // TODO: Add IN clause for menuItemIds
            ));

          newSubtotal = 0;
          const newOrderItems: NewOrderItem[] = [];

          for (const item of items) {
            const menuItem = menuItemsData.find(m => m.id === item.menuItemId);
            if (!menuItem) {
              return {
                success: false,
                error: `Menu item not found: ${item.menuItemId}`,
                errorCode: OrderErrorCode.INVALID_MENU_ITEM
              };
            }

            if (!menuItem.isAvailable || !menuItem.active) {
              return {
                success: false,
                error: `Menu item not available: ${menuItem.name}`,
                errorCode: OrderErrorCode.INVALID_MENU_ITEM
              };
            }

            if (item.quantity <= 0) {
              return {
                success: false,
                error: 'Invalid quantity for menu item',
                errorCode: OrderErrorCode.INVALID_QUANTITY
              };
            }

            const totalPrice = menuItem.price * item.quantity;
            newSubtotal += totalPrice;

            newOrderItems.push({
              id: item.id || crypto.randomUUID(),
              orderId: orderId,
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              unitPrice: menuItem.price,
              totalPrice: totalPrice,
              specialInstructions: item.specialInstructions,
              status: 'PENDING',
              createdAt: now
            });
          }

          // Recalculate tax and total
          newTax = Math.round(newSubtotal * 0.1);
          newTotal = newSubtotal + newTax;

          // Insert new items
          if (newOrderItems.length > 0) {
            await tx.insert(orderItems).values(newOrderItems);
          }
        }

        // Update order
        await tx
          .update(orders)
          .set({
            tableNumber: tableNumber ?? order.tableNumber,
            waiterId: waiterId ?? order.waiterId,
            specialInstructions: specialInstructions ?? order.specialInstructions,
            subtotalAmount: newSubtotal,
            taxAmount: newTax,
            totalAmount: newTotal,
            version: order.version + 1,
            updatedAt: now
          })
          .where(eq(orders.id, orderId));

        // Get updated order data
        const updatedOrder = await this.getOrderById(orderId, tx);

        return {
          success: true,
          order: updatedOrder
        };
      });
    } catch (error) {
      console.error('Error updating order:', error);
      return {
        success: false,
        error: 'Internal server error during order update',
        errorCode: OrderErrorCode.VALIDATION_ERROR
      };
    }
  }

  /**
   * Get order by ID with items
   */
  async getOrderById(orderId: string, tx?: any): Promise<OrderDetails | null> {
    const database = tx || this.db;

    try {
      const orderData = await database
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!orderData || orderData.length === 0) {
        return null;
      }

      const order = orderData[0] as Order;

      // Get order items
      const itemsData = await database
        .select({
          orderItem: orderItems,
          menuItem: menuItems
        })
        .from(orderItems)
        .leftJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
        .where(eq(orderItems.orderId, orderId));

      const items: OrderItemDetails[] = itemsData.map(item => ({
        id: item.orderItem.id,
        orderId: item.orderItem.orderId,
        menuItemId: item.orderItem.menuItemId,
        quantity: item.orderItem.quantity,
        unitPrice: item.orderItem.unitPrice,
        totalPrice: item.orderItem.totalPrice,
        specialInstructions: item.orderItem.specialInstructions,
        status: item.orderItem.status as any,
        createdAt: item.orderItem.createdAt
      }));

      return {
        id: order.id,
        tenantId: order.tenantId,
        orderNumber: order.orderNumber,
        state: order.state as OrderState,
        tableNumber: order.tableNumber,
        waiterId: order.waiterId,
        locationId: order.locationId,
        totalAmount: order.totalAmount,
        subtotalAmount: order.subtotalAmount,
        taxAmount: order.taxAmount,
        specialInstructions: order.specialInstructions,
        estimatedReadyTime: order.estimatedReadyTime,
        actualReadyTime: order.actualReadyTime,
        version: order.version,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: items
      };
    } catch (error) {
      console.error('Error getting order by ID:', error);
      return null;
    }
  }

  /**
   * Get orders for a tenant with filtering
   */
  async getOrders(
    tenantId: string,
    options: {
      locationId?: string;
      waiterId?: string;
      state?: OrderState;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<OrderDetails[]> {
    try {
      let query = this.db
        .select()
        .from(orders)
        .where(eq(orders.tenantId, tenantId));

      if (options.locationId) {
        query = query.where(and(
          eq(orders.tenantId, tenantId),
          eq(orders.locationId, options.locationId)
        ));
      }

      if (options.waiterId) {
        query = query.where(and(
          eq(orders.tenantId, tenantId),
          eq(orders.waiterId, options.waiterId)
        ));
      }

      if (options.state) {
        query = query.where(and(
          eq(orders.tenantId, tenantId),
          eq(orders.state, options.state)
        ));
      }

      query = query.orderBy(desc(orders.createdAt));

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.offset(options.offset);
      }

      const ordersData = await query;

      // Get order details for each order
      const orderDetails: OrderDetails[] = [];
      for (const order of ordersData) {
        const details = await this.getOrderById(order.id);
        if (details) {
          orderDetails.push(details);
        }
      }

      return orderDetails;
    } catch (error) {
      console.error('Error getting orders:', error);
      return [];
    }
  }

  /**
   * Generate unique order number for tenant
   */
  private async generateOrderNumber(tenantId: string, tx: any): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get count of orders today
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

    const todayOrders = await tx
      .select({ count: 'COUNT(*)' })
      .from(orders)
      .where(and(
        eq(orders.tenantId, tenantId),
        // TODO: Add date range filter when available
      ));

    const orderCount = parseInt(todayOrders[0]?.count || '0') + 1;
    const orderNumber = `${datePrefix}-${orderCount.toString().padStart(4, '0')}`;

    return orderNumber;
  }

  /**
   * Cancel an order
   */
  async cancelOrder(
    orderId: string, 
    reason?: string, 
    cancelledBy?: string
  ): Promise<UpdateOrderResult> {
    try {
      const order = await this.getOrderById(orderId);
      if (!order) {
        return {
          success: false,
          error: 'Order not found',
          errorCode: OrderErrorCode.ORDER_NOT_FOUND
        };
      }

      if (order.state === OrderState.DELIVERED) {
        return {
          success: false,
          error: 'Cannot cancel delivered order',
          errorCode: OrderErrorCode.INVALID_STATE_TRANSITION
        };
      }

      if (order.state === OrderState.CANCELLED) {
        return {
          success: false,
          error: 'Order is already cancelled',
          errorCode: OrderErrorCode.INVALID_STATE_TRANSITION
        };
      }

      // Update order state to cancelled
      const now = Date.now();
      await this.db
        .update(orders)
        .set({
          state: OrderState.CANCELLED,
          version: order.version + 1,
          updatedAt: now
        })
        .where(eq(orders.id, orderId));

      // Update all order items to cancelled
      await this.db
        .update(orderItems)
        .set({
          status: 'CANCELLED'
        })
        .where(eq(orderItems.orderId, orderId));

      const updatedOrder = await this.getOrderById(orderId);

      return {
        success: true,
        order: updatedOrder
      };
    } catch (error) {
      console.error('Error cancelling order:', error);
      return {
        success: false,
        error: 'Internal server error during order cancellation',
        errorCode: OrderErrorCode.VALIDATION_ERROR
      };
    }
  }

  /**
   * Update order instructions (for waiter panel modifications)
   */
  async updateOrderInstructions(request: {
    orderId: string;
    specialInstructions?: string;
    itemInstructions?: Array<{ id: string; specialInstructions?: string }>;
  }): Promise<UpdateOrderResult> {
    const { orderId, specialInstructions, itemInstructions } = request;

    try {
      return await this.db.transaction(async (tx: any) => {
        const order = await this.getOrderById(orderId, tx);
        if (!order) {
          return {
            success: false,
            error: 'Order not found',
            errorCode: OrderErrorCode.ORDER_NOT_FOUND
          };
        }

        // Update order-level special instructions if provided
        if (specialInstructions !== undefined) {
          await tx
            .update(orders)
            .set({
              specialInstructions,
              updatedAt: Date.now()
            })
            .where(eq(orders.id, orderId));
        }

        // Update item-level special instructions if provided
        if (itemInstructions && itemInstructions.length > 0) {
          for (const itemUpdate of itemInstructions) {
            await tx
              .update(orderItems)
              .set({
                specialInstructions: itemUpdate.specialInstructions
              })
              .where(and(
                eq(orderItems.id, itemUpdate.id),
                eq(orderItems.orderId, orderId)
              ));
          }
        }

        const updatedOrder = await this.getOrderById(orderId, tx);

        return {
          success: true,
          order: updatedOrder
        };
      });
    } catch (error) {
      console.error('Error updating order instructions:', error);
      return {
        success: false,
        error: 'Internal server error during order update',
        errorCode: OrderErrorCode.VALIDATION_ERROR
      };
    }
  }
}