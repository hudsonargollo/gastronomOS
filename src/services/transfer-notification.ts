import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, inArray } from 'drizzle-orm';
import { 
  transfers,
  locations,
  users,
  products,
  Transfer,
  Location,
  User,
  Product,
  TransferStatusType,
  TransferPriorityType,
  UserRoleType
} from '../db';
import { generateId } from '../utils';

// Notification interfaces as defined in the design document
export interface NotificationEvent {
  id: string;
  type: NotificationEventType;
  transferId: string;
  tenantId: string;
  priority: NotificationPriorityType;
  title: string;
  message: string;
  data: Record<string, any>;
  recipients: NotificationRecipient[];
  createdAt: Date;
  scheduledFor?: Date;
  sentAt?: Date;
  status: NotificationStatusType;
  retryCount: number;
  errorMessage?: string;
}

export interface NotificationRecipient {
  userId: string;
  locationId?: string;
  role?: UserRoleType;
  methods: NotificationMethodType[];
  delivered: boolean;
  deliveredAt?: Date;
  readAt?: Date;
}

export interface NotificationTemplate {
  type: NotificationEventType;
  priority: NotificationPriorityType;
  title: string;
  messageTemplate: string;
  methods: NotificationMethodType[];
  roleTargets: UserRoleType[];
  locationScope: 'SOURCE' | 'DESTINATION' | 'BOTH' | 'ALL';
}

export interface NotificationPreferences {
  userId: string;
  locationId?: string;
  enableTransferNotifications: boolean;
  enableEmergencyNotifications: boolean;
  enableVarianceAlerts: boolean;
  enableStatusUpdates: boolean;
  methods: NotificationMethodType[];
  quietHours?: {
    start: string; // HH:MM format
    end: string;   // HH:MM format
    timezone: string;
  };
}

// Enums for notification system
export const NotificationEventType = {
  TRANSFER_REQUESTED: 'TRANSFER_REQUESTED',
  TRANSFER_APPROVED: 'TRANSFER_APPROVED',
  TRANSFER_REJECTED: 'TRANSFER_REJECTED',
  TRANSFER_SHIPPED: 'TRANSFER_SHIPPED',
  TRANSFER_RECEIVED: 'TRANSFER_RECEIVED',
  TRANSFER_CANCELLED: 'TRANSFER_CANCELLED',
  VARIANCE_DETECTED: 'VARIANCE_DETECTED',
  EMERGENCY_TRANSFER: 'EMERGENCY_TRANSFER',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  SHIPMENT_OVERDUE: 'SHIPMENT_OVERDUE',
} as const;

export type NotificationEventType = typeof NotificationEventType[keyof typeof NotificationEventType];

export const NotificationMethodType = {
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  IN_APP: 'IN_APP',
  PUSH: 'PUSH',
} as const;

export type NotificationMethodType = typeof NotificationMethodType[keyof typeof NotificationMethodType];

export const NotificationPriorityType = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export type NotificationPriorityType = typeof NotificationPriorityType[keyof typeof NotificationPriorityType];

export const NotificationStatusType = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type NotificationStatusType = typeof NotificationStatusType[keyof typeof NotificationStatusType];

// Transfer notification service interface
export interface TransferNotificationService {
  // Core notification methods
  notifyTransferRequested(transfer: Transfer): Promise<void>;
  notifyTransferApproved(transfer: Transfer, approvedBy: string, notes?: string): Promise<void>;
  notifyTransferRejected(transfer: Transfer, rejectedBy: string, reason: string): Promise<void>;
  notifyTransferShipped(transfer: Transfer, shippedBy: string, notes?: string): Promise<void>;
  notifyTransferReceived(transfer: Transfer, receivedBy: string, variance?: number): Promise<void>;
  notifyTransferCancelled(transfer: Transfer, cancelledBy: string, reason: string): Promise<void>;
  notifyVarianceDetected(transfer: Transfer, variance: number, variancePercentage: number): Promise<void>;
  notifyEmergencyTransfer(transfer: Transfer): Promise<void>;
  
  // Notification management
  sendNotification(event: NotificationEvent): Promise<void>;
  getNotificationHistory(transferId: string): Promise<NotificationEvent[]>;
  getUserNotifications(userId: string, unreadOnly?: boolean): Promise<NotificationEvent[]>;
  markNotificationAsRead(notificationId: string, userId: string): Promise<void>;
  
  // Preferences management
  getUserPreferences(userId: string): Promise<NotificationPreferences | null>;
  updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences>;
  
  // Template management
  getNotificationTemplates(): Promise<NotificationTemplate[]>;
  updateNotificationTemplate(type: NotificationEventType, template: Partial<NotificationTemplate>): Promise<NotificationTemplate>;
}

/**
 * Transfer Notification Service Implementation
 * 
 * Handles all transfer-related notifications including:
 * - Status change notifications
 * - Role-based notification routing
 * - Emergency transfer alerts
 * - Variance notifications
 * - Template-based message formatting
 * 
 * Requirements: 2.2, 2.5, 7.4, 10.3
 */
export class TransferNotificationServiceImpl implements TransferNotificationService {
  // In-memory storage for notifications and preferences (would be database tables in production)
  private notifications = new Map<string, NotificationEvent>();
  private userPreferences = new Map<string, NotificationPreferences>();
  private templates = new Map<NotificationEventType, NotificationTemplate>();

  constructor(private db: DrizzleD1Database) {
    this.initializeDefaultTemplates();
  }

  /**
   * Notify when a transfer is requested
   * Requirements: 2.2
   */
  async notifyTransferRequested(transfer: Transfer): Promise<void> {
    const template = this.templates.get(NotificationEventType.TRANSFER_REQUESTED);
    if (!template) return;

    // Get transfer details for notification
    const transferDetails = await this.getTransferDetails(transfer);
    if (!transferDetails) return;

    // Determine recipients - source location managers for approval
    const recipients = await this.getLocationManagers(transfer.sourceLocationId, transfer.tenantId);

    const notification: NotificationEvent = {
      id: `notification_${generateId()}`,
      type: NotificationEventType.TRANSFER_REQUESTED,
      transferId: transfer.id,
      tenantId: transfer.tenantId,
      priority: this.mapTransferPriorityToNotificationPriority(transfer.priority as TransferPriorityType),
      title: template.title,
      message: this.formatMessage(template.messageTemplate, {
        productName: transferDetails.product.name,
        quantity: transfer.quantityRequested,
        sourceLocation: transferDetails.sourceLocation.name,
        destinationLocation: transferDetails.destinationLocation.name,
        requesterName: transferDetails.requester.email,
        priority: transfer.priority
      }),
      data: {
        transferId: transfer.id,
        productId: transfer.productId,
        sourceLocationId: transfer.sourceLocationId,
        destinationLocationId: transfer.destinationLocationId,
        quantityRequested: transfer.quantityRequested,
        priority: transfer.priority,
        requestedBy: transfer.requestedBy
      },
      recipients: recipients.map(user => ({
        userId: user.id,
        locationId: user.locationId || undefined,
        role: user.role as UserRoleType,
        methods: template.methods,
        delivered: false
      })),
      createdAt: new Date(),
      status: NotificationStatusType.PENDING,
      retryCount: 0
    };

    await this.sendNotification(notification);
  }

  /**
   * Notify when a transfer is approved
   * Requirements: 2.5
   */
  async notifyTransferApproved(transfer: Transfer, approvedBy: string, notes?: string): Promise<void> {
    const template = this.templates.get(NotificationEventType.TRANSFER_APPROVED);
    if (!template) return;

    const transferDetails = await this.getTransferDetails(transfer);
    if (!transferDetails) return;

    // Notify requester and destination location
    const recipients = await this.getNotificationRecipients(transfer, ['REQUESTER', 'DESTINATION_MANAGERS']);

    const notification: NotificationEvent = {
      id: `notification_${generateId()}`,
      type: NotificationEventType.TRANSFER_APPROVED,
      transferId: transfer.id,
      tenantId: transfer.tenantId,
      priority: this.mapTransferPriorityToNotificationPriority(transfer.priority as TransferPriorityType),
      title: template.title,
      message: this.formatMessage(template.messageTemplate, {
        productName: transferDetails.product.name,
        quantity: transfer.quantityRequested,
        sourceLocation: transferDetails.sourceLocation.name,
        destinationLocation: transferDetails.destinationLocation.name,
        approverName: transferDetails.approver?.email || 'Unknown',
        notes: notes || 'No additional notes'
      }),
      data: {
        transferId: transfer.id,
        approvedBy,
        approvedAt: transfer.approvedAt,
        notes
      },
      recipients,
      createdAt: new Date(),
      status: NotificationStatusType.PENDING,
      retryCount: 0
    };

    await this.sendNotification(notification);
  }

  /**
   * Notify when a transfer is rejected
   * Requirements: 2.5
   */
  async notifyTransferRejected(transfer: Transfer, rejectedBy: string, reason: string): Promise<void> {
    const template = this.templates.get(NotificationEventType.TRANSFER_REJECTED);
    if (!template) return;

    const transferDetails = await this.getTransferDetails(transfer);
    if (!transferDetails) return;

    // Notify requester and destination location
    const recipients = await this.getNotificationRecipients(transfer, ['REQUESTER', 'DESTINATION_MANAGERS']);

    const notification: NotificationEvent = {
      id: `notification_${generateId()}`,
      type: NotificationEventType.TRANSFER_REJECTED,
      transferId: transfer.id,
      tenantId: transfer.tenantId,
      priority: NotificationPriorityType.HIGH,
      title: template.title,
      message: this.formatMessage(template.messageTemplate, {
        productName: transferDetails.product.name,
        quantity: transfer.quantityRequested,
        sourceLocation: transferDetails.sourceLocation.name,
        destinationLocation: transferDetails.destinationLocation.name,
        rejectorName: transferDetails.approver?.email || 'Unknown',
        reason
      }),
      data: {
        transferId: transfer.id,
        rejectedBy,
        reason,
        cancelledAt: transfer.cancelledAt
      },
      recipients,
      createdAt: new Date(),
      status: NotificationStatusType.PENDING,
      retryCount: 0
    };

    await this.sendNotification(notification);
  }

  /**
   * Notify when a transfer is shipped
   * Requirements: 4.2
   */
  async notifyTransferShipped(transfer: Transfer, shippedBy: string, notes?: string): Promise<void> {
    const template = this.templates.get(NotificationEventType.TRANSFER_SHIPPED);
    if (!template) return;

    const transferDetails = await this.getTransferDetails(transfer);
    if (!transferDetails) return;

    // Notify requester and destination location
    const recipients = await this.getNotificationRecipients(transfer, ['REQUESTER', 'DESTINATION_MANAGERS']);

    const notification: NotificationEvent = {
      id: `notification_${generateId()}`,
      type: NotificationEventType.TRANSFER_SHIPPED,
      transferId: transfer.id,
      tenantId: transfer.tenantId,
      priority: this.mapTransferPriorityToNotificationPriority(transfer.priority as TransferPriorityType),
      title: template.title,
      message: this.formatMessage(template.messageTemplate, {
        productName: transferDetails.product.name,
        quantity: transfer.quantityShipped || transfer.quantityRequested,
        sourceLocation: transferDetails.sourceLocation.name,
        destinationLocation: transferDetails.destinationLocation.name,
        shipperName: transferDetails.shipper?.email || 'Unknown',
        shippedAt: new Date(transfer.shippedAt || Date.now()).toLocaleString(),
        notes: notes || 'No additional notes'
      }),
      data: {
        transferId: transfer.id,
        shippedBy,
        shippedAt: transfer.shippedAt,
        quantityShipped: transfer.quantityShipped,
        notes
      },
      recipients,
      createdAt: new Date(),
      status: NotificationStatusType.PENDING,
      retryCount: 0
    };

    await this.sendNotification(notification);
  }

  /**
   * Notify when a transfer is received
   * Requirements: 5.1, 5.2
   */
  async notifyTransferReceived(transfer: Transfer, receivedBy: string, variance?: number): Promise<void> {
    const template = this.templates.get(NotificationEventType.TRANSFER_RECEIVED);
    if (!template) return;

    const transferDetails = await this.getTransferDetails(transfer);
    if (!transferDetails) return;

    // Notify requester and source location
    const recipients = await this.getNotificationRecipients(transfer, ['REQUESTER', 'SOURCE_MANAGERS']);

    const varianceText = variance && variance > 0 
      ? ` (${variance} units variance detected)`
      : '';

    const notification: NotificationEvent = {
      id: `notification_${generateId()}`,
      type: NotificationEventType.TRANSFER_RECEIVED,
      transferId: transfer.id,
      tenantId: transfer.tenantId,
      priority: variance && variance > 0 ? NotificationPriorityType.HIGH : NotificationPriorityType.NORMAL,
      title: template.title,
      message: this.formatMessage(template.messageTemplate, {
        productName: transferDetails.product.name,
        quantityReceived: transfer.quantityReceived || 0,
        sourceLocation: transferDetails.sourceLocation.name,
        destinationLocation: transferDetails.destinationLocation.name,
        receiverName: transferDetails.receiver?.email || 'Unknown',
        receivedAt: new Date(transfer.receivedAt || Date.now()).toLocaleString(),
        varianceText
      }),
      data: {
        transferId: transfer.id,
        receivedBy,
        receivedAt: transfer.receivedAt,
        quantityReceived: transfer.quantityReceived,
        variance,
        varianceReason: transfer.varianceReason
      },
      recipients,
      createdAt: new Date(),
      status: NotificationStatusType.PENDING,
      retryCount: 0
    };

    await this.sendNotification(notification);

    // Send separate variance notification if needed
    if (variance && variance > 0) {
      await this.notifyVarianceDetected(transfer, variance, (variance / (transfer.quantityShipped || 1)) * 100);
    }
  }

  /**
   * Notify when a transfer is cancelled
   * Requirements: 7.4, 7.5
   */
  async notifyTransferCancelled(transfer: Transfer, cancelledBy: string, reason: string): Promise<void> {
    const template = this.templates.get(NotificationEventType.TRANSFER_CANCELLED);
    if (!template) return;

    const transferDetails = await this.getTransferDetails(transfer);
    if (!transferDetails) return;

    // Notify all relevant parties
    const recipients = await this.getNotificationRecipients(transfer, ['REQUESTER', 'SOURCE_MANAGERS', 'DESTINATION_MANAGERS']);

    const notification: NotificationEvent = {
      id: `notification_${generateId()}`,
      type: NotificationEventType.TRANSFER_CANCELLED,
      transferId: transfer.id,
      tenantId: transfer.tenantId,
      priority: NotificationPriorityType.HIGH,
      title: template.title,
      message: this.formatMessage(template.messageTemplate, {
        productName: transferDetails.product.name,
        quantity: transfer.quantityRequested,
        sourceLocation: transferDetails.sourceLocation.name,
        destinationLocation: transferDetails.destinationLocation.name,
        cancellerName: transferDetails.canceller?.email || 'Unknown',
        reason
      }),
      data: {
        transferId: transfer.id,
        cancelledBy,
        cancelledAt: transfer.cancelledAt,
        reason,
        originalStatus: transfer.status
      },
      recipients,
      createdAt: new Date(),
      status: NotificationStatusType.PENDING,
      retryCount: 0
    };

    await this.sendNotification(notification);
  }

  /**
   * Notify when variance is detected
   * Requirements: 5.3, 5.4
   */
  async notifyVarianceDetected(transfer: Transfer, variance: number, variancePercentage: number): Promise<void> {
    const template = this.templates.get(NotificationEventType.VARIANCE_DETECTED);
    if (!template) return;

    const transferDetails = await this.getTransferDetails(transfer);
    if (!transferDetails) return;

    // Notify source location managers and operations team
    const recipients = await this.getNotificationRecipients(transfer, ['SOURCE_MANAGERS', 'OPERATIONS_TEAM']);

    const notification: NotificationEvent = {
      id: `notification_${generateId()}`,
      type: NotificationEventType.VARIANCE_DETECTED,
      transferId: transfer.id,
      tenantId: transfer.tenantId,
      priority: variancePercentage > 10 ? NotificationPriorityType.URGENT : NotificationPriorityType.HIGH,
      title: template.title,
      message: this.formatMessage(template.messageTemplate, {
        productName: transferDetails.product.name,
        quantityShipped: transfer.quantityShipped || 0,
        quantityReceived: transfer.quantityReceived || 0,
        variance,
        variancePercentage: variancePercentage.toFixed(2),
        sourceLocation: transferDetails.sourceLocation.name,
        destinationLocation: transferDetails.destinationLocation.name,
        varianceReason: transfer.varianceReason || 'No reason provided'
      }),
      data: {
        transferId: transfer.id,
        variance,
        variancePercentage,
        varianceReason: transfer.varianceReason,
        quantityShipped: transfer.quantityShipped,
        quantityReceived: transfer.quantityReceived
      },
      recipients,
      createdAt: new Date(),
      status: NotificationStatusType.PENDING,
      retryCount: 0
    };

    await this.sendNotification(notification);
  }

  /**
   * Notify for emergency transfers with immediate priority
   * Requirements: 10.3
   */
  async notifyEmergencyTransfer(transfer: Transfer): Promise<void> {
    const template = this.templates.get(NotificationEventType.EMERGENCY_TRANSFER);
    if (!template) return;

    const transferDetails = await this.getTransferDetails(transfer);
    if (!transferDetails) return;

    // Notify all managers and operations team immediately with urgent priority
    const recipients = await this.getNotificationRecipients(transfer, ['ALL_MANAGERS', 'OPERATIONS_TEAM']);

    const notification: NotificationEvent = {
      id: `notification_${generateId()}`,
      type: NotificationEventType.EMERGENCY_TRANSFER,
      transferId: transfer.id,
      tenantId: transfer.tenantId,
      priority: NotificationPriorityType.URGENT,
      title: template.title,
      message: this.formatMessage(template.messageTemplate, {
        productName: transferDetails.product.name,
        quantity: transfer.quantityRequested,
        sourceLocation: transferDetails.sourceLocation.name,
        destinationLocation: transferDetails.destinationLocation.name,
        requesterName: transferDetails.requester.email,
        reason: transfer.notes || 'Emergency transfer requested'
      }),
      data: {
        transferId: transfer.id,
        priority: transfer.priority,
        reason: transfer.notes,
        requestedBy: transfer.requestedBy,
        emergencyProcessing: true,
        immediateNotification: true
      },
      recipients: recipients.map(recipient => ({
        ...recipient,
        // Use all available notification methods for emergency transfers
        methods: [NotificationMethodType.EMAIL, NotificationMethodType.IN_APP, NotificationMethodType.SMS, NotificationMethodType.PUSH]
      })),
      createdAt: new Date(),
      status: NotificationStatusType.PENDING,
      retryCount: 0
    };

    // Send notification with immediate priority
    await this.sendNotification(notification);

    // Log emergency notification for audit purposes
    console.log(`Emergency transfer notification sent for ${transfer.id} to ${recipients.length} recipients with immediate priority`);
  }

  /**
   * Send notification through configured channels
   * Requirements: 2.2, 2.5, 7.4
   */
  async sendNotification(event: NotificationEvent): Promise<void> {
    try {
      // Store notification
      this.notifications.set(event.id, event);

      // Filter recipients based on their preferences
      const filteredRecipients = await this.filterRecipientsByPreferences(event.recipients, event.type);

      // Send through each configured method
      for (const recipient of filteredRecipients) {
        for (const method of recipient.methods) {
          try {
            await this.deliverNotification(event, recipient, method);
            recipient.delivered = true;
            recipient.deliveredAt = new Date();
          } catch (error) {
            console.error(`Failed to deliver notification ${event.id} to ${recipient.userId} via ${method}:`, error);
          }
        }
      }

      // Update notification status
      const allDelivered = filteredRecipients.every(r => r.delivered);
      event.status = allDelivered ? NotificationStatusType.DELIVERED : NotificationStatusType.SENT;
      event.sentAt = new Date();

      console.log(`Notification sent: ${event.type} for transfer ${event.transferId} to ${filteredRecipients.length} recipients`);

    } catch (error) {
      console.error(`Failed to send notification ${event.id}:`, error);
      event.status = NotificationStatusType.FAILED;
      event.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      event.retryCount++;
    }
  }

  /**
   * Get notification history for a transfer
   */
  async getNotificationHistory(transferId: string): Promise<NotificationEvent[]> {
    return Array.from(this.notifications.values())
      .filter(n => n.transferId === transferId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(userId: string, unreadOnly = false): Promise<NotificationEvent[]> {
    return Array.from(this.notifications.values())
      .filter(n => n.recipients.some(r => r.userId === userId && (!unreadOnly || !r.readAt)))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      const recipient = notification.recipients.find(r => r.userId === userId);
      if (recipient) {
        recipient.readAt = new Date();
      }
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    return this.userPreferences.get(userId) || null;
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const existing = this.userPreferences.get(userId) || {
      userId,
      enableTransferNotifications: true,
      enableEmergencyNotifications: true,
      enableVarianceAlerts: true,
      enableStatusUpdates: true,
      methods: [NotificationMethodType.EMAIL, NotificationMethodType.IN_APP]
    };

    const updated: NotificationPreferences = {
      ...existing,
      ...preferences,
      userId // Ensure userId is not overwritten
    };

    this.userPreferences.set(userId, updated);
    return updated;
  }

  /**
   * Get notification templates
   */
  async getNotificationTemplates(): Promise<NotificationTemplate[]> {
    return Array.from(this.templates.values());
  }

  /**
   * Update notification template
   */
  async updateNotificationTemplate(type: NotificationEventType, template: Partial<NotificationTemplate>): Promise<NotificationTemplate> {
    const existing = this.templates.get(type);
    if (!existing) {
      throw new Error(`Template not found for type: ${type}`);
    }

    const updated: NotificationTemplate = {
      ...existing,
      ...template,
      type // Ensure type is not overwritten
    };

    this.templates.set(type, updated);
    return updated;
  }

  // Private helper methods

  private async getTransferDetails(transfer: Transfer) {
    try {
      const [product, sourceLocation, destinationLocation, requester, approver, shipper, receiver, canceller] = await Promise.all([
        this.getProduct(transfer.productId, transfer.tenantId),
        this.getLocation(transfer.sourceLocationId, transfer.tenantId),
        this.getLocation(transfer.destinationLocationId, transfer.tenantId),
        this.getUser(transfer.requestedBy, transfer.tenantId),
        transfer.approvedBy ? this.getUser(transfer.approvedBy, transfer.tenantId) : null,
        transfer.shippedBy ? this.getUser(transfer.shippedBy, transfer.tenantId) : null,
        transfer.receivedBy ? this.getUser(transfer.receivedBy, transfer.tenantId) : null,
        transfer.cancelledBy ? this.getUser(transfer.cancelledBy, transfer.tenantId) : null,
      ]);

      if (!product || !sourceLocation || !destinationLocation || !requester) {
        return null;
      }

      return {
        product,
        sourceLocation,
        destinationLocation,
        requester,
        approver,
        shipper,
        receiver,
        canceller
      };
    } catch (error) {
      console.error('Error getting transfer details:', error);
      return null;
    }
  }

  private async getProduct(productId: string, tenantId: string) {
    const [product] = await this.db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
      .limit(1);
    return product;
  }

  private async getLocation(locationId: string, tenantId: string) {
    const [location] = await this.db
      .select()
      .from(locations)
      .where(and(eq(locations.id, locationId), eq(locations.tenantId, tenantId)))
      .limit(1);
    return location;
  }

  private async getUser(userId: string, tenantId: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
      .limit(1);
    return user;
  }

  private async getLocationManagers(locationId: string, tenantId: string): Promise<User[]> {
    const managers = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.tenantId, tenantId),
        eq(users.locationId, locationId),
        inArray(users.role, ['ADMIN', 'MANAGER'])
      ));
    
    return managers || [];
  }

  private async getNotificationRecipients(transfer: Transfer, recipientTypes: string[]): Promise<NotificationRecipient[]> {
    const recipients: NotificationRecipient[] = [];

    for (const type of recipientTypes) {
      switch (type) {
        case 'REQUESTER':
          if (transfer.requestedBy) {
            const user = await this.getUser(transfer.requestedBy, transfer.tenantId);
            if (user) {
              recipients.push({
                userId: user.id,
                locationId: user.locationId || undefined,
                role: user.role as UserRoleType,
                methods: [NotificationMethodType.EMAIL, NotificationMethodType.IN_APP],
                delivered: false
              });
            }
          }
          break;

        case 'SOURCE_MANAGERS':
          const sourceManagers = await this.getLocationManagers(transfer.sourceLocationId, transfer.tenantId);
          recipients.push(...sourceManagers.map(user => ({
            userId: user.id,
            locationId: user.locationId || undefined,
            role: user.role as UserRoleType,
            methods: [NotificationMethodType.EMAIL, NotificationMethodType.IN_APP],
            delivered: false
          })));
          break;

        case 'DESTINATION_MANAGERS':
          const destManagers = await this.getLocationManagers(transfer.destinationLocationId, transfer.tenantId);
          recipients.push(...destManagers.map(user => ({
            userId: user.id,
            locationId: user.locationId || undefined,
            role: user.role as UserRoleType,
            methods: [NotificationMethodType.EMAIL, NotificationMethodType.IN_APP],
            delivered: false
          })));
          break;

        case 'ALL_MANAGERS':
          const allManagers = await this.db
            .select()
            .from(users)
            .where(and(
              eq(users.tenantId, transfer.tenantId),
              inArray(users.role, ['ADMIN', 'MANAGER'])
            ));
          recipients.push(...(allManagers || []).map(user => ({
            userId: user.id,
            locationId: user.locationId || undefined,
            role: user.role as UserRoleType,
            methods: [NotificationMethodType.EMAIL, NotificationMethodType.IN_APP, NotificationMethodType.SMS],
            delivered: false
          })));
          break;

        case 'OPERATIONS_TEAM':
          const opsTeam = await this.db
            .select()
            .from(users)
            .where(and(
              eq(users.tenantId, transfer.tenantId),
              eq(users.role, 'ADMIN')
            ));
          recipients.push(...(opsTeam || []).map(user => ({
            userId: user.id,
            locationId: user.locationId || undefined,
            role: user.role as UserRoleType,
            methods: [NotificationMethodType.EMAIL, NotificationMethodType.IN_APP, NotificationMethodType.SMS],
            delivered: false
          })));
          break;
      }
    }

    // Remove duplicates
    const uniqueRecipients = recipients.filter((recipient, index, self) =>
      index === self.findIndex(r => r.userId === recipient.userId)
    );

    return uniqueRecipients;
  }

  private async filterRecipientsByPreferences(recipients: NotificationRecipient[], eventType: NotificationEventType): Promise<NotificationRecipient[]> {
    const filtered: NotificationRecipient[] = [];

    for (const recipient of recipients) {
      const preferences = await this.getUserPreferences(recipient.userId);
      
      if (!preferences) {
        // Use default preferences if none set
        filtered.push(recipient);
        continue;
      }

      // Check if user wants this type of notification
      let shouldNotify = false;
      switch (eventType) {
        case NotificationEventType.EMERGENCY_TRANSFER:
          shouldNotify = preferences.enableEmergencyNotifications;
          break;
        case NotificationEventType.VARIANCE_DETECTED:
          shouldNotify = preferences.enableVarianceAlerts;
          break;
        case NotificationEventType.TRANSFER_REQUESTED:
        case NotificationEventType.TRANSFER_APPROVED:
        case NotificationEventType.TRANSFER_REJECTED:
        case NotificationEventType.TRANSFER_SHIPPED:
        case NotificationEventType.TRANSFER_RECEIVED:
        case NotificationEventType.TRANSFER_CANCELLED:
          shouldNotify = preferences.enableStatusUpdates;
          break;
        default:
          shouldNotify = preferences.enableTransferNotifications;
      }

      if (shouldNotify) {
        // Use user's preferred methods
        recipient.methods = preferences.methods;
        filtered.push(recipient);
      }
    }

    return filtered;
  }

  private async deliverNotification(event: NotificationEvent, recipient: NotificationRecipient, method: NotificationMethodType): Promise<void> {
    // Check if this is an emergency notification requiring immediate delivery
    const isEmergency = event.priority === NotificationPriorityType.URGENT && 
                       event.data?.emergencyProcessing === true;

    // This is where actual notification delivery would happen
    // For now, we'll just log the notification with appropriate priority
    const logLevel = isEmergency ? 'warn' : 'log';
    const urgencyPrefix = isEmergency ? '[EMERGENCY] ' : '';
    
    console[logLevel](`${urgencyPrefix}Delivering notification via ${method} to user ${recipient.userId}:`, {
      type: event.type,
      title: event.title,
      message: event.message,
      priority: event.priority,
      transferId: event.transferId,
      emergency: isEmergency,
      immediateDelivery: event.data?.immediateNotification === true
    });

    // In a real implementation, this would:
    // - Send emails via email service (SendGrid, AWS SES, etc.)
    // - Send SMS via SMS service (Twilio, AWS SNS, etc.)
    // - Send push notifications via push service (Firebase, AWS SNS, etc.)
    // - Store in-app notifications in database
    
    // For emergency notifications, additional immediate delivery channels would be used:
    if (isEmergency) {
      // - Priority SMS with immediate delivery
      // - Push notifications with high priority and sound
      // - Phone calls for critical emergencies
      // - Slack/Teams notifications to emergency channels
      // - Email with high priority flags
      
      console.warn(`Emergency notification delivery initiated for ${event.transferId} via ${method}`);
    }
    
    // Simulate delivery delay (shorter for emergency notifications)
    const deliveryDelay = isEmergency ? 50 : 100;
    await new Promise(resolve => setTimeout(resolve, deliveryDelay));
  }

  private formatMessage(template: string, variables: Record<string, any>): string {
    let message = template;
    for (const [key, value] of Object.entries(variables)) {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return message;
  }

  private mapTransferPriorityToNotificationPriority(transferPriority: TransferPriorityType): NotificationPriorityType {
    switch (transferPriority) {
      case 'EMERGENCY':
        return NotificationPriorityType.URGENT;
      case 'HIGH':
        return NotificationPriorityType.HIGH;
      case 'NORMAL':
      default:
        return NotificationPriorityType.NORMAL;
    }
  }

  private initializeDefaultTemplates(): void {
    // Initialize default notification templates
    this.templates.set(NotificationEventType.TRANSFER_REQUESTED, {
      type: NotificationEventType.TRANSFER_REQUESTED,
      priority: NotificationPriorityType.NORMAL,
      title: 'Transfer Request Requires Approval',
      messageTemplate: 'A transfer request for {{quantity}} units of {{productName}} from {{sourceLocation}} to {{destinationLocation}} requires your approval. Requested by {{requesterName}}.',
      methods: [NotificationMethodType.EMAIL, NotificationMethodType.IN_APP],
      roleTargets: ['ADMIN', 'MANAGER'],
      locationScope: 'SOURCE'
    });

    this.templates.set(NotificationEventType.TRANSFER_APPROVED, {
      type: NotificationEventType.TRANSFER_APPROVED,
      priority: NotificationPriorityType.NORMAL,
      title: 'Transfer Request Approved',
      messageTemplate: 'Your transfer request for {{quantity}} units of {{productName}} from {{sourceLocation}} to {{destinationLocation}} has been approved by {{approverName}}. {{notes}}',
      methods: [NotificationMethodType.EMAIL, NotificationMethodType.IN_APP],
      roleTargets: ['ADMIN', 'MANAGER', 'STAFF'],
      locationScope: 'BOTH'
    });

    this.templates.set(NotificationEventType.TRANSFER_REJECTED, {
      type: NotificationEventType.TRANSFER_REJECTED,
      priority: NotificationPriorityType.HIGH,
      title: 'Transfer Request Rejected',
      messageTemplate: 'Your transfer request for {{quantity}} units of {{productName}} from {{sourceLocation}} to {{destinationLocation}} has been rejected by {{rejectorName}}. Reason: {{reason}}',
      methods: [NotificationMethodType.EMAIL, NotificationMethodType.IN_APP],
      roleTargets: ['ADMIN', 'MANAGER', 'STAFF'],
      locationScope: 'BOTH'
    });

    this.templates.set(NotificationEventType.TRANSFER_SHIPPED, {
      type: NotificationEventType.TRANSFER_SHIPPED,
      priority: NotificationPriorityType.NORMAL,
      title: 'Transfer Shipped',
      messageTemplate: 'Transfer of {{quantity}} units of {{productName}} from {{sourceLocation}} to {{destinationLocation}} has been shipped by {{shipperName}} at {{shippedAt}}. {{notes}}',
      methods: [NotificationMethodType.EMAIL, NotificationMethodType.IN_APP],
      roleTargets: ['ADMIN', 'MANAGER', 'STAFF'],
      locationScope: 'DESTINATION'
    });

    this.templates.set(NotificationEventType.TRANSFER_RECEIVED, {
      type: NotificationEventType.TRANSFER_RECEIVED,
      priority: NotificationPriorityType.NORMAL,
      title: 'Transfer Received',
      messageTemplate: 'Transfer of {{quantityReceived}} units of {{productName}} from {{sourceLocation}} to {{destinationLocation}} has been received by {{receiverName}} at {{receivedAt}}{{varianceText}}.',
      methods: [NotificationMethodType.EMAIL, NotificationMethodType.IN_APP],
      roleTargets: ['ADMIN', 'MANAGER', 'STAFF'],
      locationScope: 'SOURCE'
    });

    this.templates.set(NotificationEventType.TRANSFER_CANCELLED, {
      type: NotificationEventType.TRANSFER_CANCELLED,
      priority: NotificationPriorityType.HIGH,
      title: 'Transfer Cancelled',
      messageTemplate: 'Transfer of {{quantity}} units of {{productName}} from {{sourceLocation}} to {{destinationLocation}} has been cancelled by {{cancellerName}}. Reason: {{reason}}',
      methods: [NotificationMethodType.EMAIL, NotificationMethodType.IN_APP],
      roleTargets: ['ADMIN', 'MANAGER', 'STAFF'],
      locationScope: 'BOTH'
    });

    this.templates.set(NotificationEventType.VARIANCE_DETECTED, {
      type: NotificationEventType.VARIANCE_DETECTED,
      priority: NotificationPriorityType.HIGH,
      title: 'Variance Detected in Transfer',
      messageTemplate: 'Variance detected in transfer of {{productName}} from {{sourceLocation}} to {{destinationLocation}}. Shipped: {{quantityShipped}}, Received: {{quantityReceived}}, Variance: {{variance}} units ({{variancePercentage}}%). Reason: {{varianceReason}}',
      methods: [NotificationMethodType.EMAIL, NotificationMethodType.IN_APP, NotificationMethodType.SMS],
      roleTargets: ['ADMIN', 'MANAGER'],
      locationScope: 'BOTH'
    });

    this.templates.set(NotificationEventType.EMERGENCY_TRANSFER, {
      type: NotificationEventType.EMERGENCY_TRANSFER,
      priority: NotificationPriorityType.URGENT,
      title: 'URGENT: Emergency Transfer Request',
      messageTemplate: 'EMERGENCY TRANSFER: {{quantity}} units of {{productName}} requested from {{sourceLocation}} to {{destinationLocation}} by {{requesterName}}. Reason: {{reason}}',
      methods: [NotificationMethodType.EMAIL, NotificationMethodType.IN_APP, NotificationMethodType.SMS],
      roleTargets: ['ADMIN', 'MANAGER'],
      locationScope: 'ALL'
    });
  }
}

// Factory function for creating transfer notification service
export function createTransferNotificationService(db: DrizzleD1Database): TransferNotificationService {
  return new TransferNotificationServiceImpl(db);
}