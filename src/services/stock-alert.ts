// Stock Alert System for monitoring inventory levels and generating alerts
// Requirements: 3.5

import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, sql, inArray, lt, lte, gte, desc, asc } from 'drizzle-orm';
import { 
  stockAlertConfigs,
  stockAlerts,
  stockAlertNotifications,
  inventoryItems,
  products,
  locations,
  users,
  type StockAlertConfig,
  type NewStockAlertConfig,
  type StockAlert,
  type NewStockAlert,
  type StockAlertNotification,
  type NewStockAlertNotification,
  StockAlertType,
  StockAlertSeverity,
  NotificationType,
  NotificationStatus,
  type StockAlertTypeValue,
  type StockAlertSeverityValue,
  type NotificationTypeValue,
  type NotificationStatusValue
} from '../db/schema';
import { generateId, getCurrentTimestamp } from '../utils';
import { createInventoryIntegrationService, type InventoryIntegrationService } from './inventory-integration';

export interface StockAlertConfigRequest {
  tenantId: string;
  productId: string;
  locationId: string;
  lowStockThreshold: number;
  criticalStockThreshold: number;
  outOfStockThreshold?: number;
  alertEnabled?: boolean;
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  createdBy: string;
}

export interface StockAlertConfigResult {
  success: boolean;
  config?: StockAlertConfigDetails;
  error?: string;
  errorCode?: string;
}

export interface StockAlertConfigDetails {
  id: string;
  tenantId: string;
  productId: string;
  locationId: string;
  lowStockThreshold: number;
  criticalStockThreshold: number;
  outOfStockThreshold: number;
  alertEnabled: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  productName?: string;
  locationName?: string;
}

export interface StockAlertDetails {
  id: string;
  tenantId: string;
  productId: string;
  locationId: string;
  alertType: StockAlertTypeValue;
  currentStock: number;
  threshold: number;
  severity: StockAlertSeverityValue;
  message: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  resolved: boolean;
  resolvedAt?: number;
  createdAt: number;
  updatedAt: number;
  productName?: string;
  locationName?: string;
  notifications?: StockAlertNotificationDetails[];
}

export interface StockAlertNotificationDetails {
  id: string;
  tenantId: string;
  alertId: string;
  notificationType: NotificationTypeValue;
  recipient: string;
  status: NotificationStatusValue;
  sentAt?: number;
  deliveredAt?: number;
  failedAt?: number;
  errorMessage?: string;
  retryCount: number;
  createdAt: number;
}

export interface StockMonitoringRequest {
  tenantId: string;
  locationId?: string;
  productIds?: string[];
}

export interface StockMonitoringResult {
  success: boolean;
  alertsGenerated?: StockAlertDetails[];
  alertsResolved?: string[];
  error?: string;
  errorCode?: string;
}

export interface StockLevelInfo {
  productId: string;
  locationId: string;
  currentStock: number;
  availableStock: number;
  reservedStock: number;
  inTransitStock: number;
  config?: StockAlertConfigDetails;
  activeAlerts: StockAlertDetails[];
}

export interface NotificationRequest {
  alertId: string;
  notificationType: NotificationTypeValue;
  recipient: string;
}

export interface NotificationResult {
  success: boolean;
  notification?: StockAlertNotificationDetails;
  error?: string;
  errorCode?: string;
}

export enum StockAlertErrorCode {
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  ALERT_NOT_FOUND = 'ALERT_NOT_FOUND',
  INVALID_THRESHOLD = 'INVALID_THRESHOLD',
  DUPLICATE_CONFIG = 'DUPLICATE_CONFIG',
  NOTIFICATION_FAILED = 'NOTIFICATION_FAILED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVENTORY_ERROR = 'INVENTORY_ERROR'
}

export class StockAlertService {
  private inventoryService: InventoryIntegrationService;

  constructor(private db: DrizzleD1Database) {
    this.inventoryService = createInventoryIntegrationService(db);
  }

  /**
   * Create or update stock alert configuration
   * Requirements: 3.5
   */
  async createOrUpdateAlertConfig(request: StockAlertConfigRequest): Promise<StockAlertConfigResult> {
    try {
      const { 
        tenantId, 
        productId, 
        locationId, 
        lowStockThreshold, 
        criticalStockThreshold, 
        outOfStockThreshold = 0,
        alertEnabled = true,
        emailNotifications = true,
        smsNotifications = false,
        createdBy 
      } = request;

      // Validate thresholds
      if (lowStockThreshold < criticalStockThreshold) {
        return {
          success: false,
          error: 'Low stock threshold must be greater than or equal to critical stock threshold',
          errorCode: StockAlertErrorCode.INVALID_THRESHOLD
        };
      }

      if (criticalStockThreshold < outOfStockThreshold) {
        return {
          success: false,
          error: 'Critical stock threshold must be greater than or equal to out of stock threshold',
          errorCode: StockAlertErrorCode.INVALID_THRESHOLD
        };
      }

      if (outOfStockThreshold < 0) {
        return {
          success: false,
          error: 'Out of stock threshold cannot be negative',
          errorCode: StockAlertErrorCode.INVALID_THRESHOLD
        };
      }

      const currentTime = getCurrentTimestamp();

      // Check if config already exists
      const [existingConfig] = await this.db
        .select()
        .from(stockAlertConfigs)
        .where(and(
          eq(stockAlertConfigs.tenantId, tenantId),
          eq(stockAlertConfigs.productId, productId),
          eq(stockAlertConfigs.locationId, locationId)
        ))
        .limit(1);

      let configId: string;

      if (existingConfig) {
        // Update existing config
        configId = existingConfig.id;
        await this.db
          .update(stockAlertConfigs)
          .set({
            lowStockThreshold,
            criticalStockThreshold,
            outOfStockThreshold,
            alertEnabled,
            emailNotifications,
            smsNotifications,
            updatedAt: currentTime
          })
          .where(eq(stockAlertConfigs.id, configId));
      } else {
        // Create new config
        configId = generateId();
        const newConfig: NewStockAlertConfig = {
          id: configId,
          tenantId,
          productId,
          locationId,
          lowStockThreshold,
          criticalStockThreshold,
          outOfStockThreshold,
          alertEnabled,
          emailNotifications,
          smsNotifications,
          createdBy,
          createdAt: currentTime,
          updatedAt: currentTime
        };

        await this.db
          .insert(stockAlertConfigs)
          .values(newConfig);
      }

      // Get the updated config with product and location names
      const [config] = await this.db
        .select({
          config: stockAlertConfigs,
          productName: products.name,
          locationName: locations.name
        })
        .from(stockAlertConfigs)
        .leftJoin(products, eq(products.id, stockAlertConfigs.productId))
        .leftJoin(locations, eq(locations.id, stockAlertConfigs.locationId))
        .where(eq(stockAlertConfigs.id, configId))
        .limit(1);

      if (!config) {
        return {
          success: false,
          error: 'Failed to retrieve created configuration',
          errorCode: StockAlertErrorCode.CONFIG_NOT_FOUND
        };
      }

      const configDetails: StockAlertConfigDetails = {
        ...config.config,
        productName: config.productName || undefined,
        locationName: config.locationName || undefined
      };

      return {
        success: true,
        config: configDetails
      };

    } catch (error) {
      console.error('Error creating/updating stock alert config:', error);
      return {
        success: false,
        error: 'Internal error creating/updating stock alert configuration',
        errorCode: StockAlertErrorCode.VALIDATION_ERROR
      };
    }
  }

  /**
   * Monitor stock levels and generate alerts
   * Requirements: 3.5
   */
  async monitorStockLevels(request: StockMonitoringRequest): Promise<StockMonitoringResult> {
    try {
      const { tenantId, locationId, productIds } = request;

      // Build query conditions
      const conditions = [eq(stockAlertConfigs.tenantId, tenantId)];
      
      if (locationId) {
        conditions.push(eq(stockAlertConfigs.locationId, locationId));
      }
      
      if (productIds && productIds.length > 0) {
        conditions.push(inArray(stockAlertConfigs.productId, productIds));
      }

      // Get all active alert configurations
      const configs = await this.db
        .select({
          config: stockAlertConfigs,
          productName: products.name,
          locationName: locations.name
        })
        .from(stockAlertConfigs)
        .leftJoin(products, eq(products.id, stockAlertConfigs.productId))
        .leftJoin(locations, eq(locations.id, stockAlertConfigs.locationId))
        .where(and(
          ...conditions,
          eq(stockAlertConfigs.alertEnabled, true)
        ));

      const alertsGenerated: StockAlertDetails[] = [];
      const alertsResolved: string[] = [];

      // Check each configuration
      for (const { config, productName, locationName } of configs) {
        try {
          // Get current inventory availability
          const availability = await this.inventoryService.checkInventoryAvailability(
            config.productId,
            config.locationId
          );

          const currentStock = availability.currentQuantity;
          const availableStock = availability.availableQuantity;

          // Determine alert type based on thresholds
          let alertType: StockAlertTypeValue | null = null;
          let severity: StockAlertSeverityValue;
          let threshold: number;

          if (currentStock <= config.outOfStockThreshold) {
            alertType = StockAlertType.OUT_OF_STOCK;
            severity = StockAlertSeverity.CRITICAL;
            threshold = config.outOfStockThreshold;
          } else if (currentStock <= config.criticalStockThreshold) {
            alertType = StockAlertType.CRITICAL_STOCK;
            severity = StockAlertSeverity.HIGH;
            threshold = config.criticalStockThreshold;
          } else if (currentStock <= config.lowStockThreshold) {
            alertType = StockAlertType.LOW_STOCK;
            severity = StockAlertSeverity.MEDIUM;
            threshold = config.lowStockThreshold;
          }

          // Check for existing unresolved alerts
          const existingAlerts = await this.db
            .select()
            .from(stockAlerts)
            .where(and(
              eq(stockAlerts.tenantId, tenantId),
              eq(stockAlerts.productId, config.productId),
              eq(stockAlerts.locationId, config.locationId),
              eq(stockAlerts.resolved, false)
            ));

          if (alertType) {
            // Check if we already have an alert of this type
            const existingAlert = existingAlerts.find(alert => alert.alertType === alertType);

            if (!existingAlert) {
              // Create new alert
              const alertId = generateId();
              const currentTime = getCurrentTimestamp();
              
              const message = this.generateAlertMessage(
                alertType,
                productName || config.productId,
                locationName || config.locationId,
                currentStock,
                threshold
              );

              const newAlert: NewStockAlert = {
                id: alertId,
                tenantId,
                productId: config.productId,
                locationId: config.locationId,
                alertType,
                currentStock,
                threshold,
                severity,
                message,
                acknowledged: false,
                resolved: false,
                createdAt: currentTime,
                updatedAt: currentTime
              };

              await this.db
                .insert(stockAlerts)
                .values(newAlert);

              const alertDetails: StockAlertDetails = {
                ...newAlert,
                productName,
                locationName
              };

              alertsGenerated.push(alertDetails);

              // Generate notifications if configured
              await this.generateNotifications(config, alertDetails);
            } else {
              // Update existing alert with current stock level
              await this.db
                .update(stockAlerts)
                .set({
                  currentStock,
                  updatedAt: getCurrentTimestamp()
                })
                .where(eq(stockAlerts.id, existingAlert.id));
            }
          } else {
            // Stock levels are above thresholds - resolve any existing alerts
            for (const existingAlert of existingAlerts) {
              await this.db
                .update(stockAlerts)
                .set({
                  resolved: true,
                  resolvedAt: getCurrentTimestamp(),
                  updatedAt: getCurrentTimestamp()
                })
                .where(eq(stockAlerts.id, existingAlert.id));

              alertsResolved.push(existingAlert.id);
            }
          }

        } catch (error) {
          console.error(`Error monitoring stock for product ${config.productId} at location ${config.locationId}:`, error);
          // Continue with other products
        }
      }

      return {
        success: true,
        alertsGenerated,
        alertsResolved
      };

    } catch (error) {
      console.error('Error monitoring stock levels:', error);
      return {
        success: false,
        error: 'Internal error monitoring stock levels',
        errorCode: StockAlertErrorCode.INVENTORY_ERROR
      };
    }
  }

  /**
   * Get stock alerts for a tenant
   * Requirements: 3.5
   */
  async getStockAlerts(
    tenantId: string,
    options: {
      locationId?: string;
      productId?: string;
      alertType?: StockAlertTypeValue;
      severity?: StockAlertSeverityValue;
      acknowledged?: boolean;
      resolved?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ alerts: StockAlertDetails[]; total: number }> {
    try {
      const {
        locationId,
        productId,
        alertType,
        severity,
        acknowledged,
        resolved,
        limit = 50,
        offset = 0
      } = options;

      // Build query conditions
      const conditions = [eq(stockAlerts.tenantId, tenantId)];
      
      if (locationId) {
        conditions.push(eq(stockAlerts.locationId, locationId));
      }
      
      if (productId) {
        conditions.push(eq(stockAlerts.productId, productId));
      }
      
      if (alertType) {
        conditions.push(eq(stockAlerts.alertType, alertType));
      }
      
      if (severity) {
        conditions.push(eq(stockAlerts.severity, severity));
      }
      
      if (acknowledged !== undefined) {
        conditions.push(eq(stockAlerts.acknowledged, acknowledged));
      }
      
      if (resolved !== undefined) {
        conditions.push(eq(stockAlerts.resolved, resolved));
      }

      // Get alerts with product and location names
      const alerts = await this.db
        .select({
          alert: stockAlerts,
          productName: products.name,
          locationName: locations.name,
          acknowledgedByName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`.as('acknowledgedByName')
        })
        .from(stockAlerts)
        .leftJoin(products, eq(products.id, stockAlerts.productId))
        .leftJoin(locations, eq(locations.id, stockAlerts.locationId))
        .leftJoin(users, eq(users.id, stockAlerts.acknowledgedBy))
        .where(and(...conditions))
        .orderBy(desc(stockAlerts.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const [{ count }] = await this.db
        .select({ count: sql<number>`count(*)`.as('count') })
        .from(stockAlerts)
        .where(and(...conditions));

      // Get notifications for each alert
      const alertIds = alerts.map(a => a.alert.id);
      const notifications = alertIds.length > 0 ? await this.db
        .select()
        .from(stockAlertNotifications)
        .where(inArray(stockAlertNotifications.alertId, alertIds))
        .orderBy(desc(stockAlertNotifications.createdAt)) : [];

      // Group notifications by alert ID
      const notificationsByAlert = new Map<string, StockAlertNotificationDetails[]>();
      for (const notification of notifications) {
        if (!notificationsByAlert.has(notification.alertId)) {
          notificationsByAlert.set(notification.alertId, []);
        }
        notificationsByAlert.get(notification.alertId)!.push(notification);
      }

      const alertDetails: StockAlertDetails[] = alerts.map(({ alert, productName, locationName }) => ({
        ...alert,
        productName: productName || undefined,
        locationName: locationName || undefined,
        notifications: notificationsByAlert.get(alert.id) || []
      }));

      return {
        alerts: alertDetails,
        total: count
      };

    } catch (error) {
      console.error('Error getting stock alerts:', error);
      return {
        alerts: [],
        total: 0
      };
    }
  }

  /**
   * Acknowledge a stock alert
   * Requirements: 3.5
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<{ success: boolean; error?: string }> {
    try {
      const currentTime = getCurrentTimestamp();

      const result = await this.db
        .update(stockAlerts)
        .set({
          acknowledged: true,
          acknowledgedBy,
          acknowledgedAt: currentTime,
          updatedAt: currentTime
        })
        .where(and(
          eq(stockAlerts.id, alertId),
          eq(stockAlerts.acknowledged, false)
        ));

      return { success: true };

    } catch (error) {
      console.error('Error acknowledging alert:', error);
      return {
        success: false,
        error: 'Failed to acknowledge alert'
      };
    }
  }

  /**
   * Get stock level information for products
   * Requirements: 3.5
   */
  async getStockLevelInfo(
    tenantId: string,
    locationId: string,
    productIds?: string[]
  ): Promise<StockLevelInfo[]> {
    try {
      // Build query conditions
      const conditions = [
        eq(stockAlertConfigs.tenantId, tenantId),
        eq(stockAlertConfigs.locationId, locationId)
      ];
      
      if (productIds && productIds.length > 0) {
        conditions.push(inArray(stockAlertConfigs.productId, productIds));
      }

      // Get configurations
      const configs = await this.db
        .select({
          config: stockAlertConfigs,
          productName: products.name,
          locationName: locations.name
        })
        .from(stockAlertConfigs)
        .leftJoin(products, eq(products.id, stockAlertConfigs.productId))
        .leftJoin(locations, eq(locations.id, stockAlertConfigs.locationId))
        .where(and(...conditions));

      const stockInfo: StockLevelInfo[] = [];

      for (const { config, productName, locationName } of configs) {
        try {
          // Get current inventory availability
          const availability = await this.inventoryService.checkInventoryAvailability(
            config.productId,
            config.locationId
          );

          // Get active alerts for this product/location
          const activeAlerts = await this.db
            .select({
              alert: stockAlerts,
              productName: products.name,
              locationName: locations.name
            })
            .from(stockAlerts)
            .leftJoin(products, eq(products.id, stockAlerts.productId))
            .leftJoin(locations, eq(locations.id, stockAlerts.locationId))
            .where(and(
              eq(stockAlerts.tenantId, tenantId),
              eq(stockAlerts.productId, config.productId),
              eq(stockAlerts.locationId, config.locationId),
              eq(stockAlerts.resolved, false)
            ))
            .orderBy(desc(stockAlerts.createdAt));

          const alertDetails: StockAlertDetails[] = activeAlerts.map(({ alert, productName, locationName }) => ({
            ...alert,
            productName: productName || undefined,
            locationName: locationName || undefined
          }));

          const configDetails: StockAlertConfigDetails = {
            ...config,
            productName,
            locationName
          };

          stockInfo.push({
            productId: config.productId,
            locationId: config.locationId,
            currentStock: availability.currentQuantity,
            availableStock: availability.availableQuantity,
            reservedStock: availability.reservedQuantity,
            inTransitStock: availability.inTransitQuantity,
            config: configDetails,
            activeAlerts: alertDetails
          });

        } catch (error) {
          console.error(`Error getting stock info for product ${config.productId}:`, error);
          // Continue with other products
        }
      }

      return stockInfo;

    } catch (error) {
      console.error('Error getting stock level info:', error);
      return [];
    }
  }

  /**
   * Delete stock alert configuration
   * Requirements: 3.5
   */
  async deleteAlertConfig(tenantId: string, productId: string, locationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // First resolve any active alerts
      await this.db
        .update(stockAlerts)
        .set({
          resolved: true,
          resolvedAt: getCurrentTimestamp(),
          updatedAt: getCurrentTimestamp()
        })
        .where(and(
          eq(stockAlerts.tenantId, tenantId),
          eq(stockAlerts.productId, productId),
          eq(stockAlerts.locationId, locationId),
          eq(stockAlerts.resolved, false)
        ));

      // Delete the configuration
      await this.db
        .delete(stockAlertConfigs)
        .where(and(
          eq(stockAlertConfigs.tenantId, tenantId),
          eq(stockAlertConfigs.productId, productId),
          eq(stockAlertConfigs.locationId, locationId)
        ));

      return { success: true };

    } catch (error) {
      console.error('Error deleting alert config:', error);
      return {
        success: false,
        error: 'Failed to delete alert configuration'
      };
    }
  }

  // Private helper methods

  private generateAlertMessage(
    alertType: StockAlertTypeValue,
    productName: string,
    locationName: string,
    currentStock: number,
    threshold: number
  ): string {
    switch (alertType) {
      case StockAlertType.OUT_OF_STOCK:
        return `OUT OF STOCK: ${productName} at ${locationName} is out of stock (${currentStock} units remaining, threshold: ${threshold})`;
      case StockAlertType.CRITICAL_STOCK:
        return `CRITICAL STOCK: ${productName} at ${locationName} is critically low (${currentStock} units remaining, threshold: ${threshold})`;
      case StockAlertType.LOW_STOCK:
        return `LOW STOCK: ${productName} at ${locationName} is running low (${currentStock} units remaining, threshold: ${threshold})`;
      default:
        return `STOCK ALERT: ${productName} at ${locationName} requires attention (${currentStock} units remaining)`;
    }
  }

  private async generateNotifications(config: StockAlertConfig, alert: StockAlertDetails): Promise<void> {
    try {
      const notifications: NewStockAlertNotification[] = [];
      const currentTime = getCurrentTimestamp();

      // Generate email notification if enabled
      if (config.emailNotifications) {
        // In a real implementation, you would get the email addresses from user preferences
        // For now, we'll use a placeholder
        notifications.push({
          id: generateId(),
          tenantId: config.tenantId,
          alertId: alert.id,
          notificationType: NotificationType.EMAIL,
          recipient: 'manager@restaurant.com', // Placeholder
          status: NotificationStatus.PENDING,
          retryCount: 0,
          createdAt: currentTime
        });
      }

      // Generate SMS notification if enabled
      if (config.smsNotifications) {
        // In a real implementation, you would get the phone numbers from user preferences
        notifications.push({
          id: generateId(),
          tenantId: config.tenantId,
          alertId: alert.id,
          notificationType: NotificationType.SMS,
          recipient: '+1234567890', // Placeholder
          status: NotificationStatus.PENDING,
          retryCount: 0,
          createdAt: currentTime
        });
      }

      if (notifications.length > 0) {
        await this.db
          .insert(stockAlertNotifications)
          .values(notifications);
      }

    } catch (error) {
      console.error('Error generating notifications:', error);
    }
  }
}

// Factory function for creating stock alert service
export function createStockAlertService(db: DrizzleD1Database): StockAlertService {
  return new StockAlertService(db);
}