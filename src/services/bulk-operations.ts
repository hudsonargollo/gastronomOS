import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { createErrorResponse, createSuccessResponse } from '../utils';

/**
 * Bulk Operations Service
 * Requirements: 9.2, 9.3, 9.4
 */

export interface BulkOperationResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: Array<{
    id: string;
    error: string;
  }>;
  results?: any[];
}

export interface BulkDeleteOptions {
  ids: string[];
  tenantId: string;
  softDelete?: boolean;
  cascade?: boolean;
}

export interface BulkUpdateOptions {
  ids: string[];
  updates: Record<string, any>;
  tenantId: string;
  validateEach?: boolean;
}

export interface BulkImportOptions {
  data: any[];
  tenantId: string;
  validateEach?: boolean;
  skipDuplicates?: boolean;
  updateOnConflict?: boolean;
}

/**
 * Bulk operation validation schemas
 */
export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one ID is required').max(1000, 'Cannot delete more than 1000 items at once'),
  softDelete: z.boolean().default(true),
  cascade: z.boolean().default(false),
});

export const bulkUpdateSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one ID is required').max(1000, 'Cannot update more than 1000 items at once'),
  updates: z.record(z.any()).refine(obj => Object.keys(obj).length > 0, 'At least one field must be updated'),
  validateEach: z.boolean().default(true),
});

export const bulkImportSchema = z.object({
  data: z.array(z.record(z.any())).min(1, 'At least one item is required').max(10000, 'Cannot import more than 10000 items at once'),
  skipDuplicates: z.boolean().default(false),
  updateOnConflict: z.boolean().default(false),
  validateEach: z.boolean().default(true),
});

/**
 * Bulk Operations Service
 */
export class BulkOperationsService {
  /**
   * Bulk delete records with comprehensive error handling
   */
  static async bulkDelete(
    db: any,
    table: SQLiteTable,
    options: BulkDeleteOptions,
    auditService?: any
  ): Promise<BulkOperationResult> {
    const { ids, tenantId, softDelete = true, cascade = false } = options;
    const errors: Array<{ id: string; error: string }> = [];
    let processed = 0;

    try {
      // Validate all IDs exist and belong to tenant
      const existingRecords = await db
        .select()
        .from(table)
        .where(
          and(
            inArray(table.id, ids),
            eq(table.tenantId, tenantId)
          )
        );

      const existingIds = existingRecords.map((record: any) => record.id);
      const missingIds = ids.filter(id => !existingIds.includes(id));

      // Add errors for missing IDs
      missingIds.forEach(id => {
        errors.push({ id, error: 'Record not found or access denied' });
      });

      if (existingIds.length === 0) {
        return {
          success: false,
          processed: 0,
          failed: ids.length,
          errors,
        };
      }

      // Perform bulk delete operation
      if (softDelete && 'active' in table) {
        // Soft delete by setting active = false
        await db
          .update(table)
          .set({
            active: false,
            updatedAt: Date.now(),
          })
          .where(
            and(
              inArray(table.id, existingIds),
              eq(table.tenantId, tenantId)
            )
          );
      } else {
        // Hard delete
        await db
          .delete(table)
          .where(
            and(
              inArray(table.id, existingIds),
              eq(table.tenantId, tenantId)
            )
          );
      }

      processed = existingIds.length;

      // Log audit trail
      if (auditService) {
        await auditService.logBulkOperation('BULK_DELETE', {
          table: table._.name,
          tenantId,
          recordIds: existingIds,
          softDelete,
          cascade,
          processed,
          failed: errors.length,
        });
      }

      return {
        success: errors.length === 0,
        processed,
        failed: errors.length,
        errors,
      };
    } catch (error) {
      console.error('Bulk delete error:', error);
      
      // Add error for all IDs if operation failed completely
      ids.forEach(id => {
        if (!errors.find(e => e.id === id)) {
          errors.push({ 
            id, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });

      return {
        success: false,
        processed,
        failed: ids.length,
        errors,
      };
    }
  }

  /**
   * Bulk update records with validation
   */
  static async bulkUpdate(
    db: any,
    table: SQLiteTable,
    options: BulkUpdateOptions,
    validationSchema?: z.ZodSchema,
    auditService?: any
  ): Promise<BulkOperationResult> {
    const { ids, updates, tenantId, validateEach = true } = options;
    const errors: Array<{ id: string; error: string }> = [];
    let processed = 0;

    try {
      // Validate updates schema if provided
      if (validationSchema && validateEach) {
        try {
          validationSchema.parse(updates);
        } catch (validationError) {
          if (validationError instanceof z.ZodError) {
            const validationMessage = validationError.errors
              .map(e => `${e.path.join('.')}: ${e.message}`)
              .join(', ');
            
            ids.forEach(id => {
              errors.push({ id, error: `Validation error: ${validationMessage}` });
            });

            return {
              success: false,
              processed: 0,
              failed: ids.length,
              errors,
            };
          }
        }
      }

      // Validate all IDs exist and belong to tenant
      const existingRecords = await db
        .select()
        .from(table)
        .where(
          and(
            inArray(table.id, ids),
            eq(table.tenantId, tenantId)
          )
        );

      const existingIds = existingRecords.map((record: any) => record.id);
      const missingIds = ids.filter(id => !existingIds.includes(id));

      // Add errors for missing IDs
      missingIds.forEach(id => {
        errors.push({ id, error: 'Record not found or access denied' });
      });

      if (existingIds.length === 0) {
        return {
          success: false,
          processed: 0,
          failed: ids.length,
          errors,
        };
      }

      // Prepare update data
      const updateData = {
        ...updates,
        updatedAt: Date.now(),
      };

      // Perform bulk update
      await db
        .update(table)
        .set(updateData)
        .where(
          and(
            inArray(table.id, existingIds),
            eq(table.tenantId, tenantId)
          )
        );

      processed = existingIds.length;

      // Log audit trail
      if (auditService) {
        await auditService.logBulkOperation('BULK_UPDATE', {
          table: table._.name,
          tenantId,
          recordIds: existingIds,
          updates: updateData,
          processed,
          failed: errors.length,
        });
      }

      return {
        success: errors.length === 0,
        processed,
        failed: errors.length,
        errors,
      };
    } catch (error) {
      console.error('Bulk update error:', error);
      
      // Add error for all IDs if operation failed completely
      ids.forEach(id => {
        if (!errors.find(e => e.id === id)) {
          errors.push({ 
            id, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      });

      return {
        success: false,
        processed,
        failed: ids.length,
        errors,
      };
    }
  }

  /**
   * Bulk import records with duplicate handling
   */
  static async bulkImport(
    db: any,
    table: SQLiteTable,
    options: BulkImportOptions,
    validationSchema?: z.ZodSchema,
    auditService?: any
  ): Promise<BulkOperationResult> {
    const { 
      data, 
      tenantId, 
      validateEach = true, 
      skipDuplicates = false, 
      updateOnConflict = false 
    } = options;
    
    const errors: Array<{ id: string; error: string }> = [];
    const results: any[] = [];
    let processed = 0;

    try {
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const itemId = item.id || crypto.randomUUID();

        try {
          // Validate each item if schema provided
          if (validationSchema && validateEach) {
            validationSchema.parse(item);
          }

          // Prepare record data
          const recordData = {
            ...item,
            id: itemId,
            tenantId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          // Check for duplicates if needed
          if (skipDuplicates || updateOnConflict) {
            const existing = await db
              .select()
              .from(table)
              .where(
                and(
                  eq(table.id, itemId),
                  eq(table.tenantId, tenantId)
                )
              )
              .limit(1);

            if (existing.length > 0) {
              if (skipDuplicates) {
                errors.push({ 
                  id: itemId, 
                  error: 'Duplicate record skipped' 
                });
                continue;
              } else if (updateOnConflict) {
                // Update existing record
                await db
                  .update(table)
                  .set({
                    ...recordData,
                    createdAt: existing[0].createdAt, // Preserve original creation time
                  })
                  .where(
                    and(
                      eq(table.id, itemId),
                      eq(table.tenantId, tenantId)
                    )
                  );
                
                results.push(recordData);
                processed++;
                continue;
              }
            }
          }

          // Insert new record
          await db.insert(table).values(recordData);
          results.push(recordData);
          processed++;

        } catch (itemError) {
          console.error(`Error processing item ${i}:`, itemError);
          errors.push({ 
            id: itemId, 
            error: itemError instanceof Error ? itemError.message : 'Unknown error' 
          });
        }
      }

      // Log audit trail
      if (auditService) {
        await auditService.logBulkOperation('BULK_IMPORT', {
          table: table._.name,
          tenantId,
          totalItems: data.length,
          processed,
          failed: errors.length,
          skipDuplicates,
          updateOnConflict,
        });
      }

      return {
        success: errors.length === 0,
        processed,
        failed: errors.length,
        errors,
        results,
      };
    } catch (error) {
      console.error('Bulk import error:', error);
      
      return {
        success: false,
        processed,
        failed: data.length,
        errors: [{ 
          id: 'bulk_import', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }],
      };
    }
  }

  /**
   * Bulk export records with filtering and formatting
   */
  static async bulkExport(
    db: any,
    table: SQLiteTable,
    options: {
      tenantId: string;
      filters?: Record<string, any>;
      format: 'json' | 'csv' | 'xlsx';
      fields?: string[];
      limit?: number;
    }
  ): Promise<{
    success: boolean;
    data?: any[];
    format: string;
    count: number;
    error?: string;
  }> {
    const { tenantId, filters, format, fields, limit = 10000 } = options;

    try {
      let query = db
        .select()
        .from(table)
        .where(eq(table.tenantId, tenantId));

      // Apply filters
      if (filters) {
        // Apply basic filters (extend as needed)
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && table[key as keyof typeof table]) {
            query = query.where(eq(table[key as keyof typeof table], value));
          }
        });
      }

      // Apply limit
      query = query.limit(limit);

      const data = await query;

      // Filter fields if specified
      let exportData = data;
      if (fields && fields.length > 0) {
        exportData = data.map(record => {
          const filteredRecord: any = {};
          fields.forEach(field => {
            if (record[field as keyof typeof record] !== undefined) {
              filteredRecord[field] = record[field as keyof typeof record];
            }
          });
          return filteredRecord;
        });
      }

      return {
        success: true,
        data: exportData,
        format,
        count: exportData.length,
      };
    } catch (error) {
      console.error('Bulk export error:', error);
      return {
        success: false,
        format,
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate bulk operation limits and permissions
   */
  static validateBulkOperation(
    operation: 'delete' | 'update' | 'import',
    itemCount: number,
    userRole: string
  ): { valid: boolean; error?: string } {
    // Define limits based on operation and user role
    const limits = {
      delete: {
        ADMIN: 10000,
        MANAGER: 1000,
        STAFF: 100,
        VIEWER: 0,
      },
      update: {
        ADMIN: 10000,
        MANAGER: 1000,
        STAFF: 100,
        VIEWER: 0,
      },
      import: {
        ADMIN: 50000,
        MANAGER: 10000,
        STAFF: 1000,
        VIEWER: 0,
      },
    };

    const userLimit = limits[operation][userRole as keyof typeof limits[typeof operation]];
    
    if (userLimit === undefined) {
      return { valid: false, error: 'Invalid user role' };
    }

    if (userLimit === 0) {
      return { valid: false, error: 'Insufficient permissions for bulk operations' };
    }

    if (itemCount > userLimit) {
      return { 
        valid: false, 
        error: `Bulk ${operation} limit exceeded. Maximum allowed: ${userLimit}, requested: ${itemCount}` 
      };
    }

    return { valid: true };
  }
}

/**
 * Bulk operation utilities
 */
export const bulkOperationUtils = {
  /**
   * Chunk array into smaller batches for processing
   */
  chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  },

  /**
   * Process items in batches with delay
   */
  async processBatches<T, R>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<R[]>,
    delayMs = 100
  ): Promise<R[]> {
    const batches = this.chunkArray(items, batchSize);
    const results: R[] = [];

    for (const batch of batches) {
      const batchResults = await processor(batch);
      results.push(...batchResults);
      
      // Add delay between batches to prevent overwhelming the system
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  },

  /**
   * Generate bulk operation summary
   */
  generateSummary(result: BulkOperationResult): string {
    const { success, processed, failed, errors } = result;
    
    let summary = `Bulk operation completed. Processed: ${processed}, Failed: ${failed}`;
    
    if (!success && errors.length > 0) {
      const errorSummary = errors.slice(0, 5).map(e => e.error).join('; ');
      summary += `. Errors: ${errorSummary}`;
      
      if (errors.length > 5) {
        summary += ` (and ${errors.length - 5} more)`;
      }
    }
    
    return summary;
  },
};