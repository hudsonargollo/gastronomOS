import { z } from 'zod';

// Email notification types
export enum NotificationTypes {
  USER_CREATED = 'USER_CREATED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  LOCATION_CREATED = 'LOCATION_CREATED',
  INVENTORY_LOW_STOCK = 'INVENTORY_LOW_STOCK',
  BULK_OPERATION_COMPLETED = 'BULK_OPERATION_COMPLETED',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  AUDIT_ALERT = 'AUDIT_ALERT',
  BACKUP_COMPLETED = 'BACKUP_COMPLETED',
  BACKUP_FAILED = 'BACKUP_FAILED',
}

// Email template interface
export interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: Record<string, string>;
}

// Email notification request
export interface EmailNotificationRequest {
  type: NotificationTypes;
  recipients: string[];
  tenantId: string;
  data: Record<string, any>;
  priority: 'low' | 'normal' | 'high' | 'critical';
  scheduledAt?: Date;
}

// Email notification service configuration
export interface EmailServiceConfig {
  provider: 'sendgrid' | 'ses' | 'smtp' | 'mock';
  apiKey?: string;
  fromEmail: string;
  fromName: string;
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  templates: Record<NotificationTypes, EmailTemplate>;
}

// Email notification service
export class EmailNotificationService {
  private config: EmailServiceConfig;
  private queue: EmailNotificationRequest[] = [];
  private processing = false;

  constructor(config: EmailServiceConfig) {
    this.config = config;
  }

  /**
   * Send email notification
   */
  async sendNotification(request: EmailNotificationRequest): Promise<boolean> {
    try {
      // Validate recipients
      const validRecipients = request.recipients.filter(email => 
        z.string().email().safeParse(email).success
      );

      if (validRecipients.length === 0) {
        console.warn('No valid recipients for email notification:', request.type);
        return false;
      }

      // Get template for notification type
      const template = this.config.templates[request.type];
      if (!template) {
        console.error('No template found for notification type:', request.type);
        return false;
      }

      // Process template variables
      const processedTemplate = this.processTemplate(template, request.data);

      // Send based on priority
      if (request.priority === 'critical') {
        return await this.sendImmediate(validRecipients, processedTemplate);
      } else {
        return await this.queueForSending(request);
      }
    } catch (error) {
      console.error('Error sending email notification:', error);
      return false;
    }
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(requests: EmailNotificationRequest[]): Promise<{
    sent: number;
    failed: number;
    errors: string[];
  }> {
    const results = { sent: 0, failed: 0, errors: [] as string[] };

    for (const request of requests) {
      try {
        const success = await this.sendNotification(request);
        if (success) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push(`Failed to send ${request.type} to ${request.recipients.join(', ')}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Error sending ${request.type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return results;
  }

  /**
   * Send system alert to administrators
   */
  async sendSystemAlert(
    tenantId: string,
    subject: string,
    message: string,
    severity: 'info' | 'warning' | 'error' | 'critical' = 'info'
  ): Promise<boolean> {
    // In a real implementation, this would query for admin users
    const adminEmails = ['admin@example.com']; // Mock admin emails

    return await this.sendNotification({
      type: NotificationTypes.SYSTEM_ALERT,
      recipients: adminEmails,
      tenantId,
      data: {
        subject,
        message,
        severity,
        timestamp: new Date().toISOString(),
      },
      priority: severity === 'critical' ? 'critical' : 'normal',
    });
  }

  /**
   * Send low stock alert
   */
  async sendLowStockAlert(
    tenantId: string,
    locationId: string,
    items: Array<{
      name: string;
      currentStock: number;
      threshold: number;
      unit: string;
    }>
  ): Promise<boolean> {
    // In a real implementation, this would query for location managers
    const managerEmails = ['manager@example.com']; // Mock manager emails

    return await this.sendNotification({
      type: NotificationTypes.INVENTORY_LOW_STOCK,
      recipients: managerEmails,
      tenantId,
      data: {
        locationId,
        items,
        itemCount: items.length,
        timestamp: new Date().toISOString(),
      },
      priority: 'high',
    });
  }

  /**
   * Process queued emails
   */
  async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      const batch = this.queue.splice(0, 10); // Process 10 at a time
      
      for (const request of batch) {
        try {
          const template = this.config.templates[request.type];
          if (template) {
            const processedTemplate = this.processTemplate(template, request.data);
            await this.sendImmediate(request.recipients, processedTemplate);
          }
        } catch (error) {
          console.error('Error processing queued email:', error);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    pending: number;
    processing: boolean;
  } {
    return {
      pending: this.queue.length,
      processing: this.processing,
    };
  }

  /**
   * Process template variables
   */
  private processTemplate(template: EmailTemplate, data: Record<string, any>): EmailTemplate {
    let subject = template.subject;
    let htmlBody = template.htmlBody;
    let textBody = template.textBody;

    // Replace variables in template
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      const stringValue = String(value);
      
      subject = subject.replace(new RegExp(placeholder, 'g'), stringValue);
      htmlBody = htmlBody.replace(new RegExp(placeholder, 'g'), stringValue);
      textBody = textBody.replace(new RegExp(placeholder, 'g'), stringValue);
    }

    return {
      subject,
      htmlBody,
      textBody,
      variables: template.variables,
    };
  }

  /**
   * Send email immediately
   */
  private async sendImmediate(recipients: string[], template: EmailTemplate): Promise<boolean> {
    try {
      switch (this.config.provider) {
        case 'mock':
          console.log('Mock email sent:', {
            to: recipients,
            subject: template.subject,
            body: template.textBody,
          });
          return true;

        case 'sendgrid':
          return await this.sendViaSendGrid(recipients, template);

        case 'ses':
          return await this.sendViaSES(recipients, template);

        case 'smtp':
          return await this.sendViaSMTP(recipients, template);

        default:
          console.error('Unknown email provider:', this.config.provider);
          return false;
      }
    } catch (error) {
      console.error('Error sending immediate email:', error);
      return false;
    }
  }

  /**
   * Queue email for later sending
   */
  private async queueForSending(request: EmailNotificationRequest): Promise<boolean> {
    this.queue.push(request);
    return true;
  }

  /**
   * Send via SendGrid (mock implementation)
   */
  private async sendViaSendGrid(recipients: string[], template: EmailTemplate): Promise<boolean> {
    // Mock implementation - in real app would use @sendgrid/mail
    console.log('SendGrid email sent:', {
      to: recipients,
      from: `${this.config.fromName} <${this.config.fromEmail}>`,
      subject: template.subject,
      html: template.htmlBody,
    });
    return true;
  }

  /**
   * Send via AWS SES (mock implementation)
   */
  private async sendViaSES(recipients: string[], template: EmailTemplate): Promise<boolean> {
    // Mock implementation - in real app would use AWS SDK
    console.log('SES email sent:', {
      to: recipients,
      from: `${this.config.fromName} <${this.config.fromEmail}>`,
      subject: template.subject,
      html: template.htmlBody,
    });
    return true;
  }

  /**
   * Send via SMTP (mock implementation)
   */
  private async sendViaSMTP(recipients: string[], template: EmailTemplate): Promise<boolean> {
    // Mock implementation - in real app would use nodemailer
    console.log('SMTP email sent:', {
      to: recipients,
      from: `${this.config.fromName} <${this.config.fromEmail}>`,
      subject: template.subject,
      html: template.htmlBody,
    });
    return true;
  }
}

// Default email templates
export const defaultEmailTemplates: Record<NotificationTypes, EmailTemplate> = {
  [NotificationTypes.USER_CREATED]: {
    subject: 'New User Account Created - {{email}}',
    htmlBody: `
      <h2>New User Account Created</h2>
      <p>A new user account has been created:</p>
      <ul>
        <li><strong>Email:</strong> {{email}}</li>
        <li><strong>Role:</strong> {{role}}</li>
        <li><strong>Created by:</strong> {{createdBy}}</li>
        <li><strong>Date:</strong> {{timestamp}}</li>
      </ul>
    `,
    textBody: 'New user account created: {{email}} with role {{role}} by {{createdBy}} at {{timestamp}}',
    variables: { email: '', role: '', createdBy: '', timestamp: '' },
  },

  [NotificationTypes.USER_ROLE_CHANGED]: {
    subject: 'User Role Changed - {{email}}',
    htmlBody: `
      <h2>User Role Changed</h2>
      <p>A user's role has been updated:</p>
      <ul>
        <li><strong>User:</strong> {{email}}</li>
        <li><strong>New Role:</strong> {{newRole}}</li>
        <li><strong>Previous Role:</strong> {{previousRole}}</li>
        <li><strong>Changed by:</strong> {{changedBy}}</li>
        <li><strong>Date:</strong> {{timestamp}}</li>
      </ul>
    `,
    textBody: 'User {{email}} role changed from {{previousRole}} to {{newRole}} by {{changedBy}} at {{timestamp}}',
    variables: { email: '', newRole: '', previousRole: '', changedBy: '', timestamp: '' },
  },

  [NotificationTypes.LOCATION_CREATED]: {
    subject: 'New Location Created - {{name}}',
    htmlBody: `
      <h2>New Location Created</h2>
      <p>A new location has been added:</p>
      <ul>
        <li><strong>Name:</strong> {{name}}</li>
        <li><strong>Type:</strong> {{type}}</li>
        <li><strong>Address:</strong> {{address}}</li>
        <li><strong>Created by:</strong> {{createdBy}}</li>
        <li><strong>Date:</strong> {{timestamp}}</li>
      </ul>
    `,
    textBody: 'New location created: {{name}} ({{type}}) at {{address}} by {{createdBy}} at {{timestamp}}',
    variables: { name: '', type: '', address: '', createdBy: '', timestamp: '' },
  },

  [NotificationTypes.INVENTORY_LOW_STOCK]: {
    subject: 'Low Stock Alert - {{itemCount}} Items',
    htmlBody: `
      <h2>Low Stock Alert</h2>
      <p>The following items are running low at location {{locationId}}:</p>
      <ul>
        {{#each items}}
        <li><strong>{{name}}:</strong> {{currentStock}} {{unit}} (threshold: {{threshold}} {{unit}})</li>
        {{/each}}
      </ul>
      <p>Please restock these items as soon as possible.</p>
    `,
    textBody: 'Low stock alert for {{itemCount}} items at location {{locationId}}. Please check inventory levels.',
    variables: { locationId: '', itemCount: '', items: '', timestamp: '' },
  },

  [NotificationTypes.BULK_OPERATION_COMPLETED]: {
    subject: 'Bulk Operation Completed - {{operation}}',
    htmlBody: `
      <h2>Bulk Operation Completed</h2>
      <p>A bulk operation has been completed:</p>
      <ul>
        <li><strong>Operation:</strong> {{operation}}</li>
        <li><strong>Records Processed:</strong> {{processed}}</li>
        <li><strong>Records Failed:</strong> {{failed}}</li>
        <li><strong>Duration:</strong> {{duration}}ms</li>
        <li><strong>Initiated by:</strong> {{initiatedBy}}</li>
        <li><strong>Date:</strong> {{timestamp}}</li>
      </ul>
    `,
    textBody: 'Bulk {{operation}} completed: {{processed}} processed, {{failed}} failed in {{duration}}ms by {{initiatedBy}} at {{timestamp}}',
    variables: { operation: '', processed: '', failed: '', duration: '', initiatedBy: '', timestamp: '' },
  },

  [NotificationTypes.SYSTEM_ALERT]: {
    subject: 'System Alert - {{severity}} - {{subject}}',
    htmlBody: `
      <h2>System Alert</h2>
      <div style="padding: 10px; background-color: {{#if (eq severity 'critical')}}#ffebee{{else if (eq severity 'error')}}#fff3e0{{else if (eq severity 'warning')}}#f3e5f5{{else}}#e8f5e8{{/if}}; border-left: 4px solid {{#if (eq severity 'critical')}}#f44336{{else if (eq severity 'error')}}#ff9800{{else if (eq severity 'warning')}}#9c27b0{{else}}#4caf50{{/if}};">
        <p><strong>Severity:</strong> {{severity}}</p>
        <p><strong>Subject:</strong> {{subject}}</p>
        <p><strong>Message:</strong> {{message}}</p>
        <p><strong>Time:</strong> {{timestamp}}</p>
      </div>
    `,
    textBody: 'System Alert [{{severity}}]: {{subject}} - {{message}} at {{timestamp}}',
    variables: { severity: '', subject: '', message: '', timestamp: '' },
  },

  [NotificationTypes.AUDIT_ALERT]: {
    subject: 'Audit Alert - {{eventType}}',
    htmlBody: `
      <h2>Audit Alert</h2>
      <p>An important audit event has occurred:</p>
      <ul>
        <li><strong>Event Type:</strong> {{eventType}}</li>
        <li><strong>User:</strong> {{userId}}</li>
        <li><strong>Resource:</strong> {{resource}}</li>
        <li><strong>Details:</strong> {{details}}</li>
        <li><strong>IP Address:</strong> {{ipAddress}}</li>
        <li><strong>Time:</strong> {{timestamp}}</li>
      </ul>
    `,
    textBody: 'Audit Alert: {{eventType}} by {{userId}} on {{resource}} from {{ipAddress}} at {{timestamp}}',
    variables: { eventType: '', userId: '', resource: '', details: '', ipAddress: '', timestamp: '' },
  },

  [NotificationTypes.BACKUP_COMPLETED]: {
    subject: 'Backup Completed Successfully',
    htmlBody: `
      <h2>Backup Completed</h2>
      <p>A system backup has been completed successfully:</p>
      <ul>
        <li><strong>Backup Type:</strong> {{backupType}}</li>
        <li><strong>Size:</strong> {{size}}</li>
        <li><strong>Duration:</strong> {{duration}}</li>
        <li><strong>Location:</strong> {{location}}</li>
        <li><strong>Date:</strong> {{timestamp}}</li>
      </ul>
    `,
    textBody: 'Backup completed: {{backupType}} ({{size}}) in {{duration}} at {{location}} on {{timestamp}}',
    variables: { backupType: '', size: '', duration: '', location: '', timestamp: '' },
  },

  [NotificationTypes.BACKUP_FAILED]: {
    subject: 'Backup Failed - Immediate Action Required',
    htmlBody: `
      <h2>Backup Failed</h2>
      <div style="padding: 10px; background-color: #ffebee; border-left: 4px solid #f44336;">
        <p><strong>A system backup has failed and requires immediate attention.</strong></p>
        <ul>
          <li><strong>Backup Type:</strong> {{backupType}}</li>
          <li><strong>Error:</strong> {{error}}</li>
          <li><strong>Retry Count:</strong> {{retryCount}}</li>
          <li><strong>Next Retry:</strong> {{nextRetry}}</li>
          <li><strong>Date:</strong> {{timestamp}}</li>
        </ul>
        <p>Please investigate and resolve this issue as soon as possible.</p>
      </div>
    `,
    textBody: 'URGENT: Backup failed - {{backupType}} failed with error: {{error}} at {{timestamp}}. Retry count: {{retryCount}}',
    variables: { backupType: '', error: '', retryCount: '', nextRetry: '', timestamp: '' },
  },
};

// Create email notification service with default configuration
export function createEmailNotificationService(config?: Partial<EmailServiceConfig>): EmailNotificationService {
  const defaultConfig: EmailServiceConfig = {
    provider: 'mock',
    fromEmail: 'noreply@gastronomos.com',
    fromName: 'GastronomOS',
    templates: defaultEmailTemplates,
    ...config,
  };

  return new EmailNotificationService(defaultConfig);
}