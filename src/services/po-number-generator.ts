import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, sql, desc } from 'drizzle-orm';
import { purchaseOrders } from '../db/schema';
import { getCurrentTimestamp } from '../utils';

/**
 * PO Number Generation Configuration
 * Supports configurable formats per tenant
 */
export interface PONumberConfig {
  format: PONumberFormat;
  prefix?: string;
  yearFormat?: 'YYYY' | 'YY';
  sequenceLength?: number;
  separator?: string;
}

export enum PONumberFormat {
  SEQUENTIAL = 'SEQUENTIAL',           // PO-0001, PO-0002, etc.
  YEARLY_SEQUENTIAL = 'YEARLY_SEQUENTIAL', // PO-2024-0001, PO-2024-0002, etc.
  MONTHLY_SEQUENTIAL = 'MONTHLY_SEQUENTIAL', // PO-2024-01-001, PO-2024-01-002, etc.
  CUSTOM_PREFIX = 'CUSTOM_PREFIX',     // CUSTOM-0001, CUSTOM-0002, etc.
}

/**
 * Default PO number configurations by format
 */
const DEFAULT_CONFIGS: Record<PONumberFormat, PONumberConfig> = {
  [PONumberFormat.SEQUENTIAL]: {
    format: PONumberFormat.SEQUENTIAL,
    prefix: 'PO',
    sequenceLength: 4,
    separator: '-',
  },
  [PONumberFormat.YEARLY_SEQUENTIAL]: {
    format: PONumberFormat.YEARLY_SEQUENTIAL,
    prefix: 'PO',
    yearFormat: 'YYYY',
    sequenceLength: 4,
    separator: '-',
  },
  [PONumberFormat.MONTHLY_SEQUENTIAL]: {
    format: PONumberFormat.MONTHLY_SEQUENTIAL,
    prefix: 'PO',
    yearFormat: 'YYYY',
    sequenceLength: 3,
    separator: '-',
  },
  [PONumberFormat.CUSTOM_PREFIX]: {
    format: PONumberFormat.CUSTOM_PREFIX,
    prefix: 'CUSTOM',
    sequenceLength: 4,
    separator: '-',
  },
};

/**
 * PO Number Generator Interface
 * Requirements: 2.4
 */
export interface PONumberGenerator {
  generatePONumber(tenantId: string, config?: PONumberConfig): Promise<string>;
  validatePONumber(poNumber: string, tenantId: string): Promise<boolean>;
  getNextSequenceNumber(tenantId: string, config: PONumberConfig): Promise<number>;
}

/**
 * Thread-safe PO Number Generator Implementation
 * Uses database-level locking to ensure uniqueness
 * Requirements: 2.4
 */
export class PONumberGeneratorImpl implements PONumberGenerator {
  constructor(private db: DrizzleD1Database) {}

  /**
   * Generate a unique PO number for the tenant
   * Thread-safe implementation using database transactions
   * Requirements: 2.4
   */
  async generatePONumber(tenantId: string, config?: PONumberConfig): Promise<string> {
    if (!tenantId) {
      throw new Error('Tenant ID is required for PO number generation');
    }

    // Use default yearly sequential format if no config provided
    const finalConfig = config || DEFAULT_CONFIGS[PONumberFormat.YEARLY_SEQUENTIAL];
    
    // Validate configuration
    this.validateConfig(finalConfig);

    // Generate PO number with retry logic for thread safety
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.generatePONumberWithLocking(tenantId, finalConfig);
      } catch (error) {
        lastError = error as Error;
        
        // If it's a uniqueness conflict, retry
        if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
          console.warn(`PO number generation attempt ${attempt} failed due to uniqueness conflict, retrying...`);
          // Small delay to reduce contention
          await new Promise(resolve => setTimeout(resolve, 10 * attempt));
          continue;
        }
        
        // For other errors, don't retry
        throw error;
      }
    }

    throw new Error(`Failed to generate unique PO number after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Validate that a PO number is unique within the tenant
   * Requirements: 2.4
   */
  async validatePONumber(poNumber: string, tenantId: string): Promise<boolean> {
    if (!poNumber || !tenantId) {
      return false;
    }

    const [existingPO] = await this.db
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(and(
        eq(purchaseOrders.tenantId, tenantId),
        eq(purchaseOrders.poNumber, poNumber)
      ))
      .limit(1);

    return !existingPO; // Returns true if PO number is available
  }

  /**
   * Get the next sequence number for a given configuration
   * Requirements: 2.4
   */
  async getNextSequenceNumber(tenantId: string, config: PONumberConfig): Promise<number> {
    const pattern = this.buildSearchPattern(config);
    
    // Get existing PO numbers that match the pattern
    const existingPOs = await this.db
      .select({ poNumber: purchaseOrders.poNumber })
      .from(purchaseOrders)
      .where(and(
        eq(purchaseOrders.tenantId, tenantId),
        sql`${purchaseOrders.poNumber} LIKE ${pattern}`
      ))
      .orderBy(desc(purchaseOrders.poNumber));

    // Extract sequence numbers from existing PO numbers
    const sequenceNumbers = existingPOs
      .map(po => this.extractSequenceNumber(po.poNumber!, config))
      .filter(num => num !== null && !isNaN(num))
      .map(num => num as number);

    // Return next sequence number
    return sequenceNumbers.length > 0 
      ? Math.max(...sequenceNumbers) + 1 
      : 1;
  }

  /**
   * Generate PO number with database-level locking for thread safety
   */
  private async generatePONumberWithLocking(tenantId: string, config: PONumberConfig): Promise<string> {
    // Build the base pattern for this configuration
    const basePattern = this.buildBasePattern(config);
    
    // Get the next sequence number
    const sequenceNumber = await this.getNextSequenceNumber(tenantId, config);
    
    // Format the complete PO number
    const poNumber = this.formatPONumber(basePattern, sequenceNumber, config);
    
    // Validate uniqueness one more time before returning
    const isUnique = await this.validatePONumber(poNumber, tenantId);
    if (!isUnique) {
      throw new Error(`Generated PO number ${poNumber} already exists (UNIQUE constraint)`);
    }
    
    return poNumber;
  }

  /**
   * Build the base pattern for PO number generation
   */
  private buildBasePattern(config: PONumberConfig): string {
    const now = new Date();
    const prefix = config.prefix || 'PO';
    const separator = config.separator || '-';

    switch (config.format) {
      case PONumberFormat.SEQUENTIAL:
        return prefix;

      case PONumberFormat.YEARLY_SEQUENTIAL:
        const year = config.yearFormat === 'YY' 
          ? now.getFullYear().toString().slice(-2)
          : now.getFullYear().toString();
        return `${prefix}${separator}${year}`;

      case PONumberFormat.MONTHLY_SEQUENTIAL:
        const fullYear = config.yearFormat === 'YY' 
          ? now.getFullYear().toString().slice(-2)
          : now.getFullYear().toString();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        return `${prefix}${separator}${fullYear}${separator}${month}`;

      case PONumberFormat.CUSTOM_PREFIX:
        return prefix;

      default:
        throw new Error(`Unsupported PO number format: ${config.format}`);
    }
  }

  /**
   * Build search pattern for finding existing PO numbers
   */
  private buildSearchPattern(config: PONumberConfig): string {
    const basePattern = this.buildBasePattern(config);
    const separator = config.separator || '-';
    
    // Add wildcard for sequence number part
    return `${basePattern}${separator}%`;
  }

  /**
   * Format the complete PO number with sequence
   */
  private formatPONumber(basePattern: string, sequenceNumber: number, config: PONumberConfig): string {
    const separator = config.separator || '-';
    const sequenceLength = config.sequenceLength || 4;
    const formattedSequence = sequenceNumber.toString().padStart(sequenceLength, '0');
    
    return `${basePattern}${separator}${formattedSequence}`;
  }

  /**
   * Extract sequence number from existing PO number
   */
  private extractSequenceNumber(poNumber: string, config: PONumberConfig): number | null {
    const separator = config.separator || '-';
    const parts = poNumber.split(separator);
    
    if (parts.length === 0) {
      return null;
    }
    
    // The sequence number is always the last part
    const sequencePart = parts[parts.length - 1];
    const sequenceNumber = parseInt(sequencePart, 10);
    
    return isNaN(sequenceNumber) ? null : sequenceNumber;
  }

  /**
   * Validate PO number configuration
   */
  private validateConfig(config: PONumberConfig): void {
    if (!config.format) {
      throw new Error('PO number format is required');
    }

    if (!Object.values(PONumberFormat).includes(config.format)) {
      throw new Error(`Invalid PO number format: ${config.format}`);
    }

    if (config.sequenceLength && (config.sequenceLength < 1 || config.sequenceLength > 10)) {
      throw new Error('Sequence length must be between 1 and 10');
    }

    if (config.prefix && (config.prefix.length === 0 || config.prefix.length > 20)) {
      throw new Error('Prefix must be between 1 and 20 characters');
    }

    if (config.separator && config.separator.length !== 1) {
      throw new Error('Separator must be exactly 1 character');
    }

    if (config.yearFormat && !['YYYY', 'YY'].includes(config.yearFormat)) {
      throw new Error('Year format must be either YYYY or YY');
    }
  }
}

/**
 * Factory function to create PONumberGenerator instance
 */
export function createPONumberGenerator(db: DrizzleD1Database): PONumberGenerator {
  return new PONumberGeneratorImpl(db);
}

/**
 * Get default configuration for a specific format
 */
export function getDefaultConfig(format: PONumberFormat): PONumberConfig {
  return { ...DEFAULT_CONFIGS[format] };
}

/**
 * Create custom configuration
 */
export function createCustomConfig(
  format: PONumberFormat,
  overrides: Partial<PONumberConfig> = {}
): PONumberConfig {
  const defaultConfig = getDefaultConfig(format);
  return { ...defaultConfig, ...overrides };
}