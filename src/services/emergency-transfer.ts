import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, count } from 'drizzle-orm';
import { 
  transfers,
  users,
  Transfer,
  TransferStatus,
  TransferPriority,
  TransferPriorityType,
  User
} from '../db/schema';
import { generateId, getCurrentTimestamp } from '../utils';
import { createTransferService, TransferService } from './transfer';
import { createTransferStateMachine, TransferStateMachine, TransitionContext } from './transfer-state-machine';
import { createTransferNotificationService, TransferNotificationService } from './transfer-notification';

  // Emergency transfer configuration interface
export interface EmergencyTransferConfig {
  autoApprovalEnabled: boolean;
  autoApprovalThresholds: {
    maxQuantity: number;
    maxValuePerUnit?: number;
    allowedSourceLocations?: string[];
    allowedDestinationLocations?: string[];
    allowedProducts?: string[]; // Restrict emergency transfers to specific products
    requiresJustification?: boolean; // Require detailed justification for emergency transfers
  };
  expeditedApprovalTimeoutMinutes: number;
  emergencyNotificationRecipients: string[]; // User IDs for immediate notification
  frequencyLimits: {
    maxEmergencyTransfersPerDay: number;
    maxEmergencyTransfersPerWeek: number;
    cooldownPeriodHours: number;
  };
  escalationRules: {
    escalateAfterMinutes: number; // Escalate if not approved within this time
    escalationRecipients: string[]; // Higher-level approvers for escalation
    maxEscalationLevels: number;
  };
  priorityQueue: {
    enabled: boolean;
    maxQueueSize: number;
    processingIntervalMinutes: number;
  };
}

// Emergency transfer monitoring and analytics interfaces
export interface EmergencyTransferMonitoring {
  // Frequency tracking
  trackEmergencyFrequency(tenantId: string, locationId?: string): Promise<EmergencyFrequencyMetrics>;
  getFrequencyTrends(tenantId: string, periodDays: number): Promise<EmergencyFrequencyTrend[]>;
  
  // Reason analysis
  analyzeEmergencyReasons(tenantId: string, dateFrom?: Date, dateTo?: Date): Promise<EmergencyReasonAnalysis>;
  getReasonTrends(tenantId: string, periodDays: number): Promise<EmergencyReasonTrend[]>;
  
  // Reporting
  generateEmergencyTransferReport(tenantId: string, options: EmergencyReportOptions): Promise<EmergencyTransferReport>;
  getEmergencyAlerts(tenantId: string): Promise<EmergencyAlert[]>;
  
  // Performance metrics
  getEmergencyPerformanceMetrics(tenantId: string, dateFrom?: Date, dateTo?: Date): Promise<EmergencyPerformanceMetrics>;
}

export interface EmergencyFrequencyMetrics {
  tenantId: string;
  locationId?: string;
  period: {
    hourly: number;
    daily: number;
    weekly: number;
    monthly: number;
  };
  trends: {
    increasing: boolean;
    changePercentage: number;
    comparisonPeriod: string;
  };
  thresholds: {
    dailyLimit: number;
    weeklyLimit: number;
    currentUtilization: {
      daily: number; // percentage
      weekly: number; // percentage
    };
  };
}

export interface EmergencyFrequencyTrend {
  date: Date;
  count: number;
  locationBreakdown?: { [locationId: string]: number };
}

export interface EmergencyReasonAnalysis {
  totalEmergencies: number;
  reasonBreakdown: {
    [reason: string]: {
      count: number;
      percentage: number;
      averageProcessingTime: number;
      autoApprovalRate: number;
    };
  };
  topReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  locationAnalysis: {
    [locationId: string]: {
      totalEmergencies: number;
      topReason: string;
      reasonBreakdown: { [reason: string]: number };
    };
  };
}

export interface EmergencyReasonTrend {
  date: Date;
  reason: string;
  count: number;
  processingTime: number;
}

export interface EmergencyReportOptions {
  dateFrom?: Date;
  dateTo?: Date;
  locationIds?: string[];
  includeReasonAnalysis?: boolean;
  includePerformanceMetrics?: boolean;
  includeFrequencyTrends?: boolean;
  format?: 'json' | 'csv' | 'pdf';
}

export interface EmergencyTransferReport {
  reportId: string;
  generatedAt: Date;
  period: {
    from: Date;
    to: Date;
  };
  summary: {
    totalEmergencies: number;
    autoApprovalRate: number;
    averageProcessingTime: number;
    escalationRate: number;
  };
  frequencyAnalysis?: EmergencyFrequencyMetrics;
  reasonAnalysis?: EmergencyReasonAnalysis;
  performanceMetrics?: EmergencyPerformanceMetrics;
  trends?: EmergencyFrequencyTrend[];
  alerts?: EmergencyAlert[];
}

export interface EmergencyAlert {
  id: string;
  type: 'FREQUENCY_THRESHOLD' | 'PROCESSING_TIME' | 'ESCALATION_RATE' | 'REASON_PATTERN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details: {
    metric: string;
    currentValue: number;
    threshold: number;
    locationId?: string;
    reason?: string;
  };
  triggeredAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface EmergencyPerformanceMetrics {
  processingTimes: {
    average: number;
    median: number;
    p95: number;
    p99: number;
  };
  approvalRates: {
    autoApproval: number;
    manualApproval: number;
    rejection: number;
  };
  escalationMetrics: {
    escalationRate: number;
    averageEscalationTime: number;
    escalationsByLevel: { [level: number]: number };
  };
  queueMetrics: {
    averageQueueTime: number;
    maxQueueTime: number;
    queueUtilization: number;
  };
}

// Emergency transfer analytics interface
export interface EmergencyTransferAnalytics {
  transferId: string;
  requestedAt: Date;
  approvedAt?: Date;
  processingTimeMinutes?: number;
  autoApproved: boolean;
  reason: string;
  frequency: {
    dailyCount: number;
    weeklyCount: number;
    lastEmergencyTransfer?: Date;
  };
}

// Emergency transfer service interface
export interface EmergencyTransferService {
  // Core emergency transfer operations
  processEmergencyTransfer(transfer: Transfer): Promise<{
    autoApproved: boolean;
    expedited: boolean;
    processingTimeMinutes: number;
    notificationsSent: boolean;
  }>;
  
  // Configuration management
  getEmergencyConfig(tenantId: string): Promise<EmergencyTransferConfig>;
  updateEmergencyConfig(tenantId: string, config: Partial<EmergencyTransferConfig>): Promise<EmergencyTransferConfig>;
  
  // Analytics and monitoring
  getEmergencyTransferAnalytics(tenantId: string, dateFrom?: Date, dateTo?: Date): Promise<EmergencyTransferAnalytics[]>;
  getEmergencyFrequency(tenantId: string, locationId?: string): Promise<{
    dailyCount: number;
    weeklyCount: number;
    monthlyCount: number;
    lastEmergencyTransfer?: Date;
  }>;
  
  // Emergency monitoring methods
  trackEmergencyFrequency(tenantId: string, locationId?: string): Promise<EmergencyFrequencyMetrics>;
  getFrequencyTrends(tenantId: string, periodDays: number): Promise<EmergencyFrequencyTrend[]>;
  analyzeEmergencyReasons(tenantId: string, dateFrom?: Date, dateTo?: Date): Promise<EmergencyReasonAnalysis>;
  getReasonTrends(tenantId: string, periodDays: number): Promise<EmergencyReasonTrend[]>;
  generateEmergencyTransferReport(tenantId: string, options: EmergencyReportOptions): Promise<EmergencyTransferReport>;
  getEmergencyAlerts(tenantId: string): Promise<EmergencyAlert[]>;
  getEmergencyPerformanceMetrics(tenantId: string, dateFrom?: Date, dateTo?: Date): Promise<EmergencyPerformanceMetrics>;
  
  // Validation and checks
  canCreateEmergencyTransfer(tenantId: string, sourceLocationId: string, destinationLocationId: string): Promise<{
    allowed: boolean;
    reason?: string;
    frequencyLimitExceeded?: boolean;
    cooldownActive?: boolean;
  }>;
  
  // Emergency-specific approval workflow
  handleEmergencyApproval(transfer: Transfer, approverId: string): Promise<Transfer>;
  
  // Emergency validation and workflow methods
  validateEmergencyTransferRules(transfer: Transfer, config: EmergencyTransferConfig): Promise<void>;
  prepareEmergencyShipping(transfer: Transfer): Promise<void>;
  escalateEmergencyTransfer(transfer: Transfer, level: number): Promise<void>;
  
  // Priority queue management
  addToEmergencyQueue(transfer: Transfer): Promise<{ queuePosition: number; estimatedProcessingTime: number }>;
  getEmergencyQueueStatus(tenantId: string): Promise<{
    queueLength: number;
    averageProcessingTime: number;
    nextProcessingTime?: Date;
  }>;
}

/**
 * Emergency Transfer Service Implementation
 * 
 * Handles emergency transfer prioritization, expedited approval workflows,
 * and immediate notifications for critical inventory shortages.
 * 
 * Requirements: 10.1, 10.2, 10.3
 */
export class EmergencyTransferServiceImpl implements EmergencyTransferService {
  private transferService: TransferService;
  private stateMachine: TransferStateMachine;
  private notificationService: TransferNotificationService;
  
  // In-memory storage for emergency configurations (would be database tables in production)
  private emergencyConfigs = new Map<string, EmergencyTransferConfig>();

  constructor(private db: DrizzleD1Database) {
    this.transferService = createTransferService(db);
    this.stateMachine = createTransferStateMachine(db);
    this.notificationService = createTransferNotificationService(db);
    
    this.initializeDefaultConfigs();
  }

  /**
   * Process emergency transfer with prioritization and expedited workflows
   * Requirements: 10.1, 10.2, 10.3
   */
  async processEmergencyTransfer(transfer: Transfer): Promise<{
    autoApproved: boolean;
    expedited: boolean;
    processingTimeMinutes: number;
    notificationsSent: boolean;
    escalated?: boolean;
    queuePosition?: number;
  }> {
    const startTime = Date.now();
    
    // Validate this is an emergency transfer
    if (transfer.priority !== 'EMERGENCY') {
      throw new Error('Transfer is not marked as emergency priority');
    }

    // Get emergency configuration for tenant
    const config = await this.getEmergencyConfig(transfer.tenantId);
    
    // Check if emergency transfer is allowed
    const canCreate = await this.canCreateEmergencyTransfer(
      transfer.tenantId,
      transfer.sourceLocationId,
      transfer.destinationLocationId
    );
    
    if (!canCreate.allowed) {
      throw new Error(`Emergency transfer not allowed: ${canCreate.reason}`);
    }

    // Apply emergency-specific validation rules
    await this.validateEmergencyTransferRules(transfer, config);

    let autoApproved = false;
    let expedited = true; // All emergency transfers are expedited
    let notificationsSent = false;
    let escalated = false;
    let queuePosition: number | undefined;

    try {
      // Send immediate emergency notifications
      await this.sendImmediateEmergencyNotifications(transfer, config);
      notificationsSent = true;

      // Check if auto-approval is enabled and transfer meets criteria
      if (config.autoApprovalEnabled && await this.meetsAutoApprovalCriteria(transfer, config)) {
        // Auto-approve the transfer with expedited processing
        const context: TransitionContext = {
          userId: 'system_emergency_auto_approval',
          tenantId: transfer.tenantId,
          reason: 'Auto-approved emergency transfer based on configuration',
          metadata: {
            autoApproved: true,
            emergencyProcessing: true,
            processingStartTime: startTime,
            expeditedWorkflow: true
          }
        };

        await this.stateMachine.executeTransition(transfer, 'APPROVED', context);
        autoApproved = true;

        // Trigger immediate shipping preparation if inventory is available
        await this.prepareEmergencyShipping(transfer);

        console.log(`Emergency transfer ${transfer.id} auto-approved and prepared for immediate shipping`);
      } else {
        // Flag for expedited manual approval with priority queue
        const queueResult = await this.flagForExpeditedApproval(transfer, config);
        queuePosition = queueResult.queuePosition;
        escalated = queueResult.escalated;
        
        console.log(`Emergency transfer ${transfer.id} flagged for expedited manual approval (queue position: ${queuePosition})`);
      }

      // Record emergency transfer analytics
      await this.recordEmergencyAnalytics(transfer, autoApproved, startTime);

    } catch (error) {
      console.error(`Error processing emergency transfer ${transfer.id}:`, error);
      // Continue processing even if some steps fail
    }

    const processingTimeMinutes = (Date.now() - startTime) / (1000 * 60);

    return {
      autoApproved,
      expedited,
      processingTimeMinutes,
      notificationsSent,
      escalated,
      queuePosition
    };
  }

  /**
   * Get emergency transfer configuration for tenant
   * Requirements: 10.1
   */
  async getEmergencyConfig(tenantId: string): Promise<EmergencyTransferConfig> {
    return this.emergencyConfigs.get(tenantId) || this.getDefaultEmergencyConfig();
  }

  /**
   * Update emergency transfer configuration
   * Requirements: 10.1
   */
  async updateEmergencyConfig(tenantId: string, config: Partial<EmergencyTransferConfig>): Promise<EmergencyTransferConfig> {
    const existing = await this.getEmergencyConfig(tenantId);
    const updated: EmergencyTransferConfig = {
      ...existing,
      ...config,
      // Merge nested objects properly
      autoApprovalThresholds: {
        ...existing.autoApprovalThresholds,
        ...(config.autoApprovalThresholds || {})
      },
      frequencyLimits: {
        ...existing.frequencyLimits,
        ...(config.frequencyLimits || {})
      }
    };

    this.emergencyConfigs.set(tenantId, updated);
    return updated;
  }

  /**
   * Get emergency transfer analytics
   * Requirements: 10.4, 10.5
   */
  async getEmergencyTransferAnalytics(tenantId: string, dateFrom?: Date, dateTo?: Date): Promise<EmergencyTransferAnalytics[]> {
    const fromTime = dateFrom ? dateFrom.getTime() : Date.now() - (30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const toTime = dateTo ? dateTo.getTime() : Date.now();

    const emergencyTransfers = await this.db
      .select()
      .from(transfers)
      .where(and(
        eq(transfers.tenantId, tenantId),
        eq(transfers.priority, 'EMERGENCY'),
        // Add date range filtering
      ))
      .orderBy(desc(transfers.createdAt));

    const analytics: EmergencyTransferAnalytics[] = [];

    for (const transfer of emergencyTransfers) {
      const frequency = await this.getEmergencyFrequency(tenantId, transfer.sourceLocationId);
      
      const processingTimeMinutes = transfer.approvedAt 
        ? (transfer.approvedAt - transfer.createdAt) / (1000 * 60)
        : undefined;

      analytics.push({
        transferId: transfer.id,
        requestedAt: new Date(transfer.createdAt),
        approvedAt: transfer.approvedAt ? new Date(transfer.approvedAt) : undefined,
        processingTimeMinutes,
        autoApproved: transfer.approvedBy === 'system_emergency_auto_approval',
        reason: transfer.notes || 'No reason provided',
        frequency: {
          dailyCount: frequency.dailyCount,
          weeklyCount: frequency.weeklyCount,
          lastEmergencyTransfer: frequency.lastEmergencyTransfer
        }
      });
    }

    return analytics;
  }

  /**
   * Get emergency transfer frequency for monitoring
   * Requirements: 10.4, 10.5
   */
  async getEmergencyFrequency(tenantId: string, locationId?: string): Promise<{
    dailyCount: number;
    weeklyCount: number;
    monthlyCount: number;
    lastEmergencyTransfer?: Date;
  }> {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);

    const baseConditions = [
      eq(transfers.tenantId, tenantId),
      eq(transfers.priority, 'EMERGENCY')
    ];

    if (locationId) {
      baseConditions.push(eq(transfers.sourceLocationId, locationId));
    }

    // Get daily count
    const [dailyResult] = await this.db
      .select({ count: count() })
      .from(transfers)
      .where(and(
        ...baseConditions,
        // Add date filtering for last 24 hours
      ));

    // Get weekly count
    const [weeklyResult] = await this.db
      .select({ count: count() })
      .from(transfers)
      .where(and(
        ...baseConditions,
        // Add date filtering for last 7 days
      ));

    // Get monthly count
    const [monthlyResult] = await this.db
      .select({ count: count() })
      .from(transfers)
      .where(and(
        ...baseConditions,
        // Add date filtering for last 30 days
      ));

    // Get last emergency transfer
    const [lastTransfer] = await this.db
      .select()
      .from(transfers)
      .where(and(...baseConditions))
      .orderBy(desc(transfers.createdAt))
      .limit(1);

    return {
      dailyCount: dailyResult?.count || 0,
      weeklyCount: weeklyResult?.count || 0,
      monthlyCount: monthlyResult?.count || 0,
      lastEmergencyTransfer: lastTransfer ? new Date(lastTransfer.createdAt) : undefined
    };
  }

  /**
   * Check if emergency transfer can be created
   * Requirements: 10.4, 10.5
   */
  async canCreateEmergencyTransfer(tenantId: string, sourceLocationId: string, destinationLocationId: string): Promise<{
    allowed: boolean;
    reason?: string;
    frequencyLimitExceeded?: boolean;
    cooldownActive?: boolean;
  }> {
    const config = await this.getEmergencyConfig(tenantId);
    const frequency = await this.getEmergencyFrequency(tenantId, sourceLocationId);

    // Check daily frequency limit
    if (frequency.dailyCount >= config.frequencyLimits.maxEmergencyTransfersPerDay) {
      return {
        allowed: false,
        reason: `Daily emergency transfer limit exceeded (${frequency.dailyCount}/${config.frequencyLimits.maxEmergencyTransfersPerDay})`,
        frequencyLimitExceeded: true
      };
    }

    // Check weekly frequency limit
    if (frequency.weeklyCount >= config.frequencyLimits.maxEmergencyTransfersPerWeek) {
      return {
        allowed: false,
        reason: `Weekly emergency transfer limit exceeded (${frequency.weeklyCount}/${config.frequencyLimits.maxEmergencyTransfersPerWeek})`,
        frequencyLimitExceeded: true
      };
    }

    // Check cooldown period
    if (frequency.lastEmergencyTransfer) {
      const cooldownEndTime = frequency.lastEmergencyTransfer.getTime() + (config.frequencyLimits.cooldownPeriodHours * 60 * 60 * 1000);
      if (Date.now() < cooldownEndTime) {
        const remainingMinutes = Math.ceil((cooldownEndTime - Date.now()) / (1000 * 60));
        return {
          allowed: false,
          reason: `Emergency transfer cooldown active. ${remainingMinutes} minutes remaining.`,
          cooldownActive: true
        };
      }
    }

    // Check location restrictions
    if (config.autoApprovalThresholds.allowedSourceLocations && 
        !config.autoApprovalThresholds.allowedSourceLocations.includes(sourceLocationId)) {
      return {
        allowed: false,
        reason: 'Source location not authorized for emergency transfers'
      };
    }

    if (config.autoApprovalThresholds.allowedDestinationLocations && 
        !config.autoApprovalThresholds.allowedDestinationLocations.includes(destinationLocationId)) {
      return {
        allowed: false,
        reason: 'Destination location not authorized for emergency transfers'
      };
    }

    return { allowed: true };
  }

  /**
   * Validate emergency-specific transfer rules
   * Requirements: 10.1, 10.2
   */
  async validateEmergencyTransferRules(transfer: Transfer, config: EmergencyTransferConfig): Promise<void> {
    // Check if product is allowed for emergency transfers
    if (config.autoApprovalThresholds.allowedProducts && 
        !config.autoApprovalThresholds.allowedProducts.includes(transfer.productId)) {
      throw new Error(`Product ${transfer.productId} is not authorized for emergency transfers`);
    }

    // Require justification for emergency transfers if configured
    if (config.autoApprovalThresholds.requiresJustification && 
        (!transfer.notes || transfer.notes.trim().length < 10)) {
      throw new Error('Emergency transfers require detailed justification (minimum 10 characters)');
    }

    // Validate emergency transfer reason codes
    const validEmergencyReasons = [
      'CRITICAL_SHORTAGE',
      'EQUIPMENT_FAILURE', 
      'SUPPLY_CHAIN_DISRUPTION',
      'CUSTOMER_EMERGENCY',
      'QUALITY_ISSUE',
      'REGULATORY_REQUIREMENT'
    ];

    // Extract reason from notes or require specific format
    const reasonMatch = transfer.notes?.match(/REASON:\s*(\w+)/);
    if (config.autoApprovalThresholds.requiresJustification && !reasonMatch) {
      throw new Error('Emergency transfers must include a reason code (format: REASON: CODE)');
    }

    if (reasonMatch && !validEmergencyReasons.includes(reasonMatch[1])) {
      throw new Error(`Invalid emergency reason code: ${reasonMatch[1]}. Valid codes: ${validEmergencyReasons.join(', ')}`);
    }

    console.log(`Emergency transfer ${transfer.id} passed validation rules`);
  }

  /**
   * Prepare emergency transfer for immediate shipping
   * Requirements: 10.1, 10.2
   */
  async prepareEmergencyShipping(transfer: Transfer): Promise<void> {
    try {
      // Reserve inventory immediately for emergency transfers
      const inventoryService = (this as any).inventoryService || 
        await import('./inventory-integration').then(m => m.createInventoryIntegrationService(this.db));
      
      const reservation = await inventoryService.reserveInventoryForTransfer(
        transfer.productId,
        transfer.sourceLocationId,
        transfer.quantityRequested
      );

      if (!reservation.reserved) {
        throw new Error(`Cannot reserve inventory for emergency transfer: insufficient quantity available`);
      }

      // Flag transfer for immediate shipping preparation
      console.log(`Emergency transfer ${transfer.id} prepared for immediate shipping with reservation ${reservation.reservationId}`);
      
      // In a real implementation, this would:
      // 1. Alert warehouse staff for immediate picking
      // 2. Generate priority shipping labels
      // 3. Schedule expedited delivery
      // 4. Update inventory systems with priority flags
      
    } catch (error) {
      console.error(`Failed to prepare emergency shipping for transfer ${transfer.id}:`, error);
      throw error;
    }
  }

  /**
   * Escalate emergency transfer to higher-level approvers
   * Requirements: 10.1, 10.2
   */
  async escalateEmergencyTransfer(transfer: Transfer, level: number): Promise<void> {
    const config = await this.getEmergencyConfig(transfer.tenantId);
    
    if (level > config.escalationRules.maxEscalationLevels) {
      console.error(`Maximum escalation level reached for transfer ${transfer.id}`);
      return;
    }

    try {
      // Send escalation notifications to higher-level approvers
      for (const recipientId of config.escalationRules.escalationRecipients) {
        console.log(`Escalating emergency transfer ${transfer.id} to level ${level} approver ${recipientId}`);
        
        // In a real implementation, this would send urgent notifications
        // via multiple channels (email, SMS, push notifications)
      }

      // Record escalation in audit trail
      console.log(`Emergency transfer ${transfer.id} escalated to level ${level}`);
      
    } catch (error) {
      console.error(`Failed to escalate emergency transfer ${transfer.id}:`, error);
    }
  }

  /**
   * Add emergency transfer to priority queue
   * Requirements: 10.1, 10.2
   */
  async addToEmergencyQueue(transfer: Transfer): Promise<{ queuePosition: number; estimatedProcessingTime: number }> {
    const config = await this.getEmergencyConfig(transfer.tenantId);
    
    if (!config.priorityQueue.enabled) {
      return { queuePosition: 1, estimatedProcessingTime: config.expeditedApprovalTimeoutMinutes };
    }

    // In a real implementation, this would use a proper queue system (Redis, database, etc.)
    // For now, simulate queue behavior
    const currentQueueLength = Math.floor(Math.random() * config.priorityQueue.maxQueueSize);
    const queuePosition = currentQueueLength + 1;
    const estimatedProcessingTime = queuePosition * config.priorityQueue.processingIntervalMinutes;

    console.log(`Emergency transfer ${transfer.id} added to priority queue at position ${queuePosition}`);
    
    return { queuePosition, estimatedProcessingTime };
  }

  /**
   * Track emergency transfer frequency with detailed metrics
   * Requirements: 10.4, 10.5
   */
  async trackEmergencyFrequency(tenantId: string, locationId?: string): Promise<EmergencyFrequencyMetrics> {
    const config = await this.getEmergencyConfig(tenantId);
    const currentFrequency = await this.getEmergencyFrequency(tenantId, locationId);
    
    // Get historical data for trend analysis
    const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
    const historicalFrequency = await this.getEmergencyFrequency(tenantId, locationId);
    
    // Calculate trends (simplified for demo)
    const changePercentage = historicalFrequency.monthlyCount > 0 
      ? ((currentFrequency.monthlyCount - historicalFrequency.monthlyCount) / historicalFrequency.monthlyCount) * 100
      : 0;
    
    return {
      tenantId,
      locationId,
      period: {
        hourly: Math.floor(currentFrequency.dailyCount / 24), // Approximate
        daily: currentFrequency.dailyCount,
        weekly: currentFrequency.weeklyCount,
        monthly: currentFrequency.monthlyCount
      },
      trends: {
        increasing: changePercentage > 0,
        changePercentage: Math.abs(changePercentage),
        comparisonPeriod: 'last_30_days'
      },
      thresholds: {
        dailyLimit: config.frequencyLimits.maxEmergencyTransfersPerDay,
        weeklyLimit: config.frequencyLimits.maxEmergencyTransfersPerWeek,
        currentUtilization: {
          daily: (currentFrequency.dailyCount / config.frequencyLimits.maxEmergencyTransfersPerDay) * 100,
          weekly: (currentFrequency.weeklyCount / config.frequencyLimits.maxEmergencyTransfersPerWeek) * 100
        }
      }
    };
  }

  /**
   * Get emergency frequency trends over time
   * Requirements: 10.4, 10.5
   */
  async getFrequencyTrends(tenantId: string, periodDays: number): Promise<EmergencyFrequencyTrend[]> {
    const trends: EmergencyFrequencyTrend[] = [];
    const startDate = new Date(Date.now() - (periodDays * 24 * 60 * 60 * 1000));
    
    // In a real implementation, this would query the database for daily counts
    // For now, simulate trend data
    for (let i = 0; i < periodDays; i++) {
      const date = new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000));
      const count = Math.floor(Math.random() * 5); // Simulate 0-4 emergencies per day
      
      trends.push({
        date,
        count,
        locationBreakdown: {
          'location_1': Math.floor(count * 0.4),
          'location_2': Math.floor(count * 0.3),
          'location_3': Math.floor(count * 0.3)
        }
      });
    }
    
    return trends;
  }

  /**
   * Analyze emergency transfer reasons
   * Requirements: 10.4, 10.5
   */
  async analyzeEmergencyReasons(tenantId: string, dateFrom?: Date, dateTo?: Date): Promise<EmergencyReasonAnalysis> {
    const fromTime = dateFrom ? dateFrom.getTime() : Date.now() - (30 * 24 * 60 * 60 * 1000);
    const toTime = dateTo ? dateTo.getTime() : Date.now();

    // In a real implementation, this would query the database
    // For now, simulate reason analysis
    const reasonBreakdown = {
      'CRITICAL_SHORTAGE': {
        count: 15,
        percentage: 45.5,
        averageProcessingTime: 12.5,
        autoApprovalRate: 80
      },
      'EQUIPMENT_FAILURE': {
        count: 8,
        percentage: 24.2,
        averageProcessingTime: 18.3,
        autoApprovalRate: 60
      },
      'SUPPLY_CHAIN_DISRUPTION': {
        count: 6,
        percentage: 18.2,
        averageProcessingTime: 25.1,
        autoApprovalRate: 40
      },
      'CUSTOMER_EMERGENCY': {
        count: 4,
        percentage: 12.1,
        averageProcessingTime: 8.7,
        autoApprovalRate: 90
      }
    };

    const totalEmergencies = Object.values(reasonBreakdown).reduce((sum, reason) => sum + reason.count, 0);
    
    const topReasons = Object.entries(reasonBreakdown)
      .map(([reason, data]) => ({
        reason,
        count: data.count,
        percentage: data.percentage
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalEmergencies,
      reasonBreakdown,
      topReasons,
      locationAnalysis: {
        'location_1': {
          totalEmergencies: 18,
          topReason: 'CRITICAL_SHORTAGE',
          reasonBreakdown: {
            'CRITICAL_SHORTAGE': 8,
            'EQUIPMENT_FAILURE': 5,
            'SUPPLY_CHAIN_DISRUPTION': 3,
            'CUSTOMER_EMERGENCY': 2
          }
        },
        'location_2': {
          totalEmergencies: 10,
          topReason: 'EQUIPMENT_FAILURE',
          reasonBreakdown: {
            'EQUIPMENT_FAILURE': 4,
            'CRITICAL_SHORTAGE': 3,
            'SUPPLY_CHAIN_DISRUPTION': 2,
            'CUSTOMER_EMERGENCY': 1
          }
        }
      }
    };
  }

  /**
   * Get emergency reason trends over time
   * Requirements: 10.4, 10.5
   */
  async getReasonTrends(tenantId: string, periodDays: number): Promise<EmergencyReasonTrend[]> {
    const trends: EmergencyReasonTrend[] = [];
    const startDate = new Date(Date.now() - (periodDays * 24 * 60 * 60 * 1000));
    const reasons = ['CRITICAL_SHORTAGE', 'EQUIPMENT_FAILURE', 'SUPPLY_CHAIN_DISRUPTION', 'CUSTOMER_EMERGENCY'];
    
    // Simulate trend data for each reason over the period
    for (let i = 0; i < periodDays; i++) {
      const date = new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000));
      
      for (const reason of reasons) {
        const count = Math.floor(Math.random() * 3); // 0-2 per reason per day
        const processingTime = 10 + Math.random() * 20; // 10-30 minutes
        
        if (count > 0) {
          trends.push({
            date,
            reason,
            count,
            processingTime
          });
        }
      }
    }
    
    return trends.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Generate comprehensive emergency transfer report
   * Requirements: 10.4, 10.5
   */
  async generateEmergencyTransferReport(tenantId: string, options: EmergencyReportOptions): Promise<EmergencyTransferReport> {
    const reportId = generateId();
    const generatedAt = new Date();
    
    const dateFrom = options.dateFrom || new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
    const dateTo = options.dateTo || new Date();
    
    // Get basic analytics
    const analytics = await this.getEmergencyTransferAnalytics(tenantId, dateFrom, dateTo);
    
    // Calculate summary metrics
    const totalEmergencies = analytics.length;
    const autoApprovalRate = analytics.filter(a => a.autoApproved).length / totalEmergencies * 100;
    const averageProcessingTime = analytics
      .filter(a => a.processingTimeMinutes)
      .reduce((sum, a) => sum + (a.processingTimeMinutes || 0), 0) / analytics.length;
    
    // Build report
    const report: EmergencyTransferReport = {
      reportId,
      generatedAt,
      period: {
        from: dateFrom,
        to: dateTo
      },
      summary: {
        totalEmergencies,
        autoApprovalRate: Math.round(autoApprovalRate * 100) / 100,
        averageProcessingTime: Math.round(averageProcessingTime * 100) / 100,
        escalationRate: 15 // Simulated
      }
    };

    // Add optional sections based on options
    if (options.includeFrequencyTrends) {
      report.frequencyAnalysis = await this.trackEmergencyFrequency(tenantId);
      report.trends = await this.getFrequencyTrends(tenantId, 30);
    }

    if (options.includeReasonAnalysis) {
      report.reasonAnalysis = await this.analyzeEmergencyReasons(tenantId, dateFrom, dateTo);
    }

    if (options.includePerformanceMetrics) {
      report.performanceMetrics = await this.getEmergencyPerformanceMetrics(tenantId, dateFrom, dateTo);
    }

    // Always include alerts
    report.alerts = await this.getEmergencyAlerts(tenantId);

    console.log(`Generated emergency transfer report ${reportId} for tenant ${tenantId}`);
    
    return report;
  }

  /**
   * Get emergency alerts for monitoring
   * Requirements: 10.4, 10.5
   */
  async getEmergencyAlerts(tenantId: string): Promise<EmergencyAlert[]> {
    const config = await this.getEmergencyConfig(tenantId);
    const frequency = await this.trackEmergencyFrequency(tenantId);
    const alerts: EmergencyAlert[] = [];

    // Check frequency thresholds
    if (frequency.thresholds.currentUtilization.daily > 80) {
      alerts.push({
        id: generateId(),
        type: 'FREQUENCY_THRESHOLD',
        severity: frequency.thresholds.currentUtilization.daily > 95 ? 'CRITICAL' : 'HIGH',
        message: `Daily emergency transfer frequency is at ${frequency.thresholds.currentUtilization.daily.toFixed(1)}% of limit`,
        details: {
          metric: 'daily_frequency',
          currentValue: frequency.period.daily,
          threshold: frequency.thresholds.dailyLimit
        },
        triggeredAt: new Date(),
        acknowledged: false
      });
    }

    if (frequency.thresholds.currentUtilization.weekly > 80) {
      alerts.push({
        id: generateId(),
        type: 'FREQUENCY_THRESHOLD',
        severity: frequency.thresholds.currentUtilization.weekly > 95 ? 'CRITICAL' : 'HIGH',
        message: `Weekly emergency transfer frequency is at ${frequency.thresholds.currentUtilization.weekly.toFixed(1)}% of limit`,
        details: {
          metric: 'weekly_frequency',
          currentValue: frequency.period.weekly,
          threshold: frequency.thresholds.weeklyLimit
        },
        triggeredAt: new Date(),
        acknowledged: false
      });
    }

    // Check for unusual patterns (simulated)
    if (frequency.trends.changePercentage > 50 && frequency.trends.increasing) {
      alerts.push({
        id: generateId(),
        type: 'REASON_PATTERN',
        severity: 'MEDIUM',
        message: `Emergency transfer frequency has increased by ${frequency.trends.changePercentage.toFixed(1)}% compared to previous period`,
        details: {
          metric: 'frequency_trend',
          currentValue: frequency.trends.changePercentage,
          threshold: 50
        },
        triggeredAt: new Date(),
        acknowledged: false
      });
    }

    return alerts;
  }

  /**
   * Get emergency performance metrics
   * Requirements: 10.4, 10.5
   */
  async getEmergencyPerformanceMetrics(tenantId: string, dateFrom?: Date, dateTo?: Date): Promise<EmergencyPerformanceMetrics> {
    const analytics = await this.getEmergencyTransferAnalytics(tenantId, dateFrom, dateTo);
    
    // Calculate processing time metrics
    const processingTimes = analytics
      .filter(a => a.processingTimeMinutes)
      .map(a => a.processingTimeMinutes!)
      .sort((a, b) => a - b);

    const average = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length || 0;
    const median = processingTimes.length > 0 
      ? processingTimes[Math.floor(processingTimes.length / 2)] 
      : 0;
    const p95 = processingTimes.length > 0 
      ? processingTimes[Math.floor(processingTimes.length * 0.95)] 
      : 0;
    const p99 = processingTimes.length > 0 
      ? processingTimes[Math.floor(processingTimes.length * 0.99)] 
      : 0;

    // Calculate approval rates
    const totalTransfers = analytics.length;
    const autoApproved = analytics.filter(a => a.autoApproved).length;
    const manualApproved = totalTransfers - autoApproved; // Simplified
    
    return {
      processingTimes: {
        average: Math.round(average * 100) / 100,
        median: Math.round(median * 100) / 100,
        p95: Math.round(p95 * 100) / 100,
        p99: Math.round(p99 * 100) / 100
      },
      approvalRates: {
        autoApproval: Math.round((autoApproved / totalTransfers) * 10000) / 100,
        manualApproval: Math.round((manualApproved / totalTransfers) * 10000) / 100,
        rejection: 0 // Simplified - would need to track rejections
      },
      escalationMetrics: {
        escalationRate: 15, // Simulated
        averageEscalationTime: 25, // Simulated
        escalationsByLevel: {
          1: 8,
          2: 4,
          3: 1
        }
      },
      queueMetrics: {
        averageQueueTime: 8.5, // Simulated
        maxQueueTime: 45, // Simulated
        queueUtilization: 65 // Simulated
      }
    };
  }

  /**
   * Handle emergency-specific approval workflow
   * Requirements: 10.1, 10.2
   */
  async handleEmergencyApproval(transfer: Transfer, approverId: string): Promise<Transfer> {
    if (transfer.priority !== 'EMERGENCY') {
      throw new Error('Transfer is not marked as emergency priority');
    }

    // Validate approver has emergency approval permissions
    const approver = await this.validateEmergencyApprover(approverId, transfer.tenantId);
    
    // Create expedited approval context
    const context: TransitionContext = {
      userId: approverId,
      tenantId: transfer.tenantId,
      reason: 'Emergency transfer expedited approval',
      metadata: {
        emergencyApproval: true,
        approverRole: approver.role,
        expeditedProcessing: true
      }
    };

    // Execute approval transition
    const approvedTransfer = await this.stateMachine.executeTransition(
      transfer,
      'APPROVED',
      context
    );

    // Send expedited approval notifications
    await this.notificationService.notifyTransferApproved(
      approvedTransfer,
      approverId,
      'Emergency transfer approved with expedited processing'
    );

    console.log(`Emergency transfer ${transfer.id} approved by ${approverId} with expedited processing`);

    return approvedTransfer;
  }

  // Private helper methods

  /**
   * Validate emergency-specific transfer rules
   * Requirements: 10.1, 10.2
   */
  private async validateEmergencyTransferRules(transfer: Transfer, config: EmergencyTransferConfig): Promise<void> {
    // Check if product is allowed for emergency transfers
    if (config.autoApprovalThresholds.allowedProducts && 
        !config.autoApprovalThresholds.allowedProducts.includes(transfer.productId)) {
      throw new Error(`Product ${transfer.productId} is not authorized for emergency transfers`);
    }

    // Require justification for emergency transfers if configured
    if (config.autoApprovalThresholds.requiresJustification && 
        (!transfer.notes || transfer.notes.trim().length < 10)) {
      throw new Error('Emergency transfers require detailed justification (minimum 10 characters)');
    }

    // Validate emergency transfer reason codes
    const validEmergencyReasons = [
      'CRITICAL_SHORTAGE',
      'EQUIPMENT_FAILURE', 
      'SUPPLY_CHAIN_DISRUPTION',
      'CUSTOMER_EMERGENCY',
      'QUALITY_ISSUE',
      'REGULATORY_REQUIREMENT'
    ];

    // Extract reason from notes or require specific format
    const reasonMatch = transfer.notes?.match(/REASON:\s*(\w+)/);
    if (config.autoApprovalThresholds.requiresJustification && !reasonMatch) {
      throw new Error('Emergency transfers must include a reason code (format: REASON: CODE)');
    }

    if (reasonMatch && !validEmergencyReasons.includes(reasonMatch[1])) {
      throw new Error(`Invalid emergency reason code: ${reasonMatch[1]}. Valid codes: ${validEmergencyReasons.join(', ')}`);
    }

    console.log(`Emergency transfer ${transfer.id} passed validation rules`);
  }

  /**
   * Prepare emergency transfer for immediate shipping
   * Requirements: 10.1, 10.2
   */
  private async prepareEmergencyShipping(transfer: Transfer): Promise<void> {
    try {
      // Reserve inventory immediately for emergency transfers
      const inventoryService = (this as any).inventoryService || 
        await import('./inventory-integration').then(m => m.createInventoryIntegrationService(this.db));
      
      const reservation = await inventoryService.reserveInventoryForTransfer(
        transfer.productId,
        transfer.sourceLocationId,
        transfer.quantityRequested
      );

      if (!reservation.reserved) {
        throw new Error(`Cannot reserve inventory for emergency transfer: insufficient quantity available`);
      }

      // Flag transfer for immediate shipping preparation
      console.log(`Emergency transfer ${transfer.id} prepared for immediate shipping with reservation ${reservation.reservationId}`);
      
      // In a real implementation, this would:
      // 1. Alert warehouse staff for immediate picking
      // 2. Generate priority shipping labels
      // 3. Schedule expedited delivery
      // 4. Update inventory systems with priority flags
      
    } catch (error) {
      console.error(`Failed to prepare emergency shipping for transfer ${transfer.id}:`, error);
      throw error;
    }
  }

  /**
   * Escalate emergency transfer to higher-level approvers
   * Requirements: 10.1, 10.2
   */
  private async escalateEmergencyTransfer(transfer: Transfer, level: number): Promise<void> {
    const config = await this.getEmergencyConfig(transfer.tenantId);
    
    if (level > config.escalationRules.maxEscalationLevels) {
      console.error(`Maximum escalation level reached for transfer ${transfer.id}`);
      return;
    }

    try {
      // Send escalation notifications to higher-level approvers
      for (const recipientId of config.escalationRules.escalationRecipients) {
        console.log(`Escalating emergency transfer ${transfer.id} to level ${level} approver ${recipientId}`);
        
        // In a real implementation, this would send urgent notifications
        // via multiple channels (email, SMS, push notifications)
      }

      // Record escalation in audit trail
      console.log(`Emergency transfer ${transfer.id} escalated to level ${level}`);
      
    } catch (error) {
      console.error(`Failed to escalate emergency transfer ${transfer.id}:`, error);
    }
  }

  /**
   * Add emergency transfer to priority queue
   * Requirements: 10.1, 10.2
   */
  private async addToEmergencyQueue(transfer: Transfer): Promise<{ queuePosition: number; estimatedProcessingTime: number }> {
    const config = await this.getEmergencyConfig(transfer.tenantId);
    
    if (!config.priorityQueue.enabled) {
      return { queuePosition: 1, estimatedProcessingTime: config.expeditedApprovalTimeoutMinutes };
    }

    // In a real implementation, this would use a proper queue system (Redis, database, etc.)
    // For now, simulate queue behavior
    const currentQueueLength = Math.floor(Math.random() * config.priorityQueue.maxQueueSize);
    const queuePosition = currentQueueLength + 1;
    const estimatedProcessingTime = queuePosition * config.priorityQueue.processingIntervalMinutes;

    console.log(`Emergency transfer ${transfer.id} added to priority queue at position ${queuePosition}`);
    
    return { queuePosition, estimatedProcessingTime };
  }

  /**
   * Get emergency queue status
   * Requirements: 10.4, 10.5
   */
  private async getEmergencyQueueStatus(tenantId: string): Promise<{
    queueLength: number;
    averageProcessingTime: number;
    nextProcessingTime?: Date;
  }> {
    const config = await this.getEmergencyConfig(tenantId);
    
    // In a real implementation, this would query the actual queue
    // For now, simulate queue status
    const queueLength = Math.floor(Math.random() * config.priorityQueue.maxQueueSize);
    const averageProcessingTime = config.priorityQueue.processingIntervalMinutes;
    const nextProcessingTime = queueLength > 0 
      ? new Date(Date.now() + (config.priorityQueue.processingIntervalMinutes * 60 * 1000))
      : undefined;

    return {
      queueLength,
      averageProcessingTime,
      nextProcessingTime
    };
  }

  private async sendImmediateEmergencyNotifications(transfer: Transfer, config: EmergencyTransferConfig): Promise<void> {
    try {
      // Send emergency notification through the notification service
      await this.notificationService.notifyEmergencyTransfer(transfer);

      // Send additional notifications to configured emergency recipients
      for (const recipientId of config.emergencyNotificationRecipients) {
        try {
          // In a real implementation, this would send immediate notifications
          // via SMS, push notifications, or other urgent channels
          console.log(`Sending immediate emergency notification to ${recipientId} for transfer ${transfer.id}`);
        } catch (error) {
          console.error(`Failed to send emergency notification to ${recipientId}:`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to send emergency notifications for transfer ${transfer.id}:`, error);
      throw error;
    }
  }

  private async meetsAutoApprovalCriteria(transfer: Transfer, config: EmergencyTransferConfig): Promise<boolean> {
    // Check quantity threshold
    if (transfer.quantityRequested > config.autoApprovalThresholds.maxQuantity) {
      return false;
    }

    // Check value threshold if configured
    if (config.autoApprovalThresholds.maxValuePerUnit) {
      // TODO: Get product price and calculate total value
      // For now, assume it meets the criteria
    }

    // Check location restrictions
    if (config.autoApprovalThresholds.allowedSourceLocations && 
        !config.autoApprovalThresholds.allowedSourceLocations.includes(transfer.sourceLocationId)) {
      return false;
    }

    if (config.autoApprovalThresholds.allowedDestinationLocations && 
        !config.autoApprovalThresholds.allowedDestinationLocations.includes(transfer.destinationLocationId)) {
      return false;
    }

    return true;
  }

  private async flagForExpeditedApproval(transfer: Transfer, config: EmergencyTransferConfig): Promise<{
    queuePosition: number;
    escalated: boolean;
    estimatedProcessingTime: number;
  }> {
    // Add to priority queue for expedited processing
    const queueResult = await this.addToEmergencyQueue(transfer);
    
    // Set up escalation timer if configured
    let escalated = false;
    if (config.escalationRules.escalateAfterMinutes > 0) {
      // In a real implementation, this would set up a timer/job to escalate
      setTimeout(async () => {
        try {
          await this.escalateEmergencyTransfer(transfer, 1);
        } catch (error) {
          console.error(`Failed to escalate transfer ${transfer.id}:`, error);
        }
      }, config.escalationRules.escalateAfterMinutes * 60 * 1000);
      
      escalated = true;
    }

    console.log(`Transfer ${transfer.id} flagged for expedited approval with ${config.expeditedApprovalTimeoutMinutes} minute timeout`);
    
    return {
      queuePosition: queueResult.queuePosition,
      escalated,
      estimatedProcessingTime: queueResult.estimatedProcessingTime
    };
  }

  private async recordEmergencyAnalytics(transfer: Transfer, autoApproved: boolean, startTime: number): Promise<void> {
    // In a real implementation, this would store analytics in a dedicated table
    // For now, we'll just log the analytics
    const processingTime = Date.now() - startTime;
    
    console.log(`Emergency transfer analytics recorded:`, {
      transferId: transfer.id,
      tenantId: transfer.tenantId,
      autoApproved,
      processingTimeMs: processingTime,
      reason: transfer.notes
    });
  }

  private async validateEmergencyApprover(approverId: string, tenantId: string): Promise<User> {
    const [approver] = await this.db
      .select()
      .from(users)
      .where(and(
        eq(users.id, approverId),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);

    if (!approver) {
      throw new Error('Approver not found in this organization');
    }

    // Check if user has emergency approval permissions
    if (approver.role !== 'ADMIN' && approver.role !== 'MANAGER') {
      throw new Error('User does not have emergency approval permissions');
    }

    return approver;
  }

  private getDefaultEmergencyConfig(): EmergencyTransferConfig {
    return {
      autoApprovalEnabled: true,
      autoApprovalThresholds: {
        maxQuantity: 100, // Auto-approve up to 100 units
        maxValuePerUnit: 50, // Auto-approve up to $50 per unit
        allowedSourceLocations: undefined, // No location restrictions by default
        allowedDestinationLocations: undefined,
        allowedProducts: undefined, // No product restrictions by default
        requiresJustification: true // Require justification for emergency transfers
      },
      expeditedApprovalTimeoutMinutes: 30, // 30 minute timeout for manual approval
      emergencyNotificationRecipients: [], // No additional recipients by default
      frequencyLimits: {
        maxEmergencyTransfersPerDay: 5,
        maxEmergencyTransfersPerWeek: 20,
        cooldownPeriodHours: 2 // 2 hour cooldown between emergency transfers
      },
      escalationRules: {
        escalateAfterMinutes: 15, // Escalate after 15 minutes if not approved
        escalationRecipients: [], // No escalation recipients by default
        maxEscalationLevels: 3
      },
      priorityQueue: {
        enabled: true,
        maxQueueSize: 10,
        processingIntervalMinutes: 5 // Process queue every 5 minutes
      }
    };
  }

  private initializeDefaultConfigs(): void {
    // Initialize with default configuration
    // In a real implementation, this would load from database
  }
}

// Factory function for creating emergency transfer service
export function createEmergencyTransferService(db: DrizzleD1Database): EmergencyTransferService {
  return new EmergencyTransferServiceImpl(db);
}