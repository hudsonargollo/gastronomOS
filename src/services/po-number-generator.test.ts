import { describe, it, expect } from 'vitest';
import { 
  PONumberFormat, 
  PONumberConfig,
  getDefaultConfig,
  createCustomConfig
} from './po-number-generator';

describe('PONumberGenerator Configuration', () => {
  describe('Configuration Management', () => {
    it('should provide default configurations for all formats', () => {
      const sequentialConfig = getDefaultConfig(PONumberFormat.SEQUENTIAL);
      expect(sequentialConfig.format).toBe(PONumberFormat.SEQUENTIAL);
      expect(sequentialConfig.prefix).toBe('PO');
      expect(sequentialConfig.sequenceLength).toBe(4);
      expect(sequentialConfig.separator).toBe('-');

      const yearlyConfig = getDefaultConfig(PONumberFormat.YEARLY_SEQUENTIAL);
      expect(yearlyConfig.format).toBe(PONumberFormat.YEARLY_SEQUENTIAL);
      expect(yearlyConfig.yearFormat).toBe('YYYY');
      expect(yearlyConfig.sequenceLength).toBe(4);

      const monthlyConfig = getDefaultConfig(PONumberFormat.MONTHLY_SEQUENTIAL);
      expect(monthlyConfig.format).toBe(PONumberFormat.MONTHLY_SEQUENTIAL);
      expect(monthlyConfig.yearFormat).toBe('YYYY');
      expect(monthlyConfig.sequenceLength).toBe(3);

      const customConfig = getDefaultConfig(PONumberFormat.CUSTOM_PREFIX);
      expect(customConfig.format).toBe(PONumberFormat.CUSTOM_PREFIX);
      expect(customConfig.prefix).toBe('CUSTOM');
    });

    it('should create custom configurations with overrides', () => {
      const customConfig = createCustomConfig(PONumberFormat.YEARLY_SEQUENTIAL, {
        prefix: 'ORDER',
        sequenceLength: 6,
        separator: '_'
      });

      expect(customConfig.prefix).toBe('ORDER');
      expect(customConfig.sequenceLength).toBe(6);
      expect(customConfig.separator).toBe('_');
      expect(customConfig.yearFormat).toBe('YYYY'); // Should keep default
      expect(customConfig.format).toBe(PONumberFormat.YEARLY_SEQUENTIAL);
    });

    it('should handle all supported formats', () => {
      const formats = [
        PONumberFormat.SEQUENTIAL,
        PONumberFormat.YEARLY_SEQUENTIAL,
        PONumberFormat.MONTHLY_SEQUENTIAL,
        PONumberFormat.CUSTOM_PREFIX
      ];

      formats.forEach(format => {
        const config = getDefaultConfig(format);
        expect(config.format).toBe(format);
        expect(config.prefix).toBeDefined();
        expect(config.sequenceLength).toBeGreaterThan(0);
        expect(config.separator).toBeDefined();
      });
    });

    it('should preserve all properties when creating custom configs', () => {
      const baseConfig = getDefaultConfig(PONumberFormat.MONTHLY_SEQUENTIAL);
      const customConfig = createCustomConfig(PONumberFormat.MONTHLY_SEQUENTIAL, {
        prefix: 'MONTHLY'
      });

      expect(customConfig.format).toBe(baseConfig.format);
      expect(customConfig.yearFormat).toBe(baseConfig.yearFormat);
      expect(customConfig.sequenceLength).toBe(baseConfig.sequenceLength);
      expect(customConfig.separator).toBe(baseConfig.separator);
      expect(customConfig.prefix).toBe('MONTHLY'); // Override
    });
  });

  describe('Format Validation', () => {
    it('should validate enum values', () => {
      const validFormats = Object.values(PONumberFormat);
      expect(validFormats).toContain(PONumberFormat.SEQUENTIAL);
      expect(validFormats).toContain(PONumberFormat.YEARLY_SEQUENTIAL);
      expect(validFormats).toContain(PONumberFormat.MONTHLY_SEQUENTIAL);
      expect(validFormats).toContain(PONumberFormat.CUSTOM_PREFIX);
    });

    it('should have consistent default values', () => {
      const configs = Object.values(PONumberFormat).map(format => getDefaultConfig(format));
      
      configs.forEach(config => {
        expect(config.prefix).toBeTruthy();
        expect(config.sequenceLength).toBeGreaterThan(0);
        expect(config.sequenceLength).toBeLessThanOrEqual(10);
        expect(config.separator).toBeTruthy();
        expect(config.separator).toHaveLength(1);
      });
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle year format variations', () => {
      const config2Digit = createCustomConfig(PONumberFormat.YEARLY_SEQUENTIAL, {
        yearFormat: 'YY'
      });
      const config4Digit = createCustomConfig(PONumberFormat.YEARLY_SEQUENTIAL, {
        yearFormat: 'YYYY'
      });

      expect(config2Digit.yearFormat).toBe('YY');
      expect(config4Digit.yearFormat).toBe('YYYY');
    });

    it('should handle different separators', () => {
      const dashConfig = createCustomConfig(PONumberFormat.SEQUENTIAL, { separator: '-' });
      const underscoreConfig = createCustomConfig(PONumberFormat.SEQUENTIAL, { separator: '_' });
      const dotConfig = createCustomConfig(PONumberFormat.SEQUENTIAL, { separator: '.' });

      expect(dashConfig.separator).toBe('-');
      expect(underscoreConfig.separator).toBe('_');
      expect(dotConfig.separator).toBe('.');
    });

    it('should handle different sequence lengths', () => {
      const shortConfig = createCustomConfig(PONumberFormat.SEQUENTIAL, { sequenceLength: 2 });
      const longConfig = createCustomConfig(PONumberFormat.SEQUENTIAL, { sequenceLength: 8 });

      expect(shortConfig.sequenceLength).toBe(2);
      expect(longConfig.sequenceLength).toBe(8);
    });
  });
});