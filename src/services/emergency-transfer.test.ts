import { describe, it, expect, beforeEach, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { createEmergencyTransferService, EmergencyTransferServiceImpl } from './emergency-transfer';
import { Transfer, TransferPriority, TransferStatus } from '../db/schema';

// Mock the database
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
} as any;

// Mock the schema imports to avoid undefined errors
vi.mock('../db/schema', async () => {
  const actual = await vi.importActual('../db/schema');
  return {
    ...actual,
    users: {
      id: 'id',
      tenantId: 'tenant_id',
      role: 'role',
      email: 'email',
    },
  };
});

// Mock transfer for testing
const mockEmergencyTransfer: Transfer = {
  id: 'transfer_emergency_123',
  tenantId: 'tenant_123',
  productId: 'product_123',
  sourceLocationId: 'location_source',
  destinationLocationId: 'location_dest',
  quantityRequested: 50,
  quantityShipped: 0,
  quantityReceived: 0,
  status: 'REQUESTED',
  priority: 'EMERGENCY',
  requestedBy: 'user_123',
  approvedBy: null,
  approvedAt: null,
  shippedBy: null,
  shippedAt: null,
  receivedBy: null,
  receivedAt: null,
  cancelledBy: null,
  cancelledAt: null,
  cancellationReason: null,
  varianceReason: null,
  notes: 'Critical inventory shortage - need immediate transfer',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('EmergencyTransferService', () => {
  let emergencyService: EmergencyTransferServiceImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    emergencyService = new EmergencyTransferServiceImpl(mockDb);
  });

  describe('processEmergencyTransfer', () => {
    it('should process emergency transfer with expedited workflow', async () => {
      // Mock the dependencies
      vi.spyOn(emergencyService, 'getEmergencyConfig').mockResolvedValue({
        autoApprovalEnabled: true,
        autoApprovalThresholds: {
          maxQuantity: 100,
          maxValuePerUnit: 50,
          allowedProducts: undefined,
          requiresJustification: false,
        },
        expeditedApprovalTimeoutMinutes: 30,
        emergencyNotificationRecipients: ['admin_123'],
        frequencyLimits: {
          maxEmergencyTransfersPerDay: 5,
          maxEmergencyTransfersPerWeek: 20,
          cooldownPeriodHours: 2,
        },
        escalationRules: {
          escalateAfterMinutes: 15,
          escalationRecipients: [],
          maxEscalationLevels: 3,
        },
        priorityQueue: {
          enabled: true,
          maxQueueSize: 10,
          processingIntervalMinutes: 5,
        },
      });

      vi.spyOn(emergencyService, 'canCreateEmergencyTransfer').mockResolvedValue({
        allowed: true,
      });

      // Mock private methods
      const sendNotificationsSpy = vi.spyOn(emergencyService as any, 'sendImmediateEmergencyNotifications')
        .mockResolvedValue(undefined);
      const meetsAutoApprovalSpy = vi.spyOn(emergencyService as any, 'meetsAutoApprovalCriteria')
        .mockResolvedValue(true);
      const recordAnalyticsSpy = vi.spyOn(emergencyService as any, 'recordEmergencyAnalytics')
        .mockResolvedValue(undefined);
      const prepareShippingSpy = vi.spyOn(emergencyService as any, 'prepareEmergencyShipping')
        .mockResolvedValue(undefined);

      // Mock state machine
      const mockStateMachine = {
        executeTransition: vi.fn().mockResolvedValue({
          ...mockEmergencyTransfer,
          status: 'APPROVED',
          approvedBy: 'system_emergency_auto_approval',
          approvedAt: Date.now(),
        }),
      };
      (emergencyService as any).stateMachine = mockStateMachine;

      const result = await emergencyService.processEmergencyTransfer(mockEmergencyTransfer);

      expect(result.autoApproved).toBe(true);
      expect(result.expedited).toBe(true);
      expect(result.notificationsSent).toBe(true);
      expect(result.processingTimeMinutes).toBeGreaterThan(0);

      expect(sendNotificationsSpy).toHaveBeenCalledWith(mockEmergencyTransfer, expect.any(Object));
      expect(meetsAutoApprovalSpy).toHaveBeenCalledWith(mockEmergencyTransfer, expect.any(Object));
      expect(mockStateMachine.executeTransition).toHaveBeenCalledWith(
        mockEmergencyTransfer,
        'APPROVED',
        expect.objectContaining({
          userId: 'system_emergency_auto_approval',
          tenantId: mockEmergencyTransfer.tenantId,
          reason: 'Auto-approved emergency transfer based on configuration',
          metadata: expect.objectContaining({
            autoApproved: true,
            emergencyProcessing: true,
            expeditedWorkflow: true,
          }),
        })
      );
      expect(prepareShippingSpy).toHaveBeenCalled();
      expect(recordAnalyticsSpy).toHaveBeenCalled();
    });

    it('should reject non-emergency transfers', async () => {
      const normalTransfer = {
        ...mockEmergencyTransfer,
        priority: 'NORMAL',
      };

      await expect(emergencyService.processEmergencyTransfer(normalTransfer))
        .rejects.toThrow('Transfer is not marked as emergency priority');
    });

    it('should handle frequency limits', async () => {
      vi.spyOn(emergencyService, 'canCreateEmergencyTransfer').mockResolvedValue({
        allowed: false,
        reason: 'Daily emergency transfer limit exceeded',
        frequencyLimitExceeded: true,
      });

      await expect(emergencyService.processEmergencyTransfer(mockEmergencyTransfer))
        .rejects.toThrow('Emergency transfer not allowed: Daily emergency transfer limit exceeded');
    });
  });

  describe('canCreateEmergencyTransfer', () => {
    it('should allow emergency transfer when within limits', async () => {
      vi.spyOn(emergencyService, 'getEmergencyConfig').mockResolvedValue({
        autoApprovalEnabled: true,
        autoApprovalThresholds: {
          maxQuantity: 100,
        },
        expeditedApprovalTimeoutMinutes: 30,
        emergencyNotificationRecipients: [],
        frequencyLimits: {
          maxEmergencyTransfersPerDay: 5,
          maxEmergencyTransfersPerWeek: 20,
          cooldownPeriodHours: 2,
        },
      });

      vi.spyOn(emergencyService, 'getEmergencyFrequency').mockResolvedValue({
        dailyCount: 2,
        weeklyCount: 8,
        monthlyCount: 15,
        lastEmergencyTransfer: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      });

      const result = await emergencyService.canCreateEmergencyTransfer(
        'tenant_123',
        'location_source',
        'location_dest'
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject when daily limit exceeded', async () => {
      vi.spyOn(emergencyService, 'getEmergencyConfig').mockResolvedValue({
        autoApprovalEnabled: true,
        autoApprovalThresholds: {
          maxQuantity: 100,
        },
        expeditedApprovalTimeoutMinutes: 30,
        emergencyNotificationRecipients: [],
        frequencyLimits: {
          maxEmergencyTransfersPerDay: 5,
          maxEmergencyTransfersPerWeek: 20,
          cooldownPeriodHours: 2,
        },
      });

      vi.spyOn(emergencyService, 'getEmergencyFrequency').mockResolvedValue({
        dailyCount: 5, // At limit
        weeklyCount: 15,
        monthlyCount: 25,
      });

      const result = await emergencyService.canCreateEmergencyTransfer(
        'tenant_123',
        'location_source',
        'location_dest'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Daily emergency transfer limit exceeded');
      expect(result.frequencyLimitExceeded).toBe(true);
    });

    it('should reject when in cooldown period', async () => {
      vi.spyOn(emergencyService, 'getEmergencyConfig').mockResolvedValue({
        autoApprovalEnabled: true,
        autoApprovalThresholds: {
          maxQuantity: 100,
        },
        expeditedApprovalTimeoutMinutes: 30,
        emergencyNotificationRecipients: [],
        frequencyLimits: {
          maxEmergencyTransfersPerDay: 5,
          maxEmergencyTransfersPerWeek: 20,
          cooldownPeriodHours: 2,
        },
      });

      vi.spyOn(emergencyService, 'getEmergencyFrequency').mockResolvedValue({
        dailyCount: 2,
        weeklyCount: 8,
        monthlyCount: 15,
        lastEmergencyTransfer: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      });

      const result = await emergencyService.canCreateEmergencyTransfer(
        'tenant_123',
        'location_source',
        'location_dest'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Emergency transfer cooldown active');
      expect(result.cooldownActive).toBe(true);
    });
  });

  describe('handleEmergencyApproval', () => {
    it('should handle expedited approval for emergency transfers', async () => {
      // Mock user validation
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'user_123',
              tenantId: 'tenant_123',
              role: 'MANAGER',
              email: 'manager@test.com',
            }]),
          }),
        }),
      });

      // Mock state machine
      const mockStateMachine = {
        executeTransition: vi.fn().mockResolvedValue({
          ...mockEmergencyTransfer,
          status: 'APPROVED',
          approvedBy: 'user_123',
          approvedAt: Date.now(),
        }),
      };
      (emergencyService as any).stateMachine = mockStateMachine;

      // Mock notification service
      const mockNotificationService = {
        notifyTransferApproved: vi.fn().mockResolvedValue(undefined),
      };
      (emergencyService as any).notificationService = mockNotificationService;

      const result = await emergencyService.handleEmergencyApproval(mockEmergencyTransfer, 'user_123');

      expect(result.status).toBe('APPROVED');
      expect(result.approvedBy).toBe('user_123');
      expect(mockStateMachine.executeTransition).toHaveBeenCalledWith(
        mockEmergencyTransfer,
        'APPROVED',
        expect.objectContaining({
          userId: 'user_123',
          tenantId: mockEmergencyTransfer.tenantId,
          reason: 'Emergency transfer expedited approval',
          metadata: expect.objectContaining({
            emergencyApproval: true,
            expeditedProcessing: true,
          }),
        })
      );
      expect(mockNotificationService.notifyTransferApproved).toHaveBeenCalled();
    });

    it('should reject approval for non-emergency transfers', async () => {
      const normalTransfer = {
        ...mockEmergencyTransfer,
        priority: 'NORMAL',
      };

      await expect(emergencyService.handleEmergencyApproval(normalTransfer, 'user_123'))
        .rejects.toThrow('Transfer is not marked as emergency priority');
    });
  });

  describe('configuration management', () => {
    it('should get default emergency configuration', async () => {
      const config = await emergencyService.getEmergencyConfig('tenant_123');

      expect(config).toEqual({
        autoApprovalEnabled: true,
        autoApprovalThresholds: {
          maxQuantity: 100,
          maxValuePerUnit: 50,
          allowedSourceLocations: undefined,
          allowedDestinationLocations: undefined,
          allowedProducts: undefined,
          requiresJustification: true,
        },
        expeditedApprovalTimeoutMinutes: 30,
        emergencyNotificationRecipients: [],
        frequencyLimits: {
          maxEmergencyTransfersPerDay: 5,
          maxEmergencyTransfersPerWeek: 20,
          cooldownPeriodHours: 2,
        },
        escalationRules: {
          escalateAfterMinutes: 15,
          escalationRecipients: [],
          maxEscalationLevels: 3,
        },
        priorityQueue: {
          enabled: true,
          maxQueueSize: 10,
          processingIntervalMinutes: 5,
        },
      });
    });

    it('should update emergency configuration', async () => {
      const updates = {
        autoApprovalEnabled: false,
        frequencyLimits: {
          maxEmergencyTransfersPerDay: 3,
        },
      };

      const updatedConfig = await emergencyService.updateEmergencyConfig('tenant_123', updates);

      expect(updatedConfig.autoApprovalEnabled).toBe(false);
      expect(updatedConfig.frequencyLimits.maxEmergencyTransfersPerDay).toBe(3);
      expect(updatedConfig.frequencyLimits.maxEmergencyTransfersPerWeek).toBe(20); // Should preserve existing values
    });
  });
});