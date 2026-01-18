import { describe, it, expect, beforeEach } from 'vitest';
import { createTransferIntelligenceService } from './transfer-intelligence';
import { createTransferService } from './transfer';

// Mock database for testing
const mockDb = {} as any;

describe('TransferIntelligenceService', () => {
  let intelligenceService: any;
  let transferService: any;

  beforeEach(() => {
    transferService = createTransferService(mockDb);
    intelligenceService = createTransferIntelligenceService(mockDb, transferService);
  });

  describe('Service Creation', () => {
    it('should create transfer intelligence service successfully', () => {
      expect(intelligenceService).toBeDefined();
      expect(typeof intelligenceService.generatePredictiveTransferSuggestions).toBe('function');
      expect(typeof intelligenceService.analyzeTransferPatterns).toBe('function');
      expect(typeof intelligenceService.createReorderPoint).toBe('function');
      expect(typeof intelligenceService.updateReorderPoint).toBe('function');
      expect(typeof intelligenceService.checkAutomatedReorderTriggers).toBe('function');
      expect(typeof intelligenceService.executeAutomatedTransfer).toBe('function');
      expect(typeof intelligenceService.generateDemandForecast).toBe('function');
      expect(typeof intelligenceService.getTransferRecommendations).toBe('function');
      expect(typeof intelligenceService.learnFromTransferOutcomes).toBe('function');
    });
  });

  describe('Predictive Transfer Suggestions', () => {
    it('should validate location ID for suggestions', async () => {
      await expect(
        intelligenceService.generatePredictiveTransferSuggestions('', 'tenant1')
      ).rejects.toThrow('Location ID is required');
    });
  });

  describe('Reorder Points', () => {
    it('should validate required fields for reorder point creation', async () => {
      const invalidReorderPoint = {
        productId: '',
        locationId: '',
        minimumStock: -1,
        reorderQuantity: 0,
        leadTimeDays: 3,
        safetyStock: 5,
        isActive: true,
        createdBy: 'user1'
      };

      await expect(
        intelligenceService.createReorderPoint(invalidReorderPoint, 'tenant1')
      ).rejects.toThrow('Product ID, location ID, non-negative minimum stock, and positive reorder quantity are required');
    });

    it('should validate positive reorder quantity', async () => {
      const invalidReorderPoint = {
        productId: 'prod1',
        locationId: 'loc1',
        minimumStock: 10,
        reorderQuantity: -5,
        leadTimeDays: 3,
        safetyStock: 5,
        isActive: true,
        createdBy: 'user1'
      };

      await expect(
        intelligenceService.createReorderPoint(invalidReorderPoint, 'tenant1')
      ).rejects.toThrow('Product ID, location ID, non-negative minimum stock, and positive reorder quantity are required');
    });

    it('should validate reorder point ID for updates', async () => {
      await expect(
        intelligenceService.updateReorderPoint('', {}, 'tenant1')
      ).rejects.toThrow('Reorder point ID is required');
    });
  });

  describe('Automated Transfer Triggers', () => {
    it('should validate trigger ID for execution', async () => {
      await expect(
        intelligenceService.executeAutomatedTransfer('', 'tenant1', 'user1')
      ).rejects.toThrow('Trigger ID is required');
    });
  });

  describe('Demand Forecasting', () => {
    it('should validate product and location IDs for demand forecast', async () => {
      await expect(
        intelligenceService.generateDemandForecast('', '', 'tenant1')
      ).rejects.toThrow('Product ID and location ID are required');
    });

    it('should validate product ID for demand forecast', async () => {
      await expect(
        intelligenceService.generateDemandForecast('', 'loc1', 'tenant1')
      ).rejects.toThrow('Product ID and location ID are required');
    });

    it('should validate location ID for demand forecast', async () => {
      await expect(
        intelligenceService.generateDemandForecast('prod1', '', 'tenant1')
      ).rejects.toThrow('Product ID and location ID are required');
    });
  });

  describe('Transfer Recommendations', () => {
    it('should validate location ID for recommendations', async () => {
      await expect(
        intelligenceService.getTransferRecommendations('', 'tenant1')
      ).rejects.toThrow('Location ID is required');
    });
  });
});