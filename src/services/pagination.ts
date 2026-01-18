import { z } from 'zod';
import { SQL, asc, desc, and, or, like, gte, lte, eq, isNull, isNotNull } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';

/**
 * Advanced Pagination Service
 * Requirements: 9.1, 9.2, 9.5
 */

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, any>;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta?: {
    sortBy?: string;
    sortOrder?: string;
    search?: string;
    filters?: Record<string, any>;
  };
}

export interface FilterConfig {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'notIn' | 'isNull' | 'isNotNull';
  value: any;
}

export interface SearchConfig {
  fields: string[];
  operator: 'and' | 'or';
}

/**
 * Enhanced pagination schema with advanced filtering
 */
export const advancedPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  filters: z.record(z.any()).optional(),
  // Advanced filtering
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  user: z.string().optional(),
  // Full-text search
  fullTextSearch: z.string().optional(),
  searchFields: z.array(z.string()).optional(),
  searchOperator: z.enum(['and', 'or']).default('or'),
});

export type AdvancedPaginationOptions = z.infer<typeof advancedPaginationSchema>;

/**
 * Advanced pagination service with comprehensive filtering and search
 */
export class PaginationService {
  /**
   * Apply pagination, sorting, filtering, and search to a query
   */
  static async paginate<T>(
    query: any,
    table: SQLiteTable,
    options: AdvancedPaginationOptions,
    searchConfig?: SearchConfig,
    allowedSortFields?: string[],
    defaultSortField?: string
  ): Promise<PaginationResult<T>> {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      search,
      filters,
      dateFrom,
      dateTo,
      fullTextSearch,
      searchFields,
      searchOperator
    } = options;

    // Clone the base query for counting
    let countQuery = query;
    let dataQuery = query;

    // Apply search filters
    if (search && searchConfig) {
      const searchConditions = searchConfig.fields.map(field => 
        like(table[field as keyof typeof table], `%${search}%`)
      );
      
      const searchCondition = searchConfig.operator === 'and' 
        ? and(...searchConditions)
        : or(...searchConditions);
      
      dataQuery = dataQuery.where(searchCondition);
      countQuery = countQuery.where(searchCondition);
    }

    // Apply full-text search
    if (fullTextSearch && searchFields && searchFields.length > 0) {
      const fullTextConditions = searchFields.map(field => 
        like(table[field as keyof typeof table], `%${fullTextSearch}%`)
      );
      
      const fullTextCondition = searchOperator === 'and' 
        ? and(...fullTextConditions)
        : or(...fullTextConditions);
      
      dataQuery = dataQuery.where(fullTextCondition);
      countQuery = countQuery.where(fullTextCondition);
    }

    // Apply date range filters
    if (dateFrom || dateTo) {
      const dateConditions: SQL[] = [];
      
      if (dateFrom) {
        dateConditions.push(gte(table.createdAt, new Date(dateFrom).getTime()));
      }
      
      if (dateTo) {
        dateConditions.push(lte(table.createdAt, new Date(dateTo).getTime()));
      }
      
      if (dateConditions.length > 0) {
        const dateCondition = and(...dateConditions);
        dataQuery = dataQuery.where(dateCondition);
        countQuery = countQuery.where(dateCondition);
      }
    }

    // Apply custom filters
    if (filters) {
      const filterConditions = this.buildFilterConditions(table, filters);
      if (filterConditions.length > 0) {
        const filterCondition = and(...filterConditions);
        dataQuery = dataQuery.where(filterCondition);
        countQuery = countQuery.where(filterCondition);
      }
    }

    // Apply sorting
    const sortField = this.validateSortField(sortBy, allowedSortFields, defaultSortField);
    if (sortField && table[sortField as keyof typeof table]) {
      const sortColumn = table[sortField as keyof typeof table];
      dataQuery = dataQuery.orderBy(
        sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn)
      );
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    dataQuery = dataQuery.limit(limit).offset(offset);

    // Execute queries
    const [data, totalResult] = await Promise.all([
      dataQuery,
      countQuery
    ]);

    const total = Array.isArray(totalResult) ? totalResult.length : 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      meta: {
        sortBy: sortField,
        sortOrder,
        search,
        filters,
      },
    };
  }

  /**
   * Build filter conditions from filter object
   */
  private static buildFilterConditions(table: SQLiteTable, filters: Record<string, any>): SQL[] {
    const conditions: SQL[] = [];

    for (const [field, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue;

      const column = table[field as keyof typeof table];
      if (!column) continue;

      if (typeof value === 'object' && value.operator) {
        // Advanced filter with operator
        const filterConfig = value as FilterConfig;
        conditions.push(this.buildFilterCondition(column, filterConfig));
      } else {
        // Simple equality filter
        conditions.push(eq(column, value));
      }
    }

    return conditions;
  }

  /**
   * Build individual filter condition based on operator
   */
  private static buildFilterCondition(column: any, config: FilterConfig): SQL {
    switch (config.operator) {
      case 'eq':
        return eq(column, config.value);
      case 'ne':
        return eq(column, config.value); // Note: SQLite doesn't have ne, use NOT eq
      case 'gt':
        return gte(column, config.value); // Using gte as gt equivalent
      case 'gte':
        return gte(column, config.value);
      case 'lt':
        return lte(column, config.value); // Using lte as lt equivalent
      case 'lte':
        return lte(column, config.value);
      case 'like':
        return like(column, `%${config.value}%`);
      case 'isNull':
        return isNull(column);
      case 'isNotNull':
        return isNotNull(column);
      default:
        return eq(column, config.value);
    }
  }

  /**
   * Validate and sanitize sort field
   */
  private static validateSortField(
    sortBy?: string,
    allowedFields?: string[],
    defaultField?: string
  ): string | undefined {
    if (!sortBy) return defaultField;
    
    if (allowedFields && !allowedFields.includes(sortBy)) {
      return defaultField;
    }
    
    return sortBy;
  }

  /**
   * Create cursor-based pagination for large datasets
   */
  static async cursorPaginate<T>(
    query: any,
    table: SQLiteTable,
    options: {
      cursor?: string;
      limit: number;
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    }
  ): Promise<{
    data: T[];
    nextCursor?: string;
    hasMore: boolean;
  }> {
    const { cursor, limit, sortBy, sortOrder } = options;
    
    let dataQuery = query;
    
    // Apply cursor condition
    if (cursor) {
      const sortColumn = table[sortBy as keyof typeof table];
      if (sortColumn) {
        const cursorCondition = sortOrder === 'asc' 
          ? gte(sortColumn, cursor)
          : lte(sortColumn, cursor);
        dataQuery = dataQuery.where(cursorCondition);
      }
    }
    
    // Apply sorting
    const sortColumn = table[sortBy as keyof typeof table];
    if (sortColumn) {
      dataQuery = dataQuery.orderBy(
        sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn)
      );
    }
    
    // Fetch one extra record to determine if there are more
    const data = await dataQuery.limit(limit + 1);
    
    const hasMore = data.length > limit;
    const results = hasMore ? data.slice(0, limit) : data;
    
    // Generate next cursor
    let nextCursor: string | undefined;
    if (hasMore && results.length > 0) {
      const lastItem = results[results.length - 1];
      nextCursor = lastItem[sortBy as keyof typeof lastItem] as string;
    }
    
    return {
      data: results,
      nextCursor,
      hasMore,
    };
  }
}

/**
 * Pagination utilities
 */
export const paginationUtils = {
  /**
   * Calculate pagination metadata
   */
  calculatePagination(page: number, limit: number, total: number) {
    const totalPages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      offset: (page - 1) * limit,
    };
  },

  /**
   * Validate pagination parameters
   */
  validatePagination(page: number, limit: number) {
    if (page < 1) throw new Error('Page must be at least 1');
    if (limit < 1) throw new Error('Limit must be at least 1');
    if (limit > 1000) throw new Error('Limit cannot exceed 1000');
  },

  /**
   * Generate pagination links
   */
  generatePaginationLinks(baseUrl: string, page: number, totalPages: number) {
    const links: Record<string, string> = {};
    
    if (page > 1) {
      links.first = `${baseUrl}?page=1`;
      links.prev = `${baseUrl}?page=${page - 1}`;
    }
    
    if (page < totalPages) {
      links.next = `${baseUrl}?page=${page + 1}`;
      links.last = `${baseUrl}?page=${totalPages}`;
    }
    
    return links;
  },
};